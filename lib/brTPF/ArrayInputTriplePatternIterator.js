/*! @license ©2014 Ruben Verborgh - Multimedia Lab / iMinds / Ghent University */
/** A ArrayInputTriplePatternIterator builds bindings by reading matches for a triple pattern. */

var MultiTransformIterator = require('../iterators/MultiTransformIterator'),
    rdf = require('../util/RdfUtil'),
    Logger = require('../util/ExecutionLogger')('ArrayInputTriplePatternIterator');

// Creates a new ArrayInputTriplePatternIterator
function ArrayInputTriplePatternIterator(parent, tp, chunkSize, options) {
  if (!(this instanceof ArrayInputTriplePatternIterator))
    return new ArrayInputTriplePatternIterator(parent, tp, chunkSize, options);
  MultiTransformIterator.call(this, parent, options);

  this._pattern = tp; // it needs to be called _pattern to be usable by the logger
  this._chunkSize = chunkSize;
  this._tmpChunk = [];
  this._tripleFilter = rdf.tripleFilter(tp);
  this._client = this._options.fragmentsClient;
}
MultiTransformIterator.inherits(ArrayInputTriplePatternIterator);

// Creates a fragment with triples that match the iterator's triple pattern
// and are compatible with at least on of the given solution mappings
ArrayInputTriplePatternIterator.prototype._createTransformer = function (solMapSet, options) {
  var fragment = this._client.getFragmentByPatternAndSolMaps(this._pattern, solMapSet);
  Logger.logFragment(this, fragment, solMapSet);
  fragment.on('error', function (error) { Logger.warning(error.message); });
  return fragment;
};

// Reads from the given fragment until we have a complete chunk of solution mappings
ArrayInputTriplePatternIterator.prototype._readTransformer = function (fragment, fragmentBindings) {
  // If the current chunk is over size (which might happen by a previous read
  // from the fragment), extract a properly sized chunk and return that
  if ( this._tmpChunk.length >= this._chunkSize )
    return this._extractChunk();
  // Read until we filled up the current chunk
  var triple;
  while (triple = fragment.read()) {
    // Join the triple's bindings with any compatible solution mapping from
    // the set of solution mappings used to retrieve the fragment, and
    // add the resulting (joined) solution mappings to the current chunk
    fragmentBindings.forEach( function (solMap, index) {
      try {
        this._tmpChunk.push( rdf.extendBindings(solMap, this._pattern, triple) );
      }
      catch (bindingError) { /* bindings weren't compatible */ }
    }, this);
    // If the current chunk is filled sufficiently, extract a properly sized chunk and return that
    if ( this._tmpChunk.length >= this._chunkSize )
      return this._extractChunk();
  }
  // Not enough matching triples read from the fragment yet to fill up the current chunk
  return null;
};

// Extracts a properly sized chunk from the current chunk
// (assumes that the current chunk is over size)
ArrayInputTriplePatternIterator.prototype._extractChunk = function () {
  var completeChunk = this._tmpChunk.slice( 0, this._chunkSize );
  this._tmpChunk = this._tmpChunk.slice( this._chunkSize );
// console.log("== ArrayInputTriplePatternIterator for (" + rdf.toQuickString(this._pattern) + ") is extracting a chunk of size " + completeChunk.length + " (the remaining chunk has a size of " + this._tmpChunk.length + ") ==");
  this._client._overallNumberOfMatchingTriples += this._chunkSize
  return completeChunk;
};

var cnt = 0;

ArrayInputTriplePatternIterator.prototype._end = function () {
  // Return the incomplete chunk of collected sol.mappings if it is not empty
  if ( this._tmpChunk.length > 0 ) {
    var returnChunk = this._tmpChunk;
    this._tmpChunk = [];
// console.log("== ArrayInputTriplePatternIterator for (" + rdf.toQuickString(this._pattern) + ") is returning the last chunk (size: " + returnChunk.length + ") ==");
    this._client._overallNumberOfMatchingTriples += returnChunk.length
    this._push(returnChunk);
  }
// console.log("== ArrayInputTriplePatternIterator for (" + rdf.toQuickString(this._pattern) + ") is exhausted (" + ++cnt + ") ==");
  // Call superclass method
  MultiTransformIterator.prototype._end.call(this);
};

// Generates a textual representation of the iterator
ArrayInputTriplePatternIterator.prototype.toString = function () {
  return '[' + this.constructor.name +
         ' {' + rdf.toQuickString(this._pattern) + ')}' +
         '\n  <= ' + this.getSourceString();
};

module.exports = ArrayInputTriplePatternIterator;
