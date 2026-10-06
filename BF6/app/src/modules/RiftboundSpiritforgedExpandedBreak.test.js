'use strict';

const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const {
  SPIRITFORGED_EXPANDED_BOARD_NAME,
  SPIRITFORGED_EXPANDED_BOARD_SLOT,
  SPIRITFORGED_EXPANDED_MIGRATION_KEY,
  SPIRITFORGED_EXPANDED_PROFILE,
  SPIRITFORGED_EXPANDED_SPOTS,
  buildSpiritforgedExpandedBreakSpot,
  cardBelongsToSpiritforgedExpandedSpot,
  cardsForSpiritforgedExpandedSpot,
  collectorNumberKey,
  decorateSpiritforgedExpandedBreakBoard,
  ensureSpiritforgedExpandedBoardSix,
  isSpiritforgedExpandedBreakBoard,
  spotLabel,
  spiritforgedExpandedProfileForBoard
} = require('./RiftboundSpiritforgedExpandedBreak');

function card(id, name, number, overrides = {}) {
  return {
    id,
    game_code: 'RIFTBOUND',
    set_code: 'SFD',
    name,
    card_number: number,
    rarity: 'Rare',
    source_rarity: 'Rare',
    color: '',
    card_type: 'Unit',
    collector_treatment: '',
    variant: '',
    manual_category: '',
    card_traits: '',
    details_json: '',
    image_path: '',
    image_url: `https://example.test/sfd/${id}.webp`,
    ...overrides
  };
}

const anchors = SPIRITFORGED_EXPANDED_SPOTS.map((spot, index) => {
  const key = String(spot.anchorNumber);
  const number = `SFD-${key}${/^\d+\*?$/.test(key) ? '/221' : ''}`;
  let overrides = {};
  if (spot.kind === 'champion-sig') overrides = { rarity: 'Showcase', source_rarity: 'Showcase', card_type: 'Champion Unit', collector_treatment: 'Signature' };
  else if (spot.kind === 'champion-on' || spot.kind === 'champion-family') overrides = { rarity: 'Showcase', source_rarity: 'Showcase', card_type: 'Champion Unit', collector_treatment: 'Overnumbered' };
  else if (spot.kind === 'irelia-alt-epic') overrides = { rarity: 'Showcase', source_rarity: 'Showcase', card_type: 'Champion Unit', collector_treatment: 'Alternate Art' };
  else if (spot.kind === 'seal') overrides = { rarity: 'Showcase', source_rarity: 'Showcase', card_type: 'Gear', color: spot.domain, collector_treatment: 'Overnumbered' };
  else if (spot.kind === 'all-runes') overrides = { rarity: 'Showcase', source_rarity: 'Showcase', card_type: 'Rune', color: 'Fury', collector_treatment: 'Alternate Art', variant: 'Alternate Art' };
  else if (spot.kind === 'domain-pool') overrides = { rarity: 'Epic', source_rarity: 'Epic', card_type: 'Unit', color: spot.domain };
  return { ...card(index + 1, spot.anchor, number, overrides), position: spot.position };
});

assert.equal(SPIRITFORGED_EXPANDED_SPOTS.length, 50);
assert.equal(SPIRITFORGED_EXPANDED_SPOTS.filter(spot => spot.kind === 'champion-sig').length, 12);
assert.equal(SPIRITFORGED_EXPANDED_SPOTS.filter(spot => spot.kind === 'champion-on').length, 12);
assert.equal(SPIRITFORGED_EXPANDED_SPOTS.filter(spot => spot.kind === 'champion-family').length, 12);
assert.equal(SPIRITFORGED_EXPANDED_SPOTS.filter(spot => spot.kind === 'irelia-alt-epic').length, 1);
assert.equal(SPIRITFORGED_EXPANDED_SPOTS.filter(spot => spot.kind === 'seal').length, 6);
assert.equal(SPIRITFORGED_EXPANDED_SPOTS.filter(spot => spot.kind === 'all-runes').length, 1);
assert.equal(SPIRITFORGED_EXPANDED_SPOTS.filter(spot => spot.kind === 'domain-pool').length, 6);
assert.deepEqual(SPIRITFORGED_EXPANDED_SPOTS.map(spot => spot.position), Array.from({ length: 50 }, (_, i) => i + 1));
assert.equal(collectorNumberKey('SFD-00225-STAR/221'), '225*');
assert.equal(isSpiritforgedExpandedBreakBoard(anchors), true);
assert.equal(spiritforgedExpandedProfileForBoard(anchors), SPIRITFORGED_EXPANDED_PROFILE);
assert.equal(isSpiritforgedExpandedBreakBoard(anchors.slice(0, 49)), false);
assert.equal(spotLabel(SPIRITFORGED_EXPANDED_SPOTS[0]), '💎 Teemo · SIG SFD-230*/221');
assert.equal(spotLabel(SPIRITFORGED_EXPANDED_SPOTS[1]), '🔥 Teemo · ON SFD-230/221');
assert.equal(spotLabel(SPIRITFORGED_EXPANDED_SPOTS[18]), '💎 Irelia, Fervent · SIG SFD-225*/221');
assert.equal(spotLabel(SPIRITFORGED_EXPANDED_SPOTS[19]), '🔥 Irelia, Fervent · ON SFD-225/221');
assert.equal(spotLabel(SPIRITFORGED_EXPANDED_SPOTS[20]), '⭐ Irelia, Fervent · ALT SFD-057A/221 + EPIC SFD-057/221');
assert.equal(spotLabel(SPIRITFORGED_EXPANDED_SPOTS[43]), '💣 ALL RUNES · AA');
assert.equal(spotLabel(SPIRITFORGED_EXPANDED_SPOTS[48]), 'Chaos · Rare+ Gear / Spell / Unit');
assert.deepEqual(decorateSpiritforgedExpandedBreakBoard(anchors).map(entry => entry.break_spot_label), SPIRITFORGED_EXPANDED_SPOTS.map(spotLabel));

const extras = [
  card(100, 'Teemo, Tactical', 'SFD-010/221', { rarity: 'Common', source_rarity: 'Common', card_type: 'Champion Unit' }),
  card(101, 'Irelia, Fervent', 'SFD-057/221', { rarity: 'Epic', source_rarity: 'Epic', card_type: 'Champion Unit', color: 'Calm' }),
  card(103, 'Irelia, Graceful', 'SFD-141/221', { rarity: 'Rare', source_rarity: 'Rare', card_type: 'Champion Unit', color: 'Chaos' }),
  card(104, 'Premonition', 'SFD-087/221', { rarity: 'Epic', source_rarity: 'Epic', color: 'Mind', card_type: 'Spell' }),
  card(105, 'Last Rites', 'SFD-150/221', { rarity: 'Epic', source_rarity: 'Epic', color: 'Chaos', card_type: 'Spell' }),
  card(106, 'Switcheroo', 'SFD-145/221', { rarity: 'Rare', source_rarity: 'Rare', color: 'Chaos', card_type: 'Spell' }),
  card(107, 'Fizz, Trickster', 'SFD-140/221', { rarity: 'Rare', source_rarity: 'Rare', color: 'Chaos', card_type: 'Champion Unit' }),
  card(108, 'Chaos Rune', 'SFD-R05A', { rarity: 'Showcase', source_rarity: 'Showcase', color: 'Chaos', card_type: 'Rune', collector_treatment: 'Alternate Art' }),
  card(109, 'Order Rune', 'SFD-R06A', { rarity: 'Showcase', source_rarity: 'Showcase', color: 'Order', card_type: 'Rune', collector_treatment: 'Alternate Art' }),
  card(110, 'Mind Rune', 'SFD-R03/221', { rarity: 'Common', source_rarity: 'Common', color: 'Mind', card_type: 'Rune' })
];
const catalog = [...anchors, ...extras];

const teemoSig = SPIRITFORGED_EXPANDED_SPOTS[0];
const teemoOn = SPIRITFORGED_EXPANDED_SPOTS[1];
assert.equal(cardsForSpiritforgedExpandedSpot(catalog, teemoSig).some(entry => entry.id === 100), false, 'Teemo SIG lane stays exact');
assert.equal(cardsForSpiritforgedExpandedSpot(catalog, teemoOn).some(entry => entry.id === 100), true, 'Teemo base family stays with the ON lane');

const ireliaSig = SPIRITFORGED_EXPANDED_SPOTS[18];
const ireliaOn = SPIRITFORGED_EXPANDED_SPOTS[19];
const ireliaAltEpic = SPIRITFORGED_EXPANDED_SPOTS[20];
assert.deepEqual(cardsForSpiritforgedExpandedSpot(catalog, ireliaSig).map(entry => collectorNumberKey(entry.card_number)), ['225*']);
assert.deepEqual(cardsForSpiritforgedExpandedSpot(catalog, ireliaOn).map(entry => collectorNumberKey(entry.card_number)), ['225']);
assert.deepEqual(cardsForSpiritforgedExpandedSpot(catalog, ireliaAltEpic).map(entry => collectorNumberKey(entry.card_number)).sort(), ['57', '57A']);

const runes = SPIRITFORGED_EXPANDED_SPOTS[43];
assert.equal(cardsForSpiritforgedExpandedSpot(catalog, runes).some(entry => entry.id === 108), true);
assert.equal(cardsForSpiritforgedExpandedSpot(catalog, runes).some(entry => entry.id === 109), true);
assert.equal(cardsForSpiritforgedExpandedSpot(catalog, runes).some(entry => entry.id === 110), false, 'base common runes stay out');

const mindPool = SPIRITFORGED_EXPANDED_SPOTS[46];
const chaosPool = SPIRITFORGED_EXPANDED_SPOTS[48];
assert.equal(cardsForSpiritforgedExpandedSpot(catalog, mindPool).some(entry => entry.id === 104), true, 'Premonition joins Mind');
assert.equal(cardsForSpiritforgedExpandedSpot(catalog, chaosPool).some(entry => entry.id === 105), true, 'Last Rites joins Chaos');
assert.equal(cardsForSpiritforgedExpandedSpot(catalog, chaosPool).some(entry => entry.id === 106), true, 'Switcheroo joins Chaos');
assert.equal(cardsForSpiritforgedExpandedSpot(catalog, chaosPool).some(entry => entry.id === 107), false, 'champion units are excluded from color pools');

for (const entry of anchors) {
  const owners = SPIRITFORGED_EXPANDED_SPOTS.filter(spot => cardBelongsToSpiritforgedExpandedSpot(entry, spot));
  assert.equal(owners.length, 1, `${entry.card_number} ${entry.name} should have exactly one owner`);
}

function createDatabase() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE cards (id INTEGER PRIMARY KEY, game_code TEXT, set_code TEXT, name TEXT, card_number TEXT, rarity TEXT, source_rarity TEXT, color TEXT, card_type TEXT, collector_treatment TEXT, variant TEXT, manual_category TEXT, card_traits TEXT, details_json TEXT, image_path TEXT, image_url TEXT);
    CREATE TABLE app_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE break_board_presets (slot INTEGER PRIMARY KEY CHECK(slot BETWEEN 1 AND 10), name TEXT NOT NULL, saved_at TEXT NOT NULL, mapping_mode TEXT NOT NULL DEFAULT 'MAPPED');
    CREATE TABLE break_board_preset_cards (slot INTEGER NOT NULL, position INTEGER NOT NULL, card_id INTEGER NOT NULL, added_at TEXT NOT NULL, PRIMARY KEY(slot, position), UNIQUE(slot, card_id), FOREIGN KEY(slot) REFERENCES break_board_presets(slot) ON DELETE CASCADE, FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE CASCADE);
    CREATE TABLE break_board_cards (card_id INTEGER PRIMARY KEY, position INTEGER NOT NULL UNIQUE, added_at TEXT NOT NULL);
    CREATE TABLE active_break_board_cards (position INTEGER PRIMARY KEY, card_id INTEGER NOT NULL UNIQUE, saved_at TEXT NOT NULL);
    CREATE TABLE break_board_custom_spots (slot INTEGER NOT NULL, position INTEGER NOT NULL, label TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(slot, position), FOREIGN KEY(slot) REFERENCES break_board_presets(slot) ON DELETE CASCADE);
    CREATE TABLE break_board_custom_spot_cards (slot INTEGER NOT NULL, position INTEGER NOT NULL, card_id INTEGER NOT NULL, sort_order INTEGER NOT NULL, addition_type TEXT NOT NULL DEFAULT 'SEQUENCE', updated_at TEXT NOT NULL, PRIMARY KEY(slot, position, card_id), UNIQUE(slot, card_id), FOREIGN KEY(slot,position) REFERENCES break_board_custom_spots(slot,position) ON DELETE CASCADE, FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE CASCADE);
  `);
  const ins = db.prepare('INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  anchors.forEach(c => ins.run(c.id,c.game_code,c.set_code,c.name,c.card_number,c.rarity,c.source_rarity,c.color,c.card_type,c.collector_treatment,c.variant,c.manual_category,c.card_traits,c.details_json,c.image_path,c.image_url));
  db.prepare("INSERT INTO break_board_presets VALUES (6, 'Old Board 6', 'old', 'MAPPED')").run();
  db.prepare("INSERT INTO break_board_custom_spots VALUES (6, 1, 'Old custom map', 'old')").run();
  db.prepare("INSERT INTO app_metadata VALUES ('break-board-working-preset-slot-v1', '1')").run();
  return db;
}

const db = createDatabase();
const seeded = ensureSpiritforgedExpandedBoardSix(db);
assert.equal(seeded.seeded, true);
assert.equal(seeded.slot, SPIRITFORGED_EXPANDED_BOARD_SLOT);
assert.equal(seeded.savedCards, 50);
assert.equal(db.prepare('SELECT name FROM break_board_presets WHERE slot = 6').get().name, SPIRITFORGED_EXPANDED_BOARD_NAME);
assert.equal(db.prepare('SELECT COUNT(*) AS c FROM break_board_preset_cards WHERE slot = 6').get().c, 50);
assert.equal(db.prepare('SELECT COUNT(*) AS c FROM break_board_custom_spots WHERE slot = 6').get().c, 0, 'stale 38/39-spot custom map is cleared');
assert.ok(db.prepare('SELECT value FROM app_metadata WHERE key = ?').get(SPIRITFORGED_EXPANDED_MIGRATION_KEY)?.value);
assert.equal(ensureSpiritforgedExpandedBoardSix(db).reason, 'already-installed');

console.log('Spiritforged 50-spot Board 6 split-chase mapping and migration tests passed.');
