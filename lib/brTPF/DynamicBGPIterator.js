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

// Creates a new DynamicBGPIterator
function DynamicBGPIterator(parent, bgp, options) {
  // Empty patterns have no effect; return a pass-through iterator
  if (!bgp || !bgp.length)
    return new Iterator.passthrough(parent, options);
  // A singleton BGP can be solved by a triple pattern iterator
  if (bgp.length === 1)
    return new OriginalTriplePatternIterator(parent, bgp[0], options);
  // For length two or more, construct a DynamicBGPIterator
  if (!(this instanceof DynamicBGPIterator))
    return new DynamicBGPIterator(parent, bgp, options);
  MultiTransformIterator.call(this, parent, options);

  this._bgp = bgp;
  this._chunkSize = this._options.maxNumberOfMappings;
  this._client = this._options.fragmentsClient;
}
MultiTransformIterator.inherits(DynamicBGPIterator);

// Creates a pipeline with triples matching the binding of the iterator's BGP
DynamicBGPIterator.prototype._createTransformer = function (solMap, options) {
  if ( Array.isArray(solMap) )
  {
    if ( solMap.length == 1 )
      return this._createTransformerForSingleMapping(solMap[0], options);
    else
      return this._createTransformerForSetOfMappings(solMap, options);
  }
  else
  {
    var pipeline = this._createTransformerForSingleMapping(solMap, options);
    return new ArrayToElementsIterator(pipeline, options);
  }
}


DynamicBGPIterator.prototype._createTransformerForSingleMapping = function (solMap, options) {
  // Apply the context bindings to the BGP of this iterator
  var bgp = rdf.applyBindings(solMap, this._bgp);
  var chunkSize = this._chunkSize;

  // If the BGP has only one triple pattern, use that triple pattern to create the pipeline
  if (bgp.length === 1)
    return createPipeline( bgp.pop(), this._chunkSize );

  // Otherwise, we must first find the best triple pattern to start the pipeline
  var pipeline = new Iterator.PassthroughIterator(true);
  // Retrieve and inspect the triple patterns' metadata to decide which has least matches
  var bestIndex = 0, minMatches = Infinity, patternsChecked = 0;
  bgp.forEach(function (triplePattern, index) {
    var fragment = this._client.getFragmentByPattern(triplePattern); // no solution mappings in this case
    fragment.getProperty('metadata', function (metadata) {
      // We don't need more data from the fragment
      fragment.close();
      // If there are no matches, the entire BGP has no matches
      if (metadata.totalTriples === 0)
        return pipeline._end();
      // This triple pattern is the best if it has the lowest number of matches
      if (metadata.totalTriples < minMatches) {
        bestIndex = index;
        minMatches = metadata.totalTriples;
      }
      // After all patterns were checked, create the pipeline from the best pattern
      if (++patternsChecked === bgp.length) {
        pipeline.setSource( createPipeline(bgp.splice(bestIndex,1)[0], chunkSize) );
      }
    });
    // If the fragment errors, pretend it was empty
    fragment.on('error', function (error) {
      Logger.warning(error.message);
      if (!fragment.getProperty('metadata'))
        fragment.setProperty('metadata', { totalTriples: 0 });
    });
  }, this);
  return pipeline;

  // Creates the pipeline of iterators for the bound BGP,
  // starting with a FirstTriplePatternIterator for the triple pattern,
  // then a DynamicBGPIterator for the remainder of the BGP.
  function createPipeline( firstTP, chunkSize ) {
    // Create the iterator for the given first triple pattern
    var startIterator = Iterator.single(solMap);
    var pipeline = new FirstTriplePatternIterator(startIterator, firstTP, chunkSize, options);
    // If the BGP has more triple patterns, create a DynamicBGPIterator for it
    if ( bgp.length === 1 ) {
      pipeline = new ArrayInputTriplePatternIterator(pipeline, bgp.pop(), chunkSize, options);
    }
    else if ( bgp.length > 1 ) {
      var bgpCopy = bgp.slice(0);
      pipeline = new DynamicBGPIterator(pipeline, bgpCopy, options);
    }
    return pipeline;
  }

};

// Creates a pipeline with triples matching the binding of the iterator's BGP
DynamicBGPIterator.prototype._createTransformerForSetOfMappings = function (solMapSet, options) {
  var bgp = this._bgp.slice(0);
  var chunkSize = this._chunkSize;

  // We must first find the best triple pattern to start the sub-pipeline
  var pipeline = new Iterator.PassthroughIterator(true);
  // Retrieve and inspect the triple patterns' metadata to decide which has least matches
  var bestIndex = 0;
  var minMatches = Infinity;
  var index;
  for ( index = 0; index < bgp.length; index++ ) {
    var triplePattern = bgp[index];
    var fragment = this._client.getFragmentByPatternAndSolMaps(triplePattern,solMapSet);
    fragment.getProperty('metadata', function (metadata) {
      // We don't need more data from the fragment
      fragment.close();
      // This triple pattern is the best if it has the lowest number of matches
      if (metadata.totalTriples < minMatches) {
        bestIndex = index;
        minMatches = metadata.totalTriples;
      }
    });
    // If the fragment errors, pretend it was empty
    fragment.on('error', function (error) {
      Logger.warning(error.message);
console.log( "!!! ERROR (" + (!fragment.getProperty('metadata')) + "): " + error.message );
      if (!fragment.getProperty('metadata'))
        fragment.setProperty('metadata', { totalTriples: 0 });
    });

    // If there are no matches, the entire BGP has no matches
    if ( minMatches == 0 )
      break;
  }

  if ( minMatches == 0 )
{
//console.log( "EMPTY!" );
    return pipeline._end();
}

  // After all patterns were checked, create the pipeline from the best pattern
if ( bestIndex >= bgp.length ) {
	console.log( "! bestIndex: " + bestIndex );
	console.log( "! bgp.length: " + bgp.length );
	console.log( "! bgp[bestIndex]: " + bgp[bestIndex] );
	streexit;
}
  var bestTP = bgp.splice(bestIndex,1)[0];
if ( !bestTP ) {
	console.log( "bestIndex: " + bestIndex );
	console.log( "patternsChecked: " + patternsChecked );
	console.log( "bgp.length: " + bgp.length );
	stexit;
}
  pipeline.setSource( createPipeline(bestTP, chunkSize) );
  return pipeline;

  // Creates the pipeline of iterators for the BGP,
  // starting with an ArrayInputTriplePatternIterator for the first triple
  // pattern, then a DynamicBGPIterator for the remainder of the BGP.
  function createPipeline( firstTP, chunkSize ) {
    // Create the iterator for the given first triple pattern
    var startIterator = Iterator.single(solMapSet);
    var pipeline = new ArrayInputTriplePatternIterator(startIterator, firstTP, chunkSize, options);
    // If the BGP has more triple patterns, create a DynamicBGPIterator for it
    if ( bgp.length === 1 ) {
      pipeline = new ArrayInputTriplePatternIterator(pipeline, bgp.pop(), chunkSize, options);
    }
    else if ( bgp.length > 1 ) {
      var bgpCopy = bgp.slice(0);
      pipeline = new DynamicBGPIterator(pipeline, bgpCopy, options);
    }
    return pipeline;
  }

};

// Generates a textual representation of the iterator
DynamicBGPIterator.prototype.toString = function () {
  return '[' + this.constructor.name +
         ' {' + this._bgp.map(rdf.toQuickString).join(' ') + '}]' +
         '\n  <= ' + this.getSourceString();
};

module.exports = DynamicBGPIterator;
