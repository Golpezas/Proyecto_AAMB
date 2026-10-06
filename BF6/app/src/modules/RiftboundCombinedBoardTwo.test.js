'use strict';

const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const {
  COMBINED_BOARD_TWO_MIGRATION_KEY,
  COMBINED_BOARD_TWO_NAME,
  ensureCombinedBoardTwo,
  prepareCombinedBoardTwo
} = require('./RiftboundCombinedBoardTwo');

const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE app_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE cards (
    id INTEGER PRIMARY KEY, game_code TEXT, set_code TEXT, name TEXT,
    card_number TEXT, rarity TEXT, variant TEXT, card_type TEXT
  );
  CREATE TABLE break_board_presets (
    slot INTEGER PRIMARY KEY, name TEXT NOT NULL, saved_at TEXT NOT NULL,
    mapping_mode TEXT NOT NULL DEFAULT 'MAPPED'
  );
  CREATE TABLE break_board_preset_cards (
    slot INTEGER NOT NULL, position INTEGER NOT NULL, card_id INTEGER NOT NULL,
    added_at TEXT NOT NULL, PRIMARY KEY(slot, position)
  );
  CREATE TABLE break_board_cards (
    card_id INTEGER NOT NULL, position INTEGER PRIMARY KEY, added_at TEXT NOT NULL
  );
  CREATE TABLE break_board_custom_spots (
    slot INTEGER NOT NULL, position INTEGER NOT NULL, label TEXT NOT NULL,
    updated_at TEXT NOT NULL, PRIMARY KEY(slot, position)
  );
  CREATE TABLE break_board_custom_spot_cards (
    slot INTEGER NOT NULL, position INTEGER NOT NULL, card_id INTEGER NOT NULL,
    sort_order INTEGER NOT NULL, addition_type TEXT NOT NULL, updated_at TEXT NOT NULL,
    PRIMARY KEY(slot, position, card_id), UNIQUE(slot, card_id)
  );
`);

db.prepare("INSERT INTO break_board_presets VALUES (8, 'Origins Source', 'old', 'MAPPED')").run();
db.prepare("INSERT INTO break_board_presets VALUES (4, 'Spiritforged Source', 'old', 'MAPPED')").run();
db.prepare("INSERT INTO break_board_presets VALUES (2, 'Old Board 2', 'old', 'MAPPED')").run();
db.prepare("INSERT INTO app_metadata VALUES ('break-board-working-preset-slot-v1', '2')").run();

const addCard = db.prepare("INSERT INTO cards (id, game_code, set_code, name, card_number, rarity, variant, card_type) VALUES (?, 'RIFTBOUND', ?, ?, ?, 'Rare', '', 'Unit')");
const addPreset = db.prepare("INSERT INTO break_board_preset_cards VALUES (?, ?, ?, 'old')");
const addSpot = db.prepare("INSERT INTO break_board_custom_spots VALUES (?, ?, ?, 'old')");
const addMapped = db.prepare("INSERT INTO break_board_custom_spot_cards VALUES (?, ?, ?, ?, ?, 'old')");
let id = 1;
for (let position = 1; position <= 24; position += 1) {
  const cardId = id++;
  const label = position === 24 ? 'Remaining Gear & Spells · Rare, Epic, AA' : `Origins Spot ${position}`;
  addCard.run(cardId, 'OGN', `OGN Card ${position}`, `OGN-${position}`);
  addPreset.run(8, position, cardId);
  addSpot.run(8, position, label);
  addMapped.run(8, position, cardId, 1, 'ANCHOR');
}
for (let position = 1; position <= 18; position += 1) {
  const cardId = id++;
  addCard.run(cardId, 'SFD', `Spiritforged Card ${position}`, `SFD-${position}`);
  addPreset.run(4, position, cardId);
  addSpot.run(4, position, `Spiritforged Spot ${position}`);
  addMapped.run(4, position, cardId, 1, 'ANCHOR');
}

const prepared = prepareCombinedBoardTwo(db);
assert.equal(prepared.ready, true, JSON.stringify(prepared));
assert.equal(prepared.spots.length, 42);
assert.equal(prepared.spots[0].label, '[OGN] Origins Spot 1');
assert.equal(prepared.spots[23].label, '[OGN] Remaining Gear & Spells · Rare, Epic, AA');
assert.equal(prepared.spots[24].label, '[SFD] Spiritforged Spot 1');
assert.equal(prepared.spots[41].label, '[SFD] Spiritforged Spot 18');

const seeded = ensureCombinedBoardTwo(db);
assert.equal(seeded.seeded, true);
assert.equal(seeded.positions, 42);
assert.equal(seeded.originsPositions, 24);
assert.equal(seeded.spiritforgedPositions, 18);
assert.equal(db.prepare('SELECT name FROM break_board_presets WHERE slot = 2').get().name, 'Origins + Spiritforged · 42 Spots · Board 8 + Board 4');
assert.equal(db.prepare('SELECT COUNT(*) AS count FROM break_board_preset_cards WHERE slot = 2').get().count, 42);
assert.equal(db.prepare('SELECT COUNT(*) AS count FROM break_board_custom_spots WHERE slot = 2').get().count, 42);
assert.equal(db.prepare('SELECT COUNT(*) AS count FROM break_board_cards').get().count, 42);
assert.equal(db.prepare('SELECT label FROM break_board_custom_spots WHERE slot = 2 AND position = 24').get().label,
  '[OGN] Remaining Gear & Spells · Rare, Epic, AA');
assert.equal(db.prepare('SELECT label FROM break_board_custom_spots WHERE slot = 2 AND position = 25').get().label,
  '[SFD] Spiritforged Spot 1');
assert.ok(db.prepare('SELECT value FROM app_metadata WHERE key = ?').get(COMBINED_BOARD_TWO_MIGRATION_KEY));
assert.equal(ensureCombinedBoardTwo(db).reason, 'already-installed');

// Retry must leave the user's subsequent edits intact.
db.prepare("UPDATE break_board_presets SET name = 'Edited' WHERE slot = 2").run();
assert.equal(ensureCombinedBoardTwo(db).reason, 'already-installed');
assert.equal(db.prepare('SELECT name FROM break_board_presets WHERE slot = 2').get().name, 'Edited');
// Sources remain intact.
assert.equal(db.prepare('SELECT COUNT(*) AS count FROM break_board_preset_cards WHERE slot = 8').get().count, 24);
assert.equal(db.prepare('SELECT COUNT(*) AS count FROM break_board_preset_cards WHERE slot = 4').get().count, 18);
// A built-in source must expand its full family, never silently copy only anchors.
db.prepare('DELETE FROM break_board_custom_spot_cards WHERE slot = 4').run();
assert.equal(prepareCombinedBoardTwo(db).ready, false);
const defaultMapping = anchors => anchors.map(anchor => ({ position: anchor.position, label: anchor.name, cards: [anchor] }));
assert.equal(prepareCombinedBoardTwo(db, defaultMapping).spots.length, 42);
// A missing source must not overwrite the destination.
db.prepare('DELETE FROM break_board_preset_cards WHERE slot = 4').run();
assert.equal(prepareCombinedBoardTwo(db, defaultMapping).reason, 'missing-source-board');
assert.equal(db.prepare('SELECT COUNT(*) AS count FROM break_board_preset_cards WHERE slot = 2').get().count, 42);
console.log('Origins + Spiritforged Board 2 migration checks passed.');
