'use strict';

// Origins (OGN) 18-spot break mapping.
// Public board: 12 featured Champion spots + 6 Seal/domain spots.
// Champion identity always wins over domain ownership.  The six domain spots
// intentionally exclude Common/Uncommon cards; they own the Seal, the booster
// Alternate-Art Rune, and every unreserved Rare/Epic card in that domain.

const ORIGINS_CHAMPIONS = Object.freeze([
  "Kai'Sa", 'Volibear', 'Jinx', 'Darius', 'Ahri', 'Lee Sin',
  'Yasuo', 'Leona', 'Teemo', 'Viktor', 'Miss Fortune', 'Sett'
]);

const ORIGINS_CHAMPION_CARD_NUMBERS = Object.freeze({
  "Kai'Sa": Object.freeze(['039', '112', '247', '248', '299']),
  Volibear: Object.freeze(['041', '158', '249', '250', '300']),
  Jinx: Object.freeze(['030', '202', '251', '252', '301']),
  Darius: Object.freeze(['027', '243', '253', '254', '302']),
  Ahri: Object.freeze(['066', '119', '255', '256', '303']),
  'Lee Sin': Object.freeze(['078', '151', '257', '258', '304']),
  Yasuo: Object.freeze(['076', '205', '259', '260', '305']),
  Leona: Object.freeze(['079', '238', '261', '262', '306']),
  Teemo: Object.freeze(['121', '197', '263', '264', '307']),
  Viktor: Object.freeze(['117', '246', '265', '266', '308']),
  'Miss Fortune': Object.freeze(['162', '193', '267', '268', '309']),
  Sett: Object.freeze(['164', '240', '269', '270', '310'])
});

const ORIGINS_COLOR_SPOTS = Object.freeze([
  Object.freeze({ kind: 'color', spot: 'Seal of Rage', color: 'Red', domain: 'Fury', seal: 'Seal of Rage', sealNumber: '040', rune: 'Fury Rune', runeNumber: '007', start: 1, end: 41 }),
  Object.freeze({ kind: 'color', spot: 'Seal of Focus', color: 'Green', domain: 'Calm', seal: 'Seal of Focus', sealNumber: '081', rune: 'Calm Rune', runeNumber: '042', start: 42, end: 82 }),
  Object.freeze({ kind: 'color', spot: 'Seal of Insight', color: 'Blue', domain: 'Mind', seal: 'Seal of Insight', sealNumber: '120', rune: 'Mind Rune', runeNumber: '089', start: 83, end: 123 }),
  Object.freeze({ kind: 'color', spot: 'Seal of Strength', color: 'Orange', domain: 'Body', seal: 'Seal of Strength', sealNumber: '163', rune: 'Body Rune', runeNumber: '126', start: 124, end: 164 }),
  Object.freeze({ kind: 'color', spot: 'Seal of Discord', color: 'Purple', domain: 'Chaos', seal: 'Seal of Discord', sealNumber: '204', rune: 'Chaos Rune', runeNumber: '166', start: 165, end: 205 }),
  Object.freeze({ kind: 'color', spot: 'Seal of Unity', color: 'Yellow', domain: 'Order', seal: 'Seal of Unity', sealNumber: '245', rune: 'Order Rune', runeNumber: '214', start: 206, end: 246 })
]);

function norm(value) {
  return String(value || '').trim().toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']+/g, ' ');
}

function originsCardNumberParts(card = {}) {
  const raw = String(card.card_number || card.number || '').trim().toUpperCase();
  const body = raw.replace(/^OGN[-\s]*/, '').split('/')[0].trim();
  const match = body.match(/^0*(\d+)([A-Z]|\*)?/);
  if (!match) return { number: 0, padded: '', variant: '' };
  const number = Number(match[1]);
  return {
    number,
    padded: Number.isFinite(number) ? String(number).padStart(3, '0') : '',
    variant: String(match[2] || '').toUpperCase()
  };
}

function originsChampionForCard(card = {}) {
  if (String(card.set_code || '').trim().toUpperCase() !== 'OGN') return '';
  const { padded } = originsCardNumberParts(card);
  if (padded) {
    const byNumber = ORIGINS_CHAMPIONS.find(champion => ORIGINS_CHAMPION_CARD_NUMBERS[champion].includes(padded));
    if (byNumber) return byNumber;
  }
  const prefix = norm(String(card.name || '').split(',')[0]);
  return ORIGINS_CHAMPIONS.find(champion => norm(champion) === prefix) || '';
}

function cardBelongsToOriginsChampion(card = {}, champion) {
  if (String(card.set_code || '').trim().toUpperCase() !== 'OGN') return false;
  const canonical = ORIGINS_CHAMPIONS.find(candidate => norm(candidate) === norm(champion));
  if (!canonical) return false;
  const mapped = originsChampionForCard(card);
  return mapped ? mapped === canonical : false;
}

function originsSpotMapping(value, setCode = 'OGN') {
  if (String(setCode || '').trim().toUpperCase() !== 'OGN') return null;
  const key = norm(value);
  return ORIGINS_COLOR_SPOTS.find(mapping => [mapping.spot, mapping.seal, mapping.rune, mapping.domain]
    .some(name => norm(name) === key)) || null;
}

function originsSpotFromCard(card = {}) {
  const fullName = String(card.name || '').trim();
  return originsSpotMapping(fullName, card.set_code)
    || originsSpotMapping(fullName.split(',')[0], card.set_code);
}

function originsSpotLabel(mappingOrSpot) {
  const mapping = typeof mappingOrSpot === 'object' ? mappingOrSpot : originsSpotMapping(mappingOrSpot);
  if (!mapping) return '';
  return `${mapping.seal} + ${mapping.rune} AA + Rare/Epic ${mapping.domain} Cards`;
}

function isOriginsAaRune(card = {}, mappingOrSpot) {
  const mapping = typeof mappingOrSpot === 'object' ? mappingOrSpot : originsSpotMapping(mappingOrSpot);
  if (!mapping || String(card.set_code || '').trim().toUpperCase() !== 'OGN') return false;
  if (norm(String(card.name || '').split(',')[0]) !== norm(mapping.rune)) return false;
  const parts = originsCardNumberParts(card);
  if (parts.padded && parts.padded !== mapping.runeNumber) return false;
  // OGN xxb Runes are promotional/Nexus Night printings and are not part of a
  // normal Origins booster-box break.  Only the booster AA (A) is mapped.
  if (parts.variant === 'B') return false;
  if (parts.variant === 'A') return true;
  const values = [card.rarity, card.collector_treatment, card.variant, card.source_rarity, card.manual_category]
    .map(value => String(value || '').trim().toUpperCase());
  return values.some(value => value === 'SHOWCASE' || value === 'ALTERNATE ART' || value === 'ALT ART');
}

function isOriginsRareEpicDomainCard(card = {}, mappingOrSpot) {
  const mapping = typeof mappingOrSpot === 'object' ? mappingOrSpot : originsSpotMapping(mappingOrSpot);
  if (!mapping || String(card.set_code || '').trim().toUpperCase() !== 'OGN') return false;
  const name = norm(String(card.name || '').split(',')[0]);
  if (name === norm(mapping.seal) || name === norm(mapping.rune)) return false;
  // All five Origins collector numbers that belong to a featured champion are
  // reserved to that Champion spot, including AA and Signature/ON treatments.
  if (originsChampionForCard(card)) return false;
  const parts = originsCardNumberParts(card);
  if (!parts.number || parts.number < mapping.start || parts.number > mapping.end) return false;
  // Each 41-card domain block is structured as 14 Common, 10 Uncommon,
  // 12 Rare, then 5 Epic collector numbers.  This keeps C/UC completely out
  // while still including AA treatments of Rare/Epic side champions.
  const offset = parts.number - mapping.start + 1;
  return offset >= 25 && offset <= 41;
}

function cardBelongsToOriginsSpot(card = {}, mappingOrSpot, setCode = 'OGN') {
  const mapping = typeof mappingOrSpot === 'object' ? mappingOrSpot : originsSpotMapping(mappingOrSpot, setCode);
  if (!mapping || String(card.set_code || '').trim().toUpperCase() !== 'OGN') return false;
  const name = norm(String(card.name || '').split(',')[0]);
  if (name === norm(mapping.seal)) return true;
  if (name === norm(mapping.rune)) return isOriginsAaRune(card, mapping);
  return isOriginsRareEpicDomainCard(card, mapping);
}

module.exports = {
  ORIGINS_CHAMPIONS,
  ORIGINS_CHAMPION_CARD_NUMBERS,
  ORIGINS_COLOR_SPOTS,
  cardBelongsToOriginsChampion,
  cardBelongsToOriginsSpot,
  isOriginsAaRune,
  isOriginsRareEpicDomainCard,
  originsCardNumberParts,
  originsChampionForCard,
  originsSpotFromCard,
  originsSpotLabel,
  originsSpotMapping
};
