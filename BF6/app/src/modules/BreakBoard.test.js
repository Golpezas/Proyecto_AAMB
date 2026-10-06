const assert = require('node:assert/strict');
const {
  decorateBreakBoardListingNames,
  decorateRiftboundListingTitle,
  formatBreakBoardListing,
  normalizeBreakDescription,
  RIFTBOUND_BREAK_DESCRIPTION,
  riftboundFirstCardListingSymbol,
  WHATNOT_BREAK_DESCRIPTION
} = require('./BreakBoard');

assert.equal(formatBreakBoardListing([]), '');
assert.match(
  formatBreakBoardListing([{ position: 1, game_code: 'RIFTBOUND', set_code: 'UNL', name: 'Jhin, Virtuoso', break_spot_label: 'Red / Fury — Jhin + Pyke' }], { RIFTBOUND: 'Color break.' }),
  /^1 — Red \/ Fury — Jhin \+ Pyke\tColor break\.$/
);
assert.equal(
  formatBreakBoardListing([{ position: 55, game_code: 'RIFTBOUND', set_code: 'UNL', name: 'Sprite Fountain', break_spot_label: 'Sprite Fountain (Foil) · 078/219' }]),
  `1 — Sprite Fountain (Foil) · 078/219\t${RIFTBOUND_BREAK_DESCRIPTION}`
);
assert.deepEqual(
  formatBreakBoardListing([
    { position: 2, name: 'Portgas.D.Ace', set_code: 'OP-16', card_number: 'OP16-001', break_rarity: 'L' },
    { position: 1, name: 'DON!! Card (Gold)', set_code: 'OP-16', rarity: 'GOLD DON!!' }
  ]),
  `1 — DON!! Card (Gold) GOLD DON!!\t${WHATNOT_BREAK_DESCRIPTION}\n2 — Portgas.D.Ace L\t${WHATNOT_BREAK_DESCRIPTION}`
);

assert.deepEqual(
  formatBreakBoardListing([
    { position: 1, name: 'Teemo, Strategist', set_code: 'SFD', game_code: 'RIFTBOUND' },
    { position: 2, name: 'Sett, Brawler', set_code: 'SFD', game_code: 'RIFTBOUND' },
    { position: 3, name: 'Irelia, Fervent', set_code: 'SFD', game_code: 'RIFTBOUND' },
    { position: 4, name: 'Seal of Rage', set_code: 'SFD', game_code: 'RIFTBOUND' },
    { position: 5, name: 'Seal of Insight', set_code: 'SFD', game_code: 'RIFTBOUND' }
  ]).split('\n').map(line => line.split('\t')[0]),
  [
    '1 — Teemo Signature + Rumble',
    '2 — Sett Signature + Lucian',
    '3 — Irelia Signature + Irelia',
  '4 — Seal of Rage + Fury Rune Showcase Rune + Rare/Epic Fury Cards',
  '5 — Seal of Insight + Mind Rune Showcase Rune + Rare/Epic Mind Cards'
  ]
);

assert.equal(
  formatBreakBoardListing([
    { position: 1, name: 'Akali, Rogue Assassin', rarity: 'Rare', game_code: 'RIFTBOUND' }
  ]),
  `1 — ⚡ Akali ⚡\t${RIFTBOUND_BREAK_DESCRIPTION}`
);

assert.equal(
  formatBreakBoardListing([
    { position: 1, name: 'Ahri, Inquisitive', rarity: 'RARE', collector_treatment: 'Signature', game_code: 'RIFTBOUND' }
  ]),
  `1 — 💎 Ahri 💎\t${RIFTBOUND_BREAK_DESCRIPTION}`
);

assert.equal(
  formatBreakBoardListing([
    { position: 1, name: 'Sakazuki', rarity: 'MANGA' },
    { position: 3, name: 'Kuzan', rarity: 'MANGA' }
  ]),
  `1 — Sakazuki MANGA\t${WHATNOT_BREAK_DESCRIPTION}\n2 — Kuzan MANGA\t${WHATNOT_BREAK_DESCRIPTION}`
);

assert.equal(
  formatBreakBoardListing(
    [{ position: 1, name: 'Poppy, Keeper of the Hammer', rarity: 'Rare', game_code: 'RIFTBOUND' }],
    { RIFTBOUND: 'Custom Riftbound notes for every row.' }
  ),
  '1 — ⚡ Poppy ⚡\tCustom Riftbound notes for every row.'
);

assert.equal(
  formatBreakBoardListing([
    { position: 1, name: 'Jhin, Virtuoso', rarity: 'RARE', collector_treatment: 'Signature', game_code: 'RIFTBOUND' },
    { position: 2, name: 'Baron Nashor', rarity: 'EPIC', collector_treatment: 'Overnumbered', game_code: 'RIFTBOUND' },
    { position: 3, name: 'Chaos Rune', rarity: 'SHOWCASE', collector_treatment: 'Alternate Art', game_code: 'RIFTBOUND' }
  ]),
  `1 — 💎 Jhin 💎\t${RIFTBOUND_BREAK_DESCRIPTION}\n2 — 🔥 Baron Nashor 🔥\t${RIFTBOUND_BREAK_DESCRIPTION}\n3 — 💣 Chaos Rune 💣\t${RIFTBOUND_BREAK_DESCRIPTION}`
);

assert.equal(
  formatBreakBoardListing([
    { position: 14, name: 'Pouty Poro', set_code: 'UNL', rarity: 'COMMON', collector_treatment: 'Overnumbered', game_code: 'RIFTBOUND' },
    { position: 15, name: 'Lonely Poro', set_code: 'UNL', rarity: 'COMMON', collector_treatment: 'Overnumbered', game_code: 'RIFTBOUND' },
    { position: 16, name: 'Plundering Poro', set_code: 'UNL', rarity: 'COMMON', collector_treatment: 'Overnumbered', game_code: 'RIFTBOUND' },
    { position: 17, name: 'Veteran Poro', set_code: 'UNL', rarity: 'COMMON', collector_treatment: 'Overnumbered', game_code: 'RIFTBOUND' },
    { position: 18, name: 'Mystic Poro', set_code: 'UNL', rarity: 'COMMON', collector_treatment: 'Overnumbered', game_code: 'RIFTBOUND' },
    { position: 19, name: 'Daring Poro', set_code: 'UNL', rarity: 'COMMON', collector_treatment: 'Overnumbered', game_code: 'RIFTBOUND' }
  ]),
  `1 — 🔥 Pouty Poro + Irresistible Faefolk + Fury Rune 🔥\t${RIFTBOUND_BREAK_DESCRIPTION}\n2 — 🔥 Lonely Poro + Vilemaw + Calm Rune 🔥\t${RIFTBOUND_BREAK_DESCRIPTION}\n3 — 🔥 Plundering Poro + Elder Dragon + Body Rune 🔥\t${RIFTBOUND_BREAK_DESCRIPTION}\n4 — 🔥 Veteran Poro + Blue Sentinel + Mind Rune 🔥\t${RIFTBOUND_BREAK_DESCRIPTION}\n5 — 🔥 Mystic Poro + Rift Herald + Chaos Rune 🔥\t${RIFTBOUND_BREAK_DESCRIPTION}\n6 — 🔥 Daring Poro + The Ruination + Order Rune 🔥\t${RIFTBOUND_BREAK_DESCRIPTION}`
);

assert.equal(riftboundFirstCardListingSymbol({ rarity: 'Showcase' }), '💣');
assert.equal(riftboundFirstCardListingSymbol({ rarity: 'Epic' }), '⭐');
assert.equal(riftboundFirstCardListingSymbol({
  game_code: 'RIFTBOUND', set_code: 'UNL', card_number: 'UNL-238/219', rarity: 'Ultimate', collector_treatment: 'Overnumbered'
}), '💀', 'Exact Ultimate printings use the skull instead of the Overnumbered fire');
assert.equal(riftboundFirstCardListingSymbol({
  game_code: 'RIFTBOUND', set_code: 'UNL', card_number: 'UNL-229/219', rarity: 'Ultimate', collector_treatment: 'Overnumbered'
}), '🔥', 'Normal Overnumbered printings keep their fire symbol');
assert.equal(
  decorateRiftboundListingTitle(
    { collector_treatment: 'Signature' },
    '🔥 Jhin + Pyke 💣 💀'
  ),
  '💎 Jhin + Pyke 💎',
  'Only the first card may select the copied title symbol.'
);

assert.deepEqual(
  formatBreakBoardListing([
    { position: 1, name: 'Akali, Rogue Assassin', set_code: 'VEN', game_code: 'RIFTBOUND' },
    { position: 2, name: 'Renekton, Butcher of the Sands', set_code: 'VEN', game_code: 'RIFTBOUND' },
    { position: 3, name: 'Zed, Master of Shadows', set_code: 'VEN', game_code: 'RIFTBOUND' },
    { position: 4, name: 'Nasus, Curator of the Sands', set_code: 'VEN', game_code: 'RIFTBOUND' },
    { position: 5, name: 'Shen, Eye of Twilight', set_code: 'VEN', game_code: 'RIFTBOUND' },
    { position: 6, name: 'Jayce, Defender of Tomorrow', set_code: 'VEN', game_code: 'RIFTBOUND' },
    { position: 7, name: "Mel, Soul's Reflection", set_code: 'VEN', game_code: 'RIFTBOUND' },
    { position: 8, name: 'Ambessa, Matriarch of War', set_code: 'VEN', game_code: 'RIFTBOUND' },
    { position: 9, name: 'Kennen, Heart of the Tempest', set_code: 'VEN', game_code: 'RIFTBOUND' },
    { position: 10, name: "Kai'Sa, Survivor", set_code: 'VEN', game_code: 'RIFTBOUND' },
    { position: 11, name: 'Sona, Harmonious', set_code: 'VEN', game_code: 'RIFTBOUND' },
    { position: 12, name: 'Astral Heron', set_code: 'VEN', game_code: 'RIFTBOUND' },
    { position: 13, name: 'Ahri, Inquisitive', set_code: 'VEN', game_code: 'RIFTBOUND' },
    { position: 14, name: 'Sett, Brawler', set_code: 'VEN', game_code: 'RIFTBOUND' },
    { position: 15, name: 'Ezreal, Prodigy', set_code: 'VEN', game_code: 'RIFTBOUND' },
    { position: 16, name: 'Lux, Crownguard', set_code: 'VEN', game_code: 'RIFTBOUND' }
  ]).split('\n').map(line => line.split('\t')[0]),
  [
    '1 — Akali',
    '2 — Renekton + Rengar',
    '3 — Zed + Gangplank',
    '4 — Nasus + Vi',
    '5 — Shen + Jinx',
    '6 — Jayce + Viktor',
    '7 — Mel + Illaoi',
    '8 — Ambessa + Morgana',
    '9 — Kennen + Leona',
    "10 — Kai'Sa + Swain + Fury Rune",
    '11 — Sona + Riven + Calm Rune',
    '12 — Astral Heron + Irelia + Helm of Suppression',
    '13 — Ahri + Draven + Mind Rune',
    "14 — Sett + Kha'Zix + Body Rune",
    '15 — Ezreal + Diana + Chaos Rune',
    '16 — Lux + Kayle + Order Rune'
  ]
);

assert.deepEqual(
  decorateBreakBoardListingNames([
    { position: 2, name: 'Renekton, Butcher of the Sands', card_number: 'VEN-190*/166', set_code: 'VEN', game_code: 'RIFTBOUND' },
    { position: 8, name: 'Ambessa, Matriarch of War', card_number: 'VEN-196*/166', set_code: 'VEN', game_code: 'RIFTBOUND' },
    { position: 10, name: "Kai'Sa, Survivor", card_number: 'VEN-SP1/006', set_code: 'VEN', game_code: 'RIFTBOUND' }
  ]).map(card => card.break_spot_label),
  ['Renekton + Rengar', 'Ambessa + Morgana', "Kai'Sa + Swain + Fury Rune"]
);

assert.equal(
  formatBreakBoardListing([{
    position: 8,
    name: 'Ambessa, Matriarch of War',
    card_number: 'VEN-196*/166',
    set_code: 'VEN',
    game_code: 'RIFTBOUND',
    break_spot_label: 'Ambessa + Morgana + extra visualization details'
  }]).split('\t')[0],
  '1 — Ambessa + Morgana'
);

assert.equal(
  formatBreakBoardListing([{
    position: 1,
    name: 'Renekton, Butcher of the Sands',
    card_number: 'VEN-190*/166',
    rarity: 'Rare',
    collector_treatment: 'Signature',
    set_code: 'VEN',
    game_code: 'RIFTBOUND',
    riftbound_single: true,
    break_spot_label: 'Renekton, Butcher of the Sands · VEN-190*/166 · Signature'
  }]).split('\t')[0],
  '1 — 💎 Renekton, Butcher of the Sands · VEN-190*/166 · Signature 💎',
  'Vendetta Singles must keep the exact printing instead of inheriting a mapped-family title.'
);

assert.equal(
  formatBreakBoardListing([{
    position: 2,
    name: 'Renekton, Butcher of the Sands',
    card_number: 'VEN-190*/166',
    collector_treatment: 'Signature',
    set_code: 'VEN',
    game_code: 'RIFTBOUND',
    custom_break_mapping: true,
    break_spot_label: 'Renekton · SIG VEN-190* + ON VEN-190, VEN-177'
  }]).split('\t')[0],
  '1 — 💎 Renekton · SIG VEN-190* + ON VEN-190, VEN-177 💎',
  'Board 1 uses its own champion-family title, without the old Rengar pairing.'
);

assert.deepEqual(
  formatBreakBoardListing([
    { position: 1, name: "Kai'Sa, Daughter of the Void", card_number: 'OGN-299*/298', set_code: 'OGN', game_code: 'RIFTBOUND' },
    { position: 13, name: 'Seal of Rage', card_number: 'OGN-040/298', set_code: 'OGN', game_code: 'RIFTBOUND' },
    { position: 17, name: 'Seal of Discord', card_number: 'OGN-204/298', set_code: 'OGN', game_code: 'RIFTBOUND' }
  ]).split('\n').map(line => line.split('\t')[0]),
  [
    "1 — Kai'Sa",
    '2 — Seal of Rage + Fury Rune AA + Rare/Epic Fury Cards',
    '3 — Seal of Discord + Chaos Rune AA + Rare/Epic Chaos Cards'
  ]
);

assert.equal(normalizeBreakDescription('First line\n\nSecond\tline'), 'First line Second line');

console.log('Break board test passed.');
const sealListing = formatBreakBoardListing([{position: 19, game_code: 'RIFTBOUND', set_code: 'OGN', name: 'Seal of Rage', break_spot_label: '[OGN] Seal of Rage + Fury Rune AA + Fury Rare/Epic · Non-Champion'}]);
assert.match(sealListing, /Non-Champion/);
assert.match(sealListing, /Cards assigned to champion spots or other named spots are excluded/);
assert.match(sealListing, /matching rune alternate art/);
