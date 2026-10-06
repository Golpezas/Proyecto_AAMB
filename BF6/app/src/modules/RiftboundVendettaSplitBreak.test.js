'use strict';

const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { loadPresetCustomMapping } = require('./BreakBoardCustomMapping');
const {
  VENDETTA_SPLIT_BOARD_NAME,
  VENDETTA_SPLIT_MIGRATION_KEY,
  VENDETTA_SPLIT_SPOTS,
  cardBelongsToVendettaSplitSpot,
  collectorNumberKey,
  ensureVendettaSplitBoardNine,
  isVendettaSplitBreakBoard,
  isVendettaSplitCustomMapping,
  matchesVendettaSplitAnchor,
  prepareVendettaSplitBoard
} = require('./RiftboundVendettaSplitBreak');

assert.equal(VENDETTA_SPLIT_SPOTS.length, 16);
assert.deepEqual(VENDETTA_SPLIT_SPOTS.map(spot => spot.label), [
  'Akali',
  'Renekton + Rengar',
  'Zed + Gangplank',
  'Nasus + Vi',
  'Shen + Jinx',
  'Jayce + Viktor',
  'Mel + Illaoi',
  'Ambessa + Morgana',
  'Kennen + Leona',
  "Kai'Sa + Swain + Red Showcase Rune + Endless Riches + Rare Fury Cards",
  'Sona + Riven + Green Showcase Rune + Rare Calm Cards',
  'Astral Heron + Irelia + Helm of Suppression',
  'Ahri + Draven + Blue Showcase Rune + Bottled Constellation + Rare Mind Cards',
  "Sett + Kha'Zix + Orange Showcase Rune + Cataclysmic Duel + Corrupted Dragon + Rare Body Cards",
  'Ezreal + Diana + Purple Showcase Rune + Ocean Drake + Kharox + Rare Chaos Cards',
  'Lux + Kayle + Yellow Showcase Rune + Shady Spectacles + Rare Order Cards'
]);
assert.equal(collectorNumberKey('VEN-189*/166'), '189*');
assert.equal(collectorNumberKey('VND-SP2/006'), 'SP2');
assert.equal(matchesVendettaSplitAnchor(
  { set_code: 'VEN', card_number: 'VEN-044/166' },
  VENDETTA_SPLIT_SPOTS[11]
), true);
assert.equal(matchesVendettaSplitAnchor(
  { set_code: 'UNL', card_number: '044/166' },
  VENDETTA_SPLIT_SPOTS[11]
), false);

const database = new DatabaseSync(':memory:');
database.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE app_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE cards (
    id INTEGER PRIMARY KEY,
    game_code TEXT,
    set_code TEXT,
    set_name TEXT,
    name TEXT,
    card_number TEXT,
    rarity TEXT,
    source_rarity TEXT,
    collector_treatment TEXT,
    variant TEXT,
    manual_category TEXT,
    card_type TEXT,
    color TEXT,
    colors TEXT,
    domain TEXT,
    domains TEXT,
    card_traits TEXT,
    traits TEXT,
    champion TEXT,
    champion_name TEXT,
    details_json TEXT,
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
  CREATE TABLE break_board_custom_spots (
    slot INTEGER NOT NULL,
    position INTEGER NOT NULL,
    label TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(slot, position)
  );
  CREATE TABLE break_board_custom_spot_cards (
    slot INTEGER NOT NULL,
    position INTEGER NOT NULL,
    card_id INTEGER NOT NULL,
    sort_order INTEGER NOT NULL,
    addition_type TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(slot, position, card_id),
    UNIQUE(slot, card_id)
  );
`);

let nextId = 1;
let nextSyntheticNumber = 400;
const insertCard = database.prepare(`
  INSERT INTO cards (
    id, game_code, set_code, set_name, name, card_number, rarity, source_rarity,
    collector_treatment, variant, manual_category, card_type, color, image_url
  ) VALUES (?, 'RIFTBOUND', 'VEN', 'Vendetta', ?, ?, ?, ?, ?, ?, '', ?, ?, ?)
`);
function addCard(name, number, options = {}) {
  const id = nextId++;
  insertCard.run(
    id,
    name,
    number,
    options.rarity || 'Epic',
    options.rarity || 'Epic',
    options.treatment || '',
    options.treatment || '',
    options.cardType || 'Unit',
    options.color || '',
    `https://example.test/${id}.webp`
  );
  return id;
}

function fullNumber(number) {
  const key = collectorNumberKey(number);
  return key.startsWith('SP') ? `VEN-${key}/006` : `VEN-${key}/166`;
}

const anchorIds = new Map();
const rivalIds = new Map();
const extraIds = new Map();
const runeIds = new Map();
for (const spot of VENDETTA_SPLIT_SPOTS) {
  const anchorKey = collectorNumberKey(spot.anchorNumber);
  const anchorId = addCard(spot.anchorName, fullNumber(anchorKey), {
    rarity: anchorKey.startsWith('SP') ? 'Epic' : 'Rare',
    treatment: anchorKey.endsWith('*') ? 'Signature' : '',
    cardType: anchorKey.startsWith('SP') || anchorKey.endsWith('*') ? 'Legend' : 'Unit'
  });
  anchorIds.set(spot.position, anchorId);

  if (anchorKey.endsWith('*')) {
    addCard(spot.anchorName, fullNumber(anchorKey.slice(0, -1)), {
      rarity: 'Rare', treatment: 'Overnumbered', cardType: 'Legend'
    });
  }

  const rivalChampions = spot.mapping.kind === 'named'
    ? spot.mapping.champions
    : spot.mapping.champions.slice(1);
  for (const champion of rivalChampions) {
    const id = addCard(`${champion}, Rival`, fullNumber(String(nextSyntheticNumber++)), {
      rarity: 'Rare', treatment: 'Overnumbered', cardType: 'Champion Unit'
    });
    rivalIds.set(champion, id);
  }

  if (spot.mapping.kind === 'color') {
    const runeId = addCard(spot.mapping.rune, `VEN-R${spot.position}A/006`, {
      rarity: 'Showcase', treatment: 'Alternate Art', cardType: 'Rune', color: spot.mapping.domain
    });
    runeIds.set(spot.mapping.rune, runeId);
    for (const name of spot.mapping.extras) {
      const id = addCard(name, fullNumber(String(nextSyntheticNumber++)), { rarity: 'Epic', cardType: 'Spell' });
      extraIds.set(name, id);
    }
    addCard(`${spot.mapping.domain} Support`, fullNumber(String(nextSyntheticNumber++)), {
      rarity: 'Rare', cardType: 'Spell', color: spot.mapping.domain
    });
  }

  if (spot.mapping.kind === 'named') {
    for (const name of spot.mapping.extras.filter(name => name !== spot.anchorName)) {
      const id = addCard(name, fullNumber(String(nextSyntheticNumber++)), { rarity: 'Epic', cardType: 'Gear' });
      extraIds.set(name, id);
    }
  }
}

database.prepare('INSERT INTO cards (id, game_code, set_code, set_name, name, card_number, rarity) VALUES (?, ?, ?, ?, ?, ?, ?)')
  .run(900, 'RIFTBOUND', 'VEN', 'Vendetta', 'Existing Board 8 Card', 'VEN-001/166', 'Rare');
database.prepare('INSERT INTO cards (id, game_code, set_code, set_name, name, card_number, rarity) VALUES (?, ?, ?, ?, ?, ?, ?)')
  .run(999, 'RIFTBOUND', 'VEN', 'Vendetta', 'Old Board 9 Card', 'VEN-002/166', 'Rare');
database.prepare('INSERT INTO app_metadata (key, value) VALUES (?, ?)')
  .run('break-board-working-preset-slot-v1', '8');
database.prepare('INSERT INTO app_metadata (key, value) VALUES (?, ?)')
  .run('vendetta-board-9-35-split-spots-2026-09-15-v2', 'installed-by-an-older-release');
database.prepare("INSERT INTO break_board_presets (slot, name, saved_at, mapping_mode) VALUES (8, 'Keep Board 8', 'old', 'MAPPED')").run();
database.prepare("INSERT INTO break_board_presets (slot, name, saved_at, mapping_mode) VALUES (9, 'Replace Board 9', 'old', 'SINGLES')").run();
database.prepare("INSERT INTO break_board_preset_cards (slot, position, card_id, added_at) VALUES (8, 1, 900, 'old')").run();
database.prepare("INSERT INTO break_board_preset_cards (slot, position, card_id, added_at) VALUES (9, 1, 999, 'old')").run();
database.prepare("INSERT INTO break_board_cards (card_id, position, added_at) VALUES (900, 1, 'old')").run();

const catalog = database.prepare("SELECT * FROM cards WHERE set_code = 'VEN' AND game_code = 'RIFTBOUND' AND id < 900").all();
const prepared = prepareVendettaSplitBoard(catalog);
assert.equal(prepared.ready, true, JSON.stringify(prepared));
assert.equal(prepared.spots.length, 16);
assert.equal(new Set(prepared.spots.flatMap(spot => spot.cards.map(card => card.id))).size, prepared.mappedCards);
assert.equal(cardBelongsToVendettaSplitSpot(
  database.prepare('SELECT * FROM cards WHERE id = ?').get(rivalIds.get('Riven')),
  VENDETTA_SPLIT_SPOTS[10]
), true);
assert.equal(cardBelongsToVendettaSplitSpot(
  database.prepare('SELECT * FROM cards WHERE id = ?').get(rivalIds.get('Irelia')),
  VENDETTA_SPLIT_SPOTS[11]
), true);

const withoutIrelia = prepareVendettaSplitBoard(catalog.filter(card => card.id !== rivalIds.get('Irelia')));
assert.equal(withoutIrelia.ready, false);
assert.equal(withoutIrelia.reason, 'missing-mapped-cards');
assert.equal(withoutIrelia.missing.some(item => item.card === 'Irelia Rival ON'), true);

const seeded = ensureVendettaSplitBoardNine(database);
assert.equal(seeded.seeded, true);
assert.equal(seeded.savedCards, 16);
assert.equal(seeded.loadedWorkingBoard, false);
assert.equal(database.prepare('SELECT name FROM break_board_presets WHERE slot = 9').get().name, VENDETTA_SPLIT_BOARD_NAME);
assert.equal(database.prepare('SELECT mapping_mode FROM break_board_presets WHERE slot = 9').get().mapping_mode, 'MAPPED');
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM break_board_preset_cards WHERE slot = 9').get().count, 16);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM break_board_custom_spots WHERE slot = 9').get().count, 16);
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM break_board_custom_spot_cards WHERE slot = 9 AND addition_type = 'ANCHOR'").get().count, 16);
assert.equal(database.prepare('SELECT name FROM break_board_presets WHERE slot = 8').get().name, 'Keep Board 8');
assert.equal(database.prepare('SELECT card_id FROM break_board_cards WHERE position = 1').get().card_id, 900);

const board = database.prepare(`
  SELECT c.*, pc.position
  FROM break_board_preset_cards pc JOIN cards c ON c.id = pc.card_id
  WHERE pc.slot = 9 ORDER BY pc.position
`).all();
assert.equal(isVendettaSplitBreakBoard(board), true);

function ownerOf(cardId) {
  return database.prepare('SELECT position FROM break_board_custom_spot_cards WHERE slot = 9 AND card_id = ?').get(cardId)?.position;
}
assert.equal(ownerOf(rivalIds.get('Riven')), 11);
assert.equal(ownerOf(rivalIds.get('Irelia')), 12);
assert.equal(ownerOf(extraIds.get('Helm of Suppression')), 12);
assert.equal(ownerOf(rivalIds.get("Kha'Zix")), 14);
assert.equal(ownerOf(rivalIds.get('Diana')), 15);
assert.equal(ownerOf(rivalIds.get('Kayle')), 16);
assert.notEqual(ownerOf(rivalIds.get('Riven')), 8);
assert.equal(ownerOf(runeIds.get('Calm Rune')), 11);

const savedMapping = loadPresetCustomMapping(database, 9);
assert.equal(isVendettaSplitCustomMapping(savedMapping), true);
assert.deepEqual(savedMapping.spots.map(spot => spot.cards.filter(card => card.mappingAdditionType === 'ANCHOR').length), Array(16).fill(1));
assert.ok(database.prepare('SELECT value FROM app_metadata WHERE key = ?').get(VENDETTA_SPLIT_MIGRATION_KEY)?.value);
assert.equal(
  database.prepare("SELECT value FROM app_metadata WHERE key = 'vendetta-board-9-35-split-spots-2026-09-15-v2'").get().value,
  'installed-by-an-older-release'
);

database.prepare("UPDATE break_board_presets SET name = 'User Renamed Board 9' WHERE slot = 9").run();
const skipped = ensureVendettaSplitBoardNine(database);
assert.equal(skipped.reason, 'already-installed');
assert.equal(database.prepare('SELECT name FROM break_board_presets WHERE slot = 9').get().name, 'User Renamed Board 9');

database.close();
console.log('Vendetta 16-spot Board 9 combined mapping checks passed.');
