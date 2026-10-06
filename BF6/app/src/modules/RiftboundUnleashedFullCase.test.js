'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { formatBreakBoardListing } = require('./BreakBoard');
const {
  UNLEASHED_FULL_CASE_BOARD_NAME,
  UNLEASHED_FULL_CASE_MIGRATION_KEY,
  UNLEASHED_FULL_CASE_SPOTS,
  ensureUnleashedFullCaseBoardFive,
  fullCaseSpotLabel,
  isGearOrSpell,
  prepareUnleashedFullCaseBoard
} = require('./RiftboundUnleashedFullCase');

const EXPECTED_LABELS = Object.freeze([
  'Baron',
  'Master Yi',
  'Vex',
  'Ivern',
  "Kha'Zix",
  'Vi',
  'Jhin',
  'Pyke',
  'LeBlanc',
  'Diana',
  'Poppy',
  'Rengar',
  'Lillia',
  'Elder Dragon',
  'Lonely Poro',
  'Red Brambleback / Irresistible Faefolk',
  'Plundering Poro',
  'Alpha Wildclaw / Inviolus Vox / Arachnoid Horror',
  'Pouty Poro',
  'All Rune Alts',
  'All Gears / All Spells',
  'Veteran Poro',
  'Mystic Poro',
  'Vilemaw',
  'Daring Poro',
  'Rift Herald / Blue Sentinel'
]);

assert.equal(UNLEASHED_FULL_CASE_SPOTS.length, 26);
assert.deepEqual(UNLEASHED_FULL_CASE_SPOTS.map(fullCaseSpotLabel), EXPECTED_LABELS);
assert.deepEqual(UNLEASHED_FULL_CASE_SPOTS.map(spot => spot.position), Array.from({ length: 26 }, (_value, index) => index + 1));
assert.equal(UNLEASHED_FULL_CASE_SPOTS.filter(spot => spot.kind === 'champion-split').length, 12);
assert.equal(UNLEASHED_FULL_CASE_SPOTS.filter(spot => spot.kind === 'poro-rares').length, 6);
assert.equal(UNLEASHED_FULL_CASE_SPOTS.filter(spot => spot.kind === 'gear-spell').length, 1);
assert.equal(UNLEASHED_FULL_CASE_SPOTS.filter(spot => spot.kind === 'runes').length, 1);

const database = new DatabaseSync(':memory:');
database.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE app_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE cards (
    id INTEGER PRIMARY KEY, game_code TEXT, set_code TEXT, set_name TEXT,
    name TEXT, card_number TEXT, rarity TEXT, source_rarity TEXT,
    break_rarity TEXT, collector_treatment TEXT, variant TEXT,
    manual_category TEXT, card_type TEXT, color TEXT, colors TEXT,
    domain TEXT, domains TEXT, card_traits TEXT, traits TEXT, champion TEXT,
    champion_name TEXT, details_json TEXT, image_path TEXT, image_url TEXT
  );
  CREATE TABLE break_board_presets (
    slot INTEGER PRIMARY KEY, name TEXT NOT NULL, saved_at TEXT NOT NULL,
    mapping_mode TEXT NOT NULL DEFAULT 'MAPPED'
  );
  CREATE TABLE break_board_preset_cards (
    slot INTEGER NOT NULL, position INTEGER NOT NULL, card_id INTEGER NOT NULL,
    added_at TEXT NOT NULL, PRIMARY KEY(slot,position), UNIQUE(slot,card_id)
  );
  CREATE TABLE break_board_cards (
    card_id INTEGER NOT NULL UNIQUE, position INTEGER PRIMARY KEY, added_at TEXT NOT NULL
  );
  CREATE TABLE break_board_custom_spots (
    slot INTEGER NOT NULL, position INTEGER NOT NULL, label TEXT NOT NULL,
    updated_at TEXT NOT NULL, PRIMARY KEY(slot,position)
  );
  CREATE TABLE break_board_custom_spot_cards (
    slot INTEGER NOT NULL, position INTEGER NOT NULL, card_id INTEGER NOT NULL,
    sort_order INTEGER NOT NULL, addition_type TEXT NOT NULL, updated_at TEXT NOT NULL,
    PRIMARY KEY(slot,position,card_id), UNIQUE(slot,card_id)
  );
`);

let nextId = 1;
const insertedNumbers = new Set();
const insertCard = database.prepare(`
  INSERT INTO cards (
    id, game_code, set_code, set_name, name, card_number, rarity, source_rarity,
    break_rarity, collector_treatment, variant, manual_category, card_type,
    color, colors, domain, domains, card_traits, traits, champion, champion_name,
    details_json, image_path, image_url
  ) VALUES (?, 'RIFTBOUND', 'UNL', 'Unleashed', ?, ?, ?, ?, ?, ?, '', '', ?, ?, '', ?, '', '', '', ?, ?, ?, '', ?)
`);

function numberKey(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^UNL-/, '')
    .split('/')[0]
    .replace(/^0+(?=\d)/, '');
}

function addCard(name, number, options = {}) {
  const key = numberKey(number);
  if (insertedNumbers.has(key)) return;
  insertedNumbers.add(key);
  const id = nextId++;
  const rarity = options.rarity || 'Rare';
  const domain = options.domain || '';
  const champion = options.champion || '';
  insertCard.run(
    id,
    name,
    `UNL-${number}/219`,
    rarity,
    rarity,
    rarity,
    options.treatment || '',
    options.cardType || 'Unit',
    domain,
    domain,
    champion,
    champion,
    JSON.stringify({ champion }),
    `https://example.test/${id}.jpg`
  );
}

function championCardOptions(index, number, champion) {
  if (String(number).endsWith('*')) return { rarity: 'Ultimate', treatment: 'Signature', cardType: 'Champion Unit', champion };
  if (index === 1) return { rarity: 'Ultimate', treatment: 'Overnumbered', cardType: 'Champion Unit', champion };
  if (String(number).endsWith('A')) return { rarity: 'Showcase', treatment: 'Alternate Art', cardType: 'Champion Unit', champion };
  if (index <= 5) return { rarity: 'Epic', cardType: index === 5 ? 'Spell' : 'Champion Unit', champion };
  return { rarity: 'Rare', cardType: 'Champion Unit', champion };
}

const memberPrintings = Object.freeze({
  'Elder Dragon': ['118A', '118'],
  'Red Brambleback': ['029A', '029'],
  'Irresistible Faefolk': ['112'],
  'Alpha Wildclaw': ['057'],
  'Inviolus Vox': ['027'],
  'Arachnoid Horror': ['117'],
  'Baron Nashor': ['238', '147A', '147'],
  Vilemaw: ['060A', '060'],
  'Rift Herald': ['179A', '179'],
  'Blue Sentinel': ['087A', '087']
});

for (const spot of UNLEASHED_FULL_CASE_SPOTS) {
  if (spot.kind === 'champion-split') {
    spot.ownedNumbers.forEach((number, index) => addCard(
      numberKey(number) === numberKey(spot.anchorNumber) ? spot.anchor : `${spot.champion}, Family Card ${index + 1}`,
      number,
      championCardOptions(index, number, spot.champion)
    ));
    continue;
  }
  if (spot.kind === 'runes') {
    const domains = ['Fury', 'Calm', 'Mind', 'Body', 'Chaos', 'Order'];
    spot.poolNumbers.forEach((number, index) => addCard(`${domains[index]} Rune`, number, {
      rarity: 'Showcase', treatment: 'Alternate Art', cardType: 'Rune', domain: domains[index]
    }));
    continue;
  }
  if (spot.kind === 'gear-spell') {
    addCard('Gutter Palace', spot.anchorNumber, { rarity: 'Epic', cardType: 'Gear', domain: 'Mind' });
    continue;
  }
  if (spot.kind === 'poro-rares') {
    addCard(spot.poro, spot.anchorNumber, { rarity: 'Showcase', cardType: 'Unit', domain: spot.domain });
    continue;
  }
  for (const member of spot.members) {
    for (const number of memberPrintings[member] || []) {
      addCard(member, number, {
        rarity: String(number).endsWith('A') ? 'Showcase' : member === 'Irresistible Faefolk' ? 'Rare' : 'Epic',
        treatment: String(number).endsWith('A') ? 'Alternate Art' : number === '238' ? 'Overnumbered' : '',
        cardType: 'Unit'
      });
    }
  }
}

const poroRareUnits = Object.freeze([
  ['Grim Apothecary', '021', 'Fury'],
  ['Katarina, Reckless', '023', 'Fury'],
  ['Undying Legion', '025', 'Fury'],
  ['Xerath, Freed', '026', 'Fury'],
  ['Iascylla', '050', 'Calm'],
  ['Nami, Headstrong', '052', 'Calm'],
  ['Scuttle Crab', '053', 'Calm'],
  ['Yuumi, Magical Cat', '056', 'Calm'],
  ['Determined Sentry', '111', 'Body'],
  ['Nidalee, Cat Form', '114', 'Body'],
  ['Nilah, Joyful Ascetic', '115', 'Body'],
  ['Hwei, Brooding Painter', '080', 'Mind'],
  ['Sprite Queen', '084', 'Mind'],
  ['Zilean, Time Mage', '086', 'Mind'],
  ['Evelynn, Entrancing', '141', 'Chaos'],
  ['Maduli, The Gatekeeper', '144', 'Chaos'],
  ['Syndra, Transcendent', '146', 'Chaos'],
  ['Ashe, Focused', '169', 'Order'],
  ['Atakhan', '170', 'Order'],
  ['Galio, Indefatigable', '171', 'Order']
]);
for (const [name, number, domain] of poroRareUnits) {
  addCard(name, number, { rarity: 'Rare', cardType: name.includes(',') ? 'Champion Unit' : 'Unit', domain });
}

const unreservedGearAndSpells = Object.freeze([
  ['Dancing Grenade', '020', 'Rare', 'Spell', 'Fury'],
  ['Honeyfruit', '049', 'Rare', 'Gear', 'Calm'],
  ['Clash of Giants', '110', 'Rare', 'Spell', 'Body'],
  ['Smoke and Mirrors', '083', 'Rare', 'Spell', 'Mind'],
  ['Bone Skewer', '139', 'Rare', 'Spell', 'Chaos'],
  ['Shard of Undoing', '174', 'Rare', 'Gear', 'Order'],
  ['Common Test Gear', '010', 'Common', 'Gear', 'Fury'],
  ['Uncommon Test Spell', '011', 'Uncommon', 'Spell', 'Calm']
]);
for (const [name, number, rarity, type, domain] of unreservedGearAndSpells) {
  addCard(name, number, { rarity, cardType: type, domain });
}

addCard('Unassigned Test Unit', '999', { rarity: 'Common', cardType: 'Unit', domain: 'Fury' });

const catalog = database.prepare("SELECT * FROM cards WHERE set_code='UNL'").all();
const prepared = prepareUnleashedFullCaseBoard(catalog);
assert.equal(prepared.ready, true);
assert.equal(prepared.spots.length, 26);

const copiedTitles = formatBreakBoardListing(prepared.spots.map(spot => ({
  ...spot.anchor,
  position: spot.definition.position,
  break_spot_label: fullCaseSpotLabel(spot.definition)
}))).split('\n').map(line => line.split('\t')[0]);
assert.equal(copiedTitles[0], '1 — 💀 Baron 💀');
assert.deepEqual(copiedTitles.slice(1, 13), EXPECTED_LABELS.slice(1, 13).map((label, index) => `${index + 2} — 💎 ${label} 💎`));
assert.equal(copiedTitles[13], '14 — 💣 Elder Dragon 💣');
assert.equal(copiedTitles[17], '18 — Alpha Wildclaw / Inviolus Vox / Arachnoid Horror');
assert.equal(copiedTitles[20], '21 — All Gears / All Spells');
assert.ok(copiedTitles.every(title => (title.match(/[💎🔥💣💀]/gu) || []).length <= 2),
  'Copied titles may use only one matching first-card symbol at each edge.');

for (const spot of prepared.spots.filter(candidate => candidate.definition.kind === 'champion-split')) {
  assert.equal(spot.cards.length, 8, `${spot.definition.champion} must own its complete eight-card family`);
  assert.equal(spot.cards[0].id, spot.anchor.id, `${spot.definition.champion} Signature must stay first`);
}

const positionForLabel = label => EXPECTED_LABELS.indexOf(label) + 1;
const cardsAt = label => prepared.spots[positionForLabel(label) - 1].cards;
for (const [poro, _number, domain] of [
  ['Pouty Poro', '220', 'Fury'],
  ['Lonely Poro', '221', 'Calm'],
  ['Plundering Poro', '222', 'Mind'],
  ['Veteran Poro', '223', 'Body'],
  ['Mystic Poro', '224', 'Chaos'],
  ['Daring Poro', '225', 'Order']
]) {
  const cards = cardsAt(poro);
  assert.equal(cards[0].name, poro, `${poro} must be the visible anchor`);
  assert.ok(cards.some(card => card.rarity === 'Rare' && card.color === domain && !isGearOrSpell(card)),
    `${poro} must receive its ${domain} Rare units`);
  assert.equal(cards.some(isGearOrSpell), false, `${poro} must not duplicate the Gear/Spell listing`);
}

const gearSpellCards = cardsAt('All Gears / All Spells');
assert.ok(gearSpellCards.some(card => card.name === 'Dancing Grenade'));
assert.ok(gearSpellCards.some(card => card.name === 'Gutter Palace'), 'Epic Gear hits must remain included.');
assert.equal(gearSpellCards.some(card => card.name === 'Common Test Gear'), false);
assert.equal(gearSpellCards.some(card => card.name === 'Uncommon Test Spell'), false);
assert.equal(gearSpellCards.every(isGearOrSpell), true);
assert.equal(gearSpellCards.some(card => ['Common', 'Uncommon'].includes(card.rarity)), false,
  'Common and Uncommon Gear/Spell cards must be excluded.');
assert.equal(gearSpellCards.some(card => card.name.includes('Family Card')), false,
  'Champion-owned Gear/Spell cards must remain with their champion.');

assert.equal(cardsAt('All Rune Alts').length, 6);
assert.deepEqual(cardsAt('Red Brambleback / Irresistible Faefolk').map(card => card.name),
  ['Red Brambleback', 'Red Brambleback', 'Irresistible Faefolk']);
assert.equal(cardsAt('Alpha Wildclaw / Inviolus Vox / Arachnoid Horror').length, 3);
assert.equal(cardsAt('Rift Herald / Blue Sentinel').length, 4);
assert.equal(cardsAt('Baron').length, 3);

const allMappedIds = prepared.spots.flatMap(spot => spot.cards.map(card => card.id));
assert.equal(new Set(allMappedIds).size, allMappedIds.length, 'No card may belong to two Board 5 spots.');

database.prepare("INSERT INTO break_board_presets (slot,name,saved_at,mapping_mode) VALUES (5,'Old Board 5','old','MAPPED')").run();
database.prepare("INSERT INTO break_board_preset_cards (slot,position,card_id,added_at) VALUES (5,1,?,'old')").run(nextId - 1);
database.prepare("INSERT INTO app_metadata (key,value) VALUES ('break-board-working-preset-slot-v1','5')").run();
database.prepare("INSERT INTO app_metadata (key,value) VALUES ('unleashed-board-5-26-character-case-2026-09-21-v7','old')").run();

const seeded = ensureUnleashedFullCaseBoardFive(database);
assert.equal(seeded.seeded, true, 'The corrected migration must replace the former 26-spot Board 5.');
assert.equal(seeded.slot, 5);
assert.equal(seeded.savedCards, 26);
assert.equal(database.prepare('SELECT name FROM break_board_presets WHERE slot=5').get().name, UNLEASHED_FULL_CASE_BOARD_NAME);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM break_board_preset_cards WHERE slot=5').get().count, 26);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM break_board_custom_spots WHERE slot=5').get().count, 26);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM break_board_cards').get().count, 26);
assert.ok(database.prepare('SELECT value FROM app_metadata WHERE key=?').get(UNLEASHED_FULL_CASE_MIGRATION_KEY)?.value);

const savedLabels = database.prepare('SELECT label FROM break_board_custom_spots WHERE slot=5 ORDER BY position').all().map(row => row.label);
assert.deepEqual(savedLabels, EXPECTED_LABELS);

const savedPositionForCard = name => database.prepare(`
  SELECT m.position FROM break_board_custom_spot_cards m
  JOIN cards c ON c.id = m.card_id
  WHERE m.slot = 5 AND c.name = ?
  ORDER BY m.position LIMIT 1
`).get(name)?.position;
assert.equal(savedPositionForCard('Katarina, Reckless'), positionForLabel('Pouty Poro'));
assert.equal(savedPositionForCard('Nami, Headstrong'), positionForLabel('Lonely Poro'));
assert.equal(savedPositionForCard('Hwei, Brooding Painter'), positionForLabel('Plundering Poro'));
assert.equal(savedPositionForCard('Nidalee, Cat Form'), positionForLabel('Veteran Poro'));
assert.equal(savedPositionForCard('Dancing Grenade'), positionForLabel('All Gears / All Spells'));

const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
assert.match(mainSource, /isUnleashedExpandedBreakBoard\(rows\)\s*\|\|\s*isUnleashedFullCaseBreakBoard\(rows\)/,
  'Board 5 must be exempt from the legacy Rune-removal cleanup.');
assert.equal(ensureUnleashedFullCaseBoardFive(database).reason, 'already-installed');

console.log('Unleashed 26-spot character case Board 5 tests passed.');
