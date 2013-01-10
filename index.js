#!/usr/bin/env node

"use strict";

var aws = require('plata'),
    getConfig = require('junto'),
    express = require('express'),
    nconf = require('nconf').file({'file': 'config.json'}),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server);

io.set('transports', ['xhr-polling']);

var defaultRange = 30,
    defaultInterval = 1,
    ELBMetrics = nconf.get('ELBMetrics'),
    EC2Metrics = nconf.get('EC2Metrics'),
    CustomMetrics = nconf.get('CustomMetrics'),
    Basic = nconf.get('Basic'),
    Detailed = nconf.get('Detailed'),
    BasicStats = nconf.get('BasicStats');

getConfig('development').then(function(c){
    nconf.overrides(c);
    aws.connect(c.aws);
});

app.set('view engine', 'hbs');
app.set('views', __dirname + '/views');
app.use(express.bodyParser());
app.use("/static", express.static(__dirname + "/static"));

app.get('/', function(req, res){
    res.render('index', {
        'view': 'basic',
        'metric_list': Basic,
        'basic_li': 'active',
        'advanced_li': ''
    });
});

app.get('/detailed', function(req, res){
    res.render('index', {
        'view': 'detailed',
        'metric_list': Detailed,
        'basic_li': '',
        'detailed_li': 'active'
    });
});

server.listen(3611);

io.sockets.on('connection', function(socket){
    // @todo (lucas) Set a last fetched value on the socket to limit the range
    // on future updates so that the amount of data sent is small and tight on
    // future requests
    socket.on('requestData', function(data){
        var rangeInMinutes = convertToMinutes(data.timeRange),
            interval = rangeInMinutes/30;
        getCloudWatchData(rangeInMinutes, interval, data.view).then(function(newData){
            socket.emit('newCloudWatchData', newData);
        });
    });
});

function convertToMinutes(timeRange) {
    switch(timeRange.split('')[timeRange.length-1]) {
        case 'm':
            return timeRange.split('m')[0];
        case 'h':
            return timeRange.split('h')[0]*60;
        case 'd':
            return timeRange.split('d')[0]*60*24;
    }
    return timeRange;
}

function splitMetricsForView(view){
    var combinedMetrics = ELBMetrics.concat(EC2Metrics).concat(CustomMetrics);
    if (view === 'basic') {
        return combinedMetrics.filter(function(m){
            return Basic.indexOf(m.metricName) > -1;
        });
    }
    else if (view === 'detailed') {
        return combinedMetrics.filter(function(m){
            return Detailed.indexOf(m.metricName) > -1;
        });
    }
}

function getProperty(obj, prop) {
    var parts = prop.split('.'),
        last = parts.pop(),
        l = parts.length,
        i = 1,
        current = parts[0];
    while((obj = obj[current]) && i < l) {
        current = parts[i];
        i++;
    }
    if(obj) {
        return obj[last];
    }
}
