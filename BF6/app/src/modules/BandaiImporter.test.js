const assert = require('node:assert/strict');
const { extractCards, discoverSeriesIds, isCacheableImageUrl, looksLikeImage } = require('./BandaiImporter');

assert(looksLikeImage(Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0, 0, 0, 0, 0, 0, 0, 0])));
assert(looksLikeImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])));
assert(!looksLikeImage(Buffer.from('<html>not an image</html>')));

const officialPageFixture = `
  <html><body>
    <select><option value="?series=569116">OP-16</option><option value="?series=460101">OP-01</option></select>
    <article class="card">
      <img src="/images/placeholder.png" data-src="/images/cardlist/card/OP16-001.png?260715=" alt="Portgas.D.Ace" />
      OP16-001 | L | LEADER
      Portgas.D.Ace TEXT VIEW
      Life5
      Attribute Special
      Power5000
      Counter -
      Color Red
      Block icon 5
      Type Whitebeard Pirates
      Effect [Activate: Main] This is an official effect.
      Card Set(s) -THE TIME OF BATTLE- [OP-16]
    </article>
  </body></html>`;

const cards = extractCards(officialPageFixture, 'https://en.onepiece-cardgame.com/cardlist/?series=569116');
assert.equal(cards.length, 1);
assert.equal(cards[0].name, 'Portgas.D.Ace');
assert.equal(cards[0].card_number, 'OP16-001');
assert.equal(cards[0].rarity, 'L');
assert.equal(cards[0].card_type, 'LEADER');
assert.equal(cards[0].color, 'Red');
assert.equal(cards[0].power, '5000');
assert.equal(cards[0].image_url, 'https://en.onepiece-cardgame.com/images/cardlist/card/OP16-001.png?260715=');
assert.equal(cards[0].life, '5');
assert.equal(cards[0].attribute, 'Special');
assert.equal(cards[0].power, '5000');
assert.deepEqual(discoverSeriesIds(officialPageFixture, 'https://en.onepiece-cardgame.com/cardlist/?series=569116'), ['460101', '569116']);

const goldDonFixture = `
  <html><body>
    <article class="card">
      <img data-src="/images/cardlist/card/gold-don-card.png" alt="DON!! Card (Gold)" />
      DON!! CARD | - | DON!! CARD
      DON!! Card (Gold) TEXT VIEW
      Life -
      Attribute -
      Power -
      Counter -
      Color -
      Block icon X
      Type -
      Effect -
      Card Set(s) -ONE PIECE CARD THE BEST vol.2- [PRB-02]
    </article>
  </body></html>`;

const goldDonCards = extractCards(goldDonFixture, 'https://en.onepiece-cardgame.com/cardlist/?series=569302');
assert.equal(goldDonCards.length, 1);
assert.equal(goldDonCards[0].card_number, 'DON!! CARD');
assert.equal(goldDonCards[0].name, 'DON!! Card (Gold)');
assert.equal(goldDonCards[0].rarity, 'GOLD DON');
assert.equal(goldDonCards[0].card_type, 'DON!! CARD');

const shortDonFixture = `
  <html><body>
    <article class="card"><img data-src="/images/cardlist/card/don-card.png" alt="DON!! Card" />
      DON!! CARD | DON!! CARD
      DON!! Card TEXT VIEW
    </article>
  </body></html>`;

const shortDonCards = extractCards(shortDonFixture, 'https://en.onepiece-cardgame.com/cardlist/?series=569302');
assert.equal(shortDonCards.length, 1);
assert.equal(shortDonCards[0].name, 'DON!! Card');
assert.equal(shortDonCards[0].rarity, 'DON!! CARD');
assert.equal(shortDonCards[0].card_type, 'DON!! CARD');
assert.equal(isCacheableImageUrl('https://en.onepiece-cardgame.com/images/cardlist/card/OP16-001.png'), true);
assert.equal(isCacheableImageUrl('https://tcgplayer-cdn.tcgplayer.com/product/698313_in_1000x1000.jpg'), true);
assert.equal(isCacheableImageUrl('https://example.com/not-a-card.jpg'), false);
console.log('Bandai importer parser test passed.');
