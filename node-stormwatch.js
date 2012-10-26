"use strict";

var aws = require('plata'),
	sequence = require('sequence'),
	when = require('when'),
	request = require('superagent'),
	getConfig = require('junto'),
	config;

getConfig('development').then(function(c){
	config = c;
	aws.connect(config.aws);
});

sequence().then(function(next){
	aws.onConnected(next);
}).then(function(next){
	var startTime = new Date(new Date().getTime() - 1200000),
		endTime = new Date();
	aws.cloudWatch.getMetricStatistics('AWS/ELB', 'Latency', 60, startTime.toISOString(), endTime.toISOString(), {
		'Average': '1'}, 'Seconds', {
		'LoadBalancerName': 'production'
	}).then(function(data){
		var resp = data;
		console.log(resp);
		// console.log(data);
	});
});
