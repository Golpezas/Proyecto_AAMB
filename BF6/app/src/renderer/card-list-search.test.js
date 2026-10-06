const assert = require('node:assert/strict');
const search = require('./card-list-search');

assert.equal(search.normalizeReference('OGN-039/298'), '39');
assert.equal(search.normalizeReference('OGN-039a/298'), '39A');
assert.equal(search.normalizeReference('UNL-R05a'), 'R5A');
assert.equal(search.normalizeReference('VEN-SP4/006'), 'SP4');
assert.equal(search.normalizeReference('OGN-299*/298'), '299*');

assert.deepEqual(
  search.parseCardReferences('116, 156, 029, 077').map(entry => entry.key),
  ['116', '156', '29', '77']
);
assert.deepEqual(
  search.parseCardReferences('| 1 | OGN-116 | Thousand-Tailed Watcher | $13.19 |\n| 2 | OGN-039a | Kai’Sa | $59.26 |').map(entry => entry.key),
  ['116', '39A']
);
assert.deepEqual(
  search.parseCardReferences('1. OGN-039\n2. OGN-122\nOGN-039a/298').map(entry => entry.key),
  ['39', '122', '39A']
);
assert.deepEqual(search.parseCardReferences('OGN-299*').map(entry => entry.key), ['299*']);

const cards = [
  { id: 1, card_number: 'OGN-039/298', name: 'Kai’Sa, Survivor', image_url: 'base.jpg' },
  { id: 2, card_number: 'OGN-039a/298', name: 'Kai’Sa, Survivor', image_url: 'alt.jpg' },
  { id: 3, card_number: 'OGN-116/298', name: 'Thousand-Tailed Watcher', image_url: 'watcher.jpg' }
];
const result = search.matchCardReferences(search.parseCardReferences('039a, 116, 999'), cards);
assert.deepEqual(result.matches.map(card => card.id), [2, 3]);
assert.deepEqual(result.unmatched, ['999']);

console.log('Card list search tests passed.');
