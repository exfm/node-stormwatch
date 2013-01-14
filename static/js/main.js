"use strict";

var $ = require('jquery'),
    Backbone = require('backbone'),
    Rickshaw = require('rickshaw'),
    gauge = require('./gauge.js'),
    Gauge = gauge.Gauge,
    numbers = require('numbers');
    console.log(numbers);

// For a series

//     [
//         {
//             'title': 'Listeners',
//             'data': [{x: 1, y: 2}]
//         }
//     ]

// Return min, max, median, mean
function getSeriesStats(series){
    var mins = [],
        maxes = [],
        means = [],
        medians = [],
        sampleSize = series.length,
        currents = [];

    series.forEach(function(s){
        var vals = s.data.map(function(point){
            return point.y;
        });
        mins.push(numbers.basic.min(vals));
        maxes.push(numbers.basic.max(vals));
        means.push(numbers.statistic.mean(vals));
        medians.push(numbers.statistic.median(vals));
        // console.log(vals[(vals.length -1)], vals[(vals.length -2)]);
        if(series.length > 1 && vals[(vals.length -1)] < 1){
            currents.push(vals[(vals.length -2)]);
        }
        currents.push(vals[(vals.length -1)]);
    });
    console.log(numbers.statistic.mean(currents));
    return {
        'min': numbers.statistic.mean(mins),
        'max': numbers.statistic.mean(maxes),
        'median': numbers.statistic.mean(medians),
        'mean': numbers.statistic.mean(means),
        'current': numbers.statistic.mean(currents)
    };
}

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


        this.canvasEl = $('<canvas width="140" height="50" />');
        this.labelEl = $('<div class="span2" />');
        this.counterEl = $('<span class="counter" />');
        this.guageLabelEl = $('<span class="p"></div>');
        this.guageEl = $('<div class="guages span4" />');


        $('#guages').append(this.guageEl);
        this.guageEl.append(this.canvasEl);
        this.guageEl.append(this.labelEl);
        this.labelEl.append(this.counterEl);
        this.labelEl.append(this.guageLabelEl);
        this.guageEl.append('<div class="span2">'+this.model.get('title')+'</div>');


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
            ],
            gaugeOpts,
            seriesStats;

        series.forEach(function(s, index){
            s.color = colors[index];
        });
        Rickshaw.Series.zeroFill(series);

        seriesStats = getSeriesStats(series);

        gaugeOpts = {
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

        this.gauge = new Gauge(this.canvasEl.get(0)).setOptions(gaugeOpts); // create sexy gauge!
        this.gauge.maxValue = seriesStats.max; // set max gauge value
        this.gauge.animationSpeed = 32; // set animation speed (32 is default value)
        this.gauge.set(seriesStats.current); // set actual value
        this.gauge.setTextField(this.counterEl.get(0));

        this.chartEl = $('<div class="chart" />');
        this.yAxisEl = $('<div class="yaxis" />');

        this.$el.append(this.yAxisEl);
        this.$el.append(this.chartEl);

        this.graph = new Rickshaw.Graph({
            element: this.chartEl.get(0),
            renderer: 'line',
            width: graphWidth,
            series: series
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
                return y + " " + self.model.get('metrics')[0].thing;
            }
        });
        var c = (self.model.get('metrics')[0].thing === 'percent') ? '%' : '';
        this.guageLabelEl.html(c);

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
            setInterval(function(){

            }, 1000);
        });
    }
});