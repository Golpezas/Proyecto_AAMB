'use strict';

const {
  cardBelongsToBaron,
  cardBelongsToChampion,
  isUnleashedRareColorCard,
  sortChampionFamily
} = require('./RiftboundChampionAudit');

const UNLEASHED_BOARD_THREE_PROFILE_ID = 'UNL_BOARD_3_23_COLOR_POROS_V2';
const UNLEASHED_BOARD_THREE_SLOT = 3;
const UNLEASHED_BOARD_THREE_NAME = 'Unleashed · 23 Spots · Color Poros & Separate Chases';
// v3 intentionally reruns the installer after correcting the two middle Poro
// domains: Plundering owns Mind and Veteran owns Body. The reusable preset is
// safe to rebuild because live/pending rounds retain immutable snapshots.
const UNLEASHED_BOARD_THREE_MIGRATION_KEY = 'unleashed-board-3-23-color-poros-special-chases-2026-09-24-v3';

const CHAMPION_ANCHORS = Object.freeze([
  Object.freeze({ champion: 'Jhin', number: '226*' }),
  Object.freeze({ champion: 'Rengar', number: '227*' }),
  Object.freeze({ champion: 'Pyke', number: '228*' }),
  Object.freeze({ champion: 'Vi', number: '229*' }),
  Object.freeze({ champion: 'Lillia', number: '230*' }),
  Object.freeze({ champion: 'Master Yi', number: '231*' }),
  Object.freeze({ champion: 'Vex', number: '232*' }),
  Object.freeze({ champion: 'Ivern', number: '233*' }),
  Object.freeze({ champion: 'Diana', number: '234*' }),
  Object.freeze({ champion: 'LeBlanc', number: '235*' }),
  Object.freeze({ champion: "Kha'Zix", number: '236*' }),
  Object.freeze({ champion: 'Poppy', number: '237*' })
]);

const PORO_COLOR_SPOTS = Object.freeze([
  Object.freeze({ poro: 'Pouty Poro', color: 'Red', domain: 'Fury', rune: 'Fury Rune', runeNumber: 'R01A' }),
  Object.freeze({ poro: 'Lonely Poro', color: 'Green', domain: 'Calm', rune: 'Calm Rune', runeNumber: 'R02A' }),
  Object.freeze({ poro: 'Plundering Poro', color: 'Blue', domain: 'Mind', rune: 'Mind Rune', runeNumber: 'R03A' }),
  Object.freeze({ poro: 'Veteran Poro', color: 'Orange', domain: 'Body', rune: 'Body Rune', runeNumber: 'R04A' }),
  Object.freeze({ poro: 'Mystic Poro', color: 'Purple', domain: 'Chaos', rune: 'Chaos Rune', runeNumber: 'R05A' }),
  Object.freeze({ poro: 'Daring Poro', color: 'Yellow', domain: 'Order', rune: 'Order Rune', runeNumber: 'R06A', retainedNames: Object.freeze(['The Ruination']) })
]);

const SEPARATE_CHASE_NAMES = Object.freeze([
  'Vilemaw',
  'Elder Dragon',
  'Rift Herald',
  'Irresistible Faefolk',
  'Alpha Wildclaw',
  'Blue Sentinel'
]);
const SEPARATE_CHASE_NAME_KEYS = new Set(SEPARATE_CHASE_NAMES.map(normalizeName));

function championSpot(position, entry) {
  return Object.freeze({
    position,
    key: `BOARD3_CHAMPION_${normalizeName(entry.champion).replace(/\s+/g, '_').toUpperCase()}`,
    kind: 'champion',
    label: entry.champion,
    champion: entry.champion,
    anchor: entry.champion,
    anchorNumber: entry.number,
    members: Object.freeze([])
  });
}

function poroSpot(position, entry) {
  return Object.freeze({
    position,
    key: `BOARD3_PORO_${normalizeName(entry.poro).replace(/\s+/g, '_').toUpperCase()}`,
    kind: 'poro-color',
    label: `${entry.poro} + ${entry.rune}`,
    champion: '',
    anchor: entry.poro,
    anchorNumber: String(position + 206),
    poro: entry.poro,
    color: entry.color,
    domain: entry.domain,
    rune: entry.rune,
    runeNumber: entry.runeNumber,
    retainedNames: Object.freeze([...(entry.retainedNames || [])]),
    members: Object.freeze([entry.poro, entry.rune, ...(entry.retainedNames || [])])
  });
}

function namedSpot(position, key, label, anchor, anchorNumber, members) {
  return Object.freeze({
    position,
    key,
    kind: 'named-chase',
    label,
    champion: '',
    anchor,
    anchorNumber,
    members: Object.freeze([...members])
  });
}

const UNLEASHED_BOARD_THREE_SPOTS = Object.freeze([
  ...CHAMPION_ANCHORS.map((entry, index) => championSpot(index + 1, entry)),
  Object.freeze({
    position: 13,
    key: 'BOARD3_BARON_NASHOR',
    kind: 'baron',
    label: 'Baron Nashor',
    champion: '',
    anchor: 'Baron Nashor',
    anchorNumber: '238',
    members: Object.freeze(['Baron Nashor'])
  }),
  ...PORO_COLOR_SPOTS.map((entry, index) => poroSpot(index + 14, entry)),
  namedSpot(20, 'BOARD3_VILEMAW', 'Vilemaw', 'Vilemaw', '060A', ['Vilemaw']),
  namedSpot(21, 'BOARD3_ELDER_DRAGON', 'Elder Dragon', 'Elder Dragon', '118A', ['Elder Dragon']),
  namedSpot(22, 'BOARD3_RIFT_HERALD', 'Rift Herald', 'Rift Herald', '179A', ['Rift Herald']),
  namedSpot(
    23,
    'BOARD3_FAEFOLK_WILDCLAW_SENTINEL',
    'Irresistible Faefolk + Alpha Wildclaw + Blue Sentinel',
    'Irresistible Faefolk',
    '112',
    ['Irresistible Faefolk', 'Alpha Wildclaw', 'Blue Sentinel']
  )
]);

function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9']+/g, ' ')
    .trim();
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

function setCode(card = {}) {
  return String(card.set_code || '').trim().toUpperCase();
}

function prefixName(card = {}) {
  return normalizeName(String(card.name || '').split(',')[0]);
}

function cardNameMatches(card = {}, wanted = '') {
  const key = normalizeName(wanted);
  return normalizeName(card.name) === key || prefixName(card) === key;
}

function isPromotionalPrinting(card = {}) {
  return [card.rarity, card.source_rarity, card.collector_treatment, card.variant, card.manual_category]
    .some(value => /\bPROMO(?:TIONAL)?\b/i.test(String(value || '')));
}

function isAlternateArt(card = {}) {
  const treatment = [card.collector_treatment, card.variant, card.manual_category]
    .map(value => String(value || '').trim().toUpperCase());
  return collectorNumberKey(card.card_number || card.number).endsWith('A')
    || treatment.some(value => value === 'ALTERNATE ART' || value === 'ALT ART' || value === 'SHOWCASE');
}

function matchesUnleashedBoardThreeAnchor(card = {}, spot = {}) {
  return setCode(card) === 'UNL'
    && collectorNumberKey(card.card_number || card.number) === collectorNumberKey(spot.anchorNumber);
}

function isUnleashedBoardThreeBreakBoard(boardRows = []) {
  const rows = [...(Array.isArray(boardRows) ? boardRows : [])]
    .sort((left, right) => Number(left.position || 0) - Number(right.position || 0));
  return rows.length === UNLEASHED_BOARD_THREE_SPOTS.length
    && UNLEASHED_BOARD_THREE_SPOTS.every((spot, index) =>
      Number(rows[index]?.position || 0) === spot.position
      && matchesUnleashedBoardThreeAnchor(rows[index], spot)
    );
}

function cardBelongsToUnleashedBoardThreeSpot(card = {}, spot = {}) {
  if (setCode(card) !== 'UNL' || !spot || isPromotionalPrinting(card)) return false;
  if (matchesUnleashedBoardThreeAnchor(card, spot)) return true;
  if (spot.kind === 'champion') return cardBelongsToChampion(card, spot.champion, 'UNL');
  if (spot.kind === 'baron') return cardBelongsToBaron(card, 'UNL');
  if (spot.kind === 'named-chase') {
    return spot.members.some(member => cardNameMatches(card, member));
  }
  if (spot.kind !== 'poro-color') return false;

  if (cardNameMatches(card, spot.poro)) return true;
  if (collectorNumberKey(card.card_number || card.number) === collectorNumberKey(spot.runeNumber)) return true;
  if (spot.retainedNames.some(name => cardNameMatches(card, name))) return true;
  if (SEPARATE_CHASE_NAME_KEYS.has(prefixName(card))) return false;
  return isUnleashedRareColorCard(card, { domain: spot.domain }, 'UNL');
}

function uniqueCards(cards = []) {
  const seen = new Set();
  return cards.filter(card => {
    const key = Number(card.id) || [setCode(card), collectorNumberKey(card.card_number), normalizeName(card.name)].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function memberOrder(card = {}, members = []) {
  const index = members.findIndex(member => cardNameMatches(card, member));
  return index < 0 ? members.length : index;
}

function orderedBoardThreeCards(cards = [], spot = {}, anchor = null) {
  return [...cards].sort((left, right) => {
    const anchorDifference = Number(Number(right.id) === Number(anchor?.id)) - Number(Number(left.id) === Number(anchor?.id));
    if (anchorDifference) return anchorDifference;
    if (spot.kind === 'poro-color') {
      const poroRank = card => cardNameMatches(card, spot.poro)
        ? 0
        : collectorNumberKey(card.card_number || card.number) === collectorNumberKey(spot.runeNumber)
          ? 1
          : spot.retainedNames.some(name => cardNameMatches(card, name))
            ? 2
            : 3;
      const rankDifference = poroRank(left) - poroRank(right);
      if (rankDifference) return rankDifference;
    }
    if (spot.kind === 'named-chase') {
      const memberDifference = memberOrder(left, spot.members) - memberOrder(right, spot.members);
      if (memberDifference) return memberDifference;
      const altDifference = Number(isAlternateArt(right)) - Number(isAlternateArt(left));
      if (altDifference) return altDifference;
    }
    if (spot.kind === 'baron') {
      const baronRank = card => collectorNumberKey(card.card_number || card.number) === '238'
        ? 0
        : isAlternateArt(card) ? 1 : 2;
      const rankDifference = baronRank(left) - baronRank(right);
      if (rankDifference) return rankDifference;
    }
    return sortChampionFamily(left, right);
  });
}

function cardsForUnleashedBoardThreeSpot(catalog = [], spot = {}, anchor = null) {
  const family = uniqueCards((Array.isArray(catalog) ? catalog : [])
    .filter(card => cardBelongsToUnleashedBoardThreeSpot(card, spot)));
  return orderedBoardThreeCards(family, spot, anchor);
}

function chooseUnleashedBoardThreeAnchor(catalog = [], spot = {}) {
  return [...(Array.isArray(catalog) ? catalog : [])]
    .filter(card => matchesUnleashedBoardThreeAnchor(card, spot))
    .sort((left, right) =>
      Number(!String(left.image_path || left.image_url || '').trim()) - Number(!String(right.image_path || right.image_url || '').trim())
      || Number(left.id || 0) - Number(right.id || 0)
    )[0] || null;
}

function incompleteMappedCards(spot = {}, cards = []) {
  const missing = [];
  if (spot.kind === 'champion' && cards.length < 8) {
    missing.push(`${spot.champion} complete eight-card booster family`);
  }
  if (spot.kind === 'baron') {
    if (!cards.some(card => collectorNumberKey(card.card_number || card.number) === '147')) missing.push('Baron Nashor Epic 147');
    if (!cards.some(card => collectorNumberKey(card.card_number || card.number) === '147A')) missing.push('Baron Nashor Alternate Art 147A');
    if (!cards.some(card => collectorNumberKey(card.card_number || card.number) === '238')) missing.push('Baron Nashor Ultimate 238');
  }
  if (spot.kind === 'poro-color') {
    if (!cards.some(card => collectorNumberKey(card.card_number || card.number) === collectorNumberKey(spot.runeNumber))) {
      missing.push(`${spot.rune} ${spot.runeNumber}`);
    }
  }
  if (spot.kind === 'named-chase' && spot.position <= 22) {
    if (!cards.some(card => isAlternateArt(card))) missing.push(`${spot.label} Alternate Art`);
    if (!cards.some(card => !isAlternateArt(card))) missing.push(`${spot.label} Epic`);
  }
  for (const member of spot.members || []) {
    if (!cards.some(card => cardNameMatches(card, member))) missing.push(member);
  }
  return missing;
}

function prepareUnleashedBoardThree(catalog = []) {
  const spots = UNLEASHED_BOARD_THREE_SPOTS.map(definition => {
    const anchor = chooseUnleashedBoardThreeAnchor(catalog, definition);
    const cards = anchor ? cardsForUnleashedBoardThreeSpot(catalog, definition, anchor) : [];
    return {
      definition,
      anchor,
      cards,
      // Supporting-card completeness is diagnostic only. Different catalog
      // snapshots sometimes omit a treatment tag or one booster printing, but
      // that must not strand the user on the previous 19-position preset.
      warnings: anchor ? incompleteMappedCards(definition, cards) : [],
      missingAnchor: anchor ? '' : `${definition.label} anchor ${definition.anchorNumber}`
    };
  });
  const missing = spots
    .filter(spot => spot.missingAnchor)
    .map(spot => ({
      position: spot.definition.position,
      label: spot.definition.label,
      card: spot.missingAnchor
    }));
  if (missing.length) return { ready: false, reason: 'missing-spot-anchors', missing };

  const warnings = spots.flatMap(spot => spot.warnings.map(card => ({
    position: spot.definition.position,
    label: spot.definition.label,
    card
  })));

  const owners = new Map();
  const duplicates = [];
  for (const spot of spots) {
    for (const card of spot.cards) {
      const cardId = Number(card.id);
      if (owners.has(cardId)) duplicates.push({ cardId, positions: [owners.get(cardId), spot.definition.position] });
      else owners.set(cardId, spot.definition.position);
    }
  }
  if (duplicates.length) return { ready: false, reason: 'duplicate-mapped-cards', duplicates };

  return {
    ready: true,
    anchors: spots.map(spot => spot.anchor),
    spots,
    mappedCards: owners.size,
    warnings
  };
}

function ensureUnleashedBoardThree(database) {
  const existingMarker = database.prepare('SELECT value FROM app_metadata WHERE key = ?')
    .get(UNLEASHED_BOARD_THREE_MIGRATION_KEY)?.value;
  if (existingMarker) return { seeded: false, skipped: true, reason: 'already-installed' };

  const catalog = database.prepare(`
    SELECT * FROM cards
    WHERE UPPER(TRIM(COALESCE(game_code, ''))) = 'RIFTBOUND'
      AND UPPER(TRIM(COALESCE(set_code, ''))) = 'UNL'
  `).all();
  const prepared = prepareUnleashedBoardThree(catalog);
  if (!prepared.ready) return { seeded: false, skipped: true, ...prepared };

  const savedAt = new Date().toISOString();
  const workingSlot = Number(database.prepare("SELECT value FROM app_metadata WHERE key = 'break-board-working-preset-slot-v1'").get()?.value || 0);
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare(`
      INSERT INTO break_board_presets (slot, name, saved_at, mapping_mode) VALUES (?, ?, ?, 'MAPPED')
      ON CONFLICT(slot) DO UPDATE SET name = excluded.name, saved_at = excluded.saved_at,
        mapping_mode = excluded.mapping_mode
    `).run(UNLEASHED_BOARD_THREE_SLOT, UNLEASHED_BOARD_THREE_NAME, savedAt);

    // Only reusable Board 3 is replaced. Live and pending rounds already own
    // immutable mapping snapshots, so Buyer Bags and Pull History cannot move.
    database.prepare('DELETE FROM break_board_custom_spot_cards WHERE slot = ?').run(UNLEASHED_BOARD_THREE_SLOT);
    database.prepare('DELETE FROM break_board_custom_spots WHERE slot = ?').run(UNLEASHED_BOARD_THREE_SLOT);
    database.prepare('DELETE FROM break_board_preset_cards WHERE slot = ?').run(UNLEASHED_BOARD_THREE_SLOT);

    const insertPreset = database.prepare(`
      INSERT INTO break_board_preset_cards (slot, position, card_id, added_at)
      VALUES (?, ?, ?, ?)
    `);
    const insertSpot = database.prepare(`
      INSERT INTO break_board_custom_spots (slot, position, label, updated_at)
      VALUES (?, ?, ?, ?)
    `);
    const insertCard = database.prepare(`
      INSERT INTO break_board_custom_spot_cards
        (slot, position, card_id, sort_order, addition_type, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const spot of prepared.spots) {
      insertPreset.run(UNLEASHED_BOARD_THREE_SLOT, spot.definition.position, spot.anchor.id, savedAt);
      insertSpot.run(UNLEASHED_BOARD_THREE_SLOT, spot.definition.position, spot.definition.label, savedAt);
      spot.cards.forEach((card, index) => insertCard.run(
        UNLEASHED_BOARD_THREE_SLOT,
        spot.definition.position,
        card.id,
        index + 1,
        Number(card.id) === Number(spot.anchor.id) ? 'ANCHOR' : 'SEQUENCE',
        savedAt
      ));
    }

    if (workingSlot === UNLEASHED_BOARD_THREE_SLOT) {
      database.prepare('DELETE FROM break_board_cards').run();
      const insertWorking = database.prepare('INSERT INTO break_board_cards (card_id, position, added_at) VALUES (?, ?, ?)');
      prepared.spots.forEach(spot => insertWorking.run(spot.anchor.id, spot.definition.position, savedAt));
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
    `).run(UNLEASHED_BOARD_THREE_MIGRATION_KEY, savedAt);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  return {
    seeded: true,
    slot: UNLEASHED_BOARD_THREE_SLOT,
    name: UNLEASHED_BOARD_THREE_NAME,
    savedCards: prepared.anchors.length,
    mappedCards: prepared.mappedCards,
    catalogWarnings: prepared.warnings.length,
    loadedWorkingBoard: workingSlot === UNLEASHED_BOARD_THREE_SLOT,
    mappingMode: 'MAPPED'
  };
}

module.exports = {
  CHAMPION_ANCHORS,
  PORO_COLOR_SPOTS,
  SEPARATE_CHASE_NAMES,
  UNLEASHED_BOARD_THREE_MIGRATION_KEY,
  UNLEASHED_BOARD_THREE_NAME,
  UNLEASHED_BOARD_THREE_PROFILE_ID,
  UNLEASHED_BOARD_THREE_SLOT,
  UNLEASHED_BOARD_THREE_SPOTS,
  cardBelongsToUnleashedBoardThreeSpot,
  cardsForUnleashedBoardThreeSpot,
  chooseUnleashedBoardThreeAnchor,
  collectorNumberKey,
  ensureUnleashedBoardThree,
  isAlternateArt,
  isPromotionalPrinting,
  isUnleashedBoardThreeBreakBoard,
  matchesUnleashedBoardThreeAnchor,
  prepareUnleashedBoardThree
};
