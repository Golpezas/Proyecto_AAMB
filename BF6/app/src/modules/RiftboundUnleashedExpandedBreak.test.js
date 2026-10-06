'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { formatBreakBoardListing } = require('./BreakBoard');
const {
  BOOSTER_AA_RUNE_NUMBERS,
  CHAMPION_SPLITS,
  UNLEASHED_EXPANDED_BOARD_NAME,
  UNLEASHED_EXPANDED_BOARD_SLOT,
  UNLEASHED_EXPANDED_LISTING_DESCRIPTION,
  UNLEASHED_EXPANDED_MIGRATION_KEY,
  UNLEASHED_EXPANDED_SPOTS,
  UNLEASHED_EXPANDED_VALUE_SNAPSHOT,
  buildUnleashedExpandedBreakSpot,
  cardBelongsToUnleashedExpandedSpot,
  cardsForUnleashedExpandedSpot,
  collectorNumberKey,
  decorateUnleashedExpandedBreakBoard,
  ensureUnleashedExpandedBoardSeven,
  isUnleashedExpandedBreakBoard,
  isPromotionalPrinting,
  spotLabel
} = require('./RiftboundUnleashedExpandedBreak');

function card(id, name, number, overrides = {}) {
  return {
    id,
    game_code: 'RIFTBOUND',
    set_code: 'UNL',
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
    image_url: `https://example.test/unl/${id}.webp`,
    ...overrides
  };
}

function fullNumber(key) {
  return String(key).startsWith('R') ? `UNL-${key}` : `UNL-${key}/219`;
}

function anchorCard(spot, index) {
  const treatment = spot.kind === 'champion-split'
    ? (spot.mode === 'signature' ? 'Signature' : 'Overnumbered')
    : spot.kind === 'runes' || /A$/i.test(spot.anchorNumber)
      ? 'Alternate Art'
      : /poro/i.test(spot.kind)
        ? 'Overnumbered'
        : '';
  return {
    ...card(index + 1, spot.anchor, fullNumber(spot.anchorNumber), {
      rarity: spot.kind === 'runes' ? 'Showcase' : 'Rare',
      source_rarity: spot.kind === 'runes' ? 'Showcase' : 'Rare',
      collector_treatment: treatment,
      variant: treatment
    }),
    position: spot.position
  };
}

const anchors = UNLEASHED_EXPANDED_SPOTS.map(anchorCard);

assert.equal(UNLEASHED_EXPANDED_BOARD_SLOT, 7);
assert.equal(UNLEASHED_EXPANDED_SPOTS.length, 39);
assert.equal(UNLEASHED_EXPANDED_SPOTS.filter(spot => spot.kind === 'champion-split').length, 24);
assert.equal(UNLEASHED_EXPANDED_SPOTS.filter(spot => spot.mode === 'signature').length, 12);
assert.equal(UNLEASHED_EXPANDED_SPOTS.filter(spot => spot.mode === 'overnumbered').length, 12);
assert.equal(UNLEASHED_EXPANDED_SPOTS.filter(spot => spot.kind === 'poro-bundle').length, 6);
assert.deepEqual(UNLEASHED_EXPANDED_SPOTS.map(spot => spot.position), Array.from({ length: 39 }, (_value, index) => index + 1));
assert.equal(collectorNumberKey('UNL-00226-STAR/219'), '226*');
assert.equal(collectorNumberKey('UNL-R05a'), 'R05A');
assert.equal(isUnleashedExpandedBreakBoard(anchors), true);
assert.equal(isUnleashedExpandedBreakBoard([...anchors].reverse()), true);
assert.equal(isUnleashedExpandedBreakBoard(anchors.slice(0, 38)), false);
assert.equal(UNLEASHED_EXPANDED_VALUE_SNAPSHOT, '2026-09-12');
assert.equal(spotLabel(UNLEASHED_EXPANDED_SPOTS[0]), 'Jhin — SIG + Murderous Artist AA (022A) + Epic 089 + Rare 022');
assert.equal(spotLabel(UNLEASHED_EXPANDED_SPOTS[1]), 'Jhin — ON + Meticulous Killer AA (089A) + Epic 182 + Rare 181');
assert.equal(spotLabel(UNLEASHED_EXPANDED_SPOTS[2]), 'Rengar — SIG + Trophy Hunter AA (120A) + Epic 184 + Rare 024');
assert.equal(spotLabel(UNLEASHED_EXPANDED_SPOTS[3]), 'Rengar — ON + Unseen AA (024A) + Epic 120 + Rare 183');
assert.equal(spotLabel(UNLEASHED_EXPANDED_SPOTS[35]), 'Baron Nashor + Sprite Fountain + Abandon + Repulse');
assert.equal(spotLabel(UNLEASHED_EXPANDED_SPOTS[38]), 'All 6 Alternate-Art Runes');
assert.deepEqual(
  decorateUnleashedExpandedBreakBoard(anchors).map(entry => entry.break_spot_label),
  UNLEASHED_EXPANDED_SPOTS.map(spotLabel)
);

let nextId = 1000;
const championCards = [];
for (const split of CHAMPION_SPLITS) {
  const numbers = [
    `${split.chase}*`, split.chase,
    split.higherAa, split.otherAa,
    split.higherEpic, split.otherEpic,
    split.higherRare, split.otherRare
  ];
  assert.equal(new Set(numbers).size, 8, `${split.champion} must have eight unique mapped cards`);
  numbers.forEach(number => championCards.push(card(nextId++, `${split.champion}, Test Printing`, fullNumber(number), {
    rarity: [split.higherEpic, split.otherEpic].includes(number) ? 'Epic' : 'Rare',
    source_rarity: [split.higherEpic, split.otherEpic].includes(number) ? 'Epic' : 'Rare',
    card_type: [split.higherRare, split.otherRare].includes(number) ? 'Legend' : 'Champion Unit',
    card_traits: split.champion,
    collector_treatment: number.endsWith('*') ? 'Signature' : number.endsWith('A') ? 'Alternate Art' : number === split.chase ? 'Overnumbered' : ''
  })));
}

for (const entry of championCards) {
  const owners = UNLEASHED_EXPANDED_SPOTS.filter(spot => cardBelongsToUnleashedExpandedSpot(entry, spot));
  assert.equal(owners.length, 1, `${entry.card_number} must have exactly one champion-lane owner`);
}

const jhinSignature = UNLEASHED_EXPANDED_SPOTS[0];
const jhinOvernumbered = UNLEASHED_EXPANDED_SPOTS[1];
const jhinCards = championCards.filter(entry => entry.name.startsWith('Jhin,'));
assert.deepEqual(
  cardsForUnleashedExpandedSpot(jhinCards, jhinSignature).map(entry => collectorNumberKey(entry.card_number)).sort(),
  ['22', '22A', '226*', '89'].sort()
);
assert.deepEqual(
  cardsForUnleashedExpandedSpot(jhinCards, jhinOvernumbered).map(entry => collectorNumberKey(entry.card_number)).sort(),
  ['181', '182', '226', '89A'].sort()
);
for (let index = 0; index < CHAMPION_SPLITS.length; index += 1) {
  const split = CHAMPION_SPLITS[index];
  const signatureSpot = UNLEASHED_EXPANDED_SPOTS[index * 2];
  const overnumberedSpot = UNLEASHED_EXPANDED_SPOTS[index * 2 + 1];
  assert.deepEqual(signatureSpot.ownedNumbers, [`${split.chase}*`, split.higherAa, split.signatureEpic || split.higherEpic, split.higherRare]);
  assert.deepEqual(overnumberedSpot.ownedNumbers, [split.chase, split.otherAa, split.overnumberedEpic || split.otherEpic, split.otherRare]);
  assert.equal(new Set([...signatureSpot.ownedNumbers, ...overnumberedSpot.ownedNumbers]).size, 8);
}
const rengarSignature = UNLEASHED_EXPANDED_SPOTS[2];
const rengarOvernumbered = UNLEASHED_EXPANDED_SPOTS[3];
assert.deepEqual(rengarSignature.ownedNumbers, ['227*', '120A', '184', '024']);
assert.deepEqual(rengarOvernumbered.ownedNumbers, ['227', '024A', '120', '183']);
const futureJhin = card(nextId++, 'Jhin, Future Printing', 'UNL-999/219', { card_type: 'Champion Unit' });
assert.equal(cardBelongsToUnleashedExpandedSpot(futureJhin, jhinSignature), false, 'Board 7 is limited to the exact eight mapped cards');
assert.equal(cardBelongsToUnleashedExpandedSpot(futureJhin, jhinOvernumbered), false, 'future family cards cannot duplicate into the ON lane');
const promoJhin = card(nextId++, 'Jhin, Virtuoso', 'UNL-181/219', { rarity: 'Promo', source_rarity: 'Promo', card_type: 'Champion Unit' });
assert.equal(isPromotionalPrinting(promoJhin), true);
assert.equal(cardBelongsToUnleashedExpandedSpot(promoJhin, jhinOvernumbered), false, 'promotional copies do not expand the eight-card champion map');

const mappedCards = [
  card(nextId++, 'Inviolus Vox', 'UNL-027/219', { rarity: 'Epic' }),
  card(nextId++, 'Red Brambleback', 'UNL-029/219', { rarity: 'Epic' }),
  card(nextId++, 'Red Brambleback', 'UNL-029A/219', { rarity: 'Showcase', collector_treatment: 'Alternate Art' }),
  card(nextId++, 'Alpha Wildclaw', 'UNL-057/219', { rarity: 'Epic' }),
  card(nextId++, 'Vilemaw', 'UNL-060/219', { rarity: 'Epic' }),
  card(nextId++, 'Arachnoid Horror', 'UNL-117/219', { rarity: 'Epic' }),
  card(nextId++, 'Elder Dragon', 'UNL-118/219', { rarity: 'Epic' }),
  card(nextId++, 'Gutter Palace', 'UNL-088/219', { rarity: 'Epic' }),
  card(nextId++, 'Blue Sentinel', 'UNL-087/219', { rarity: 'Epic' }),
  card(nextId++, 'Cursed Sarcophagus', 'UNL-148/219', { rarity: 'Epic' }),
  card(nextId++, 'Rift Herald', 'UNL-179/219', { rarity: 'Epic' }),
  card(nextId++, 'Baron Nashor', 'UNL-147/219', { rarity: 'Epic' }),
  card(nextId++, 'Baron Nashor', 'UNL-147A/219', { rarity: 'Showcase', collector_treatment: 'Alternate Art' }),
  card(nextId++, 'Sprite Fountain', 'UNL-078/219', { rarity: 'Uncommon' }),
  card(nextId++, 'Sprite Fountain', 'UNL-078/219', { rarity: 'Uncommon', variant: 'Foil' }),
  card(nextId++, 'Abandon', 'UNL-131/219', { rarity: 'Uncommon' }),
  card(nextId++, 'Repulse', 'UNL-106/219', { rarity: 'Uncommon' }),
  card(nextId++, 'Sacrifice', 'UNL-173/219'),
  card(nextId++, 'Ashe, Focused', 'UNL-169/219', { card_type: 'Champion Unit' }),
  ...['019', '021', '025', '020', '023', '026', '049', '052', '054', '050', '053', '056', '109', '111', '115', '110', '114', '081', '083', '084', '086', '085', '139', '140', '141', '142', '144', '146', '170', '171', '174', '175']
    .map(number => card(nextId++, `Pool Card ${number}`, fullNumber(number))),
  ...BOOSTER_AA_RUNE_NUMBERS.slice(1).map(number => card(nextId++, `${number} Rune`, fullNumber(number), {
    rarity: 'Showcase', source_rarity: 'Showcase', card_type: 'Rune', collector_treatment: 'Alternate Art'
  }))
];
const mappedCatalog = [...anchors, ...mappedCards];

for (const entry of mappedCatalog) {
  const owners = UNLEASHED_EXPANDED_SPOTS.filter(spot => cardBelongsToUnleashedExpandedSpot(entry, spot));
  assert.equal(owners.length, 1, `${entry.card_number} ${entry.name} should have exactly one Board 7 owner`);
}

const baronSpot = UNLEASHED_EXPANDED_SPOTS[35];
const baronFamily = cardsForUnleashedExpandedSpot(mappedCatalog, baronSpot);
assert.equal(baronFamily.filter(entry => entry.name === 'Baron Nashor').length, 3);
assert.equal(baronFamily.filter(entry => entry.name === 'Sprite Fountain').length, 2);
assert.equal(baronFamily.some(entry => entry.name === 'Abandon'), true);
assert.equal(baronFamily.some(entry => entry.name === 'Repulse'), true);
assert.equal(baronFamily.some(entry => /Rune/.test(entry.name)), false);

const runeSpot = UNLEASHED_EXPANDED_SPOTS[38];
const promoRune = card(nextId++, 'Fury Rune', 'UNL-R01B', { rarity: 'Promo', card_type: 'Rune' });
assert.equal(cardsForUnleashedExpandedSpot([...mappedCatalog, promoRune], runeSpot).length, 6);
assert.equal(cardBelongsToUnleashedExpandedSpot(promoRune, runeSpot), false, 'promotional Rune printings are excluded');

const riftSpot = UNLEASHED_EXPANDED_SPOTS[34];
const riftVisual = buildUnleashedExpandedBreakSpot(mappedCatalog, anchors[34]);
assert.equal(riftVisual.displayLabel, 'Rift Herald + Cursed Sarcophagus');
assert.deepEqual(riftVisual.heroCards.map(entry => collectorNumberKey(entry.card_number)), ['179A', '179']);
assert.equal(cardsForUnleashedExpandedSpot(mappedCatalog, riftSpot).some(entry => entry.name === 'Cursed Sarcophagus'), true);

const jhinVisual = buildUnleashedExpandedBreakSpot(championCards, anchors[0]);
assert.deepEqual(jhinVisual.heroCards.map(entry => collectorNumberKey(entry.card_number)), ['226*', '22A']);
assert.equal(jhinVisual.rewardTitle, 'SIGNATURE + ASSIGNED AA / EPIC / RARE');
assert.equal(jhinVisual.laneSymbol, '💎');
assert.equal(jhinVisual.laneLabel, 'SIG');
assert.equal(jhinVisual.family.length, 4);
assert.equal(jhinVisual.bundleGroups.length, 4);
assert.deepEqual(jhinVisual.bundleGroups.map(group => group.role), ['signature', 'alternate-art', 'epic', 'rare']);
assert.deepEqual(jhinVisual.bundleGroups.map(group => group.badge), ['💎', '💣', '', '']);
const jhinOnVisual = buildUnleashedExpandedBreakSpot(championCards, anchors[1]);
assert.equal(jhinOnVisual.laneSymbol, '🔥');
assert.equal(jhinOnVisual.laneLabel, 'ON');
assert.deepEqual(jhinOnVisual.bundleGroups.map(group => group.badge), ['🔥', '💣', '', '']);

const copiedListing = formatBreakBoardListing(decorateUnleashedExpandedBreakBoard(anchors), {
  RIFTBOUND: 'An older saved generic Riftbound description that Board 7 must not use.'
});
const copiedRows = copiedListing.split('\n');
assert.equal(copiedRows.length, 39);
assert.equal(copiedRows[0].split('\t')[0], '1 — 💎 Jhin — SIG + Murderous Artist AA (022A) + Epic 089 + Rare 022 💎');
assert.equal(copiedRows[1].split('\t')[0], '2 — 🔥 Jhin — ON + Meticulous Killer AA (089A) + Epic 182 + Rare 181 🔥');
assert.equal(copiedRows[2].split('\t')[0], '3 — 💎 Rengar — SIG + Trophy Hunter AA (120A) + Epic 184 + Rare 024 💎');
assert.equal(copiedRows[3].split('\t')[0], '4 — 🔥 Rengar — ON + Unseen AA (024A) + Epic 120 + Rare 183 🔥');
assert.equal(copiedRows[35].split('\t')[0], '36 — 💀 Baron Nashor + Sprite Fountain + Abandon + Repulse 💀');
assert.equal(copiedRows[38].split('\t')[0], '39 — 💣 All 6 Alternate-Art Runes 💣');
assert.equal(copiedRows.every(row => row.split('\t')[1] === UNLEASHED_EXPANDED_LISTING_DESCRIPTION), true);
assert.doesNotMatch(UNLEASHED_EXPANDED_LISTING_DESCRIPTION, /higher-value/i);
assert.equal(new Set(copiedRows.map(row => row.split('\t')[0])).size, 39);

const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
assert.match(mainSource, /if \(isUnleashedExpandedBreakBoard\(rows\)\s*\|\|\s*isUnleashedFullCaseBreakBoard\(rows\)\) \{\s*return \{ removedRunes: 0, renumbered: false \};/);

function createDatabase(workingSlot = 2) {
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
      source_rarity TEXT,
      color TEXT,
      card_type TEXT,
      collector_treatment TEXT,
      variant TEXT,
      manual_category TEXT,
      card_traits TEXT,
      details_json TEXT,
      image_path TEXT,
      image_url TEXT
    );
    CREATE TABLE app_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE break_board_presets (
      slot INTEGER PRIMARY KEY CHECK(slot BETWEEN 1 AND 10),
      name TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      mapping_mode TEXT NOT NULL DEFAULT 'MAPPED'
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
  const insertCard = database.prepare(`
    INSERT INTO cards (
      id, game_code, set_code, name, card_number, rarity, source_rarity, color,
      card_type, collector_treatment, variant, manual_category, card_traits,
      details_json, image_path, image_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  anchors.forEach(entry => insertCard.run(
    entry.id, entry.game_code, entry.set_code, entry.name, entry.card_number,
    entry.rarity, entry.source_rarity, entry.color, entry.card_type,
    entry.collector_treatment, entry.variant, entry.manual_category,
    entry.card_traits, entry.details_json, entry.image_path, entry.image_url
  ));
  insertCard.run(999, 'ONEPIECE', 'OP-01', 'Existing Board Card', 'OP01-001', 'Rare', 'Rare', 'Red', 'Leader', '', '', '', '', '', '', '');
  const insertPreset = database.prepare('INSERT INTO break_board_presets (slot, name, saved_at, mapping_mode) VALUES (?, ?, ?, ?)');
  const insertPresetCard = database.prepare('INSERT INTO break_board_preset_cards (slot, position, card_id, added_at) VALUES (?, 1, 999, ?)');
  for (let slot = 1; slot <= 10; slot += 1) {
    insertPreset.run(slot, `Existing Board ${slot}`, 'old', slot === 3 ? 'SINGLES' : 'MAPPED');
    insertPresetCard.run(slot, 'old');
  }
  database.prepare('INSERT INTO break_board_cards (card_id, position, added_at) VALUES (999, 1, ?)').run('old');
  database.prepare('INSERT INTO active_break_board_cards (position, card_id, saved_at) VALUES (1, 999, ?)').run('old');
  database.prepare('INSERT INTO app_metadata (key, value) VALUES (?, ?)').run('break-board-working-preset-slot-v1', String(workingSlot));
  return database;
}

const database = createDatabase();
database.prepare('INSERT INTO app_metadata (key, value) VALUES (?, ?)')
  .run('unleashed-board-7-39-split-champions-poros-v1', 'previous-install');
const beforeOtherPresets = database.prepare('SELECT slot, name, mapping_mode FROM break_board_presets WHERE slot != 7 ORDER BY slot').all();
const beforeOtherCards = database.prepare('SELECT slot, position, card_id FROM break_board_preset_cards WHERE slot != 7 ORDER BY slot, position').all();
const seeded = ensureUnleashedExpandedBoardSeven(database);
assert.equal(seeded.seeded, true);
assert.equal(seeded.slot, 7);
assert.equal(seeded.savedCards, 39);
assert.equal(seeded.loadedWorkingBoard, false);
assert.equal(database.prepare('SELECT name FROM break_board_presets WHERE slot = 7').get().name, UNLEASHED_EXPANDED_BOARD_NAME);
assert.equal(database.prepare('SELECT mapping_mode FROM break_board_presets WHERE slot = 7').get().mapping_mode, 'MAPPED');
assert.deepEqual(database.prepare('SELECT slot, name, mapping_mode FROM break_board_presets WHERE slot != 7 ORDER BY slot').all(), beforeOtherPresets, 'Boards 1-6 and 8-10 must remain untouched');
assert.deepEqual(database.prepare('SELECT slot, position, card_id FROM break_board_preset_cards WHERE slot != 7 ORDER BY slot, position').all(), beforeOtherCards, 'other board cards must remain untouched');
assert.equal(database.prepare('SELECT card_id FROM break_board_cards WHERE position = 1').get().card_id, 999, 'a different working-board draft stays untouched');
assert.equal(database.prepare('SELECT card_id FROM active_break_board_cards WHERE position = 1').get().card_id, 999, 'the live ledger stays untouched');
const boardSeven = database.prepare(`
  SELECT c.*, pc.position FROM break_board_preset_cards pc
  JOIN cards c ON c.id = pc.card_id
  WHERE pc.slot = 7 ORDER BY pc.position
`).all();
assert.equal(boardSeven.length, 39);
assert.equal(isUnleashedExpandedBreakBoard(boardSeven), true);
assert.ok(database.prepare('SELECT value FROM app_metadata WHERE key = ?').get(UNLEASHED_EXPANDED_MIGRATION_KEY)?.value);

database.prepare("UPDATE break_board_presets SET name = 'My Edited Board 7', mapping_mode = 'SINGLES' WHERE slot = 7").run();
const skipped = ensureUnleashedExpandedBoardSeven(database);
assert.equal(skipped.reason, 'already-installed');
assert.equal(database.prepare('SELECT name FROM break_board_presets WHERE slot = 7').get().name, 'My Edited Board 7');
assert.equal(database.prepare('SELECT mapping_mode FROM break_board_presets WHERE slot = 7').get().mapping_mode, 'SINGLES');
database.close();

const loadedDatabase = createDatabase(7);
const loaded = ensureUnleashedExpandedBoardSeven(loadedDatabase);
assert.equal(loaded.loadedWorkingBoard, true);
assert.equal(loadedDatabase.prepare('SELECT COUNT(*) AS count FROM break_board_cards').get().count, 39);
assert.equal(loadedDatabase.prepare('SELECT card_id FROM active_break_board_cards WHERE position = 1').get().card_id, 999, 'loading Board 7 must not change the live ledger');
assert.equal(loadedDatabase.prepare("SELECT value FROM app_metadata WHERE key = 'break-board-game-v1'").get().value, 'RIFTBOUND');
assert.equal(loadedDatabase.prepare("SELECT value FROM app_metadata WHERE key = 'break-board-working-mapping-mode-v1'").get().value, 'MAPPED');
loadedDatabase.close();

const missingDatabase = createDatabase();
missingDatabase.prepare('DELETE FROM cards WHERE id = 1').run();
const missing = ensureUnleashedExpandedBoardSeven(missingDatabase);
assert.equal(missing.reason, 'missing-catalog-anchors');
assert.deepEqual(missing.missing, [{ position: 1, anchor: 'Jhin, Virtuoso', cardNumber: '226*' }]);
assert.equal(missingDatabase.prepare('SELECT name FROM break_board_presets WHERE slot = 7').get().name, 'Existing Board 7', 'a failed seed must not touch Board 7');
assert.equal(missingDatabase.prepare('SELECT value FROM app_metadata WHERE key = ?').get(UNLEASHED_EXPANDED_MIGRATION_KEY), undefined, 'a failed seed remains retryable');
missingDatabase.close();

console.log('Unleashed 39-spot Board 7 split mapping and migration tests passed.');
