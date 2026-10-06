'use strict';

const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { riftboundCardSupplements } = require('./RiftboundCardSupplements');
const {
  VENDETTA_CHASE_SINGLES_MIGRATION_KEY,
  ensureVendettaChaseSinglesBoardTen,
  isVendettaChaseSinglesBoard
} = require('./RiftboundVendettaChaseSingles');

const database = new DatabaseSync(':memory:');
database.exec(`
  CREATE TABLE cards (
    id INTEGER PRIMARY KEY,
    game_code TEXT,
    set_code TEXT,
    name TEXT,
    card_number TEXT,
    rarity TEXT,
    variant TEXT,
    image_url TEXT,
    image_path TEXT
  );
  CREATE TABLE app_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE break_board_presets (
    slot INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    saved_at TEXT NOT NULL,
    mapping_mode TEXT NOT NULL
  );
  CREATE TABLE break_board_preset_cards (
    slot INTEGER NOT NULL,
    position INTEGER NOT NULL,
    card_id INTEGER NOT NULL,
    added_at TEXT NOT NULL,
    PRIMARY KEY(slot, position),
    UNIQUE(slot, card_id)
  );
  CREATE TABLE break_board_custom_spots (
    slot INTEGER NOT NULL,
    position INTEGER NOT NULL,
    label TEXT,
    updated_at TEXT,
    PRIMARY KEY(slot, position)
  );
  CREATE TABLE break_board_custom_spot_cards (
    slot INTEGER NOT NULL,
    position INTEGER NOT NULL,
    card_id INTEGER NOT NULL,
    sort_order INTEGER,
    addition_type TEXT,
    updated_at TEXT,
    PRIMARY KEY(slot, position, card_id)
  );
  CREATE TABLE break_board_cards (
    card_id INTEGER NOT NULL UNIQUE,
    position INTEGER NOT NULL PRIMARY KEY,
    added_at TEXT NOT NULL
  );
`);

const insertCard = database.prepare(`
  INSERT INTO cards
    (id, game_code, set_code, name, card_number, rarity, variant, image_url, image_path)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, '')
`);
const fallbackCards = riftboundCardSupplements().filter(card => card.set_code === 'VEN');
fallbackCards.forEach((card, index) => insertCard.run(
  index + 1,
  card.game_code,
  card.set_code,
  card.name,
  card.card_number,
  card.rarity,
  card.variant,
  card.image_url
));

assert.equal(fallbackCards.length, 106);
database.prepare('INSERT INTO app_metadata (key, value) VALUES (?, ?)')
  .run('break-board-working-preset-slot-v1', '10');
database.prepare('INSERT INTO app_metadata (key, value) VALUES (?, ?)')
  .run('vendetta-board-10-106-exact-chase-singles-2026-09-23-v1', 'blocked-release');

const result = ensureVendettaChaseSinglesBoardTen(database);
assert.equal(result.seeded, true);
assert.equal(result.savedCards, 106);
assert.equal(result.loadedWorkingBoard, true);
assert.equal(database.prepare('SELECT mapping_mode FROM break_board_presets WHERE slot = 10').get().mapping_mode, 'SINGLES');
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM break_board_preset_cards WHERE slot = 10').get().count, 106);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM break_board_cards').get().count, 106);

const installed = database.prepare(`
  SELECT cards.*, preset.position
  FROM break_board_preset_cards preset
  JOIN cards ON cards.id = preset.card_id
  WHERE preset.slot = 10
  ORDER BY preset.position
`).all();
assert.equal(isVendettaChaseSinglesBoard(installed), true);
assert.ok(database.prepare('SELECT value FROM app_metadata WHERE key = ?').get(VENDETTA_CHASE_SINGLES_MIGRATION_KEY)?.value);

database.close();
console.log('Vendetta Board 10 fallback catalog installation checks passed.');
