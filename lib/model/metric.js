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
function Metric(data){
    this.id = crypto.createHash('sha1').update(this.title).digest('hex');

    this.namespace = data.namespace;
    this.name = data.name;
    this.type = data.type;
    this.unit = data.unit;
    this.dimensions = data.dimensions || {};
    this.thing = data.thing;
    this.title = data.title;
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

// @todo (lucas) If dimensions > 10, split into multiple requests and combine.
Metric.prototype.getDataPoints = function(period, start, end){
    start = start.toISOString();
    end = end.toISOString();

    var dims = this.dimensions;
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
module.exports.fromConfig = function(data){
    return data.map(function(config){
        config.title = config.title || [config.namespace, config.name].join(':'),
        var m = new Metric(config);
        Metric.Store.insert(m);
        return m;
    });
};