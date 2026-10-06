'use strict';

const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const {
  VENDETTA_BREAK_BOARD_NAME,
  VENDETTA_BREAK_MIGRATION_KEY,
  VENDETTA_BREAK_SPOTS,
  collectorNumberKey,
  ensureVendettaBreakBoardFive,
  isVendettaBreakBoard,
  matchesVendettaBreakSpot
} = require('./RiftboundVendettaBreak');

assert.equal(VENDETTA_BREAK_SPOTS.length, 15);
assert.equal(collectorNumberKey('VEN-189*/166'), '189*');
assert.equal(collectorNumberKey('VND-SP1/006'), 'SP1');
assert.equal(matchesVendettaBreakSpot({ set_code: 'VEN', card_number: '189*/166' }, VENDETTA_BREAK_SPOTS[0]), true);
assert.equal(matchesVendettaBreakSpot({ set_code: 'UNL', card_number: '189*/166' }, VENDETTA_BREAK_SPOTS[0]), false);

const database = new DatabaseSync(':memory:');
database.exec(`
  CREATE TABLE app_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE cards (
    id INTEGER PRIMARY KEY,
    game_code TEXT,
    set_code TEXT,
    name TEXT,
    card_number TEXT,
    image_path TEXT,
    image_url TEXT
  );
  CREATE TABLE break_board_presets (
    slot INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    saved_at TEXT NOT NULL,
    mapping_mode TEXT NOT NULL DEFAULT 'MAPPED'
  );
  CREATE TABLE break_board_preset_cards (
    slot INTEGER NOT NULL,
    position INTEGER NOT NULL,
    card_id INTEGER NOT NULL,
    added_at TEXT NOT NULL,
    PRIMARY KEY (slot, position)
  );
  CREATE TABLE break_board_cards (
    card_id INTEGER NOT NULL,
    position INTEGER PRIMARY KEY,
    added_at TEXT NOT NULL
  );
`);

database.prepare('INSERT INTO app_metadata (key, value) VALUES (?, ?)')
  .run('break-board-working-preset-slot-v1', '5');
database.prepare("INSERT INTO break_board_presets (slot, name, saved_at, mapping_mode) VALUES (5, 'Old Vendetta', 'old', 'SINGLES')").run();
database.prepare("INSERT INTO cards (id, game_code, set_code, name, card_number) VALUES (999, 'RIFTBOUND', 'VEN', 'Old', '001/166')").run();
database.prepare("INSERT INTO break_board_preset_cards (slot, position, card_id, added_at) VALUES (5, 1, 999, 'old')").run();
database.prepare("INSERT INTO break_board_cards (card_id, position, added_at) VALUES (999, 1, 'old')").run();

const insertCard = database.prepare(`
  INSERT INTO cards (id, game_code, set_code, name, card_number, image_url)
  VALUES (?, 'RIFTBOUND', 'VEN', ?, ?, ?)
`);
VENDETTA_BREAK_SPOTS.forEach((definition, index) => {
  insertCard.run(index + 1, `${definition.anchor}, Anchor`, definition.cardNumber, `https://example.test/${index + 1}.webp`);
});

const seeded = ensureVendettaBreakBoardFive(database);
assert.equal(seeded.seeded, true);
assert.equal(seeded.savedCards, 15);
assert.equal(seeded.loadedWorkingBoard, true);
assert.equal(database.prepare('SELECT name FROM break_board_presets WHERE slot = 5').get().name, VENDETTA_BREAK_BOARD_NAME);
assert.equal(database.prepare('SELECT mapping_mode FROM break_board_presets WHERE slot = 5').get().mapping_mode, 'MAPPED');
assert.equal(database.prepare("SELECT value FROM app_metadata WHERE key = 'break-board-working-mapping-mode-v1'").get().value, 'MAPPED');
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM break_board_preset_cards WHERE slot = 5').get().count, 15);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM break_board_cards').get().count, 15);
const board = database.prepare(`
  SELECT c.*, pc.position
  FROM break_board_preset_cards pc JOIN cards c ON c.id = pc.card_id
  WHERE pc.slot = 5 ORDER BY pc.position
`).all();
assert.equal(isVendettaBreakBoard(board), true);
assert.ok(database.prepare('SELECT value FROM app_metadata WHERE key = ?').get(VENDETTA_BREAK_MIGRATION_KEY)?.value);

database.prepare("UPDATE break_board_presets SET name = 'User Renamed Vendetta', mapping_mode = 'SINGLES' WHERE slot = 5").run();
const skipped = ensureVendettaBreakBoardFive(database);
assert.equal(skipped.reason, 'already-installed');
assert.equal(database.prepare('SELECT name FROM break_board_presets WHERE slot = 5').get().name, 'User Renamed Vendetta');
assert.equal(database.prepare('SELECT mapping_mode FROM break_board_presets WHERE slot = 5').get().mapping_mode, 'SINGLES');

database.close();
console.log('Vendetta 15-spot Board 5 migration tests passed.');
