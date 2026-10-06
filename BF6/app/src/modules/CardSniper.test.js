const assert = require('node:assert/strict');
const { _test } = require('./CardSniper');

const exactRiftbound = new URL(_test.whatnotSearchUrl({
  game_code: 'RIFTBOUND',
  set_code: 'OGN',
  name: 'Viktor - Herald of the Arcane',
  card_number: 'OGN-019/221',
  rarity: 'Epic',
  variant: 'Foil'
}));

assert.equal(exactRiftbound.origin, 'https://www.whatnot.com');
assert.equal(exactRiftbound.pathname, '/search');
assert.equal(
  exactRiftbound.searchParams.get('q'),
  'Viktor - Herald of the Arcane OGN OGN-019/221 Epic Foil Riftbound'
);

const exactOnePiece = new URL(_test.whatnotSearchUrl({
  game_code: 'ONEPIECE',
  set_code: 'OP-16',
  name: 'Monkey.D.Luffy',
  card_number: 'OP16-118',
  rarity: 'SEC',
  variant: 'Alternate Art'
}));

assert.equal(
  exactOnePiece.searchParams.get('q'),
  'Monkey.D.Luffy OP-16 OP16-118 SEC Alternate Art One Piece'
);

console.log('Card Sniper Whatnot comparison tests passed.');
