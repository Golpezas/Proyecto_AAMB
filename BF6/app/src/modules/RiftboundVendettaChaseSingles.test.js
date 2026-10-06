'use strict';

const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const {
  VENDETTA_BOARD_TEN_EPIC_SYMBOL,
  VENDETTA_BOARD_TEN_POPUP_EFFECTS,
  VENDETTA_BOARD_TEN_RARE_SYMBOL,
  VENDETTA_BOARD_TEN_SP_SYMBOL,
  VENDETTA_CHASE_SINGLES_BOARD_NAME,
  VENDETTA_CHASE_SINGLES_MIGRATION_KEY,
  VENDETTA_CHASE_SINGLES_SPOTS,
  collectorNumberKey,
  decorateVendettaBoardTenListing,
  ensureVendettaChaseSinglesBoardTen,
  isVendettaChaseSinglesBoard,
  prepareVendettaChaseSinglesBoard,
  vendettaBoardTenPopupLabel,
  vendettaChaseCategory
} = require('./RiftboundVendettaChaseSingles');
const { formatBreakBoardListing } = require('./BreakBoard');
const { decorateRiftboundSinglesBoard } = require('./BreakBoardMappingMode');

assert.equal(VENDETTA_CHASE_SINGLES_SPOTS.length, 106);
assert.deepEqual(
  Object.fromEntries(['SIG', 'ON', 'AA', 'EPIC', 'SP', 'ASTRAL'].map(category => [
    category,
    VENDETTA_CHASE_SINGLES_SPOTS.filter(spot => spot.category === category).length
  ])),
  { SIG: 9, ON: 31, AA: 33, EPIC: 26, SP: 6, ASTRAL: 1 }
);
assert.equal(new Set(VENDETTA_CHASE_SINGLES_SPOTS.map(spot => collectorNumberKey(spot.collectorNumber))).size, 106);
assert.equal(VENDETTA_CHASE_SINGLES_SPOTS.at(-1).collectorNumber, '044');

function cardForSpot(spot, id) {
  const suffix = spot.collectorNumber.startsWith('SP') ? '/006' : '/166';
  const number = `VEN-${spot.collectorNumber}${suffix}`;
  const metadata = {
    SIG: { rarity: 'Rare', treatment: 'Signature' },
    ON: { rarity: 'Showcase', treatment: 'Overnumbered' },
    AA: { rarity: id % 2 ? 'Rare' : 'Epic', treatment: 'Alternate Art' },
    EPIC: { rarity: 'Epic', treatment: '' },
    SP: { rarity: 'Showcase', treatment: '' },
    ASTRAL: { rarity: 'Epic', treatment: '' }
  }[spot.category];
  return {
    id,
    game_code: 'RIFTBOUND',
    set_code: 'VEN',
    name: spot.category === 'ASTRAL' ? 'Astral Heron' : `${spot.category} Card ${spot.collectorNumber}`,
    card_number: number,
    rarity: metadata.rarity,
    collector_treatment: metadata.treatment,
    image_url: `https://example.test/${id}.webp`
  };
}

const eligibleCards = VENDETTA_CHASE_SINGLES_SPOTS.map((spot, index) => cardForSpot(spot, index + 1));
const standardRare = {
  id: 500,
  game_code: 'RIFTBOUND',
  set_code: 'VEN',
  name: 'Standard Rare Must Stay Out',
  card_number: 'VEN-015/166',
  rarity: 'Rare',
  collector_treatment: ''
};
const catalog = [...eligibleCards, standardRare];

const prepared = prepareVendettaChaseSinglesBoard(catalog);
assert.equal(prepared.ready, true, JSON.stringify(prepared));
assert.equal(prepared.anchors.length, 106);
assert.equal(prepared.anchors.some(card => card.id === standardRare.id), false);
assert.equal(vendettaChaseCategory(standardRare), '');
assert.equal(vendettaChaseCategory(eligibleCards.find(card => card.name === 'Astral Heron')), 'ASTRAL');
assert.equal(vendettaBoardTenPopupLabel(eligibleCards.find(card => vendettaChaseCategory(card) === 'SIG')), 'SIG');
assert.equal(vendettaBoardTenPopupLabel(eligibleCards.find(card => vendettaChaseCategory(card) === 'ON')), 'OVERNUMBERED');
assert.equal(vendettaBoardTenPopupLabel(eligibleCards.find(card => vendettaChaseCategory(card) === 'AA')), 'ALTERNATE ART');
assert.equal(vendettaBoardTenPopupLabel(eligibleCards.find(card => vendettaChaseCategory(card) === 'EPIC')), 'EPIC');
assert.equal(vendettaBoardTenPopupLabel(eligibleCards.find(card => vendettaChaseCategory(card) === 'SP')), 'SP');
assert.equal(vendettaBoardTenPopupLabel(eligibleCards.find(card => vendettaChaseCategory(card) === 'ASTRAL')), 'EPIC');
assert.equal(vendettaBoardTenPopupLabel(standardRare), 'RARE');

const epicCard = eligibleCards.find(card => vendettaChaseCategory(card) === 'EPIC');
const astralHeron = eligibleCards.find(card => vendettaChaseCategory(card) === 'ASTRAL');
const spCard = eligibleCards.find(card => vendettaChaseCategory(card) === 'SP');
const alternateArtCard = eligibleCards.find(card => vendettaChaseCategory(card) === 'AA');
const boardTenListingCards = decorateVendettaBoardTenListing(decorateRiftboundSinglesBoard([
  { ...epicCard, position: 1 },
  { ...astralHeron, position: 2 },
  { ...spCard, position: 3 },
  { ...alternateArtCard, position: 4 },
  { ...standardRare, position: 5 }
]));
assert.equal(boardTenListingCards[0].break_listing_symbol, VENDETTA_BOARD_TEN_EPIC_SYMBOL);
assert.match(boardTenListingCards[0].break_spot_label, / · Epic$/);
assert.equal(boardTenListingCards[0].break_popup_label, 'EPIC');
assert.equal(boardTenListingCards[0].break_popup_effect_group, VENDETTA_BOARD_TEN_POPUP_EFFECTS.EPIC);
assert.equal(boardTenListingCards[1].break_listing_symbol, VENDETTA_BOARD_TEN_EPIC_SYMBOL);
assert.equal(boardTenListingCards[1].break_spot_label, 'Astral Heron · VEN-044/166 · Epic');
assert.equal(boardTenListingCards[2].break_listing_symbol, VENDETTA_BOARD_TEN_SP_SYMBOL);
assert.equal(boardTenListingCards[2].break_listing_symbol_suppressed, false);
assert.equal(boardTenListingCards[2].break_popup_label, 'SP');
assert.equal(boardTenListingCards[2].break_popup_effect_group, VENDETTA_BOARD_TEN_POPUP_EFFECTS.SP);
assert.doesNotMatch(boardTenListingCards[2].break_spot_label, / · SP$/);
assert.equal(boardTenListingCards[3].break_listing_symbol, undefined, 'Alternate Art keeps its existing bomb treatment');
assert.equal(boardTenListingCards[3].break_popup_label, 'ALTERNATE ART');
assert.equal(boardTenListingCards[4].break_listing_symbol, VENDETTA_BOARD_TEN_RARE_SYMBOL);
assert.match(boardTenListingCards[4].break_spot_label, / · Rare$/);
assert.equal(boardTenListingCards[4].break_popup_effect_group, VENDETTA_BOARD_TEN_POPUP_EFFECTS.RARE);
assert.deepEqual(
  formatBreakBoardListing(boardTenListingCards).split('\n').map(line => line.split('\t')[0]),
  [
    `1 — ${VENDETTA_BOARD_TEN_EPIC_SYMBOL} ${epicCard.name} · ${epicCard.card_number} · Epic ${VENDETTA_BOARD_TEN_EPIC_SYMBOL}`,
    `2 — ${VENDETTA_BOARD_TEN_EPIC_SYMBOL} Astral Heron · VEN-044/166 · Epic ${VENDETTA_BOARD_TEN_EPIC_SYMBOL}`,
    `3 — ${VENDETTA_BOARD_TEN_SP_SYMBOL} ${spCard.name} · ${spCard.card_number} ${VENDETTA_BOARD_TEN_SP_SYMBOL}`,
    `4 — 💣 ${alternateArtCard.name} · ${alternateArtCard.card_number} · Alternate Art 💣`,
    `5 — ${VENDETTA_BOARD_TEN_RARE_SYMBOL} Standard Rare Must Stay Out · VEN-015/166 · Rare ${VENDETTA_BOARD_TEN_RARE_SYMBOL}`
  ]
);
assert.equal(
  decorateVendettaBoardTenListing(boardTenListingCards)[0].break_spot_label,
  boardTenListingCards[0].break_spot_label,
  'Board 10 rarity decoration must be idempotent.'
);

const missingOne = prepareVendettaChaseSinglesBoard(catalog.filter(card => card.id !== 1));
assert.equal(missingOne.ready, false);
assert.equal(missingOne.reason, 'missing-exact-cards');
assert.equal(missingOne.missing.length, 1);

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
    collector_treatment TEXT,
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
  CREATE TABLE break_board_cards (
    card_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    added_at TEXT NOT NULL,
    PRIMARY KEY(position),
    UNIQUE(card_id)
  );
`);

const insertCard = database.prepare(`
  INSERT INTO cards
    (id, game_code, set_code, name, card_number, rarity, collector_treatment, image_url, image_path)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, '')
`);
for (const card of catalog) insertCard.run(
  card.id,
  card.game_code,
  card.set_code,
  card.name,
  card.card_number,
  card.rarity,
  card.collector_treatment,
  card.image_url || ''
);
insertCard.run(900, 'RIFTBOUND', 'UNL', 'Keep Board 9 Card', 'UNL-001/219', 'Common', '', '');
insertCard.run(999, 'RIFTBOUND', 'SFD', 'Old Board 10 Card', 'SFD-001/221', 'Common', '', '');
database.prepare('INSERT INTO app_metadata (key, value) VALUES (?, ?)').run('break-board-working-preset-slot-v1', '9');
database.prepare('INSERT INTO app_metadata (key, value) VALUES (?, ?)').run('spiritforged-board-10-pure-color-v3', 'older-release');
database.prepare('INSERT INTO app_metadata (key, value) VALUES (?, ?)').run('vendetta-board-10-106-exact-chase-singles-2026-09-23-v1', 'blocked-release');
database.prepare("INSERT INTO break_board_presets (slot, name, saved_at, mapping_mode) VALUES (9, 'Keep Board 9', 'old', 'MAPPED')").run();
database.prepare("INSERT INTO break_board_presets (slot, name, saved_at, mapping_mode) VALUES (10, 'Replace Board 10', 'old', 'MAPPED')").run();
database.prepare("INSERT INTO break_board_preset_cards (slot, position, card_id, added_at) VALUES (9, 1, 900, 'old')").run();
database.prepare("INSERT INTO break_board_preset_cards (slot, position, card_id, added_at) VALUES (10, 1, 999, 'old')").run();
database.prepare("INSERT INTO break_board_custom_spots (slot, position, label, updated_at) VALUES (10, 1, 'Old bundle', 'old')").run();
database.prepare("INSERT INTO break_board_custom_spot_cards (slot, position, card_id, sort_order, addition_type, updated_at) VALUES (10, 1, 999, 1, 'ANCHOR', 'old')").run();
database.prepare("INSERT INTO break_board_cards (card_id, position, added_at) VALUES (900, 1, 'old')").run();

const seeded = ensureVendettaChaseSinglesBoardTen(database);
assert.equal(seeded.seeded, true);
assert.equal(seeded.savedCards, 106);
assert.deepEqual(seeded.categoryCounts, { SIG: 9, ON: 31, AA: 33, EPIC: 26, SP: 6, ASTRAL: 1 });
assert.equal(seeded.mappingMode, 'SINGLES');
assert.equal(seeded.loadedWorkingBoard, false);
assert.equal(database.prepare('SELECT name FROM break_board_presets WHERE slot = 10').get().name, VENDETTA_CHASE_SINGLES_BOARD_NAME);
assert.equal(database.prepare('SELECT mapping_mode FROM break_board_presets WHERE slot = 10').get().mapping_mode, 'SINGLES');
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM break_board_preset_cards WHERE slot = 10').get().count, 106);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM break_board_custom_spots WHERE slot = 10').get().count, 0);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM break_board_custom_spot_cards WHERE slot = 10').get().count, 0);
assert.equal(database.prepare('SELECT name FROM break_board_presets WHERE slot = 9').get().name, 'Keep Board 9');
assert.equal(database.prepare('SELECT card_id FROM break_board_cards WHERE position = 1').get().card_id, 900);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM break_board_preset_cards WHERE slot = 10 AND card_id = 500').get().count, 0);

const board = database.prepare(`
  SELECT cards.*, preset.position
  FROM break_board_preset_cards preset
  JOIN cards ON cards.id = preset.card_id
  WHERE preset.slot = 10
  ORDER BY preset.position
`).all();
assert.equal(isVendettaChaseSinglesBoard(board), true);
assert.equal(database.prepare('SELECT value FROM app_metadata WHERE key = ?').get(VENDETTA_CHASE_SINGLES_MIGRATION_KEY)?.value.length > 0, true);
assert.equal(database.prepare("SELECT value FROM app_metadata WHERE key = 'spiritforged-board-10-pure-color-v3'").get().value, 'older-release');
assert.equal(ensureVendettaChaseSinglesBoardTen(database).reason, 'already-installed');

database.close();
console.log('Vendetta Board 10 exact 106-card chase Singles checks passed.');
