var CachemanMongo = require('cacheman-mongo');
var Cacheman = require("cacheman");
var CachemanMemory = require('cacheman-memory');
var nconf = module.parent.parent.require('nconf');
var winston = module.parent.parent.require('winston');

'use strict';

/**
 * Module dependencies.
 */

Object.defineProperty(exports, '__esModule', {
  value: true
});

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

    this.client = (0, _lruCache2['default'])(options.count || 5000);
    this.ttl = options.ttl || 60;
    if (nconf.get('mongo')) {
      var mdb = require.main.require('./src/database/mongo');
      this.backend = new CachemanMongo({ client: mdb.client, collection: 'iframely' });
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
          data = this.client.get(key), 
          classRef=this;
      if (!data && this.backend) {
          this.backend.get(key, function (error, value) {

            if (error) throw error;
            classRef.setMemory(key, value, this.ttl, noop);
            console.log("in get, got the value from backend, setting local memory for " + key); //-> {foo:"bar"}
            setImmediate(fn.bind(null, null, value));
          }
        );
      }
      else if (!data) return fn(null, data);
      else if (data) {
        //handle memory retrieved data
        if (data.expire < Date.now()) {
          this.client.del(key);
          return setImmediate(fn);
        }
        try {
          val = JSON.parse(data.value);
        } catch (e) {
          return setImmediate(fn.bind(null, e));
        }
        setImmediate(fn.bind(null, null, val));
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

      var data = undefined;
      if ('function' === typeof ttl) {
        fn = ttl;
        ttl = null;
      }
      if (!ttl) {
        ttl=this.ttl;
      }
      if ('undefined' === typeof val) return fn();
      this.setMemory(key, val, ttl, fn);
      
      if (this.backend) {
        this.backend.set(key, val, ttl);
      }

      setImmediate(fn.bind(null, null, val));
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
      var data = undefined;

      if ('undefined' === typeof val) return fn();
      try {
        data = {
          value: JSON.stringify(val),
          expire: Date.now() + (ttl || 60) * 1000
        };
      } catch (e) {
        return setImmediate(fn.bind(null, e));
      }

      this.client.set(key, data);
    }
  },
  
  {
    key: 'del',
    value: function del(key) {
      var fn = arguments.length <= 1 || arguments[1] === undefined ? noop : arguments[1];

      this.set(key, null, -1, fn);
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

      this.client.reset();
      setImmediate(fn);
    }
  }, {
    key: 'has',
    value: function has(key, fn) {
      if (!fn) {
        fn=noop;
      }
      if (this.client.has(key)) {
        setImmediate(fn.bind(null, null, true));
      }
      else if (this.backend) {
        this.backend.get(key,  function (error, value) {
          if (error) throw error;
          if (value){
            this.client.setMemory(key, value, this.ttl, noop);
          }
          setImmediate(fn.bind(null, null, true));
          }
        );
      }
      setImmediate(fn.bind(null, null, true));
    }
  }
  ]);

  return MongoBackedMemoryStore;
})();

exports['default'] = MongoBackedMemoryStore;
module.exports = exports['default'];

