/*! @license ©2014 Ruben Verborgh - Multimedia Lab / iMinds / Ghent University */
/* A brTPFClient fetches brTPFs through HTTP. */

var HttpClient = require('../util/HttpClient'),
    Iterator = require('../iterators/Iterator'),
    rdf = require('../util/RdfUtil'),
    Cache = require('lru-cache'),
    CompositeExtractor = require('../extractors/CompositeExtractor'),
    CountExtractor = require('../extractors/CountExtractor'),
    ControlsExtractor = require('../extractors/ControlsExtractor'),
    Logger = require('../util/ExecutionLogger')('FirstTriplePatternIterator'),
    _ = require('lodash');

// Prefer quad-based serialization formats (which allow a strict data/metadata separation),
// and prefer less verbose formats. Also, N3 support is only partial.
var DEFAULT_ACCEPT = 'application/trig;q=1.0,application/n-quads;q=0.7,' +
                     'text/turtle;q=0.6,application/n-triples;q=0.3,text/n3;q=0.2';
var parserTypes = [
  require('../triple-pattern-fragments/TrigFragmentIterator'),
  require('../triple-pattern-fragments/TurtleFragmentIterator'),
];

// Creates a new brTPFClient
function brTPFClient(startFragment, options) {
  if (!(this instanceof brTPFClient))
    return new brTPFClient(startFragment, options);

  this._numberOfTriplePatternsInQuery = 0;
  this._overallNumberOfMatchingTriples = 0;
  this._overallNumberOfTriplesReceived = 0;
  this._chunkSizeCounters = [];

  // Set HTTP and cache options
  options = _.defaults(options || {}, { contentType: DEFAULT_ACCEPT });
//   this._prefixes = options.prefixes ? options.prefixes : {};
this._prefixes = {};
  this._cache = new Cache({ max: 100 });
  this._httpClient = options.httpClient || new HttpClient(options);

  // Extract counts and triple pattern fragments controls by default
  this._metadataExtractor = options.metadataExtractor || new CompositeExtractor({
    metadata: [ new CountExtractor() ],
    controls: [ new ControlsExtractor() ],
  });

  if (startFragment) {
    // Fetch the start fragment if necessary
    if (typeof startFragment === 'string') {
      var startFragmentUrl = this._startFragmentUrl = startFragment;
      startFragment = new Fragment(this);
      startFragment.loadFromUrl(startFragmentUrl);
    }
    this._startFragment = startFragment;
    startFragment.setMaxListeners(100); // several error listeners might be attached temporarily
 startFragment.once('error', function (error) { startFragment.error = error; });
 startFragment.getProperty('controls', function () {
 startFragment.error = null;
 startFragment.removeAllListeners('error');
 });
  }
}

// Returns the brTPF for the given triple pattern and an empty set of solution mappings
brTPFClient.prototype.getFragmentByPattern = function (tp) {
  return this.getFragmentByPatternAndSolMaps( tp, null );
}

// Returns the bjTPF for the given triple pattern and set of solution mappings
brTPFClient.prototype.getFragmentByPatternAndSolMaps = function (tp, solMapSet) {
  // Canonicalize the input
  var usedPrefixes = {};

  var canonicalizedTP =
                 canonicalizeTP(tp);
//                  tp; // no canonicalization
  var canonicalizedSolMapSet =
                 canonicalizeAndReduceSolMapSet( solMapSet, tp, canonicalizedTP, this._prefixes, usedPrefixes );
//                  projectOutVariablesFromSolMapSet( solMapSet, tp ); // no canonicalization

  if ( canonicalizedSolMapSet != null && canonicalizedSolMapSet.length == 1 ) {
    canonicalizedTP = rdf.applyBindings(canonicalizedSolMapSet[0], canonicalizedTP);
    canonicalizedSolMapSet = null;
  }
  // Check whether the fragment was cached
  var cache = this._cache;
  var key = JSON.stringify(canonicalizedTP) + JSON.stringify(canonicalizedSolMapSet);
  if (cache.has(key))
    return cache.get(key).clone();
  // Create a dummy iterator until the fragment is loaded
  var fragment = new Fragment(this);

  // Record statistics
  var numberOfMappings;
  if ( canonicalizedSolMapSet == null || ! canonicalizedSolMapSet )
    numberOfMappings = 0;
  else
    numberOfMappings = canonicalizedSolMapSet.length;

  if ( this._chunkSizeCounters[numberOfMappings] === undefined )
    this._chunkSizeCounters[numberOfMappings] = 1;
  else
    this._chunkSizeCounters[numberOfMappings] = this._chunkSizeCounters[numberOfMappings] + 1;

  // Ensure the start fragment is loaded correctly
  var startFragment = this._startFragment;
  if (startFragment.error !== null) {
    if (startFragment.error)
      return setImmediate(startFragmentError), fragment;
    startFragment.once('error', startFragmentError);
  }
  function startFragmentError() { fragment.emit('error', startFragment.error); fragment._end(); }

  // Retrieve the fragment using the start fragment's controls
  startFragment.getProperty('controls', function (controls) {
    // Replace all blanks in the triple pattern by null
    if ( rdf.isBlank(canonicalizedTP.subject) )   canonicalizedTP.subject   = null;
    if ( rdf.isBlank(canonicalizedTP.predicate) ) canonicalizedTP.predicate = null;
    if ( rdf.isBlank(canonicalizedTP.object) )    canonicalizedTP.object    = null;

    // Only attempt to fetch the fragment if its components are valid
    if ( rdf.isLiteral(canonicalizedTP.subject) || rdf.isLiteral(canonicalizedTP.predicate) )
      return fragment.empty();

    // Load and cache the fragment
    var fragmentUrl = controls.getFragmentUrl(canonicalizedTP) + getFragmentUrlExtension(canonicalizedSolMapSet, usedPrefixes);
    fragment.loadFromUrl( fragmentUrl );
  });
  cache.set(key, fragment);
  return fragment.clone();


  function canonicalizeTP( tp ) {
    var s = ! rdf.isVariable(tp.subject) ? tp.subject
                                         : "?s";
    var p = ! rdf.isVariable(tp.predicate) ? tp.predicate
                                           : (tp.predicate==tp.subject) ? "?s"
                                                                        : "?p";
    var o = ! rdf.isVariable(tp.object) ? tp.object
                                        : (tp.object==tp.subject) ? "?s"
                                                                  : (tp.object==tp.predicate) ? "?p"
                                                                                              : "?o";
    return {
      subject: s, predicate: p, object: o
    };
  }

  function canonicalizeAndReduceSolMapSet( solMapSet, origTP, canonicalizedTP, allPrefixes, usedPrefixes ) {
    if ( solMapSet == null ) {
      return null;
    }
    if ( solMapSet.length == 0 ) {
      return null;
    }
    // Check whether the given original triple pattern is free of variables
    if ( ! rdf.isVariable(origTP.subject) && ! rdf.isVariable(origTP.predicate) && ! rdf.isVariable(origTP.object) ) {
      return null;
    }
    // Populate a map from the variables in origTP to the variables in canonicalizedTP
    var varMap = {};
    if ( rdf.isVariable(origTP.subject) )   varMap[origTP.subject]   = canonicalizedTP.subject;
    if ( rdf.isVariable(origTP.predicate) ) varMap[origTP.predicate] = canonicalizedTP.predicate;
    if ( rdf.isVariable(origTP.object) )    varMap[origTP.object]    = canonicalizedTP.object;
    // Use the map i) to rename variables bound in the solution mappings in solMapSet,
    // and ii) to remove bindings for other variables in these solution mappings.
    var solMapSetReduced = [];
    var solMapCanonicalizedAndReduced;
    solMapSet.forEach( function (solMap, index) {
      solMapCanonicalizedAndReduced = new Object();
      for ( origVar in varMap ) {
        if ( origVar in solMap ) //&& ! rdf.isLiteral(solMap[origVar]) )
          solMapCanonicalizedAndReduced[varMap[origVar]] = tryToUsePrefix( solMap[origVar], allPrefixes, usedPrefixes );
      }
      if ( Object.keys(solMapCanonicalizedAndReduced).length != 0 )
        solMapSetReduced.push(solMapCanonicalizedAndReduced);
    }, this);
    // Check whether the resulting set of solution mappings does not need to be canonicalized further
    if ( solMapSetReduced.length == 0 )
      return null;
    else if ( solMapSetReduced.length == 1 )
      return solMapSetReduced;
    // Sort the resulting set of solution mappings
    solMapSetReduced.sort( function(solMap1, solMap2){
      var c = compare( solMap1["?s"], solMap2["?s"] );
      if ( c == 0 ) {
        c = compare( solMap1["?p"], solMap2["?p"] );
        if ( c == 0 ) {
          c = compare( solMap1["?o"], solMap2["?o"] );
        }
      }
      return c;
    } );
    // Remove duplicates
    var solMapPrev = solMapSetReduced[0];
    var solMapSetDupFree = [ solMapPrev ];
    for ( var i = 1; i < solMapSetReduced.length; i++ ) {
      if ( JSON.stringify(solMapSetReduced[i]) !==  JSON.stringify(solMapPrev) ) {
        solMapPrev = solMapSetReduced[i];
        solMapSetDupFree.push(solMapPrev);
      }
    }
    return solMapSetDupFree;
// return removeDuplicatesFromSolMapSet( solMapSetReduced ); // unsorted
  }

  function compare( v1, v2 ) {
    if ( v1 == v2 )
      return 0;
    else if ( v1 < v2 )
      return -1;
    else
      return 1;
  }

  function tryToUsePrefix( iri, allPrefixes, usedPrefixes ) {
    for ( p in allPrefixes ) {
      var ns = allPrefixes[p];
      if ( iri.indexOf(ns) == 0 ) {
        usedPrefixes[p] = ns;
        return p + ":" + iri.substring(ns.length);
      }
    }
    return iri;
  }

  function projectOutVariablesFromSolMapSet( solMapSet, tp ) {
    if ( solMapSet == null ) {
      return null;
    }
    if ( solMapSet.length == 0 ) {
      return null;
    }

    // Obtain the projection variables from the given triple pattern.
    var vars = [];
    if ( rdf.isVariable(tp.subject) )   vars.push( tp.subject );
    if ( rdf.isVariable(tp.predicate) ) vars.push( tp.predicate );
    if ( rdf.isVariable(tp.object) )    vars.push( tp.object );

    // Return a single empty solution mapping if the triple pattern does not contain any variable.
    if ( vars.length == 0 ) {
      var emptySolMap = new Object();
      var singletonSolMapSet = [];
      singletonSolMapSet.push( emptySolMap );
      return singletonSolMapSet;
    }

    // Compute the projection.
    var solMapSetResult = [];
    var solMapTmp;
    solMapSet.forEach( function (solMap, index) {
      solMapTmp = new Object();
      vars.forEach( function (variable, index) {
        if ( variable in solMap  ) { //&& ! rdf.isLiteral(solMap[variable]) ) {
            solMapTmp[variable] = solMap[variable];
        }
      }, this);
      solMapSetResult.push( solMapTmp );
    }, this);

    return removeDuplicatesFromSolMapSet( solMapSetResult );
  }

  function removeDuplicatesFromSolMapSet( solMapSet ) {
    if ( solMapSet == null ) {
      return null;
    }
    if ( solMapSet.length == 0 ) {
      return null;
    }
    if ( solMapSet.length == 1 ) {
      return solMapSet;
    }

    var solMapSetResult = [];
    solMapSet.forEach( function (solMap, index) {
      if ( ! solMapIsContainedInSolMapSet(solMap,solMapSetResult) )
        solMapSetResult.push( solMap );
    }, this);

    return solMapSetResult;
  }

  function solMapIsContainedInSolMapSet( solMap, solMapSet ) {
    var found = false;
    solMapSet.forEach( function (containedSolMap, index) {
      if ( ! found && solMapsAreEqual(containedSolMap,solMap) )
        found = true;
    }, this);

    return found;
  }

  function solMapsAreEqual( solMap1, solMap2 ) {
    if ( Object.keys(solMap1).length != Object.keys(solMap2).length )
      return false;

    for ( variable in solMap1 ) {
      if ( ! (variable in solMap2) )
        return false;

      if ( solMap1[variable] != solMap2[variable] )
        return false;
	 }

    return true;
  }

  function getFragmentUrlExtension( solMapSet, prefixes ) {
    if ( solMapSet == null || solMapSet.length == 0 )
      return "";

    // Collect all variables mentioned in any of the given solution mappings
    var allVars = [];
    solMapSet.forEach( function (solMap, index) {
      allVars = allVars.concat( Object.keys(solMap) );
    }, this);
    // Remove duplicates
    allVars.sort();
    allVars = allVars.filter( function(variable, index) {
      return !index || variable != allVars[index-1];
    } );

    // Create entries for the values parameter for each of the given solution mappings
    var entries = [];
    solMapSet.forEach( function (solMap, index) {
      var bindings = [];
      for ( var i = 0; i < allVars.length; i++ ) {
        if ( solMap[allVars[i]] == null ) {
          bindings[i] = "UNDEF";
        } else if ( rdf.isLiteral(solMap[allVars[i]]) ) {
          var l = solMap[allVars[i]];
          var lValue = rdf.getLiteralValue(l);
          var lType  = rdf.getLiteralType(l);
          var lLang  = rdf.getLiteralLanguage(l);
          if ( lType != null )
            bindings[i] = '"' + lValue + '"^^<' + lType + '>';
          else if ( lLang != null )
            bindings[i] = '"' + lValue + '"@' + lLang;
          else
            bindings[i] = solMap[allVars[i]];
        } else {
          bindings[i] = "<" + solMap[allVars[i]] + ">";
        }
      }
      entries.push( "(" + bindings.join(" ") + ")" );
    }, this);

    var prefixParameters = [];
    for ( p in prefixes ) {
      prefixParameters.push( encodeURIComponent(p+":"+prefixes[p]) );
    }

    prefixParameters = (prefixParameters.length == 0) ? "" : "&prefix="+prefixParameters.join("&prefix=");
    var values = "(" + allVars.join(" ") + ") { " + entries.join(" ") + " }";
    return "&values=" + encodeURIComponent(values) + prefixParameters;
  }
};

// Creates a new Triple Pattern Fragment
function Fragment(fragmentsClient) {
  if (!(this instanceof Fragment))
    return new Fragment(fragmentsClient);
  Iterator.call(this);

  this._fragmentsClient = fragmentsClient;
}
Iterator.inherits(Fragment);

// Reads data from the current page of the fragment
Fragment.prototype._read = function () {
  if (this._fragmentPage) {
    var item = this._fragmentPage.read();
    if ( item ) {
//      Logger.warning( item );
      this._fragmentsClient._overallNumberOfTriplesReceived += 1;
      this._push(item);
    }
  }
};

// Loads the Triple Pattern Fragment located at the given URL
Fragment.prototype.loadFromUrl = function (pageUrl) {
  // Fetch a page of the fragment
  var self = this, fragmentsClient = this._fragmentsClient, fragmentPage,
      headers = { 'user-agent': 'Triple Pattern Fragments Client' };
  if (fragmentsClient._startFragmentUrl) headers.referer = fragmentsClient._startFragmentUrl;
  fragmentPage = fragmentsClient._httpClient.get(pageUrl, headers);
  fragmentPage.on('error', function (error) { self.emit('error', error); });

  fragmentPage.getProperty('statusCode', function (statusCode) {
    // Don't parse the page if its retrieval was unsuccessful
    if (statusCode !== 200) {
      fragmentPage.emit('error', new Error('Could not retrieve ' + pageUrl +
                                           ' (' + statusCode + ')'));
      return self._end();
    }

    // Obtain the page's data, metadata, and controls
    fragmentPage.getProperty('contentType', function (contentType) {
      // Parse the page using the appropriate parser for the content type
      var Parser = _.find(parserTypes, function (P) { return P.supportsContentType(contentType); });
      if (!Parser)
        return self.emit('error', new Error('No parser for ' + contentType + ' at ' + pageUrl));
      var parsedPage = self._fragmentPage = new Parser(fragmentPage, pageUrl);
      parsedPage.on('readable', function () { self.emit('readable'); });

      // Extract the page's metadata and controls
      var controls = {};
      fragmentsClient._metadataExtractor.extract({ fragmentUrl: pageUrl },
        parsedPage.metadataStream, function (error, metadata) {
          // Emit all new properties
          for (var type in metadata)
            if (!self.getProperty(type))
              self.setProperty(type, metadata[type]);
          // Store the controls so we can find the next page
          controls = metadata.controls || controls;
        });

      // Load the next page when this one is finished, using setImmediate to wait for controls
      parsedPage.on('end', function () { setImmediate(loadNextPage); });
      function loadNextPage() {
        // Find the next page's URL through hypermedia controls in the current page
        var nextPage;
        try { nextPage = controls && controls.nextPage; } catch (controlError) {}
        // Load the next page, or end if none was found
        nextPage ? self.loadFromUrl(nextPage) : self._end();
      }
      parsedPage.on('error', function (error) { fragmentPage.emit('error', error); });

      // A new page of data has been loaded, so this fragment is readable again
      self.emit('readable');
    });
  });
};

// Empties the fragment and returns it
Fragment.prototype.empty = function () {
  if (!this.getProperty('metadata'))
    this.setProperty('metadata', { totalTriples: 0 });
  return this._end(), this;
};

module.exports = brTPFClient;
