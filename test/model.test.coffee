fs = require 'fs'
assert = require 'assert'
aws = require 'plata'
model = require '../lib/model'
moment = require 'moment'
Graph = model.Graph
Metric = model.Metric

aws.connect JSON.parse(fs.readFileSync('./test/auth.json'))

describe "Metric", ()->
    it "should expand ec2:tagged dimensions", (done)->
        data =
            id: 'cpu'
            title: 'Prod Python App CPU'
            namespace: 'AWS/EC2'
            name: 'CPUUtilization'
            type: "Average"
            unit: "Percent"
            thing: "percent"
            dimensions:
                "ec2:tagged":
                    "Environment": "production"
                    "Service Name": "pythonapp"

        m = new Metric(data)
        assert m.dims[0].name == 'ec2:tagged'
        assert m.dims[0].isRemote
        assert m.dims[0].service == 'ec2'
        assert m.dims[0].method == 'tagged'

        m.dims[0].getValues().then (res)->
            assert Array.isArray(res)
            assert res.length > 1

            numValues = res.length

            m.loadAllSeriesData(300, moment().subtract('minutes', 300)._d, new Date()).then (res)->
                assert res.length == numValues
                done()

    it "should handle a simple metric", (done)->
        data =
            id: "rabbit-celery-queue"
            namespace: "SW/Rabbit"
            name: "CeleryQueue"
            type: "Average"
            unit: "Count"
            thing: "messages"

        m = new Metric(data)
        m.loadAllSeriesData(300, moment().subtract('minutes', 300)._d, new Date()).then (res)->
            assert res.length == 1
            assert res[0].name ==  'SW/Rabbit:CeleryQueue'
            assert res[0].data.length > 0
            done()
