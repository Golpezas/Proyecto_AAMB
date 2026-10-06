'use strict';

const {
  ORIGINS_CHAMPIONS,
  ORIGINS_COLOR_SPOTS,
  cardBelongsToOriginsChampion,
  isOriginsAaRune,
  isOriginsRareEpicDomainCard,
  originsCardNumberParts
} = require('./RiftboundOriginsMapping');

const ORIGINS_BOARD_EIGHT_SLOT = 8;
const ORIGINS_BOARD_EIGHT_NAME = 'Origins · 24 Spots · Champions, Playables & Seals with Runes';
const ORIGINS_BOARD_EIGHT_PROFILE_ID = 'OGN_BOARD_8_24_SPOTS_V3';
const ORIGINS_BOARD_EIGHT_MIGRATION_KEY = 'origins-board-8-24-spots-runes-with-seals-2026-10-03-v3';

const CHAMPION_ULTIMATE_NUMBERS = Object.freeze({
  "Kai'Sa": '247',
  Volibear: '249',
  Jinx: '251',
  Darius: '253',
  Ahri: '255',
  'Lee Sin': '257',
  Yasuo: '259',
  Leona: '261',
  Teemo: '263',
  Viktor: '265',
  'Miss Fortune': '267',
  Sett: '269'
});

const CHAMPION_ON_NUMBERS = Object.freeze({
  "Kai'Sa": '299',
  Volibear: '300',
  Jinx: '301',
  Darius: '302',
  Ahri: '303',
  'Lee Sin': '304',
  Yasuo: '305',
  Leona: '306',
  Teemo: '307',
  Viktor: '308',
  'Miss Fortune': '309',
  Sett: '310'
});

function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9']+/g, ' ')
    .trim();
}

function cardName(card = {}) {
  return normalizeName(card.name);
}

function cardNameMatches(card = {}, wanted = '') {
  return cardName(card) === normalizeName(wanted)
    || normalizeName(String(card.name || '').split(',')[0]) === normalizeName(wanted);
}

function isOriginsCard(card = {}) {
  return String(card.set_code || '').trim().toUpperCase() === 'OGN';
}

function isPromotionalPrinting(card = {}) {
  const number = originsCardNumberParts(card);
  if (number.variant === 'B') return true;
  return [card.rarity, card.source_rarity, card.collector_treatment, card.variant, card.manual_category]
    .some(value => /\bPROMO(?:TIONAL)?\b/i.test(String(value || '')));
}

function championSpot(position, champion) {
  return Object.freeze({
    position,
    key: `BOARD8_CHAMPION_${normalizeName(champion).replace(/\s+/g, '_').toUpperCase()}`,
    kind: 'champion',
    label: champion,
    champion,
    members: Object.freeze([champion])
  });
}

function namedSpot(position, key, label, anchorName, anchorNumber, members) {
  return Object.freeze({
    position,
    key,
    kind: 'named-playable',
    label,
    anchorName,
    anchorNumber,
    members: Object.freeze([...members])
  });
}

function sealSpot(position, mapping) {
  return Object.freeze({
    position,
    key: `BOARD8_SEAL_${mapping.domain.toUpperCase()}`,
    kind: 'seal-color',
    label: `${mapping.seal} + ${mapping.rune} AA + ${mapping.domain} Rare/Epic · Non-Champion`,
    anchorName: mapping.seal,
    anchorNumber: mapping.sealNumber,
    mapping,
    members: Object.freeze([mapping.seal, mapping.rune])
  });
}

const NAMED_PLAYABLE_SPOTS = Object.freeze([
  namedSpot(13, 'BOARD8_BAITED_HOOK', 'Baited Hook', 'Baited Hook', '242', ['Baited Hook']),
  namedSpot(14, 'BOARD8_DAZZLING_AURORA', 'Dazzling Aurora', 'Dazzling Aurora', '160', ['Dazzling Aurora']),
  // 2026-10-01 pairing refresh requested by the user.
  namedSpot(15, 'BOARD8_UNCHECKED_POWER_SABOTAGE', 'Unchecked Power + Sabotage', 'Unchecked Power', '123', ['Unchecked Power', 'Sabotage']),
  namedSpot(16, 'BOARD8_INVERT_TIMELINES', 'Invert Timelines', 'Invert Timelines', '201', ['Invert Timelines']),
  namedSpot(17, 'BOARD8_WATCHER_FALLING_STAR', 'Thousand-Tailed Watcher + Falling Star', 'Thousand-Tailed Watcher', '116', ['Thousand-Tailed Watcher', 'Falling Star']),
  namedSpot(18, 'BOARD8_TIME_WARP_ZHONYAS', "Time Warp + Zhonya's Hourglass", 'Time Warp', '122', ['Time Warp', "Zhonya's Hourglass"])
]);

const NAMED_PLAYABLE_KEYS = new Set(
  NAMED_PLAYABLE_SPOTS.flatMap(spot => spot.members).map(normalizeName)
);

const ORIGINS_BOARD_EIGHT_SPOTS = Object.freeze([
  ...ORIGINS_CHAMPIONS.map((champion, index) => championSpot(index + 1, champion)),
  ...NAMED_PLAYABLE_SPOTS,
  ...ORIGINS_COLOR_SPOTS.map((mapping, index) => sealSpot(index + 19, mapping))
]);

function uniqueCards(cards = []) {
  const seen = new Set();
  return cards.filter(card => {
    const key = Number(card.id) || `${card.set_code}|${card.card_number}|${card.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function memberOrder(card = {}, members = []) {
  const index = members.findIndex(member => cardNameMatches(card, member));
  return index < 0 ? members.length : index;
}

function cardBelongsToOriginsBoardEightSpot(card = {}, spot = {}) {
  if (!isOriginsCard(card) || !spot || isPromotionalPrinting(card)) return false;
  if (spot.kind === 'champion') return cardBelongsToOriginsChampion(card, spot.champion);
  if (spot.kind === 'named-playable') return spot.members.some(member => cardNameMatches(card, member));
  if (spot.kind === 'all-runes') {
    return ORIGINS_COLOR_SPOTS.some(mapping => isOriginsAaRune(card, mapping));
  }
  if (spot.kind === 'seal-color') {
    if (cardNameMatches(card, spot.mapping.seal)) return true;
    if (isOriginsAaRune(card, spot.mapping)) return true;
    if (NAMED_PLAYABLE_KEYS.has(cardName(card))) return false;
    return isOriginsRareEpicDomainCard(card, spot.mapping);
  }
  return false;
}

function cardsForOriginsBoardEightSpot(catalog = [], spot = {}, anchor = null) {
  const cards = uniqueCards((Array.isArray(catalog) ? catalog : [])
    .filter(card => cardBelongsToOriginsBoardEightSpot(card, spot)));

  return cards.sort((left, right) => {
    const anchorDifference = Number(Number(right.id) === Number(anchor?.id)) - Number(Number(left.id) === Number(anchor?.id));
    if (anchorDifference) return anchorDifference;
    if (spot.kind === 'named-playable') {
      const memberDifference = memberOrder(left, spot.members) - memberOrder(right, spot.members);
      if (memberDifference) return memberDifference;
    }
    if (spot.kind === 'all-runes') {
      const runeDifference = memberOrder(left, spot.members) - memberOrder(right, spot.members);
      if (runeDifference) return runeDifference;
    }
    const leftParts = originsCardNumberParts(left);
    const rightParts = originsCardNumberParts(right);
    if (leftParts.number !== rightParts.number) return leftParts.number - rightParts.number;
    return String(leftParts.variant).localeCompare(String(rightParts.variant));
  });
}

function chooseChampionAnchor(catalog = [], spot = {}) {
  const family = (Array.isArray(catalog) ? catalog : []).filter(card =>
    isOriginsCard(card) && !isPromotionalPrinting(card) && cardBelongsToOriginsChampion(card, spot.champion));
  const onNumber = CHAMPION_ON_NUMBERS[spot.champion];
  const ultimateNumber = CHAMPION_ULTIMATE_NUMBERS[spot.champion];
  return family.sort((left, right) => {
    const rank = card => {
      const parts = originsCardNumberParts(card);
      if (String(parts.number) === onNumber && parts.variant === '*') return 0;
      if (String(parts.number) === onNumber && !parts.variant) return 1;
      if (String(parts.number) === ultimateNumber) return 2;
      return 3;
    };
    return rank(left) - rank(right) || Number(left.id || 0) - Number(right.id || 0);
  })[0] || null;
}

function chooseExactAnchor(catalog = [], spot = {}) {
  const wantedNumber = String(spot.anchorNumber || '').replace(/^0+/, '') || '0';
  return (Array.isArray(catalog) ? catalog : [])
    .filter(card => isOriginsCard(card) && !isPromotionalPrinting(card) && cardNameMatches(card, spot.anchorName))
    .sort((left, right) => {
      const leftParts = originsCardNumberParts(left);
      const rightParts = originsCardNumberParts(right);
      const leftExact = String(leftParts.number) === wantedNumber && !leftParts.variant ? 0 : 1;
      const rightExact = String(rightParts.number) === wantedNumber && !rightParts.variant ? 0 : 1;
      return leftExact - rightExact || Number(left.id || 0) - Number(right.id || 0);
    })[0] || null;
}

function chooseRunesAnchor(catalog = [], spot = {}) {
  const fury = ORIGINS_COLOR_SPOTS[0];
  return (Array.isArray(catalog) ? catalog : [])
    .filter(card => isOriginsCard(card) && cardNameMatches(card, spot.anchorName) && isOriginsAaRune(card, fury))
    .sort((left, right) => Number(left.id || 0) - Number(right.id || 0))[0] || null;
}

function chooseOriginsBoardEightAnchor(catalog = [], spot = {}) {
  if (spot.kind === 'champion') return chooseChampionAnchor(catalog, spot);
  if (spot.kind === 'all-runes') return chooseRunesAnchor(catalog, spot);
  return chooseExactAnchor(catalog, spot);
}

function prepareOriginsBoardEight(catalog = []) {
  const spots = ORIGINS_BOARD_EIGHT_SPOTS.map(definition => {
    const anchor = chooseOriginsBoardEightAnchor(catalog, definition);
    const cards = anchor ? cardsForOriginsBoardEightSpot(catalog, definition, anchor) : [];
    return { definition, anchor, cards };
  });

  const missing = spots.filter(spot => !spot.anchor).map(spot => ({
    position: spot.definition.position,
    label: spot.definition.label,
    anchor: spot.definition.anchorName || spot.definition.champion || ''
  }));
  if (missing.length) return { ready: false, reason: 'missing-spot-anchors', missing };

  const owners = new Map();
  const duplicates = [];
  for (const spot of spots) {
    for (const card of spot.cards) {
      const id = Number(card.id);
      if (owners.has(id)) duplicates.push({ cardId: id, positions: [owners.get(id), spot.definition.position] });
      else owners.set(id, spot.definition.position);
    }
  }
  if (duplicates.length) return { ready: false, reason: 'duplicate-mapped-cards', duplicates };

  return { ready: true, spots, mappedCards: owners.size };
}

function ensureOriginsBoardEight(database) {
  const existingMarker = database.prepare('SELECT value FROM app_metadata WHERE key = ?')
    .get(ORIGINS_BOARD_EIGHT_MIGRATION_KEY)?.value;
  if (existingMarker) return { seeded: false, skipped: true, reason: 'already-installed' };

  const catalog = database.prepare(`
    SELECT * FROM cards
    WHERE UPPER(TRIM(COALESCE(game_code, ''))) = 'RIFTBOUND'
      AND UPPER(TRIM(COALESCE(set_code, ''))) = 'OGN'
  `).all();
  const prepared = prepareOriginsBoardEight(catalog);
  if (!prepared.ready) return { seeded: false, skipped: true, ...prepared };

  const savedAt = new Date().toISOString();
  const workingSlot = Number(database.prepare("SELECT value FROM app_metadata WHERE key = 'break-board-working-preset-slot-v1'").get()?.value || 0);
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare(`
      INSERT INTO break_board_presets (slot, name, saved_at, mapping_mode)
      VALUES (?, ?, ?, 'MAPPED')
      ON CONFLICT(slot) DO UPDATE SET
        name = excluded.name,
        saved_at = excluded.saved_at,
        mapping_mode = excluded.mapping_mode
    `).run(ORIGINS_BOARD_EIGHT_SLOT, ORIGINS_BOARD_EIGHT_NAME, savedAt);

    // Only reusable Board 8 is rebuilt. Live, pending, Buyer Bag, and Pull
    // History snapshots remain immutable.
    database.prepare('DELETE FROM break_board_custom_spot_cards WHERE slot = ?').run(ORIGINS_BOARD_EIGHT_SLOT);
    database.prepare('DELETE FROM break_board_custom_spots WHERE slot = ?').run(ORIGINS_BOARD_EIGHT_SLOT);
    database.prepare('DELETE FROM break_board_preset_cards WHERE slot = ?').run(ORIGINS_BOARD_EIGHT_SLOT);

    const insertPreset = database.prepare(`
      INSERT INTO break_board_preset_cards (slot, position, card_id, added_at)
      VALUES (?, ?, ?, ?)
    `);
    const insertSpot = database.prepare(`
      INSERT INTO break_board_custom_spots (slot, position, label, updated_at)
      VALUES (?, ?, ?, ?)
    `);
    const insertMapped = database.prepare(`
      INSERT INTO break_board_custom_spot_cards
        (slot, position, card_id, sort_order, addition_type, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const spot of prepared.spots) {
      insertPreset.run(ORIGINS_BOARD_EIGHT_SLOT, spot.definition.position, spot.anchor.id, savedAt);
      insertSpot.run(ORIGINS_BOARD_EIGHT_SLOT, spot.definition.position, spot.definition.label, savedAt);
      spot.cards.forEach((card, index) => insertMapped.run(
        ORIGINS_BOARD_EIGHT_SLOT,
        spot.definition.position,
        card.id,
        index + 1,
        Number(card.id) === Number(spot.anchor.id) ? 'ANCHOR' : 'SEQUENCE',
        savedAt
      ));
    }

    if (workingSlot === ORIGINS_BOARD_EIGHT_SLOT) {
      database.prepare('DELETE FROM break_board_cards').run();
      const insertWorking = database.prepare(`
        INSERT INTO break_board_cards (card_id, position, added_at)
        VALUES (?, ?, ?)
      `);
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
    `).run(ORIGINS_BOARD_EIGHT_MIGRATION_KEY, savedAt);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  return {
    seeded: true,
    slot: ORIGINS_BOARD_EIGHT_SLOT,
    name: ORIGINS_BOARD_EIGHT_NAME,
    positions: prepared.spots.length,
    mappedCards: prepared.mappedCards,
    loadedWorkingBoard: workingSlot === ORIGINS_BOARD_EIGHT_SLOT,
    mappingMode: 'MAPPED'
  };
}

module.exports = {
  NAMED_PLAYABLE_SPOTS,
  ORIGINS_BOARD_EIGHT_MIGRATION_KEY,
  ORIGINS_BOARD_EIGHT_NAME,
  ORIGINS_BOARD_EIGHT_PROFILE_ID,
  ORIGINS_BOARD_EIGHT_SLOT,
  ORIGINS_BOARD_EIGHT_SPOTS,
  cardBelongsToOriginsBoardEightSpot,
  cardsForOriginsBoardEightSpot,
  chooseOriginsBoardEightAnchor,
  ensureOriginsBoardEight,
  prepareOriginsBoardEight
};
