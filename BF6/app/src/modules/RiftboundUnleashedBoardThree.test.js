'use strict';

const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { loadPresetCustomMapping } = require('./BreakBoardCustomMapping');
const {
  CHAMPION_ANCHORS,
  PORO_COLOR_SPOTS,
  UNLEASHED_BOARD_THREE_MIGRATION_KEY,
  UNLEASHED_BOARD_THREE_NAME,
  UNLEASHED_BOARD_THREE_SLOT,
  UNLEASHED_BOARD_THREE_SPOTS,
  cardBelongsToUnleashedBoardThreeSpot,
  collectorNumberKey,
  ensureUnleashedBoardThree,
  isUnleashedBoardThreeBreakBoard,
  prepareUnleashedBoardThree
} = require('./RiftboundUnleashedBoardThree');

assert.equal(UNLEASHED_BOARD_THREE_SLOT, 3);
assert.equal(UNLEASHED_BOARD_THREE_SPOTS.length, 23);
assert.deepEqual(UNLEASHED_BOARD_THREE_SPOTS.map(spot => spot.position), Array.from({ length: 23 }, (_value, index) => index + 1));
assert.deepEqual(UNLEASHED_BOARD_THREE_SPOTS.map(spot => spot.label), [
  'Jhin',
  'Rengar',
  'Pyke',
  'Vi',
  'Lillia',
  'Master Yi',
  'Vex',
  'Ivern',
  'Diana',
  'LeBlanc',
  "Kha'Zix",
  'Poppy',
  'Baron Nashor',
  'Pouty Poro + Fury Rune',
  'Lonely Poro + Calm Rune',
  'Plundering Poro + Mind Rune',
  'Veteran Poro + Body Rune',
  'Mystic Poro + Chaos Rune',
  'Daring Poro + Order Rune',
  'Vilemaw',
  'Elder Dragon',
  'Rift Herald',
  'Irresistible Faefolk + Alpha Wildclaw + Blue Sentinel'
]);
assert.deepEqual(PORO_COLOR_SPOTS.map(spot => [spot.poro, spot.color, spot.domain, spot.runeNumber]), [
  ['Pouty Poro', 'Red', 'Fury', 'R01A'],
  ['Lonely Poro', 'Green', 'Calm', 'R02A'],
  ['Plundering Poro', 'Blue', 'Mind', 'R03A'],
  ['Veteran Poro', 'Orange', 'Body', 'R04A'],
  ['Mystic Poro', 'Purple', 'Chaos', 'R05A'],
  ['Daring Poro', 'Yellow', 'Order', 'R06A']
]);

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
    break_rarity TEXT,
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
    PRIMARY KEY(slot, position),
    UNIQUE(slot, card_id)
  );
  CREATE TABLE break_board_cards (
    card_id INTEGER NOT NULL UNIQUE,
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
const cardsByKey = new Map();
const insertCard = database.prepare(`
  INSERT INTO cards (
    id, game_code, set_code, set_name, name, card_number, rarity,
    source_rarity, break_rarity, collector_treatment, variant,
    manual_category, card_type, color, colors, domain, domains,
    card_traits, traits, champion, champion_name, details_json,
    image_path, image_url
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function addCard(name, number, options = {}) {
  const id = nextId++;
  const setCode = options.setCode || 'UNL';
  const rarity = options.rarity || 'Rare';
  const treatment = options.treatment || '';
  const domain = options.domain || '';
  const champion = options.champion || '';
  insertCard.run(
    id,
    options.gameCode || 'RIFTBOUND',
    setCode,
    options.setName || 'Unleashed',
    name,
    String(number).startsWith('UNL-') ? number : `UNL-${number}${String(number).startsWith('R') ? '' : '/219'}`,
    rarity,
    rarity,
    rarity,
    treatment,
    treatment,
    options.manualCategory || '',
    options.cardType || 'Unit',
    domain,
    domain,
    domain,
    domain,
    champion,
    champion,
    champion,
    champion,
    JSON.stringify({ champion, domain }),
    '',
    `https://example.test/${id}.webp`
  );
  const card = database.prepare('SELECT * FROM cards WHERE id = ?').get(id);
  cardsByKey.set(`${name}|${collectorNumberKey(card.card_number)}`, card);
  return card;
}

for (let championIndex = 0; championIndex < CHAMPION_ANCHORS.length; championIndex += 1) {
  const entry = CHAMPION_ANCHORS[championIndex];
  const base = 300 + championIndex * 10;
  addCard(`${entry.champion}, Signature`, entry.number, {
    rarity: 'Ultimate', treatment: 'Signature', cardType: 'Champion Unit', champion: entry.champion
  });
  addCard(`${entry.champion}, Overnumbered`, String(base), {
    rarity: 'Ultimate', treatment: 'Overnumbered', cardType: 'Champion Unit', champion: entry.champion
  });
  addCard(`${entry.champion}, Alternate One`, `${base + 1}A`, {
    rarity: 'Showcase', treatment: 'Alternate Art', cardType: 'Champion Unit', champion: entry.champion
  });
  addCard(`${entry.champion}, Alternate Two`, `${base + 2}A`, {
    rarity: 'Showcase', treatment: 'Alternate Art', cardType: 'Champion Unit', champion: entry.champion
  });
  addCard(`${entry.champion}, Epic One`, String(base + 3), {
    rarity: 'Epic', cardType: 'Champion Unit', champion: entry.champion
  });
  addCard(`${entry.champion}, Epic Two`, String(base + 4), {
    rarity: 'Epic', cardType: 'Spell', champion: entry.champion
  });
  addCard(`${entry.champion}, Rare One`, String(base + 5), {
    rarity: 'Rare', cardType: 'Champion Unit', champion: entry.champion
  });
  addCard(`${entry.champion}, Rare Two`, String(base + 6), {
    rarity: 'Rare', cardType: 'Gear', champion: entry.champion
  });
}

const baronUltimate = addCard('Baron Nashor', '238', { rarity: 'Ultimate', treatment: 'Overnumbered' });
const baronAlternate = addCard('Baron Nashor', '147A', { rarity: 'Showcase', treatment: 'Alternate Art' });
const baronEpic = addCard('Baron Nashor', '147', { rarity: 'Epic' });

for (let index = 0; index < PORO_COLOR_SPOTS.length; index += 1) {
  const spot = PORO_COLOR_SPOTS[index];
  addCard(spot.poro, String(220 + index), { rarity: 'Showcase', treatment: 'Overnumbered', domain: spot.domain });
  addCard(spot.rune, spot.runeNumber, { rarity: 'Showcase', treatment: 'Alternate Art', cardType: 'Rune', domain: spot.domain });
  addCard(`${spot.domain} Rare Unit`, String(500 + index * 10), { rarity: 'Rare', cardType: 'Unit', domain: spot.domain });
  addCard(`${spot.domain} Rare Champion`, String(501 + index * 10), { rarity: 'Rare', cardType: 'Champion Unit', domain: spot.domain });
  addCard(`${spot.domain} Rare Gear`, String(502 + index * 10), { rarity: 'Rare', cardType: 'Gear', domain: spot.domain });
  addCard(`${spot.domain} Epic Spell`, String(503 + index * 10), { rarity: 'Epic', cardType: 'Spell', domain: spot.domain });
}

const inviolus = addCard('Inviolus Vox', '027', { rarity: 'Epic', cardType: 'Unit' });
const redBrambleback = addCard('Red Brambleback', '029', { rarity: 'Epic', cardType: 'Unit' });
const gutterPalace = addCard('Gutter Palace', '088', { rarity: 'Epic', cardType: 'Gear' });
const arachnoidHorror = addCard('Arachnoid Horror', '117', { rarity: 'Epic', cardType: 'Unit' });
const cursedSarcophagus = addCard('Cursed Sarcophagus', '148', { rarity: 'Epic', cardType: 'Gear' });
const theRuination = addCard('The Ruination', '180', { rarity: 'Epic', cardType: 'Spell', domain: 'Order' });

const vilemawAlternate = addCard('Vilemaw', '060A', { rarity: 'Showcase', treatment: 'Alternate Art', domain: 'Calm' });
const vilemawEpic = addCard('Vilemaw', '060', { rarity: 'Epic', domain: 'Calm' });
const elderAlternate = addCard('Elder Dragon', '118A', { rarity: 'Showcase', treatment: 'Alternate Art', domain: 'Body' });
const elderEpic = addCard('Elder Dragon', '118', { rarity: 'Epic', domain: 'Body' });
const riftAlternate = addCard('Rift Herald', '179A', { rarity: 'Showcase', treatment: 'Alternate Art', domain: 'Chaos' });
const riftEpic = addCard('Rift Herald', '179', { rarity: 'Epic', domain: 'Chaos' });
const irresistible = addCard('Irresistible Faefolk', '112', { rarity: 'Rare', domain: 'Fury' });
const alphaWildclaw = addCard('Alpha Wildclaw', '057', { rarity: 'Epic', domain: 'Calm' });
const sentinelAlternate = addCard('Blue Sentinel', '087A', { rarity: 'Showcase', treatment: 'Alternate Art', domain: 'Mind' });
const sentinelEpic = addCard('Blue Sentinel', '087', { rarity: 'Epic', domain: 'Mind' });

const promoRune = addCard('Fury Rune', 'R01B', { rarity: 'Promo', manualCategory: 'Promo', cardType: 'Rune', domain: 'Fury' });
const commonFury = addCard('Fury Common', '019', { rarity: 'Common', domain: 'Fury' });
const promoVilemaw = addCard('Vilemaw', 'P060', { rarity: 'Promo', manualCategory: 'Promo', domain: 'Calm' });

const catalog = database.prepare("SELECT * FROM cards WHERE game_code = 'RIFTBOUND' AND set_code = 'UNL'").all();
const prepared = prepareUnleashedBoardThree(catalog);
assert.equal(prepared.ready, true, JSON.stringify(prepared));
assert.equal(prepared.spots.length, 23);
assert.equal(new Set(prepared.spots.flatMap(spot => spot.cards.map(card => card.id))).size, prepared.mappedCards);
assert.equal(isUnleashedBoardThreeBreakBoard(prepared.spots.map(spot => ({ ...spot.anchor, position: spot.definition.position }))), true);

// A locally synced catalog can contain every sellable anchor while missing a
// supporting treatment tag or family row. That diagnostic must never leave
// the reusable preset stuck on its former 19 positions.
const anchorOnlyPrepared = prepareUnleashedBoardThree(prepared.spots.map(spot => spot.anchor));
assert.equal(anchorOnlyPrepared.ready, true, JSON.stringify(anchorOnlyPrepared));
assert.equal(anchorOnlyPrepared.anchors.length, 23);
assert.ok(anchorOnlyPrepared.warnings.length > 0);

function preparedSpot(position) {
  return prepared.spots.find(spot => spot.definition.position === position);
}

assert.deepEqual(preparedSpot(13).cards.map(card => card.id), [baronUltimate.id, baronAlternate.id, baronEpic.id]);
assert.deepEqual(preparedSpot(20).cards.map(card => card.id), [vilemawAlternate.id, vilemawEpic.id]);
assert.deepEqual(preparedSpot(21).cards.map(card => card.id), [elderAlternate.id, elderEpic.id]);
assert.deepEqual(preparedSpot(22).cards.map(card => card.id), [riftAlternate.id, riftEpic.id]);
assert.deepEqual(preparedSpot(23).cards.map(card => card.id), [
  irresistible.id,
  alphaWildclaw.id,
  sentinelAlternate.id,
  sentinelEpic.id
]);

const poutyCards = preparedSpot(14).cards.map(card => card.id);
const lonelyCards = preparedSpot(15).cards.map(card => card.id);
const plunderingCards = preparedSpot(16).cards.map(card => card.id);
const veteranCards = preparedSpot(17).cards.map(card => card.id);
const mysticCards = preparedSpot(18).cards.map(card => card.id);
const daringCards = preparedSpot(19).cards.map(card => card.id);
const mindRune = cardsByKey.get('Mind Rune|R03A');
const bodyRune = cardsByKey.get('Body Rune|R04A');
assert.ok(poutyCards.includes(inviolus.id));
assert.ok(poutyCards.includes(redBrambleback.id));
assert.ok(!poutyCards.includes(irresistible.id));
assert.ok(!lonelyCards.includes(vilemawEpic.id));
assert.ok(!lonelyCards.includes(alphaWildclaw.id));
assert.ok(plunderingCards.includes(gutterPalace.id));
assert.ok(plunderingCards.includes(mindRune.id));
assert.ok(!plunderingCards.includes(bodyRune.id));
assert.ok(!plunderingCards.includes(sentinelEpic.id));
assert.ok(veteranCards.includes(arachnoidHorror.id));
assert.ok(veteranCards.includes(bodyRune.id));
assert.ok(!veteranCards.includes(mindRune.id));
assert.ok(!veteranCards.includes(elderEpic.id));
assert.ok(mysticCards.includes(cursedSarcophagus.id));
assert.ok(!mysticCards.includes(riftEpic.id));
assert.ok(daringCards.includes(theRuination.id));
assert.equal(UNLEASHED_BOARD_THREE_SPOTS.filter(spot => cardBelongsToUnleashedBoardThreeSpot(promoRune, spot)).length, 0);
assert.equal(UNLEASHED_BOARD_THREE_SPOTS.filter(spot => cardBelongsToUnleashedBoardThreeSpot(commonFury, spot)).length, 0);
assert.equal(UNLEASHED_BOARD_THREE_SPOTS.filter(spot => cardBelongsToUnleashedBoardThreeSpot(promoVilemaw, spot)).length, 0);

const keepBoardTwo = addCard('Keep Board Two', '900', { setCode: 'VEN', setName: 'Vendetta' });
const keepBoardFour = addCard('Keep Board Four', '902', { setCode: 'SFD', setName: 'Spiritforged' });
database.prepare("INSERT INTO app_metadata (key, value) VALUES ('break-board-working-preset-slot-v1', '2')").run();
database.prepare("INSERT INTO app_metadata (key, value) VALUES ('unleashed-board-3-23-color-poros-special-chases-2026-09-24-v1', 'old')").run();
database.prepare("INSERT INTO app_metadata (key, value) VALUES ('unleashed-board-3-23-color-poros-special-chases-2026-09-24-v2', 'old')").run();
database.prepare("INSERT INTO break_board_presets (slot, name, saved_at, mapping_mode) VALUES (2, 'Keep Board 2', 'old', 'MAPPED')").run();
database.prepare("INSERT INTO break_board_presets (slot, name, saved_at, mapping_mode) VALUES (3, 'Replace Board 3', 'old', 'SINGLES')").run();
database.prepare("INSERT INTO break_board_presets (slot, name, saved_at, mapping_mode) VALUES (4, 'Keep Board 4', 'old', 'MAPPED')").run();
database.prepare("INSERT INTO break_board_preset_cards (slot, position, card_id, added_at) VALUES (2, 1, ?, 'old')").run(keepBoardTwo.id);
const insertLegacyBoardThreeCard = database.prepare("INSERT INTO break_board_preset_cards (slot, position, card_id, added_at) VALUES (3, ?, ?, 'old')");
prepared.spots.slice(0, 19).forEach(spot => insertLegacyBoardThreeCard.run(spot.definition.position, spot.anchor.id));
database.prepare("INSERT INTO break_board_preset_cards (slot, position, card_id, added_at) VALUES (4, 1, ?, 'old')").run(keepBoardFour.id);
database.prepare("INSERT INTO break_board_cards (card_id, position, added_at) VALUES (?, 1, 'old')").run(keepBoardTwo.id);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM break_board_preset_cards WHERE slot = 3').get().count, 19);

const seeded = ensureUnleashedBoardThree(database);
assert.equal(seeded.seeded, true);
assert.equal(seeded.savedCards, 23);
assert.equal(seeded.loadedWorkingBoard, false);
assert.equal(database.prepare('SELECT name FROM break_board_presets WHERE slot = 3').get().name, UNLEASHED_BOARD_THREE_NAME);
assert.equal(database.prepare('SELECT mapping_mode FROM break_board_presets WHERE slot = 3').get().mapping_mode, 'MAPPED');
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM break_board_preset_cards WHERE slot = 3').get().count, 23);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM break_board_custom_spots WHERE slot = 3').get().count, 23);
assert.equal(database.prepare("SELECT COUNT(*) AS count FROM break_board_custom_spot_cards WHERE slot = 3 AND addition_type = 'ANCHOR'").get().count, 23);
assert.equal(database.prepare('SELECT name FROM break_board_presets WHERE slot = 2').get().name, 'Keep Board 2');
assert.equal(database.prepare('SELECT name FROM break_board_presets WHERE slot = 4').get().name, 'Keep Board 4');
assert.equal(database.prepare('SELECT card_id FROM break_board_cards WHERE position = 1').get().card_id, keepBoardTwo.id);
assert.ok(database.prepare('SELECT value FROM app_metadata WHERE key = ?').get(UNLEASHED_BOARD_THREE_MIGRATION_KEY)?.value);

const savedMapping = loadPresetCustomMapping(database, 3);
assert.equal(savedMapping.spots.length, 23);
assert.deepEqual(savedMapping.spots.map(spot => spot.label), UNLEASHED_BOARD_THREE_SPOTS.map(spot => spot.label));
assert.deepEqual(savedMapping.spots[19].cards.map(card => collectorNumberKey(card.card_number)), ['60A', '60']);
assert.deepEqual(savedMapping.spots[20].cards.map(card => collectorNumberKey(card.card_number)), ['118A', '118']);
assert.deepEqual(savedMapping.spots[21].cards.map(card => collectorNumberKey(card.card_number)), ['179A', '179']);
assert.deepEqual(savedMapping.spots[12].cards.map(card => collectorNumberKey(card.card_number)), ['238', '147A', '147']);
assert.ok(savedMapping.spots[15].cards.some(card => collectorNumberKey(card.card_number) === 'R03A'));
assert.ok(!savedMapping.spots[15].cards.some(card => collectorNumberKey(card.card_number) === 'R04A'));
assert.ok(savedMapping.spots[16].cards.some(card => collectorNumberKey(card.card_number) === 'R04A'));
assert.ok(!savedMapping.spots[16].cards.some(card => collectorNumberKey(card.card_number) === 'R03A'));

database.prepare("UPDATE break_board_presets SET name = 'User Renamed Board 3' WHERE slot = 3").run();
const skipped = ensureUnleashedBoardThree(database);
assert.equal(skipped.reason, 'already-installed');
assert.equal(database.prepare('SELECT name FROM break_board_presets WHERE slot = 3').get().name, 'User Renamed Board 3');

database.close();
console.log('Unleashed 23-spot Board 3 color-Poro mapping checks passed.');
