const assert = require('node:assert/strict');
const popupName = require('./riftbound-popup-name');

const riftboundCard = (name, overrides = {}) => ({
  game_code: 'RIFTBOUND',
  set_code: 'UNL',
  name,
  ...overrides
});

assert.equal(popupName.championName(riftboundCard('Jhin, Virtuoso')), 'Jhin');
assert.equal(popupName.championName(riftboundCard('Master Yi, Wuju Master')), 'Master Yi');
assert.equal(popupName.championName(riftboundCard('Kha’Zix, Voidreaver')), "Kha'Zix");
assert.equal(popupName.championName(riftboundCard('Poppy, Keeper of the Hammer')), 'Poppy');
assert.equal(popupName.championName(riftboundCard('Baron Nashor')), '');
assert.equal(popupName.championName(riftboundCard('Jhin, Virtuoso', { game_code: 'ONEPIECE' })), '');
assert.equal(popupName.championName(riftboundCard('Jhin, Virtuoso', { set_code: 'OGN' })), '');

assert.equal(
  popupName.mappedSpotName({ spot_bundle: { kind: 'vendetta-combination', label: 'Ambessa + Morgana' } }),
  'Ambessa + Morgana'
);
assert.equal(
  popupName.mappedSpotName({ spot_bundle: { kind: 'vendetta-color', label: 'Sona + Riven + Calm Rune' } }),
  'Sona + Riven + Calm Rune'
);
assert.equal(popupName.mappedSpotName({ spot_bundle: { kind: 'color', label: 'Not Vendetta' } }), '');
assert.equal(
  popupName.mappedSpotName({ spot_bundle: { kind: 'spiritforged-expanded-seal', label: 'Seal of Discord' } }),
  'Seal of Discord'
);
assert.equal(
  popupName.mappedSpotName({ spot_bundle: { kind: 'unleashed-expanded-champion-split', label: 'Jhin — SIG + Murderous Artist AA (022A) + Epic 089 + Rare 022' } }),
  'Jhin — SIG + Murderous Artist AA (022A) + Epic 089 + Rare 022'
);
assert.equal(popupName.bundleCaption({ kind: 'vendetta-combination' }), 'VENDETTA COMBINED SPOT');
assert.equal(popupName.bundleCaption({ kind: 'vendetta-color' }), 'VENDETTA SP + RUNE SPOT');
assert.equal(popupName.bundleCaption({ kind: 'vendetta-board-9-single-anchor' }), 'VENDETTA BOARD 9 SPOT');
assert.equal(popupName.bundleCaption({ kind: 'unleashed-expanded-champion-split' }), 'UNLEASHED BOARD 7 SPOT');
assert.equal(
  popupName.mappedSpotName({ spot_bundle: { kind: 'vendetta-board-9-single-anchor', label: '💎 Akali — SIG · AA · Epic · Rare' } }),
  '💎 Akali — SIG · AA · Epic · Rare'
);
assert.equal(popupName.bundleCaption({ kind: 'spiritforged-expanded-champion' }), 'SPIRITFORGED CHAMPION SPOT');
assert.equal(popupName.bundleCaption({ kind: 'spiritforged-expanded-fizz-premonition' }), 'FIZZ + PREMONITION SPOT');
assert.equal(popupName.bundleCaption({ kind: 'spiritforged-expanded-named-bundle' }), 'SPIRITFORGED COMBINED SPOT');
assert.equal(popupName.bundleCaption({ kind: 'spiritforged-expanded-named-single' }), 'SPIRITFORGED SOLO SPOT');
assert.equal(popupName.bundleCaption({ kind: 'spiritforged-expanded-seal' }), 'SPIRITFORGED SEAL SPOT');
assert.equal(popupName.bundleCaption({ kind: 'spiritforged-expanded-rune-color' }), 'RUNE + RARE/EPIC SPOT');
assert.equal(popupName.bundleCaption({ kind: 'spiritforged-expanded-linear' }), 'SPIRITFORGED BOARD 6 SPOT');
assert.equal(
  popupName.mappedSpotName({ spot_bundle: { kind: 'spiritforged-board-4-single-anchor', label: 'Diana + Morgana' } }),
  'Diana + Morgana'
);
assert.equal(popupName.bundleCaption({ kind: 'spiritforged-board-4-single-anchor' }), 'SPIRITFORGED BOARD 4 SPOT');
assert.equal(
  popupName.mappedSpotName({ spot_bundle: { kind: 'spiritforged-board-10-balanced-color', label: 'Fury Color' } }),
  'Fury Color'
);
assert.equal(popupName.bundleCaption({ kind: 'spiritforged-board-10-balanced-color' }), 'SPIRITFORGED PURE COLOR');

console.log('riftbound-popup-name tests passed');
