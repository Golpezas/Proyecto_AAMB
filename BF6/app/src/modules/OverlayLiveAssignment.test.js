const assert = require('node:assert/strict');
const { applyOverlayLiveAssignments } = require('./OverlayLiveAssignment');

const cards = [
  { id: 11, position: 1, block_status: 'ready', spot_bundle: { label: 'Baron', cards: [{ id: 11 }] } },
  { id: 12, position: 2, block_status: 'ready', spot_bundle: { label: 'Akali', cards: [{ id: 12 }] } }
];
const firstCard = cards[0];
const firstBundle = cards[0].spot_bundle;
assert.equal(applyOverlayLiveAssignments(cards, [
  { position: 1, card_id: 11, block_status: 'called', buyer_name: 'buyer', called_at: '2026-09-27T02:00:00.000Z', sale_amount_cents: 1200 },
  { position: 2, card_id: 12, block_status: 'ready', buyer_name: '', called_at: null, sale_amount_cents: 0 }
]), true);
assert.equal(cards[0], firstCard, 'The mapped card stays cached');
assert.equal(cards[0].spot_bundle, firstBundle, 'The mapped card family stays cached');
assert.equal(cards[0].buyer_name, 'buyer');
assert.equal(cards[0].block_status, 'called');

assert.equal(applyOverlayLiveAssignments(cards, [
  { position: 1, card_id: 99, block_status: 'ready' },
  { position: 2, card_id: 12, block_status: 'ready' }
]), false, 'A replacement board card must force a full mapping rebuild');
assert.equal(cards[0].block_status, 'called', 'A failed identity check must leave the cached mapping intact');
assert.equal(applyOverlayLiveAssignments(cards, [{ position: 1, card_id: 11 }]), false);

console.log('Overlay live assignment cache checks passed.');
