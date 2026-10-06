'use strict';

const {
  sortChampionFamily
} = require('./RiftboundChampionAudit');

const UNLEASHED_EXPANDED_PROFILE_ID = 'UNL_EXPANDED_39_FOUR_CARD_CHAMPION_LANES_V2';
const UNLEASHED_EXPANDED_BOARD_SLOT = 7;
const UNLEASHED_EXPANDED_BOARD_NAME = 'Unleashed · 39 Spots · Split Champions, Poros & Chases';
const UNLEASHED_EXPANDED_MIGRATION_KEY = 'unleashed-board-7-39-four-card-champion-lanes-v2';
const UNLEASHED_EXPANDED_VALUE_SNAPSHOT = '2026-09-12';
const UNLEASHED_EXPANDED_VALUE_SOURCE = 'https://riftcompare.com/sets/unleashed';
const UNLEASHED_EXPANDED_LISTING_DESCRIPTION = 'You are bidding on the exact Unleashed Board 7 spot shown. Each champion has two separate four-card positions: SIG receives that champion\'s displayed Signature, assigned Alternate Art, Epic, and Rare; ON receives the displayed Overnumbered, assigned Alternate Art, Epic, and Rare. No card belongs to both positions. Bundle spots receive only their displayed or mapped cards. If no matching card is pulled, the buyer receives a random Common or Uncommon fallback from the same box. Every purchase receives at least one card. No specific rarity or value is guaranteed.';

const BOOSTER_AA_RUNE_NUMBERS = Object.freeze([
  'R01A', 'R02A', 'R03A', 'R04A', 'R05A', 'R06A'
]);
const BOOSTER_AA_RUNE_NUMBER_SET = new Set(BOOSTER_AA_RUNE_NUMBERS);

// Each eight-card champion family is divided into two exact four-card lanes.
// By default the Signature lane receives the higher-value AA, Epic and Rare
// from the fixed market snapshot above. Explicit per-lane overrides preserve
// requested combinations such as Rengar SIG + Thrill of the Hunt. No
// collector number appears in both lanes.
const CHAMPION_SPLITS = Object.freeze([
  Object.freeze({ champion: 'Jhin', headline: 'Jhin, Virtuoso', chase: '226', higherAa: '022A', higherAaName: 'Jhin, Murderous Artist', higherEpic: '089', higherRare: '022', otherAa: '089A', otherAaName: 'Jhin, Meticulous Killer', otherEpic: '182', otherRare: '181' }),
  Object.freeze({ champion: 'Rengar', headline: 'Rengar, Pridestalker', chase: '227', higherAa: '120A', higherAaName: 'Rengar, Trophy Hunter', higherEpic: '120', higherRare: '024', otherAa: '024A', otherAaName: 'Rengar, Unseen', otherEpic: '184', otherRare: '183', signatureEpic: '184', overnumberedEpic: '120' }),
  Object.freeze({ champion: 'Pyke', headline: 'Pyke, Bloodharbor Ripper', chase: '228', higherAa: '028A', higherAaName: 'Pyke, Dockside Butcher', higherEpic: '028', higherRare: '145', otherAa: '145A', otherAaName: 'Pyke, Returned', otherEpic: '186', otherRare: '185' }),
  Object.freeze({ champion: 'Vi', headline: 'Vi, Piltover Enforcer', chase: '229', higherAa: '176A', higherAaName: 'Vi, Peacekeeper', higherEpic: '188', higherRare: '176', otherAa: '030A', otherAaName: 'Vi, Hotheaded', otherEpic: '030', otherRare: '187' }),
  Object.freeze({ champion: 'Lillia', headline: 'Lillia, Bashful Bloom', chase: '230', higherAa: '082A', higherAaName: 'Lillia, Fae Fawn', higherEpic: '190', higherRare: '082', otherAa: '058A', otherAaName: 'Lillia, Protector of Dreams', otherEpic: '058', otherRare: '189' }),
  Object.freeze({ champion: 'Master Yi', headline: 'Master Yi, Wuju Master', chase: '231', higherAa: '059A', higherAaName: 'Master Yi, Unstoppable', higherEpic: '192', higherRare: '191', otherAa: '113A', otherAaName: 'Master Yi, Tempered', otherEpic: '059', otherRare: '113' }),
  Object.freeze({ champion: 'Vex', headline: 'Vex, Gloomist', chase: '232', higherAa: '150A', higherAaName: 'Vex, Apathetic', higherEpic: '150', higherRare: '055', otherAa: '055A', otherAaName: 'Vex, Mocking', otherEpic: '194', otherRare: '193' }),
  Object.freeze({ champion: 'Ivern', headline: 'Ivern, Green Father', chase: '233', higherAa: '177A', higherAaName: 'Ivern, Friend to All', higherEpic: '196', higherRare: '051', otherAa: '051A', otherAaName: 'Ivern, Nurturer', otherEpic: '177', otherRare: '195' }),
  Object.freeze({ champion: 'Diana', headline: 'Diana, Scorn of the Moon', chase: '234', higherAa: '079A', higherAaName: 'Diana, Lunari', higherEpic: '198', higherRare: '079', otherAa: '149A', otherAaName: 'Diana, No Longer Human', otherEpic: '149', otherRare: '197' }),
  Object.freeze({ champion: 'LeBlanc', headline: 'LeBlanc, Deceiver', chase: '235', higherAa: '090A', higherAaName: 'LeBlanc, Everywhere at Once', higherEpic: '200', higherRare: '172', otherAa: '172A', otherAaName: 'LeBlanc, Fragmented', otherEpic: '090', otherRare: '199' }),
  Object.freeze({ champion: "Kha'Zix", headline: "Kha'Zix, Voidreaver", chase: '236', higherAa: '143A', higherAaName: "Kha'Zix, Mutating Horror", higherEpic: '202', higherRare: '143', otherAa: '119A', otherAaName: "Kha'Zix, Evolving Hunter", otherEpic: '119', otherRare: '201' }),
  Object.freeze({ champion: 'Poppy', headline: 'Poppy, Keeper of the Hammer', chase: '237', higherAa: '178A', higherAaName: 'Poppy, Defender of the Meek', higherEpic: '178', higherRare: '116', otherAa: '116A', otherAaName: 'Poppy, Paragon', otherEpic: '204', otherRare: '203' })
]);

function championSplitSpot(position, split, mode) {
  const signature = mode === 'signature';
  const pairedAaNumber = signature ? split.higherAa : split.otherAa;
  const pairedAaName = signature ? split.higherAaName : split.otherAaName;
  const epicNumber = signature
    ? (split.signatureEpic || split.higherEpic)
    : (split.overnumberedEpic || split.otherEpic);
  const rareNumber = signature ? split.higherRare : split.otherRare;
  const anchorNumber = `${split.chase}${signature ? '*' : ''}`;
  return Object.freeze({
    position,
    key: `CHAMPION_${String(position).padStart(2, '0')}`,
    kind: 'champion-split',
    mode,
    champion: split.champion,
    anchor: split.headline,
    anchorNumber,
    pairedAaName,
    pairedAaNumber,
    epicNumber,
    rareNumber,
    valueTier: signature ? 'signature' : 'overnumbered',
    ownedNumbers: Object.freeze([anchorNumber, pairedAaNumber, epicNumber, rareNumber]),
    allKnownNumbers: Object.freeze([
      `${split.chase}*`, split.chase,
      split.higherAa, split.otherAa,
      split.higherEpic, split.otherEpic,
      split.higherRare, split.otherRare
    ]),
    color: '',
    domain: '',
    poro: '',
    members: Object.freeze([]),
    poolNumbers: Object.freeze([])
  });
}

function bundleSpot(position, options = {}) {
  return Object.freeze({
    position,
    key: options.key || `BUNDLE_${String(position).padStart(2, '0')}`,
    kind: options.kind || 'bundle',
    mode: '',
    champion: '',
    anchor: options.anchor,
    anchorNumber: options.anchorNumber,
    label: options.label,
    color: options.color || '',
    domain: options.domain || '',
    poro: options.poro || '',
    members: Object.freeze([...(options.members || [])]),
    poolNumbers: Object.freeze([...(options.poolNumbers || [])]),
    heroNumber: options.heroNumber || '',
    heroMember: options.heroMember || '',
    rewardTitle: options.rewardTitle || 'MAPPED UNLEASHED SPOT',
    rewardCaption: options.rewardCaption || 'EVERY DISPLAYED PRINTING PULLED IS YOURS'
  });
}

const CHAMPION_SPOTS = CHAMPION_SPLITS.flatMap((split, index) => [
  championSplitSpot(index * 2 + 1, split, 'signature'),
  championSplitSpot(index * 2 + 2, split, 'overnumbered')
]);

// Rare pools are intentionally explicit. This makes the advertised half-splits
// stable even when card prices move or a future catalog refresh changes order.
const NON_CHAMPION_SPOTS = Object.freeze([
  bundleSpot(25, {
    key: 'PORO_POUTY_FURY_A', kind: 'poro-bundle', label: 'Pouty Poro + Fury Rares A',
    anchor: 'Pouty Poro', anchorNumber: '220', poro: 'Pouty Poro', color: 'Red', domain: 'Fury',
    members: ['Pouty Poro'], poolNumbers: ['019', '021', '025'],
    rewardTitle: 'PORO + ASSIGNED FURY RARES', rewardCaption: 'POUTY PORO · BLIGHTED BATTLEAXE · GRIM APOTHECARY · UNDYING LEGION'
  }),
  bundleSpot(26, {
    key: 'CHASE_FAEFOLK_FURY_B', kind: 'named-bundle', label: 'Irresistible Faefolk + Fury Rares B',
    anchor: 'Irresistible Faefolk', anchorNumber: '112', color: 'Red', domain: 'Fury',
    members: ['Irresistible Faefolk', 'Inviolus Vox', 'Red Brambleback'], poolNumbers: ['020', '023', '026'], heroNumber: '029A',
    rewardTitle: 'FAEFOLK + RED EPICS + FURY RARES', rewardCaption: 'INVIOLUS VOX · RED BRAMBLEBACK · DANCING GRENADE · KATARINA · XERATH'
  }),
  bundleSpot(27, {
    key: 'PORO_LONELY_CALM_A', kind: 'poro-bundle', label: 'Lonely Poro + Calm Rares A',
    anchor: 'Lonely Poro', anchorNumber: '221', poro: 'Lonely Poro', color: 'Green', domain: 'Calm',
    members: ['Lonely Poro'], poolNumbers: ['049', '052', '054'],
    rewardTitle: 'PORO + ASSIGNED CALM RARES', rewardCaption: 'LONELY PORO · HONEYFRUIT · NAMI · TRICKSY TENTACLES'
  }),
  bundleSpot(28, {
    key: 'CHASE_VILEMAW_CALM_B', kind: 'named-bundle', label: 'Vilemaw + Alpha Wildclaw + Calm Rares B',
    anchor: 'Vilemaw', anchorNumber: '060A', color: 'Green', domain: 'Calm',
    members: ['Vilemaw', 'Alpha Wildclaw'], poolNumbers: ['050', '053', '056'], heroNumber: '060',
    rewardTitle: 'VILEMAW AA + EPIC BUNDLE', rewardCaption: 'ALPHA WILDCLAW · IASCYLLA · SCUTTLE CRAB · YUUMI'
  }),
  bundleSpot(29, {
    key: 'PORO_PLUNDERING_BODY_A', kind: 'poro-bundle', label: 'Plundering Poro + Body Rares A',
    anchor: 'Plundering Poro', anchorNumber: '222', poro: 'Plundering Poro', color: 'Orange', domain: 'Body',
    members: ['Plundering Poro'], poolNumbers: ['109', '111', '115'],
    rewardTitle: 'PORO + ASSIGNED BODY RARES', rewardCaption: 'PLUNDERING PORO · BLOOD ROSE · DETERMINED SENTRY · NILAH'
  }),
  bundleSpot(30, {
    key: 'CHASE_ELDER_DRAGON_BODY_B', kind: 'named-bundle', label: 'Elder Dragon + Arachnoid Horror + Body Rares B',
    anchor: 'Elder Dragon', anchorNumber: '118A', color: 'Orange', domain: 'Body',
    members: ['Elder Dragon', 'Arachnoid Horror'], poolNumbers: ['110', '114'], heroNumber: '118',
    rewardTitle: 'ELDER DRAGON AA + EPIC BUNDLE', rewardCaption: 'ARACHNOID HORROR · CLASH OF GIANTS · NIDALEE'
  }),
  bundleSpot(31, {
    key: 'PORO_VETERAN_MIND_A', kind: 'poro-bundle', label: 'Veteran Poro + Mind Rares A',
    anchor: 'Veteran Poro', anchorNumber: '223', poro: 'Veteran Poro', color: 'Blue', domain: 'Mind',
    members: ['Veteran Poro'], poolNumbers: ['081', '083'],
    rewardTitle: 'PORO + TWO MIND RARES', rewardCaption: 'VETERAN PORO · KEEPER OF MASKS · SMOKE AND MIRRORS'
  }),
  bundleSpot(32, {
    key: 'HWEI_MIND_B', kind: 'named-bundle', label: 'Hwei + Mind Rares B',
    anchor: 'Hwei, Brooding Painter', anchorNumber: '080', color: 'Blue', domain: 'Mind',
    members: ['Hwei'], poolNumbers: ['084', '086'],
    rewardTitle: 'HWEI + ASSIGNED MIND RARES', rewardCaption: 'HWEI · SPRITE QUEEN · ZILEAN'
  }),
  bundleSpot(33, {
    key: 'CHASE_BLUE_SENTINEL_MIND_C', kind: 'named-bundle', label: 'Blue Sentinel + Gutter Palace + Mind Rares C',
    anchor: 'Blue Sentinel', anchorNumber: '087A', color: 'Blue', domain: 'Mind',
    members: ['Blue Sentinel', 'Gutter Palace'], poolNumbers: ['085'], heroNumber: '087',
    rewardTitle: 'BLUE SENTINEL AA + EPIC BUNDLE', rewardCaption: 'GUTTER PALACE · SUMPWORKS MAP'
  }),
  bundleSpot(34, {
    key: 'PORO_MYSTIC_CHAOS_RARES', kind: 'poro-bundle', label: 'Mystic Poro + Chaos Rares',
    anchor: 'Mystic Poro', anchorNumber: '224', poro: 'Mystic Poro', color: 'Purple', domain: 'Chaos',
    members: ['Mystic Poro'], poolNumbers: ['139', '140', '141', '142', '144', '146'],
    rewardTitle: 'PORO + ALL UNRESERVED CHAOS RARES', rewardCaption: 'BONE SKEWER · CONSCRIPTION · EVELYNN · HEEDLESS RESURRECTION · MADULI · SYNDRA'
  }),
  bundleSpot(35, {
    key: 'CHASE_RIFT_HERALD', kind: 'named-bundle', label: 'Rift Herald + Cursed Sarcophagus',
    anchor: 'Rift Herald', anchorNumber: '179A', color: 'Purple', domain: 'Chaos',
    members: ['Rift Herald', 'Cursed Sarcophagus'], poolNumbers: [], heroNumber: '179',
    rewardTitle: 'RIFT HERALD AA + EPIC BUNDLE', rewardCaption: 'BOTH RIFT HERALD PRINTINGS · CURSED SARCOPHAGUS'
  }),
  bundleSpot(36, {
    key: 'BARON_BONUS_CARDS', kind: 'baron-bonus', label: 'Baron Nashor + Sprite Fountain + Abandon + Repulse',
    anchor: 'Baron Nashor', anchorNumber: '238', color: 'Mixed', domain: 'Mixed',
    members: ['Baron Nashor', 'Sprite Fountain', 'Abandon', 'Repulse'], poolNumbers: [], heroMember: 'Sprite Fountain',
    rewardTitle: 'BARON + THREE BONUS CARDS', rewardCaption: 'EVERY BARON PRINTING · SPRITE FOUNTAIN · ABANDON · REPULSE'
  }),
  bundleSpot(37, {
    key: 'PORO_DARING_ORDER_A', kind: 'poro-bundle', label: 'Daring Poro + Order Rares A',
    anchor: 'Daring Poro', anchorNumber: '225', poro: 'Daring Poro', color: 'Yellow', domain: 'Order',
    members: ['Daring Poro'], poolNumbers: ['170', '171', '174'],
    rewardTitle: 'PORO + ASSIGNED ORDER RARES', rewardCaption: 'DARING PORO · ATAKHAN · GALIO · SHARD OF UNDOING'
  }),
  bundleSpot(38, {
    key: 'CHASE_RUINATION_ORDER_B', kind: 'named-bundle', label: 'The Ruination + Sacrifice + Ashe + Order Rares B',
    anchor: 'The Ruination', anchorNumber: '180', color: 'Yellow', domain: 'Order',
    members: ['The Ruination', 'Sacrifice', 'Ashe'], poolNumbers: ['175'], heroNumber: '173',
    rewardTitle: 'RUINATION + SACRIFICE + ASHE', rewardCaption: 'THE RUINATION · SACRIFICE · ASHE · TACTICAL RETREAT'
  }),
  bundleSpot(39, {
    key: 'ALL_SIX_AA_RUNES', kind: 'runes', label: 'All 6 Alternate-Art Runes',
    anchor: 'Fury Rune', anchorNumber: 'R01A', color: 'Mixed', domain: 'All Six',
    members: [], poolNumbers: BOOSTER_AA_RUNE_NUMBERS, heroNumber: 'R05A',
    rewardTitle: 'ALL SIX AA RUNES', rewardCaption: 'FURY · CALM · MIND · BODY · CHAOS · ORDER'
  })
]);

const UNLEASHED_EXPANDED_SPOTS = Object.freeze([...CHAMPION_SPOTS, ...NON_CHAMPION_SPOTS]);

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
    .replace(/^UNL[-\s]*/, '')
    .split('/')[0]
    .replace(/-STAR$/, '*')
    .replace(/^0+(?=\d)/, '');
}

function matchesUnleashedExpandedAnchor(card = {}, spot = {}) {
  return setCode(card) === 'UNL'
    && collectorNumberKey(card.card_number || card.number) === collectorNumberKey(spot.anchorNumber);
}

function unleashedExpandedSpotForAnchor(card = {}, position = 0) {
  const wantedPosition = Number(position || card.position || 0);
  if (wantedPosition) {
    const expected = UNLEASHED_EXPANDED_SPOTS.find(spot => spot.position === wantedPosition);
    return expected && matchesUnleashedExpandedAnchor(card, expected) ? expected : null;
  }
  return UNLEASHED_EXPANDED_SPOTS.find(spot => matchesUnleashedExpandedAnchor(card, spot)) || null;
}

function isUnleashedExpandedBreakBoard(boardRows = []) {
  const rows = [...(Array.isArray(boardRows) ? boardRows : [])]
    .sort((left, right) => Number(left.position || 0) - Number(right.position || 0));
  return rows.length === UNLEASHED_EXPANDED_SPOTS.length
    && UNLEASHED_EXPANDED_SPOTS.every((spot, index) =>
      Number(rows[index]?.position || 0) === spot.position
        && matchesUnleashedExpandedAnchor(rows[index], spot)
    );
}

function spotLabel(spot = {}) {
  if (spot.kind === 'champion-split') {
    const lane = spot.mode === 'signature' ? 'SIG' : 'ON';
    const aaName = String(spot.pairedAaName).split(',').slice(1).join(',').trim() || spot.pairedAaName;
    return `${spot.champion} — ${lane} + ${aaName} AA (${spot.pairedAaNumber}) + Epic ${spot.epicNumber} + Rare ${spot.rareNumber}`;
  }
  return spot.label || spot.anchor || 'Unleashed Spot';
}

function decorateUnleashedExpandedBreakBoard(boardRows = []) {
  const rows = Array.isArray(boardRows) ? boardRows : [];
  if (!isUnleashedExpandedBreakBoard(rows)) return rows;
  return rows.map(row => {
    const spot = unleashedExpandedSpotForAnchor(row, row.position);
    return spot ? {
      ...row,
      break_spot_label: spotLabel(spot),
      break_listing_description: UNLEASHED_EXPANDED_LISTING_DESCRIPTION,
      break_spot_key: spot.key,
      unleashed_expanded_break: true
    } : row;
  });
}

function cardMatchesMember(card = {}, member = '') {
  const wanted = norm(member);
  return fullName(card) === wanted || prefixName(card) === wanted;
}

function isPromotionalPrinting(card = {}) {
  return [card.rarity, card.source_rarity, card.collector_treatment, card.variant, card.manual_category]
    .some(value => /\bPROMO(?:TIONAL)?\b/i.test(String(value || '')));
}

function cardBelongsToUnleashedExpandedSpot(card = {}, spot = {}) {
  if (setCode(card) !== 'UNL' || !spot) return false;
  const number = collectorNumberKey(card.card_number || card.number);
  if (spot.kind === 'champion-split') {
    return !isPromotionalPrinting(card)
      && spot.ownedNumbers.map(collectorNumberKey).includes(number);
  }
  if (spot.kind === 'runes') return BOOSTER_AA_RUNE_NUMBER_SET.has(number);
  if (spot.members.some(member => cardMatchesMember(card, member))) return true;
  return spot.poolNumbers.map(collectorNumberKey).includes(number);
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

function cardsForUnleashedExpandedSpot(catalog = [], spot = {}) {
  return uniqueCards((Array.isArray(catalog) ? catalog : [])
    .filter(card => cardBelongsToUnleashedExpandedSpot(card, spot)))
    .sort(sortChampionFamily);
}

function cardsMatchingMember(family = [], member = '') {
  return family.filter(card => cardMatchesMember(card, member));
}

function bundleGroupsForUnleashedExpandedSpot(family = [], spot = {}) {
  if (spot.kind === 'champion-split') {
    const groupForNumber = (suffix, label, caption, role, number, badge = '', badgeLabel = '') => ({
      key: `${spot.mode}-${suffix}`,
      label,
      caption,
      role,
      badge,
      badgeLabel,
      cards: family.filter(card => collectorNumberKey(card.card_number || card.number) === collectorNumberKey(number))
    });
    const lane = spot.mode === 'signature' ? 'Signature' : 'Overnumbered';
    const laneBadge = spot.mode === 'signature' ? '💎' : '🔥';
    return [
      groupForNumber('headline', `${spot.champion} ${lane}`, `Exact ${lane} printing · ${spot.anchorNumber}`, spot.mode, spot.anchorNumber, laneBadge, lane),
      groupForNumber('aa', `${spot.pairedAaName} AA`, `Assigned Alternate Art · ${spot.pairedAaNumber}`, 'alternate-art', spot.pairedAaNumber, '💣', 'Alternate Art'),
      groupForNumber('epic', `Assigned Epic · ${spot.epicNumber}`, `Exact Epic printing · ${spot.epicNumber}`, 'epic', spot.epicNumber),
      groupForNumber('rare', `Assigned Rare · ${spot.rareNumber}`, `Exact Rare printing · ${spot.rareNumber}`, 'rare', spot.rareNumber)
    ].filter(group => group.cards.length);
  }
  if (spot.kind === 'runes') {
    return [{
      key: 'all-aa-runes',
      label: 'All 6 Alternate-Art Runes',
      caption: 'Fury + Calm + Mind + Body + Chaos + Order booster AA Runes',
      role: 'rune',
      cards: family
    }];
  }
  const groups = spot.members.map(member => ({
    key: norm(member).replace(/\s+/g, '-'),
    label: member,
    caption: `Every matching ${member} printing pulled`,
    role: spot.poro && norm(member) === norm(spot.poro) ? 'poro' : spot.kind === 'baron-bonus' && norm(member) === norm('Baron Nashor') ? 'baron' : 'mapped',
    cards: cardsMatchingMember(family, member)
  }));
  const poolNumberSet = new Set(spot.poolNumbers.map(collectorNumberKey));
  const poolCards = family.filter(card => poolNumberSet.has(collectorNumberKey(card.card_number || card.number)));
  if (poolCards.length) groups.push({
    key: 'assigned-color-pool',
    label: `Assigned ${spot.domain} Rares`,
    caption: 'Exact collector-number split shown in the Board 7 map',
    role: 'rare-color',
    cards: poolCards
  });
  return groups.filter(group => group.cards.length);
}

function bestCardForNumber(family = [], number = '') {
  const wanted = collectorNumberKey(number);
  return family.find(card => collectorNumberKey(card.card_number || card.number) === wanted) || null;
}

function heroCardsForUnleashedExpandedSpot(family = [], spot = {}, boardAnchor = {}) {
  const exactAnchor = bestCardForNumber(family, spot.anchorNumber) || boardAnchor;
  if (spot.kind === 'champion-split') {
    return uniqueCards([exactAnchor, bestCardForNumber(family, spot.pairedAaNumber)].filter(Boolean));
  }
  const requestedHero = spot.heroNumber
    ? bestCardForNumber(family, spot.heroNumber)
    : spot.heroMember
      ? family.find(card => cardMatchesMember(card, spot.heroMember))
      : null;
  const fallback = family.find(card => Number(card.id) !== Number(exactAnchor?.id));
  return uniqueCards([exactAnchor, requestedHero || fallback].filter(Boolean));
}

function spotInstruction(spot = {}) {
  if (spot.kind === 'champion-split') {
    const lane = spot.mode === 'signature' ? 'Signature' : 'Overnumbered';
    return `Exactly four cards: ${spot.champion} ${lane}, ${spot.pairedAaName} Alternate Art (${spot.pairedAaNumber}), assigned Epic (${spot.epicNumber}), and assigned Rare (${spot.rareNumber}).`;
  }
  if (spot.kind === 'runes') return 'Includes all six Unleashed booster Alternate-Art Runes; promotional and regular Runes are excluded.';
  const members = spot.members.join(', ');
  return `Includes ${members}${spot.poolNumbers.length ? ` plus the exact assigned ${spot.domain} Rare pool` : ''}.`;
}

function spotRewardTitle(spot = {}) {
  if (spot.kind === 'champion-split') return spot.mode === 'signature' ? 'SIGNATURE + ASSIGNED AA / EPIC / RARE' : 'OVERNUMBERED + ASSIGNED AA / EPIC / RARE';
  return spot.rewardTitle;
}

function spotRewardCaption(spot = {}) {
  if (spot.kind === 'champion-split') return `EXACT FOUR-CARD ${spot.champion.toUpperCase()} LANE · NO DUPLICATES`;
  return spot.rewardCaption;
}

function buildUnleashedExpandedBreakSpot(catalog = [], boardAnchor = {}) {
  const spot = unleashedExpandedSpotForAnchor(boardAnchor, boardAnchor.position);
  if (!spot) return null;
  const family = cardsForUnleashedExpandedSpot(catalog, spot);
  return {
    profileId: UNLEASHED_EXPANDED_PROFILE_ID,
    position: spot.position,
    key: spot.key,
    kind: spot.kind,
    mode: spot.mode,
    laneSymbol: spot.kind === 'champion-split' ? (spot.mode === 'signature' ? '💎' : '🔥') : '',
    laneLabel: spot.kind === 'champion-split' ? (spot.mode === 'signature' ? 'SIG' : 'ON') : '',
    color: spot.color,
    domain: spot.domain,
    anchor: spot.anchor,
    champion: spot.champion,
    champions: spot.champion ? [spot.champion] : [],
    poro: spot.poro,
    baron: spot.kind === 'baron-bonus',
    rune: spot.kind === 'runes' ? 'All 6 AA Runes' : '',
    displayLabel: spotLabel(spot),
    listingNote: spotLabel(spot),
    instruction: spotInstruction(spot),
    rewardTitle: spotRewardTitle(spot),
    rewardCaption: spotRewardCaption(spot),
    family,
    heroCards: heroCardsForUnleashedExpandedSpot(family, spot, boardAnchor),
    bundleGroups: bundleGroupsForUnleashedExpandedSpot(family, spot)
  };
}

function chooseBoardAnchor(catalog = [], spot = {}) {
  return [...(Array.isArray(catalog) ? catalog : [])]
    .filter(card => matchesUnleashedExpandedAnchor(card, spot))
    .sort((left, right) =>
      Number(!String(left.image_path || left.image_url || '').trim()) - Number(!String(right.image_path || right.image_url || '').trim())
        || Number(left.id || 0) - Number(right.id || 0)
    )[0] || null;
}

function ensureUnleashedExpandedBoardSeven(database) {
  const existingMarker = database.prepare('SELECT value FROM app_metadata WHERE key = ?')
    .get(UNLEASHED_EXPANDED_MIGRATION_KEY)?.value;
  if (existingMarker) return { seeded: false, skipped: true, reason: 'already-installed' };

  const catalog = database.prepare(`
    SELECT * FROM cards
    WHERE UPPER(TRIM(COALESCE(game_code, ''))) = 'RIFTBOUND'
      AND UPPER(TRIM(COALESCE(set_code, ''))) = 'UNL'
  `).all();
  const anchors = UNLEASHED_EXPANDED_SPOTS.map(spot => chooseBoardAnchor(catalog, spot));
  const missing = UNLEASHED_EXPANDED_SPOTS
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
    `).run(UNLEASHED_EXPANDED_BOARD_SLOT, UNLEASHED_EXPANDED_BOARD_NAME, savedAt);
    database.prepare('DELETE FROM break_board_preset_cards WHERE slot = ?').run(UNLEASHED_EXPANDED_BOARD_SLOT);
    const insertPreset = database.prepare(`
      INSERT INTO break_board_preset_cards (slot, position, card_id, added_at)
      VALUES (?, ?, ?, ?)
    `);
    anchors.forEach((card, index) => insertPreset.run(UNLEASHED_EXPANDED_BOARD_SLOT, index + 1, card.id, savedAt));

    // Only Board 7's editable draft is refreshed when Board 7 was already
    // selected. The current live ledger, Buyer Bags and history stay untouched.
    if (workingSlot === UNLEASHED_EXPANDED_BOARD_SLOT) {
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
    `).run(UNLEASHED_EXPANDED_MIGRATION_KEY, savedAt);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  return {
    seeded: true,
    slot: UNLEASHED_EXPANDED_BOARD_SLOT,
    name: UNLEASHED_EXPANDED_BOARD_NAME,
    savedCards: anchors.length,
    loadedWorkingBoard: workingSlot === UNLEASHED_EXPANDED_BOARD_SLOT,
    mappingMode: 'MAPPED'
  };
}

module.exports = {
  BOOSTER_AA_RUNE_NUMBERS,
  CHAMPION_SPLITS,
  UNLEASHED_EXPANDED_BOARD_NAME,
  UNLEASHED_EXPANDED_BOARD_SLOT,
  UNLEASHED_EXPANDED_MIGRATION_KEY,
  UNLEASHED_EXPANDED_LISTING_DESCRIPTION,
  UNLEASHED_EXPANDED_PROFILE_ID,
  UNLEASHED_EXPANDED_SPOTS,
  UNLEASHED_EXPANDED_VALUE_SNAPSHOT,
  UNLEASHED_EXPANDED_VALUE_SOURCE,
  buildUnleashedExpandedBreakSpot,
  bundleGroupsForUnleashedExpandedSpot,
  cardBelongsToUnleashedExpandedSpot,
  cardsForUnleashedExpandedSpot,
  chooseBoardAnchor,
  collectorNumberKey,
  decorateUnleashedExpandedBreakBoard,
  ensureUnleashedExpandedBoardSeven,
  heroCardsForUnleashedExpandedSpot,
  isUnleashedExpandedBreakBoard,
  matchesUnleashedExpandedAnchor,
  isPromotionalPrinting,
  spotLabel,
  unleashedExpandedSpotForAnchor
};
