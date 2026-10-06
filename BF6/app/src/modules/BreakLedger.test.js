const assert = require('node:assert/strict');
const { leadingBlockNumber } = require('./BreakLedger');

assert.equal(leadingBlockNumber('17'), 17);
assert.equal(leadingBlockNumber('017. Sakazuki ★'), 17);
assert.equal(leadingBlockNumber('01. Portgas.D.Ace — OP-16 · OP16-001 · L'), 1);
assert.equal(leadingBlockNumber('  83 — Any display name ◆'), 83);
assert.equal(leadingBlockNumber('Sakazuki 17'), null);
assert.equal(leadingBlockNumber('0. Not a usable block'), null);
assert.equal(leadingBlockNumber(''), null);

console.log('Break ledger test passed.');
