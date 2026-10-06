const assert = require('node:assert/strict');
const {
  categoryDefinitions,
  classifyMajorHit,
  combinedVisualRecentHits,
  gameCodeForCard,
  isVisualTopHitClassification,
  riftboundCollectorNumberInfo,
  setCodeForCard,
  setHintFromHistoryTitle,
  setKey
} = require('./OrderHitTracker');

assert.equal(gameCodeForCard({ game_code: 'ONEPIECE', card_number: 'UNL-229/219' }), 'RIFTBOUND');
assert.equal(gameCodeForCard({ card_number: 'OP16-065' }), 'ONEPIECE');
assert.equal(setCodeForCard({ card_number: 'OP16-065' }), 'OP-16');
assert.equal(setCodeForCard({ card_number: 'VEN-SP6/006' }), 'VEN');
assert.equal(setCodeForCard({ game_code: 'RIFTBOUND', set_code: 'SFD', card_number: 'UNL-229/219' }), 'UNL');
assert.equal(setKey('RIFTBOUND', 'UNL'), 'RIFTBOUND:UNL');
assert.deepEqual(setHintFromHistoryTitle('OP16 character break #4'), { gameCode: 'ONEPIECE', setCode: 'OP-16' });
assert.deepEqual(setHintFromHistoryTitle('OP-14 box'), { gameCode: 'ONEPIECE', setCode: 'OP-14' });
assert.deepEqual(setHintFromHistoryTitle('Unleashed Riftbound'), { gameCode: 'RIFTBOUND', setCode: 'UNL' });
assert.deepEqual(setHintFromHistoryTitle('Vendetta box'), { gameCode: 'RIFTBOUND', setCode: 'VEN' });

assert.deepEqual(classifyMajorHit({ game_code: 'RIFTBOUND', set_code: 'UNL', card_number: 'UNL-229/219', rarity: 'Rare' }), {
  gameCode: 'RIFTBOUND', gameName: 'Riftbound', setCode: 'UNL', setName: 'Unleashed', categoryKey: 'OVERNUMBERED', categoryLabel: 'Overnumbered',
  rarityLabel: 'Showcase', collectorTreatment: 'Overnumbered', collectorTreatmentLabel: 'Overnumbered', raritySource: 'OpenRift exact collector-number catalog'
});
assert.equal(classifyMajorHit({ game_code: 'RIFTBOUND', set_code: 'VEN', card_number: 'VEN-197*/166', variant: 'Signature' }).categoryKey, 'SIGNATURE');
assert.equal(classifyMajorHit({ game_code: 'RIFTBOUND', set_code: 'UNL', card_number: 'UNL-229-STAR', rarity: 'Rare' }).rarityLabel, 'Showcase');
assert.equal(classifyMajorHit({ game_code: 'RIFTBOUND', set_code: 'UNL', card_number: 'UNL-229/219', variant: 'Signature' }).categoryKey, 'OVERNUMBERED');
assert.equal(classifyMajorHit({ game_code: 'RIFTBOUND', set_code: 'UNL', card_number: 'UNL-118/219', variant: 'Signature', rarity: 'Epic' }).categoryKey, 'EPIC');
assert.equal(classifyMajorHit({ game_code: 'RIFTBOUND', set_code: 'UNL', card_number: 'UNL-118/219', rarity: 'Signature' }).rarityLabel, 'Epic');
assert.equal(riftboundCollectorNumberInfo('UNL-229-STAR').isSignature, true);
assert.equal(riftboundCollectorNumberInfo('UNL-229').isOvernumbered, true);
assert.equal(riftboundCollectorNumberInfo('UNL-128').isOvernumbered, false);
assert.equal(classifyMajorHit({ game_code: 'RIFTBOUND', set_code: 'VEN', card_number: 'VEN-SP6/006', rarity: 'Epic' }).categoryKey, 'SP');
assert.equal(classifyMajorHit({ game_code: 'RIFTBOUND', set_code: 'UNL', card_number: 'UNL-SP1/012', rarity: 'Showcase' }).categoryKey, 'SP');
assert.equal(classifyMajorHit({ game_code: 'RIFTBOUND', set_code: 'SFD', card_number: 'SFD-058a/221', variant: 'Epic' }).categoryKey, 'ALT_ART');
assert.equal(classifyMajorHit({ game_code: 'RIFTBOUND', set_code: 'SFD', card_number: 'SFD-118a/221', rarity: 'Showcase' }).rarityLabel, 'Epic');
assert.equal(classifyMajorHit({ game_code: 'RIFTBOUND', set_code: 'UNL', card_number: 'UNL-118/219', rarity: 'Epic' }).categoryKey, 'EPIC');
assert.equal(classifyMajorHit({ game_code: 'RIFTBOUND', set_code: 'UNL', card_number: 'UNL-082/219', rarity: 'Signature' }), null);
assert.equal(classifyMajorHit({ game_code: 'RIFTBOUND', set_code: 'UNL', card_number: 'UNL-999/219', rarity: 'Epic', variant: 'Signature' }), null);
assert.equal(classifyMajorHit({ game_code: 'ONEPIECE', set_code: 'OP-16', break_rarity: 'MANGA' }).categoryKey, 'MANGA');
assert.equal(classifyMajorHit({ game_code: 'ONEPIECE', set_code: 'OP-16', break_rarity: 'SEC AA' }).categoryKey, 'SEC_AA');
assert.equal(classifyMajorHit({ game_code: 'ONEPIECE', set_code: 'OP-16', break_rarity: 'GOLD DON!!' }).categoryKey, 'GOLD_DON');
assert.equal(classifyMajorHit({ game_code: 'ONEPIECE', set_code: 'OP-16', break_rarity: 'SR' }), null);
assert.equal(categoryDefinitions('RIFTBOUND')[0].label, 'Signature');
assert.equal(isVisualTopHitClassification(classifyMajorHit({ game_code: 'RIFTBOUND', set_code: 'UNL', card_number: 'UNL-229/219' })), true);
assert.equal(isVisualTopHitClassification(classifyMajorHit({ game_code: 'RIFTBOUND', set_code: 'VEN', card_number: 'VEN-SP6/006' })), true);
assert.equal(isVisualTopHitClassification(classifyMajorHit({ game_code: 'RIFTBOUND', set_code: 'SFD', card_number: 'SFD-058a/221' })), true);
assert.equal(isVisualTopHitClassification(classifyMajorHit({ game_code: 'RIFTBOUND', set_code: 'UNL', card_number: 'UNL-118/219' })), false);
assert.equal(isVisualTopHitClassification(classifyMajorHit({ game_code: 'RIFTBOUND', set_code: 'UNL', card_number: 'UNL-238/219' })), false);
assert.equal(isVisualTopHitClassification(classifyMajorHit({ game_code: 'ONEPIECE', set_code: 'OP-16', break_rarity: 'MANGA' })), false);
assert.equal(isVisualTopHitClassification(classifyMajorHit({ game_code: 'ONEPIECE', set_code: 'OP-16', break_rarity: 'SEC AA' })), true);
assert.deepEqual(combinedVisualRecentHits([
  { id: 4, game_code: 'RIFTBOUND', set_code: 'VEN', hit_category: 'SP' },
  { id: 3, game_code: 'RIFTBOUND', set_code: 'UNL', hit_category: 'SIGNATURE' },
  { id: 2, game_code: 'RIFTBOUND', set_code: 'SFD', hit_category: 'EPIC' },
  { id: 1, game_code: 'ONEPIECE', set_code: 'OP-16', hit_category: 'SP' }
]).map(hit => hit.id), [4, 3]);

console.log('Order hit tracker checks passed.');
