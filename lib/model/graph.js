"use strict";

var Store = require('../store'),
    Index = Store.Index;

function Graph(data){
    this.id =
    this.title = data.title;
    this.metricIds = data.metrics;
}

Graph.store = new Store()
    .addIndex(new Index('id', {unique: true}))
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
        config.title = config.title || [config.namespace, config.name].join(':'),
        var m = new Graph(config);
        Graph.store.insert(m);
        return m;
    });
};

module.exports = Graph;