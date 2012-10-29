"use strict";

var aws = require('plata'),
	sequence = require('sequence'),
	when = require('when'),
	request = require('superagent'),
	getConfig = require('junto'),
	express = require('express'),
	fs = require('fs'),
	app = express(),
	server = require('http').createServer(app),
	io = require('socket.io').listen(server),
	config,
	sockets = {},
	cloudData = {},
	metrics = [
		{
			'name': 'ELBLatency',
			'namespace': 'AWS/ELB',
			'metricName': 'Latency',
			'metricType': 'Average',
			'unit': 'Seconds',
			'unitLabel': 's',
			'range': [0, 5],
			'loadBalancerName': 'production'
		},
		{
			'name': 'ELBRequestCount',
			'namespace': 'AWS/ELB',
			'metricName': 'RequestCount',
			'metricType': 'Sum',
			'unit': 'Count',
			'unitLabel': '',
			'range': [0, 10000],
			'loadBalancerName': 'production'
		},
		{
			'name': 'ELBHealthyHostCount',
			'namespace': 'AWS/ELB',
			'metricName': 'HealthyHostCount',
			'metricType': 'Average',
			'unit': 'Count',
			'unitLabel': '',
			'range': [0, 10],
			'loadBalancerName': 'production'
		},
		{
			'name': 'ELBUnhealthyHostCount',
			'namespace': 'AWS/ELB',
			'metricName': 'UnhealthyHostCount',
			'metricType': 'Average',
			'unit': 'Count',
			'unitLabel': '',
			'range': [null, null],
			'loadBalancerName': 'production'
		},
		{
			'name': 'ELBServerErrors',
			'namespace': 'AWS/ELB',
			'metricName': 'HTTPCode_ELB_5XX',
			'metricType': 'Sum',
			'unit': 'Count',
			'unitLabel': '',
			'range': [null, null],
			'loadBalancerName': 'production'
		}
	];

getConfig('development').then(function(c){
	config = c;
	aws.connect(config.aws);
});

app.get('/', function(req, res){
	res.sendfile(__dirname + '/index.html');
});

server.listen(3000);
console.log('Listening on port 3000');


io.sockets.on('connection', function(socket){
    sockets[socket.id] = socket;
    socket.emit('newData', cloudData);
});

io.sockets.on('disconnect', function(socket){
    delete sockets[socket.id];
});

var startTime = new Date(new Date().getTime() - 1000*60*60);
getNewData(startTime, 60);

setInterval(function(){
	var startTime = new Date(new Date().getTime() - 1000*60*60)
	getNewData(startTime, 60);
}, 60000);

function getNewData(startTime, interval){
	sequence().then(function(next){
		aws.onConnected(next);
	}).then(function(next){
		// load balancer metrics
		var endTime = new Date();
		when.all(metrics.map(function(cloudMetric){
			var d = when.defer(),
				statistic = {};
			statistic[cloudMetric.metricType] = '1';
			aws.cloudWatch.getMetricStatistics(cloudMetric.namespace, cloudMetric.metricName, 
				interval, startTime.toISOString(), endTime.toISOString(), statistic, cloudMetric.unit, {
				'LoadBalancerName': cloudMetric.loadBalancerName
			}).then(function(data){
				var datapoints = formatData(data.getMetricStatisticsResponse.getMetricStatisticsResult),
					name = cloudMetric.namespace+' '+cloudMetric.metricName;
				cloudData[cloudMetric.name] = {
					'name': name,
					'datapoints': datapoints,
					'unitLabel': cloudMetric.unitLabel,
					'range': cloudMetric.range,
					'loadBalancerName': cloudMetric.loadBalancerName
				}
				d.resolve();
			});
			return d.promise;
		})).then(next);
	}).then(function(next, data){
		sendData(cloudData);
	})
}

function sendData(data) {
	for (var socket in sockets) {
		sockets[socket].emit('newData', data);
	}
}

function formatData(data){
	var asc = data.datapoints.sort(function(a,b){
		a = new Date(a.timestamp);
		b = new Date(b.timestamp);
		return a-b;
	}),
		formatted = [];

	asc.forEach(function(item){
		formatted.push({
			'timestamp': item.timestamp,
			'value': item.sum || item.average
		})
	});
	console.log(formatted);
	return formatted;
}