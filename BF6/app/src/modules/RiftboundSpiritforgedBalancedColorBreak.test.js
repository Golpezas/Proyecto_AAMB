'use strict';

const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const {
  SPIRITFORGED_BALANCED_COLOR_LANES,
  ensureSpiritforgedBalancedColorBoardTen,
  lanePositionForCard,
  prepareSpiritforgedBalancedColorBoard
} = require('./RiftboundSpiritforgedBalancedColorBreak');

const premiumNames = new Map([
  ['222', 'Seal of Rage'], ['223', 'Vayne, Hunter'], ['223*', 'Vayne, Hunter'],
  ['224', 'Aphelios, Exalted'], ['224*', 'Aphelios, Exalted'],
  ['225', 'Irelia, Fervent'], ['225*', 'Irelia, Fervent'],
  ['226', 'Seal of Focus'], ['227', 'Ahri, Inquisitive'], ['227*', 'Ahri, Inquisitive'],
  ['228', 'Bard, Mercurial'], ['228*', 'Bard, Mercurial'], ['229', 'Seal of Insight'],
  ['230', 'Teemo, Strategist'], ['230*', 'Teemo, Strategist'], ['231', 'Seal of Strength'],
  ['232', 'Sett, Brawler'], ['232*', 'Sett, Brawler'], ['233', 'Yone, Blademaster'],
  ['233*', 'Yone, Blademaster'], ['234', 'Seal of Discord'], ['235', 'Yasuo, Windrider'],
  ['235*', 'Yasuo, Windrider'], ['236', 'Darius, Executioner'], ['236*', 'Darius, Executioner'],
  ['237', 'Karma, Channeler'], ['237*', 'Karma, Channeler'], ['238', 'Seal of Unity'],
  ['239', 'Soraka, Wanderer'], ['239*', 'Soraka, Wanderer'], ['240', 'Mechanized Menace'],
  ['241', 'Purifier'], ['242', 'Glorious Executioner'], ['243', 'Void Burrower'],
  ['244', 'Fire Below the Mountain'], ['245', 'Grandmaster at Arms'], ['246', 'Blade Dancer'],
  ['247', 'Emperor of the Sands'], ['248', 'Prodigal Explorer'], ['249', 'Chem-Baroness'],
  ['250', 'Battle Mistress'], ['251', 'Grand Duelist']
]);

let nextId = 1;
const premiumCards = [...premiumNames].map(([number, name]) => ({
  id: nextId++,
  game_code: 'RIFTBOUND',
  set_code: 'SFD',
  name,
  card_number: `SFD-${number}`,
  collector_treatment: number.endsWith('*') ? 'SIGNATURE' : 'OVERNUMBERED',
  rarity: 'RARE',
  image_url: `https://example.test/${number}.png`
}));
const regularCards = [
  { id: nextId++, game_code: 'RIFTBOUND', set_code: 'SFD', name: 'Fury Common', card_number: 'SFD-1', domain: 'Fury', rarity: 'COMMON' },
  { id: nextId++, game_code: 'RIFTBOUND', set_code: 'SFD', name: 'Calm Rune', card_number: 'SFD-R02A', domain: 'Calm' },
  { id: nextId++, game_code: 'RIFTBOUND', set_code: 'SFD', name: 'Mind Rare', card_number: 'SFD-70', domain: 'Mind' },
  { id: nextId++, game_code: 'RIFTBOUND', set_code: 'SFD', name: 'Body Epic', card_number: 'SFD-110', domain: 'Body' },
  { id: nextId++, game_code: 'RIFTBOUND', set_code: 'SFD', name: 'Chaos Card', card_number: 'SFD-140', domain: 'Chaos' },
  { id: nextId++, game_code: 'RIFTBOUND', set_code: 'SFD', name: 'Order Card', card_number: 'SFD-170', domain: 'Order' },
  { id: nextId++, game_code: 'RIFTBOUND', set_code: 'SFD', name: 'Dual Legend', card_number: 'SFD-181', domains: 'Fury, Chaos' },
  { id: nextId++, game_code: 'RIFTBOUND', set_code: 'SFD', name: 'Colorless Battlefield', card_number: 'SFD-210' }
];
const catalog = [...premiumCards, ...regularCards];

assert.equal(SPIRITFORGED_BALANCED_COLOR_LANES.length, 7);
assert.deepEqual(SPIRITFORGED_BALANCED_COLOR_LANES.map(spot => spot.premiumNumbers.length), [3, 5, 7, 5, 3, 7, 12]);
assert.equal(new Set(SPIRITFORGED_BALANCED_COLOR_LANES.flatMap(spot => spot.premiumNumbers)).size, 42);
assert.deepEqual(regularCards.map(lanePositionForCard), [1, 2, 3, 4, 5, 6, 7, 7]);

const prepared = prepareSpiritforgedBalancedColorBoard(catalog);
assert.equal(prepared.ready, true);
assert.equal(prepared.spots.length, 7);
assert.equal(prepared.mappedCards, catalog.length - 1);
assert.deepEqual(prepared.spots.map(spot => spot.cards[0].card_number), [
  'SFD-223*', 'SFD-225*', 'SFD-227*', 'SFD-232*', 'SFD-235*', 'SFD-239*', 'SFD-246'
]);

const database = new DatabaseSync(':memory:');
database.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE cards (
    id INTEGER PRIMARY KEY, game_code TEXT, set_code TEXT, name TEXT, card_number TEXT,
    collector_treatment TEXT, rarity TEXT, image_url TEXT, image_path TEXT,
    color TEXT, colors TEXT, domain TEXT, domains TEXT, details_json TEXT
  );
  CREATE TABLE app_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE break_board_presets (
    slot INTEGER PRIMARY KEY, name TEXT NOT NULL, saved_at TEXT NOT NULL,
    mapping_mode TEXT NOT NULL
  );
  CREATE TABLE break_board_preset_cards (
    slot INTEGER NOT NULL, position INTEGER NOT NULL, card_id INTEGER NOT NULL, added_at TEXT NOT NULL,
    PRIMARY KEY(slot, position), UNIQUE(slot, card_id)
  );
  CREATE TABLE break_board_custom_spots (
    slot INTEGER NOT NULL, position INTEGER NOT NULL, label TEXT NOT NULL, updated_at TEXT NOT NULL,
    PRIMARY KEY(slot, position)
  );
  CREATE TABLE break_board_custom_spot_cards (
    slot INTEGER NOT NULL, position INTEGER NOT NULL, card_id INTEGER NOT NULL, sort_order INTEGER NOT NULL,
    addition_type TEXT NOT NULL, updated_at TEXT NOT NULL,
    PRIMARY KEY(slot, position, card_id), UNIQUE(slot, card_id)
  );
  CREATE TABLE break_board_cards (
    card_id INTEGER NOT NULL, position INTEGER NOT NULL, added_at TEXT NOT NULL,
    PRIMARY KEY(position), UNIQUE(card_id)
  );
`);
const insert = database.prepare(`
  INSERT INTO cards
    (id, game_code, set_code, name, card_number, collector_treatment, rarity, image_url,
     image_path, color, colors, domain, domains, details_json)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
for (const card of catalog) insert.run(
  card.id, card.game_code, card.set_code, card.name, card.card_number,
  card.collector_treatment || '', card.rarity || '', card.image_url || '', '',
  card.color || '', card.colors || '', card.domain || '', card.domains || '', ''
);

const seeded = ensureSpiritforgedBalancedColorBoardTen(database);
assert.equal(seeded.seeded, true);
assert.equal(seeded.slot, 10);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM break_board_preset_cards WHERE slot = 10').get().count, 7);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM break_board_custom_spot_cards WHERE slot = 10').get().count, catalog.length - 1);
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM break_board_custom_spot_cards WHERE slot = 10 AND addition_type = 'ANCHOR'").get().count, 7);
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM break_board_custom_spot_cards WHERE slot = 10 AND addition_type = 'PLUS'").get().count, 0);
assert.equal(ensureSpiritforgedBalancedColorBoardTen(database).reason, 'already-installed');

assert.equal(database.prepare(`
  SELECT COUNT(*) AS count
  FROM break_board_custom_spot_cards mapped
  JOIN cards ON cards.id = mapped.card_id
  WHERE mapped.slot = 10 AND LOWER(cards.rarity) IN ('common', 'uncommon', 'c', 'uc')
`).get().count, 0);
console.log('Spiritforged Board 10 pure seven-color mapping checks passed.');
