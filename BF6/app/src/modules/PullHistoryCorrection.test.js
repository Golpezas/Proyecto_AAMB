const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { ensureBreakOrderHistorySchema } = require('./BreakOrderHistory');
const { ensurePullHistorySchema } = require('./PullHistory');
const { ensureBoxTrackerSchema } = require('./BoxTracker');
const { syncBoxTrackerFromHistory } = require('./AutomaticBoxTracker');
const { addPullHistoryCardCorrection } = require('./PullHistoryCorrection');

const database = new DatabaseSync(':memory:');
database.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE catalog_sets (
    game_code TEXT NOT NULL, game_name TEXT NOT NULL, set_number INTEGER NOT NULL,
    set_code TEXT NOT NULL, set_name TEXT NOT NULL, product_name TEXT NOT NULL,
    box_count INTEGER NOT NULL DEFAULT 6, base_card_count INTEGER,
    PRIMARY KEY(game_code, set_code)
  );
  INSERT INTO catalog_sets (
    game_code, game_name, set_number, set_code, set_name, product_name
  ) VALUES ('RIFTBOUND', 'Riftbound', 4, 'UNL', 'Unleashed', 'Unleashed Booster');
  CREATE TABLE live_board_guard (id INTEGER PRIMARY KEY, value TEXT NOT NULL);
  INSERT INTO live_board_guard VALUES (1, 'untouched');
`);
ensureBreakOrderHistorySchema(database);
ensurePullHistorySchema(database);
ensureBoxTrackerSchema(database);

const batchId = Number(database.prepare(`
  INSERT INTO pull_history_batches (
    ledger_saved_at, game_code, set_code, set_name, recorded_at
  ) VALUES ('saved-ledger', 'RIFTBOUND', 'UNL', 'Unleashed', '2026-09-24T00:00:00.000Z')
`).run().lastInsertRowid);
database.prepare(`
  INSERT INTO pull_history_spots (batch_id, buyer_name, position, paid_cents)
  VALUES (?, '@alice', 3, 2500)
`).run(batchId);
database.prepare(`
  INSERT INTO pull_history_items (
    batch_id, buyer_name, position, card_name, card_number, set_code, rarity,
    collector_treatment, variant_hint, quantity, source_kind
  ) VALUES (?, '@alice', 3, 'Elder Dragon', 'UNL-118/219', 'UNL', 'Epic', '', '', 1, 'selected')
`).run(batchId);
const historyId = Number(database.prepare(`
  INSERT INTO break_order_history (break_name, pull_history_batch_id, recorded_at)
  VALUES ('Unleashed Box 1', ?, '2026-09-24T00:00:00.000Z')
`).run(batchId).lastInsertRowid);
database.prepare(`
  INSERT INTO break_order_history_items (
    history_id, position, buyer_name, card_name, card_number, set_code,
    rarity, sale_amount_cents
  ) VALUES (?, 3, '@alice', 'Spot 3', 'UNL-SPOT-3', 'UNL', 'Spot', 2500)
`).run(historyId);

syncBoxTrackerFromHistory(database, {
  historyId,
  pullHistoryBatchId: batchId,
  recordType: 'BOX',
  breakName: 'Unleashed Box 1',
  pulls: database.prepare('SELECT * FROM pull_history_items WHERE batch_id = ?').all(batchId),
  assigned: [{ position: 3, sale_amount_cents: 2500 }]
});

const corrected = addPullHistoryCardCorrection(database, {
  batchId,
  position: 3,
  correctedAt: '2026-09-24T01:00:00.000Z',
  item: {
    buyerName: '@wrong-buyer',
    cardName: 'Elder Dragon',
    cardNumber: 'UNL-118/219',
    setCode: 'UNL',
    rarity: 'Epic',
    quantity: 1,
    sourceKind: 'history-edit'
  }
});

assert.equal(corrected.merged, true);
assert.equal(corrected.quantity, 2);
assert.equal(corrected.linkedOrderCount, 1);
assert.equal(corrected.rebuiltTrackerCount, 1);
assert.deepEqual({ ...database.prepare(`
  SELECT buyer_name, quantity FROM pull_history_items WHERE batch_id = ?
`).get(batchId) }, { buyer_name: '@alice', quantity: 2 });
assert.deepEqual({ ...database.prepare(`
  SELECT buyer_name, quantity FROM break_order_history_pulls WHERE history_id = ?
`).get(historyId) }, { buyer_name: '@alice', quantity: 2 });
assert.equal(database.prepare(`
  SELECT epic_count FROM box_tracker_boxes WHERE tracker_id = (
    SELECT id FROM box_trackers WHERE order_history_id = ?
  )
`).get(historyId).epic_count, 2);
assert.deepEqual({ ...database.prepare(`
  SELECT buyer_name, quantity, sale_amount_cents
  FROM box_tracker_hit_winners WHERE source_history_id = ?
`).get(historyId) }, { buyer_name: 'alice', quantity: 2, sale_amount_cents: 2500 });
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM box_trackers').get().count, 1);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM box_tracker_hit_winners').get().count, 1);
assert.equal(database.prepare('SELECT value FROM live_board_guard WHERE id = 1').get().value, 'untouched');

assert.throws(() => addPullHistoryCardCorrection(database, {
  batchId,
  position: 3,
  item: {
    cardName: 'Wrong Set', cardNumber: 'VEN-001/221', setCode: 'VEN',
    rarity: 'Rare', quantity: 1
  }
}), /Choose a UNL card/);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM pull_history_items').get().count, 1);

database.close();
console.log('Pull History correction checks passed.');
