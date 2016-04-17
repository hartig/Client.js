/*! @license ©2013 Ruben Verborgh - Multimedia Lab / iMinds / Ghent University */
/** Browser replacement for the request module using jQuery. */

var EventEmitter = require('events').EventEmitter,
    SingleIterator = require('../../lib/iterators/Iterator').SingleIterator;

require('setimmediate');

// Creates an HTTP request with the given settings
function createRequest(settings) {
  var request = new EventEmitter();

  // Delegate the request to jQuery's AJAX module
  var jqXHR = jQuery.ajax({
    url: settings.url,
    timeout: settings.timeout,
    type: settings.method,
    headers: { accept: settings.headers && settings.headers.accept || '*/*' },
  })
  // Emit the result as a readable response iterator
  .always(function () {
    if (jqXHR.failure) return;
    var response = new SingleIterator(jqXHR.responseText || '');
    response.statusCode = jqXHR.status;
    response.headers = { 'content-type': jqXHR.getResponseHeader('content-type') };
    request.emit('response', response);
  });

  return request;
}

module.exports = createRequest;
