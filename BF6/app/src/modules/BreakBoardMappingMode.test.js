const assert = require('node:assert/strict');
const {
  BREAK_BOARD_MAPPING_MODES,
  buildRiftboundSingleSpot,
  decorateRiftboundSinglesBoard,
  exactRiftboundSingleLabel,
  normalizeBreakBoardMappingMode
} = require('./BreakBoardMappingMode');

const card = {
  id: 42,
  position: 7,
  game_code: 'RIFTBOUND',
  name: 'Akali, Rogue Assassin',
  card_number: 'VEN-189/166',
  collector_treatment: 'Overnumbered',
  rarity: 'Rare'
};

assert.equal(normalizeBreakBoardMappingMode('singles'), BREAK_BOARD_MAPPING_MODES.SINGLES);
assert.equal(normalizeBreakBoardMappingMode('unknown'), BREAK_BOARD_MAPPING_MODES.MAPPED);
assert.equal(exactRiftboundSingleLabel(card), 'Akali, Rogue Assassin · VEN-189/166 · Overnumbered');

const decorated = decorateRiftboundSinglesBoard([card]);
assert.equal(decorated[0].riftbound_single, true);
assert.equal(decorated[0].break_spot_label, exactRiftboundSingleLabel(card));

const spot = buildRiftboundSingleSpot(card);
assert.equal(spot.family.length, 1);
assert.equal(spot.family[0].id, card.id);
assert.equal(spot.bundleGroups.length, 1);
assert.equal(spot.displayLabel, exactRiftboundSingleLabel(card));

console.log('Per-board exact Riftbound Singles mapping tests passed.');
