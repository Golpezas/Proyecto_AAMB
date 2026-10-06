const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const {
  UNLEASHED_COLOR_BOARD_NAME,
  UNLEASHED_COLOR_BREAK_SPOTS,
  buildUnleashedColorBreakSpot,
  cardsForUnleashedColorSpot,
  collectorNumberKey,
  decorateUnleashedColorBreakBoard,
  ensureUnleashedColorBoardOne,
  explicitColorlessCard,
  isUnleashedColorBreakBoard,
  spotLabel
} = require('./RiftboundUnleashedColorBreak');

function card(id, name, cardNumber, overrides = {}) {
  return {
    id,
    game_code: 'RIFTBOUND',
    set_code: 'UNL',
    name,
    card_number: cardNumber,
    rarity: 'Rare',
    color: '',
    card_type: 'Champion Unit',
    collector_treatment: cardNumber.endsWith('*') ? 'Signature' : '',
    variant: '',
    manual_category: '',
    card_traits: '',
    details_json: '',
    ...overrides
  };
}

const anchors = [
  card(1, 'Jhin, Virtuoso', 'UNL-226*/219'),
  card(2, 'Ivern, the Green Father', 'UNL-233*/219'),
  card(3, 'Master Yi, Wuju Master', 'UNL-231*/219'),
  card(4, 'Diana, Scorn of the Moon', 'UNL-234*/219'),
  card(5, "Kha'Zix, Voidreaver", 'UNL-236*/219'),
  card(6, 'Poppy, Keeper of the Hammer', 'UNL-237*/219'),
  card(7, 'Baron Nashor', 'UNL-238/219', { rarity: 'Ultimate', card_type: 'Unit', collector_treatment: 'Overnumbered' })
].map((entry, index) => ({ ...entry, position: index + 1 }));

assert.equal(collectorNumberKey('UNL-00226-STAR/219'), '226*');
assert.equal(collectorNumberKey('unl-238/219'), '238');
assert.equal(isUnleashedColorBreakBoard(anchors), true);
assert.equal(isUnleashedColorBreakBoard(anchors.slice(0, 6)), false);
assert.equal(isUnleashedColorBreakBoard([...anchors].reverse()), true);
assert.equal(isUnleashedColorBreakBoard(anchors.map((entry, index) => ({ ...entry, position: index + 2 }))), false);

assert.deepEqual(
  UNLEASHED_COLOR_BREAK_SPOTS.map(spot => [spot.position, spot.color, spot.domain, spot.champions.map(member => member.name)]),
  [
    [1, 'Red', 'Fury', ['Jhin', 'Pyke']],
    [2, 'Green', 'Calm', ['Ivern', 'Lillia']],
    [3, 'Orange', 'Body', ['Master Yi', 'Rengar']],
    [4, 'Blue', 'Mind', ['Diana', 'LeBlanc']],
    [5, 'Purple', 'Chaos', ["Kha'Zix", 'Vex']],
    [6, 'Yellow', 'Order', ['Poppy', 'Vi']],
    [7, 'Mixed', 'Colorless', []]
  ]
);
assert.equal(spotLabel(UNLEASHED_COLOR_BREAK_SPOTS[0]), 'Red / Fury — Jhin + Pyke');
assert.equal(spotLabel(UNLEASHED_COLOR_BREAK_SPOTS[6]), 'Baron + Colorless');
assert.deepEqual(
  decorateUnleashedColorBreakBoard(anchors).map(entry => entry.break_spot_label),
  [
    'Red / Fury — Jhin + Pyke',
    'Green / Calm — Ivern + Lillia',
    'Orange / Body — Master Yi + Rengar',
    'Blue / Mind — Diana + LeBlanc',
    "Purple / Chaos — Kha'Zix + Vex",
    'Yellow / Order — Poppy + Vi',
    'Baron + Colorless'
  ]
);

const catalog = [
  ...anchors,
  card(8, 'Pyke, Bloodharbor Ripper', 'UNL-228*/219'),
  card(9, 'Lillia, Bashful Bloom', 'UNL-230*/219'),
  card(10, 'Rengar, the Pridestalker', 'UNL-227*/219'),
  card(11, 'LeBlanc, the Deceiver', 'UNL-235*/219'),
  card(12, 'Vex, the Gloomist', 'UNL-232*/219'),
  card(13, 'Vi, Piltover Enforcer', 'UNL-229*/219'),
  card(14, 'Pouty Poro', 'UNL-220/219', { rarity: 'Epic', card_type: 'Unit', color: 'Fury' }),
  card(15, 'Dancing Grenade', 'UNL-021/219', { rarity: 'Rare', card_type: 'Spell', color: 'Fury' }),
  card(16, 'Mystic Poro', 'UNL-224/219', { rarity: 'Epic', card_type: 'Unit', color: 'Chaos' }),
  card(17, 'Chaos Bolt', 'UNL-141/219', { rarity: 'Rare', card_type: 'Spell', color: 'Chaos' }),
  card(18, 'Baron Nashor', 'UNL-147/219', { rarity: 'Epic', card_type: 'Unit', color: 'Chaos', collector_treatment: '' }),
  card(19, 'Practice Token', 'UNL-T01', { rarity: 'Token', card_type: 'Token', color: '', collector_treatment: '' }),
  card(20, 'Curtain Call', 'UNL-182/219', { rarity: 'Epic', card_type: 'Spell', color: '', collector_treatment: '', card_traits: '' })
];

const red = cardsForUnleashedColorSpot(catalog, UNLEASHED_COLOR_BREAK_SPOTS[0]);
assert.equal(red.some(entry => entry.id === 1), true);
assert.equal(red.some(entry => entry.id === 8), true);
assert.equal(red.some(entry => entry.id === 14), true);
assert.equal(red.some(entry => entry.id === 15), true);
assert.equal(red.some(entry => entry.id === 20), true, 'exact family numbers map even when imported champion tags are missing');
assert.equal(red.some(entry => entry.id === 10), false);
assert.equal(red.some(entry => entry.id === 4), false);
assert.equal(red.some(entry => entry.id === 7), false);

const purple = cardsForUnleashedColorSpot(catalog, UNLEASHED_COLOR_BREAK_SPOTS[4]);
assert.equal(purple.some(entry => entry.id === 5), true);
assert.equal(purple.some(entry => entry.id === 12), true);
assert.equal(purple.some(entry => entry.id === 16), true);
assert.equal(purple.some(entry => entry.id === 17), true);
assert.equal(purple.some(entry => entry.id === 4), false, 'Diana is assigned to Blue, not duplicated into Purple');

const mixed = cardsForUnleashedColorSpot(catalog, UNLEASHED_COLOR_BREAK_SPOTS[6]);
assert.equal(mixed.some(entry => entry.id === 7), true);
assert.equal(mixed.some(entry => entry.id === 18), true);
assert.equal(mixed.some(entry => entry.id === 19), true);
assert.equal(explicitColorlessCard(catalog.find(entry => entry.id === 19)), true);

const redVisual = buildUnleashedColorBreakSpot(catalog, anchors[0]);
assert.equal(redVisual.displayLabel, 'Red / Fury — Jhin + Pyke');
assert.deepEqual(redVisual.heroCards.map(entry => entry.id), [1, 8]);
assert.deepEqual(redVisual.champions, ['Jhin', 'Pyke']);
assert.equal(redVisual.bundleGroups.filter(group => group.role === 'champion').length, 2);

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
      card_traits TEXT,
      details_json TEXT
    );
    CREATE TABLE app_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE break_board_presets (slot INTEGER PRIMARY KEY, name TEXT NOT NULL, saved_at TEXT NOT NULL);
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
      collector_treatment, variant, manual_category, card_traits, details_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  anchors.forEach(entry => insert.run(
    entry.id, entry.game_code, entry.set_code, entry.name, entry.card_number,
    entry.rarity, entry.color, entry.card_type, entry.collector_treatment,
    entry.variant, entry.manual_category, entry.card_traits, entry.details_json
  ));
  insert.run(99, 'ONEPIECE', 'OP-01', 'Old Board Card', 'OP01-001', 'Rare', 'Red', 'Leader', '', '', '', '', '');
  database.prepare('INSERT INTO app_metadata (key, value) VALUES (?, ?)').run('break-board-working-preset-slot-v1', '1');
  database.prepare('INSERT INTO break_board_presets (slot, name, saved_at) VALUES (1, ?, ?)').run('Old Board 1', 'old');
  database.prepare('INSERT INTO break_board_preset_cards (slot, position, card_id, added_at) VALUES (1, 1, 99, ?)').run('old');
  database.prepare('INSERT INTO break_board_cards (card_id, position, added_at) VALUES (99, 1, ?)').run('old');
  database.prepare('INSERT INTO active_break_board_cards (position, card_id, saved_at) VALUES (1, 99, ?)').run('old');
  return database;
}

const database = createPresetDatabase();
const seeded = ensureUnleashedColorBoardOne(database);
assert.equal(seeded.seeded, true);
assert.equal(seeded.slot, 1);
assert.equal(seeded.savedCards, 7);
assert.equal(seeded.loadedWorkingBoard, true);
assert.equal(database.prepare('SELECT name FROM break_board_presets WHERE slot = 1').get().name, UNLEASHED_COLOR_BOARD_NAME);
assert.deepEqual(
  database.prepare('SELECT card_id FROM break_board_preset_cards WHERE slot = 1 ORDER BY position').all().map(row => row.card_id),
  [1, 2, 3, 4, 5, 6, 7]
);
assert.deepEqual(
  database.prepare('SELECT card_id FROM break_board_cards ORDER BY position').all().map(row => row.card_id),
  [1, 2, 3, 4, 5, 6, 7]
);
assert.equal(database.prepare('SELECT card_id FROM active_break_board_cards WHERE position = 1').get().card_id, 99, 'the live ledger must stay untouched');
assert.equal(database.prepare("SELECT value FROM app_metadata WHERE key = 'break-board-game-v1'").get().value, 'RIFTBOUND');

database.prepare('UPDATE break_board_presets SET name = ? WHERE slot = 1').run('User Renamed Board');
const secondRun = ensureUnleashedColorBoardOne(database);
assert.equal(secondRun.skipped, true);
assert.equal(database.prepare('SELECT name FROM break_board_presets WHERE slot = 1').get().name, 'User Renamed Board');
database.close();

console.log('Unleashed seven-spot color break and Board 1 preset tests passed.');
