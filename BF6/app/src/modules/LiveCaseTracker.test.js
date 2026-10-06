const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { ensureBreakOrderHistorySchema } = require('./BreakOrderHistory');
const { ensurePullHistorySchema } = require('./PullHistory');
const { ensureBoxTrackerSchema } = require('./BoxTracker');
const {
  createOpenCaseTracker,
  deleteOpenCaseTracker,
  detachHistoryFromCaseTracker,
  finalizeOpenCaseTracker,
  normalizeTrackerDestinationMode,
  removeOpenCaseBox,
  syncLinkedCaseBoxFromHistory,
  syncOpenCaseBoxFromHistory,
  updateOpenCaseTracker
} = require('./LiveCaseTracker');

assert.equal(normalizeTrackerDestinationMode('open_case'), 'OPEN_CASE');
assert.equal(normalizeTrackerDestinationMode('anything-else'), 'AUTO');

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
  INSERT INTO catalog_sets (game_code, game_name, set_number, set_code, set_name, product_name, box_count)
  VALUES ('RIFTBOUND', 'Riftbound', 4, 'UNL', 'Unleashed', 'Unleashed Booster', 2)
`).run();

let activeTracker = null;
let activeCase = null;
const created = createOpenCaseTracker(database, {
  caseName: 'Unleashed Case A',
  gameCode: 'RIFTBOUND',
  setCode: 'UNL',
  totalBoxes: 2,
  createdAt: '2026-09-24T00:00:00.000Z'
}, {
  setActiveTracker: id => { activeTracker = id; },
  setActiveOpenCase: id => { activeCase = id; }
});
assert.equal(created.totalBoxes, 2);
assert.equal(activeTracker, created.trackerId);
assert.equal(activeCase, created.trackerId);
assert.equal(database.prepare("SELECT lifecycle_status FROM box_trackers WHERE id = ?").get(created.trackerId).lifecycle_status, 'OPEN');
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM box_tracker_boxes WHERE tracker_id = ?').get(created.trackerId).count, 2);

function addHistory(label, ledgerKey) {
  const batchId = Number(database.prepare(`
    INSERT INTO pull_history_batches (ledger_saved_at, game_code, set_code, set_name, recorded_at)
    VALUES (?, 'RIFTBOUND', 'UNL', 'Unleashed', '2026-09-24T01:00:00.000Z')
  `).run(ledgerKey).lastInsertRowid);
  const historyId = Number(database.prepare(`
    INSERT INTO break_order_history (break_name, pull_history_batch_id, recorded_at)
    VALUES (?, ?, '2026-09-24T01:00:00.000Z')
  `).run(label, batchId).lastInsertRowid);
  return { historyId, batchId };
}

const first = addHistory('Unleashed Box 1', 'case-a-box-1');
const firstSync = syncOpenCaseBoxFromHistory(database, {
  openCaseId: created.trackerId,
  historyId: first.historyId,
  pullHistoryBatchId: first.batchId,
  gameCode: 'RIFTBOUND',
  setCode: 'UNL',
  setName: 'Unleashed',
  pulls: [
    { buyerName: 'alice', position: 1, cardName: 'Epic One', cardNumber: 'UNL-118/219', setCode: 'UNL', rarity: 'Epic', quantity: 2 },
    { buyerName: 'bob', position: 2, cardName: 'Signature One', cardNumber: 'UNL-229*/219', setCode: 'UNL', rarity: 'Showcase', quantity: 1 }
  ],
  assigned: [{ position: 1, sale_amount_cents: 1500 }, { position: 2, sale_amount_cents: 2200 }]
});
assert.equal(firstSync.boxNumber, 1);
assert.equal(firstSync.openedBoxes, 1);
assert.equal(firstSync.remainingBoxes, 1);
assert.equal(firstSync.trackedHitCount, 3);
assert.deepEqual({ ...database.prepare(`
  SELECT status, epic_count, signature_count FROM box_tracker_boxes
  WHERE tracker_id = ? AND box_number = 1
`).get(created.trackerId) }, { status: 'opened', epic_count: 2, signature_count: 1 });
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM box_tracker_history_links').get().count, 1);
assert.equal(database.prepare('SELECT SUM(quantity) AS count FROM box_tracker_hit_winners').get().count, 3);

const renamed = updateOpenCaseTracker(database, {
  openCaseId: created.trackerId,
  caseName: 'Unleashed Case A — Live',
  totalBoxes: 3,
  updatedAt: '2026-09-24T01:10:00.000Z'
});
assert.equal(renamed.totalBoxes, 3);
assert.deepEqual({ ...database.prepare(`
  SELECT tracker_name, overlay_title, total_boxes FROM box_trackers WHERE id = ?
`).get(created.trackerId) }, {
  tracker_name: 'Unleashed Case A — Live',
  overlay_title: 'Unleashed Case A — Live',
  total_boxes: 3
});
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM box_tracker_boxes WHERE tracker_id = ?').get(created.trackerId).count, 3);
updateOpenCaseTracker(database, { openCaseId: created.trackerId, totalBoxes: 2 });
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM box_tracker_boxes WHERE tracker_id = ?').get(created.trackerId).count, 2);

const otherCase = createOpenCaseTracker(database, {
  caseName: 'Unleashed Case B', gameCode: 'RIFTBOUND', setCode: 'UNL', totalBoxes: 2
});
assert.throws(() => syncOpenCaseBoxFromHistory(database, {
  openCaseId: otherCase.trackerId,
  historyId: first.historyId,
  pullHistoryBatchId: first.batchId,
  gameCode: 'RIFTBOUND',
  setCode: 'UNL',
  pulls: []
}), /already stored/);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM box_tracker_history_links').get().count, 1);

// A live-case box may be reviewed/removed without deleting its source ledgers,
// and deleting the whole live case unlinks rather than erases those records.
const removable = addHistory('Unleashed Box B1', 'case-b-box-1');
syncOpenCaseBoxFromHistory(database, {
  openCaseId: otherCase.trackerId,
  historyId: removable.historyId,
  pullHistoryBatchId: removable.batchId,
  gameCode: 'RIFTBOUND',
  setCode: 'UNL',
  setName: 'Unleashed',
  pulls: [{ buyerName: 'dana', position: 4, cardName: 'B Epic', cardNumber: 'UNL-119/219', rarity: 'Epic' }]
});
const removed = removeOpenCaseBox(database, {
  openCaseId: otherCase.trackerId,
  boxNumber: 1,
  updatedAt: '2026-09-24T01:20:00.000Z'
});
assert.equal(removed.historyId, removable.historyId);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM break_order_history WHERE id = ?').get(removable.historyId).count, 1);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM pull_history_batches WHERE id = ?').get(removable.batchId).count, 1);
assert.equal(database.prepare('SELECT box_tracker_id FROM break_order_history WHERE id = ?').get(removable.historyId).box_tracker_id, null);
assert.deepEqual({ ...database.prepare(`
  SELECT status, epic_count FROM box_tracker_boxes WHERE tracker_id = ? AND box_number = 1
`).get(otherCase.trackerId) }, { status: 'sealed', epic_count: 0 });

syncOpenCaseBoxFromHistory(database, {
  openCaseId: otherCase.trackerId,
  historyId: removable.historyId,
  pullHistoryBatchId: removable.batchId,
  gameCode: 'RIFTBOUND',
  setCode: 'UNL',
  setName: 'Unleashed',
  pulls: []
});
const deletedLiveCase = deleteOpenCaseTracker(database, { openCaseId: otherCase.trackerId });
assert.equal(deletedLiveCase.linkedBoxes, 1);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM box_trackers WHERE id = ?').get(otherCase.trackerId).count, 0);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM break_order_history WHERE id = ?').get(removable.historyId).count, 1);
assert.equal(database.prepare('SELECT box_tracker_id FROM break_order_history WHERE id = ?').get(removable.historyId).box_tracker_id, null);

// Retrying/correcting history #1 replaces Box 1 instead of allocating Box 2
// or adding its counts a second time.
const corrected = syncLinkedCaseBoxFromHistory(database, {
  historyId: first.historyId,
  pullHistoryBatchId: first.batchId,
  gameCode: 'RIFTBOUND',
  setCode: 'UNL',
  setName: 'Unleashed',
  pulls: [{ buyerName: 'alice', position: 1, cardName: 'Corrected Epic', cardNumber: 'UNL-118/219', setCode: 'UNL', rarity: 'Epic', quantity: 1 }],
  assigned: [{ position: 1, sale_amount_cents: 1500 }]
});
assert.equal(corrected.boxNumber, 1);
assert.equal(corrected.openedBoxes, 1);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM box_tracker_history_links').get().count, 1);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM box_tracker_hit_winners').get().count, 1);
assert.equal(database.prepare('SELECT epic_count FROM box_tracker_boxes WHERE tracker_id = ? AND box_number = 1').get(created.trackerId).epic_count, 1);

const wrongSet = addHistory('Vendetta Box', 'wrong-case-set');
assert.throws(() => syncOpenCaseBoxFromHistory(database, {
  openCaseId: created.trackerId,
  historyId: wrongSet.historyId,
  pullHistoryBatchId: wrongSet.batchId,
  gameCode: 'RIFTBOUND',
  setCode: 'VEN',
  setName: 'Vendetta',
  pulls: []
}), /is tracking Unleashed/);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM box_tracker_history_links').get().count, 1);

const second = addHistory('Unleashed Box 2', 'case-a-box-2');
const secondSync = syncOpenCaseBoxFromHistory(database, {
  openCaseId: created.trackerId,
  historyId: second.historyId,
  pullHistoryBatchId: second.batchId,
  gameCode: 'RIFTBOUND',
  setCode: 'UNL',
  setName: 'Unleashed',
  pulls: [{ buyerName: 'carl', position: 3, cardName: 'Overnumbered', cardNumber: 'UNL-229/219', setCode: 'UNL', rarity: 'Showcase' }],
  assigned: [{ position: 3, sale_amount_cents: 1800 }]
});
assert.equal(secondSync.boxNumber, 2);
assert.equal(secondSync.openedBoxes, 2);
assert.equal(secondSync.remainingBoxes, 0);
assert.throws(() => updateOpenCaseTracker(database, {
  openCaseId: created.trackerId,
  totalBoxes: 1
}), /Box 02 already contains/);

const third = addHistory('Unleashed Box 3', 'case-a-box-3');
assert.throws(() => syncOpenCaseBoxFromHistory(database, {
  openCaseId: created.trackerId,
  historyId: third.historyId,
  pullHistoryBatchId: third.batchId,
  gameCode: 'RIFTBOUND',
  setCode: 'UNL',
  setName: 'Unleashed',
  pulls: []
}), /is full/);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM box_tracker_history_links').get().count, 2);

const finalized = finalizeOpenCaseTracker(database, { openCaseId: created.trackerId }, { completedAt: '2026-09-24T03:00:00.000Z' });
assert.equal(finalized.lifecycleStatus, 'FINALIZED');
assert.equal(finalized.openedBoxes, 2);
assert.deepEqual({ ...database.prepare('SELECT source_mode, lifecycle_status FROM box_trackers WHERE id = ?').get(created.trackerId) }, {
  source_mode: 'FINALIZED_CASE',
  lifecycle_status: 'FINALIZED'
});
assert.throws(() => syncOpenCaseBoxFromHistory(database, {
  openCaseId: created.trackerId,
  historyId: third.historyId,
  pullHistoryBatchId: third.batchId,
  gameCode: 'RIFTBOUND',
  setCode: 'UNL',
  pulls: []
}), /already finalized/);

// An explicit correction to an already-linked history remains allowed after
// finalization, and deleting one history clears only its own box position.
assert.equal(syncLinkedCaseBoxFromHistory(database, {
  historyId: first.historyId,
  pullHistoryBatchId: first.batchId,
  gameCode: 'RIFTBOUND',
  setCode: 'UNL',
  pulls: [{ buyerName: 'alice', position: 1, cardName: 'Final Correction', cardNumber: 'UNL-118/219', setCode: 'UNL', rarity: 'Epic' }]
}).boxNumber, 1);
const detached = detachHistoryFromCaseTracker(database, second.historyId, { updatedAt: '2026-09-24T04:00:00.000Z' });
assert.equal(detached.boxNumber, 2);
assert.equal(database.prepare('SELECT status FROM box_tracker_boxes WHERE tracker_id = ? AND box_number = 2').get(created.trackerId).status, 'sealed');
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM box_tracker_history_links').get().count, 1);

database.close();
console.log('Live open-case tracker checks passed.');
