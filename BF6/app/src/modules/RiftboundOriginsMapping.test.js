const assert = require('node:assert/strict');
const {
  ORIGINS_CHAMPIONS,
  ORIGINS_COLOR_SPOTS,
  cardBelongsToOriginsChampion,
  cardBelongsToOriginsSpot,
  isOriginsAaRune,
  isOriginsRareEpicDomainCard,
  originsChampionForCard,
  originsSpotFromCard,
  originsSpotLabel
} = require('./RiftboundOriginsMapping');

assert.equal(ORIGINS_CHAMPIONS.length, 12);
assert.equal(ORIGINS_COLOR_SPOTS.length, 6);
assert.equal(originsChampionForCard({ set_code: 'OGN', card_number: 'OGN-299*/298', name: 'Daughter of the Void' }), "Kai'Sa");
assert.equal(originsChampionForCard({ set_code: 'OGN', card_number: 'OGN-248/298', name: 'Icathian Rain' }), "Kai'Sa");
assert.equal(originsChampionForCard({ set_code: 'OGN', card_number: 'OGN-304/298', name: 'Blind Monk' }), 'Lee Sin');
assert.equal(cardBelongsToOriginsChampion({ set_code: 'OGN', card_number: 'OGN-039A/298', name: "Kai'Sa, Survivor" }, "Kai'Sa"), true);
assert.equal(cardBelongsToOriginsChampion({ set_code: 'OGN', card_number: 'OGN-040/298', name: 'Seal of Rage' }, "Kai'Sa"), false);

const fury = originsSpotFromCard({ set_code: 'OGN', name: 'Seal of Rage' });
assert.equal(fury.domain, 'Fury');
assert.equal(originsSpotLabel(fury), 'Seal of Rage + Fury Rune AA + Rare/Epic Fury Cards');
assert.equal(cardBelongsToOriginsSpot({ set_code: 'OGN', card_number: 'OGN-040/298', name: 'Seal of Rage', rarity: 'Epic' }, fury), true);
assert.equal(cardBelongsToOriginsSpot({ set_code: 'OGN', card_number: 'OGN-007/298', name: 'Fury Rune', rarity: 'Common' }, fury), false);
assert.equal(isOriginsAaRune({ set_code: 'OGN', card_number: 'OGN-007A/298', name: 'Fury Rune', rarity: 'Showcase' }, fury), true);
assert.equal(isOriginsAaRune({ set_code: 'OGN', card_number: 'OGN-007B/298', name: 'Fury Rune', rarity: 'Showcase' }, fury), false);
assert.equal(cardBelongsToOriginsSpot({ set_code: 'OGN', card_number: 'OGN-007A/298', name: 'Fury Rune', rarity: 'Showcase' }, fury), true);

// Common/Uncommon are excluded; Rare/Epic and their AA treatments stay in color.
assert.equal(isOriginsRareEpicDomainCard({ set_code: 'OGN', card_number: 'OGN-001/298', name: 'Common Fury Unit', rarity: 'Common' }, fury), false);
assert.equal(isOriginsRareEpicDomainCard({ set_code: 'OGN', card_number: 'OGN-015/298', name: 'Uncommon Fury Spell', rarity: 'Uncommon' }, fury), false);
assert.equal(isOriginsRareEpicDomainCard({ set_code: 'OGN', card_number: 'OGN-025/298', name: 'Rare Fury Unit', rarity: 'Rare' }, fury), true);
assert.equal(isOriginsRareEpicDomainCard({ set_code: 'OGN', card_number: 'OGN-036A/298', name: 'Vi, Something', rarity: 'Showcase' }, fury), true);
assert.equal(isOriginsRareEpicDomainCard({ set_code: 'OGN', card_number: 'OGN-037/298', name: 'Epic Fury Unit', rarity: 'Epic' }, fury), true);
// Featured champions are reserved to their champion spots even inside a domain.
assert.equal(isOriginsRareEpicDomainCard({ set_code: 'OGN', card_number: 'OGN-027/298', name: 'Darius, Trifarian', rarity: 'Rare' }, fury), false);
assert.equal(isOriginsRareEpicDomainCard({ set_code: 'OGN', card_number: 'OGN-039A/298', name: "Kai'Sa, Survivor", rarity: 'Showcase' }, fury), false);

const chaos = originsSpotFromCard({ set_code: 'OGN', name: 'Seal of Discord' });
assert.equal(chaos.domain, 'Chaos');
assert.equal(cardBelongsToOriginsSpot({ set_code: 'OGN', card_number: 'OGN-204/298', name: 'Seal of Discord', rarity: 'Epic' }, chaos), true);
assert.equal(cardBelongsToOriginsSpot({ set_code: 'OGN', card_number: 'OGN-189/298', name: 'Rare Chaos Unit', rarity: 'Rare' }, chaos), true);
assert.equal(cardBelongsToOriginsSpot({ set_code: 'OGN', card_number: 'OGN-148/298', name: 'Rare Body Unit', rarity: 'Rare' }, chaos), false);

console.log('Origins mapping test passed.');
