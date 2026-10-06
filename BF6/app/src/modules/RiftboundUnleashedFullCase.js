'use strict';

const {
  UNLEASHED_EXPANDED_SPOTS,
  matchesUnleashedExpandedAnchor,
} = require('./RiftboundUnleashedExpandedBreak');
const {
  isUnleashedRareColorCard,
  sortChampionFamily,
} = require('./RiftboundChampionAudit');

const UNLEASHED_FULL_CASE_PROFILE_ID = 'UNL_26_CHARACTER_CASE_BOARD_V8';
const UNLEASHED_FULL_CASE_BOARD_SLOT = 5;
const UNLEASHED_FULL_CASE_BOARD_NAME = 'Unleashed · 26 Spots · Character Case Break';
const UNLEASHED_FULL_CASE_MIGRATION_KEY = 'unleashed-board-5-26-character-case-2026-09-21-v8';

const BOOSTER_AA_RUNE_NUMBERS = Object.freeze([
  'R01A', 'R02A', 'R03A', 'R04A', 'R05A', 'R06A'
]);

function collectorNumberKey(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^UNL[-\s]*/, '')
    .split('/')[0]
    .replace(/-STAR$/, '*')
    .replace(/^0+(?=\d)/, '');
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9']+/g, ' ')
    .trim();
}

function cardName(card = {}) {
  return normalizeName(String(card.name || '').split(',')[0]);
}

function cardMatchesMember(card = {}, member = '') {
  const wanted = normalizeName(member);
  return normalizeName(card.name) === wanted || cardName(card) === wanted;
}

function setCode(card = {}) {
  return String(card.set_code || '').trim().toUpperCase();
}

function cardType(card = {}) {
  return String(card.card_type || card.type || card.cardType || '').trim().toUpperCase();
}

function cardRarity(card = {}) {
  return String(card.break_rarity || card.rarity || card.source_rarity || '').trim().toUpperCase();
}

function isPromotionalPrinting(card = {}) {
  return [card.rarity, card.source_rarity, card.collector_treatment, card.variant, card.manual_category]
    .some(value => /\bPROMO(?:TIONAL)?\b/i.test(String(value || '')));
}

function isGearOrSpell(card = {}) {
  return /\b(?:GEAR|SPELL)\b/.test(cardType(card));
}

function remapSpot(base, position, overrides = {}) {
  return Object.freeze({
    ...base,
    ...overrides,
    position,
    ownedNumbers: Object.freeze([...(overrides.ownedNumbers ?? base.ownedNumbers ?? [])]),
    members: Object.freeze([...(overrides.members ?? base.members ?? [])]),
    poolNumbers: Object.freeze([...(overrides.poolNumbers ?? base.poolNumbers ?? [])])
  });
}

const splitChampionSpots = UNLEASHED_EXPANDED_SPOTS.filter(spot => spot.kind === 'champion-split');

function combinedChampionSpot(position, champion) {
  const signature = splitChampionSpots.find(spot => spot.champion === champion && spot.mode === 'signature');
  const overnumbered = splitChampionSpots.find(spot => spot.champion === champion && spot.mode === 'overnumbered');
  if (!signature || !overnumbered) throw new Error(`Missing SIG/ON pair for ${champion}.`);
  return remapSpot(signature, position, {
    key: `BOARD5_${normalizeName(champion).replace(/\s+/g, '_').toUpperCase()}`,
    mode: 'combined',
    label: champion,
    // A named champion listing owns the complete eight-card booster family:
    // Signature, Overnumbered, two Alternate Arts, two Epics, and two Rares.
    ownedNumbers: signature.allKnownNumbers,
    rewardTitle: champion.toUpperCase(),
    rewardCaption: 'COMPLETE CHAMPION FAMILY · SIG + ON + 2 AA + 2 EPIC + 2 RARE'
  });
}

function bundleSpot(position, options = {}) {
  return Object.freeze({
    position,
    key: options.key || `BOARD5_${String(position).padStart(2, '0')}`,
    kind: options.kind || 'named-bundle',
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
    rewardTitle: options.rewardTitle || String(options.label || '').toUpperCase(),
    rewardCaption: options.rewardCaption || 'EVERY MAPPED PRINTING PULLED IS YOURS'
  });
}

// Exact 26-position order supplied by the breaker. Labels intentionally match
// the Whatnot listings, including slash bundles and the two catch-all spots.
const UNLEASHED_FULL_CASE_SPOTS = Object.freeze([
  bundleSpot(1, {
    key: 'BOARD5_BARON', kind: 'baron', label: 'Baron',
    anchor: 'Baron Nashor', anchorNumber: '238', members: ['Baron Nashor'],
    rewardCaption: 'EVERY BARON NASHOR PRINTING'
  }),
  combinedChampionSpot(2, 'Master Yi'),
  combinedChampionSpot(3, 'Vex'),
  combinedChampionSpot(4, 'Ivern'),
  combinedChampionSpot(5, "Kha'Zix"),
  combinedChampionSpot(6, 'Vi'),
  combinedChampionSpot(7, 'Jhin'),
  combinedChampionSpot(8, 'Pyke'),
  combinedChampionSpot(9, 'LeBlanc'),
  combinedChampionSpot(10, 'Diana'),
  combinedChampionSpot(11, 'Poppy'),
  combinedChampionSpot(12, 'Rengar'),
  combinedChampionSpot(13, 'Lillia'),
  bundleSpot(14, {
    key: 'BOARD5_ELDER_DRAGON', label: 'Elder Dragon',
    anchor: 'Elder Dragon', anchorNumber: '118A', members: ['Elder Dragon']
  }),
  bundleSpot(15, {
    key: 'BOARD5_LONELY_PORO', kind: 'poro-rares', label: 'Lonely Poro',
    anchor: 'Lonely Poro', anchorNumber: '221', poro: 'Lonely Poro', color: 'Green', domain: 'Calm',
    members: ['Lonely Poro'], rewardCaption: 'PORO + ALL UNRESERVED RARE CALM UNITS'
  }),
  bundleSpot(16, {
    key: 'BOARD5_RED_BRAMBLEBACK_FAEFOLK', label: 'Red Brambleback / Irresistible Faefolk',
    anchor: 'Red Brambleback', anchorNumber: '029A',
    members: ['Red Brambleback', 'Irresistible Faefolk']
  }),
  bundleSpot(17, {
    key: 'BOARD5_PLUNDERING_PORO', kind: 'poro-rares', label: 'Plundering Poro',
    anchor: 'Plundering Poro', anchorNumber: '222', poro: 'Plundering Poro', color: 'Blue', domain: 'Mind',
    members: ['Plundering Poro'], rewardCaption: 'PORO + ALL UNRESERVED RARE MIND UNITS'
  }),
  bundleSpot(18, {
    key: 'BOARD5_ALPHA_VOX_ARACHNOID', label: 'Alpha Wildclaw / Inviolus Vox / Arachnoid Horror',
    anchor: 'Alpha Wildclaw', anchorNumber: '057',
    members: ['Alpha Wildclaw', 'Inviolus Vox', 'Arachnoid Horror']
  }),
  bundleSpot(19, {
    key: 'BOARD5_POUTY_PORO', kind: 'poro-rares', label: 'Pouty Poro',
    anchor: 'Pouty Poro', anchorNumber: '220', poro: 'Pouty Poro', color: 'Red', domain: 'Fury',
    members: ['Pouty Poro'], rewardCaption: 'PORO + ALL UNRESERVED RARE FURY UNITS'
  }),
  bundleSpot(20, {
    key: 'BOARD5_ALL_RUNE_ALTS', kind: 'runes', label: 'All Rune Alts',
    anchor: 'Fury Rune', anchorNumber: 'R01A', poolNumbers: BOOSTER_AA_RUNE_NUMBERS,
    rewardCaption: 'ALL SIX BOOSTER ALTERNATE-ART RUNES'
  }),
  bundleSpot(21, {
    key: 'BOARD5_ALL_GEARS_SPELLS', kind: 'gear-spell', label: 'All Gears / All Spells',
    anchor: 'Gutter Palace', anchorNumber: '088', members: [],
    rewardCaption: 'UNRESERVED RARE / EPIC GEAR AND SPELL HITS · COMMON / UNCOMMON EXCLUDED'
  }),
  bundleSpot(22, {
    key: 'BOARD5_VETERAN_PORO', kind: 'poro-rares', label: 'Veteran Poro',
    anchor: 'Veteran Poro', anchorNumber: '223', poro: 'Veteran Poro', color: 'Orange', domain: 'Body',
    members: ['Veteran Poro'], rewardCaption: 'PORO + ALL UNRESERVED RARE BODY UNITS'
  }),
  bundleSpot(23, {
    key: 'BOARD5_MYSTIC_PORO', kind: 'poro-rares', label: 'Mystic Poro',
    anchor: 'Mystic Poro', anchorNumber: '224', poro: 'Mystic Poro', color: 'Purple', domain: 'Chaos',
    members: ['Mystic Poro'], rewardCaption: 'PORO + ALL UNRESERVED RARE CHAOS UNITS'
  }),
  bundleSpot(24, {
    key: 'BOARD5_VILEMAW', label: 'Vilemaw',
    anchor: 'Vilemaw', anchorNumber: '060A', members: ['Vilemaw']
  }),
  bundleSpot(25, {
    key: 'BOARD5_DARING_PORO', kind: 'poro-rares', label: 'Daring Poro',
    anchor: 'Daring Poro', anchorNumber: '225', poro: 'Daring Poro', color: 'Yellow', domain: 'Order',
    members: ['Daring Poro'], rewardCaption: 'PORO + ALL UNRESERVED RARE ORDER UNITS'
  }),
  bundleSpot(26, {
    key: 'BOARD5_RIFT_HERALD_BLUE_SENTINEL', label: 'Rift Herald / Blue Sentinel',
    anchor: 'Rift Herald', anchorNumber: '179A', members: ['Rift Herald', 'Blue Sentinel']
  })
]);

const CHAMPION_NUMBER_SET = new Set(
  UNLEASHED_FULL_CASE_SPOTS
    .filter(spot => spot.kind === 'champion-split')
    .flatMap(spot => spot.ownedNumbers)
    .map(collectorNumberKey)
);

function matchesUnleashedFullCaseAnchor(card = {}, definition = {}) {
  if (definition.anchorNumber) return matchesUnleashedExpandedAnchor(card, definition);
  return setCode(card) === 'UNL' && cardName(card) === normalizeName(definition.anchor);
}

function chooseUnleashedFullCaseAnchor(catalog = [], definition = {}) {
  return [...(Array.isArray(catalog) ? catalog : [])]
    .filter(card => matchesUnleashedFullCaseAnchor(card, definition))
    .sort((left, right) =>
      Number(!String(left.image_path || left.image_url || '').trim()) - Number(!String(right.image_path || right.image_url || '').trim())
      || Number(left.id || 0) - Number(right.id || 0)
    )[0] || null;
}

function isPoroRareCollectible(card = {}, definition = {}) {
  return definition.kind === 'poro-rares'
    && cardRarity(card) === 'RARE'
    && !isGearOrSpell(card)
    && isUnleashedRareColorCard(card, { domain: definition.domain }, 'UNL');
}

function isRareOrHigherCollectible(card = {}) {
  const rarityValues = [card.break_rarity, card.rarity, card.source_rarity]
    .map(value => String(value || '').trim().toUpperCase());
  const treatment = [card.collector_treatment, card.variant, card.manual_category]
    .map(value => String(value || '').trim().toUpperCase())
    .join(' ');
  return rarityValues.some(value => ['RARE', 'EPIC', 'SHOWCASE', 'ULTIMATE'].includes(value))
    || /(SIGNATURE|OVERNUMBERED|ALTERNATE ART|SHOWCASE)/.test(treatment);
}

function cardBelongsToUnleashedFullCaseSpot(card = {}, definition = {}) {
  if (setCode(card) !== 'UNL' || !definition || isPromotionalPrinting(card)) return false;
  const number = collectorNumberKey(card.card_number || card.number);
  // Always retain the exact selected anchor, even when an older catalog row is
  // missing its card-type metadata.
  if (matchesUnleashedFullCaseAnchor(card, definition)) return true;
  if (definition.kind === 'champion-split') {
    return definition.ownedNumbers.map(collectorNumberKey).includes(number);
  }
  if (definition.kind === 'runes') {
    return definition.poolNumbers.map(collectorNumberKey).includes(number);
  }
  if (definition.kind === 'gear-spell') {
    // Character-family Spells/Gear stay with their named champion. Everything
    // else must be a Rare-or-higher Gear/Spell hit. Common and Uncommon bulk
    // never enters the purchased Gear/Spell position.
    return isGearOrSpell(card)
      && isRareOrHigherCollectible(card)
      && !CHAMPION_NUMBER_SET.has(number);
  }
  if (definition.kind === 'poro-rares') {
    return definition.members.some(member => cardMatchesMember(card, member))
      || isPoroRareCollectible(card, definition);
  }
  return definition.members.some(member => cardMatchesMember(card, member));
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

function cardsForUnleashedFullCaseSpot(catalog = [], definition = {}) {
  return uniqueCards((Array.isArray(catalog) ? catalog : [])
    .filter(card => cardBelongsToUnleashedFullCaseSpot(card, definition)))
    .sort(sortChampionFamily);
}

function isPlainRare(card = {}) {
  const rarity = cardRarity(card);
  const treatment = String(card.collector_treatment || card.variant || card.manual_category || '').trim().toUpperCase();
  return rarity === 'RARE' && !/(SIGNATURE|OVERNUMBERED|ALTERNATE ART|SHOWCASE|PROMO)/.test(treatment);
}

function isPlainCommonOrUncommon(card = {}) {
  const rarity = cardRarity(card);
  const treatment = String(card.collector_treatment || card.variant || card.manual_category || '').trim().toUpperCase();
  return ['COMMON', 'UNCOMMON'].includes(rarity)
    && !/(SIGNATURE|OVERNUMBERED|ALTERNATE ART|SHOWCASE|PROMO)/.test(treatment);
}

function fullCaseSpotLabel(spot = {}) {
  return spot.label || spot.champion || spot.anchor || 'Unleashed Spot';
}

function anchorFirst(cards = [], anchor = {}) {
  return [...cards].sort((left, right) =>
    Number(Number(right.id) === Number(anchor.id)) - Number(Number(left.id) === Number(anchor.id))
  );
}

function prepareUnleashedFullCaseBoard(catalog = []) {
  const prepared = UNLEASHED_FULL_CASE_SPOTS.map(definition => {
    const anchor = chooseUnleashedFullCaseAnchor(catalog, definition);
    const cards = anchor ? anchorFirst(cardsForUnleashedFullCaseSpot(catalog, definition), anchor) : [];
    return { definition, anchor, cards };
  });
  const missing = prepared
    .filter(spot => !spot.anchor || !spot.cards.some(card => Number(card.id) === Number(spot.anchor.id)))
    .map(spot => ({
      position: spot.definition.position,
      anchor: spot.definition.anchor,
      cardNumber: spot.definition.anchorNumber
    }));
  if (missing.length) return { ready: false, reason: 'missing-catalog-cards', missing };

  const owners = new Map();
  const conflicts = [];
  for (const spot of prepared) {
    for (const card of spot.cards) {
      const existing = owners.get(Number(card.id));
      if (existing) conflicts.push({ cardId: Number(card.id), positions: [existing, spot.definition.position] });
      else owners.set(Number(card.id), spot.definition.position);
    }
  }
  if (conflicts.length) return { ready: false, reason: 'duplicate-card-ownership', conflicts };

  return {
    ready: true,
    spots: prepared,
    anchors: prepared.map(spot => spot.anchor),
    mappedCards: owners.size
  };
}

function isUnleashedFullCaseBreakBoard(boardRows = []) {
  const rows = [...(Array.isArray(boardRows) ? boardRows : [])]
    .sort((left, right) => Number(left.position || 0) - Number(right.position || 0));
  return rows.length === UNLEASHED_FULL_CASE_SPOTS.length
    && UNLEASHED_FULL_CASE_SPOTS.every((definition, index) =>
      Number(rows[index]?.position || 0) === definition.position
      && matchesUnleashedFullCaseAnchor(rows[index], definition)
    );
}

function ensureUnleashedFullCaseBoardFive(database) {
  const existingMarker = database.prepare('SELECT value FROM app_metadata WHERE key = ?')
    .get(UNLEASHED_FULL_CASE_MIGRATION_KEY)?.value;
  if (existingMarker) return { seeded: false, skipped: true, reason: 'already-installed' };

  const catalog = database.prepare(`
    SELECT * FROM cards
    WHERE UPPER(TRIM(COALESCE(game_code, ''))) = 'RIFTBOUND'
      AND UPPER(TRIM(COALESCE(set_code, ''))) = 'UNL'
  `).all();
  const prepared = prepareUnleashedFullCaseBoard(catalog);
  if (!prepared.ready) return { seeded: false, skipped: true, ...prepared };

  const savedAt = new Date().toISOString();
  const workingSlot = Number(database.prepare("SELECT value FROM app_metadata WHERE key = 'break-board-working-preset-slot-v1'").get()?.value || 0);
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare(`
      INSERT INTO break_board_presets (slot, name, saved_at, mapping_mode) VALUES (?, ?, ?, 'MAPPED')
      ON CONFLICT(slot) DO UPDATE SET name = excluded.name, saved_at = excluded.saved_at,
        mapping_mode = excluded.mapping_mode
    `).run(UNLEASHED_FULL_CASE_BOARD_SLOT, UNLEASHED_FULL_CASE_BOARD_NAME, savedAt);

    // Only saved Board 5 is replaced. Active Buyer Bags, pending rounds and
    // completed history are intentionally left untouched.
    database.prepare('DELETE FROM break_board_custom_spot_cards WHERE slot = ?').run(UNLEASHED_FULL_CASE_BOARD_SLOT);
    database.prepare('DELETE FROM break_board_custom_spots WHERE slot = ?').run(UNLEASHED_FULL_CASE_BOARD_SLOT);
    database.prepare('DELETE FROM break_board_preset_cards WHERE slot = ?').run(UNLEASHED_FULL_CASE_BOARD_SLOT);

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
      insertPreset.run(UNLEASHED_FULL_CASE_BOARD_SLOT, spot.definition.position, spot.anchor.id, savedAt);
      insertSpot.run(UNLEASHED_FULL_CASE_BOARD_SLOT, spot.definition.position, fullCaseSpotLabel(spot.definition), savedAt);
      spot.cards.forEach((card, index) => insertCard.run(
        UNLEASHED_FULL_CASE_BOARD_SLOT,
        spot.definition.position,
        card.id,
        index + 1,
        Number(card.id) === Number(spot.anchor.id) ? 'ANCHOR' : 'SEQUENCE',
        savedAt
      ));
    }

    if (workingSlot === UNLEASHED_FULL_CASE_BOARD_SLOT) {
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
    `).run(UNLEASHED_FULL_CASE_MIGRATION_KEY, savedAt);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  return {
    seeded: true,
    slot: UNLEASHED_FULL_CASE_BOARD_SLOT,
    name: UNLEASHED_FULL_CASE_BOARD_NAME,
    savedCards: prepared.anchors.length,
    mappedCards: prepared.mappedCards,
    loadedWorkingBoard: workingSlot === UNLEASHED_FULL_CASE_BOARD_SLOT,
    mappingMode: 'MAPPED'
  };
}

module.exports = {
  UNLEASHED_FULL_CASE_BOARD_NAME,
  UNLEASHED_FULL_CASE_BOARD_SLOT,
  UNLEASHED_FULL_CASE_MIGRATION_KEY,
  UNLEASHED_FULL_CASE_PROFILE_ID,
  UNLEASHED_FULL_CASE_SPOTS,
  cardBelongsToUnleashedFullCaseSpot,
  cardsForUnleashedFullCaseSpot,
  chooseUnleashedFullCaseAnchor,
  ensureUnleashedFullCaseBoardFive,
  fullCaseSpotLabel,
  isGearOrSpell,
  isPoroRareCollectible,
  isRareOrHigherCollectible,
  isUnleashedFullCaseBreakBoard,
  isPlainCommonOrUncommon,
  isPlainRare,
  matchesUnleashedFullCaseAnchor,
  prepareUnleashedFullCaseBoard
};
