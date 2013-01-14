"use strict";

var when = require('when'),
    aws = require('plata'),
    crypto = require('crypto'),
    util = require('util'),
    Store = require('../store'),
    Index = Store.Index,
    log = require('plog')('stormwatch.model.metric');

// {
//     "title": "Prod ELB Latency",
//     "namespace": "AWS/ELB",
//     "name": "Latency",
//     "type": "Average",
//     "unit": "Seconds",
//     "dimensions": {
//         "LoadBalancerName": "production"
//     }
// },
// @todo (lucas) support dynamic dimensions.  ie:
// {
//     "title": "Production Python App CPU",
//     "namespace": "AWS/EC2",
//     "name": "CPUUtilization",
//     "type": "Average",
//     "unit": "Count",
//     "dimensions": {
//         "ec2:tagged": {
//             "Environment": "production",
//             "Service Name": "pythonapp"
//         }
//     }
// }

function Dimension(name, data){
    this.name = name;
    this.data = data;

    this.isRemote = false;
    this.service = null;
    this.method = null;
    this.params = {};

    var matches  = /([ec2]+):(\w+)/.exec(this.name);
    if(matches){
        this.isRemote = true;
        this.service = matches[1];
        this.method = matches[2];
    }
}
Dimension.prototype.getValues = function(){
    var d = when.defer(),
        filters = {};

    if(this.service === 'ec2'){
        if(this.method === 'tagged'){
            Object.keys(this.data).forEach(function(key){
                filters['tag:' + key] = this.data[key];
            }.bind(this));

            aws.ec2.describeInstances(filters).then(function(res){

                var data = res.instances.map(function(instance){
                    return {'name': 'InstanceId', 'value': instance.id};
                });
                d.resolve(data);
            });
        }
    }
    else{
        var o= {};
        o[this.name] = this.data;
        d.resolve(o);
    }
    return d.promise;
};

function Metric(data){
    this.id = data.id || crypto.createHash('sha1').update(this.title).digest('hex');
    this.namespace = data.namespace;
    this.name = data.name;
    this.type = data.type;
    this.unit = data.unit;
    this.dimensions = data.dimensions || {};
    this.thing = data.thing;
    this.title = data.title || [this.namespace, this.name].join(':');

    this.dims = Object.keys(this.dimensions).map(function(key){
        return new Dimension(key, this.dimensions[key]);
    }.bind(this));

}

Metric.Store = new Store()
    .addIndex(new Index('id', {'unique': false}))
    .addIndex(new Index('title'));

// Return a promise to:
//
// 1. Get used to how promises work
// 2. Potentially swap out for reading from an async source instead,
//     but not having to change any of your code.
Metric.getById = function(id){
    return Metric.Store.query({'id': id}).then(function(res){
        log.silly('Metric.getById `'+id+'` ' + util.inspect(res, true, 5, false));
        var item = res.items[0];
        if(item === undefined){
            return new Error('No metric with id `'+id+'`');
        }
        return item;
    });
};

Metric.getAll = function(){
    return Metric.Store.query({}).then(function(res){
        log.silly('Metric.getAll ' + util.inspect(res, true, 5, false));
        if(res.items.length === 0){
            return new Error('No metrics stored');
        }
        return res.items;
    });
};

Metric.fromConfig = function(data){
    return data.map(function(config){
        var m = new Metric(config);
        Metric.Store.insert(m);
        return m;
    });
};

Metric.prototype.loadAllSeriesData = function(period, start, end){
    var d = when.defer(),
        series = [
            {
                'name': this.title,
                'data': [],
                'dims': {}
            }
        ];

    when.all(this.dims.map(function(dim){
        return dim.getValues();
    }), function(res){
        res.forEach(function(r){
            if(Array.isArray(r)){
                series = [];
                r.forEach(function(item){
                    var dim = {};
                    dim[item.name] = item.value;
                    series.push({
                        'name': item.name + " " + item.value,
                        'data': [],
                        'dims': dim
                    });
                }.bind(this));
            }
            else {
                series[0].dims = r;
            }
        }.bind(this));
        when.all(series.map(function(s, index){
            return this.getSeriesData(s.dims, period, start, end).then(function(res){
                s.data = res;
            });
        }.bind(this)), function(r){
            d.resolve(series);
        });
    }.bind(this));
    return d.promise;
};

Metric.prototype.getSeriesData = function(dims, period, start, end){
    start = start.toISOString();
    end = end.toISOString();
    log.silly('Calling cloudwatch for metric ' + [this.namespace, this.name, start, end, [this.type], this.unit, JSON.stringify(dims)].join(':'));
    return aws.cloudWatch.getMetricStatistics(this.namespace, this.name, period,
        start, end, [this.type], this.unit, dims)
        .then(function(res){
            var x = res.getMetricStatisticsResponse.getMetricStatisticsResult,
                vals = x.datapoints ? x.datapoints.member : [];

            return prepare(vals);
        }.bind(this), function(err){
            throw err;
        });
};

function prepare(datapoints){
    return datapoints.sort(function(a, b){
        if (a.timestamp < b.timestamp){
            return -1;
        }
        if (a.timestamp > b.timestamp){
            return 1;
        }
        return 0;
    }).map(function(item){
        return {
            'x': new Date(item.timestamp).getTime() / 1000,
            'y': (Number(item.sum) || Number(item.average))
        };
    });
}

module.exports = Metric;