"use strict";

var $ = require('jquery'),
    Backbone = require('backbone'),
    Rickshaw = require('rickshaw'),
    gauge = require('./gauge.js'),
    Gauge = gauge.Gauge;

var Graph = Backbone.Model.extend({
    url: function(){
        return "/graph/" + this.get('id');
    }
});

var GraphCollection = Backbone.Collection.extend({
    model: Graph,
    url: '/graph'
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

var GraphView = Backbone.View.extend({
    className: 'chart-container',
    render: function(){
        this.$el.append('<h3>'+this.model.get('title')+'</h3>');

        if(this.model.get('title') === 'Listeners'){
            this.canvasEl = $('<canvas width="220" height="70" />');
            this.counterEl = $('<div class="counter" />');
            this.$el.append(this.canvasEl);
            this.$el.append(this.counterEl);
            var opts = {
              lines: 12, // The number of lines to draw
              angle: 0.35, // The length of each line
              lineWidth: 0.1, // The line thickness
              pointer: {
                length: 0.9, // The radius of the inner circle
                strokeWidth: 0.035, // The rotation offset
                color: '#333333' // Fill color
              },
              colorStart: '#0088cc',   // Colors
              colorStop: '#0088cc',    // just experiment with them
              strokeColor: '#D4D4D3',   // to see which ones work best for you
              generateGradient: true
            };
            this.gauge = new Gauge(this.canvasEl.get(0)).setOptions(opts); // create sexy gauge!
            this.gauge.maxValue = 3000; // set max gauge value
            this.gauge.animationSpeed = 32; // set animation speed (32 is default value)
            this.gauge.set(2325); // set actual value
            this.gauge.setTextField(this.counterEl.get(0));
            return this;
        }
        var self = this,
            graphWidth = $('#app').width(),
            series = this.model.get('series'),
            colors = [
                '#e53003', // red
                '#0088cc', // blue
                '#D4D4D3', // gray
                '#2da012', // green
                '#333333', // Black
                '#e53003', // red
                '#0088cc', // blue
                '#D4D4D3', // gray
                '#2da012', // green
                '#333333', // Black
                '#e53003', // red
                '#0088cc', // blue
                '#D4D4D3', // gray
                '#2da012', // green
                '#333333', // Black
                '#e53003', // red
                '#0088cc', // blue
                '#D4D4D3', // gray
                '#2da012', // green
                '#333333', // Black
            ];

        series.forEach(function(s, index){
            s.color = colors[index];
        });
        Rickshaw.Series.zeroFill(series);

        console.log(this.model);


        this.chartEl = $('<div class="chart" />');
        this.yAxisEl = $('<div class="yaxis" />');

        this.$el.append(this.yAxisEl);
        this.$el.append(this.chartEl);

        this.graph = new Rickshaw.Graph({
            element: this.chartEl.get(0),
            renderer: 'line',
            width: graphWidth,
            series: series
            // series: [{
            //         data: this.model.get('data'),
            //         // color: '#e53003', // red
            //         // color: '#0088cc', // blue
            //         // color: '#D4D4D3', // gray
            //         // color: '#2da012', // green
            //         color: '#333333', // Black
            //         name: this.model.get('title')
            // }]
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
        if(series.length > 1){
            this.legendEl = $('<div class="legend" />');
            this.$el.append(this.legendEl);

            this.legend = new Rickshaw.Graph.Legend({
                graph: this.graph,
                element: this.legendEl.get(0)
            });

            this.highlighter = new Rickshaw.Graph.Behavior.Series.Highlight({
                graph: this.graph,
                legend: this.legend
            });
        }


        return this;
    }
});

new GraphCollection().fetch({
    'success': function(collection, response, options){
        collection.models.forEach(function(g){
            g.fetch({
                'success': function(model, response, options){
                    $('#app').append(
                        new GraphView({model: model}).render().el);
                }
            });
        });
    }
});