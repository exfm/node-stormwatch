"use strict";

var when = require('when'),
    util = require('util'),
    uuid = require('node-uuid');

function defer(func){
    var d = when.defer();
    process.nextTick(function(){
        func(d);
    });
    return d.promise;
}


function Index(key, opts){
    opts = opts || {};

    this.key = key;
    this.keyToGuids = {};
    this.unique = opts.unique || false;
}

Index.prototype.add = function(guid, value){
    // if(this.unique && this.keyToGuids.hasOwnProperty(value)){
    //     throw new Error('Item with ' + this.key + ' `'+value+'` already exists.');
    // }

    if(!this.keyToGuids.hasOwnProperty(value)){
        this.keyToGuids[value] = [];
    }
    this.keyToGuids[value].push(guid);
    return this;
};

Index.prototype.remove = function(guid, value){
    var items = this.keyToGuids[value],
        index = items.indexOf(guid);

    items.splice(index, 1);
    if(items.length === 0){
        delete this.keyToGuids[value];
    }
    return this;
};

Index.prototype.find = function(value){
    return this.keyToGuids[value] || [];
};

// Imagine this is a full DB.
function Store(){
    this.items = {};

    // All indexes for the store
    this.indexes = {};

    // List of keys that are indexed
    this.indexKeys = [];
}

// Get an existing index by key.
Store.prototype.index = function(key){
    return this.indexes[key];
};

// Declare a new index.
Store.prototype.addIndex = function(index){
    this.indexes[index.key] = index;
    this.indexKeys.push(index.key);
    return this;
};

// Insert a new item into the store.
Store.prototype.insert = function(item){
    var guid = item.id || uuid.v4();
    this.indexKeys.forEach(function(key){
        this.indexes[key].add(guid, item[key]);
        this.items[guid] = item;
    }.bind(this));
    return this;
};

Store.prototype.query = function(conditions, start, limit){
    start = start || 0;
    limit = limit || -1;

    var queryKeys = Object.keys(conditions),
        results = [],
        total = 0,
        items = [];

    return defer(function(promise){
        if(queryKeys.length > 0){
            queryKeys.forEach(function(queryKey){
                var index = this.index(queryKey),
                    queryValue = conditions[queryKey];

                if(index){
                    results = results.concat(index.find(queryValue));
                }
            }.bind(this));
        }
        else{
            results = Object.keys(this.items);
        }

        if(results.length === 0){
            return promise.reject(new Error('No results found for query ' +
                util.inspect(conditions, true)));
        }

        total = results.length;
        if(limit > -1){
            results = results.slice(start, (limit -1));
        }

        items = results.map(function(guid){
            return this.items[guid];
        }.bind(this));

        promise.resolve({'items': items, 'total': total});
    }.bind(this));
};

module.exports = Store;
module.exports.Index = Index;