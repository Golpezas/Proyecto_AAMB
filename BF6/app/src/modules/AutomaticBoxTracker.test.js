const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { ensureBreakOrderHistorySchema } = require('./BreakOrderHistory');
const { ensurePullHistorySchema } = require('./PullHistory');
const { ensureBoxTrackerSchema } = require('./BoxTracker');
const { syncBoxTrackerFromHistory, trackerFieldForClassification } = require('./AutomaticBoxTracker');

assert.equal(trackerFieldForClassification(null), '');
assert.equal(trackerFieldForClassification({ gameCode: 'RIFTBOUND', categoryKey: 'EPIC' }), 'epic_count');
assert.equal(trackerFieldForClassification({ gameCode: 'RIFTBOUND', categoryKey: 'SP' }), 'sp_count');
assert.equal(trackerFieldForClassification({ gameCode: 'ONEPIECE', categoryKey: 'MANGA' }), 'manga_count');
assert.equal(trackerFieldForClassification({ gameCode: 'ONEPIECE', categoryKey: 'SP' }), 'sp_count');

const database = new DatabaseSync(':memory:');
database.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE catalog_sets (
    game_code TEXT NOT NULL, game_name TEXT NOT NULL, set_number INTEGER NOT NULL,
    set_code TEXT NOT NULL, set_name TEXT NOT NULL, product_name TEXT NOT NULL,
    box_count INTEGER NOT NULL DEFAULT 6, base_card_count INTEGER,
    PRIMARY KEY(game_code, set_code)
  );
`);
ensureBreakOrderHistorySchema(database);
ensurePullHistorySchema(database);
ensureBoxTrackerSchema(database);
database.prepare(`
  INSERT INTO catalog_sets (game_code, game_name, set_number, set_code, set_name, product_name)
  VALUES ('RIFTBOUND', 'Riftbound', 4, 'UNL', 'Unleashed', 'Unleashed Booster')
`).run();
const batchId = Number(database.prepare(`
  INSERT INTO pull_history_batches (ledger_saved_at, game_code, set_code, set_name, recorded_at)
  VALUES ('integration-ledger', 'RIFTBOUND', 'UNL', 'Unleashed', '2026-09-22T00:00:00.000Z')
`).run().lastInsertRowid);
const historyId = Number(database.prepare(`
  INSERT INTO break_order_history (break_name, pull_history_batch_id, recorded_at)
  VALUES ('Tuesday Break', ?, '2026-09-22T00:00:00.000Z')
`).run(batchId).lastInsertRowid);

const pulls = [
  { buyerName: 'alice', position: 1, cardName: 'Elder Dragon', cardNumber: 'UNL-118/219', setCode: 'UNL', rarity: 'Epic', quantity: 2 },
  { buyerName: 'alice', position: 1, cardName: 'Elder Dragon AA', cardNumber: 'UNL-118a/219', setCode: 'UNL', rarity: 'Showcase', quantity: 1 },
  { buyerName: 'bob', position: 2, cardName: 'Rengar ON', cardNumber: 'UNL-229/219', setCode: 'UNL', rarity: 'Showcase', quantity: 1 },
  { buyerName: 'bob', position: 2, cardName: 'Rengar SIG', cardNumber: 'UNL-229*/219', setCode: 'UNL', rarity: 'Showcase', quantity: 1 },
  { buyerName: 'carl', position: 3, cardName: 'Future SP', cardNumber: 'UNL-SP1/012', setCode: 'UNL', rarity: 'Showcase', collectorTreatment: 'SP', quantity: 1 }
];
let activeTrackerId = null;
const result = syncBoxTrackerFromHistory(database, {
  historyId,
  pullHistoryBatchId: batchId,
  recordType: 'CASE',
  breakName: 'Tuesday Break',
  recordedAt: '2026-09-22T00:00:00.000Z',
  pulls,
  assigned: [
    { position: 1, sale_amount_cents: 1200 },
    { position: 2, sale_amount_cents: 2000 },
    { position: 3, sale_amount_cents: 900 }
  ]
}, { setActiveTracker: id => { activeTrackerId = id; } });

assert.deepEqual({
  recordType: result.recordType,
  gameCode: result.gameCode,
  setCode: result.setCode,
  setName: result.setName,
  trackedHitCount: result.trackedHitCount
}, {
  recordType: 'CASE',
  gameCode: 'RIFTBOUND',
  setCode: 'UNL',
  setName: 'Unleashed',
  trackedHitCount: 6
});
assert.equal(activeTrackerId, result.trackerId);
assert.equal(database.prepare('SELECT tracker_name FROM box_trackers WHERE id = ?').get(result.trackerId).tracker_name, 'Unleashed Case · Tuesday Break');
assert.deepEqual({ ...database.prepare(`
  SELECT epic_count, sp_count, alt_art_count, overnumbered_count, signature_count
  FROM box_tracker_boxes
`).get() }, {
  epic_count: 2,
  sp_count: 1,
  alt_art_count: 1,
  overnumbered_count: 1,
  signature_count: 1
});
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM box_tracker_hit_winners').get().count, 5);
assert.equal(database.prepare('SELECT SUM(quantity) AS count FROM box_tracker_hit_winners').get().count, 6);
assert.deepEqual({ ...database.prepare(`
  SELECT card_name, rarity, buyer_name, spot_number, sale_amount_cents,
    card_number, category_key, quantity, note
  FROM box_tracker_hit_winners WHERE category_key = 'SP'
`).get() }, {
  card_name: 'Future SP',
  rarity: 'SP / Special',
  buyer_name: 'carl',
  spot_number: 3,
  sale_amount_cents: 900,
  card_number: 'UNL-SP1/012',
  category_key: 'SP',
  quantity: 1,
  note: 'SP'
});
assert.deepEqual({ ...database.prepare(`
  SELECT tracker_record_type, tracker_game_code, tracker_set_code,
    tracker_set_name, box_tracker_id
  FROM break_order_history
`).get() }, {
  tracker_record_type: 'CASE',
  tracker_game_code: 'RIFTBOUND',
  tracker_set_code: 'UNL',
  tracker_set_name: 'Unleashed',
  box_tracker_id: result.trackerId
});

// Re-saving/correcting the same history link replaces its tracker snapshot;
// it never doubles the record or its hit rows.
const corrected = syncBoxTrackerFromHistory(database, {
  historyId,
  pullHistoryBatchId: batchId,
  recordType: 'BOX',
  breakName: 'Tuesday Break',
  pulls: [pulls[0]],
  assigned: []
});
assert.equal(corrected.trackerId, result.trackerId);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM box_trackers').get().count, 1);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM box_tracker_hit_winners').get().count, 1);
assert.equal(database.prepare('SELECT record_type FROM box_trackers').get().record_type, 'BOX');

const onePieceBatchId = Number(database.prepare(`
  INSERT INTO pull_history_batches (ledger_saved_at, game_code, set_code, set_name, recorded_at)
  VALUES ('one-piece-ledger', 'ONEPIECE', 'OP-16', 'Legacy of the Master', '2026-09-23T00:00:00.000Z')
`).run().lastInsertRowid);
const onePieceHistoryId = Number(database.prepare(`
  INSERT INTO break_order_history (break_name, pull_history_batch_id, recorded_at)
  VALUES ('OP-16 Box 1', ?, '2026-09-23T00:00:00.000Z')
`).run(onePieceBatchId).lastInsertRowid);
const onePiece = syncBoxTrackerFromHistory(database, {
  historyId: onePieceHistoryId,
  pullHistoryBatchId: onePieceBatchId,
  recordType: 'BOX',
  breakName: 'OP-16 Box 1',
  pulls: [
    { buyerName: 'nami', position: 4, cardName: 'Manga Hit', cardNumber: 'OP16-001', setCode: 'OP-16', rarity: 'MANGA' },
    { buyerName: 'zoro', position: 5, cardName: 'Secret Alt', cardNumber: 'OP16-002', setCode: 'OP-16', rarity: 'SEC AA' },
    { buyerName: 'sanji', position: 6, cardName: 'Plain SR', cardNumber: 'OP16-003', setCode: 'OP-16', rarity: 'SR' }
  ],
  assigned: []
});
assert.equal(onePiece.gameCode, 'ONEPIECE');
assert.equal(onePiece.trackedHitCount, 2);
assert.deepEqual({ ...database.prepare(`
  SELECT manga_count, sec_aa_count, sr_aa_count
  FROM box_tracker_boxes WHERE tracker_id = ?
`).get(onePiece.trackerId) }, { manga_count: 1, sec_aa_count: 1, sr_aa_count: 0 });
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM box_trackers').get().count, 2);

database.close();
console.log('Automatic Box Tracker integration checks passed.');
