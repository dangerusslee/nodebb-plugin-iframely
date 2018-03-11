var CachemanMongo = require('cacheman-mongo');
var Cacheman = require("cacheman");
var CachemanMemory = require('cacheman-memory');
var nconf = module.parent.parent.require('nconf');
var winston = module.parent.parent.require('winston');

'use strict';

/**
 * Module dependencies.
 */


var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _lruCache = require('lru-cache');

var _lruCache2 = _interopRequireDefault(_lruCache);

/**
 * Module constants.
 */

var noop = function noop() {};

var MongoBackedMemoryStore = (function () {

  /**
   * MongoBackedMemoryStore constructor.
   *
   * @param {Object} options
   * @api public
   */

  function MongoBackedMemoryStore() {
    var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
   
    _classCallCheck(this, MongoBackedMemoryStore);

    
    this.ttl = options.ttl || 60;
    //, "maxAge": this.ttl
    this.memoryCache = new _lruCache({"max" : 5000});
    this.collection = options.collection || 'iframely';
    if (nconf.get('mongo')) {
      var mdb = require.main.require('./src/database/mongo');
      this.backend = new CachemanMongo({ client: mdb.client, collection: this.collection});
      winston.warn("Starting iframely cache with mongo");
  }
  }

  /**
   * Get an entry.
   *
   * @param {String} key
   * @param {Function} fn
   * @api public
   */

  _createClass(MongoBackedMemoryStore, [{
    key: 'get',
    value: function get(key) {
      var fn = arguments.length <= 1 || arguments[1] === undefined ? noop : arguments[1];

      var val = undefined,
          data = this.memoryCache.get(key), 
          classRef=this;
      if (data) {
         //handle memory retrieved data
        if (data.expire < Date.now()) {
          this.memoryCache.del(key);
          setImmediate(this.backend.del.bind(null, key));
          return setImmediate(fn);
        }
        try {
          val = JSON.parse(data.value);
        } catch (e) {
          return setImmediate(fn.bind(null, e));
        }
        winston.info("in get, got the value from memory for " + key); //-> {foo:"bar"}
        return setImmediate(fn.bind(null, null, val));
      }
      else {
        //We did not find the data in local memory
        if (this.backend) {
          //Did not have the value in memory, try the backend
            this.backend.get(key, function (error, value) {
              if (error) {
                winston.info("in get, error getting value from backend " + key); //-> {foo:"bar"}
                return setImmediate(fn.bind(null, error))
              }
              else if (value) {
                winston.info("in get, got the value from backend, setting local memory for " + key); //-> {foo:"bar"}
                setImmediate(classRef.setMemory.bind(classRef, key, value, this.ttl, noop)); 
                return setImmediate(fn.bind(null, null, value));
              }
              return fn(new Error('Could not find in memory or backend ' + key));
              //return setImmediate(fn.bind(null, null));
            }
          );
        }
        else {
          winston.info("in get, didn't get the value from memory and didn't have a backend for " + key); //-> {foo:"bar"}
          return setImmediate(fn);
        }
      } 
    }

    /**
     * Set an entry.
     *
     * @param {String} key
     * @param {Mixed} val
     * @param {Number} ttl
     * @param {Function} fn
     * @api public
     */

  }, {
    key: 'set',
    value: function set(key, val, ttl) {
      var fn = arguments.length <= 3 || arguments[3] === undefined ? noop : arguments[3];

      if ('function' === typeof ttl) {
        fn = ttl;
        ttl = null;
      }
      if (!ttl) {
        ttl=this.ttl;
      }
      if ('undefined' === typeof val) {
        return setImmediate(fn);
      }
      setImmediate(this.setMemory.bind(this, key, val, ttl, noop));
      if (this.backend) {
        setImmediate(this.backend.set.bind(this.backend, key, val, ttl));
      }

      return setImmediate(fn.bind(null, null, val));
    }

    /**
     * Delete an entry.
     *
     * @param {String} key
     * @param {Function} fn
     * @api public
     */

  }, 
  {
    key: 'setMemory',
    value: function setMemory(key, val, ttl, fn) {
      var data;
      if (!fn) fn=noop;
      if (!val) return fn();
      return setImmediate(this.memoryCache.set.bind(this.memoryCache, key, val));
    }
  },
  
  {
    key: 'del',
    value: function del(key) {
      var fn = arguments.length <= 1 || arguments[1] === undefined ? noop : arguments[1];
      setImmediate(this.memoryCache.del.bind(this.memoryCache, key));
      if (this.backend) {
        setImmediate(this.backend.del.bind(null, key));
      }
      return setImmediate(fn);
    }

    /**
     * Clear all entries for this bucket.
     *
     * @param {Function} fn
     * @api public
     */

  }, {
    key: 'clear',
    value: function clear() {
      var fn = arguments.length <= 0 || arguments[0] === undefined ? noop : arguments[0];
      this.backend.clear();
      this.memoryCache.reset();
      setImmediate(fn);
    }
  }, {
    key: 'has',
    value: function has(key, fn) {
      if (!fn) {
        fn=noop;
      }
      var classRef=this, 
      data=this.memoryCache.get(key);
      if (data) {
        if (data.expire < Date.now())
        {
          return setImmediate(fn.bind(null, null, false));
        }
        return setImmediate(fn.bind(null, null, true));
      }
      else if (this.backend) {
        this.backend.get(key,  function (error, data) {
          if (error) {
            return setImmediate(fn.bind(null, error));
          }
          if (data) {
            if (data.expire >= Date.now()) {
              setImmediate(classRef.setMemory.bind(classRef, key, data, classRef.ttl, noop));
              return setImmediate(fn.bind(null, null, true));
            }
            else {
              return setImmediate(fn.bind(null, null, false));
            }
          }
          else {
            //data is found and not expired
            return setImmediate(fn.bind(null, null, false));
          }
        });
      }
      else {
        //no data and backend not defined
        setImmediate(fn.bind(null, null, false));
      }
      
    }
  }
  ]);

  return MongoBackedMemoryStore;
})();

exports['default'] = MongoBackedMemoryStore;
module.exports = exports['default'];

