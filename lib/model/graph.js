"use strict";

var Store = require('../store'),
    Index = Store.Index,
    Metric = require('./metric'),
    lodash = require('lodash'),
    when = require('when');

function Graph(data){
    this.id = data.id;
    this.title = data.title;
    this.metricIds = data.metrics;
}

Graph.store = new Store()
    .addIndex(new Index('id', {unique: false}))
    .addIndex(new Index('title'));

Graph.getById = function(id){
    return Graph.store.query({'id': id}).then(function(res){
        var item = res.items[0];
        if(item === undefined){
            return new Error('No graph with id `'+id+'`');
        }
        return item;
    });
};

Graph.getAll = function(){
    return Graph.store.query({}).then(function(res){
        if(res.items.length === 0){
            return new Error('No graphs stored');
        }
        return res.items;
    });
};

Graph.fromConfig = function(data){
    return data.map(function(config){
        config.title = config.title || [config.namespace, config.name].join(':');
        var g = new Graph(config);
        Graph.store.insert(g);
        return g;
    });
};

Graph.prototype.loadAllSeriesData = function(period, start, end){
    var d = when.defer();

    when.all(this.metricIds.map(function(id){
        return Metric.getById(id);
    }), function(metrics){
        when.all(metrics.map(function(metric){
            return metric.loadAllSeriesData(period, start, end);
        }), function(allSeries){
            d.resolve({
                'metrics': metrics,
                'series': lodash.flatten(allSeries)
            });
        });
    });

    return d.promise;
};

module.exports = Graph;