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
	sockets = {};

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
    getNewData();
});

io.sockets.on('disconnect', function(socket){
    delete sockets[socket.id];
});

setInterval(function(){
	getNewData();
}, 60000);

function getNewData(){
	sequence().then(function(next){
		aws.onConnected(next);
	}).then(function(next){
		var startTime = new Date(new Date().getTime() - 1200000),
			endTime = new Date();
		aws.cloudWatch.getMetricStatistics('AWS/ELB', 'Latency', 60, startTime.toISOString(), endTime.toISOString(), {
			'Average': '1'}, 'Seconds', {
			'LoadBalancerName': 'production'
		}).then(function(data){
			sendData(data.getMetricStatisticsResponse.getMetricStatisticsResult);
		});
	});
}

function sendData(data) {
	for (var socket in sockets) {
		sockets[socket].emit('newData', data);
	}
}