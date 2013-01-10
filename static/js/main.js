"use strict";

var $ = require('jquery'),
    Backbone = require('backbone'),
    Rickshaw = require('rickshaw');

var Graph = Backbone.Model.extend({
    url: function(){
        return "/graph/" + this.get('id');
    }
});

var GraphCollection = Backbone.Collection.extend({
    model: Graph,
    url: '/graph'
});

var GraphView = Backbone.View.extend({
    className: 'chart-container',
    render: function(){

    }
});

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
    className: 'chart-container',
    render: function(){
        var self = this,
            graphWidth = $('#app').width();

        this.chartEl = $('<div class="chart" />');
        this.yAxisEl = $('<div class="yaxis" />');

        this.$el.append('<h3>'+this.model.get('title')+'</h3>');
        this.$el.append(this.yAxisEl);
        this.$el.append(this.chartEl);

        this.graph = new Rickshaw.Graph({
            element: this.chartEl.get(0),
            renderer: 'line',
            width: graphWidth,
            series: [{
                    data: this.model.get('data'),
                    // color: '#e53003', // red
                    // color: '#0088cc', // blue
                    // color: '#D4D4D3', // gray
                    // color: '#2da012', // green
                    color: '#333333', // Black
                    name: this.model.get('title')
            }]
        });

        this.yAxis = new Rickshaw.Graph.Axis.Y({
            graph: this.graph,
            orientation: 'left',
            tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
            element: this.yAxisEl.get(0),
        });

        this.graph.render();

        this.hoverDetail = new Rickshaw.Graph.HoverDetail( {
            graph: this.graph,
            yFormatter: function(y) {
                return y + " " + self.model.get('thing');
            }
        });

        this.axes = new Rickshaw.Graph.Axis.Time( {
            graph: this.graph
        });
        // this.axes.render();


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