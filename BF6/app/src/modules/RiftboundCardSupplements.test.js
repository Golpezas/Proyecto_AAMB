const assert = require('node:assert/strict');
const {
  BUNDLED_VENDETTA_SIGNATURE_FILES,
  OPENRIFT_CARD_IMAGE_IDS,
  VERIFIED_VENDETTA_SIGNATURE_IMAGES,
  VERIFIED_UNLEASHED_BOARD_THREE_ANCHORS,
  VERIFIED_VENDETTA_CHASE_CARDS,
  riftboundCardSupplements,
  stableSupplementId
} = require('./RiftboundCardSupplements');
const {
  VENDETTA_CHASE_SINGLES_SPOTS,
  collectorNumberKey,
  prepareVendettaChaseSinglesBoard
} = require('./RiftboundVendettaChaseSingles');
const {
  UNLEASHED_BOARD_THREE_SPOTS,
  collectorNumberKey: boardThreeCollectorNumberKey,
  prepareUnleashedBoardThree
} = require('./RiftboundUnleashedBoardThree');

const cards = riftboundCardSupplements();
assert.equal(cards.length, 131);
const spriteFountain = cards[0];
assert.equal(spriteFountain.name, 'Sprite Fountain');
assert.equal(spriteFountain.card_number, 'UNL-078/219');
assert.equal(spriteFountain.set_code, 'UNL');
assert.equal(spriteFountain.setName, 'Unleashed');
assert.equal(spriteFountain.rarity, 'Uncommon');
assert.equal(spriteFountain.color, 'Mind');
assert.equal(spriteFountain.card_type, 'Gear');
assert.equal(spriteFountain.variant, '');
assert.match(spriteFountain.image_url, /^https:\/\/openrift\.app\/media\/cards\/[0-9a-f]{2}\/[0-9a-f-]+-full\.webp$/);
assert.match(spriteFountain.detail_url, /^https:\/\/openrift\.app\/cards\//);
assert.equal(spriteFountain.image_path, '');
assert.match(spriteFountain.effect, /Sprite unit token/);
assert.equal(stableSupplementId('unl-078/219'), stableSupplementId('UNL-078/219'));

const spriteFountainFoil = cards[1];
assert.equal(spriteFountainFoil.name, 'Sprite Fountain');
assert.equal(spriteFountainFoil.card_number, 'UNL-078/219');
assert.equal(spriteFountainFoil.variant, 'Foil');
assert.equal(spriteFountainFoil.distinct_variant, true);
assert.notEqual(spriteFountainFoil.official_id, spriteFountain.official_id);
assert.equal(spriteFountainFoil.image_url, spriteFountain.image_url);

const signatures = cards.filter(card => card.set_code === 'VEN' && card.variant === 'Signature');
assert.equal(signatures.length, 9);
assert.deepEqual(signatures.map(card => card.card_number), [
  'VEN-189*/166', 'VEN-190*/166', 'VEN-191*/166',
  'VEN-192*/166', 'VEN-193*/166', 'VEN-194*/166',
  'VEN-195*/166', 'VEN-196*/166', 'VEN-197*/166'
]);
assert.ok(signatures.every(card => card.set_code === 'VEN' && card.rarity === 'Rare'));
assert.deepEqual(BUNDLED_VENDETTA_SIGNATURE_FILES, {});
assert.ok(signatures.every(card => card.image_url === VERIFIED_VENDETTA_SIGNATURE_IMAGES[card.card_number]));
assert.ok(signatures.every(card => /^https:\/\/openrift\.app\/media\/cards\//.test(card.image_url)));
assert.ok(signatures.every(card => card.image_path === ''));
assert.equal(
  VERIFIED_VENDETTA_SIGNATURE_IMAGES['VEN-191*/166'],
  `https://openrift.app/media/cards/b4/${OPENRIFT_CARD_IMAGE_IDS['VEN-191*/166']}-full.webp`
);
assert.equal(signatures.at(-1).traits, 'Kennen');
assert.equal(signatures.at(-1).name, 'Kennen, Heart of the Tempest');

assert.equal(VERIFIED_UNLEASHED_BOARD_THREE_ANCHORS.length, 23);
assert.ok(VERIFIED_UNLEASHED_BOARD_THREE_ANCHORS.every(card => card.fallbackOnly));
const boardThreeAnchors = cards.filter(card =>
  card.set_code === 'UNL' && VERIFIED_UNLEASHED_BOARD_THREE_ANCHORS.some(anchor => anchor.number === card.card_number)
);
assert.equal(boardThreeAnchors.length, 23);
assert.deepEqual(
  boardThreeAnchors.map(card => boardThreeCollectorNumberKey(card.card_number)),
  UNLEASHED_BOARD_THREE_SPOTS.map(spot => boardThreeCollectorNumberKey(spot.anchorNumber))
);
const preparedBoardThree = prepareUnleashedBoardThree(boardThreeAnchors.map((card, index) => ({
  ...card,
  id: index + 1
})));
assert.equal(preparedBoardThree.ready, true, JSON.stringify(preparedBoardThree));
assert.equal(preparedBoardThree.anchors.length, 23);

assert.equal(VERIFIED_VENDETTA_CHASE_CARDS.length, 97);
assert.ok(VERIFIED_VENDETTA_CHASE_CARDS.every(card => card.fallbackOnly));
const vendettaChaseCards = cards.filter(card => card.set_code === 'VEN');
assert.equal(vendettaChaseCards.length, 106);
assert.equal(new Set(vendettaChaseCards.map(card => collectorNumberKey(card.card_number))).size, 106);
assert.deepEqual(
  new Set(vendettaChaseCards.map(card => collectorNumberKey(card.card_number))),
  new Set(VENDETTA_CHASE_SINGLES_SPOTS.map(spot => collectorNumberKey(spot.collectorNumber)))
);
const preparedBoardTen = prepareVendettaChaseSinglesBoard(vendettaChaseCards.map((card, index) => ({
  ...card,
  id: index + 1
})));
assert.equal(preparedBoardTen.ready, true, JSON.stringify(preparedBoardTen));
assert.equal(preparedBoardTen.anchors.length, 106);

console.log('RiftboundCardSupplements tests passed');
