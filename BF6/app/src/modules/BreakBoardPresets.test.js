const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { BREAK_BOARD_PRESET_CAPACITY, BREAK_BOARD_PRESET_SLOTS, ensureBreakBoardPresetCapacity, normalizePresetName, normalizePresetSlot, resolveWorkingPresetSlot, sameBoardOrder } = require('./BreakBoardPresets');

assert.equal(BREAK_BOARD_PRESET_CAPACITY, 10);
assert.deepEqual(BREAK_BOARD_PRESET_SLOTS, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
assert.equal(normalizePresetSlot('10'), 10);
assert.throws(() => normalizePresetSlot(11), /10 saved board setups/);
assert.equal(normalizePresetName('  OP-16  ·  82 cards  ', 'Board 1'), 'OP-16 · 82 cards');
assert.equal(normalizePresetName('', 'Board 1'), 'Board 1');
assert.equal(sameBoardOrder([{ card_id: 2, position: 1 }], [{ card_id: 2, position: 1 }]), true);
assert.equal(sameBoardOrder([{ card_id: 2, position: 1 }], [{ card_id: 3, position: 1 }]), false);
assert.equal(resolveWorkingPresetSlot('5', [3, 5]), 5);
assert.equal(resolveWorkingPresetSlot('', [3, 5]), 3);
assert.equal(resolveWorkingPresetSlot('', []), 1);

const database = new DatabaseSync(':memory:');
database.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE cards (id INTEGER PRIMARY KEY);
  CREATE TABLE break_board_presets (
    slot INTEGER PRIMARY KEY CHECK(slot BETWEEN 1 AND 5),
    name TEXT NOT NULL DEFAULT '',
    saved_at TEXT NOT NULL,
    mapping_mode TEXT NOT NULL DEFAULT 'MAPPED' CHECK(mapping_mode IN ('MAPPED', 'SINGLES'))
  );
  CREATE TABLE break_board_preset_cards (
    slot INTEGER NOT NULL,
    position INTEGER NOT NULL,
    card_id INTEGER NOT NULL,
    added_at TEXT NOT NULL,
    PRIMARY KEY(slot, position),
    UNIQUE(slot, card_id),
    FOREIGN KEY(slot) REFERENCES break_board_presets(slot) ON DELETE CASCADE,
    FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE CASCADE
  );
  INSERT INTO cards (id) VALUES (1);
  INSERT INTO break_board_presets (slot, name, saved_at, mapping_mode) VALUES (5, 'Keep Me', 'old', 'SINGLES');
  INSERT INTO break_board_preset_cards (slot, position, card_id, added_at) VALUES (5, 1, 1, 'old');
`);
const migration = ensureBreakBoardPresetCapacity(database);
assert.deepEqual(migration, { migrated: true, fromCapacity: 5, capacity: 10 });
assert.deepEqual({ ...database.prepare('SELECT * FROM break_board_presets WHERE slot = 5').get() }, {
  slot: 5,
  name: 'Keep Me',
  saved_at: 'old',
  mapping_mode: 'SINGLES'
});
assert.deepEqual({ ...database.prepare('SELECT * FROM break_board_preset_cards WHERE slot = 5').get() }, {
  slot: 5,
  position: 1,
  card_id: 1,
  added_at: 'old'
});
assert.doesNotThrow(() => database.prepare("INSERT INTO break_board_presets (slot, name, saved_at) VALUES (10, 'New Slot', 'now')").run());
assert.throws(() => database.prepare("INSERT INTO break_board_presets (slot, name, saved_at) VALUES (11, 'Too Far', 'now')").run());
assert.equal(database.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
assert.equal(database.prepare('PRAGMA foreign_key_check').get(), undefined);
assert.equal(ensureBreakBoardPresetCapacity(database).reason, 'capacity-ready');
database.close();

console.log('Break board presets test passed.');
