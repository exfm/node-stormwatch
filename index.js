#!/usr/bin/env node

"use strict";

var aws = require('plata'),
	sequence = require('sequence'),
	when = require('when'),
	request = require('superagent'),
	getConfig = require('junto'),
	express = require('express'),
	fs = require('fs'),
	nconf = require('nconf'),
	hbs = require('handlebars');

var app = express(),
	server = require('http').createServer(app),
	io = require('socket.io').listen(server);

nconf.file({'file': 'config.json'});

io.set('transports', ['xhr-polling']);

var	config,
	cloudData = {},
	defaultRange = 30,
	defaultInterval = 1,
	ELBMetrics = nconf.get('ELBMetrics'),
	EC2Metrics = nconf.get('EC2Metrics'),
	CustomMetrics = nconf.get('CustomMetrics'),
	Basic = nconf.get('Basic'),
	Detailed = nconf.get('Detailed'),
	BasicStats = nconf.get('BasicStats');

getConfig('development').then(function(c){
	config = c;
	aws.connect(config.aws);
});

app.use(express.bodyParser());
app.use("/static", express.static(__dirname + "/static"));

app.get('/', function(req, res){
	fs.readFile(__dirname + '/views/index.html.hbs', 'utf-8', function(err, data){
		var template = hbs.compile(data);
		res.send(template({
			'view': 'basic',
			'metric_list': Basic,
			'basic_li': 'active',
			'advanced_li': ''
		}));
	});
});

app.get('/detailed', function(req, res){
	fs.readFile(__dirname + '/views/index.html.hbs', 'utf-8', function(err, data){
		var template = hbs.compile(data);
		res.send(template({
			'view': 'detailed',
			'metric_list': Detailed,
			'basic_li': '',
			'detailed_li': 'active'
		}));
	});
});

app.get('/info', function(req, res){
	// this is a hook for bob
});

server.listen(3000);
console.log('Listening on port 3000');

io.sockets.on('connection', function(socket){
    socket.on('requestData', function(data){
		var rangeInMinutes = convertToMinutes(data.timeRange),
			interval = rangeInMinutes/30;
		getCloudWatchData(rangeInMinutes, interval, data.view).then(function(newData){
			socket.emit('newCloudWatchData', newData);
		});
		getBasicStatsData().then(function(newData){
			socket.emit('newBasicStatsData', newData);
		});
	});
});

function getCloudWatchData(timeRangeMinutes, interval, view){
	var p = when.defer(),
		startTime = new Date(new Date().getTime() - 1000*60*timeRangeMinutes),
		Metrics = splitMetricsForView(view);

	cloudData = [];

	sequence().then(function(next){
		aws.onConnected(next);
	}).then(function(next, instanceData){
		var	endTime = new Date();
		when.all(Metrics.map(function(cloudMetric){
			var d = when.defer(),
				statistic = {},
				dimensions = {};
			statistic[cloudMetric.metricType] = '1';
			aws.cloudWatch.getMetricStatistics(cloudMetric.namespace, cloudMetric.metricName,
				interval*60, startTime.toISOString(), endTime.toISOString(),
				statistic, cloudMetric.unit, cloudMetric.dimensions).then(function(data){
					var datapoints = formatData(data.getMetricStatisticsResponse.getMetricStatisticsResult),
						name = cloudMetric.namespace+' '+cloudMetric.metricName;
					cloudData.push({
						'namespace': cloudMetric.namespace,
						'metricName': cloudMetric.metricName,
						'datapoints': datapoints,
						'unitLabel': cloudMetric.unitLabel,
						'range': cloudMetric.range,
						'interval': interval,
						'timeRange': timeRangeMinutes,
						'metricType': cloudMetric.metricType
				});
				d.resolve();
			});
			return d.promise;
		})).then(next);
	}).then(function(next){
		p.resolve(cloudData);
	});
	return p.promise;
}

function getBasicStatsData(){
	var p = when.defer(),
		basicStatsData = {};
	when.all(BasicStats.map(function(stat){
		var d = when.defer();
		basicStatsData[stat.name] = {};
		request
			.get(stat.url)
			.end(function(res){
				Object.keys(stat.stats).map(function(key){
					var property = getProperty(res.body, stat.stats[key]);
					if (key === 'Start' || key === 'End') {
						if (property === -1) {
							return basicStatsData[stat.name][key] = 'null';
						}
						property = new Date(property);
						return basicStatsData[stat.name][key] =
							property.getMonth()+'/'+property.getDate()+'/'+property.getFullYear()+
							' '+property.getHours()+':'+property.getMinutes()+':'+property.getSeconds();
					}
					return basicStatsData[stat.name][key] = property;
				});

				d.resolve();
			});
		return d.promise;
	})).then(function(){
		p.resolve(basicStatsData);
	});
	return p.promise;
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
		});
	});
	console.log(formatted);
	return formatted;
}

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

function findInstanceIdsByNameTag(instances, nameTag) {
	var instanceIds = [],
		tags = [];
	instances.forEach(function(instance){
		tags = instance.instancesSet[0].tagSet;
		tags.forEach(function(tag){
			if (tag.key === 'Name' && tag.value.indexOf('App') !== -1) {
				instanceIds.push(instance.instancesSet[0].instanceId);
			}
		});
	});
	return instanceIds;
}

function getInstanceStatus(instances) {
	var instanceStatus = {},
		tags = [];
	instances.forEach(function(instance){
		tags = instance.instancesSet[0].tagSet;
		tags.forEach(function(tag){
			if (tag.key === 'Name' && tag.value.indexOf('App') !== -1) {
				instanceStatus[tag.value] = instance.instancesSet[0]
					.instanceState.name;
			}
		});
	});
	return instanceStatus;
}

function splitMetricsForView(view) {
	var metrics = [],
		combinedMetrics = ELBMetrics.concat(EC2Metrics).concat(CustomMetrics);
	if (view === 'basic') {
		combinedMetrics.forEach(function(m){
			if (Basic.indexOf(m.metricName) > -1) {
				metrics.push(m);
			}
		});
	}
	else if (view === 'detailed') {
		combinedMetrics.forEach(function(m){
			if (Detailed.indexOf(m.metricName) > -1) {
				metrics.push(m);
			}
		});
	}
	return metrics;
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
