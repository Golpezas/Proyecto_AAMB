'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const profile = require('./RiftboundComboVisualProfile');

assert.equal(profile.COMBO_VISUAL_SPOTS.length, 17);
assert.equal(profile.COMBO_CHAMPION_SPOTS.length, 11);
assert.equal(profile.COMBO_PORO_SPOTS.length, 6);
assert.equal(profile.COMBO_CRYSTAL_ROSE_SPOTS.length, 6); // compatibility/color lookup table
assert.equal(profile.COMBO_BARON_SPOT.anchor, 'Baron Nashor');
assert.equal(profile.COMBO_CHAMPION_SPOTS.find(s => s.anchor === 'Akali').displayLabel, 'Akali + Ivern');
assert.equal(profile.COMBO_CHAMPION_SPOTS.find(s => s.anchor === 'Diana').displayLabel, 'Diana + Kennen');
assert.equal(profile.COMBO_CHAMPION_SPOTS.find(s => s.anchor === 'Zed').displayLabel, "Zed + Kha'Zix");
assert.equal(profile.COMBO_CHAMPION_SPOTS.find(s => s.anchor === 'Pyke').displayLabel, 'Pyke + Jhin');
assert.equal(profile.COMBO_CHAMPION_SPOTS.find(s => s.anchor === 'Baron Nashor').displayLabel, 'Baron + Renekton');
assert.equal(profile.COMBO_PORO_SPOTS.find(s => s.anchor === 'Pouty Poro').displayLabel, "Pouty Poro + Kai'Sa SP");

assert.deepEqual(profile.COMBO_CHAMPION_SPOTS.map(s => [s.anchor, [...s.extraOnChampions]]), [
  ['Akali', ['Irelia']],
  ['Diana', ['Leona']],
  ['Zed', ['Riven']],
  ['Jayce', ['Viktor']],
  ['Mel', ['Kayle']],
  ['LeBlanc', ['Morgana']],
  ['Nasus', ['Illaoi']],
  ['Vex', ['Swain']],
  ['Vi', ['Jinx']],
  ['Pyke', ['Draven']],
  ['Baron Nashor', ['Gangplank']]
]);

// Every standalone rival ON must bring the same champion's regular VEN Epic.
// This checks all 11 mappings, not only the representative Leona lane below.
profile.COMBO_CHAMPION_SPOTS.forEach((spot, index) => {
  const name = spot.extraOnChampions[0];
  const family = profile.cardsForChampionSpot([
    { id: 800 + index * 3, set_code: 'VEN', name: `${name}, Rival`, card_number: `${180 + index}/166`, rarity: 'Legend', collector_treatment: 'Overnumbered' },
    { id: 801 + index * 3, set_code: 'VEN', name: `${name}, Regular Epic`, card_number: `${80 + index}/166`, rarity: 'Epic', manual_category: 'Standard' },
    { id: 802 + index * 3, set_code: 'VEN', name: `${name}, Epic AA`, card_number: `${80 + index}a/166`, rarity: 'Epic', collector_treatment: 'Alternate Art' }
  ], spot);
  assert.ok(family.some(card => card.collector_treatment === 'Overnumbered'), `${name} ON should be present`);
  assert.ok(family.some(card => card.rarity === 'Epic' && card.manual_category === 'Standard'), `${name} regular Epic should be present`);
  assert.ok(!family.some(card => card.collector_treatment === 'Alternate Art'), `${name} Epic AA should not be added by the standalone mapping`);
});


const catalog = [
  { id: 1, set_code: 'UNL', name: 'Diana, Lunari', card_number: '079/219', rarity: 'Rare' },
  { id: 2, set_code: 'UNL', name: 'Diana, Scorn of the Moon', card_number: '234/219', rarity: 'Legend', collector_treatment: 'Signature' },
  { id: 3, set_code: 'UNL', name: 'Ivern, Nurturer', card_number: '051/219', rarity: 'Rare' },
  { id: 4, set_code: 'VEN', name: 'Diana, Rival', card_number: '184/166', rarity: 'Legend', collector_treatment: 'Overnumbered' },
  { id: 5, set_code: 'VEN', name: 'Leona, Rival', card_number: '185/166', rarity: 'Legend', collector_treatment: 'Overnumbered' },
  { id: 21, set_code: 'VEN', name: 'Leona, Radiant Dawn', card_number: '099/166', rarity: 'Epic', manual_category: 'Standard' },
  { id: 22, set_code: 'VEN', name: 'Leona, Radiant Dawn', card_number: '099a/166', rarity: 'Epic', collector_treatment: 'Alternate Art' },
  { id: 18, set_code: 'VEN', name: 'Kennen, Heart of the Tempest', card_number: '197/166', rarity: 'Legend', collector_treatment: 'Signature' },
  { id: 19, set_code: 'VEN', name: 'Akali, Rogue Assassin', card_number: '189/166', rarity: 'Legend', collector_treatment: 'Signature' },
  { id: 20, set_code: 'UNL', name: 'Ivern, The Green Father', card_number: '233/219', rarity: 'Legend', collector_treatment: 'Signature' },
  { id: 6, set_code: 'VEN', name: 'Illaoi, Prophet', card_number: '182/166', rarity: 'Legend', collector_treatment: 'Overnumbered' },
  { id: 7, set_code: 'UNL', name: 'Baron Nashor', card_number: '147/219', rarity: 'Epic' },
  { id: 8, set_code: 'UNL', name: 'Baron Nashor', card_number: '147a/219', rarity: 'Epic', collector_treatment: 'Alternate Art' },
  { id: 9, set_code: 'UNL', name: 'Baron Nashor', card_number: '238/219', rarity: 'Ultimate', collector_treatment: 'Overnumbered' },
  { id: 10, set_code: 'VEN', name: 'Renekton, Butcher', card_number: '145/166', rarity: 'Legend', collector_treatment: 'Signature' },
  { id: 11, set_code: 'VEN', name: 'Renekton, Rival', card_number: '178/166', rarity: 'Legend', collector_treatment: 'Overnumbered' },
  { id: 12, set_code: 'VEN', name: 'Gangplank, Naval', card_number: '181/166', rarity: 'Legend', collector_treatment: 'Overnumbered' },
  { id: 13, set_code: 'UNL', name: 'Pouty Poro', card_number: '221/219', rarity: 'Rare', collector_treatment: 'Overnumbered' },
  { id: 14, set_code: 'VEN', name: "Kai'Sa, Crystal Rose", card_number: 'VEN-SP1/006', rarity: 'SP' },
  { id: 15, set_code: 'VEN', name: 'Fury Rune', card_number: 'VEN-R01a', rarity: 'Showcase', collector_treatment: 'Alternate Art' },
  { id: 16, set_code: 'VEN', name: 'Endless Riches', card_number: '050/166', rarity: 'Epic', card_type: 'Spell' },
  { id: 17, set_code: 'VEN', name: 'Some Fury Gear', card_number: '051/166', rarity: 'Rare', card_type: 'Gear', domain: 'Fury' }
];

const diana = profile.buildVisualSpot(catalog, { id: 100, position: 2, set_code: 'UNL', name: 'Diana, Lunari' });
assert.equal(diana.visualOnly, true);
assert.equal(diana.displayLabel, 'Diana + Kennen');
assert.deepEqual(new Set(diana.family.map(c => c.id)), new Set([1, 2, 4, 5, 18, 21]));
assert.ok(!diana.family.some(c => c.id === 22), 'Standalone ON mapping should include the regular Epic, not its AA');
assert.equal(diana.listingNote, 'Diana + Kennen + Leona ON + Epic (VEN)');

const akali = profile.buildVisualSpot(catalog, { id: 104, position: 1, set_code: 'VEN', name: 'Akali, Rogue Assassin' });
assert.equal(akali.displayLabel, 'Akali + Ivern');
assert.deepEqual(new Set(akali.family.map(c => c.id)), new Set([3, 19, 20]));
assert.equal(akali.listingNote, 'Akali + Ivern + Irelia ON + Epic (VEN)');

const baron = profile.buildVisualSpot(catalog, { id: 101, position: 11, set_code: 'UNL', name: 'Baron Nashor' });
assert.equal(baron.displayLabel, 'Baron + Renekton');
assert.deepEqual(new Set(baron.family.map(c => c.id)), new Set([7, 8, 9, 10, 11, 12]));
assert.equal(baron.heroCards.length, 2);
assert.equal(baron.listingNote, 'Baron + Renekton + Gangplank ON + Epic (VEN)');
assert.equal(baron.heroCards[0].id, 9);
assert.equal(baron.heroCards[1].id, 10);

const pouty = profile.buildVisualSpot(catalog, { id: 102, position: 12, set_code: 'UNL', name: 'Pouty Poro', card_number: '221/219' });
assert.equal(pouty.displayLabel, "Pouty Poro + Kai'Sa SP");
assert.deepEqual(new Set(pouty.family.map(c => c.id)), new Set([13, 14, 15, 16, 17]));
assert.equal(pouty.heroCards.length, 2);
assert.equal(pouty.listingNote, "Pouty Poro + Kai'Sa SP");

// Standalone Crystal Rose anchors are intentionally disabled in the final 17-spot map.
assert.equal(profile.buildVisualSpot(catalog, { id: 103, set_code: 'VEN', name: "Kai'Sa, Crystal Rose", card_number: 'VEN-SP1/006' }), null);

// Guardrail: this profile must remain a pure visual layer and must not import
// ledger/order/history/database modules or contain write/update/delete SQL.
const source = fs.readFileSync(path.join(__dirname, 'RiftboundComboVisualProfile.js'), 'utf8');
assert.doesNotMatch(source, /BreakLedger|BreakOrderHistory|PullHistory|BusinessExpenses/);
assert.doesNotMatch(source, /\b(?:INSERT|UPDATE|DELETE|REPLACE)\b\s+/i);
assert.doesNotMatch(source, /database\.|\.prepare\s*\(/);

console.log('Riftbound 17-spot combined Unleashed + Vendetta visual-only mapping checks passed.');

// Combo hero cards are display-only Signature selections used by the popup/overlay.
const heroCatalog = [
  { id: 201, game_code: 'RIFTBOUND', set_code: 'UNL', name: 'Diana, Signature Hero', card_number: 'UNL-234*', manual_category: 'Signature' },
  { id: 202, game_code: 'RIFTBOUND', set_code: 'VEN', name: 'Kennen, Signature Hero', card_number: 'VEN-197*', manual_category: 'Signature' },
  { id: 203, game_code: 'RIFTBOUND', set_code: 'UNL', name: 'Diana, Lunari', card_number: 'UNL-079/219', rarity: 'Rare' },
  { id: 204, game_code: 'RIFTBOUND', set_code: 'VEN', name: 'Akali, Signature Hero', card_number: 'VEN-189*', manual_category: 'Signature' },
  { id: 205, game_code: 'RIFTBOUND', set_code: 'UNL', name: 'Ivern, Signature Hero', card_number: 'UNL-233*', manual_category: 'Signature' }
];
const dianaHeroes = profile.buildVisualSpot(heroCatalog, { id: 203, position: 2, set_code: 'UNL', name: 'Diana, Lunari' });
assert.equal(dianaHeroes.heroCards.length, 2);
assert.equal(dianaHeroes.heroCards[0].id, 201);
assert.equal(dianaHeroes.heroCards[1].id, 202);
const akaliHeroes = profile.buildVisualSpot(heroCatalog, { id: 204, position: 1, set_code: 'VEN', name: 'Akali, Signature Hero' });
assert.equal(akaliHeroes.displayLabel, 'Akali + Ivern');
assert.deepEqual(akaliHeroes.heroCards.map(c => c.id), [204, 205]);

// v0.3.232 visual-only color lock: swap Plundering->Ahri and Veteran->Sett,
// keep support cards in the custom visual domain, and move Rift Herald to Yellow/Order.
assert.equal(profile.COMBO_PORO_SPOTS.find(s => s.anchor === 'Plundering Poro').displayLabel, 'Plundering Poro + Ahri SP');
assert.equal(profile.COMBO_PORO_SPOTS.find(s => s.anchor === 'Plundering Poro').visualDomain, 'Mind');
assert.equal(profile.COMBO_PORO_SPOTS.find(s => s.anchor === 'Veteran Poro').displayLabel, 'Veteran Poro + Sett SP');
assert.equal(profile.COMBO_PORO_SPOTS.find(s => s.anchor === 'Veteran Poro').visualDomain, 'Body');
assert.equal(profile.COMBO_PORO_SPOTS.find(s => s.anchor === 'Daring Poro').visualDomain, 'Order');

const colorCatalog = [
  { id: 301, set_code: 'UNL', name: 'Plundering Poro', card_number: '223/219', rarity: 'Common', collector_treatment: 'Overnumbered' },
  { id: 302, set_code: 'VEN', name: 'Ahri, Crystal Rose', card_number: 'VEN-SP3/006', rarity: 'Epic' },
  { id: 303, set_code: 'UNL', name: 'Blue Sentinel', card_number: '087/219', rarity: 'Epic', domain: 'Mind' },
  { id: 304, set_code: 'UNL', name: 'Mind Rune', card_number: 'UNL-R03a', rarity: 'Showcase', collector_treatment: 'Alternate Art' },
  { id: 305, set_code: 'UNL', name: 'Hwei, Brooding Painter', card_number: '080/219', rarity: 'Rare', card_type: 'Champion Unit', domain: 'Mind' },
  { id: 306, set_code: 'UNL', name: 'Veteran Poro', card_number: '222/219', rarity: 'Common', collector_treatment: 'Overnumbered' },
  { id: 307, set_code: 'VEN', name: 'Sett, Crystal Rose', card_number: 'VEN-SP4/006', rarity: 'Epic' },
  { id: 308, set_code: 'UNL', name: 'Irresistible Faefolk', card_number: '112/219', rarity: 'Rare', card_type: 'Unit', domain: 'Body' },
  { id: 309, set_code: 'UNL', name: 'Elder Dragon', card_number: '118/219', rarity: 'Epic', card_type: 'Unit', domain: 'Body' },
  { id: 310, set_code: 'UNL', name: 'Body Rune', card_number: 'UNL-R04a', rarity: 'Showcase', collector_treatment: 'Alternate Art' },
  { id: 311, set_code: 'UNL', name: 'Daring Poro', card_number: '225/219', rarity: 'Common', collector_treatment: 'Overnumbered' },
  { id: 312, set_code: 'VEN', name: 'Lux, Crystal Rose', card_number: 'VEN-SP6/006', rarity: 'Epic' },
  { id: 313, set_code: 'UNL', name: 'Rift Herald', card_number: '179/219', rarity: 'Epic', card_type: 'Unit', domain: 'Order' },
  { id: 314, set_code: 'UNL', name: 'The Ruination', card_number: '180/219', rarity: 'Epic', card_type: 'Spell', domain: 'Order' },
  { id: 315, set_code: 'UNL', name: 'Order Rune', card_number: 'UNL-R06a', rarity: 'Showcase', collector_treatment: 'Alternate Art' },
  { id: 316, set_code: 'UNL', name: 'Mystic Poro', card_number: '220/219', rarity: 'Common', collector_treatment: 'Overnumbered' },
  { id: 317, set_code: 'VEN', name: 'Ezreal, Crystal Rose', card_number: 'VEN-SP5/006', rarity: 'Epic' },
  { id: 318, set_code: 'UNL', name: 'Chaos Rune', card_number: 'UNL-R05a', rarity: 'Showcase', collector_treatment: 'Alternate Art' }
];

const plunderingVisual = profile.buildVisualSpot(colorCatalog, { id: 301, position: 14, set_code: 'UNL', name: 'Plundering Poro' });
assert.equal(plunderingVisual.displayLabel, 'Plundering Poro + Ahri SP');
assert.ok(plunderingVisual.family.some(c => c.id === 302));
assert.ok(plunderingVisual.family.some(c => c.id === 303));
assert.ok(plunderingVisual.family.some(c => c.id === 304));
assert.ok(plunderingVisual.family.some(c => c.id === 305));
assert.ok(!plunderingVisual.family.some(c => c.id === 308));

const veteranVisual = profile.buildVisualSpot(colorCatalog, { id: 306, position: 15, set_code: 'UNL', name: 'Veteran Poro' });
assert.equal(veteranVisual.displayLabel, 'Veteran Poro + Sett SP');
assert.ok(veteranVisual.family.some(c => c.id === 307));
assert.ok(veteranVisual.family.some(c => c.id === 308));
assert.ok(veteranVisual.family.some(c => c.id === 309));
assert.ok(veteranVisual.family.some(c => c.id === 310));
assert.ok(!veteranVisual.family.some(c => c.id === 303));

const daringVisual = profile.buildVisualSpot(colorCatalog, { id: 311, position: 17, set_code: 'UNL', name: 'Daring Poro' });
assert.ok(daringVisual.family.some(c => c.id === 313), 'Rift Herald should display in Daring/Yellow');
assert.ok(daringVisual.family.some(c => c.id === 314));
assert.ok(daringVisual.family.some(c => c.id === 315));

const mysticVisual = profile.buildVisualSpot(colorCatalog, { id: 316, position: 16, set_code: 'UNL', name: 'Mystic Poro' });
assert.ok(!mysticVisual.family.some(c => c.id === 313), 'Rift Herald must not remain in Mystic/Purple');
assert.ok(mysticVisual.family.some(c => c.id === 318));
