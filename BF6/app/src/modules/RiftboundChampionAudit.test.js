const assert = require('node:assert/strict');
const {
  SPIRITFORGED_SPOT_MAPPINGS,
  VENDETTA_RIVAL_ON_CHAMPIONS,
  VENDETTA_SIGNATURE_CHAMPIONS,
  VENDETTA_SPOT_MAPPINGS,
  UNLEASHED_PORO_MAPPINGS,
  championFromSpot,
  originsSpotFromCard,
  baronFromSpot,
  cardBelongsToBaron,
  cardBelongsToChampion,
  cardBelongsToPoroSpot,
  cardBelongsToOriginsSpot,
  cardBelongsToSpiritforgedSpot,
  cardBelongsToVendettaSpot,
  isShowcaseRune,
  isSpiritforgedRareColorCard,
  isUnleashedRareColorCard,
  isVendettaRareColorCard,
  poroFromSpot,
  poroMapping,
  sortChampionFamily,
  spiritforgedSpotFromCard,
  spiritforgedSpotLabel,
  spiritforgedSpotMapping,
  vendettaSpotFromCard,
  vendettaSpotLabel,
  vendettaSpotMapping
} = require('./RiftboundChampionAudit');

assert.equal(championFromSpot({ set_code: 'UNL', name: 'Pyke, Bloodharbor Ripper' }), 'Pyke');
assert.equal(championFromSpot({ set_code: 'UNL', name: 'Baron Nashor' }), '');
assert.equal(championFromSpot({ set_code: 'OGN', name: 'Daughter of the Void', card_number: 'OGN-299*/298' }), "Kai'Sa");
assert.equal(cardBelongsToChampion({ set_code: 'OGN', name: 'Icathian Rain', card_number: 'OGN-248/298' }, "Kai'Sa", 'OGN'), true);
const originsFury = originsSpotFromCard({ set_code: 'OGN', name: 'Seal of Rage', card_number: 'OGN-040/298' });
assert.equal(cardBelongsToOriginsSpot({ set_code: 'OGN', name: 'Fury Rune', card_number: 'OGN-007A/298', rarity: 'Showcase' }, originsFury), true);
assert.equal(cardBelongsToOriginsSpot({ set_code: 'OGN', name: 'Fury Rune', card_number: 'OGN-007/298', rarity: 'Common' }, originsFury), false);
assert.equal(cardBelongsToOriginsSpot({ set_code: 'OGN', name: 'Rare Fury Side Champion', card_number: 'OGN-028/298', rarity: 'Rare', card_type: 'Champion Unit' }, originsFury), true);
assert.equal(cardBelongsToOriginsSpot({ set_code: 'OGN', name: 'Darius, Trifarian', card_number: 'OGN-027/298', rarity: 'Rare', card_type: 'Champion Unit' }, originsFury), false);
assert.equal(baronFromSpot({ set_code: 'UNL', name: 'Baron Nashor' }), 'Baron Nashor');
assert.equal(cardBelongsToBaron({ set_code: 'UNL', name: 'Baron Nashor', card_number: '147/219', rarity: 'Epic', color: 'Chaos', card_type: 'Unit' }), true);
assert.equal(cardBelongsToBaron({ set_code: 'UNL', name: 'Baron Nashor', card_number: '147a/219', rarity: 'Epic', color: 'Chaos', card_type: 'Unit' }), true);
assert.equal(cardBelongsToBaron({ set_code: 'UNL', name: 'Baron Nashor', card_number: '238/219', rarity: 'Ultimate', color: 'Chaos', card_type: 'Unit' }), true);
assert.equal(cardBelongsToChampion({ set_code: 'UNL', name: 'Pyke, Returned' }, 'Pyke'), true);
assert.equal(cardBelongsToChampion({ set_code: 'UNL', name: 'Void Assault', card_traits: "Kha'Zix; Signature" }, "Kha'Zix"), true);
assert.equal(cardBelongsToChampion({ set_code: 'UNL', name: 'Mirror Image', details_json: JSON.stringify({ championName: 'LeBlanc' }) }, 'LeBlanc'), true);
assert.equal(cardBelongsToChampion({ set_code: 'UNL', name: 'Rengar, Trophy Hunter' }, 'Pyke'), false);
assert.equal(championFromSpot({ set_code: 'VEN', name: 'Akali, Rogue Assassin' }), 'Akali');
assert.equal(championFromSpot({ set_code: 'VEN', name: 'Yordle, Heart of the Tempest', card_traits: 'Kennen' }), 'Kennen');
assert.equal(championFromSpot({ set_code: 'VEN', name: 'Diana, No Longer Human' }), '');
assert.deepEqual(VENDETTA_SIGNATURE_CHAMPIONS, ['Akali', 'Renekton', 'Zed', 'Nasus', 'Shen', 'Jayce', 'Mel', 'Ambessa', 'Kennen']);
assert.equal(VENDETTA_RIVAL_ON_CHAMPIONS.length, 22);
assert.equal(VENDETTA_SPOT_MAPPINGS.length, 16);
assert.deepEqual(vendettaSpotMapping('Akali').champions, ['Akali']);
assert.deepEqual(vendettaSpotMapping('Zed').champions, ['Zed', 'Gangplank']);
assert.deepEqual(vendettaSpotMapping('Ambessa').champions, ['Ambessa', 'Morgana']);
assert.deepEqual(vendettaSpotMapping('Jayce').champions, ['Jayce', 'Viktor']);
assert.equal(vendettaSpotFromCard({ set_code: 'VEN', name: "Kai'Sa, Survivor" }).color, 'Red');
assert.equal(vendettaSpotFromCard({ set_code: 'VEN', name: 'Akali, Rogue Assassin' }).kind, 'signature');
assert.equal(vendettaSpotMapping('Diana'), null, 'Diana is owned by Ezreal instead of creating a standalone position');
assert.deepEqual(vendettaSpotMapping('Sona').champions, ['Sona', 'Riven']);
assert.deepEqual(
  ['Sett', 'Ezreal', 'Lux', 'Sona', "Kai'Sa", 'Ahri'].map(name => vendettaSpotMapping(name).champions),
  [
    ['Sett', "Kha'Zix"],
    ['Ezreal', 'Diana'],
    ['Lux', 'Kayle'],
    ['Sona', 'Riven'],
    ["Kai'Sa", 'Swain'],
    ['Ahri', 'Draven']
  ],
  'SP lanes must retain the approved price-balanced Rival ON assignments'
);
assert.deepEqual(vendettaSpotMapping('Astral Heron').champions, ['Irelia']);
assert.deepEqual(vendettaSpotMapping('Astral Heron').extras, ['Astral Heron', 'Helm of Suppression']);
assert.deepEqual(vendettaSpotMapping('Sett').extras, ['Cataclysmic Duel', 'Corrupted Dragon']);
assert.deepEqual(vendettaSpotMapping('Ezreal').extras, ['Ocean Drake', 'Kharox']);
assert.deepEqual(vendettaSpotMapping('Lux').extras, ['Shady Spectacles']);
assert.equal(vendettaSpotLabel('Akali'), 'Akali');
assert.equal(vendettaSpotLabel('Lux'), 'Lux + Kayle + Yellow Showcase Rune + Shady Spectacles + Rare Order Cards');
assert.equal(vendettaSpotLabel('Astral Heron'), 'Astral Heron + Irelia + Helm of Suppression');
assert.equal(cardBelongsToVendettaSpot({ set_code: 'VEN', name: 'Morgana, Vindictive' }, 'Ambessa'), true);
assert.equal(cardBelongsToVendettaSpot({ set_code: 'VEN', name: 'Viktor, Innovator' }, 'Jayce'), true);
assert.equal(cardBelongsToVendettaSpot({ set_code: 'VEN', name: 'Diana, No Longer Human' }, 'Ezreal'), true);
assert.equal(cardBelongsToVendettaSpot({ set_code: 'VEN', name: 'Riven, Shattered' }, 'Sona'), true);
assert.equal(cardBelongsToVendettaSpot({ set_code: 'VEN', name: "Kha'Zix, Evolving Hunter" }, 'Sett'), true);
assert.equal(cardBelongsToVendettaSpot({ set_code: 'VEN', name: 'Irelia, Fervent' }, 'Astral Heron'), true);
for (const rival of VENDETTA_RIVAL_ON_CHAMPIONS) {
  assert.equal(
    VENDETTA_SPOT_MAPPINGS.filter(mapping => mapping.champions.includes(rival)).length,
    1,
    `${rival} Rival ON must have exactly one mapped owner`
  );
}
assert.equal(cardBelongsToVendettaSpot({ set_code: 'VEN', name: 'Endless Riches' }, "Kai'Sa"), true);
assert.equal(cardBelongsToVendettaSpot({ set_code: 'VEN', name: 'Fury Rune', rarity: 'Common' }, "Kai'Sa"), false);
assert.equal(cardBelongsToVendettaSpot({ set_code: 'VEN', name: 'Fury Rune', rarity: 'Showcase' }, "Kai'Sa"), true);
assert.equal(isShowcaseRune({ name: 'Mind Rune', collector_treatment: 'Alternate Art' }), true);
assert.equal(isShowcaseRune({ name: 'Mind Rune', rarity: 'Common' }), false);
assert.equal(cardBelongsToVendettaSpot({ set_code: 'VEN', name: 'Astral Heron' }, 'Astral Heron'), true);
assert.equal(cardBelongsToVendettaSpot({ set_code: 'VEN', name: 'Ocean Drake' }, 'Ezreal'), true);
assert.equal(cardBelongsToVendettaSpot({ set_code: 'VEN', name: 'Corrupted Dragon' }, 'Sett'), true);
assert.equal(cardBelongsToVendettaSpot({ set_code: 'VEN', name: 'Shady Spectacles' }, 'Lux'), true);
assert.equal(cardBelongsToVendettaSpot({ set_code: 'UNL', name: 'Corrupted Dragon' }, 'Sett'), false);
assert.equal(isVendettaRareColorCard({ set_code: 'VEN', name: 'Crumbling Sands', rarity: 'Rare', color: 'Calm', card_type: 'Spell' }, 'Sona'), true);
assert.equal(isVendettaRareColorCard({ set_code: 'VEN', name: 'Crumbling Sands', rarity: 'Uncommon', color: 'Calm', card_type: 'Spell' }, 'Sona'), false);
assert.equal(isVendettaRareColorCard({ set_code: 'VEN', name: 'Crumbling Sands', rarity: 'Rare', color: 'Calm', card_type: 'Spell' }, 'Ezreal'), false);
assert.equal(isVendettaRareColorCard({ set_code: 'VEN', name: 'Sona, Harmonious', rarity: 'Rare', color: 'Calm', card_type: 'Legend' }, 'Sona'), false);
assert.equal(isVendettaRareColorCard({ set_code: 'VEN', name: 'Calm Rune', rarity: 'Rare', color: 'Calm', card_type: 'Rune' }, 'Sona'), false);
assert.equal(cardBelongsToVendettaSpot({ set_code: 'VEN', name: 'Crumbling Sands', rarity: 'Rare', color: 'Calm', card_type: 'Spell' }, 'Sona'), true);
assert.equal(SPIRITFORGED_SPOT_MAPPINGS.length, 18);
assert.equal(spiritforgedSpotMapping('Teemo').champion, 'Rumble');
assert.equal(spiritforgedSpotMapping('Rumble').signatureChampion, 'Teemo');
assert.equal(spiritforgedSpotFromCard({ set_code: 'SFD', name: 'Teemo, Strategist' }).champion, 'Rumble');
assert.equal(spiritforgedSpotFromCard({ set_code: 'SFD', name: 'Rumble, Mechanized Menace' }).signatureChampion, 'Teemo');
assert.equal(spiritforgedSpotLabel('Teemo'), 'Teemo Signature + Rumble');
assert.equal(spiritforgedSpotLabel('Seal of Insight'), 'Seal of Insight + Mind Rune Showcase Rune + Rare/Epic Mind Cards');
assert.equal(cardBelongsToSpiritforgedSpot({ set_code: 'SFD', name: 'Rumble, Mechanized Menace' }, 'Teemo'), true);
assert.equal(cardBelongsToSpiritforgedSpot({ set_code: 'SFD', name: 'Teemo, Strategist' }, 'Rumble'), true);
assert.equal(cardBelongsToSpiritforgedSpot({ set_code: 'SFD', name: 'Mind Rune', rarity: 'Showcase' }, 'Seal of Insight'), true);
assert.equal(cardBelongsToSpiritforgedSpot({ set_code: 'SFD', name: 'Mind Rune', rarity: 'Common' }, 'Seal of Insight'), false);
assert.equal(cardBelongsToSpiritforgedSpot({ set_code: 'SFD', name: 'Seal of Insight' }, 'Mind Rune'), true);
assert.equal(isSpiritforgedRareColorCard({ set_code: 'SFD', name: 'Arcane Discovery', rarity: 'Rare', color: 'Chaos', card_type: 'Spell' }, 'Seal of Discord'), true);
assert.equal(isSpiritforgedRareColorCard({ set_code: 'SFD', name: 'Void Adept', rarity: 'Rare', color: 'Chaos / Mind', card_type: 'Unit' }, 'Seal of Discord'), true);
assert.equal(isSpiritforgedRareColorCard({ set_code: 'SFD', name: 'Void Adept', rarity: 'Rare', color: 'Chaos / Mind', card_type: 'Unit' }, 'Seal of Insight'), true);
assert.equal(isSpiritforgedRareColorCard({ set_code: 'SFD', name: 'Corina Veraza', rarity: 'Epic', card_type: 'Unit' }, 'Seal of Unity'), true);
assert.equal(isSpiritforgedRareColorCard({ set_code: 'SFD', name: 'Corina Veraza', rarity: 'Epic', card_type: 'Unit' }, 'Seal of Discord'), false);
assert.equal(isSpiritforgedRareColorCard({ set_code: 'SFD', name: 'Dunebreaker', rarity: 'Epic', card_type: 'Unit' }, 'Seal of Rage'), true);
assert.equal(isSpiritforgedRareColorCard({ set_code: 'SFD', name: 'Ziggs, Hexplosives Expert', rarity: 'Rare', color: 'Fury', card_type: 'Champion Unit' }, 'Seal of Rage'), true);
assert.equal(isSpiritforgedRareColorCard({ set_code: 'SFD', name: 'Rumble, Mechanized Menace', rarity: 'Rare', color: 'Fury', card_type: 'Champion Unit' }, 'Seal of Rage'), false);
assert.equal(isSpiritforgedRareColorCard({ set_code: 'SFD', name: 'Teemo, Strategist', rarity: 'Epic', color: 'Calm', card_type: 'Champion Unit' }, 'Seal of Focus'), false);
for (const [name, spot] of [
  ['Dunebreaker', 'Seal of Rage'],
  ['Skyfall of Areion', 'Seal of Rage'],
  ['Svellsongur', 'Seal of Focus'],
  ['Tianna Crownguard', 'Seal of Focus'],
  ['Premonition', 'Seal of Insight'],
  ['The Zero Drive', 'Seal of Insight'],
  ['Ancient Henge', 'Seal of Strength'],
  ['Boneshiver', 'Seal of Strength'],
  ['Downwell', 'Seal of Discord'],
  ['Last Rites', 'Seal of Discord'],
  ['Blade of the Ruined King', 'Seal of Unity'],
  ['Corina Veraza', 'Seal of Unity']
]) {
  assert.equal(isSpiritforgedRareColorCard({ set_code: 'SFD', name, rarity: 'Epic', card_type: 'Unit' }, spot), true, `${name} should map to ${spot}`);
}
assert.equal(cardBelongsToSpiritforgedSpot({ set_code: 'SFD', name: 'Arcane Discovery', rarity: 'Rare', color: 'Chaos', card_type: 'Spell' }, 'Seal of Discord'), true);
assert.equal(cardBelongsToSpiritforgedSpot({ set_code: 'SFD', name: 'Arcane Discovery', rarity: 'Common', color: 'Chaos', card_type: 'Spell' }, 'Seal of Discord'), false);
assert.equal(cardBelongsToSpiritforgedSpot({ set_code: 'SFD', name: 'Arcane Discovery', rarity: 'Uncommon', color: 'Chaos', card_type: 'Spell' }, 'Seal of Discord'), false);
assert.equal(cardBelongsToSpiritforgedSpot({ set_code: 'SFD', name: 'Arcane Discovery', rarity: 'Epic', color: 'Chaos', card_type: 'Spell' }, 'Seal of Discord'), true);
assert.equal(cardBelongsToSpiritforgedSpot({ set_code: 'SFD', name: 'Arcane Discovery', rarity: 'Rare', color: 'Fury', card_type: 'Spell' }, 'Seal of Discord'), false);
assert.equal(cardBelongsToSpiritforgedSpot({ set_code: 'VEN', name: 'Arcane Discovery', rarity: 'Rare', color: 'Chaos', card_type: 'Spell' }, 'Seal of Discord'), false);
assert.equal(cardBelongsToSpiritforgedSpot({ set_code: 'SFD', name: 'Chaos Rune', rarity: 'Rare', color: 'Chaos', card_type: 'Rune' }, 'Seal of Discord'), false);
assert.equal(cardBelongsToSpiritforgedSpot({ set_code: 'SFD', name: 'Ahri, Inquisitive', rarity: 'Rare', color: 'Chaos', card_type: 'Champion Unit' }, 'Seal of Discord'), false);
assert.equal(cardBelongsToSpiritforgedSpot({ set_code: 'SFD', name: 'Ahri, Inquisitive', rarity: 'Rare', color: 'Chaos', card_type: 'Legend' }, 'Seal of Discord'), false);
assert.equal(cardBelongsToSpiritforgedSpot({ set_code: 'SFD', name: 'Ziggs, Hexplosives Expert', rarity: 'Rare', color: 'Fury', card_type: 'Champion Unit' }, 'Seal of Rage'), true);
assert.equal(cardBelongsToSpiritforgedSpot({ set_code: 'SFD', name: 'Rumble, Mechanized Menace', rarity: 'Rare', color: 'Fury', card_type: 'Champion Unit' }, 'Seal of Rage'), false);
assert.equal(cardBelongsToSpiritforgedSpot({ set_code: 'SFD', name: 'Corina Veraza', rarity: 'Epic', card_type: 'Unit' }, 'Seal of Unity'), true);
assert.deepEqual(
  UNLEASHED_PORO_MAPPINGS.map(mapping => [mapping.poro, mapping.color, mapping.domain, mapping.mappedCard, mapping.rune]),
  [
    ['Mystic Poro', 'Purple', 'Chaos', 'Rift Herald', 'Chaos Rune'],
    ['Veteran Poro', 'Blue', 'Mind', 'Blue Sentinel', 'Mind Rune'],
    ['Pouty Poro', 'Red', 'Fury', 'Irresistible Faefolk', 'Fury Rune'],
    ['Lonely Poro', 'Green', 'Calm', 'Vilemaw', 'Calm Rune'],
    ['Daring Poro', 'Yellow', 'Order', 'The Ruination', 'Order Rune'],
    ['Plundering Poro', 'Orange', 'Body', 'Elder Dragon', 'Body Rune']
  ]
);
assert.equal(poroFromSpot({ set_code: 'UNL', name: 'Mystic Poro' }), 'Mystic Poro');
assert.equal(poroFromSpot({ set_code: 'SFD', name: 'Mystic Poro' }), '');
assert.equal(poroMapping('Veteran Poro').mappedCard, 'Blue Sentinel');
assert.equal(poroMapping('Veteran Poro').domain, 'Mind');
assert.equal(cardBelongsToPoroSpot({ set_code: 'UNL', name: 'Rift Herald' }, 'Mystic Poro'), true);
assert.equal(cardBelongsToPoroSpot({ set_code: 'UNL', name: 'Mystic Poro' }, 'Mystic Poro'), true);
assert.equal(cardBelongsToPoroSpot({ set_code: 'UNL', name: 'Chaos Rune' }, 'Mystic Poro'), true);
assert.equal(cardBelongsToPoroSpot({ set_code: 'UNL', name: 'Blue Sentinel' }, 'Mystic Poro'), false);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Dancing Grenade', rarity: 'Rare', color: 'Fury', card_type: 'Spell' }, 'Pouty Poro'), true);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Katarina, Reckless', rarity: 'Rare', color: 'Fury', card_type: 'Unit Champion' }, 'Pouty Poro'), true);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Dancing Grenade', rarity: 'Uncommon', color: 'Fury', card_type: 'Spell' }, 'Pouty Poro'), false);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Dancing Grenade', rarity: 'Rare', color: 'Fury', card_type: 'Spell' }, 'Mystic Poro'), false);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Jhin, Murderous Artist', rarity: 'Rare', color: 'Fury', card_type: 'Unit Champion' }, 'Pouty Poro'), false);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Xerath, Freed', rarity: 'Rare', color: 'Fury', card_type: 'Champion Unit' }, 'Pouty Poro'), true);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Nami, Headstrong', rarity: 'Rare', color: 'Calm', card_type: 'Champion Unit' }, 'Lonely Poro'), true);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Yuumi, Magical Cat', rarity: 'Rare', color: 'Calm', card_type: 'Champion Unit' }, 'Lonely Poro'), true);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Hwei, Brooding Painter', rarity: 'Rare', color: 'Mind', card_type: 'Champion Unit' }, 'Veteran Poro'), true);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Zilean, Time Mage', rarity: 'Rare', color: 'Mind', card_type: 'Champion Unit' }, 'Veteran Poro'), true);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Nidalee, Cat Form', rarity: 'Rare', color: 'Body', card_type: 'Champion Unit' }, 'Plundering Poro'), true);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Nilah, Joyful Ascetic', rarity: 'Rare', color: 'Body', card_type: 'Champion Unit' }, 'Plundering Poro'), true);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Evelynn, Entrancing', rarity: 'Rare', color: 'Chaos', card_type: 'Champion Unit' }, 'Mystic Poro'), true);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Ashe, Focused', rarity: 'Rare', color: 'Order', card_type: 'Champion Unit' }, 'Daring Poro'), true);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Galio, Indefatigable', rarity: 'Rare', color: 'Order', card_type: 'Champion Unit' }, 'Daring Poro'), true);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Virtuoso', rarity: 'Rare', color: 'Fury / Mind', card_type: 'Legend', card_traits: 'Jhin' }, 'Pouty Poro'), false);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Irresistible Faefolk', rarity: 'Rare', color: 'Body', card_type: 'Unit' }, 'Plundering Poro'), false);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Arachnoid Horror', card_number: '117/219', rarity: 'Epic', color: 'Body', card_type: 'Unit' }, 'Plundering Poro'), true);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Arachnoid Horror', card_number: '117/219', rarity: 'Epic', color: 'Body', card_type: 'Unit' }, 'Mystic Poro'), false);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Another Epic', card_number: '118/219', rarity: 'Epic', color: 'Body', card_type: 'Unit' }, 'Plundering Poro'), true);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Gutter Palace', card_number: '088/219', rarity: 'Epic', color: 'Mind', card_type: 'Gear' }, 'Veteran Poro'), true);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Gutter Palace', card_number: '088/219', rarity: 'Epic', color: 'Mind', card_type: 'Gear' }, 'Mystic Poro'), false);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Cursed Sarcophagus', card_number: '148/219', rarity: 'Epic', color: 'Chaos', card_type: 'Gear' }, 'Mystic Poro'), true);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Baron Nashor', card_number: '147/219', rarity: 'Epic', color: 'Chaos', card_type: 'Unit' }, 'Mystic Poro'), false);

assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Inviolus Vox', card_number: '027/219', rarity: 'Epic', card_type: 'Unit' }, 'Pouty Poro'), true);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Red Brambleback', card_number: '029/219', rarity: 'Epic', card_type: 'Unit' }, 'Pouty Poro'), true);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Alpha Wildclaw', card_number: '057/219', rarity: 'Epic', card_type: 'Unit' }, 'Lonely Poro'), true);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Gutter Palace', card_number: '088/219', rarity: 'Epic', card_type: 'Gear' }, 'Veteran Poro'), true);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Arachnoid Horror', card_number: '117/219', rarity: 'Epic', card_type: 'Unit' }, 'Plundering Poro'), true);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Cursed Sarcophagus', card_number: '148/219', rarity: 'Epic', card_type: 'Gear' }, 'Mystic Poro'), true);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Baron Nashor', card_number: '147/219', rarity: 'Epic', card_type: 'Unit' }, 'Mystic Poro'), false);

assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Syndra, Transcendent', card_number: '146/219', rarity: 'Rare', color: 'Chaos', card_type: 'Champion Unit' }, 'Mystic Poro'), true);
assert.equal(isUnleashedRareColorCard({ set_code: 'UNL', name: 'Rift Herald', card_number: '179/219', rarity: 'Epic', color: 'Order', card_type: 'Unit' }, 'Daring Poro'), false);
assert.equal(cardBelongsToPoroSpot({ set_code: 'UNL', name: 'Dancing Grenade', rarity: 'Rare', color: 'Fury', card_type: 'Spell' }, 'Pouty Poro'), true);
assert.equal(cardBelongsToPoroSpot({ set_code: 'UNL', name: 'Dancing Grenade', rarity: 'Rare', color: 'Fury', card_type: 'Spell' }, 'Mystic Poro'), false);
assert.equal(cardBelongsToPoroSpot({ set_code: 'UNL', name: 'Arachnoid Horror', card_number: 'UNL-117/219', rarity: 'Epic', color: 'Body', card_type: 'Unit' }, 'Plundering Poro'), true);
assert.deepEqual([
  { name: 'Rare', rarity: 'Rare' },
  { name: 'Signature', rarity: 'Rare', variant: 'Signature' },
  { name: 'Epic', rarity: 'Epic' }
].sort(sortChampionFamily).map(card => card.name), ['Signature', 'Epic', 'Rare']);

console.log('Riftbound champion audit tests passed.');
