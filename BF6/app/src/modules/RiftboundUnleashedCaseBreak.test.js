const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const {
  BOOSTER_AA_RUNE_NUMBERS,
  UNLEASHED_CASE_BOARD_MIGRATION_KEY,
  UNLEASHED_CASE_BOARD_NAME,
  UNLEASHED_CASE_SPOTS,
  buildUnleashedCaseBreakSpot,
  cardsForUnleashedCaseSpot,
  collectorNumberKey,
  decorateUnleashedCaseBreakBoard,
  ensureUnleashedCaseBoardOne,
  isUnleashedBoosterAaRune,
  isUnleashedCaseBreakBoard,
  spotLabel
} = require('./RiftboundUnleashedCaseBreak');

function card(id, name, cardNumber, overrides = {}) {
  return {
    id,
    game_code: 'RIFTBOUND',
    set_code: 'UNL',
    name,
    card_number: cardNumber,
    rarity: 'Rare',
    source_rarity: 'Rare',
    color: '',
    card_type: 'Champion Unit',
    collector_treatment: cardNumber.endsWith('*') ? 'Signature' : '',
    variant: '',
    manual_category: '',
    card_traits: '',
    details_json: '',
    image_url: `https://example.test/unleashed/${id}.webp`,
    ...overrides
  };
}

const championAnchors = [
  ['Jhin, Virtuoso', 'UNL-226*/219'],
  ['Rengar, Pridestalker', 'UNL-227*/219'],
  ['Pyke, Bloodharbor Ripper', 'UNL-228*/219'],
  ['Vi, Piltover Enforcer', 'UNL-229*/219'],
  ['Lillia, Bashful Bloom', 'UNL-230*/219'],
  ['Master Yi, Wuju Master', 'UNL-231*/219'],
  ['Vex, Gloomist', 'UNL-232*/219'],
  ['Ivern, Green Father', 'UNL-233*/219'],
  ['Diana, Scorn of the Moon', 'UNL-234*/219'],
  ['LeBlanc, Deceiver', 'UNL-235*/219'],
  ["Kha'Zix, Voidreaver", 'UNL-236*/219'],
  ['Poppy, Keeper of the Hammer', 'UNL-237*/219']
].map(([name, number], index) => card(index + 1, name, number));

const baronAnchor = card(13, 'Baron Nashor', 'UNL-238/219', {
  rarity: 'Ultimate', source_rarity: 'Ultimate', card_type: 'Unit', collector_treatment: 'Overnumbered'
});
const poroAnchors = [
  ['Pouty Poro', 'UNL-220/219', 'Fury'],
  ['Lonely Poro', 'UNL-221/219', 'Calm'],
  ['Plundering Poro', 'UNL-222/219', 'Body'],
  ['Veteran Poro', 'UNL-223/219', 'Mind'],
  ['Mystic Poro', 'UNL-224/219', 'Chaos'],
  ['Daring Poro', 'UNL-225/219', 'Order']
].map(([name, number, color], index) => card(index + 14, name, number, {
  rarity: 'Showcase', source_rarity: 'Showcase', card_type: 'Unit', color, collector_treatment: 'Overnumbered'
}));
const anchors = [...championAnchors, baronAnchor, ...poroAnchors]
  .map((entry, index) => ({ ...entry, position: index + 1 }));

const aaRunes = [
  ['Fury Rune', 'UNL-R01a', 'Fury'],
  ['Calm Rune', 'UNL-R02a', 'Calm'],
  ['Mind Rune', 'UNL-R03a', 'Mind'],
  ['Body Rune', 'UNL-R04a', 'Body'],
  ['Chaos Rune', 'UNL-R05a', 'Chaos'],
  ['Order Rune', 'UNL-R06a', 'Order']
].map(([name, number, color], index) => card(index + 30, name, number, {
  rarity: 'Showcase', source_rarity: 'Showcase', card_type: 'Rune', color,
  collector_treatment: 'Alternate Art', variant: 'Alternate Art'
}));
const promoRunes = [
  ['Fury Rune', 'UNL-R01b', 'Fury'],
  ['Calm Rune', 'UNL-R02b', 'Calm'],
  ['Mind Rune', 'UNL-R03b', 'Mind'],
  ['Body Rune', 'UNL-R04b', 'Body'],
  ['Chaos Rune', 'UNL-R05b', 'Chaos'],
  ['Order Rune', 'UNL-R06b', 'Order']
].map(([name, number, color], index) => card(index + 40, name, number, {
  rarity: 'Promo', source_rarity: 'Promo', card_type: 'Rune', color,
  collector_treatment: 'Alternate Art', variant: 'Alternate Art'
}));

const catalog = [
  ...anchors,
  ...aaRunes,
  ...promoRunes,
  card(50, 'Baron Nashor', 'UNL-147/219', { rarity: 'Epic', source_rarity: 'Epic', card_type: 'Unit', color: 'Chaos', collector_treatment: '' }),
  card(51, 'Jhin, Meticulous Killer', 'UNL-089/219', { rarity: 'Epic', source_rarity: 'Epic', collector_treatment: '' }),
  card(52, 'Curtain Call', 'UNL-182/219', { rarity: 'Epic', source_rarity: 'Epic', card_type: 'Spell', collector_treatment: '', details_json: JSON.stringify({ champion: 'Jhin' }) }),
  card(53, 'Irresistible Faefolk', 'UNL-112/219', { rarity: 'Rare', source_rarity: 'Rare', card_type: 'Unit', color: 'Fury', collector_treatment: '' }),
  card(54, 'Dancing Grenade', 'UNL-020/219', { rarity: 'Rare', source_rarity: 'Rare', card_type: 'Spell', color: 'Fury', collector_treatment: '' }),
  card(55, 'Vilemaw', 'UNL-060/219', { rarity: 'Epic', source_rarity: 'Epic', card_type: 'Unit', color: 'Calm', collector_treatment: '' }),
  card(56, 'Vilemaw', 'UNL-060a/219', { rarity: 'Showcase', source_rarity: 'Showcase', card_type: 'Unit', color: 'Calm', collector_treatment: 'Alternate Art' }),
  card(57, 'Scuttle Crab', 'UNL-053/219', { rarity: 'Rare', source_rarity: 'Rare', card_type: 'Unit', color: 'Calm', collector_treatment: '' })
];

assert.equal(collectorNumberKey('UNL-00226-STAR/219'), '226*');
assert.equal(collectorNumberKey('UNL-R04a'), 'R04A');
assert.equal(UNLEASHED_CASE_SPOTS.length, 19);
assert.deepEqual(UNLEASHED_CASE_SPOTS.map(spot => spot.position), Array.from({ length: 19 }, (_value, index) => index + 1));
assert.equal(UNLEASHED_CASE_SPOTS.filter(spot => spot.kind === 'champion').length, 12);
assert.equal(UNLEASHED_CASE_SPOTS.filter(spot => spot.kind === 'baron-runes').length, 1);
assert.equal(UNLEASHED_CASE_SPOTS.filter(spot => spot.kind === 'color').length, 6);
assert.deepEqual(BOOSTER_AA_RUNE_NUMBERS, ['R01A', 'R02A', 'R03A', 'R04A', 'R05A', 'R06A']);
assert.equal(isUnleashedCaseBreakBoard(anchors), true);
assert.equal(isUnleashedCaseBreakBoard([...anchors].reverse()), true);
assert.equal(isUnleashedCaseBreakBoard(anchors.slice(0, 18)), false);
assert.equal(spotLabel(UNLEASHED_CASE_SPOTS[0]), 'Jhin');
assert.equal(spotLabel(UNLEASHED_CASE_SPOTS[12]), 'Baron Nashor + All 6 AA Runes');
assert.equal(spotLabel(UNLEASHED_CASE_SPOTS[13]), 'Red / Fury — Pouty Poro + Irresistible Faefolk');
assert.deepEqual(
  decorateUnleashedCaseBreakBoard(anchors).map(entry => entry.break_spot_label),
  UNLEASHED_CASE_SPOTS.map(spotLabel)
);

assert.equal(aaRunes.every(isUnleashedBoosterAaRune), true);
assert.equal(promoRunes.some(isUnleashedBoosterAaRune), false);

const jhin = cardsForUnleashedCaseSpot(catalog, UNLEASHED_CASE_SPOTS[0]);
assert.equal(jhin.some(entry => entry.id === 1), true);
assert.equal(jhin.some(entry => entry.id === 51), true);
assert.equal(jhin.some(entry => entry.id === 52), true);
assert.equal(jhin.some(entry => entry.id === 2), false);

const baronRunes = cardsForUnleashedCaseSpot(catalog, UNLEASHED_CASE_SPOTS[12]);
assert.equal(baronRunes.some(entry => entry.id === 13), true);
assert.equal(baronRunes.some(entry => entry.id === 50), true);
assert.deepEqual(baronRunes.filter(isUnleashedBoosterAaRune).map(entry => collectorNumberKey(entry.card_number)).sort(), BOOSTER_AA_RUNE_NUMBERS);
assert.equal(baronRunes.some(entry => promoRunes.some(promo => promo.id === entry.id)), false, 'Nexus Night promo Runes are not booster-case hits');

const red = cardsForUnleashedCaseSpot(catalog, UNLEASHED_CASE_SPOTS[13]);
assert.equal(red.some(entry => entry.id === 14), true);
assert.equal(red.some(entry => entry.id === 53), true);
assert.equal(red.some(entry => entry.id === 54), true);
assert.equal(red.some(isUnleashedBoosterAaRune), false, 'all six booster AA Runes belong only to Spot 13');

const green = cardsForUnleashedCaseSpot(catalog, UNLEASHED_CASE_SPOTS[14]);
assert.equal(green.some(entry => entry.id === 15), true);
assert.equal(green.some(entry => entry.id === 55), true);
assert.equal(green.some(entry => entry.id === 56), true);
assert.equal(green.some(entry => entry.id === 57), true);
assert.equal(green.some(entry => entry.id === 31), false, 'Calm AA Rune moved to Baron');

for (const rune of aaRunes) {
  const owners = UNLEASHED_CASE_SPOTS.filter(spot => cardsForUnleashedCaseSpot([rune], spot).length);
  assert.deepEqual(owners.map(spot => spot.position), [13], `${rune.card_number} must have exactly one owner`);
}

for (const entry of catalog.filter(candidate => !promoRunes.some(promo => promo.id === candidate.id))) {
  const owners = UNLEASHED_CASE_SPOTS.filter(spot => cardsForUnleashedCaseSpot([entry], spot).length);
  assert.equal(owners.length, 1, `${entry.card_number} should have exactly one mapped owner in this fixture`);
}

const baronVisual = buildUnleashedCaseBreakSpot(catalog, anchors[12]);
assert.equal(baronVisual.displayLabel, 'Baron Nashor + All 6 AA Runes');
assert.deepEqual(baronVisual.bundleGroups.map(group => group.role), ['baron', 'rune']);
assert.equal(baronVisual.bundleGroups.find(group => group.role === 'rune').cards.length, 6);
const redVisual = buildUnleashedCaseBreakSpot(catalog, anchors[13]);
assert.deepEqual(redVisual.bundleGroups.map(group => group.role), ['poro', 'mapped', 'rare-color']);
assert.equal(redVisual.bundleGroups.some(group => group.role === 'rune'), false);

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
      source_rarity TEXT,
      color TEXT,
      card_type TEXT,
      collector_treatment TEXT,
      variant TEXT,
      manual_category TEXT,
      card_traits TEXT,
      details_json TEXT,
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
      id, game_code, set_code, name, card_number, rarity, source_rarity, color,
      card_type, collector_treatment, variant, manual_category, card_traits,
      details_json, image_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  anchors.forEach(entry => insert.run(
    entry.id, entry.game_code, entry.set_code, entry.name, entry.card_number,
    entry.rarity, entry.source_rarity, entry.color, entry.card_type,
    entry.collector_treatment, entry.variant, entry.manual_category,
    entry.card_traits, entry.details_json, entry.image_url
  ));
  insert.run(999, 'ONEPIECE', 'OP-01', 'Old Board Card', 'OP01-001', 'Rare', 'Rare', 'Red', 'Leader', '', '', '', '', '', '');
  database.prepare('INSERT INTO app_metadata (key, value) VALUES (?, ?)').run('break-board-working-preset-slot-v1', '1');
  database.prepare('INSERT INTO break_board_presets (slot, name, saved_at, mapping_mode) VALUES (1, ?, ?, ?)').run('Old Board 1', 'old', 'SINGLES');
  database.prepare('INSERT INTO break_board_preset_cards (slot, position, card_id, added_at) VALUES (1, 1, 999, ?)').run('old');
  database.prepare('INSERT INTO break_board_cards (card_id, position, added_at) VALUES (999, 1, ?)').run('old');
  database.prepare('INSERT INTO active_break_board_cards (position, card_id, saved_at) VALUES (1, 999, ?)').run('old');
  return database;
}

const database = createPresetDatabase();
const seeded = ensureUnleashedCaseBoardOne(database);
assert.equal(seeded.seeded, true);
assert.equal(seeded.slot, 1);
assert.equal(seeded.savedCards, 19);
assert.equal(seeded.loadedWorkingBoard, true);
assert.equal(database.prepare('SELECT name FROM break_board_presets WHERE slot = 1').get().name, UNLEASHED_CASE_BOARD_NAME);
assert.equal(database.prepare('SELECT mapping_mode FROM break_board_presets WHERE slot = 1').get().mapping_mode, 'MAPPED');
assert.deepEqual(
  database.prepare('SELECT card_id FROM break_board_preset_cards WHERE slot = 1 ORDER BY position').all().map(row => row.card_id),
  Array.from({ length: 19 }, (_value, index) => index + 1)
);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM break_board_cards').get().count, 19);
assert.equal(database.prepare('SELECT card_id FROM active_break_board_cards WHERE position = 1').get().card_id, 999, 'the current live ledger must stay untouched');
assert.equal(database.prepare("SELECT value FROM app_metadata WHERE key = 'break-board-game-v1'").get().value, 'RIFTBOUND');
assert.equal(database.prepare("SELECT value FROM app_metadata WHERE key = 'break-board-working-mapping-mode-v1'").get().value, 'MAPPED');
assert.ok(database.prepare('SELECT value FROM app_metadata WHERE key = ?').get(UNLEASHED_CASE_BOARD_MIGRATION_KEY)?.value);

database.prepare("UPDATE break_board_presets SET name = ?, mapping_mode = 'SINGLES' WHERE slot = 1").run('User Renamed Board');
const secondRun = ensureUnleashedCaseBoardOne(database);
assert.equal(secondRun.skipped, true);
assert.equal(database.prepare('SELECT name FROM break_board_presets WHERE slot = 1').get().name, 'User Renamed Board');
assert.equal(database.prepare('SELECT mapping_mode FROM break_board_presets WHERE slot = 1').get().mapping_mode, 'SINGLES', 'the one-time migration must preserve later user edits');
database.close();

const otherBoardDatabase = createPresetDatabase();
otherBoardDatabase.prepare("UPDATE app_metadata SET value = '2' WHERE key = 'break-board-working-preset-slot-v1'").run();
const otherBoardResult = ensureUnleashedCaseBoardOne(otherBoardDatabase);
assert.equal(otherBoardResult.seeded, true);
assert.equal(otherBoardResult.loadedWorkingBoard, false);
assert.equal(otherBoardDatabase.prepare('SELECT COUNT(*) AS count FROM break_board_preset_cards WHERE slot = 1').get().count, 19);
assert.equal(otherBoardDatabase.prepare('SELECT card_id FROM break_board_cards WHERE position = 1').get().card_id, 999, 'a different loaded working board must stay untouched');
otherBoardDatabase.close();

const missingAnchorDatabase = createPresetDatabase();
missingAnchorDatabase.prepare('DELETE FROM cards WHERE id = 1').run();
missingAnchorDatabase.prepare(`
  INSERT INTO cards (
    id, game_code, set_code, name, card_number, rarity, source_rarity, color,
    card_type, collector_treatment, variant, manual_category, card_traits,
    details_json, image_url
  ) VALUES (1000, 'RIFTBOUND', 'UNL', 'Jhin, Meticulous Killer', 'UNL-089/219',
    'Epic', 'Epic', 'Fury', 'Champion Unit', '', '', '', '', '', '')
`).run();
const missingAnchorResult = ensureUnleashedCaseBoardOne(missingAnchorDatabase);
assert.equal(missingAnchorResult.reason, 'missing-catalog-anchors');
assert.deepEqual(missingAnchorResult.missing, [{ position: 1, anchor: 'Jhin', cardNumber: '226*' }]);
assert.equal(missingAnchorDatabase.prepare('SELECT value FROM app_metadata WHERE key = ?').get(UNLEASHED_CASE_BOARD_MIGRATION_KEY), undefined, 'a failed seed must remain retryable after catalog sync');
missingAnchorDatabase.close();

console.log('Unleashed 19-spot case Board 1 and Baron + six AA Rune mapping tests passed.');
