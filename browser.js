/*! @license MIT ©2013-2016 Ruben Verborgh - Ghent University / iMinds */

// Make the ldf-client module available as a global browser object
window.ldf = require('./ldf-client');
// Expose the same N3 version as used in the client
window.N3 = require('n3'); 
