'use strict';

const {
  cardBelongsToBaron,
  cardBelongsToChampion,
  cardBelongsToPoroSpot,
  isUnleashedRareColorCard,
  poroMapping,
  sortChampionFamily
} = require('./RiftboundChampionAudit');

const UNLEASHED_CASE_PROFILE_ID = 'UNL_CASE_19_BARON_AA_RUNES_V1';
const UNLEASHED_CASE_BOARD_SLOT = 1;
const UNLEASHED_CASE_BOARD_NAME = 'Unleashed · 19-Spot Case · Baron + All 6 AA Runes';
const UNLEASHED_CASE_BOARD_MIGRATION_KEY = 'unleashed-case-19-board-1-baron-aa-runes-v1';

const CHAMPION_ANCHORS = Object.freeze([
  Object.freeze({ name: 'Jhin', number: '226*' }),
  Object.freeze({ name: 'Rengar', number: '227*' }),
  Object.freeze({ name: 'Pyke', number: '228*' }),
  Object.freeze({ name: 'Vi', number: '229*' }),
  Object.freeze({ name: 'Lillia', number: '230*' }),
  Object.freeze({ name: 'Master Yi', number: '231*' }),
  Object.freeze({ name: 'Vex', number: '232*' }),
  Object.freeze({ name: 'Ivern', number: '233*' }),
  Object.freeze({ name: 'Diana', number: '234*' }),
  Object.freeze({ name: 'LeBlanc', number: '235*' }),
  Object.freeze({ name: "Kha'Zix", number: '236*' }),
  Object.freeze({ name: 'Poppy', number: '237*' })
]);

const COLOR_ANCHORS = Object.freeze([
  Object.freeze({ poro: 'Pouty Poro', number: '220' }),
  Object.freeze({ poro: 'Lonely Poro', number: '221' }),
  Object.freeze({ poro: 'Plundering Poro', number: '222' }),
  Object.freeze({ poro: 'Veteran Poro', number: '223' }),
  Object.freeze({ poro: 'Mystic Poro', number: '224' }),
  Object.freeze({ poro: 'Daring Poro', number: '225' })
]);

const UNLEASHED_CASE_SPOTS = Object.freeze([
  ...CHAMPION_ANCHORS.map((entry, index) => Object.freeze({
    position: index + 1,
    key: `CHAMPION_${entry.name.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`,
    kind: 'champion',
    champion: entry.name,
    anchor: entry.name,
    anchorNumber: entry.number,
    color: '',
    domain: '',
    poro: ''
  })),
  Object.freeze({
    position: 13,
    key: 'BARON_ALL_AA_RUNES',
    kind: 'baron-runes',
    champion: '',
    anchor: 'Baron Nashor',
    anchorNumber: '238',
    color: 'Mixed',
    domain: 'All Six',
    poro: '',
    baron: true
  }),
  ...COLOR_ANCHORS.map((entry, index) => {
    const mapping = poroMapping(entry.poro, 'UNL');
    return Object.freeze({
      position: index + 14,
      key: `${String(mapping?.color || '').toUpperCase()}_${String(mapping?.domain || '').toUpperCase()}`,
      kind: 'color',
      champion: '',
      anchor: entry.poro,
      anchorNumber: entry.number,
      color: mapping?.color || '',
      domain: mapping?.domain || '',
      poro: entry.poro
    });
  })
]);

const BOOSTER_AA_RUNE_NUMBERS = Object.freeze([
  'R01A', 'R02A', 'R03A', 'R04A', 'R05A', 'R06A'
]);
const BOOSTER_AA_RUNE_NUMBER_SET = new Set(BOOSTER_AA_RUNE_NUMBERS);

function norm(value) {
  return String(value || '').trim().toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']+/g, ' ');
}

function prefixName(card = {}) {
  return String(card.name || '').split(',')[0].trim();
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

function treatment(card = {}) {
  return String(card.collector_treatment || card.variant || card.manual_category || '').trim().toUpperCase();
}

function isUnleashedBoosterAaRune(card = {}) {
  return setCode(card) === 'UNL' && BOOSTER_AA_RUNE_NUMBER_SET.has(collectorNumberKey(card.card_number || card.number));
}

function spotLabel(spot = {}) {
  if (spot.kind === 'champion') return spot.champion;
  if (spot.kind === 'baron-runes') return 'Baron Nashor + All 6 AA Runes';
  const mapping = poroMapping(spot.poro, 'UNL');
  return `${spot.color} / ${spot.domain} — ${spot.poro} + ${mapping?.mappedCard || 'Color Hits'}`;
}

function matchesSpotAnchor(card = {}, spot = {}) {
  if (setCode(card) !== 'UNL') return false;
  if (collectorNumberKey(card.card_number || card.number) === spot.anchorNumber) return true;
  if (spot.kind === 'champion') return cardBelongsToChampion(card, spot.champion, 'UNL');
  if (spot.kind === 'baron-runes') return cardBelongsToBaron(card, 'UNL');
  return norm(prefixName(card)) === norm(spot.poro);
}

function unleashedCaseSpotForAnchor(card = {}, position = 0) {
  const wantedPosition = Number(position || card.position || 0);
  if (wantedPosition) {
    const expected = UNLEASHED_CASE_SPOTS.find(spot => spot.position === wantedPosition);
    return expected && matchesSpotAnchor(card, expected) ? expected : null;
  }
  return UNLEASHED_CASE_SPOTS.find(spot => matchesSpotAnchor(card, spot)) || null;
}

function isUnleashedCaseBreakBoard(boardRows = []) {
  const rows = [...(Array.isArray(boardRows) ? boardRows : [])]
    .sort((left, right) => Number(left.position || 0) - Number(right.position || 0));
  if (rows.length !== UNLEASHED_CASE_SPOTS.length) return false;
  return UNLEASHED_CASE_SPOTS.every((spot, index) => {
    const row = rows[index];
    return Number(row?.position || 0) === spot.position && matchesSpotAnchor(row, spot);
  });
}

function decorateUnleashedCaseBreakBoard(boardRows = []) {
  const rows = Array.isArray(boardRows) ? boardRows : [];
  if (!isUnleashedCaseBreakBoard(rows)) return rows;
  return rows.map(row => {
    const spot = unleashedCaseSpotForAnchor(row, row.position);
    return spot ? {
      ...row,
      break_spot_label: spotLabel(spot),
      break_spot_key: spot.key,
      unleashed_case_break: true
    } : row;
  });
}

function uniqueCards(cards = []) {
  const seen = new Set();
  return cards.filter(card => {
    const key = Number(card.id) || `${setCode(card)}|${collectorNumberKey(card.card_number)}|${norm(card.name)}|${treatment(card)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cardsForUnleashedCaseSpot(catalog = [], spot = {}) {
  const cards = (Array.isArray(catalog) ? catalog : []).filter(card => setCode(card) === 'UNL');
  if (spot.kind === 'champion') {
    return uniqueCards(cards.filter(card => cardBelongsToChampion(card, spot.champion, 'UNL')))
      .sort(sortChampionFamily);
  }
  if (spot.kind === 'baron-runes') {
    return uniqueCards(cards.filter(card => cardBelongsToBaron(card, 'UNL') || isUnleashedBoosterAaRune(card)))
      .sort(sortChampionFamily);
  }
  const mapping = poroMapping(spot.poro, 'UNL');
  return uniqueCards(cards.filter(card =>
    cardBelongsToPoroSpot(card, spot.poro, 'UNL')
      && norm(prefixName(card)) !== norm(mapping?.rune)
  )).sort(sortChampionFamily);
}

function bestChampionHero(family = [], spot = {}) {
  const exact = family.find(card => collectorNumberKey(card.card_number || card.number) === spot.anchorNumber);
  return exact
    || family.find(card => treatment(card) === 'SIGNATURE' || collectorNumberKey(card.card_number || card.number).endsWith('*'))
    || family.find(card => treatment(card) === 'OVERNUMBERED')
    || family[0]
    || null;
}

function bestMappedHero(family = [], name = '') {
  const cards = family.filter(card => norm(prefixName(card)) === norm(name));
  return cards.find(card => treatment(card) === 'ALTERNATE ART') || cards[0] || null;
}

function heroCardsForUnleashedCaseSpot(family = [], spot = {}, boardAnchor = {}) {
  if (spot.kind === 'champion') return uniqueCards([bestChampionHero(family, spot) || boardAnchor].filter(Boolean));
  if (spot.kind === 'baron-runes') {
    const baronCards = family.filter(card => cardBelongsToBaron(card, 'UNL'));
    const ultimate = baronCards.find(card => collectorNumberKey(card.card_number || card.number) === '238')
      || baronCards[0]
      || boardAnchor;
    const rune = family.find(isUnleashedBoosterAaRune);
    return uniqueCards([ultimate, rune].filter(Boolean));
  }
  const mapping = poroMapping(spot.poro, 'UNL');
  return uniqueCards([
    bestMappedHero(family, spot.poro) || boardAnchor,
    bestMappedHero(family, mapping?.mappedCard)
  ].filter(Boolean));
}

function bundleGroupsForUnleashedCaseSpot(family = [], spot = {}) {
  if (spot.kind === 'champion') {
    return [{
      key: `champion-${norm(spot.champion).replace(/\s+/g, '-')}`,
      label: spot.champion,
      caption: 'Complete champion family · Rare, Epic, Alternate Art, ON and signed ON',
      role: 'champion',
      cards: family
    }];
  }
  if (spot.kind === 'baron-runes') {
    return [
      {
        key: 'baron',
        label: 'Baron Nashor',
        caption: 'Every Baron Nashor printing, including the Ultimate chase',
        role: 'baron',
        cards: family.filter(card => cardBelongsToBaron(card, 'UNL'))
      },
      {
        key: 'all-aa-runes',
        label: 'All 6 Alternate-Art Runes',
        caption: 'Fury + Calm + Mind + Body + Chaos + Order booster AA Runes',
        role: 'rune',
        cards: family.filter(isUnleashedBoosterAaRune)
      }
    ].filter(group => group.cards.length);
  }
  const mapping = poroMapping(spot.poro, 'UNL');
  return [
    {
      key: 'poro',
      label: spot.poro,
      caption: `${spot.color} Poro overnumbered chase`,
      role: 'poro',
      cards: family.filter(card => norm(prefixName(card)) === norm(spot.poro))
    },
    {
      key: 'mapped-chase',
      label: mapping?.mappedCard || 'Named Color Chase',
      caption: 'Every matching booster printing pulled',
      role: 'mapped',
      cards: family.filter(card => norm(prefixName(card)) === norm(mapping?.mappedCard))
    },
    {
      key: 'rare-epic-color',
      label: `Rare + Epic ${spot.domain} Cards`,
      caption: 'Unreserved single-color Rare/Epic hits · AA Runes belong to Spot 13',
      role: 'rare-color',
      cards: family.filter(card => isUnleashedRareColorCard(card, mapping, 'UNL'))
    }
  ].filter(group => group.cards.length);
}

function buildUnleashedCaseBreakSpot(catalog = [], boardAnchor = {}) {
  const spot = unleashedCaseSpotForAnchor(boardAnchor, boardAnchor.position);
  if (!spot) return null;
  const family = cardsForUnleashedCaseSpot(catalog, spot);
  const mapping = spot.poro ? poroMapping(spot.poro, 'UNL') : null;
  return {
    profileId: UNLEASHED_CASE_PROFILE_ID,
    position: spot.position,
    key: spot.key,
    kind: spot.kind,
    color: spot.color,
    domain: spot.domain,
    anchor: spot.anchor,
    champion: spot.champion,
    champions: spot.champion ? [spot.champion] : [],
    poro: spot.poro,
    mappedCardName: mapping?.mappedCard || '',
    baron: Boolean(spot.baron),
    displayLabel: spotLabel(spot),
    listingNote: spotLabel(spot),
    family,
    heroCards: heroCardsForUnleashedCaseSpot(family, spot, boardAnchor),
    bundleGroups: bundleGroupsForUnleashedCaseSpot(family, spot)
  };
}

function chooseBoardAnchor(catalog = [], spot = {}) {
  // Board 1 uses one exact, stable chase printing for each visible position.
  // Do not silently substitute a regular family member if catalog sync has not
  // imported the intended Signature/ON/Poro/Baron anchor yet.
  const candidates = (Array.isArray(catalog) ? catalog : []).filter(card =>
    setCode(card) === 'UNL'
      && collectorNumberKey(card.card_number || card.number) === spot.anchorNumber
  );
  return [...candidates].sort((left, right) => {
    return Number(!String(left.image_path || left.image_url || '').trim()) - Number(!String(right.image_path || right.image_url || '').trim())
      || Number(left.id || 0) - Number(right.id || 0);
  })[0] || null;
}

function ensureUnleashedCaseBoardOne(database) {
  const existingMarker = database.prepare('SELECT value FROM app_metadata WHERE key = ?')
    .get(UNLEASHED_CASE_BOARD_MIGRATION_KEY)?.value;
  if (existingMarker) return { seeded: false, skipped: true, reason: 'already-installed' };

  const catalog = database.prepare(`
    SELECT * FROM cards
    WHERE UPPER(TRIM(COALESCE(game_code, ''))) = 'RIFTBOUND'
      AND UPPER(TRIM(COALESCE(set_code, ''))) = 'UNL'
  `).all();
  const anchors = UNLEASHED_CASE_SPOTS.map(spot => chooseBoardAnchor(catalog, spot));
  const missing = UNLEASHED_CASE_SPOTS
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
    `).run(UNLEASHED_CASE_BOARD_SLOT, UNLEASHED_CASE_BOARD_NAME, savedAt);
    database.prepare('DELETE FROM break_board_preset_cards WHERE slot = ?').run(UNLEASHED_CASE_BOARD_SLOT);
    const insertPreset = database.prepare(`
      INSERT INTO break_board_preset_cards (slot, position, card_id, added_at)
      VALUES (?, ?, ?, ?)
    `);
    anchors.forEach((card, index) => insertPreset.run(UNLEASHED_CASE_BOARD_SLOT, index + 1, card.id, savedAt));

    // Refresh only the loaded Board 1 draft. The live ledger, buyers, pending
    // reviews, Pull History and Orders History remain untouched.
    if (workingSlot === UNLEASHED_CASE_BOARD_SLOT) {
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
    `).run(UNLEASHED_CASE_BOARD_MIGRATION_KEY, savedAt);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return {
    seeded: true,
    slot: UNLEASHED_CASE_BOARD_SLOT,
    name: UNLEASHED_CASE_BOARD_NAME,
    savedCards: anchors.length,
    loadedWorkingBoard: workingSlot === UNLEASHED_CASE_BOARD_SLOT
  };
}

module.exports = {
  BOOSTER_AA_RUNE_NUMBERS,
  UNLEASHED_CASE_BOARD_MIGRATION_KEY,
  UNLEASHED_CASE_BOARD_NAME,
  UNLEASHED_CASE_BOARD_SLOT,
  UNLEASHED_CASE_PROFILE_ID,
  UNLEASHED_CASE_SPOTS,
  buildUnleashedCaseBreakSpot,
  bundleGroupsForUnleashedCaseSpot,
  cardsForUnleashedCaseSpot,
  chooseBoardAnchor,
  collectorNumberKey,
  decorateUnleashedCaseBreakBoard,
  ensureUnleashedCaseBoardOne,
  heroCardsForUnleashedCaseSpot,
  isUnleashedBoosterAaRune,
  isUnleashedCaseBreakBoard,
  spotLabel,
  unleashedCaseSpotForAnchor
};
