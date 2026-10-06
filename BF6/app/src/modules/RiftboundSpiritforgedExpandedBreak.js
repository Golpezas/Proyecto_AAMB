'use strict';

const {
  cardBelongsToChampion,
  isShowcaseRune,
  isSpiritforgedRareColorCard,
  sortChampionFamily,
  spiritforgedCardDomains
} = require('./RiftboundChampionAudit');

const SPIRITFORGED_EXPANDED_PROFILE_ID = 'SFD_EXPANDED_50_SPLIT_CHASES_RUNES_COLORS_V4';
const SPIRITFORGED_EXPANDED_LEGACY_PROFILE_ID = 'SFD_EXPANDED_39_SPLIT_CHAMPIONS_SEALS_RUNES_V3';
const SPIRITFORGED_EXPANDED_LEGACY_V1_PROFILE_ID = 'SFD_EXPANDED_39_SPLIT_CHAMPIONS_SEALS_RUNES_V1';
const SPIRITFORGED_EXPANDED_BOARD_SLOT = 6;
const SPIRITFORGED_EXPANDED_BOARD_NAME = 'Spiritforged · 50 Spots · Split SIG, ON, Runes & Colors';
const SPIRITFORGED_EXPANDED_MIGRATION_KEY = 'spiritforged-board-6-50-split-chases-runes-colors-v4';
const SPIRITFORGED_EXPANDED_LEGACY_MIGRATION_KEY = 'spiritforged-board-6-39-split-champions-seals-runes-v1';

function championSpot(position, champion, anchor, anchorNumber, familyMode = 'champion') {
  return Object.freeze({ position, key: `CHAMPION_${String(position).padStart(2, '0')}`, kind: 'champion', champion, anchor, anchorNumber, familyMode, color: '', domain: '', rune: '', seal: '' });
}

function championChaseSpot(position, champion, anchor, anchorNumber, chase, familyMode = '') {
  return Object.freeze({
    position,
    key: `CHAMPION_${chase}_${String(position).padStart(2, '0')}`,
    kind: chase === 'SIG' ? 'champion-sig' : (chase === 'ON' ? 'champion-on' : 'champion-family'),
    champion,
    anchor,
    anchorNumber,
    chase,
    familyMode: familyMode || (chase === 'SIG' ? 'signature-family' : chase === 'ON' ? 'overnumbered-only' : 'champion-family'),
    color: '', domain: '', rune: '', seal: ''
  });
}

function ireliaAltEpicSpot(position) {
  return Object.freeze({
    position,
    key: `IRELIA_ALT_EPIC_${String(position).padStart(2, '0')}`,
    kind: 'irelia-alt-epic',
    champion: 'Irelia, Fervent',
    label: 'Irelia, Fervent ALT + EPIC',
    anchor: 'Irelia, Fervent',
    anchorNumber: '057A',
    cardNumbers: Object.freeze(['057A', '057']),
    familyMode: 'irelia-fervent-alt-epic',
    color: '', domain: '', rune: '', seal: ''
  });
}

function namedSpot(position, kind, label, anchor, anchorNumber, members = []) {
  return Object.freeze({ position, key: `NAMED_${String(position).padStart(2, '0')}`, kind, label, anchor, anchorNumber, champion: '', familyMode: '', color: '', domain: '', rune: '', seal: '', members: Object.freeze([...members]) });
}

function sealSpot(position, seal, color, domain, anchorNumber) {
  return Object.freeze({ position, key: `SEAL_${domain.toUpperCase()}`, kind: 'seal', label: seal, anchor: seal, anchorNumber, champion: '', familyMode: '', color, domain, rune: '', seal });
}

function runeColorSpot(position, rune, color, domain, anchorNumber) {
  return Object.freeze({ position, key: `RUNE_COLOR_${domain.toUpperCase()}`, kind: 'rune-color', label: `${rune} + Rare/Epic ${domain} Cards`, anchor: rune, anchorNumber, champion: '', familyMode: '', color, domain, rune, seal: '' });
}

function allRunesSpot(position) {
  return Object.freeze({
    position,
    key: 'ALL_RUNES_AA',
    kind: 'all-runes',
    label: 'ALL RUNES · AA',
    anchor: 'Fury Rune',
    anchorNumber: 'R01A',
    champion: '', familyMode: '', color: 'All', domain: 'All', rune: 'All Runes', seal: ''
  });
}

function domainPoolSpot(position, domain, color, anchor, anchorNumber) {
  return Object.freeze({
    position,
    key: `DOMAIN_POOL_${domain.toUpperCase()}`,
    kind: 'domain-pool',
    label: `${domain} · Rare+ Gear / Spell / Unit`,
    anchor,
    anchorNumber,
    champion: '', familyMode: '', color, domain, rune: '', seal: ''
  });
}

// Board 6 v4: split every Signature and matching Overnumbered into separate
// purchasable lanes. Irelia, Fervent gets a third ALT + EPIC lane. The six
// Showcase Runes share one lane, while Rare/Epic non-champion Gear/Spell/Unit
// cards are split by domain/color.
const SPIRITFORGED_EXPANDED_SPOTS = Object.freeze([
  championChaseSpot(1, 'Teemo', 'Teemo, Strategist', '230*', 'SIG'),
  championChaseSpot(2, 'Teemo', 'Teemo, Strategist', '230', 'ON'),
  championChaseSpot(3, 'Rumble', 'Rumble, Mechanized Menace', '240', 'FAMILY'),
  championChaseSpot(4, 'Sett', 'Sett, Brawler', '232*', 'SIG'),
  championChaseSpot(5, 'Sett', 'Sett, Brawler', '232', 'ON'),
  championChaseSpot(6, 'Lucian', 'Lucian, Purifier', '241', 'FAMILY'),
  championChaseSpot(7, 'Darius', 'Darius, Executioner', '236*', 'SIG'),
  championChaseSpot(8, 'Darius', 'Darius, Executioner', '236', 'ON'),
  championChaseSpot(9, 'Draven', 'Draven, Glorious Executioner', '242', 'FAMILY'),
  championChaseSpot(10, 'Vayne', 'Vayne, Hunter', '223*', 'SIG'),
  championChaseSpot(11, 'Vayne', 'Vayne, Hunter', '223', 'ON'),
  championChaseSpot(12, "Rek'Sai", "Rek'Sai, Void Burrower", '243', 'FAMILY'),
  championChaseSpot(13, 'Aphelios', 'Aphelios, Exalted', '224*', 'SIG'),
  championChaseSpot(14, 'Aphelios', 'Aphelios, Exalted', '224', 'ON'),
  championChaseSpot(15, 'Ornn', 'Ornn, Fire Below the Mountain', '244', 'FAMILY'),
  championChaseSpot(16, 'Yone', 'Yone, Blademaster', '233*', 'SIG'),
  championChaseSpot(17, 'Yone', 'Yone, Blademaster', '233', 'ON'),
  championChaseSpot(18, 'Jax', 'Jax, Grandmaster at Arms', '245', 'FAMILY'),
  championChaseSpot(19, 'Irelia, Fervent', 'Irelia, Fervent', '225*', 'SIG', 'irelia-fervent-signature'),
  championChaseSpot(20, 'Irelia, Fervent', 'Irelia, Fervent', '225', 'ON', 'irelia-fervent-overnumbered'),
  ireliaAltEpicSpot(21),
  championChaseSpot(22, 'Irelia, Blade Dancer', 'Irelia, Blade Dancer', '246', 'FAMILY', 'irelia-remainder'),
  championChaseSpot(23, 'Soraka', 'Soraka, Wanderer', '239*', 'SIG'),
  championChaseSpot(24, 'Soraka', 'Soraka, Wanderer', '239', 'ON'),
  championChaseSpot(25, 'Azir', 'Azir, Emperor of the Sands', '247', 'FAMILY'),
  championChaseSpot(26, 'Ahri', 'Ahri, Inquisitive', '227*', 'SIG'),
  championChaseSpot(27, 'Ahri', 'Ahri, Inquisitive', '227', 'ON'),
  championChaseSpot(28, 'Ezreal', 'Ezreal, Prodigal Explorer', '248', 'FAMILY'),
  championChaseSpot(29, 'Bard', 'Bard, Mercurial', '228*', 'SIG'),
  championChaseSpot(30, 'Bard', 'Bard, Mercurial', '228', 'ON'),
  championChaseSpot(31, 'Renata Glasc', 'Renata Glasc, Chem-Baroness', '249', 'FAMILY'),
  championChaseSpot(32, 'Yasuo', 'Yasuo, Windrider', '235*', 'SIG'),
  championChaseSpot(33, 'Yasuo', 'Yasuo, Windrider', '235', 'ON'),
  championChaseSpot(34, 'Sivir', 'Sivir, Battle Mistress', '250', 'FAMILY'),
  championChaseSpot(35, 'Karma', 'Karma, Channeler', '237*', 'SIG'),
  championChaseSpot(36, 'Karma', 'Karma, Channeler', '237', 'ON'),
  championChaseSpot(37, 'Fiora', 'Fiora, Grand Duelist', '251', 'FAMILY'),
  sealSpot(38, 'Seal of Rage', 'Red', 'Fury', '222'),
  sealSpot(39, 'Seal of Focus', 'Green', 'Calm', '226'),
  sealSpot(40, 'Seal of Insight', 'Blue', 'Mind', '229'),
  sealSpot(41, 'Seal of Strength', 'Orange', 'Body', '231'),
  sealSpot(42, 'Seal of Discord', 'Purple', 'Chaos', '234'),
  sealSpot(43, 'Seal of Unity', 'Yellow', 'Order', '238'),
  allRunesSpot(44),
  domainPoolSpot(45, 'Fury', 'Red', 'Dunebreaker', '027'),
  domainPoolSpot(46, 'Calm', 'Green', 'Svellsongur', '059'),
  domainPoolSpot(47, 'Mind', 'Blue', 'Premonition', '087'),
  domainPoolSpot(48, 'Body', 'Orange', 'Ancient Henge', '117'),
  domainPoolSpot(49, 'Chaos', 'Purple', 'Last Rites', '150'),
  domainPoolSpot(50, 'Order', 'Yellow', 'Blade of the Ruined King', '178')
]);

// v3 39-spot profile retained so already-created rounds preserve ownership.
const SPIRITFORGED_EXPANDED_LEGACY_SPOTS = Object.freeze([
  championSpot(1, 'Teemo', 'Teemo, Strategist', '230'), championSpot(2, 'Rumble', 'Rumble, Mechanized Menace', '240'),
  championSpot(3, 'Sett', 'Sett, Brawler', '232'), championSpot(4, 'Lucian', 'Lucian, Purifier', '241'),
  championSpot(5, 'Darius', 'Darius, Executioner', '236'), championSpot(6, 'Draven', 'Draven, Glorious Executioner', '242'),
  championSpot(7, 'Vayne', 'Vayne, Hunter', '223'), championSpot(8, "Rek'Sai", "Rek'Sai, Void Burrower", '243'),
  championSpot(9, 'Aphelios', 'Aphelios, Exalted', '224'), championSpot(10, 'Ornn', 'Ornn, Fire Below the Mountain', '244'),
  championSpot(11, 'Yone', 'Yone, Blademaster', '233'), championSpot(12, 'Jax', 'Jax, Grandmaster at Arms', '245'),
  championSpot(13, 'Irelia, Fervent', 'Irelia, Fervent', '225', 'irelia-fervent'), championSpot(14, 'Irelia, Blade Dancer', 'Irelia, Blade Dancer', '246', 'irelia-remainder'),
  championSpot(15, 'Soraka', 'Soraka, Wanderer', '239'), championSpot(16, 'Azir', 'Azir, Emperor of the Sands', '247'),
  championSpot(17, 'Ahri', 'Ahri, Inquisitive', '227'), championSpot(18, 'Ezreal', 'Ezreal, Prodigal Explorer', '248'),
  championSpot(19, 'Bard', 'Bard, Mercurial', '228'), championSpot(20, 'Renata Glasc', 'Renata Glasc, Chem-Baroness', '249'),
  championSpot(21, 'Yasuo', 'Yasuo, Windrider', '235'), championSpot(22, 'Sivir', 'Sivir, Battle Mistress', '250'),
  championSpot(23, 'Karma', 'Karma, Channeler', '237'), championSpot(24, 'Fiora', 'Fiora, Grand Duelist', '251'),
  namedSpot(25, 'named-bundle', 'Fizz + Switcheroo', 'Fizz, Trickster', '140', ['Fizz', 'Switcheroo']),
  namedSpot(26, 'named-bundle', 'Premonition + Downwell', 'Premonition', '87', ['Premonition', 'Downwell']),
  namedSpot(27, 'named-single', 'Last Rites', 'Last Rites', '150', ['Last Rites']),
  sealSpot(28, 'Seal of Rage', 'Red', 'Fury', '222'), sealSpot(29, 'Seal of Focus', 'Green', 'Calm', '226'),
  sealSpot(30, 'Seal of Insight', 'Blue', 'Mind', '229'), sealSpot(31, 'Seal of Strength', 'Orange', 'Body', '231'),
  sealSpot(32, 'Seal of Discord', 'Purple', 'Chaos', '234'), sealSpot(33, 'Seal of Unity', 'Yellow', 'Order', '238'),
  runeColorSpot(34, 'Fury Rune', 'Red', 'Fury', 'R01A'), runeColorSpot(35, 'Calm Rune', 'Green', 'Calm', 'R02A'),
  runeColorSpot(36, 'Mind Rune', 'Blue', 'Mind', 'R03A'), runeColorSpot(37, 'Body Rune', 'Orange', 'Body', 'R04A'),
  runeColorSpot(38, 'Chaos Rune', 'Purple', 'Chaos', 'R05A'), runeColorSpot(39, 'Order Rune', 'Yellow', 'Order', 'R06A')
]);

const SPIRITFORGED_EXPANDED_LEGACY_V1_SPOTS = Object.freeze([
  ...SPIRITFORGED_EXPANDED_LEGACY_SPOTS.slice(0, 24),
  namedSpot(25, 'fizz-premonition', 'Fizz + Premonition', 'Fizz, Trickster', '140', ['Fizz', 'Premonition']),
  namedSpot(26, 'named-single', "Shurelya's Requiem", "Shurelya's Requiem", '192', ["Shurelya's Requiem"]),
  namedSpot(27, 'named-single', 'Last Rites', 'Last Rites', '150', ['Last Rites']),
  ...SPIRITFORGED_EXPANDED_LEGACY_SPOTS.slice(27)
]);

const SPIRITFORGED_EXPANDED_PROFILE = Object.freeze({ id: SPIRITFORGED_EXPANDED_PROFILE_ID, spots: SPIRITFORGED_EXPANDED_SPOTS });
const SPIRITFORGED_EXPANDED_LEGACY_PROFILE = Object.freeze({ id: SPIRITFORGED_EXPANDED_LEGACY_PROFILE_ID, spots: SPIRITFORGED_EXPANDED_LEGACY_SPOTS });
const SPIRITFORGED_EXPANDED_LEGACY_V1_PROFILE = Object.freeze({ id: SPIRITFORGED_EXPANDED_LEGACY_V1_PROFILE_ID, spots: SPIRITFORGED_EXPANDED_LEGACY_V1_SPOTS });

function norm(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9']+/g, ' ')
    .trim();
}

function fullName(card = {}) {
  return norm(card.name);
}

function prefixName(card = {}) {
  return norm(String(card.name || '').split(',')[0]);
}

function setCode(card = {}) {
  return String(card.set_code || '').trim().toUpperCase();
}

function collectorNumberKey(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^SFD[-\s]*/, '')
    .split('/')[0]
    .replace(/-STAR$/, '*')
    .replace(/^0+(?=\d)/, '');
}

function matchesSpiritforgedExpandedAnchor(card = {}, spot = {}) {
  if (setCode(card) !== 'SFD') return false;
  const actual = collectorNumberKey(card.card_number || card.number);
  const expected = collectorNumberKey(spot.anchorNumber);
  return actual === expected || (spot.kind === 'champion' && actual === `${expected}*`);
}

function profileSpots(profile = SPIRITFORGED_EXPANDED_PROFILE) {
  return Array.isArray(profile) ? profile : (Array.isArray(profile?.spots) ? profile.spots : SPIRITFORGED_EXPANDED_SPOTS);
}

function spiritforgedExpandedSpotForAnchor(card = {}, position = 0, profile = SPIRITFORGED_EXPANDED_PROFILE) {
  const spots = profileSpots(profile);
  const wantedPosition = Number(position || card.position || 0);
  if (wantedPosition) {
    const expected = spots.find(spot => spot.position === wantedPosition);
    return expected && matchesSpiritforgedExpandedAnchor(card, expected) ? expected : null;
  }
  return spots.find(spot => matchesSpiritforgedExpandedAnchor(card, spot)) || null;
}

function boardMatchesSpiritforgedExpandedProfile(boardRows = [], profile = SPIRITFORGED_EXPANDED_PROFILE) {
  const spots = profileSpots(profile);
  const rows = [...(Array.isArray(boardRows) ? boardRows : [])]
    .sort((left, right) => Number(left.position || 0) - Number(right.position || 0));
  return rows.length === spots.length
    && spots.every((spot, index) =>
      Number(rows[index]?.position || 0) === spot.position
        && matchesSpiritforgedExpandedAnchor(rows[index], spot)
    );
}

function spiritforgedExpandedProfileForBoard(boardRows = []) {
  if (boardMatchesSpiritforgedExpandedProfile(boardRows, SPIRITFORGED_EXPANDED_PROFILE)) return SPIRITFORGED_EXPANDED_PROFILE;
  if (boardMatchesSpiritforgedExpandedProfile(boardRows, SPIRITFORGED_EXPANDED_LEGACY_PROFILE)) return SPIRITFORGED_EXPANDED_LEGACY_PROFILE;
  if (boardMatchesSpiritforgedExpandedProfile(boardRows, SPIRITFORGED_EXPANDED_LEGACY_V1_PROFILE)) return SPIRITFORGED_EXPANDED_LEGACY_V1_PROFILE;
  return null;
}

function isSpiritforgedExpandedBreakBoard(boardRows = []) {
  return Boolean(spiritforgedExpandedProfileForBoard(boardRows));
}

function displayCardNumber(value) {
  const key = collectorNumberKey(value);
  return key ? `SFD-${key}/221` : '';
}

function spotLabel(spot = {}) {
  if (spot.kind === 'champion-sig') return `💎 ${spot.champion} · SIG ${displayCardNumber(spot.anchorNumber)}`;
  if (spot.kind === 'champion-on') return `🔥 ${spot.champion} · ON ${displayCardNumber(spot.anchorNumber)}`;
  if (spot.kind === 'champion-family') return `🔥 ${spot.champion} · ON ${displayCardNumber(spot.anchorNumber)}`;
  if (spot.kind === 'irelia-alt-epic') return '⭐ Irelia, Fervent · ALT SFD-057A/221 + EPIC SFD-057/221';
  if (spot.kind === 'champion') {
    const signatureLed = spot.position <= 24 && spot.position % 2 === 1;
    const symbol = signatureLed ? '💎' : '🔥';
    return `${symbol} ${spot.champion} ${symbol} ${signatureLed ? 'SIG' : 'ON'}`;
  }
  if (spot.kind === 'fizz-premonition' || spot.kind === 'named-bundle' || spot.kind === 'named-single') return spot.label;
  if (spot.kind === 'seal') return `🔥 ${spot.seal} · ON ${displayCardNumber(spot.anchorNumber)}`;
  if (spot.kind === 'all-runes') return '💣 ALL RUNES · AA';
  if (spot.kind === 'domain-pool') return `${spot.domain} · Rare+ Gear / Spell / Unit`;
  if (spot.kind === 'rune-color') return `💣 ${spot.rune} 💣 AA + Rare/Epic ${spot.domain} Cards`;
  return spot.label || spot.anchor || 'Spiritforged Spot';
}
function decorateSpiritforgedExpandedBreakBoard(boardRows = []) {
  const rows = Array.isArray(boardRows) ? boardRows : [];
  const profile = spiritforgedExpandedProfileForBoard(rows);
  if (!profile) return rows;
  return rows.map(row => {
    const spot = spiritforgedExpandedSpotForAnchor(row, row.position, profile);
    return spot ? {
      ...row,
      break_spot_label: spotLabel(spot),
      break_spot_key: spot.key,
      spiritforged_expanded_break: true
    } : row;
  });
}

function isIreliaFerventCard(card = {}) {
  return fullName(card) === 'irelia fervent';
}

function belongsToFeaturedChampion(card = {}, profile = SPIRITFORGED_EXPANDED_PROFILE) {
  return profileSpots(profile)
    .filter(spot => ['champion', 'champion-sig', 'champion-on', 'champion-family', 'irelia-alt-epic'].includes(spot.kind))
    .some(spot => {
      const champion = String(spot.familyMode || '').startsWith('irelia') ? 'Irelia' : spot.champion;
      return cardBelongsToChampion(card, champion, 'SFD');
    });
}
function namedMembers(spot = {}) {
  if (Array.isArray(spot.members) && spot.members.length) return spot.members;
  if (spot.kind === 'fizz-premonition') return ['Fizz', 'Premonition'];
  if (spot.kind === 'named-single') return [spot.label];
  return [];
}

function cardMatchesNamedMember(card = {}, member = '') {
  const wanted = norm(member);
  return wanted === 'fizz' ? prefixName(card) === 'fizz' : fullName(card) === wanted;
}

function isReservedSpecialCard(card = {}, profile = SPIRITFORGED_EXPANDED_PROFILE) {
  return profileSpots(profile).some(spot =>
    ['fizz-premonition', 'named-bundle', 'named-single'].includes(spot.kind)
      && namedMembers(spot).some(member => cardMatchesNamedMember(card, member))
  );
}

function runeMappingForSpot(spot = {}) {
  return {
    kind: 'color',
    color: spot.color,
    domain: spot.domain,
    seal: '',
    rune: spot.rune
  };
}

function primaryDomainForCard(card = {}, profile = SPIRITFORGED_EXPANDED_PROFILE) {
  const domains = spiritforgedCardDomains(card);
  if (domains.length) return domains[0];
  const fallback = profileSpots(profile)
    .filter(spot => spot.kind === 'rune-color' || spot.kind === 'domain-pool')
    .find(spot => isSpiritforgedRareColorCard(card, runeMappingForSpot(spot), 'SFD'));
  return norm(fallback?.domain);
}

function isRuneColorPoolCard(card = {}, spot = {}, profile = SPIRITFORGED_EXPANDED_PROFILE) {
  if (setCode(card) !== 'SFD' || !['rune-color', 'domain-pool'].includes(spot.kind)) return false;
  if (spot.kind === 'rune-color' && fullName(card) === norm(spot.rune)) return isShowcaseRune(card);
  if (profileSpots(profile).filter(candidate => candidate.kind === 'seal').some(sealSpotDefinition => fullName(card) === norm(sealSpotDefinition.seal))) return false;
  if (belongsToFeaturedChampion(card, profile)) return false;
  if (norm(card.card_type || card.type).includes('champion')) return false;
  if (!isSpiritforgedRareColorCard(card, runeMappingForSpot(spot), 'SFD')) return false;
  return primaryDomainForCard(card, profile) === norm(spot.domain);
}

function isSignatureNumber(card = {}, spot = {}) {
  return collectorNumberKey(card.card_number || card.number) === collectorNumberKey(spot.anchorNumber);
}

function isOvernumberedExact(card = {}, spot = {}) {
  return collectorNumberKey(card.card_number || card.number) === collectorNumberKey(spot.anchorNumber);
}

function isIreliaFerventAltEpic(card = {}, spot = {}) {
  return isIreliaFerventCard(card) && (spot.cardNumbers || []).some(number => collectorNumberKey(card.card_number || card.number) === collectorNumberKey(number));
}
function cardBelongsToSpiritforgedExpandedSpot(card = {}, spot = {}, profile = SPIRITFORGED_EXPANDED_PROFILE) {
  if (setCode(card) !== 'SFD' || !spot) return false;
  if (spot.kind === 'champion-sig') {
    if (spot.familyMode === 'irelia-fervent-signature') return isIreliaFerventCard(card) && isSignatureNumber(card, spot);
    return cardBelongsToChampion(card, spot.champion, 'SFD') && isSignatureNumber(card, spot);
  }
  if (spot.kind === 'champion-on') {
    if (spot.familyMode === 'irelia-fervent-overnumbered') return isIreliaFerventCard(card) && isOvernumberedExact(card, spot);
    if (!cardBelongsToChampion(card, spot.champion, 'SFD')) return false;
    const signatureNumber = `${collectorNumberKey(spot.anchorNumber)}*`;
    return collectorNumberKey(card.card_number || card.number) !== signatureNumber;
  }
  if (spot.kind === 'champion-family') {
    if (spot.familyMode === 'irelia-remainder') return cardBelongsToChampion(card, 'Irelia', 'SFD') && !isIreliaFerventCard(card);
    return cardBelongsToChampion(card, spot.champion, 'SFD');
  }
  if (spot.kind === 'irelia-alt-epic') return isIreliaFerventAltEpic(card, spot);
  if (spot.kind === 'champion') {
    if (isReservedSpecialCard(card, profile)) return false;
    if (spot.familyMode === 'irelia-fervent') return isIreliaFerventCard(card);
    if (spot.familyMode === 'irelia-remainder') return cardBelongsToChampion(card, 'Irelia', 'SFD') && !isIreliaFerventCard(card);
    return cardBelongsToChampion(card, spot.champion, 'SFD');
  }
  if (spot.kind === 'fizz-premonition') return prefixName(card) === 'fizz' || fullName(card) === 'premonition';
  if (spot.kind === 'named-bundle') return namedMembers(spot).some(member => cardMatchesNamedMember(card, member));
  if (spot.kind === 'named-single') return fullName(card) === norm(spot.label);
  if (spot.kind === 'seal') return fullName(card) === norm(spot.seal);
  if (spot.kind === 'all-runes') return isShowcaseRune(card);
  if (spot.kind === 'domain-pool' || spot.kind === 'rune-color') return isRuneColorPoolCard(card, spot, profile);
  return false;
}
function uniqueCards(cards = []) {
  const seen = new Set();
  return cards.filter(card => {
    const key = Number(card.id) || [setCode(card), collectorNumberKey(card.card_number), fullName(card), norm(card.collector_treatment || card.variant)].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cardsForSpiritforgedExpandedSpot(catalog = [], spot = {}, profile = SPIRITFORGED_EXPANDED_PROFILE) {
  return uniqueCards((Array.isArray(catalog) ? catalog : [])
    .filter(card => cardBelongsToSpiritforgedExpandedSpot(card, spot, profile)))
    .sort(sortChampionFamily);
}

function groupCardsByName(family = [], name = '') {
  const wanted = norm(name);
  return family.filter(card => fullName(card) === wanted || prefixName(card) === wanted);
}

function bundleGroupsForSpiritforgedExpandedSpot(family = [], spot = {}) {
  if (['champion-sig', 'champion-on', 'champion-family'].includes(spot.kind)) {
    const caption = spot.kind === 'champion-sig'
      ? 'Exact Signature printing only'
      : spot.kind === 'champion-on'
        ? 'Overnumbered lane · includes the remaining matching champion family except the separate Signature printing'
        : 'Champion family lane · all matching printings pulled';
    return [{ key: 'champion', label: spot.champion, caption, role: spot.kind === 'champion-sig' ? 'signature' : 'champion', cards: family }];
  }
  if (spot.kind === 'irelia-alt-epic') return [{ key: 'irelia-alt-epic', label: 'Irelia, Fervent ALT + EPIC', caption: 'SFD-057A/221 + SFD-057/221 only', role: 'mapped', cards: family }];
  if (spot.kind === 'champion') {
    const caption = spot.familyMode === 'irelia-fervent' ? 'Every Irelia, Fervent printing only' : spot.familyMode === 'irelia-remainder' ? 'Blade Dancer plus the remaining Irelia family · Fervent excluded' : 'Complete champion family · every matching printing pulled';
    return [{ key: 'champion', label: spot.champion, caption, role: 'champion', cards: family }];
  }
  if (spot.kind === 'fizz-premonition') return [
    { key: 'fizz', label: 'Fizz', caption: 'Every Fizz printing pulled', role: 'champion', cards: family.filter(card => prefixName(card) === 'fizz') },
    { key: 'premonition', label: 'Premonition', caption: 'Every matching printing pulled', role: 'mapped', cards: groupCardsByName(family, 'Premonition') }
  ];
  if (spot.kind === 'named-bundle') return namedMembers(spot).map(member => ({ key: norm(member).replace(/\s+/g, '-'), label: member, caption: member === 'Fizz' ? 'Every Fizz printing pulled' : 'Every matching printing pulled', role: member === 'Fizz' ? 'champion' : 'mapped', cards: family.filter(card => cardMatchesNamedMember(card, member)) }));
  if (spot.kind === 'named-single') return [{ key: 'named', label: spot.label, caption: 'Every matching printing pulled', role: 'mapped', cards: family }];
  if (spot.kind === 'seal') return [{ key: 'seal', label: spot.seal, caption: `${spot.color} / ${spot.domain} Seal · standalone spot`, role: 'seal', cards: family }];
  if (spot.kind === 'all-runes') return [{ key: 'runes', label: 'All Showcase Runes', caption: 'All six Spiritforged Showcase / Alternate-Art Runes', role: 'rune', cards: family }];
  if (spot.kind === 'domain-pool') return [{ key: 'rare-epic-color', label: `${spot.domain} Rare+ Gear / Spell / Unit`, caption: 'Rare/Epic non-champion hits in this domain · Common/Uncommon excluded', role: 'rare-color', cards: family }];
  if (spot.kind === 'rune-color') return [
    { key: 'rune', label: `${spot.rune} Showcase`, caption: `${spot.color} / ${spot.domain} Alternate-Art Rune`, role: 'rune', cards: family.filter(card => fullName(card) === norm(spot.rune)) },
    { key: 'rare-epic-color', label: `Rare + Epic ${spot.domain} Cards`, caption: 'Unreserved Rare/Epic hits · Seals and named solo cards excluded', role: 'rare-color', cards: family.filter(card => fullName(card) !== norm(spot.rune)) }
  ];
  return [];
}
function heroCardsForSpiritforgedExpandedSpot(family = [], spot = {}, boardAnchor = {}) {
  const exactAnchor = family.find(card => matchesSpiritforgedExpandedAnchor(card, spot)) || boardAnchor;
  if (spot.kind === 'fizz-premonition') {
    const premonition = family.find(card => fullName(card) === 'premonition');
    return uniqueCards([exactAnchor, premonition].filter(Boolean));
  }
  if (spot.kind === 'named-bundle') {
    const memberHeroes = namedMembers(spot).map(member => family.find(card => cardMatchesNamedMember(card, member)));
    return uniqueCards([exactAnchor, ...memberHeroes].filter(Boolean));
  }
  if (spot.kind === 'rune-color') {
    const colorHit = family.find(card => fullName(card) !== norm(spot.rune));
    return uniqueCards([exactAnchor, colorHit].filter(Boolean));
  }
  return uniqueCards([exactAnchor].filter(Boolean));
}

function spotInstruction(spot = {}) {
  if (spot.kind === 'champion-sig') return `Includes the exact ${spot.champion} Signature printing shown; the ON/champion family is sold separately.`;
  if (spot.kind === 'champion-on') return `Includes the ${spot.champion} Overnumbered printing plus the remaining matching champion family; Signature is separate.`;
  if (spot.kind === 'champion-family') return `Includes the mapped ${spot.champion} family shown below.`;
  if (spot.kind === 'irelia-alt-epic') return 'Includes Irelia, Fervent Alternate Art SFD-057A/221 and Epic SFD-057/221 only.';
  if (spot.kind === 'champion') return `Includes the complete mapped ${spot.champion} family shown below.`;
  if (spot.kind === 'fizz-premonition') return 'Includes every Fizz and Premonition printing pulled.';
  if (spot.kind === 'named-bundle') return `Includes every ${namedMembers(spot).join(' and ')} printing pulled.`;
  if (spot.kind === 'named-single') return `Includes every ${spot.label} printing pulled.`;
  if (spot.kind === 'seal') return `Includes ${spot.seal} only; Runes and color-pool cards are separate.`;
  if (spot.kind === 'all-runes') return 'Includes all six Spiritforged Showcase / Alternate-Art Runes.';
  if (spot.kind === 'domain-pool') return `Includes Rare/Epic non-champion Gear, Spell, and Unit cards in ${spot.domain}.`;
  return `Includes the ${spot.rune} Showcase plus unreserved Rare/Epic ${spot.domain} cards.`;
}

function spotRewardTitle(spot = {}) {
  if (spot.kind === 'champion-sig') return 'SIGNATURE SPOT';
  if (spot.kind === 'champion-on') return 'OVERNUMBERED SPOT';
  if (spot.kind === 'champion-family') return 'CHAMPION SPOT';
  if (spot.kind === 'irelia-alt-epic') return 'IRELIA ALT + EPIC SPOT';
  if (spot.kind === 'champion') return 'SEPARATE CHAMPION SPOT';
  if (spot.kind === 'fizz-premonition') return 'FIZZ + PREMONITION SPOT';
  if (spot.kind === 'named-bundle') return `${namedMembers(spot).join(' + ').toUpperCase()} SPOT`;
  if (spot.kind === 'named-single') return 'STANDALONE NAMED SPOT';
  if (spot.kind === 'seal') return 'STANDALONE SEAL SPOT';
  if (spot.kind === 'all-runes') return 'ALL RUNES SPOT';
  if (spot.kind === 'domain-pool') return `${spot.domain.toUpperCase()} RARE+ COLOR SPOT`;
  return 'SHOWCASE RUNE + DOMAIN SPOT';
}

function spotRewardCaption(spot = {}) {
  if (spot.kind === 'champion-sig') return 'EXACT SIGNATURE CHASE PRINTING';
  if (spot.kind === 'champion-on') return 'ON + REMAINING CHAMPION FAMILY · SIGNATURE IS SEPARATE';
  if (spot.kind === 'champion-family') return 'ALL MATCHING CHAMPION CARDS PULLED ARE YOURS';
  if (spot.kind === 'irelia-alt-epic') return 'ALT + EPIC ONLY · SIG AND ON ARE SEPARATE';
  if (spot.kind === 'champion') return String(spot.familyMode || '').startsWith('irelia') ? 'IRELIA OWNERSHIP IS SPLIT ONCE WITH NO OVERLAP' : 'ALL MATCHING CHAMPION CARDS PULLED ARE YOURS';
  if (spot.kind === 'fizz-premonition') return 'BOTH NAMED FAMILIES · ONE PURCHASED POSITION';
  if (spot.kind === 'named-bundle') return 'BOTH NAMED FAMILIES · ONE PURCHASED POSITION';
  if (spot.kind === 'named-single') return 'REMOVED FROM EVERY RUNE / DOMAIN POOL';
  if (spot.kind === 'seal') return 'SEAL ONLY · RUNES AND COLOR POOLS ARE SEPARATE';
  if (spot.kind === 'all-runes') return 'ALL SIX SHOWCASE RUNES · ONE PURCHASED POSITION';
  if (spot.kind === 'domain-pool') return 'RARE/EPIC NON-CHAMPION GEAR · SPELL · UNIT ONLY';
  return 'SEAL EXCLUDED · UNRESERVED RARE / EPIC DOMAIN HITS INCLUDED';
}
function buildSpiritforgedExpandedBreakSpot(catalog = [], boardAnchor = {}, profile = SPIRITFORGED_EXPANDED_PROFILE) {
  const spot = spiritforgedExpandedSpotForAnchor(boardAnchor, boardAnchor.position, profile);
  if (!spot) return null;
  const family = cardsForSpiritforgedExpandedSpot(catalog, spot, profile);
  return {
    profileId: profile?.id || SPIRITFORGED_EXPANDED_PROFILE_ID,
    position: spot.position,
    key: spot.key,
    kind: spot.kind,
    color: spot.color,
    domain: spot.domain,
    anchor: spot.anchor,
    champion: ['champion', 'champion-sig', 'champion-on', 'champion-family', 'irelia-alt-epic'].includes(spot.kind) ? spot.champion : '',
    champions: ['champion', 'champion-sig', 'champion-on', 'champion-family', 'irelia-alt-epic'].includes(spot.kind)
      ? [spot.champion]
      : namedMembers(spot).filter(member => norm(member) === 'fizz'),
    rune: spot.rune,
    seal: spot.seal,
    displayLabel: spotLabel(spot),
    listingNote: spotLabel(spot),
    instruction: spotInstruction(spot),
    rewardTitle: spotRewardTitle(spot),
    rewardCaption: spotRewardCaption(spot),
    family,
    heroCards: heroCardsForSpiritforgedExpandedSpot(family, spot, boardAnchor),
    bundleGroups: bundleGroupsForSpiritforgedExpandedSpot(family, spot)
  };
}

function chooseBoardAnchor(catalog = [], spot = {}) {
  return [...(Array.isArray(catalog) ? catalog : [])]
    .filter(card => matchesSpiritforgedExpandedAnchor(card, spot))
    .sort((left, right) =>
      Number(!(/\*/.test(String(left.card_number || '')) && spot.kind === 'champion'))
        - Number(!(/\*/.test(String(right.card_number || '')) && spot.kind === 'champion'))
        || Number(!String(left.image_path || left.image_url || '').trim()) - Number(!String(right.image_path || right.image_url || '').trim())
        || Number(left.id || 0) - Number(right.id || 0)
    )[0] || null;
}

function ensureSpiritforgedExpandedBoardSix(database) {
  const existingMarker = database.prepare('SELECT value FROM app_metadata WHERE key = ?')
    .get(SPIRITFORGED_EXPANDED_MIGRATION_KEY)?.value;
  if (existingMarker) return { seeded: false, skipped: true, reason: 'already-installed' };

  const catalog = database.prepare(`
    SELECT * FROM cards
    WHERE UPPER(TRIM(COALESCE(game_code, ''))) = 'RIFTBOUND'
      AND UPPER(TRIM(COALESCE(set_code, ''))) = 'SFD'
  `).all();
  const anchors = SPIRITFORGED_EXPANDED_SPOTS.map(spot => chooseBoardAnchor(catalog, spot));
  const missing = SPIRITFORGED_EXPANDED_SPOTS
    .filter((_spot, index) => !anchors[index])
    .map(spot => ({ position: spot.position, anchor: spot.anchor, cardNumber: spot.anchorNumber }));
  if (missing.length) return { seeded: false, skipped: true, reason: 'missing-catalog-anchors', missing };
  if (new Set(anchors.map(card => Number(card.id))).size !== anchors.length) {
    return { seeded: false, skipped: true, reason: 'duplicate-catalog-anchors' };
  }

  const savedAt = new Date().toISOString();
  const workingSlot = Number(database.prepare("SELECT value FROM app_metadata WHERE key = 'break-board-working-preset-slot-v1'").get()?.value || 0);
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare(`
      INSERT INTO break_board_presets (slot, name, saved_at, mapping_mode) VALUES (?, ?, ?, 'MAPPED')
      ON CONFLICT(slot) DO UPDATE SET name = excluded.name, saved_at = excluded.saved_at,
        mapping_mode = excluded.mapping_mode
    `).run(SPIRITFORGED_EXPANDED_BOARD_SLOT, SPIRITFORGED_EXPANDED_BOARD_NAME, savedAt);
    database.prepare('DELETE FROM break_board_preset_cards WHERE slot = ?').run(SPIRITFORGED_EXPANDED_BOARD_SLOT);
    const insertPreset = database.prepare(`
      INSERT INTO break_board_preset_cards (slot, position, card_id, added_at)
      VALUES (?, ?, ?, ?)
    `);
    anchors.forEach((card, index) => insertPreset.run(SPIRITFORGED_EXPANDED_BOARD_SLOT, index + 1, card.id, savedAt));

    // Board 6's structure changes from the older 38/39-spot custom map to 50 spots.
    // Clear only Board 6's saved custom rows so stale ownership cannot override
    // the new v4 profile. Existing live/pending round snapshots are untouched.
    const hasCustomMappingTable = Boolean(database.prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'break_board_custom_spots'"
    ).get());
    if (hasCustomMappingTable) {
      database.prepare('DELETE FROM break_board_custom_spots WHERE slot = ?').run(SPIRITFORGED_EXPANDED_BOARD_SLOT);
    }

    // Refresh only the editable draft if the user had already selected the new
    // slot. The current live ledger, buyers, pulls, and histories stay intact.
    if (workingSlot === SPIRITFORGED_EXPANDED_BOARD_SLOT) {
      database.prepare('DELETE FROM break_board_cards').run();
      const insertWorking = database.prepare('INSERT INTO break_board_cards (card_id, position, added_at) VALUES (?, ?, ?)');
      anchors.forEach((card, index) => insertWorking.run(card.id, index + 1, savedAt));
      database.prepare(`
        INSERT INTO app_metadata (key, value) VALUES ('break-board-game-v1', 'RIFTBOUND')
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run();
      database.prepare(`
        INSERT INTO app_metadata (key, value) VALUES ('break-board-working-mapping-mode-v1', 'MAPPED')
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run();
    }

    database.prepare(`
      INSERT INTO app_metadata (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(SPIRITFORGED_EXPANDED_MIGRATION_KEY, savedAt);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  return {
    seeded: true,
    slot: SPIRITFORGED_EXPANDED_BOARD_SLOT,
    name: SPIRITFORGED_EXPANDED_BOARD_NAME,
    savedCards: anchors.length,
    loadedWorkingBoard: workingSlot === SPIRITFORGED_EXPANDED_BOARD_SLOT,
    mappingMode: 'MAPPED'
  };
}

module.exports = {
  SPIRITFORGED_EXPANDED_BOARD_NAME,
  SPIRITFORGED_EXPANDED_BOARD_SLOT,
  SPIRITFORGED_EXPANDED_LEGACY_MIGRATION_KEY,
  SPIRITFORGED_EXPANDED_LEGACY_PROFILE,
  SPIRITFORGED_EXPANDED_LEGACY_PROFILE_ID,
  SPIRITFORGED_EXPANDED_LEGACY_SPOTS,
  SPIRITFORGED_EXPANDED_LEGACY_V1_PROFILE,
  SPIRITFORGED_EXPANDED_LEGACY_V1_PROFILE_ID,
  SPIRITFORGED_EXPANDED_LEGACY_V1_SPOTS,
  SPIRITFORGED_EXPANDED_MIGRATION_KEY,
  SPIRITFORGED_EXPANDED_PROFILE,
  SPIRITFORGED_EXPANDED_PROFILE_ID,
  SPIRITFORGED_EXPANDED_SPOTS,
  buildSpiritforgedExpandedBreakSpot,
  bundleGroupsForSpiritforgedExpandedSpot,
  cardBelongsToSpiritforgedExpandedSpot,
  cardsForSpiritforgedExpandedSpot,
  chooseBoardAnchor,
  collectorNumberKey,
  decorateSpiritforgedExpandedBreakBoard,
  ensureSpiritforgedExpandedBoardSix,
  heroCardsForSpiritforgedExpandedSpot,
  isRuneColorPoolCard,
  isSpiritforgedExpandedBreakBoard,
  matchesSpiritforgedExpandedAnchor,
  spotLabel,
  spiritforgedExpandedProfileForBoard,
  spiritforgedExpandedSpotForAnchor
};
