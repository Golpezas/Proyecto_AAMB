const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { lookupOpenRiftPrinting } = require('./OpenRiftPrintingIndex');
const {
  UNLEASHED_TOP80_BOARD_MIGRATION_KEY,
  UNLEASHED_TOP80_BOARD_NAME,
  UNLEASHED_TOP80_SINGLES_MODE_MIGRATION_KEY,
  UNLEASHED_TOP80_SPOTS,
  buildUnleashedTop80Spot,
  collectorNumberKey,
  decorateUnleashedTop80Board,
  ensureUnleashedTop80BoardOne,
  isUnleashedTop80Board,
  spotLabel
} = require('./RiftboundUnleashedTop80');

function card(id, definition, overrides = {}) {
  return {
    id,
    game_code: 'RIFTBOUND',
    set_code: 'UNL',
    name: definition.name.replace(/ \([^)]*\)$/, ''),
    card_number: definition.cardNumber,
    rarity: definition.rarity,
    color: '',
    card_type: 'Unit',
    collector_treatment: definition.finish === 'Foil' ? 'Foil' : (definition.treatment === 'Signature' ? 'Signature' : ''),
    variant: definition.finish === 'Foil' ? 'Foil' : '',
    manual_category: '',
    image_url: `https://example.test/unleashed/${id}.webp`,
    ...overrides
  };
}

const anchors = UNLEASHED_TOP80_SPOTS.map((definition, index) => ({
  ...card(index + 1, definition),
  position: definition.position
}));

assert.equal(UNLEASHED_TOP80_SPOTS.length, 80);
assert.deepEqual(UNLEASHED_TOP80_SPOTS.map(definition => definition.position), Array.from({ length: 80 }, (_value, index) => index + 1));
assert.equal(UNLEASHED_TOP80_SPOTS.every((definition, index) => index === 0 || UNLEASHED_TOP80_SPOTS[index - 1].priceCents >= definition.priceCents), true);
assert.deepEqual(UNLEASHED_TOP80_SPOTS.filter(definition => !lookupOpenRiftPrinting(definition.cardNumber, 'UNL')), []);
assert.deepEqual(
  [UNLEASHED_TOP80_SPOTS[0].name, UNLEASHED_TOP80_SPOTS[0].priceCents, UNLEASHED_TOP80_SPOTS.at(-1).name, UNLEASHED_TOP80_SPOTS.at(-1).priceCents],
  ['Baron Nashor (Ultimate)', 174689, 'Vi - Hotheaded (Alternate Art)', 327]
);
assert.equal(collectorNumberKey('UNL-00234-STAR/219'), '234*');
assert.equal(collectorNumberKey('unl-120a/219'), '120A');
assert.equal(collectorNumberKey('UNL-R05b'), 'R05B');
assert.equal(isUnleashedTop80Board(anchors), true);
assert.equal(isUnleashedTop80Board([...anchors].reverse()), true);
assert.equal(isUnleashedTop80Board(anchors.slice(0, 79)), false);
assert.equal(isUnleashedTop80Board(anchors.map((entry, index) => ({ ...entry, position: index + 2 }))), false);

const decorated = decorateUnleashedTop80Board(anchors);
assert.equal(decorated.length, 80);
assert.equal(decorated[0].break_spot_label, 'Baron Nashor (Ultimate) · 238/219');
assert.equal(decorated[54].break_spot_label, 'Sprite Fountain (Foil) · 078/219');
assert.equal(decorated[74].break_spot_label, 'Sprite Fountain (Normal) · 078/219');
assert.equal(decorated[54].collectr_rank, 55);
assert.equal(decorated[54].collectr_snapshot_price_cents, 743);
assert.notEqual(decorated[54].id, decorated[74].id);
assert.equal(spotLabel(UNLEASHED_TOP80_SPOTS.at(-1)), 'Vi - Hotheaded (Alternate Art) · 030a/219');

const visual = buildUnleashedTop80Spot(anchors, anchors[0]);
assert.equal(visual.displayLabel, 'Baron Nashor (Ultimate) · 238/219');
assert.equal(visual.family.length, 1);
assert.equal(visual.family[0].id, 1);
assert.equal(visual.bundleGroups.length, 1);
assert.equal(visual.bundleGroups[0].role, 'direct');

function createPresetDatabase() {
  const database = new DatabaseSync(':memory:');
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE cards (
      id INTEGER PRIMARY KEY,
      game_code TEXT,
      set_code TEXT,
      name TEXT,
      card_number TEXT,
      rarity TEXT,
      color TEXT,
      card_type TEXT,
      collector_treatment TEXT,
      variant TEXT,
      manual_category TEXT,
      image_url TEXT
    );
    CREATE TABLE app_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE break_board_presets (slot INTEGER PRIMARY KEY, name TEXT NOT NULL, saved_at TEXT NOT NULL, mapping_mode TEXT NOT NULL DEFAULT 'MAPPED');
    CREATE TABLE break_board_preset_cards (
      slot INTEGER NOT NULL,
      position INTEGER NOT NULL,
      card_id INTEGER NOT NULL,
      added_at TEXT NOT NULL,
      PRIMARY KEY(slot, position),
      UNIQUE(slot, card_id)
    );
    CREATE TABLE break_board_cards (
      card_id INTEGER PRIMARY KEY,
      position INTEGER NOT NULL UNIQUE,
      added_at TEXT NOT NULL
    );
    CREATE TABLE active_break_board_cards (
      position INTEGER PRIMARY KEY,
      card_id INTEGER NOT NULL UNIQUE,
      saved_at TEXT NOT NULL
    );
  `);
  const insert = database.prepare(`
    INSERT INTO cards (
      id, game_code, set_code, name, card_number, rarity, color, card_type,
      collector_treatment, variant, manual_category, image_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  anchors.forEach(entry => insert.run(
    entry.id, entry.game_code, entry.set_code, entry.name, entry.card_number,
    entry.rarity, entry.color, entry.card_type, entry.collector_treatment,
    entry.variant, entry.manual_category, entry.image_url
  ));
  insert.run(999, 'ONEPIECE', 'OP-01', 'Old Board Card', 'OP01-001', 'Rare', 'Red', 'Leader', '', '', '', '');
  database.prepare('INSERT INTO app_metadata (key, value) VALUES (?, ?)').run('break-board-working-preset-slot-v1', '1');
  database.prepare('INSERT INTO app_metadata (key, value) VALUES (?, ?)').run('unleashed-color-board-1-v1', 'old-color-profile');
  database.prepare('INSERT INTO break_board_presets (slot, name, saved_at) VALUES (1, ?, ?)').run('Old Board 1', 'old');
  database.prepare('INSERT INTO break_board_preset_cards (slot, position, card_id, added_at) VALUES (1, 1, 999, ?)').run('old');
  database.prepare('INSERT INTO break_board_cards (card_id, position, added_at) VALUES (999, 1, ?)').run('old');
  database.prepare('INSERT INTO active_break_board_cards (position, card_id, saved_at) VALUES (1, 999, ?)').run('old');
  return database;
}

const database = createPresetDatabase();
const seeded = ensureUnleashedTop80BoardOne(database);
assert.equal(seeded.seeded, true);
assert.equal(seeded.slot, 1);
assert.equal(seeded.savedCards, 80);
assert.equal(seeded.loadedWorkingBoard, true);
assert.equal(database.prepare('SELECT name FROM break_board_presets WHERE slot = 1').get().name, UNLEASHED_TOP80_BOARD_NAME);
assert.equal(database.prepare('SELECT mapping_mode FROM break_board_presets WHERE slot = 1').get().mapping_mode, 'SINGLES');
assert.deepEqual(
  database.prepare('SELECT card_id FROM break_board_preset_cards WHERE slot = 1 ORDER BY position').all().map(row => row.card_id),
  Array.from({ length: 80 }, (_value, index) => index + 1)
);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM break_board_cards').get().count, 80);
assert.equal(database.prepare('SELECT card_id FROM active_break_board_cards WHERE position = 1').get().card_id, 999, 'the live ledger must stay untouched');
assert.equal(database.prepare("SELECT value FROM app_metadata WHERE key = 'break-board-game-v1'").get().value, 'RIFTBOUND');
assert.equal(database.prepare("SELECT value FROM app_metadata WHERE key = 'break-board-working-mapping-mode-v1'").get().value, 'SINGLES');
assert.ok(database.prepare('SELECT value FROM app_metadata WHERE key = ?').get(UNLEASHED_TOP80_BOARD_MIGRATION_KEY)?.value);
assert.ok(database.prepare('SELECT value FROM app_metadata WHERE key = ?').get(UNLEASHED_TOP80_SINGLES_MODE_MIGRATION_KEY)?.value);

database.prepare("UPDATE break_board_presets SET name = ?, mapping_mode = 'MAPPED' WHERE slot = 1").run('User Renamed Board');
const secondRun = ensureUnleashedTop80BoardOne(database);
assert.equal(secondRun.skipped, true);
assert.equal(database.prepare('SELECT name FROM break_board_presets WHERE slot = 1').get().name, 'User Renamed Board');
assert.equal(database.prepare('SELECT mapping_mode FROM break_board_presets WHERE slot = 1').get().mapping_mode, 'MAPPED', 'the one-time migration must preserve a later user choice');
database.close();

const upgradeDatabase = createPresetDatabase();
ensureUnleashedTop80BoardOne(upgradeDatabase);
upgradeDatabase.prepare('DELETE FROM app_metadata WHERE key = ?').run(UNLEASHED_TOP80_SINGLES_MODE_MIGRATION_KEY);
upgradeDatabase.prepare("UPDATE break_board_presets SET mapping_mode = 'MAPPED' WHERE slot = 1").run();
const upgraded = ensureUnleashedTop80BoardOne(upgradeDatabase);
assert.equal(upgraded.mappingModeUpdated, true);
assert.equal(upgradeDatabase.prepare('SELECT mapping_mode FROM break_board_presets WHERE slot = 1').get().mapping_mode, 'SINGLES');
upgradeDatabase.close();

const missingDatabase = createPresetDatabase();
missingDatabase.prepare('DELETE FROM cards WHERE id = ?').run(80);
const missingResult = ensureUnleashedTop80BoardOne(missingDatabase);
assert.equal(missingResult.reason, 'missing-catalog-cards');
assert.deepEqual(missingResult.missing, [{ position: 80, name: 'Vi - Hotheaded (Alternate Art)', cardNumber: 'UNL-030a/219' }]);
missingDatabase.close();

console.log('Unleashed Top 80 exact-card Board 1 preset tests passed.');
