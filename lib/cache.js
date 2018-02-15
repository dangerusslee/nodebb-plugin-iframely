var CachemanMongo = require('cacheman-mongo');
var CacheMan = require("cacheman");
var nconf = module.parent.parent.require('nconf');

var Cache = function(ttl) {
    if (nconf.get('mongo')) {
        var mdb = require.main.require('./src/database/mongo');
        this.cache = new CachemanMongo({ client: mdb.client, collection: 'iframely' });
        this.ttl = ttl;
    }
    else {
        winston.log("You do not have mongo configured, using regular cacheman");
        this.cache = new CacheMan({ ttl: ttl });
    }
    this.get = function (key) {
        return this.cache.get(key);
    };
    
    this.set = function (key, val) {
        return this.cache.set(key, val, this.ttl);
    };
    
    this.has = function (key) {
        var val=this.cache.get(key);
        if (val) {
            return true;
        }
        else {
            return false;
        }
    };
    return this;
}

module.exports = Cache;