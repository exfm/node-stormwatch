fs = require 'fs'
assert = require 'assert'
aws = require 'plata'
model = require '../lib/model'
Graph = model.Graph
Metric = model.Metric

aws.connect JSON.parse(fs.readFileSync('./test/auth.json'))

describe "Metric", ()->
    it "should", (done)->
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
            done()
