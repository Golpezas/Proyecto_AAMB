'use strict';

const {
  cardBelongsToBaron,
  cardBelongsToChampion,
  cardBelongsToPoroSpot,
  isUnleashedRareColorCard,
  poroMapping,
  sortChampionFamily,
  spiritforgedCardDomains
} = require('./RiftboundChampionAudit');

const UNLEASHED_COLOR_BREAK_PROFILE_ID = 'UNL_COLOR_BREAK_7_V1';
const UNLEASHED_COLOR_BOARD_SLOT = 1;
const UNLEASHED_COLOR_BOARD_NAME = 'Unleashed · 7-Spot Color Break';
const UNLEASHED_COLOR_BOARD_MIGRATION_KEY = 'unleashed-color-board-1-v1';

// The first champion in every lane is the alphabetical board anchor. The
// second champion's complete Unleashed family follows that same buyer. This
// gives every color exactly two Signature/ON champion families.
const UNLEASHED_COLOR_BREAK_SPOTS = Object.freeze([
  Object.freeze({
    position: 1,
    key: 'RED_FURY',
    color: 'Red',
    domain: 'Fury',
    anchor: 'Jhin',
    anchorNumber: '226*',
    champions: Object.freeze([
      Object.freeze({ name: 'Jhin', signatureNumber: '226*', familyNumbers: Object.freeze(['181', '182', '226', '226*']) }),
      Object.freeze({ name: 'Pyke', signatureNumber: '228*', familyNumbers: Object.freeze(['185', '186', '228', '228*']) })
    ]),
    poro: 'Pouty Poro'
  }),
  Object.freeze({
    position: 2,
    key: 'GREEN_CALM',
    color: 'Green',
    domain: 'Calm',
    anchor: 'Ivern',
    anchorNumber: '233*',
    champions: Object.freeze([
      Object.freeze({ name: 'Ivern', signatureNumber: '233*', familyNumbers: Object.freeze(['195', '196', '233', '233*']) }),
      Object.freeze({ name: 'Lillia', signatureNumber: '230*', familyNumbers: Object.freeze(['189', '190', '230', '230*']) })
    ]),
    poro: 'Lonely Poro'
  }),
  Object.freeze({
    position: 3,
    key: 'ORANGE_BODY',
    color: 'Orange',
    domain: 'Body',
    anchor: 'Master Yi',
    anchorNumber: '231*',
    champions: Object.freeze([
      Object.freeze({ name: 'Master Yi', signatureNumber: '231*', familyNumbers: Object.freeze(['191', '192', '231', '231*']) }),
      Object.freeze({ name: 'Rengar', signatureNumber: '227*', familyNumbers: Object.freeze(['183', '184', '227', '227*']) })
    ]),
    poro: 'Plundering Poro'
  }),
  Object.freeze({
    position: 4,
    key: 'BLUE_MIND',
    color: 'Blue',
    domain: 'Mind',
    anchor: 'Diana',
    anchorNumber: '234*',
    champions: Object.freeze([
      Object.freeze({ name: 'Diana', signatureNumber: '234*', familyNumbers: Object.freeze(['197', '198', '234', '234*']) }),
      Object.freeze({ name: 'LeBlanc', signatureNumber: '235*', familyNumbers: Object.freeze(['199', '200', '235', '235*']) })
    ]),
    poro: 'Veteran Poro'
  }),
  Object.freeze({
    position: 5,
    key: 'PURPLE_CHAOS',
    color: 'Purple',
    domain: 'Chaos',
    anchor: "Kha'Zix",
    anchorNumber: '236*',
    champions: Object.freeze([
      Object.freeze({ name: "Kha'Zix", signatureNumber: '236*', familyNumbers: Object.freeze(['201', '202', '236', '236*']) }),
      Object.freeze({ name: 'Vex', signatureNumber: '232*', familyNumbers: Object.freeze(['193', '194', '232', '232*']) })
    ]),
    poro: 'Mystic Poro'
  }),
  Object.freeze({
    position: 6,
    key: 'YELLOW_ORDER',
    color: 'Yellow',
    domain: 'Order',
    anchor: 'Poppy',
    anchorNumber: '237*',
    champions: Object.freeze([
      Object.freeze({ name: 'Poppy', signatureNumber: '237*', familyNumbers: Object.freeze(['203', '204', '237', '237*']) }),
      Object.freeze({ name: 'Vi', signatureNumber: '229*', familyNumbers: Object.freeze(['187', '188', '229', '229*']) })
    ]),
    poro: 'Daring Poro'
  }),
  Object.freeze({
    position: 7,
    key: 'BARON_COLORLESS',
    color: 'Mixed',
    domain: 'Colorless',
    anchor: 'Baron Nashor',
    anchorNumber: '238',
    champions: Object.freeze([]),
    poro: '',
    baron: true
  })
]);

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

function cardBelongsToColorChampion(card = {}, member = {}) {
  if (setCode(card) !== 'UNL') return false;
  const number = collectorNumberKey(card.card_number || card.number);
  return (member.familyNumbers || []).includes(number)
    || cardBelongsToChampion(card, member.name, 'UNL');
}

function spotLabel(spot = {}) {
  return spot.baron
    ? 'Baron + Colorless'
    : `${spot.color} / ${spot.domain} — ${spot.champions.map(member => member.name).join(' + ')}`;
}

function matchesSpotAnchor(card = {}, spot = {}) {
  if (setCode(card) !== 'UNL') return false;
  if (collectorNumberKey(card.card_number || card.number) === spot.anchorNumber) return true;
  return spot.baron
    ? cardBelongsToBaron(card, 'UNL')
    : cardBelongsToColorChampion(card, spot.champions[0]);
}

function unleashedColorBreakSpotForAnchor(card = {}, position = 0) {
  const wantedPosition = Number(position || card.position || 0);
  if (wantedPosition) {
    const expected = UNLEASHED_COLOR_BREAK_SPOTS.find(spot => spot.position === wantedPosition);
    return expected && matchesSpotAnchor(card, expected) ? expected : null;
  }
  return UNLEASHED_COLOR_BREAK_SPOTS.find(spot => matchesSpotAnchor(card, spot)) || null;
}

function isUnleashedColorBreakBoard(boardRows = []) {
  const rows = [...(Array.isArray(boardRows) ? boardRows : [])]
    .sort((left, right) => Number(left.position || 0) - Number(right.position || 0));
  if (rows.length !== UNLEASHED_COLOR_BREAK_SPOTS.length) return false;
  return UNLEASHED_COLOR_BREAK_SPOTS.every((spot, index) => {
    const row = rows[index];
    return Number(row?.position || 0) === spot.position && matchesSpotAnchor(row, spot);
  });
}

function decorateUnleashedColorBreakBoard(boardRows = []) {
  const rows = Array.isArray(boardRows) ? boardRows : [];
  if (!isUnleashedColorBreakBoard(rows)) return rows;
  return rows.map(row => {
    const spot = unleashedColorBreakSpotForAnchor(row, row.position);
    return spot ? {
      ...row,
      break_spot_label: spotLabel(spot),
      break_spot_key: spot.key,
      unleashed_color_break: true
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

function explicitColorlessCard(card = {}) {
  if (setCode(card) !== 'UNL' || cardBelongsToBaron(card, 'UNL')) return false;
  const domains = spiritforgedCardDomains(card);
  if (domains.some(value => ['colorless', 'neutral', 'none'].includes(norm(value)))) return true;
  const typeAndName = `${card.card_type || ''} ${card.name || ''}`.toUpperCase();
  return domains.length === 0 && /BATTLEFIELD|TOKEN/.test(typeAndName);
}

function cardsForUnleashedColorSpot(catalog = [], spot = {}) {
  const unlCards = (Array.isArray(catalog) ? catalog : []).filter(card => setCode(card) === 'UNL');
  if (spot.baron) {
    return uniqueCards(unlCards.filter(card => cardBelongsToBaron(card, 'UNL') || explicitColorlessCard(card)))
      .sort(sortChampionFamily);
  }
  return uniqueCards(unlCards.filter(card =>
    spot.champions.some(member => cardBelongsToColorChampion(card, member))
      || cardBelongsToPoroSpot(card, spot.poro, 'UNL')
  )).sort(sortChampionFamily);
}

function signatureHero(cards = [], member = {}) {
  const exact = cards.find(card => setCode(card) === 'UNL' && collectorNumberKey(card.card_number) === member.signatureNumber);
  const family = cards.filter(card => cardBelongsToColorChampion(card, member));
  return exact
    || family.find(card => treatment(card) === 'SIGNATURE' || collectorNumberKey(card.card_number).endsWith('*'))
    || family[0]
    || null;
}

function heroCardsForUnleashedColorSpot(catalog = [], spot = {}, boardAnchor = {}) {
  if (spot.baron) {
    const family = cardsForUnleashedColorSpot(catalog, spot).filter(card => cardBelongsToBaron(card, 'UNL'));
    const ultimate = family.find(card => collectorNumberKey(card.card_number) === '238')
      || family.find(card => ['ULTIMATE', 'OVERNUMBERED'].includes(treatment(card)))
      || boardAnchor;
    const second = family.find(card => Number(card.id) !== Number(ultimate?.id)) || null;
    return uniqueCards([ultimate, second].filter(Boolean));
  }
  return uniqueCards(spot.champions.map(member => signatureHero(catalog, member)).filter(Boolean));
}

function bundleGroupsForUnleashedColorSpot(family = [], spot = {}) {
  if (spot.baron) {
    const baronCards = family.filter(card => cardBelongsToBaron(card, 'UNL'));
    const baronIds = new Set(baronCards.map(card => Number(card.id)));
    return [
      {
        key: 'baron',
        label: 'Baron Nashor',
        caption: 'Every Baron Nashor printing, including the Ultimate overnumbered card',
        role: 'baron',
        cards: baronCards
      },
      {
        key: 'colorless',
        label: 'Colorless / Mixed Cards',
        caption: 'Explicitly colorless Battlefields and Tokens from Unleashed',
        role: 'colorless',
        cards: family.filter(card => !baronIds.has(Number(card.id)))
      }
    ].filter(group => group.cards.length);
  }

  const mapping = poroMapping(spot.poro, 'UNL') || {
    poro: spot.poro,
    color: spot.color,
    domain: spot.domain,
    mappedCard: '',
    rune: `${spot.domain} Rune`
  };
  const groups = spot.champions.map(member => ({
    key: `champion-${norm(member.name).replace(/\s+/g, '-')}`,
    label: member.name,
    caption: 'Assigned champion family · Rare Legend, Signature Epic, ON and signed ON',
    role: 'champion',
    cards: family.filter(card => cardBelongsToColorChampion(card, member))
  }));
  groups.push(
    {
      key: 'poro',
      label: mapping.poro,
      caption: `${mapping.color} Poro overnumbered family`,
      role: 'poro',
      cards: family.filter(card => norm(prefixName(card)) === norm(mapping.poro))
    },
    {
      key: 'mapped-chase',
      label: mapping.mappedCard,
      caption: 'Named chase assigned to this color',
      role: 'mapped',
      cards: family.filter(card => norm(prefixName(card)) === norm(mapping.mappedCard))
    },
    {
      key: 'rune',
      label: `${mapping.color} ${mapping.rune}`,
      caption: 'Matching Rune / Showcase printing',
      role: 'rune',
      cards: family.filter(card => norm(prefixName(card)) === norm(mapping.rune))
    },
    {
      key: 'rare-epic-color',
      label: `Rare + Epic ${mapping.domain} Cards`,
      caption: 'Unreserved single-color Rare/Epic cards · Common/Uncommon hidden from the pull audit',
      role: 'rare-color',
      cards: family.filter(card => isUnleashedRareColorCard(card, mapping, 'UNL'))
    }
  );
  return groups.filter(group => group.cards.length);
}

function buildUnleashedColorBreakSpot(catalog = [], boardAnchor = {}) {
  const spot = unleashedColorBreakSpotForAnchor(boardAnchor, boardAnchor.position);
  if (!spot) return null;
  const family = cardsForUnleashedColorSpot(catalog, spot);
  return {
    profileId: UNLEASHED_COLOR_BREAK_PROFILE_ID,
    position: spot.position,
    key: spot.key,
    color: spot.color,
    domain: spot.domain,
    anchor: spot.anchor,
    champions: spot.champions.map(member => member.name),
    poro: spot.poro,
    baron: Boolean(spot.baron),
    displayLabel: spotLabel(spot),
    listingNote: spotLabel(spot),
    family,
    heroCards: heroCardsForUnleashedColorSpot(catalog, spot, boardAnchor),
    bundleGroups: bundleGroupsForUnleashedColorSpot(family, spot)
  };
}

function chooseBoardAnchor(catalog = [], spot = {}) {
  const candidates = catalog.filter(card => matchesSpotAnchor(card, spot));
  return [...candidates].sort((left, right) => {
    const leftExact = collectorNumberKey(left.card_number) === spot.anchorNumber ? 0 : 1;
    const rightExact = collectorNumberKey(right.card_number) === spot.anchorNumber ? 0 : 1;
    return leftExact - rightExact
      || Number(!(treatment(left) === 'SIGNATURE' || collectorNumberKey(left.card_number).endsWith('*')))
        - Number(!(treatment(right) === 'SIGNATURE' || collectorNumberKey(right.card_number).endsWith('*')))
      || String(left.card_number || '').localeCompare(String(right.card_number || ''), undefined, { numeric: true });
  })[0] || null;
}

function ensureUnleashedColorBoardOne(database) {
  const existingMarker = database.prepare('SELECT value FROM app_metadata WHERE key = ?')
    .get(UNLEASHED_COLOR_BOARD_MIGRATION_KEY)?.value;
  if (existingMarker) return { seeded: false, skipped: true, reason: 'already-installed' };

  const catalog = database.prepare(`
    SELECT * FROM cards
    WHERE UPPER(TRIM(COALESCE(game_code, ''))) = 'RIFTBOUND'
      AND UPPER(TRIM(COALESCE(set_code, ''))) = 'UNL'
  `).all();
  const anchors = UNLEASHED_COLOR_BREAK_SPOTS.map(spot => chooseBoardAnchor(catalog, spot));
  const missing = UNLEASHED_COLOR_BREAK_SPOTS
    .filter((_spot, index) => !anchors[index])
    .map(spot => spot.anchor);
  if (missing.length) return { seeded: false, skipped: true, reason: 'missing-catalog-anchors', missing };
  if (new Set(anchors.map(card => Number(card.id))).size !== anchors.length) {
    return { seeded: false, skipped: true, reason: 'duplicate-catalog-anchors' };
  }

  const savedAt = new Date().toISOString();
  const workingSlot = Number(database.prepare("SELECT value FROM app_metadata WHERE key = 'break-board-working-preset-slot-v1'").get()?.value || 0);
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare(`
      INSERT INTO break_board_presets (slot, name, saved_at) VALUES (?, ?, ?)
      ON CONFLICT(slot) DO UPDATE SET name = excluded.name, saved_at = excluded.saved_at
    `).run(UNLEASHED_COLOR_BOARD_SLOT, UNLEASHED_COLOR_BOARD_NAME, savedAt);
    database.prepare('DELETE FROM break_board_preset_cards WHERE slot = ?').run(UNLEASHED_COLOR_BOARD_SLOT);
    const insertPreset = database.prepare(`
      INSERT INTO break_board_preset_cards (slot, position, card_id, added_at)
      VALUES (?, ?, ?, ?)
    `);
    anchors.forEach((card, index) => insertPreset.run(UNLEASHED_COLOR_BOARD_SLOT, index + 1, card.id, savedAt));

    // If Board 1 is already the working draft, refresh that draft too. The
    // saved live ledger, buyers, audit choices and history are never touched.
    if (workingSlot === UNLEASHED_COLOR_BOARD_SLOT) {
      database.prepare('DELETE FROM break_board_cards').run();
      const insertWorking = database.prepare('INSERT INTO break_board_cards (card_id, position, added_at) VALUES (?, ?, ?)');
      anchors.forEach((card, index) => insertWorking.run(card.id, index + 1, savedAt));
      database.prepare(`
        INSERT INTO app_metadata (key, value) VALUES ('break-board-game-v1', 'RIFTBOUND')
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run();
    }

    database.prepare(`
      INSERT INTO app_metadata (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(UNLEASHED_COLOR_BOARD_MIGRATION_KEY, savedAt);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return {
    seeded: true,
    slot: UNLEASHED_COLOR_BOARD_SLOT,
    name: UNLEASHED_COLOR_BOARD_NAME,
    savedCards: anchors.length,
    loadedWorkingBoard: workingSlot === UNLEASHED_COLOR_BOARD_SLOT
  };
}

module.exports = {
  UNLEASHED_COLOR_BOARD_MIGRATION_KEY,
  UNLEASHED_COLOR_BOARD_NAME,
  UNLEASHED_COLOR_BOARD_SLOT,
  UNLEASHED_COLOR_BREAK_PROFILE_ID,
  UNLEASHED_COLOR_BREAK_SPOTS,
  buildUnleashedColorBreakSpot,
  bundleGroupsForUnleashedColorSpot,
  cardBelongsToColorChampion,
  cardsForUnleashedColorSpot,
  collectorNumberKey,
  decorateUnleashedColorBreakBoard,
  ensureUnleashedColorBoardOne,
  explicitColorlessCard,
  heroCardsForUnleashedColorSpot,
  isUnleashedColorBreakBoard,
  spotLabel,
  unleashedColorBreakSpotForAnchor
};
