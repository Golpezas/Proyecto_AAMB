const {
  ORIGINS_CHAMPIONS,
  cardBelongsToOriginsChampion,
  cardBelongsToOriginsSpot,
  isOriginsAaRune,
  isOriginsRareEpicDomainCard,
  originsChampionForCard,
  originsSpotFromCard,
  originsSpotLabel,
  originsSpotMapping
} = require('./RiftboundOriginsMapping');

const UNLEASHED_CHAMPIONS = Object.freeze([
  'Jhin', 'Rengar', 'Pyke', 'Vi', 'Lillia', 'Master Yi',
  'Vex', 'Ivern', 'Diana', 'LeBlanc', "Kha'Zix", 'Poppy'
]);

const VENDETTA_SIGNATURE_CHAMPIONS = Object.freeze([
  'Akali', 'Renekton', 'Zed', 'Nasus', 'Shen', 'Jayce', 'Mel', 'Ambessa', 'Kennen'
]);

// Vendetta contains 22 connecting-art Rival Overnumbers. Keep this checklist
// explicit so a chase cannot silently disappear from a mapped break (Kayle
// 185/166 was missing from the former 96-position Board 1 list).
const VENDETTA_RIVAL_ON_CHAMPIONS = Object.freeze([
  'Vi', 'Jinx', 'Zed', 'Shen', 'Riven', 'Draven', 'Swain', 'Irelia',
  'Jayce', 'Viktor', 'Renekton', 'Nasus', 'Rengar', "Kha'Zix",
  'Gangplank', 'Illaoi', 'Diana', 'Leona', 'Kayle', 'Morgana',
  'Ambessa', 'Mel'
]);

// Spiritforged is sold as twelve two-champion spots plus six color chase
// spots.  The signature identity is deliberately first so every public and
// private visualization uses the same left-to-right reading order.
const SPIRITFORGED_SPOT_MAPPINGS = Object.freeze([
  Object.freeze({ kind: 'champion', spot: 'Teemo', signatureChampion: 'Teemo', signatureCard: 'Teemo, Strategist', signatureNumber: '230', champion: 'Rumble', championCard: 'Rumble, Mechanized Menace', championNumber: '240' }),
  Object.freeze({ kind: 'champion', spot: 'Sett', signatureChampion: 'Sett', signatureCard: 'Sett, Brawler', signatureNumber: '232', champion: 'Lucian', championCard: 'Lucian, Purifier', championNumber: '241' }),
  Object.freeze({ kind: 'champion', spot: 'Darius', signatureChampion: 'Darius', signatureCard: 'Darius, Executioner', signatureNumber: '236', champion: 'Draven', championCard: 'Draven, Glorious Executioner', championNumber: '242' }),
  Object.freeze({ kind: 'champion', spot: 'Vayne', signatureChampion: 'Vayne', signatureCard: 'Vayne, Hunter', signatureNumber: '223', champion: "Rek'Sai", championCard: "Rek'Sai, Void Burrower", championNumber: '243' }),
  Object.freeze({ kind: 'champion', spot: 'Aphelios', signatureChampion: 'Aphelios', signatureCard: 'Aphelios, Exalted', signatureNumber: '224', champion: 'Ornn', championCard: 'Ornn, Fire Below the Mountain', championNumber: '244' }),
  Object.freeze({ kind: 'champion', spot: 'Yone', signatureChampion: 'Yone', signatureCard: 'Yone, Blademaster', signatureNumber: '233', champion: 'Jax', championCard: 'Jax, Grandmaster at Arms', championNumber: '245' }),
  Object.freeze({ kind: 'champion', spot: 'Irelia', signatureChampion: 'Irelia', signatureCard: 'Irelia, Fervent', signatureNumber: '225', champion: 'Irelia', championCard: 'Irelia, Blade Dancer', championNumber: '246' }),
  Object.freeze({ kind: 'champion', spot: 'Soraka', signatureChampion: 'Soraka', signatureCard: 'Soraka, Wanderer', signatureNumber: '239', champion: 'Azir', championCard: 'Azir, Emperor of the Sands', championNumber: '247' }),
  Object.freeze({ kind: 'champion', spot: 'Ahri', signatureChampion: 'Ahri', signatureCard: 'Ahri, Inquisitive', signatureNumber: '227', champion: 'Ezreal', championCard: 'Ezreal, Prodigal Explorer', championNumber: '248' }),
  Object.freeze({ kind: 'champion', spot: 'Bard', signatureChampion: 'Bard', signatureCard: 'Bard, Mercurial', signatureNumber: '228', champion: 'Renata Glasc', championCard: 'Renata Glasc, Chem-Baroness', championNumber: '249' }),
  Object.freeze({ kind: 'champion', spot: 'Yasuo', signatureChampion: 'Yasuo', signatureCard: 'Yasuo, Windrider', signatureNumber: '235', champion: 'Sivir', championCard: 'Sivir, Battle Mistress', championNumber: '250' }),
  Object.freeze({ kind: 'champion', spot: 'Karma', signatureChampion: 'Karma', signatureCard: 'Karma, Channeler', signatureNumber: '237', champion: 'Fiora', championCard: 'Fiora, Grand Duelist', championNumber: '251' }),
  Object.freeze({ kind: 'color', spot: 'Seal of Rage', color: 'Red', domain: 'Fury', seal: 'Seal of Rage', rune: 'Fury Rune' }),
  Object.freeze({ kind: 'color', spot: 'Seal of Focus', color: 'Green', domain: 'Calm', seal: 'Seal of Focus', rune: 'Calm Rune' }),
  Object.freeze({ kind: 'color', spot: 'Seal of Insight', color: 'Blue', domain: 'Mind', seal: 'Seal of Insight', rune: 'Mind Rune' }),
  Object.freeze({ kind: 'color', spot: 'Seal of Strength', color: 'Orange', domain: 'Body', seal: 'Seal of Strength', rune: 'Body Rune' }),
  Object.freeze({ kind: 'color', spot: 'Seal of Discord', color: 'Purple', domain: 'Chaos', seal: 'Seal of Discord', rune: 'Chaos Rune' }),
  Object.freeze({ kind: 'color', spot: 'Seal of Unity', color: 'Yellow', domain: 'Order', seal: 'Seal of Unity', rune: 'Order Rune' })
]);

const SPIRITFORGED_ALL_CHAMPIONS = Object.freeze([...new Set(
  SPIRITFORGED_SPOT_MAPPINGS
    .filter(mapping => mapping.kind === 'champion')
    .flatMap(mapping => [mapping.signatureChampion, mapping.champion])
)]);

// Compact Vendetta board: nine Signature-family anchors, six Crystal Rose
// color anchors, and one Astral Heron chase anchor. Every Crystal Rose SP lane
// owns exactly one Rival ON champion family. Astral Heron owns Irelia plus Helm
// of Suppression, Riven belongs to Sona, and Kha'Zix belongs to Sett. Every
// Rival ON therefore has one and only one owner across the 16 positions.
const VENDETTA_SPOT_MAPPINGS = Object.freeze([
  Object.freeze({ kind: 'signature', spot: 'Akali', champions: Object.freeze(['Akali']), color: '', domain: '', rune: '', extras: Object.freeze([]) }),
  Object.freeze({ kind: 'signature', spot: 'Renekton', champions: Object.freeze(['Renekton', 'Rengar']), color: '', domain: '', rune: '', extras: Object.freeze([]) }),
  Object.freeze({ kind: 'signature', spot: 'Zed', champions: Object.freeze(['Zed', 'Gangplank']), color: '', domain: '', rune: '', extras: Object.freeze([]) }),
  Object.freeze({ kind: 'signature', spot: 'Nasus', champions: Object.freeze(['Nasus', 'Vi']), color: '', domain: '', rune: '', extras: Object.freeze([]) }),
  Object.freeze({ kind: 'signature', spot: 'Shen', champions: Object.freeze(['Shen', 'Jinx']), color: '', domain: '', rune: '', extras: Object.freeze([]) }),
  Object.freeze({ kind: 'signature', spot: 'Jayce', champions: Object.freeze(['Jayce', 'Viktor']), color: '', domain: '', rune: '', extras: Object.freeze([]) }),
  Object.freeze({ kind: 'signature', spot: 'Mel', champions: Object.freeze(['Mel', 'Illaoi']), color: '', domain: '', rune: '', extras: Object.freeze([]) }),
  Object.freeze({ kind: 'signature', spot: 'Ambessa', champions: Object.freeze(['Ambessa', 'Morgana']), color: '', domain: '', rune: '', extras: Object.freeze([]) }),
  Object.freeze({ kind: 'signature', spot: 'Kennen', champions: Object.freeze(['Kennen', 'Leona']), color: '', domain: '', rune: '', extras: Object.freeze([]) }),
  Object.freeze({ kind: 'color', spot: "Kai'Sa", champions: Object.freeze(["Kai'Sa", 'Swain']), color: 'Red', domain: 'Fury', rune: 'Fury Rune', extras: Object.freeze(['Endless Riches']) }),
  Object.freeze({ kind: 'color', spot: 'Sona', champions: Object.freeze(['Sona', 'Riven']), color: 'Green', domain: 'Calm', rune: 'Calm Rune', extras: Object.freeze([]) }),
  Object.freeze({ kind: 'named', spot: 'Astral Heron', champions: Object.freeze(['Irelia']), color: '', domain: '', rune: '', extras: Object.freeze(['Astral Heron', 'Helm of Suppression']) }),
  Object.freeze({ kind: 'color', spot: 'Ahri', champions: Object.freeze(['Ahri', 'Draven']), color: 'Blue', domain: 'Mind', rune: 'Mind Rune', extras: Object.freeze(['Bottled Constellation']) }),
  Object.freeze({ kind: 'color', spot: 'Sett', champions: Object.freeze(['Sett', "Kha'Zix"]), color: 'Orange', domain: 'Body', rune: 'Body Rune', extras: Object.freeze(['Cataclysmic Duel', 'Corrupted Dragon']) }),
  Object.freeze({ kind: 'color', spot: 'Ezreal', champions: Object.freeze(['Ezreal', 'Diana']), color: 'Purple', domain: 'Chaos', rune: 'Chaos Rune', extras: Object.freeze(['Ocean Drake', 'Kharox']) }),
  Object.freeze({ kind: 'color', spot: 'Lux', champions: Object.freeze(['Lux', 'Kayle']), color: 'Yellow', domain: 'Order', rune: 'Order Rune', extras: Object.freeze(['Shady Spectacles']) })
]);

const VENDETTA_ALL_CHAMPIONS = Object.freeze([...new Set([
  ...VENDETTA_SIGNATURE_CHAMPIONS,
  ...VENDETTA_SPOT_MAPPINGS.flatMap(mapping => mapping.champions)
])]);

const CHAMPIONS_BY_SET = Object.freeze({ OGN: ORIGINS_CHAMPIONS, UNL: UNLEASHED_CHAMPIONS, VEN: VENDETTA_ALL_CHAMPIONS, SFD: SPIRITFORGED_ALL_CHAMPIONS });
const DIRECT_CHAMPION_SPOTS_BY_SET = Object.freeze({ OGN: ORIGINS_CHAMPIONS, UNL: UNLEASHED_CHAMPIONS, VEN: VENDETTA_SIGNATURE_CHAMPIONS });

// Spiritforged catalog imports do not always retain a domain/color value on
// generic Epic cards. These explicit fallbacks keep the twelve advertised
// non-champion Epics in their matching Seal/Rune lane. Champion-family Epics
// are still filtered below and stay exclusively with their paired spot.
const SPIRITFORGED_GENERIC_EPIC_DOMAIN = Object.freeze({
  [normalized('Dunebreaker')]: 'Fury',
  [normalized('Skyfall of Areion')]: 'Fury',
  [normalized('Svellsongur')]: 'Calm',
  [normalized('Tianna Crownguard')]: 'Calm',
  [normalized('Premonition')]: 'Mind',
  [normalized('The Zero Drive')]: 'Mind',
  [normalized('Ancient Henge')]: 'Body',
  [normalized('Boneshiver')]: 'Body',
  [normalized('Downwell')]: 'Chaos',
  [normalized('Last Rites')]: 'Chaos',
  [normalized('Blade of the Ruined King')]: 'Order',
  [normalized('Corina Veraza')]: 'Order'
});


const UNLEASHED_GENERIC_EPIC_DOMAIN = Object.freeze({
  [normalized('Inviolus Vox')]: 'Fury',
  [normalized('Red Brambleback')]: 'Fury',
  [normalized('Alpha Wildclaw')]: 'Calm',
  [normalized('Gutter Palace')]: 'Mind',
  [normalized('Arachnoid Horror')]: 'Body',
  [normalized('Cursed Sarcophagus')]: 'Chaos'
});

const UNLEASHED_PORO_MAPPINGS = Object.freeze([
  Object.freeze({ poro: 'Mystic Poro', color: 'Purple', domain: 'Chaos', mappedCard: 'Rift Herald', rune: 'Chaos Rune' }),
  Object.freeze({ poro: 'Veteran Poro', color: 'Blue', domain: 'Mind', mappedCard: 'Blue Sentinel', rune: 'Mind Rune' }),
  Object.freeze({ poro: 'Pouty Poro', color: 'Red', domain: 'Fury', mappedCard: 'Irresistible Faefolk', rune: 'Fury Rune' }),
  Object.freeze({ poro: 'Lonely Poro', color: 'Green', domain: 'Calm', mappedCard: 'Vilemaw', rune: 'Calm Rune' }),
  Object.freeze({ poro: 'Daring Poro', color: 'Yellow', domain: 'Order', mappedCard: 'The Ruination', rune: 'Order Rune' }),
  Object.freeze({ poro: 'Plundering Poro', color: 'Orange', domain: 'Body', mappedCard: 'Elder Dragon', rune: 'Body Rune' })
]);

function normalized(value) {
  return String(value || '').trim().toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']+/g, ' ');
}

function setChampions(setCode) {
  return CHAMPIONS_BY_SET[String(setCode || '').trim().toUpperCase()] || [];
}

function canonicalChampion(value, setCode = 'UNL') {
  const key = normalized(value);
  return setChampions(setCode).find(champion => normalized(champion) === key) || '';
}

function championFromSpot(card = {}) {
  const setCode = String(card.set_code || '').trim().toUpperCase();
  if (setCode === 'OGN') return originsChampionForCard(card);
  const prefix = String(card.name || '').split(',')[0].trim();
  const directChampions = DIRECT_CHAMPION_SPOTS_BY_SET[setCode] || [];
  const champion = canonicalChampion(prefix, setCode)
    || directChampions.find(candidate => taggedValues(card).includes(normalized(candidate)))
    || '';
  return directChampions.includes(champion) ? champion : '';
}

function vendettaSpotMapping(value, setCode = 'VEN') {
  if (String(setCode || '').trim().toUpperCase() !== 'VEN') return null;
  const key = normalized(value);
  return VENDETTA_SPOT_MAPPINGS.find(mapping => normalized(mapping.spot) === key) || null;
}

function vendettaSpotFromCard(card = {}) {
  return vendettaSpotMapping(String(card.name || '').split(',')[0], card.set_code);
}

function vendettaSpotLabel(mappingOrSpot) {
  const mapping = typeof mappingOrSpot === 'object' ? mappingOrSpot : vendettaSpotMapping(mappingOrSpot);
  if (!mapping) return '';
  if (mapping.kind === 'named') {
    return [mapping.spot, ...mapping.champions, ...mapping.extras.filter(name => normalized(name) !== normalized(mapping.spot))].join(' + ');
  }
  if (!mapping.color) return mapping.champions.join(' + ');
  return [...mapping.champions, `${mapping.color} Showcase Rune`, ...mapping.extras, `Rare ${mapping.domain} Cards`].join(' + ');
}

function spiritforgedSpotMapping(value, setCode = 'SFD') {
  if (String(setCode || '').trim().toUpperCase() !== 'SFD') return null;
  const key = normalized(value);
  return SPIRITFORGED_SPOT_MAPPINGS.find(mapping => {
    const names = mapping.kind === 'champion'
      ? [mapping.spot, mapping.signatureChampion, mapping.signatureCard, mapping.champion, mapping.championCard]
      : [mapping.spot, mapping.seal, mapping.rune];
    return names.some(name => normalized(name) === key);
  }) || null;
}

function spiritforgedSpotFromCard(card = {}) {
  const fullName = String(card.name || '').trim();
  return spiritforgedSpotMapping(fullName, card.set_code)
    || spiritforgedSpotMapping(fullName.split(',')[0], card.set_code);
}

function spiritforgedSpotLabel(mappingOrSpot) {
  const mapping = typeof mappingOrSpot === 'object' ? mappingOrSpot : spiritforgedSpotMapping(mappingOrSpot);
  if (!mapping) return '';
  return mapping.kind === 'champion'
    ? `${mapping.signatureChampion} Signature + ${mapping.champion}`
    : `${mapping.seal} + ${mapping.rune} Showcase Rune + Rare/Epic ${mapping.domain} Cards`;
}

function isShowcaseRune(card = {}) {
  if (!/rune/i.test(String(card.name || ''))) return false;
  const values = [card.rarity, card.collector_treatment, card.variant, card.source_rarity, card.manual_category]
    .map(value => String(value || '').trim().toUpperCase());
  return values.some(value => value === 'SHOWCASE' || value === 'ALTERNATE ART' || value === 'ALT ART');
}

function fieldValues(value) {
  if (Array.isArray(value)) return value.flatMap(fieldValues);
  if (value && typeof value === 'object') {
    const preferred = value.values || value.tags || value.type || value.superType || value.value;
    return preferred === undefined ? Object.values(value).flatMap(fieldValues) : fieldValues(preferred);
  }
  return String(value || '').split(/[,/;|]/).map(normalized).filter(Boolean);
}

function spiritforgedCardDomains(card = {}) {
  const values = [card.color, card.colors, card.domain, card.domains];
  try {
    const details = typeof card.details_json === 'string' ? JSON.parse(card.details_json) : card.details_json;
    if (details && typeof details === 'object') {
      for (const [key, value] of Object.entries(details)) {
        if (/^(?:domains?|colors?)$/i.test(key)) values.push(value);
      }
    }
  } catch {}
  return [...new Set(values.flatMap(fieldValues))];
}

function isSpiritforgedRareColorCard(card = {}, mappingOrSpot, setCode = 'SFD') {
  const mapping = typeof mappingOrSpot === 'object'
    ? mappingOrSpot
    : spiritforgedSpotMapping(mappingOrSpot, setCode);
  if (!mapping || mapping.kind !== 'color' || String(card.set_code || '').trim().toUpperCase() !== 'SFD') return false;
  const rarity = String(card.rarity || card.source_rarity || '').trim().toUpperCase();
  if (!['RARE', 'EPIC'].includes(rarity)) return false;
  const cardName = normalized(String(card.name || '').split(',')[0]);
  const cardType = String(card.card_type || '').trim().toUpperCase();
  // Seals and Showcase Runes have their own dedicated groups. The 24 champions
  // already advertised in Signature + Champion pairs stay exclusively with
  // those spots. A Rare Champion Unit without a mapped SFD pair is intentionally
  // included in its matching rune/domain lane.
  if (cardName === normalized(mapping.seal) || cardName === normalized(mapping.rune)) return false;
  if (/RUNE|LEGEND/.test(cardType)) return false;
  if (SPIRITFORGED_ALL_CHAMPIONS.some(champion => cardBelongsToChampion(card, champion, 'SFD'))) return false;

  const explicitEpicDomain = rarity === 'EPIC' ? SPIRITFORGED_GENERIC_EPIC_DOMAIN[cardName] : '';
  if (explicitEpicDomain) return normalized(explicitEpicDomain) === normalized(mapping.domain);
  return spiritforgedCardDomains(card).includes(normalized(mapping.domain));
}

function isVendettaRareColorCard(card = {}, mappingOrSpot, setCode = 'VEN') {
  const mapping = typeof mappingOrSpot === 'object'
    ? mappingOrSpot
    : vendettaSpotMapping(mappingOrSpot, setCode);
  if (!mapping?.color || !mapping.domain || String(card.set_code || '').trim().toUpperCase() !== 'VEN') return false;
  if (String(card.rarity || card.source_rarity || '').trim().toUpperCase() !== 'RARE') return false;
  const cardName = normalized(String(card.name || '').split(',')[0]);
  const cardType = String(card.card_type || '').trim().toUpperCase();
  // The Showcase Rune and Legends/champions already have their own groups.
  // This row is only for regular Rare units, spells, gear, and similar cards.
  if (cardName === normalized(mapping.rune)) return false;
  if (/RUNE|LEGEND|CHAMPION/.test(cardType)) return false;
  return spiritforgedCardDomains(card).includes(normalized(mapping.domain));
}

function poroMapping(value, setCode = 'UNL') {
  if (String(setCode || '').trim().toUpperCase() !== 'UNL') return null;
  const key = normalized(value);
  return UNLEASHED_PORO_MAPPINGS.find(mapping => normalized(mapping.poro) === key) || null;
}

function poroFromSpot(card = {}) {
  const mapping = poroMapping(String(card.name || '').split(',')[0], card.set_code);
  return mapping?.poro || '';
}

function runeMapping(value, setCode = 'UNL') {
  if (String(setCode || '').trim().toUpperCase() !== 'UNL') return null;
  const key = normalized(value);
  return UNLEASHED_PORO_MAPPINGS.find(mapping => normalized(mapping.rune) === key) || null;
}

function runeFromSpot(card = {}) {
  const mapping = runeMapping(String(card.name || '').split(',')[0], card.set_code);
  return mapping?.rune || '';
}

function taggedValues(card = {}) {
  const values = [card.card_traits, card.traits, card.champion, card.champion_name];
  try {
    const details = typeof card.details_json === 'string' ? JSON.parse(card.details_json) : card.details_json;
    if (details && typeof details === 'object') {
      for (const [key, value] of Object.entries(details)) {
        if (/champion|signature.*for|legend/i.test(key)) values.push(value);
        if (/^tags?$/i.test(key)) values.push(value?.values || value?.tags || value);
      }
    }
  } catch {}
  return values.flatMap(value => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') return Object.values(value).flat();
    return String(value || '').split(/[,;|]/);
  }).map(value => normalized(value?.label || value?.name || value)).filter(Boolean);
}

function cardBelongsToChampion(card = {}, champion, setCode = 'UNL') {
  const normalizedSetCode = String(setCode || '').trim().toUpperCase();
  if (normalizedSetCode === 'OGN') return cardBelongsToOriginsChampion(card, champion);
  const canonical = canonicalChampion(champion, setCode);
  if (!canonical || String(card.set_code || '').trim().toUpperCase() !== normalizedSetCode) return false;
  const championKey = normalized(canonical);
  const prefix = normalized(String(card.name || '').split(',')[0]);
  if (prefix === championKey) return true;
  return taggedValues(card).some(value => value === championKey || value.startsWith(`${championKey} `));
}

function isUnleashedBaronCard(card = {}) {
  if (String(card.set_code || '').trim().toUpperCase() !== 'UNL') return false;
  const prefix = normalized(String(card.name || '').split(',')[0]);
  // Baron Nashor is a standalone advertised Unleashed spot. Every printing
  // (regular Epic, alt-art, and the Ultimate/overnumbered printing) stays
  // exclusively with that Baron spot instead of leaking into Chaos/Purple.
  return prefix === normalized('Baron Nashor');
}

function baronFromSpot(card = {}) {
  return isUnleashedBaronCard(card) ? 'Baron Nashor' : '';
}

function cardBelongsToBaron(card = {}, setCode = 'UNL') {
  return String(setCode || '').trim().toUpperCase() === 'UNL' && isUnleashedBaronCard(card);
}

function isArachnoidHorror(card = {}) {
  const cardName = normalized(String(card.name || '').split(',')[0]);
  const collectorNumber = String(card.card_number || card.number || '')
    .trim()
    .toUpperCase()
    .replace(/^UNL[-\s]*/, '')
    .split('/')[0]
    .replace(/^0+(?=\d)/, '');
  return cardName === normalized('Arachnoid Horror') || collectorNumber === '117';
}

function isUnleashedRareColorCard(card = {}, mappingOrSpot, setCode = 'UNL') {
  const mapping = typeof mappingOrSpot === 'object'
    ? mappingOrSpot
    : poroMapping(mappingOrSpot, setCode);
  if (!mapping?.domain || String(card.set_code || '').trim().toUpperCase() !== 'UNL') return false;
  const rarity = String(card.rarity || card.source_rarity || '').trim().toUpperCase();
  // Unleashed rune-color Buyer Bags own all unreserved Rare and Epic cards in
  // their matching domain. Champion-family hits and named chase cards are
  // filtered below so they stay with the advertised spot that owns them.
  if (!['RARE', 'EPIC'].includes(rarity)) return false;
  const cardName = normalized(String(card.name || '').split(',')[0]);
  const reservedNames = UNLEASHED_PORO_MAPPINGS.flatMap(entry => [entry.poro, entry.mappedCard, entry.rune]).map(normalized);
  const cardType = String(card.card_type || '').trim().toUpperCase();
  // Poro, paired chase, Rune, Baron, and the 12 advertised headline champion
  // families keep their dedicated ownership. Unleashed also contains Rare
  // Champion Units that are NOT one of those 12 headline spots (for example
  // Katarina, Hwei, Nidalee, Syndra, Ashe, etc.). Those unreserved Champion
  // Units belong in their matching rune/domain Buyer Bag for audit purposes.
  // Therefore we exclude Rune/Legend card types here, but do NOT blanket-exclude
  // every card whose type contains CHAMPION. The explicit headline-family check
  // below is what prevents the 12 real champion spots from leaking into Poros.
  if (reservedNames.includes(cardName) || /RUNE|LEGEND/.test(cardType)) return false;
  if (isUnleashedBaronCard(card)) return false;
  if (UNLEASHED_CHAMPIONS.some(champion => cardBelongsToChampion(card, champion, 'UNL'))) return false;

  // The Unleashed import data is not consistent about carrying a domain/color
  // value on every Epic. Keep a small explicit fallback for the generic Epics
  // that belong in rune-color Buyer Bags. Named Poro chase cards remain reserved
  // above, and Baron remains standalone.
  const explicitEpicDomain = rarity === 'EPIC' ? UNLEASHED_GENERIC_EPIC_DOMAIN[cardName] : '';
  if (explicitEpicDomain) return normalized(explicitEpicDomain) === normalized(mapping.domain);
  return spiritforgedCardDomains(card).includes(normalized(mapping.domain));
}

function cardBelongsToPoroSpot(card = {}, poro, setCode = 'UNL') {
  const mapping = poroMapping(poro, setCode);
  if (!mapping || String(card.set_code || '').trim().toUpperCase() !== String(setCode).trim().toUpperCase()) return false;
  const cardName = normalized(String(card.name || '').split(',')[0]);
  return cardName === normalized(mapping.poro)
    || cardName === normalized(mapping.mappedCard)
    || cardName === normalized(mapping.rune)
    || isUnleashedRareColorCard(card, mapping, setCode);
}

function cardBelongsToVendettaSpot(card = {}, mappingOrSpot, setCode = 'VEN') {
  const mapping = typeof mappingOrSpot === 'object'
    ? mappingOrSpot
    : vendettaSpotMapping(mappingOrSpot, setCode);
  if (!mapping || String(card.set_code || '').trim().toUpperCase() !== 'VEN') return false;
  if (mapping.champions.some(champion => cardBelongsToChampion(card, champion, 'VEN'))) return true;
  const cardName = normalized(String(card.name || '').split(',')[0]);
  return (cardName === normalized(mapping.rune) && isShowcaseRune(card))
    || mapping.extras.some(name => cardName === normalized(name))
    || isVendettaRareColorCard(card, mapping, setCode);
}

function cardBelongsToSpiritforgedSpot(card = {}, mappingOrSpot, setCode = 'SFD') {
  const mapping = typeof mappingOrSpot === 'object'
    ? mappingOrSpot
    : spiritforgedSpotMapping(mappingOrSpot, setCode);
  if (!mapping || String(card.set_code || '').trim().toUpperCase() !== 'SFD') return false;
  if (mapping.kind === 'champion') {
    return cardBelongsToChampion(card, mapping.signatureChampion, 'SFD')
      || cardBelongsToChampion(card, mapping.champion, 'SFD');
  }
  const cardName = normalized(String(card.name || '').split(',')[0]);
  return cardName === normalized(mapping.seal)
    || (cardName === normalized(mapping.rune) && isShowcaseRune(card))
    || isSpiritforgedRareColorCard(card, mapping, setCode);
}

function sortChampionFamily(left = {}, right = {}) {
  const treatmentRank = value => ({ SIGNATURE: 0, OVERNUMBERED: 1, 'ALTERNATE ART': 2 }[String(value || '').trim().toUpperCase()] ?? 9);
  const rarityRank = value => ({ ULTIMATE: 0, EPIC: 1, RARE: 2, UNCOMMON: 3, COMMON: 4 }[String(value || '').trim().toUpperCase()] ?? 9);
  return treatmentRank(left.collector_treatment || left.variant) - treatmentRank(right.collector_treatment || right.variant)
    || rarityRank(left.rarity) - rarityRank(right.rarity)
    || String(left.card_number || '').localeCompare(String(right.card_number || ''), undefined, { numeric: true })
    || String(left.name || '').localeCompare(String(right.name || ''));
}

module.exports = {
  ORIGINS_CHAMPIONS,
  cardBelongsToOriginsSpot,
  isOriginsAaRune,
  isOriginsRareEpicDomainCard,
  originsChampionForCard,
  originsSpotFromCard,
  originsSpotLabel,
  originsSpotMapping,
  SPIRITFORGED_ALL_CHAMPIONS,
  SPIRITFORGED_SPOT_MAPPINGS,
  VENDETTA_ALL_CHAMPIONS,
  VENDETTA_RIVAL_ON_CHAMPIONS,
  VENDETTA_SIGNATURE_CHAMPIONS,
  VENDETTA_SPOT_MAPPINGS,
  UNLEASHED_PORO_MAPPINGS,
  UNLEASHED_CHAMPIONS,
  canonicalChampion,
  championFromSpot,
  baronFromSpot,
  cardBelongsToBaron,
  cardBelongsToChampion,
  cardBelongsToPoroSpot,
  cardBelongsToSpiritforgedSpot,
  cardBelongsToVendettaSpot,
  isShowcaseRune,
  isSpiritforgedRareColorCard,
  isUnleashedRareColorCard,
  isVendettaRareColorCard,
  poroFromSpot,
  poroMapping,
  runeFromSpot,
  runeMapping,
  sortChampionFamily,
  spiritforgedSpotFromCard,
  spiritforgedSpotLabel,
  spiritforgedSpotMapping,
  spiritforgedCardDomains,
  vendettaSpotFromCard,
  vendettaSpotLabel,
  vendettaSpotMapping
};
