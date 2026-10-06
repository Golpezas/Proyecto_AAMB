const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const {
  MAX_BOX_COUNT,
  MAX_BOX_HIT_COUNT,
  RIFTBOUND_TRACKER_HIT_FIELDS,
  ensureBoxTrackerSchema,
  hydrateBoxTrackerRows,
  normalizeBoxCount,
  normalizeBoxHitCount,
  normalizeBoxHitCounts,
  normalizeBoxNote,
  normalizeBoxStatus,
  normalizeProductName,
  normalizeTrackerName,
  normalizeTrackerRecordType,
  requireTrackerRecordType,
  trackerHitFieldsForGame
} = require('./BoxTracker');

assert.equal(normalizeTrackerName('  OP-16 Case #1  '), 'OP-16 Case #1');
assert.equal(normalizeTrackerName(''), 'Untitled case tracker');
assert.equal(normalizeProductName('  The Time of Battle  '), 'The Time of Battle');
assert.equal(normalizeBoxCount('24'), 24);
assert.equal(normalizeBoxCount('0'), 1);
assert.equal(normalizeBoxCount('999'), MAX_BOX_COUNT);
assert.equal(normalizeBoxStatus('LIVE'), 'live');
assert.equal(normalizeBoxStatus('unknown'), 'sealed');
assert.equal(normalizeBoxNote('  opened during show  '), 'opened during show');
assert.equal(normalizeBoxHitCount('4'), 4);
assert.equal(normalizeBoxHitCount('-3'), 0);
assert.equal(normalizeBoxHitCount('999'), MAX_BOX_HIT_COUNT);
assert.equal(normalizeTrackerRecordType('case'), 'CASE');
assert.equal(requireTrackerRecordType('box'), 'BOX');
assert.throws(() => requireTrackerRecordType(''), /Choose Box or Case/);
assert.deepEqual(trackerHitFieldsForGame('RIFTBOUND'), RIFTBOUND_TRACKER_HIT_FIELDS);
assert.equal(RIFTBOUND_TRACKER_HIT_FIELDS.some(field => field.key === 'sp_count' && field.label === 'SP'), true);
assert.deepEqual(normalizeBoxHitCounts({ mangaCount: '2', secAaCount: '1' }), {
  manga_count: 2, sp_count: 0, sec_count: 0, sec_aa_count: 1, leader_aa_count: 0, sr_aa_count: 0,
  r_aa_count: 0, tr_count: 0, gold_don_count: 0, epic_count: 0, alt_art_count: 0,
  overnumbered_count: 0, signature_count: 0
});

const database = new DatabaseSync(':memory:');
database.exec('PRAGMA foreign_keys = ON');
ensureBoxTrackerSchema(database);
database.prepare(`
  INSERT INTO box_trackers (tracker_name, product_name, total_boxes, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?)
`).run('OP-16 Case #1', 'The Time of Battle', 2, '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z');
database.prepare(`
  INSERT INTO box_tracker_boxes (tracker_id, box_number, status, notes, updated_at)
  VALUES (1, 1, 'live', '', '2026-08-01T00:00:00.000Z'),
         (1, 2, 'sealed', '', '2026-08-01T00:00:00.000Z')
`).run();
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM box_tracker_boxes WHERE tracker_id = 1').get().count, 2);
const hitColumns = database.prepare('PRAGMA table_info(box_tracker_boxes)').all().map(column => column.name);
assert.ok(hitColumns.includes('manga_count'));
assert.ok(hitColumns.includes('r_aa_count'));
assert.ok(hitColumns.includes('leader_aa_count'));
assert.ok(hitColumns.includes('tr_count'));
assert.ok(hitColumns.includes('gold_don_count'));
assert.ok(hitColumns.includes('epic_count'));
assert.ok(hitColumns.includes('sp_count'));
assert.ok(hitColumns.includes('signature_count'));
const trackerColumns = database.prepare('PRAGMA table_info(box_trackers)').all().map(column => column.name);
assert.ok(trackerColumns.includes('overlay_title'));
assert.ok(trackerColumns.includes('game_code'));
assert.ok(trackerColumns.includes('record_type'));
assert.ok(trackerColumns.includes('order_history_id'));
assert.ok(trackerColumns.includes('lifecycle_status'));
assert.ok(trackerColumns.includes('completed_at'));
assert.equal(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'box_tracker_history_links'").get().name, 'box_tracker_history_links');
const caseRecordColumns = database.prepare('PRAGMA table_info(box_tracker_case_records)').all().map(column => column.name);
assert.ok(caseRecordColumns.includes('leader_aa_count'));
assert.ok(caseRecordColumns.includes('overnumbered_count'));
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM box_tracker_hit_winners').get().count, 0);
database.prepare(`INSERT INTO box_tracker_hit_winners (tracker_id, box_number, card_name, rarity, buyer_name, note, recorded_at) VALUES (1, 1, 'Test Hit', 'SP', 'buyer', '', '2026-08-01T00:00:00.000Z')`).run();
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM box_tracker_hit_winners').get().count, 1);
database.prepare('DELETE FROM box_trackers WHERE id = 1').run();
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM box_tracker_boxes').get().count, 0);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM box_tracker_hit_winners').get().count, 0);
database.close();

const legacyDatabase = new DatabaseSync(':memory:');
legacyDatabase.exec(`
  CREATE TABLE box_trackers (
    id INTEGER PRIMARY KEY,
    tracker_name TEXT NOT NULL,
    product_name TEXT NOT NULL DEFAULT '',
    total_boxes INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE box_tracker_boxes (
    tracker_id INTEGER NOT NULL,
    box_number INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'sealed',
    notes TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL,
    PRIMARY KEY(tracker_id, box_number)
  );
`);
ensureBoxTrackerSchema(legacyDatabase);
const legacyColumns = legacyDatabase.prepare('PRAGMA table_info(box_tracker_boxes)').all().map(column => column.name);
assert.ok(legacyColumns.includes('sec_aa_count'));
assert.ok(legacyColumns.includes('sr_aa_count'));
assert.ok(legacyColumns.includes('r_aa_count'));
assert.ok(legacyColumns.includes('tr_count'));
const legacyTrackerColumns = legacyDatabase.prepare('PRAGMA table_info(box_trackers)').all().map(column => column.name);
assert.ok(legacyTrackerColumns.includes('overlay_title'));
assert.ok(legacyTrackerColumns.includes('source_mode'));
assert.ok(legacyTrackerColumns.includes('set_name'));
assert.ok(legacyTrackerColumns.includes('lifecycle_status'));
legacyDatabase.close();

// A seller can have hundreds of archived boxes. Loading that list must use a
// bounded number of queries, while keeping linked hits and totals intact.
const listDatabase = new DatabaseSync(':memory:');
ensureBoxTrackerSchema(listDatabase);
listDatabase.exec('CREATE TABLE break_order_history (id INTEGER PRIMARY KEY, break_name TEXT, recorded_at TEXT)');
const insertTracker = listDatabase.prepare(`
  INSERT INTO box_trackers (tracker_name, game_code, total_boxes, created_at, updated_at)
  VALUES (?, ?, 1, '2026-09-26', '2026-09-26')
`);
const insertBox = listDatabase.prepare(`
  INSERT INTO box_tracker_boxes (tracker_id, box_number, status, notes, updated_at, epic_count, overnumbered_count)
  VALUES (?, 1, 'opened', '', '2026-09-26', ?, ?)
`);
listDatabase.exec('BEGIN');
for (let id = 1; id <= 305; id += 1) {
  insertTracker.run(`Case ${id}`, id === 305 ? 'RIFTBOUND' : 'ONEPIECE');
  insertBox.run(id, id === 305 ? 2 : 0, id === 305 ? 1 : 0);
}
listDatabase.exec('COMMIT');
listDatabase.prepare("INSERT INTO break_order_history VALUES (1, 'Unleashed Box 1', '2026-09-26')").run();
listDatabase.prepare(`
  INSERT INTO box_tracker_history_links (tracker_id, history_id, box_number, linked_at)
  VALUES (305, 1, 1, '2026-09-26')
`).run();
listDatabase.prepare(`
  INSERT INTO box_tracker_hit_winners (tracker_id, box_number, card_name, buyer_name, recorded_at)
  VALUES (305, 1, 'Baron', 'buyer', '2026-09-26')
`).run();
let listQueries = 0;
const countedDatabase = { prepare(sql) { listQueries += 1; return listDatabase.prepare(sql); } };
const trackerRows = listDatabase.prepare('SELECT * FROM box_trackers ORDER BY id').all();
const loaded = hydrateBoxTrackerRows(countedDatabase, trackerRows);
assert.equal(listQueries, 6, '305 trackers load in two batches, not 915 separate lookups');
assert.equal(loaded.length, 305);
assert.equal(loaded[0].opened_count, 1);
assert.equal(loaded[304].game_name, 'Riftbound');
assert.equal(loaded[304].hit_counts.epic_count, 2);
assert.equal(loaded[304].hit_counts.overnumbered_count, 1);
assert.equal(loaded[304].boxes[0].history_link.break_name, 'Unleashed Box 1');
assert.equal(loaded[304].boxes[0].hit_winners[0].card_name, 'Baron');
assert.equal(loaded[304].boxes[0].tracker_id, undefined);
listDatabase.close();

console.log('Box tracker checks passed.');
