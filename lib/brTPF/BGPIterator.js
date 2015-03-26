/*! @license ©2014 Ruben Verborgh - Multimedia Lab / iMinds / Ghent University */
/** A GraphPatternIterator builds bindings by reading matches for a basic graph pattern. */

var Iterator = require('../iterators/Iterator'),
    MultiTransformIterator = require('../iterators/MultiTransformIterator'),
    rdf = require('../util/RdfUtil'),
    _ = require('lodash');

var OriginalTriplePatternIterator = require('../triple-pattern-fragments/TriplePatternIterator');
var FirstTriplePatternIterator = require('./FirstTriplePatternIterator');
var ArrayInputTriplePatternIterator = require('./ArrayInputTriplePatternIterator');
var ArrayToElementsIterator = require('./ArrayToElementsIterator');

// Creates a new BGPIterator
function BGPIterator(parent, bgp, options) {
  // Empty patterns have no effect; return a pass-through iterator
  if (!bgp || !bgp.length)
    return new Iterator.passthrough(parent, options);
  // A singleton BGP can be solved by a triple pattern iterator
  if (bgp.length === 1)
    return new OriginalTriplePatternIterator(parent, bgp[0], options);
  // For length two or more, construct a BGPIterator
  if (!(this instanceof BGPIterator))
    return new BGPIterator(parent, bgp, options);
  MultiTransformIterator.call(this, parent, options);

  this._bgp = bgp;
  this._chunkSize = 30;
  this._client = this._options.fragmentsClient;
}
MultiTransformIterator.inherits(BGPIterator);

// Creates a pipeline with triples matching the binding of the iterator's BGP
BGPIterator.prototype._createTransformer = function (solMap, options) {
  // Apply the context bindings to the BGP of this iterator
  var bgp = rdf.applyBindings(solMap, this._bgp);

  // If the BGP has only one triple pattern, use that triple pattern to create the pipeline
  if (bgp.length === 1)
    return createPipeline(bgp.pop());

  // Otherwise, we must first find the best triple pattern to start the pipeline
  var pipeline = new Iterator.PassthroughIterator(true);
  // Retrieve and inspect the triple patterns' metadata to decide which has least matches
  var bestIndex = 0, minMatches = Infinity;
  bgp.forEach(function (triplePattern, index) {
    var fragment = this._client.getFragmentByPatternAndSolMaps(triplePattern,[]); // no solution mappings in this case
    fragment.getProperty('metadata', function (metadata) {
      // We don't need more data from the fragment
      fragment.close();
      // If there are no matches, the entire BGP has no matches
      if (metadata.totalTriples === 0)
        return pipeline._end();
      // This triple pattern is the best if it has the lowest number of matches
      if (metadata.totalTriples < minMatches)
        bestIndex = index, minMatches = metadata.totalTriples;
    });
  }, this);
  // After all patterns were checked, create the pipeline from the best pattern
  pipeline.setSource( createPipeline(bgp.splice(bestIndex,1)[0], this._chunkSize) );
  return pipeline;

  // Creates the pipeline of iterators for the bound BGP,
  // starting with a TriplePatternIterator for the triple pattern,
  // then a BGPIterator for the remainder of the BGP.
  function createPipeline( firstTP, chunkSize ) {
    // Create the iterator for the given first triple pattern
    var startIterator = Iterator.single(solMap);
    var pipeline = new FirstTriplePatternIterator(startIterator, firstTP, chunkSize, options);
    var varsCovered = {};
    if ( rdf.isVariable(firstTP.subject) )   varsCovered[firstTP.subject] = 1;
    if ( rdf.isVariable(firstTP.predicate) ) varsCovered[firstTP.predicate] = 1;
    if ( rdf.isVariable(firstTP.object) )    varsCovered[firstTP.object] = 1;
    // If the BGP has more triple patterns, create iterators for them and add them to the pipeline
    // (order them by minimizing the number of unbound variables)
    while ( bgp.length > 0 ) {
      var bestIndex = 0;
      var minNumOfVarsUnbound = computeNumOfVarsUnbound( bgp[bestIndex], varsCovered );
      for ( var i = 1; i < bgp.length; i++ ) {
        var numOfVarsUnbound = computeNumOfVarsUnbound( bgp[i], varsCovered );
        if ( numOfVarsUnbound < minNumOfVarsUnbound ) {
          bestIndex = i;
          minNumOfVarsUnbound = numOfVarsUnbound;
        }
      }
      var bestTP = bgp.splice(bestIndex,1)[0];
      if ( rdf.isVariable(bestTP.subject) )   varsCovered[bestTP.subject] = 1;
      if ( rdf.isVariable(bestTP.predicate) ) varsCovered[bestTP.predicate] = 1;
      if ( rdf.isVariable(bestTP.object) )    varsCovered[bestTP.object] = 1;
      pipeline = new ArrayInputTriplePatternIterator(pipeline, bestTP, chunkSize, options);
    }
    return new ArrayToElementsIterator(pipeline, options);
  }

  function computeNumOfVarsUnbound( tp, vars ) {
    var i = 0;
    if ( rdf.isVariable(tp.subject) && ! tp.subject in vars ) ++i;
    if ( rdf.isVariable(tp.predicate) && ! tp.predicate in vars ) ++i;
    if ( rdf.isVariable(tp.object) && ! tp.object in vars ) ++i;
    return i;
  }
};

// Generates a textual representation of the iterator
BGPIterator.prototype.toString = function () {
  return '[' + this.constructor.name +
         ' {' + this._bgp.map(rdf.toQuickString).join(' ') + '}]' +
         '\n  <= ' + this.getSourceString();
};

module.exports = BGPIterator;
