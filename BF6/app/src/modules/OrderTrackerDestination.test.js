const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { ensureBreakOrderHistorySchema } = require('./BreakOrderHistory');
const { ensurePullHistorySchema } = require('./PullHistory');
const { ensureBoxTrackerSchema } = require('./BoxTracker');
const { syncBoxTrackerFromHistory } = require('./AutomaticBoxTracker');
const { createOpenCaseTracker } = require('./LiveCaseTracker');
const { changeOrderTrackerDestination } = require('./OrderTrackerDestination');

const database = new DatabaseSync(':memory:');
database.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE catalog_sets (
    game_code TEXT NOT NULL, game_name TEXT NOT NULL, set_number INTEGER NOT NULL,
    set_code TEXT NOT NULL, set_name TEXT NOT NULL, product_name TEXT NOT NULL,
    box_count INTEGER NOT NULL DEFAULT 6, base_card_count INTEGER,
    PRIMARY KEY(game_code, set_code)
  );
  INSERT INTO catalog_sets (game_code, game_name, set_number, set_code, set_name, product_name)
  VALUES ('RIFTBOUND', 'Riftbound', 4, 'UNL', 'Unleashed', 'Unleashed Booster');
`);
ensureBreakOrderHistorySchema(database);
ensurePullHistorySchema(database);
ensureBoxTrackerSchema(database);

const batchId = Number(database.prepare(`
  INSERT INTO pull_history_batches (ledger_saved_at, game_code, set_code, set_name, recorded_at)
  VALUES ('correctable-box', 'RIFTBOUND', 'UNL', 'Unleashed', '2026-09-24T01:00:00Z')
`).run().lastInsertRowid);
const historyId = Number(database.prepare(`
  INSERT INTO break_order_history (break_name, box_cost_cents, gross_sales_cents,
    confirmed_order_count, pull_history_batch_id, recorded_at)
  VALUES ('Unleashed Box 1', 15000, 22000, 2, ?, '2026-09-24T01:00:00Z')
`).run(batchId).lastInsertRowid);
database.prepare(`
  INSERT INTO break_order_history_items (history_id, position, buyer_name, card_name, sale_amount_cents)
  VALUES (?, 1, 'alice', 'Champion A', 12000), (?, 2, 'bob', 'Champion B', 10000)
`).run(historyId, historyId);
database.prepare(`
  INSERT INTO break_order_history_pulls (history_id, position, buyer_name, card_name, card_number, set_code, rarity, quantity)
  VALUES (?, 1, 'alice', 'Epic One', 'UNL-118/219', 'UNL', 'Epic', 2)
`).run(historyId);
const initial = syncBoxTrackerFromHistory(database, {
  historyId, pullHistoryBatchId: batchId, recordType: 'BOX', breakName: 'Unleashed Box 1',
  pulls: [{ buyerName: 'alice', position: 1, cardName: 'Epic One', cardNumber: 'UNL-118/219', setCode: 'UNL', rarity: 'Epic', quantity: 2 }],
  assigned: [{ position: 1, sale_amount_cents: 12000 }, { position: 2, sale_amount_cents: 10000 }]
});
const liveCase = createOpenCaseTracker(database, {
  caseName: 'Unleashed Case A', gameCode: 'RIFTBOUND', setCode: 'UNL', totalBoxes: 2
});
const wrongCase = createOpenCaseTracker(database, {
  caseName: 'Vendetta Case', gameCode: 'RIFTBOUND', setCode: 'VEN', totalBoxes: 2
});

function move(payload) {
  database.exec('BEGIN IMMEDIATE');
  try {
    const result = changeOrderTrackerDestination(database, { id: historyId, ...payload });
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

assert.throws(() => move({ destination: 'OPEN_CASE', openCaseId: wrongCase.trackerId }), /tracking (?:VEN|Vendetta)/);
assert.equal(database.prepare('SELECT box_tracker_id FROM break_order_history WHERE id = ?').get(historyId).box_tracker_id, initial.trackerId);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM box_tracker_history_links').get().count, 0);

const moved = move({ destination: 'OPEN_CASE', openCaseId: liveCase.trackerId });
assert.equal(moved.boxNumber, 1);
assert.equal(moved.trackedHitCount, 2);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM box_trackers WHERE id = ?').get(initial.trackerId).count, 0);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM box_tracker_history_links WHERE history_id = ?').get(historyId).count, 1);
assert.equal(database.prepare('SELECT epic_count FROM box_tracker_boxes WHERE tracker_id = ? AND box_number = 1').get(liveCase.trackerId).epic_count, 2);
assert.equal(database.prepare('SELECT SUM(quantity) AS count FROM box_tracker_hit_winners WHERE tracker_id = ?').get(liveCase.trackerId).count, 2);
assert.equal(database.prepare('SELECT sale_amount_cents FROM box_tracker_hit_winners WHERE tracker_id = ?').get(liveCase.trackerId).sale_amount_cents, 12000);
assert.equal(move({ destination: 'OPEN_CASE', openCaseId: liveCase.trackerId }).unchanged, true);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM box_tracker_history_links').get().count, 1);
assert.throws(() => move({ destination: 'OPEN_CASE', openCaseId: wrongCase.trackerId }), /tracking (?:VEN|Vendetta)/);
assert.equal(database.prepare('SELECT tracker_id FROM box_tracker_history_links WHERE history_id = ?').get(historyId).tracker_id, liveCase.trackerId);
assert.equal(database.prepare('SELECT epic_count FROM box_tracker_boxes WHERE tracker_id = ? AND box_number = 1').get(liveCase.trackerId).epic_count, 2);

const standalone = move({ destination: 'CASE' });
assert.equal(standalone.recordType, 'CASE');
assert.equal(database.prepare('SELECT status, epic_count FROM box_tracker_boxes WHERE tracker_id = ? AND box_number = 1').get(liveCase.trackerId).status, 'sealed');
assert.equal(database.prepare('SELECT epic_count FROM box_tracker_boxes WHERE tracker_id = ? AND box_number = 1').get(liveCase.trackerId).epic_count, 0);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM box_tracker_history_links').get().count, 0);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM box_trackers WHERE id = ?').get(liveCase.trackerId).count, 1);
assert.equal(database.prepare('SELECT tracker_record_type, box_tracker_id FROM break_order_history WHERE id = ?').get(historyId).tracker_record_type, 'CASE');
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM break_order_history_items WHERE history_id = ?').get(historyId).count, 2);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM break_order_history_pulls WHERE history_id = ?').get(historyId).count, 1);
assert.equal(database.prepare('SELECT box_cost_cents, gross_sales_cents FROM break_order_history WHERE id = ?').get(historyId).gross_sales_cents, 22000);
assert.equal(move({ destination: 'BOX' }).recordType, 'BOX');
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM box_trackers WHERE order_history_id = ?').get(historyId).count, 1);

database.close();
console.log('Saved Order tracker destination checks passed.');
