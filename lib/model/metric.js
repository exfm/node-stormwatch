"use strict";

var when = require('when'),
    aws = require('plata'),
    crypto = require('crypto'),
    util = require('util'),
    Store = require('./lib/store'),
    Index = Store.Index;

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
        this.method = matches[1];
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
                d.resolve(res.instances.map(function(instance){
                    return {'name': 'InstanceID', 'value': instance.id};
                }));
            });
        }
    }
    else{
        d.resolve(this.data);
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
    this.title = data.title;

    this.dims = Object.keys(this.dimensions).map(function(key){
        return new Dimension(key, this.dimensions[key]);
    }.bind(this));

}

Metric.Store = new Store()
    .addIndex(new Index('id', {'unique': true}))
    .addIndex(new Index('title'));

// Return a promise to:
//
// 1. Get used to how promises work
// 2. Potentially swap out for reading from an async source instead,
//     but not having to change any of your code.
Metric.getById = function(id){
    return Metric.Store.query({'id': id}).then(function(res){
        var item = res.items[0];
        if(item === undefined){
            return new Error('No metric with id `'+id+'`');
        }
        return item;
    });
};

Metric.getAll = function(){
    return Metric.Store.query({}).then(function(res){
        if(res.items.length === 0){
            return new Error('No metrics stored');
        }
        return res.items;
    });
};

Metric.fromConfig = function(data){
    return data.map(function(config){
        config.title = config.title || [config.namespace, config.name].join(':'),
        var m = new Metric(config);
        Metric.Store.insert(m);
        return m;
    });
};

Metric.prototype.loadAllSeriesData = function(period, start, end){
    this.series = [
        {
            'name': this.title,
            'data': []
        }
    ];
};

Metric.prototype.getSeriesData = function(dims, period, start, end){
    start = start.toISOString();
    end = end.toISOString();
    return aws.cloudWatch.getMetricStatistics(this.namespace, this.name, period,
        start, end, [this.type], this.unit, dims)
        .then(function(res){
            return prepare(res.getMetricStatisticsResponse.getMetricStatisticsResult.datapoints.member);
        }, function(err){
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