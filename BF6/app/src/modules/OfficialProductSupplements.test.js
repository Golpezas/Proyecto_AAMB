const assert = require('node:assert/strict');
const { officialProductSupplements } = require('./OfficialProductSupplements');

const cards = officialProductSupplements();
assert.equal(cards.length, 4);
assert.equal(new Set(cards.map(card => card.official_id)).size, 4);
assert(cards.every(card => card.set_code === 'OP-16'));
assert(cards.every(card => card.card_type === 'DON!! CARD'));
assert(cards.every(card => ['name', 'rarity', 'color', 'card_type', 'life', 'cost', 'attribute', 'power', 'counter', 'block', 'traits', 'effect', 'image_url', 'detail_url', 'setName'].every(field => typeof card[field] === 'string')));
assert.equal(cards.filter(card => card.rarity === 'GOLD DON').length, 1);
assert.equal(cards.filter(card => card.image_url).length, 4);
assert.deepEqual(cards.map(card => card.image_url), [698313, 698314, 698316, 698315].map(id => `https://tcgplayer-cdn.tcgplayer.com/product/${id}_in_1000x1000.jpg`));
console.log('Official product supplements test passed.');
