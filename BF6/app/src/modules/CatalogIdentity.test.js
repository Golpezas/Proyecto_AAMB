const assert = require('node:assert/strict');
const { canonicalImageUrl, officialCardIdentity } = require('./CatalogIdentity');

assert.equal(
  canonicalImageUrl('https://en.onepiece-cardgame.com/images/cardlist/card/OP16-001.png?260715='),
  'en.onepiece-cardgame.com/images/cardlist/card/op16-001.png'
);
assert.equal(
  canonicalImageUrl('https://en.onepiece-cardgame.com/images/cardlist/card/OP16-001.png?new-cache=1'),
  'en.onepiece-cardgame.com/images/cardlist/card/op16-001.png'
);

const firstImport = officialCardIdentity({
  cardNumber: 'OP16-001', rarity: 'L', cardType: 'LEADER', name: 'Portgas.D.Ace',
  imageUrl: 'https://en.onepiece-cardgame.com/images/cardlist/card/OP16-001.png?260715='
});
const rescan = officialCardIdentity({
  cardNumber: 'OP16-001', rarity: 'L', cardType: 'LEADER', name: 'Portgas.D.Ace',
  imageUrl: 'https://en.onepiece-cardgame.com/images/cardlist/card/OP16-001.png?next-cache=1'
});
const alternateArt = officialCardIdentity({
  cardNumber: 'OP16-001', rarity: 'L', cardType: 'LEADER', name: 'Portgas.D.Ace',
  imageUrl: 'https://en.onepiece-cardgame.com/images/cardlist/card/OP16-001_parallel.png?260715='
});

assert.equal(firstImport, rescan);
assert.notEqual(firstImport, alternateArt);
console.log('Catalog identity test passed.');
