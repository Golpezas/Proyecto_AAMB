'use strict';

const assert = require('node:assert/strict');
const {
  NAMED_PLAYABLE_SPOTS,
  ORIGINS_BOARD_EIGHT_SPOTS,
  cardBelongsToOriginsBoardEightSpot
} = require('./RiftboundOriginsBoardEight');

assert.equal(ORIGINS_BOARD_EIGHT_SPOTS.length, 24);
assert.equal(NAMED_PLAYABLE_SPOTS.length, 6);
assert.deepEqual(NAMED_PLAYABLE_SPOTS.map(spot => spot.label), [
  'Baited Hook',
  'Dazzling Aurora',
  'Unchecked Power + Sabotage',
  'Invert Timelines',
  'Thousand-Tailed Watcher + Falling Star',
  "Time Warp + Zhonya's Hourglass"
]);
assert.ok(!ORIGINS_BOARD_EIGHT_SPOTS.some(spot => spot.kind === 'all-runes'));
assert.match(ORIGINS_BOARD_EIGHT_SPOTS[23].label, /Order Rune AA.*Non-Champion/);

const uncheckedSpot = NAMED_PLAYABLE_SPOTS[2];
assert.equal(cardBelongsToOriginsBoardEightSpot({ set_code: 'OGN', card_number: 'OGN-123/298', name: 'Unchecked Power', rarity: 'Epic' }, uncheckedSpot), true);
assert.equal(cardBelongsToOriginsBoardEightSpot({ set_code: 'OGN', card_number: 'OGN-156/298', name: 'Sabotage', rarity: 'Rare' }, uncheckedSpot), true);
assert.equal(cardBelongsToOriginsBoardEightSpot({ set_code: 'OGN', card_number: 'OGN-029/298', name: 'Falling Star', rarity: 'Rare' }, uncheckedSpot), false);

const watcherSpot = NAMED_PLAYABLE_SPOTS[4];
assert.equal(cardBelongsToOriginsBoardEightSpot({ set_code: 'OGN', card_number: 'OGN-116/298', name: 'Thousand-Tailed Watcher', rarity: 'Rare' }, watcherSpot), true);
assert.equal(cardBelongsToOriginsBoardEightSpot({ set_code: 'OGN', card_number: 'OGN-029/298', name: 'Falling Star', rarity: 'Rare' }, watcherSpot), true);

const timeSpot = NAMED_PLAYABLE_SPOTS[5];
assert.equal(cardBelongsToOriginsBoardEightSpot({ set_code: 'OGN', card_number: 'OGN-122/298', name: 'Time Warp', rarity: 'Epic' }, timeSpot), true);
assert.equal(cardBelongsToOriginsBoardEightSpot({ set_code: 'OGN', card_number: 'OGN-077/298', name: "Zhonya's Hourglass", rarity: 'Rare' }, timeSpot), true);

console.log('Riftbound Origins Board 8 tests passed');

const { ORIGINS_COLOR_SPOTS } = require('./RiftboundOriginsMapping');
for (const mapping of ORIGINS_COLOR_SPOTS) {
  const rune = { set_code: 'OGN', name: mapping.rune, card_number: `OGN-${mapping.runeNumber}a`, variant: 'Alternate Art' };
  const owners = ORIGINS_BOARD_EIGHT_SPOTS.filter(spot => cardBelongsToOriginsBoardEightSpot(rune, spot));
  assert.equal(owners.length, 1, `${mapping.rune} must have exactly one owner`);
  assert.equal(owners[0].mapping.seal, mapping.seal);
  assert.equal(cardBelongsToOriginsBoardEightSpot({ ...rune, card_number: `OGN-${mapping.runeNumber}b` }, owners[0]), false, 'Promo runes stay excluded');
}
const fury = ORIGINS_BOARD_EIGHT_SPOTS[18];
assert.equal(cardBelongsToOriginsBoardEightSpot({set_code: 'OGN', name: 'Kai’Sa', card_number: 'OGN-247', rarity: 'Epic'}, fury), false);
assert.equal(cardBelongsToOriginsBoardEightSpot({set_code: 'OGN', name: 'Baited Hook', card_number: 'OGN-242', rarity: 'Epic'}, ORIGINS_BOARD_EIGHT_SPOTS[23]), false);
