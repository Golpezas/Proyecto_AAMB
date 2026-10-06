'use strict';

const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const {
  COMBINED_BOARD_SEVEN_MIGRATION_KEY,
  COMBINED_BOARD_SEVEN_NAME,
  ensureCombinedBoardSeven,
  prepareCombinedBoardSeven
} = require('./RiftboundCombinedBoardSeven');

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

db.prepare("INSERT INTO break_board_presets VALUES (1, 'Vendetta Source', 'old', 'MAPPED')").run();
db.prepare("INSERT INTO break_board_presets VALUES (3, 'Unleashed Source', 'old', 'MAPPED')").run();
db.prepare("INSERT INTO break_board_presets VALUES (7, 'Old Board 7', 'old', 'MAPPED')").run();
db.prepare("INSERT INTO app_metadata VALUES ('break-board-working-preset-slot-v1', '7')").run();

const addCard = db.prepare("INSERT INTO cards (id, game_code, set_code, name, card_number, rarity, variant, card_type) VALUES (?, 'RIFTBOUND', ?, ?, ?, 'Rare', '', 'Unit')");
const addPreset = db.prepare("INSERT INTO break_board_preset_cards VALUES (?, ?, ?, 'old')");
const addSpot = db.prepare("INSERT INTO break_board_custom_spots VALUES (?, ?, ?, 'old')");
const addMapped = db.prepare("INSERT INTO break_board_custom_spot_cards VALUES (?, ?, ?, ?, ?, 'old')");
let id = 1;
for (let position = 1; position <= 33; position += 1) {
  const cardId = id++;
  const label = position === 33 ? 'Remaining Gear & Spells · Rare, Epic, AA' : `Vendetta Spot ${position}`;
  addCard.run(cardId, 'VEN', `VEN Card ${position}`, `VEN-${position}`);
  addPreset.run(1, position, cardId);
  addSpot.run(1, position, label);
  addMapped.run(1, position, cardId, 1, 'ANCHOR');
}
for (let position = 1; position <= 23; position += 1) {
  const cardId = id++;
  addCard.run(cardId, 'UNL', `Unleashed Card ${position}`, `UNL-${position}`);
  addPreset.run(3, position, cardId);
  addSpot.run(3, position, `Unleashed Spot ${position}`);
  addMapped.run(3, position, cardId, 1, 'ANCHOR');
}

const prepared = prepareCombinedBoardSeven(db);
assert.equal(prepared.ready, true, JSON.stringify(prepared));
assert.equal(prepared.spots.length, 56);
assert.equal(prepared.spots[0].label, '[VEN] Vendetta Spot 1');
assert.equal(prepared.spots[32].label, '[VEN] Remaining Gear & Spells · Rare, Epic, AA');
assert.equal(prepared.spots[33].label, '[UNL] Unleashed Spot 1');
assert.equal(prepared.spots[55].label, '[UNL] Unleashed Spot 23');

const seeded = ensureCombinedBoardSeven(db);
assert.equal(seeded.seeded, true);
assert.equal(seeded.positions, 56);
assert.equal(seeded.vendettaPositions, 33);
assert.equal(seeded.unleashedPositions, 23);
assert.equal(db.prepare('SELECT name FROM break_board_presets WHERE slot = 7').get().name, COMBINED_BOARD_SEVEN_NAME);
assert.equal(db.prepare('SELECT COUNT(*) AS count FROM break_board_preset_cards WHERE slot = 7').get().count, 56);
assert.equal(db.prepare('SELECT COUNT(*) AS count FROM break_board_custom_spots WHERE slot = 7').get().count, 56);
assert.equal(db.prepare('SELECT COUNT(*) AS count FROM break_board_cards').get().count, 56);
assert.equal(db.prepare('SELECT label FROM break_board_custom_spots WHERE slot = 7 AND position = 33').get().label,
  '[VEN] Remaining Gear & Spells · Rare, Epic, AA');
assert.equal(db.prepare('SELECT label FROM break_board_custom_spots WHERE slot = 7 AND position = 34').get().label,
  '[UNL] Unleashed Spot 1');
assert.ok(db.prepare('SELECT value FROM app_metadata WHERE key = ?').get(COMBINED_BOARD_SEVEN_MIGRATION_KEY));
assert.equal(ensureCombinedBoardSeven(db).reason, 'already-installed');

console.log('Combined Vendetta + Unleashed Board 7 migration checks passed.');
