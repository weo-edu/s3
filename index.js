/**
 * Module dependencies.
 */

var Emitter = require('component-emitter');
var events = require('component-event');

/**
 * Expose `Upload`.
 */

module.exports = Upload;

/**
 * Validate global configuration.
 *
 * @api private
 */

function validateConfig(S3) {
  if (!S3.signature) throw new Error('S3.signature required');
  if (!S3.bucket) throw new Error('S3.bucket required');
  if (!S3.policy) throw new Error('S3.policy required');
  if (!S3.key) throw new Error('S3.key required');
  if (!S3.acl) throw new Error('S3.acl required');
}

/**
 * Initialize a new `Upload` file` and options.
 *
 * Options:
 *
 *   - `name` remote filename or `file.name`
 *   - `type` content-type or `file.type` / application/octet-stream
 *
 * Events:
 *
 *   - `error` an error occurred
 *   - `abort` upload was aborted
 *   - `progress` upload in progress (`e.percent` etc)
 *   - `end` upload is complete
 *
 * TODO: progress
 * TODO: add option for max parts
 * TODO: add option for opting-out
 *
 * @param {File} file
 * @param {Object} [options]
 * @api private
 */

function Upload(file, opts) {
  if (!(this instanceof Upload)) return new Upload(file, opts);
  opts = opts || {};
  if (!opts.protocol) opts.protocol = window.location.protocol;
  var S3 = opts.S3;
  var meta = opts.meta || {};
  
  validateConfig(S3);
  this.file = file;
  this.type = opts.type || file.type || 'application/octet-stream';
  this.name = opts.name || file.name;
  this.bucketUrl = opts.protocol + '//' + S3.bucket + '.s3.amazonaws.com';
  this.url = this.bucketUrl + '/' + this.name;
  this.signature = S3.signature;
  this.bucket = S3.bucket;
  this.policy = S3.policy;
  this.key = S3.key;
  this.acl = S3.acl;
  this.attachment = opts.attachment
  this.meta = Object.keys(meta).map(function(key) {
    return ['x-amz-meta-' + key, meta[key]]
  })
}

/**
 * Mixin emitter.
 */

Emitter(Upload.prototype);

/**
 * Upload the file to s3 and invoke `fn(err)` when complete.
 *
 * @param {Function} [fn]
 * @api public
 */

Upload.prototype.end = function(fn){
  var self = this;
  fn = fn || function(){};

  var xhr = this.xhr = new XMLHttpRequest;

  // TODO: component
  events.bind(xhr.upload, 'progress', function(e){
    e.percent = e.loaded / e.total * 100;
    self.emit('progress', e);
  });

  // TODO: component
  xhr.onreadystatechange = function(){
    if (4 != xhr.readyState) return;
    var t = xhr.status / 100 | 0;
    if (2 == t) return fn();
    var err = new Error(xhr.responseText);
    err.status = xhr.status;
    fn(err);
  };

  // form
  var form = new FormData;
  form.append('key', this.name);
  form.append('AWSAccessKeyId', this.key);
  form.append('acl', this.acl);
  form.append('policy', this.policy);
  form.append('signature', this.signature);
  form.append('Content-Type', this.type);
  form.append('Content-Length', this.file.length);
  if (this.attachment) {
    form.append('Content-Disposition', 'attachment; filename="' + this.file.name + '"');
  }
  form.append('file', this.file);
  
  this.meta.forEach(function(meta) {
    form.append(meta[0], meta[1])
  })

  xhr.open('POST', this.bucketUrl, true);
  xhr.send(form);
};

/**
 * Abort the XHR.
 *
 * @api public
 */

Upload.prototype.abort = function(){
  this.emit('abort');
  this.xhr.abort();
};
