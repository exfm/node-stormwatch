"use strict";

var express = require('express'),
    browserify = require('browserify'),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    nconf = require('nconf').file({'file': 'config.json'}),
    aws = require('plata'),
    getConfig = require('junto'),
    model = require('./lib/model'),
    Metric = model.Metric,
    Graph = model.Graph,
    moment = require('moment'),
    fs = require('fs'),
    metrics;

require('plog').all().level('silly');

function createBundle(watch){
    var rebuildLock = false,
        b = browserify('./static/js/main.js', {
            require : {jquery: 'jquery-browserify', backbone: 'backbone-browserify-lodash'},
            'watch': watch,
            'debug': true
        });
    if(watch){
        b.on('bundle', function(){
            if(!rebuildLock){
                rebuildLock = true;
                app.emit('rebuild', b);
                setTimeout(function(){
                    rebuildLock = false;
                }, 1000);
            }
        });
    }

    return b;
}

app.configure(function(){
    app.set('browserify', createBundle(true));
    app.set('views', __dirname + '/views');
    app.set('view engine', 'hbs');
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
    app.use("/static", express.static(__dirname + '/static'));
    app.use(app.get('browserify'));
    getConfig().then(function(c){
        nconf.overrides(c);
        aws.connect(c.aws);
    });

    Metric.fromConfig(nconf.get('metrics'));
    Graph.fromConfig(nconf.get("graphs"));
});

app.get('/', function(req, res){
    res.render('test');
});

app.get('/metric', function(req, res){
    Metric.getAll().then(function(metrics){
        res.send(metrics);
    });
});

app.get('/metric/:id', function(req, res){
    Metric.getById(req.param('id')).then(function(metric){
        var period = Number(req.param('period', 300)),
            start = moment().subtract('minutes', 300)._d;

        metric.loadAllSeriesData(period, start, new Date()).then(function(series){
            metric.series = series;
            res.send(metric);
        }, function(err){
            res.send(400, err.message);
        });
    }, function(err){
        res.send(400, err.message);
    });
});

app.get('/graph', function(req, res){
    Graph.getAll().then(function(graphs){
        res.send(graphs);
    });
});

app.get('/graph/:id', function(req, res){
    Graph.getById(req.param('id')).then(function(graph){
        var period = Number(req.param('period', 300)),
            start = moment().subtract('minutes', 300)._d;

        graph.loadAllSeriesData(period, start, new Date()).then(function(data){
            graph.series = data.series;
            graph.metrics = data.metrics;
            res.send(graph);
        }, function(err){
            res.send(400, err.message);
        });
    }, function(err){
        res.send(400, err.message);
    });
});

server.listen(8080);

io.sockets.on('connection', function(socket){
    app.on('rebuild', function(){
        socket.namespace.in(socket.flags.room).packet({
            'type': 'event',
            'name': 'rebuild',
            'args': []
        });
    });
});

module.exports = app;