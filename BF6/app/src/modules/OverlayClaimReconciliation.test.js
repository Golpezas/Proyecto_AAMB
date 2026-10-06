'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');
const { createOverlayClaimQueue } = require('./OverlayClaimQueue');

// Exercise the actual connector reconciliation function against a small live
// ledger. A later Whatnot price must leave the queued reveal's identity intact.
const source = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const start = source.indexOf('function reconcileConnectorAssignments(payload) {');
const end = source.indexOf('\nfunction clearLiveSaleAmounts()', start);
assert.ok(start >= 0 && end > start);

const database = new DatabaseSync(':memory:');
database.exec(`
  CREATE TABLE cards (id INTEGER PRIMARY KEY, name TEXT);
  CREATE TABLE active_break_board_cards (
    position INTEGER PRIMARY KEY, card_id INTEGER, status TEXT, buyer_name TEXT,
    called_at TEXT, message_marked INTEGER, tracker_marked INTEGER, sale_amount_cents INTEGER
  );
  INSERT INTO cards VALUES (42, 'Test card');
  INSERT INTO active_break_board_cards VALUES
    (1, 42, 'called', 'alice', '2026-09-25T20:00:00.000Z', 0, 0, 0);
`);
const claims = createOverlayClaimQueue();
const originalCalledAt = database.prepare('SELECT called_at FROM active_break_board_cards WHERE position = 1').get().called_at;
claims.enqueue({ position: 1, calledAt: originalCalledAt });

let broadcasts = 0;
const connectorStatus = { lastBlock: { source: 'Original live purchase' } };
const context = vm.createContext({
  database,
  connectorStatus,
  isLiveLedgerCurrent: () => true,
  leadingBlockNumber: value => Number(value),
  connectorValueFromPayload: item => item.position,
  comparableBuyerName: value => String(value || '').trim().replace(/^@/, '').toLowerCase(),
  saleAmountCentsFromPayload: item => Number(item.saleAmountCents || 0),
  normalizeSaleAmountCents: value => Math.max(0, Number(value || 0)),
  broadcastBreakBoardChange: () => { broadcasts += 1; }
});
vm.runInContext(source.slice(start, end), context);
const reconcile = vm.runInContext('reconcileConnectorAssignments', context);

const repriced = reconcile({ assignments: [{ position: 1, buyer: 'alice', saleAmountCents: 950 }] });
const updated = database.prepare('SELECT status, buyer_name, called_at, sale_amount_cents FROM active_break_board_cards WHERE position = 1').get();
assert.equal(repriced.priceUpdatedCount, 1);
assert.equal(repriced.reassignedCount, 0);
assert.equal(updated.called_at, claims.current().calledAt, 'The queued sale must still identify its ledger row');
assert.equal(updated.sale_amount_cents, 950);
assert.equal(connectorStatus.lastBlock.source, 'Original live purchase');
assert.equal(broadcasts, 1);

const unchanged = reconcile({ assignments: [{ position: 1, buyer: 'alice', saleAmountCents: 0 }] });
assert.equal(unchanged.priceUpdatedCount, 0);
assert.equal(broadcasts, 1);
assert.equal(database.prepare('SELECT called_at FROM active_break_board_cards WHERE position = 1').get().called_at, originalCalledAt);

const reassigned = reconcile({ assignments: [{ position: 1, buyer: 'bob', saleAmountCents: 950 }] });
assert.equal(reassigned.reassignedCount, 1);
assert.equal(database.prepare('SELECT status, buyer_name FROM active_break_board_cards WHERE position = 1').get().buyer_name, 'bob');
assert.equal(database.prepare('SELECT status FROM active_break_board_cards WHERE position = 1').get().status, 'called');

database.close();
console.log('Live popup reconciliation checks passed.');
