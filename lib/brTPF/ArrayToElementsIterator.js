/** An ArrayToElementsIterator consumes arrays of elements and returns the elements separately. */

var TransformIterator = require('../iterators/Iterator').TransformIterator;

// Creates a new ArrayToElementsIterator
function ArrayToElementsIterator(source, options) {
  if (!(this instanceof ArrayToElementsIterator))
    return new ArrayToElementsIterator(options);
  TransformIterator.call(this, source, options);
}
TransformIterator.inherits(ArrayToElementsIterator);

// Reads the items in the arrays read from the source
ArrayToElementsIterator.prototype._read = function () {
  var source = this._source;
  if (source) {
    var arr = source.read();
    if ( arr !== null ) {
// console.log("== ArrayToElementsIterator chunk of size " + arr.length + " read from the source iterator ==");
      arr.forEach( function (item, index) {
        this._push(item);
      }, this);
	 }
  }
};

module.exports = ArrayToElementsIterator;
