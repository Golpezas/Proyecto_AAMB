const assert = require('node:assert/strict');
const { searchTerms } = require('./CatalogSearch');

assert.deepEqual(searchTerms('OP16 SP'), [
  { plain: '%OP16%', compact: '%OP16%' },
  { plain: '%SP%', compact: '%SP%' }
]);
assert.deepEqual(searchTerms(' OP-16 '), [{ plain: '%OP-16%', compact: '%OP16%' }]);
console.log('Catalog search normalization test passed.');
