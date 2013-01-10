assert = require('assert')
Store = require('../lib/store')
Index = Store.Index

describe "Index", ()->
    it "should allow declaring unique indexes", ()->
        index = new Index 'id', unique: true
        assert index.unique
        assert index.key == 'id'
        assert.deepEqual index.keyToGuids, {}

    it "should allow adding an item", ()->
        index = new Index 'title'
        item = id: 1, title: 'Monkey Town'
        index.add item.id, item.title
        assert.deepEqual index.keyToGuids, 'Monkey Town': [1]

    it "should throw an exception if adding a non-unique", ()->
        index = new Index 'title', unique: true
        index.add 1, 'Monkey Town'
        assert.deepEqual index.keyToGuids, 'Monkey Town': [1]
        assert.throws ()->
            index.add 2, 'Monkey Town'
        , Error

    it "should remove an item", ()->
        index = new Index 'title'
        index.add 1, 'Monkey Town'
        index.remove 1, 'Monkey Town'
        assert.deepEqual index.keyToGuids, {}

    it "should remove the correct guid", ()->
        index = new Index 'title'
        index.add 1, 'Monkey Town'
        index.add 2, 'Monkey Town'
        index.remove 1, 'Monkey Town'
        assert.deepEqual index.keyToGuids, 'Monkey Town': [2]

    it "should return empty array for find if key not indexed", ()->
        index = new Index 'title'
        assert.deepEqual index.find('Monkey Town'), []

    it "should return a list for find", ()->
        index = new Index 'title'
        index.add 1, 'Monkey Town'
        assert.deepEqual index.find('Monkey Town'), [1]

describe "Store", ()->
    it "should declare an index", ()->
        index = new Index 'id'
        store = new Store
        store.addIndex index
        assert.deepEqual store.indexKeys, ['id']
        assert.deepEqual store.indexes, 'id': index
        assert.deepEqual store.index('id'), index

    it "should store an item", ()->
        index = new Index 'id'
        store = new Store
        store.addIndex index
        store.insert id: 1, title: 'Monkey Town'
        assert.deepEqual store.items, {1: {'id': 1, 'title': 'Monkey Town'}}

    it "should work for a simple query", (done)->
        index = new Index 'title'
        store = new Store
        store.addIndex index
        item =
            id: 1
            title: 'Monkey Town'
        store.insert item

        store.query(title: 'Monkey Town').then((res)->
            assert.deepEqual res.items, [item]
            done()
        , done)
