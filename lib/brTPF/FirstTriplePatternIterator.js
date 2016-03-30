/*! @license ©2014 Ruben Verborgh - Multimedia Lab / iMinds / Ghent University */
/** A FirstTriplePatternIterator builds bindings by reading matches for a triple pattern. */

var MultiTransformIterator = require('../iterators/MultiTransformIterator'),
    rdf = require('../util/RdfUtil'),
    Logger = require('../util/ExecutionLogger')('FirstTriplePatternIterator');

// Creates a new FirstTriplePatternIterator
function FirstTriplePatternIterator(parent, tp, chunkSize, options) {
  if (!(this instanceof FirstTriplePatternIterator))
    return new FirstTriplePatternIterator(parent, tp, chunkSize, options);
  MultiTransformIterator.call(this, parent, options);

  this._pattern = tp; // it needs to be called _pattern to be usable by the logger
  this._chunkSize = chunkSize;
  this._incompleteChunk = [];
  this._completeChunkCnt = 0;
  this._tripleFilter = rdf.tripleFilter(tp);
  this._client = this._options.fragmentsClient;
}
MultiTransformIterator.inherits(FirstTriplePatternIterator);

// Creates a fragment with triples that match the binding of the iterator's triple pattern
FirstTriplePatternIterator.prototype._createTransformer = function (solMap, options) {
  // Apply the bindings to the iterator's triple pattern
  var tp = rdf.applyBindings(solMap, this._pattern);
  // Retrieve the fragment that corresponds to the resulting pattern
  var fragment = this._client.getFragmentByPatternAndSolMaps(tp, null); // no solution mappings in this case!
  Logger.logFragment(this, fragment, solMap);
  fragment.on('error', function (error) { Logger.warning(error.message); });
  return fragment;
};

// Reads a binding from the given fragment
FirstTriplePatternIterator.prototype._readTransformer = function (fragment, fragmentBindings) {
  // Read until we fill up the current chunk of solution mappings
  var triple;
  while (triple = fragment.read()) {
    try {
      // Add the triple's bindings to the solution mapping used to retrieve the fragment
      var solMap = rdf.extendBindings(fragmentBindings, this._pattern, triple);
      // Add the resulting solution mapping to the current chunk
      this._incompleteChunk.push(solMap);
      // If the current chunk is complete now, return it
      if ( this._incompleteChunk.length == this._chunkSize ) {
        var completeChunk = this._incompleteChunk;
        this._incompleteChunk = [];
// console.log("== FirstTriplePatternIterator for (" + rdf.toQuickString(this._pattern) + ") is returning a complete chunk (" + ++this._completeChunkCnt + ") ==");
        this._client._overallNumberOfMatchingTriples += this._chunkSize
        return completeChunk;
      }
    }
    catch (bindingError) { /* the current triple either doesn't match the TP or is not compatible with the input sol.mapping */ }
  }
  // Not enough matching triples read from the fragment yet to fill up the current chunk
  return null;
};

FirstTriplePatternIterator.prototype._end = function () {
  // Return the incomplete chunk of collected sol.mappings if it is not empty
  if ( this._incompleteChunk.length > 0 ) {
    var returnChunk = this._incompleteChunk;
    this._incompleteChunk = [];
// console.log("== FirstTriplePatternIterator for (" + rdf.toQuickString(this._pattern) + ") is returning the last chunk (size: " + returnChunk.length + ") ==");
    this._client._overallNumberOfMatchingTriples += returnChunk.length
    this._push(returnChunk);
  }
// console.log("== FirstTriplePatternIterator for (" + rdf.toQuickString(this._pattern) + ") is exhausted ==");
  // Call superclass method
  MultiTransformIterator.prototype._end.call(this);
};

// Generates a textual representation of the iterator
FirstTriplePatternIterator.prototype.toString = function () {
  return '[' + this.constructor.name +
         ' {' + rdf.toQuickString(this._pattern) + ')}' +
         '\n  <= ' + this.getSourceString();
};

module.exports = FirstTriplePatternIterator;
