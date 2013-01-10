"use strict";

var Store = require('../store'),
    Index = Store.Index;

function Graph(data){
    this.title = data.title;
    this.metricNames = data.metrics;
}

Graph.Store = new Store()
    .addIndex(new Index('title'));

Graph.getAll = function(){
    return Graph.Store.query({}).then(function(res){
        if(res.items.length === 0){
            return new Error('No graphs stored');
        }
        return res.items;
    });
};

Graph.fromConfig = function(data){
    return data.map(function(config){
        config.title = config.title || [config.namespace, config.name].join(':'),
        var m = new Graph(config);
        Graph.Store.insert(m);
        return m;
    });
};

module.exports = Graph;