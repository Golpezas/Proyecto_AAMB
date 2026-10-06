'use strict';

const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const {
  clearPresetCustomMapping,
  customMappingCardPresentation,
  customMappingSpotDisplayLabel,
  customMappingSignature,
  ensureBreakBoardCustomMappingSchema,
  loadPresetCustomMapping,
  loadRoundCustomMapping,
  savePresetCustomMapping,
  snapshotPresetCustomMapping
} = require('./BreakBoardCustomMapping');

function createDatabase() {
  const database = new DatabaseSync(':memory:');
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE cards (
      id INTEGER PRIMARY KEY,
      game_code TEXT NOT NULL,
      name TEXT NOT NULL,
      card_number TEXT,
      set_code TEXT,
      rarity TEXT,
      source_rarity TEXT,
      variant TEXT,
      manual_category TEXT
    );
    CREATE TABLE break_board_presets (
      slot INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      mapping_mode TEXT NOT NULL
    );
    CREATE TABLE break_board_preset_cards (
      slot INTEGER NOT NULL,
      position INTEGER NOT NULL,
      card_id INTEGER NOT NULL,
      PRIMARY KEY(slot, position)
    );
    CREATE TABLE break_rounds (id INTEGER PRIMARY KEY);
  `);
  ensureBreakBoardCustomMappingSchema(database);
  database.prepare("INSERT INTO break_board_presets (slot, name, mapping_mode) VALUES (7, 'Board Seven', 'MAPPED')").run();
  const insertCard = database.prepare(`
    INSERT INTO cards (id, game_code, name, card_number, set_code, rarity, source_rarity, variant, manual_category)
    VALUES (?, 'RIFTBOUND', ?, ?, 'UNL', ?, ?, ?, '')
  `);
  insertCard.run(1, 'Jhin, Virtuoso', '226*', 'Epic', 'Epic', 'Signature');
  insertCard.run(2, 'Rengar, Pridestalker', '227', 'Epic', 'Epic', 'Overnumbered');
  insertCard.run(3, 'Thrill of the Hunt', '184', 'Epic', 'Epic', '');
  insertCard.run(4, 'Trophy Hunter', '120A', 'Epic', 'Epic', 'Alternate Art');
  database.prepare('INSERT INTO break_board_preset_cards (slot, position, card_id) VALUES (7, 1, 1)').run();
  database.prepare('INSERT INTO break_board_preset_cards (slot, position, card_id) VALUES (7, 2, 2)').run();
  database.prepare('INSERT INTO break_rounds (id) VALUES (11)').run();
  return database;
}

function run() {
  const database = createDatabase();
  assert.deepEqual(customMappingCardPresentation({ variant: 'Signature' }), { role: 'signature', badge: '💎', badgeLabel: 'Signature' });
  assert.deepEqual(customMappingCardPresentation({
    card_number: 'UNL-238/219', set_code: 'UNL', rarity: 'Ultimate', variant: 'Overnumbered'
  }), { role: 'ultimate', badge: '💀', badgeLabel: 'Ultimate' });
  assert.deepEqual(customMappingCardPresentation({
    card_number: 'UNL-229/219', set_code: 'UNL', rarity: 'Ultimate', variant: 'Overnumbered'
  }), { role: 'overnumbered', badge: '🔥', badgeLabel: 'Overnumbered' });
  assert.deepEqual(customMappingCardPresentation({ variant: 'Overnumbered' }), { role: 'overnumbered', badge: '🔥', badgeLabel: 'Overnumbered' });
  assert.deepEqual(customMappingCardPresentation({ variant: 'Alternate Art' }), { role: 'alternate-art', badge: '💣', badgeLabel: 'Alternate Art' });

  const first = savePresetCustomMapping(database, 7, {
    spots: [
      { position: 1, label: 'Jhin SIG', cards: [{ cardId: 1, additionType: 'ANCHOR' }, { cardId: 3, additionType: 'PLUS' }] },
      { position: 2, label: 'Rengar ON + AA', cards: [{ cardId: 2, additionType: 'ANCHOR' }, { cardId: 4, additionType: 'ANCHOR' }] }
    ]
  });
  assert.equal(first.spots, 2);
  assert.equal(first.mappedCards, 4);
  const saved = loadPresetCustomMapping(database, 7);
  assert.equal(saved.spots[0].label, 'Jhin SIG');
  assert.equal(customMappingSpotDisplayLabel(saved.spots[0]), '💎 Jhin SIG + ⭐ Thrill of the Hunt');
  assert.equal(customMappingSpotDisplayLabel({
    label: 'Jhin SIG + Thrill of the Hunt',
    cards: [{ name: 'Thrill of the Hunt', additionType: 'PLUS' }]
  }), 'Jhin SIG + Thrill of the Hunt');
  assert.deepEqual(saved.spots[0].cards.map(card => card.mappingAdditionType), ['ANCHOR', 'PLUS']);
  assert.deepEqual(saved.spots[1].cards.map(card => card.mappingAdditionType), ['ANCHOR', 'SEQUENCE']);
  assert.deepEqual(saved.spots.map(spot => spot.cards.map(card => card.id)), [[1, 3], [2, 4]]);
  assert.ok(customMappingSignature(saved));

  assert.throws(() => savePresetCustomMapping(database, 7, {
    spots: [
      { position: 1, label: 'Duplicate', cardIds: [1, 3] },
      { position: 2, label: 'Duplicate', cardIds: [2, 3] }
    ]
  }), /cannot belong to both/i);
  assert.throws(() => savePresetCustomMapping(database, 7, {
    spots: [
      { position: 1, label: 'Missing anchor', cardIds: [3] },
      { position: 2, label: 'Valid', cardIds: [2, 4] }
    ]
  }), /must keep its displayed anchor/i);

  const snapshot = snapshotPresetCustomMapping(database, 7, 11);
  assert.equal(snapshot.customized, true);
  assert.equal(snapshot.mappedCards, 4);
  savePresetCustomMapping(database, 7, {
    spots: [
      { position: 1, label: 'New Jhin', cardIds: [1, 4] },
      { position: 2, label: 'New Rengar', cardIds: [2, 3] }
    ]
  });
  const immutableRound = loadRoundCustomMapping(database, 11);
  assert.equal(immutableRound.spots[0].label, 'Jhin SIG');
  assert.equal(customMappingSpotDisplayLabel(immutableRound.spots[0]), '💎 Jhin SIG + ⭐ Thrill of the Hunt');
  assert.deepEqual(immutableRound.spots.map(spot => spot.cards.map(card => card.id)), [[1, 3], [2, 4]]);

  const cleared = clearPresetCustomMapping(database, 7);
  assert.equal(cleared.removedSpots, 2);
  assert.equal(loadPresetCustomMapping(database, 7), null);
  assert.equal(loadRoundCustomMapping(database, 11).spots.length, 2);
  database.close();
}

run();
console.log('BreakBoardCustomMapping tests passed.');
