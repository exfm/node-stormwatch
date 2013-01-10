"use strict";

var express = require('express'),
    browserify = require('browserify'),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    nconf = require('nconf').file({'file': 'config.json'}),
    aws = require('plata'),
    getConfig = require('junto'),
    Metric = require('./model'),
    moment = require('moment'),
    fs = require('fs'),
    metrics;

require('plog').all().level('silly');

function createBundle(watch){
    var rebuildLock = false,
        b = browserify('./static/js/main.js', {
            require : {jquery: 'jquery-browserify', backbone: 'backbone-browserify-lodash'},
            'watch': watch
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
            start = moment().subtract('hours', 3)._d;
        metric.getDataPoints(period, start, new Date()).then(function(data){
            metric.data = data;
            res.send(metric);
        });
    }, function(err){
        res.send(400, err.message);
    });
});

app.get('/metric/:id/current', function(req, res){
    Metric.getById(req.param('id')).then(function(metric){
        var period = Number(req.param('period', 300)),
            start = moment().subtract('minutes', 1)._d;
        metric.getDataPoints(period, start, new Date()).then(function(data){
            metric.data = data;
            res.send(metric);
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