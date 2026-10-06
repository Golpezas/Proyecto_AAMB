const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const message = require('./pull-history-buyer-message');

const text = message.build({
  batch: { game_code: 'RIFTBOUND', set_code: 'VEN', set_name: 'Vendetta', saved_box_name: 'Vendetta Box 1' },
  buyer: { buyer_name: '@riftcollector', paid_cents: 10000 },
  items: [
    { card_name: 'Plain Epic', rarity: 'Epic', collector_treatment: 'Standard', card_number: 'VEN-099/166', set_code: 'VEN', quantity: 1, position: 2 },
    { card_name: 'Lux, Crownguard', rarity: 'Signature', card_number: 'VEN-001/166', set_code: 'VEN', quantity: 1, position: 4 },
    { card_name: 'Body Rune', rarity: 'Rare', collector_treatment: 'Alternate Art', card_number: 'VEN-R04a', set_code: 'VEN', quantity: 2, position: 18 },
    { card_name: 'Chaos Rune', rarity: 'Promo', card_number: 'UNL-R05b', set_code: 'UNL', quantity: 1, position: 22 }
  ]
});

assert.equal(text, [
  '@riftcollector - You got 4 hits!',
  '',
  '💎 Lux, Crownguard - SIG - VEN-001/166',
  '✨✨ Body Rune - AA - VEN-R04a - ×2',
  '⭐ Chaos Rune - Promo - UNL-R05b',
  '',
  'I truly appreciate your support!',
  '',
  '⭐⭐⭐⭐⭐'
].join('\n'));
assert.equal(/congratulations/i.test(text), false);
assert.equal(/five-star review/i.test(text), false);
assert.equal(/Plain Epic/.test(text), false);
assert.match(text, /⭐⭐⭐⭐⭐$/);
assert.equal(message.breakLabel({ game_code: 'RIFTBOUND', set_code: 'MULTI' }), 'Riftbound');
assert.equal(message.breakLabel({ game_code: 'ONEPIECE', set_code: 'OP-16', set_name: '' }), 'OP-16');
assert.equal(message.cardReference({ set_code: 'VEN', card_number: '086/166' }), 'VEN 086/166');
assert.equal(message.cardReference({ set_code: 'VEN', card_number: 'VEN-086/166' }), 'VEN-086/166');
assert.equal(message.buyerHandle(' @@RiftCollector '), '@RiftCollector');
assert.equal(message.isPriorityBuyer({ paid_cents: 9999 }), false);
assert.equal(message.isPriorityBuyer({ paid_cents: 10000 }), false);
assert.equal(message.isPriorityBuyer({ paid_cents: 10001 }), true);
assert.equal(message.isPriorityBuyer({ paidCents: 12500 }), true);
assert.equal(message.isPriorityBuyer({ paid_cents: 2500 }, [{ collector_treatment: 'Alternate Art' }]), true);
assert.equal(message.isPriorityBuyer({ paid_cents: 2500 }, [{ rarity: 'Showcase' }]), true);
assert.equal(message.isPriorityBuyer({ paid_cents: 2500 }, [{ rarity: 'SP' }]), true);
assert.equal(message.isPriorityBuyer({ paid_cents: 2500 }, [{ rarity: 'Ultimate' }]), true);
assert.equal(message.isPriorityBuyer({ paid_cents: 2500 }, [{ collector_treatment: 'Overnumbered' }]), true);
assert.equal(message.isPriorityBuyer({ paid_cents: 2500 }, [{ collector_treatment: 'Signature' }]), true);
assert.equal(message.isPriorityBuyer({ paid_cents: 2500 }, [{ set_code: 'VEN', card_number: '178/166', rarity: 'Legend' }]), true);
assert.equal(message.isPriorityBuyer({ paid_cents: 2500 }, [{ set_code: 'VEN', card_number: 'VEN-SP1/006', rarity: 'Epic' }]), true);
assert.equal(message.isPriorityBuyer({ paid_cents: 2500 }, [{ rarity: 'Epic', collector_treatment: 'Standard' }]), false);
assert.deepEqual(message.topHitsOnly([
  { cardName: 'Epic stays recorded', rarity: 'Epic', collectorTreatment: 'Standard' },
  { cardName: 'Rare stays recorded', rarity: 'Rare' },
  { cardName: 'Alternate Art is copied', rarity: 'Rare', collectorTreatment: 'Alternate Art' },
  { cardName: 'Promo is copied', rarity: 'Promo' },
  { cardName: 'Showcase is copied', rarity: 'Showcase' },
  { cardName: 'SP is copied', cardNumber: 'VEN-SP1/006', rarity: 'Epic' },
  { cardName: 'Ultimate is copied', rarity: 'Ultimate' },
  { cardName: 'Overnumbered is copied', setCode: 'VEN', cardNumber: '178/166', rarity: 'Legend' },
  { cardName: 'Signature is copied', collectorTreatment: 'Signature' }
]).map(card => card.cardName), [
  'Alternate Art is copied',
  'Promo is copied',
  'Showcase is copied',
  'SP is copied',
  'Ultimate is copied',
  'Overnumbered is copied',
  'Signature is copied'
]);
assert.match(message.build({ batch: { set_name: 'Origins' }, items: [{ buyer_name: 'fallbackbuyer', card_name: 'Teemo', collector_treatment: 'Alternate Art', position: 1 }] }), /^@fallbackbuyer - You got 1 hit!/);
assert.equal(message.build({ batch: {}, items: [] }), '');
assert.equal(message.build({ batch: {}, items: [{ card_name: 'Epic', rarity: 'Epic', position: 1 }] }), '');

const rendererApp = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
assert.match(rendererApp, /function pullHistoryMessageScope[\s\S]*selectedIds\.size >= 2/, 'Combined Pool History messaging must require at least two manually selected boxes');
assert.match(rendererApp, /function copyAndOpenPullHistoryBuyerMessage[\s\S]*topHitsOnly\(items\)/, 'Pool History Copy + Message must filter saved cards to top hits');
assert.match(fs.readFileSync(path.join(__dirname, 'pull-history-buyer-message.js'), 'utf8'), /set\/card number reference only/, 'Buyer messages must stop after the set/card number reference');
assert.match(rendererApp, /Epic and lower stay saved but are not copied/, 'Pool History must explain that lower rarities remain saved');

console.log('Pull History buyer message tests passed.');
