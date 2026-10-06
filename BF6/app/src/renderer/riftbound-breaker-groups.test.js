const assert = require('node:assert/strict');
const { groupKey, priorityGroups, topOddsGroups } = require('./riftbound-breaker-groups');

assert.equal(groupKey({ collector_treatment: 'Signature', rarity: 'Epic' }), 'SIGNATURE');
assert.equal(groupKey({ collector_treatment: 'Overnumbered', rarity: 'Rare' }), 'OVERNUMBERED');
assert.equal(groupKey({ collector_treatment: 'Alternate Art', rarity: 'Common' }), 'ALT_ART');
assert.equal(groupKey({ rarity: 'Showcase' }), 'ALT_ART');
assert.equal(groupKey({ rarity: 'Ultimate' }), 'ULTIMATE');
assert.equal(groupKey({ rarity: 'Ultimate', collector_treatment: 'Overnumbered', riftbound_art_variant: 'Ultimate' }), 'ULTIMATE');
assert.equal(groupKey({ rarity: 'Ultimate', collector_treatment: 'Overnumbered', riftbound_art_variant: 'Overnumbered' }), 'OVERNUMBERED');
assert.equal(groupKey({ rarity: 'Epic' }), 'EPIC');
assert.equal(groupKey({ rarity: 'Rare' }), 'RARE');
assert.equal(groupKey({ rarity: 'Uncommon' }), 'UNCOMMON');
assert.equal(groupKey({ rarity: 'Common' }), 'COMMON');
assert.equal(groupKey({ rarity: 'Unknown' }), 'LEFTOVERS');
assert.equal(priorityGroups.at(-1).key, 'LEFTOVERS');
assert.deepEqual(topOddsGroups.map(group => group.key), ['SIGNATURE', 'OVERNUMBERED', 'ALT_ART', 'ULTIMATE', 'EPIC']);

console.log('Riftbound Breaker Center grouping tests passed.');
