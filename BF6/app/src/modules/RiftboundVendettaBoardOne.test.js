'use strict';

const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { riftboundCardSupplements } = require('./RiftboundCardSupplements');
const { loadPresetCustomMapping } = require('./BreakBoardCustomMapping');
const { formatBreakBoardListing } = require('./BreakBoard');
const { linearOverlayProfileForCustomMapping, linearOverlayProfileForPresetSlot } = require('./RiftboundLinearOverlay');
const {
  VENDETTA_BOARD_ONE_MIGRATION_KEY,
  VENDETTA_BOARD_ONE_SPOTS,
  ensureVendettaBoardOne,
  isVendettaBoardOne,
  prepareVendettaBoardOne
} = require('./RiftboundVendettaBoardOne');

const database = new DatabaseSync(':memory:');
database.exec(`
  CREATE TABLE app_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE cards (
    id INTEGER PRIMARY KEY, game_code TEXT, set_code TEXT, name TEXT,
    card_number TEXT, rarity TEXT, variant TEXT, card_type TEXT,
    image_url TEXT, source_rarity TEXT, collector_treatment TEXT,
    variant_source TEXT, manual_category TEXT, product_name TEXT,
    champion TEXT, details_json TEXT
  );
  CREATE TABLE break_board_presets (
    slot INTEGER PRIMARY KEY, name TEXT NOT NULL, saved_at TEXT NOT NULL,
    mapping_mode TEXT NOT NULL DEFAULT 'MAPPED'
  );
  CREATE TABLE break_board_preset_cards (
    slot INTEGER NOT NULL, position INTEGER NOT NULL, card_id INTEGER NOT NULL,
    added_at TEXT NOT NULL, PRIMARY KEY(slot, position)
  );
  CREATE TABLE break_board_cards (
    card_id INTEGER NOT NULL, position INTEGER PRIMARY KEY, added_at TEXT NOT NULL
  );
  CREATE TABLE break_board_custom_spots (
    slot INTEGER NOT NULL, position INTEGER NOT NULL, label TEXT NOT NULL,
    updated_at TEXT NOT NULL, PRIMARY KEY(slot, position)
  );
  CREATE TABLE break_board_custom_spot_cards (
    slot INTEGER NOT NULL, position INTEGER NOT NULL, card_id INTEGER NOT NULL,
    sort_order INTEGER NOT NULL, addition_type TEXT NOT NULL, updated_at TEXT NOT NULL,
    PRIMARY KEY(slot, position, card_id), UNIQUE(slot, card_id)
  );
`);
const insertCard = database.prepare(`
  INSERT INTO cards (game_code, set_code, name, card_number, rarity, variant, card_type, image_url)
  VALUES ('RIFTBOUND', 'VEN', ?, ?, ?, ?, ?, ?)
`);
for (const card of riftboundCardSupplements().filter(card => card.set_code === 'VEN')) {
  insertCard.run(card.name, card.card_number, card.rarity, card.variant, card.card_type, card.image_url);
}
insertCard.run('Vi, Destructive', 'VEN-001/166', 'Rare', '', 'Unit', '');
insertCard.run('Zed, From the Shadows', 'VEN-023/166', 'Epic', '', 'Unit', '');
insertCard.run('Helm of Suppression', 'VEN-045B/166', 'Common', '', 'Gear', '');
insertCard.run('Extra Spell', 'VEN-059/166', 'Rare', '', 'Spell', '');
insertCard.run('Extra Gear', 'VEN-060/166', 'Common', '', 'Gear', '');
insertCard.run('Vi, Counterplay', 'VEN-061/166', 'Rare', '', 'Spell', '');
insertCard.run('Inventor Tools', 'VEN-062/166', 'Epic', '', 'Gear', '');
database.prepare("UPDATE cards SET details_json = '{\"championName\":\"Jayce\"}' WHERE card_number = 'VEN-062/166'").run();
insertCard.run('The Wolf\'s Arsenal', 'VEN-064/166', 'Rare', '', 'Gear', '');
database.prepare("UPDATE cards SET champion = 'Ambessa' WHERE card_number = 'VEN-064/166'").run();
insertCard.run('Marked Spell', 'VEN-065/166', 'Rare', '', 'Spell', '');
database.prepare("UPDATE cards SET variant_source = 'Event promo' WHERE card_number = 'VEN-065/166'").run();
insertCard.run('Marked Gear', 'VEN-066/166', 'Epic', '', 'Gear', '');
database.prepare("UPDATE cards SET product_name = 'Promotional event pack' WHERE card_number = 'VEN-066/166'").run();
insertCard.run('Shuriken Flip', 'VEN-140A/166', 'Showcase', 'Alternate Art', 'Spell', '');
insertCard.run('Acceleration Gate', 'VEN-150A/166', 'Showcase', 'Alternate Art', 'Spell', '');
database.prepare("UPDATE cards SET variant_source = 'Promo distribution' WHERE card_number = 'VEN-150A/166'").run();
insertCard.run('Zed, Event Exclusive', 'VEN-024/166', 'Epic', 'Promo', 'Unit', '');
insertCard.run('Helm of Suppression', 'VEN-045/166', 'Epic', 'Promo', 'Gear', 'https://promo.example/image');
insertCard.run('Kai\'Sa, Survivor', 'VEN-SP1/006', 'Showcase', 'Promo', 'Unit', 'https://promo.example/image');
database.prepare("INSERT INTO break_board_presets VALUES (2, 'Keep Board 2', 'old', 'SINGLES')").run();
database.prepare("INSERT INTO app_metadata VALUES ('break-board-working-preset-slot-v1', '1')").run();

const catalog = database.prepare('SELECT * FROM cards').all();
const prepared = prepareVendettaBoardOne(catalog);
assert.equal(prepared.ready, true, JSON.stringify(prepared));
assert.equal(prepared.spots.length, 33);
assert.equal(VENDETTA_BOARD_ONE_SPOTS.length, 33);
assert.equal(new Set(prepared.spots.flatMap(spot => spot.cards.map(card => card.id))).size, prepared.mappedCards);
assert.equal(prepareVendettaBoardOne(catalog.filter(card => card.card_number !== 'VEN-197*/166')).reason, 'missing-catalog-cards');
const incompleteMetadata = catalog.map(card =>
  ['VEN-189*/166', 'VEN-167/166', 'VEN-045/166', 'VEN-R06B', 'VEN-140/166'].includes(card.card_number)
    ? { ...card, name: 'Unknown', rarity: 'Common', variant: '', card_type: '' }
    : card
);
assert.equal(prepareVendettaBoardOne(incompleteMetadata).ready, true);
assert.ok(prepareVendettaBoardOne(incompleteMetadata).spots[0].cards.some(card => card.card_number === 'VEN-140/166'));

const temporarilyMissing = database.prepare("SELECT * FROM cards WHERE card_number = 'VEN-197*/166'").get();
database.prepare('DELETE FROM cards WHERE id = ?').run(temporarilyMissing.id);
const pending = ensureVendettaBoardOne(database);
assert.equal(pending.reason, 'missing-catalog-cards');
assert.match(database.prepare("SELECT value FROM app_metadata WHERE key LIKE 'vendetta-board-1-33-install-status-%'").get().value, /VEN-197\*/);
insertCard.run(temporarilyMissing.name, temporarilyMissing.card_number, temporarilyMissing.rarity,
  temporarilyMissing.variant, temporarilyMissing.card_type, temporarilyMissing.image_url);
database.prepare("INSERT INTO app_metadata VALUES ('vendetta-board-1-33-champions-on-2026-09-27-v1', 'installed-by-0.3.370')").run();
database.prepare("INSERT INTO break_board_presets VALUES (1, 'Old Board 1', 'old', 'SINGLES')").run();
database.prepare("INSERT INTO break_board_preset_cards VALUES (1, 1, 1, 'old')").run();

const seeded = ensureVendettaBoardOne(database);
assert.equal(seeded.seeded, true);
assert.equal(seeded.savedCards, 33);
assert.equal(seeded.loadedWorkingBoard, true);
assert.equal(database.prepare("SELECT COUNT(*) AS n FROM break_board_preset_cards WHERE slot = 1").get().n, 33);
assert.equal(database.prepare("SELECT name FROM break_board_presets WHERE slot = 1").get().name, 'Vendetta · 33 Spots · Champions + ON');
assert.equal(database.prepare("SELECT COUNT(*) AS n FROM break_board_cards").get().n, 33);
assert.equal(database.prepare("SELECT name FROM break_board_presets WHERE slot = 2").get().name, 'Keep Board 2');
assert.ok(database.prepare('SELECT value FROM app_metadata WHERE key = ?').get(VENDETTA_BOARD_ONE_MIGRATION_KEY));
assert.equal(database.prepare("SELECT value FROM app_metadata WHERE key LIKE 'vendetta-board-1-33-install-status-%'").get(), undefined);

const mapping = loadPresetCustomMapping(database, 1);
assert.equal(mapping.spots.length, 33);
assert.equal(linearOverlayProfileForCustomMapping(mapping)?.id, 'vendetta-board-1-33-linear');
assert.equal(linearOverlayProfileForPresetSlot(1)?.id, 'vendetta-board-1-33-linear');
assert.deepEqual(mapping.spots.map(spot => spot.cards.filter(card => card.mappingAdditionType === 'ANCHOR').length), Array(33).fill(1));
const board = database.prepare(`
  SELECT c.*, p.position FROM break_board_preset_cards p JOIN cards c ON c.id = p.card_id
  WHERE p.slot = 1 ORDER BY p.position
`).all();
assert.equal(isVendettaBoardOne(board), true);
const listingTitles = formatBreakBoardListing(board.map(card => ({
  ...card,
  custom_break_mapping: true,
  break_spot_label: mapping.spots[card.position - 1].label
}))).split('\n').map(line => line.split('\t')[0]);
assert.equal(listingTitles.length, 33);
assert.match(listingTitles[1], /^2 — .*Renekton · SIG VEN-190\* \+ ON VEN-190, VEN-177/);
assert.match(listingTitles[16], /^17 — .*Rengar · ON VEN-179/);
assert.ok(!listingTitles.some(title => /Renekton \+ Rengar|Zed \+ Gangplank|Nasus \+ Vi|Shen \+ Jinx/.test(title)));

function owner(number) {
  return database.prepare(`
    SELECT m.position FROM break_board_custom_spot_cards m JOIN cards c ON c.id = m.card_id
    WHERE m.slot = 1 AND c.card_number = ? LIMIT 1
  `).get(number)?.position;
}
assert.equal(owner('VEN-191*/166'), 3);
assert.equal(owner('VEN-191/166'), 3);
assert.equal(owner('VEN-169/166'), 3);
assert.equal(owner('VEN-023A/166'), 3);
for (const [index, number] of ['140', '142', '144', '146', '148', '150', '152', '154', '156'].entries()) {
  assert.equal(owner(`VEN-${number}/166`), index + 1, `signature Spell VEN-${number}`);
}
assert.equal(owner('VEN-140A/166'), 1);
assert.equal(owner('VEN-150A/166'), undefined);
assert.equal(owner('VEN-062/166'), 6);
assert.equal(owner('VEN-064/166'), 8);
assert.equal(owner('VEN-167/166'), 10);
assert.equal(owner('VEN-001/166'), 10);
assert.equal(owner('VEN-061/166'), 10);
assert.equal(owner('VEN-SP1/006'), 25);
assert.equal(owner('VEN-044/166'), 31);
assert.equal(owner('VEN-R06B'), 32);
assert.equal(owner('VEN-045/166'), 33);
assert.equal(owner('VEN-059/166'), 33);
assert.equal(owner('VEN-065/166'), undefined);
assert.equal(owner('VEN-066/166'), undefined);
assert.equal(owner('VEN-024/166'), undefined);
assert.equal(database.prepare(`
  SELECT COUNT(*) AS n FROM break_board_custom_spot_cards m JOIN cards c ON c.id = m.card_id
  WHERE m.slot = 1 AND c.variant = 'Promo'
`).get().n, 0);
assert.equal(owner('VEN-060/166'), undefined);
assert.equal(owner('VEN-045B/166'), undefined);
assert.equal(new Set(mapping.spots.flatMap(spot => spot.cards.map(card => card.id))).size, seeded.mappedCards);
for (let number = 167; number <= 197; number += 1) {
  assert.ok(owner(`VEN-${number}/166`), `missing ON VEN-${number}`);
}
assert.equal(ensureVendettaBoardOne(database).reason, 'already-installed');
database.close();
console.log('Vendetta 33-spot Board 1 ownership and install checks passed.');
