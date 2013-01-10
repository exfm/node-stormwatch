"use strict";

var $ = require('jquery'),
    Backbone = require('backbone'),
    Rickshaw = require('rickshaw');

var Metric = Backbone.Model.extend({
    url: function(){
        return "/metric/" + this.get('id');
    }
});

var MetricCollection = Backbone.Collection.extend({
    model: Metric,
    url: '/metric'
});

var MetricGraphView = Backbone.View.extend({
    render: function(){
        this.graph = new Rickshaw.Graph({
            element: this.el,
            renderer: 'line',
            series: [{
                    data: this.model.get('data'),
                    color: 'steelblue'
            }]
        }).render();
        return this;
    }
});

new MetricCollection().fetch({
    'success': function(collection, response, options){
        collection.models.forEach(function(m){
            m.fetch({
                'success': function(model, response, options){
                    $('#app').append(
                        new MetricGraphView({model: model}).render().el);
                }
            });
        });
    }
});