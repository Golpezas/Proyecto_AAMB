const assert = require('node:assert/strict');
const { riftboundRuneSupplements, stableRuneId } = require('./RiftboundRuneSupplements');

const cards = riftboundRuneSupplements();
assert.equal(cards.length, 18);
assert.deepEqual(cards.map(card => card.card_number), [
  'SFD-R01a', 'SFD-R02a', 'SFD-R03a', 'SFD-R04a', 'SFD-R05a', 'SFD-R06a',
  'UNL-R01a', 'UNL-R02a', 'UNL-R03a', 'UNL-R04a', 'UNL-R05a', 'UNL-R06a',
  'UNL-R01b', 'UNL-R02b', 'UNL-R03b', 'UNL-R04b', 'UNL-R05b', 'UNL-R06b'
]);
assert.equal(new Set(cards.map(card => card.official_id)).size, 18);
assert.equal(stableRuneId('unl-r01a'), stableRuneId('UNL-R01a'));
for (const card of cards) {
  assert.ok(['SFD', 'UNL'].includes(card.set_code));
  assert.equal(card.variant, 'Alternate Art');
  assert.equal(card.card_type, 'Rune');
  assert.match(card.image_url, /^https:\/\/openrift\.app\/media\/cards\/[0-9a-f]{2}\/[0-9a-f-]+-full\.webp$/);
  assert.match(card.detail_url, /^https:\/\/openrift\.app\/cards\//);
}

const showcaseRunes = cards.filter(card => /a$/i.test(card.card_number));
assert.equal(showcaseRunes.length, 12);
for (const card of showcaseRunes) {
  assert.equal(card.rarity, 'Showcase');
  assert.equal(card.source_rarity, 'Showcase');
  assert.equal(JSON.parse(card.raw_details).rarity, 'Showcase');
}

const spiritforgedRunes = cards.filter(card => card.set_code === 'SFD');
assert.equal(spiritforgedRunes.length, 6);
assert.equal(spiritforgedRunes.every(card => card.setName === 'Spiritforged'), true);
assert.equal(spiritforgedRunes.every(card => card.variant_source === 'Spiritforged showcase'), true);

const promoRunes = cards.filter(card => /b$/i.test(card.card_number));
assert.equal(promoRunes.length, 6);
for (const card of promoRunes) {
  assert.equal(card.rarity, 'Promo');
  assert.equal(card.source_rarity, 'Promo');
  assert.equal(card.variant_source, 'Nexus Night promo');
  assert.match(card.product_name, /Nexus Night Promo/);
  const details = JSON.parse(card.raw_details);
  assert.equal(details.rarity, 'Promo');
  assert.equal(details.treatment, 'Alternate Art');
  assert.equal(details.finish, 'Foil');
}

console.log('RiftboundRuneSupplements tests passed');
