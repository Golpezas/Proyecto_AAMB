'use strict';

const { spiritforgedCardDomains } = require('./RiftboundChampionAudit');

const SPIRITFORGED_BALANCED_COLOR_BOARD_SLOT = 10;
const SPIRITFORGED_BALANCED_COLOR_BOARD_NAME = 'Spiritforged · 7 Spots · Pure Color';
const SPIRITFORGED_BALANCED_COLOR_MIGRATION_KEY = 'spiritforged-board-10-pure-color-v3';

function lane(position, domain, color, anchorNumber, premiumNumbers) {
  return Object.freeze({
    position,
    key: `SFD_BALANCED_COLOR_${String(position).padStart(2, '0')}`,
    domain,
    color,
    label: domain === 'Mixed' ? 'Mixed Color' : `${domain} Color`,
    anchorNumber,
    premiumNumbers: Object.freeze([...premiumNumbers])
  });
}

// Pure Spiritforged color break. Each single-domain lane owns its natural
// Signatures, matching champion ONs and matching Seal ON. All twelve
// dual-domain Legend ONs stay in Mixed. The first entry is the only card shown
// by Board 10's claim popup; Irelia - Blade Dancer ON leads Mixed.
const SPIRITFORGED_BALANCED_COLOR_LANES = Object.freeze([
  lane(1, 'Fury', 'Red', '223*', ['223*', '222', '223']),
  lane(2, 'Calm', 'Green', '225*', ['224*', '225*', '226', '224', '225']),
  lane(3, 'Mind', 'Blue', '227*', ['227*', '228*', '230*', '229', '227', '228', '230']),
  lane(4, 'Body', 'Orange', '232*', ['232*', '233*', '231', '232', '233']),
  lane(5, 'Chaos', 'Purple', '235*', ['235*', '234', '235']),
  lane(6, 'Order', 'Yellow', '239*', ['236*', '237*', '239*', '238', '236', '237', '239']),
  lane(7, 'Mixed', 'Mixed', '246', ['246', '240', '241', '242', '243', '244', '245', '247', '248', '249', '250', '251'])
]);

const DOMAIN_POSITION = Object.freeze({ fury: 1, calm: 2, mind: 3, body: 4, chaos: 5, order: 6 });

function norm(value) {
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
    .replace(/^SFD[-\s]*/, '')
    .split('/')[0]
    .replace(/-STAR$/, '*')
    .replace(/^0+(?=\d)/, '');
}

function setCode(card = {}) {
  return String(card.set_code || '').trim().toUpperCase();
}

function isCommonOrUncommon(card = {}) {
  const rarity = norm(card.rarity || card.card_rarity || card.printing_rarity);
  return rarity === 'common' || rarity === 'uncommon' || rarity === 'c' || rarity === 'uc';
}

function premiumLanePosition(card = {}) {
  if (setCode(card) !== 'SFD') return 0;
  const number = collectorNumberKey(card.card_number || card.number);
  return SPIRITFORGED_BALANCED_COLOR_LANES.find(definition =>
    definition.premiumNumbers.some(expected => collectorNumberKey(expected) === number)
  )?.position || 0;
}

function numericDomainPosition(card = {}) {
  const number = Number.parseInt(collectorNumberKey(card.card_number || card.number), 10);
  if (!Number.isFinite(number)) return 0;
  if (number >= 1 && number <= 30) return 1;
  if (number <= 60) return 2;
  if (number <= 90) return 3;
  if (number <= 120) return 4;
  if (number <= 150) return 5;
  if (number <= 180) return 6;
  return 0;
}

function regularLanePosition(card = {}) {
  if (setCode(card) !== 'SFD') return 0;
  const domains = spiritforgedCardDomains(card)
    .map(norm)
    .filter(domain => DOMAIN_POSITION[domain]);
  if (new Set(domains).size === 1) return DOMAIN_POSITION[domains[0]];
  if (new Set(domains).size > 1) return 7;

  const name = norm(card.name);
  const namedDomain = Object.keys(DOMAIN_POSITION).find(domain => name === `${domain} rune`);
  if (namedDomain) return DOMAIN_POSITION[namedDomain];
  return numericDomainPosition(card) || 7;
}

function lanePositionForCard(card = {}) {
  return premiumLanePosition(card) || regularLanePosition(card);
}

function chooseAnchor(catalog = [], definition = {}) {
  const wanted = collectorNumberKey(definition.anchorNumber);
  return (Array.isArray(catalog) ? catalog : [])
    .filter(card => setCode(card) === 'SFD'
      && collectorNumberKey(card.card_number || card.number) === wanted)
    .sort((left, right) =>
      Number(Boolean(right.image_path || right.image_url)) - Number(Boolean(left.image_path || left.image_url))
      || Number(left.id || 0) - Number(right.id || 0)
    )[0] || null;
}

function uniqueCards(cards = []) {
  const seen = new Set();
  return cards.filter(card => {
    const id = Number(card?.id || 0);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function prepareSpiritforgedBalancedColorBoard(catalog = []) {
  const source = Array.isArray(catalog)
    ? catalog.filter(card => setCode(card) === 'SFD' && !isCommonOrUncommon(card))
    : [];
  const anchors = SPIRITFORGED_BALANCED_COLOR_LANES.map(definition => chooseAnchor(source, definition));
  const missing = SPIRITFORGED_BALANCED_COLOR_LANES
    .filter((_definition, index) => !anchors[index])
    .map(definition => ({ position: definition.position, label: definition.label, cardNumber: definition.anchorNumber }));
  if (missing.length) return { ready: false, reason: 'missing-anchor-cards', missing };
  if (new Set(anchors.map(card => Number(card.id))).size !== anchors.length) {
    return { ready: false, reason: 'duplicate-anchor-cards' };
  }

  const spots = SPIRITFORGED_BALANCED_COLOR_LANES.map((definition, index) => {
    const anchor = anchors[index];
    const owned = source.filter(card => lanePositionForCard(card) === definition.position);
    const cards = uniqueCards([
      anchor,
      ...definition.premiumNumbers.flatMap(number => source.filter(card =>
        collectorNumberKey(card.card_number || card.number) === collectorNumberKey(number)
      )),
      ...owned
    ]);
    return { definition, anchor, cards };
  });

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

  const unassigned = source.filter(card => !owners.has(Number(card.id)));
  if (unassigned.length) return {
    ready: false,
    reason: 'unassigned-catalog-cards',
    missing: unassigned.map(card => ({ id: card.id, name: card.name, cardNumber: card.card_number }))
  };
  return { ready: true, anchors, spots, mappedCards: owners.size };
}

function ensureSpiritforgedBalancedColorBoardTen(database) {
  const existingMarker = database.prepare('SELECT value FROM app_metadata WHERE key = ?')
    .get(SPIRITFORGED_BALANCED_COLOR_MIGRATION_KEY)?.value;
  if (existingMarker) return { seeded: false, skipped: true, reason: 'already-installed' };

  const catalog = database.prepare(`
    SELECT * FROM cards
    WHERE UPPER(TRIM(COALESCE(game_code, ''))) = 'RIFTBOUND'
      AND UPPER(TRIM(COALESCE(set_code, ''))) = 'SFD'
  `).all();
  const prepared = prepareSpiritforgedBalancedColorBoard(catalog);
  if (!prepared.ready) return { seeded: false, skipped: true, ...prepared };

  const savedAt = new Date().toISOString();
  const workingSlot = Number(database.prepare("SELECT value FROM app_metadata WHERE key = 'break-board-working-preset-slot-v1'").get()?.value || 0);
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare(`
      INSERT INTO break_board_presets (slot, name, saved_at, mapping_mode) VALUES (?, ?, ?, 'MAPPED')
      ON CONFLICT(slot) DO UPDATE SET name = excluded.name, saved_at = excluded.saved_at,
        mapping_mode = excluded.mapping_mode
    `).run(SPIRITFORGED_BALANCED_COLOR_BOARD_SLOT, SPIRITFORGED_BALANCED_COLOR_BOARD_NAME, savedAt);

    // Board 10 only. Existing boards, the active live ledger, Buyer Bags,
    // pending reviews and history are intentionally untouched.
    database.prepare('DELETE FROM break_board_custom_spot_cards WHERE slot = ?').run(SPIRITFORGED_BALANCED_COLOR_BOARD_SLOT);
    database.prepare('DELETE FROM break_board_custom_spots WHERE slot = ?').run(SPIRITFORGED_BALANCED_COLOR_BOARD_SLOT);
    database.prepare('DELETE FROM break_board_preset_cards WHERE slot = ?').run(SPIRITFORGED_BALANCED_COLOR_BOARD_SLOT);

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
      insertPreset.run(SPIRITFORGED_BALANCED_COLOR_BOARD_SLOT, spot.definition.position, spot.anchor.id, savedAt);
      insertSpot.run(SPIRITFORGED_BALANCED_COLOR_BOARD_SLOT, spot.definition.position, spot.definition.label, savedAt);
      spot.cards.forEach((card, index) => insertCard.run(
        SPIRITFORGED_BALANCED_COLOR_BOARD_SLOT,
        spot.definition.position,
        card.id,
        index + 1,
        Number(card.id) === Number(spot.anchor.id) ? 'ANCHOR' : 'SEQUENCE',
        savedAt
      ));
    }

    if (workingSlot === SPIRITFORGED_BALANCED_COLOR_BOARD_SLOT) {
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
    `).run(SPIRITFORGED_BALANCED_COLOR_MIGRATION_KEY, savedAt);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  return {
    seeded: true,
    slot: SPIRITFORGED_BALANCED_COLOR_BOARD_SLOT,
    name: SPIRITFORGED_BALANCED_COLOR_BOARD_NAME,
    savedCards: prepared.anchors.length,
    mappedCards: prepared.mappedCards,
    loadedWorkingBoard: workingSlot === SPIRITFORGED_BALANCED_COLOR_BOARD_SLOT,
    mappingMode: 'MAPPED'
  };
}

module.exports = {
  SPIRITFORGED_BALANCED_COLOR_BOARD_NAME,
  SPIRITFORGED_BALANCED_COLOR_BOARD_SLOT,
  SPIRITFORGED_BALANCED_COLOR_LANES,
  SPIRITFORGED_BALANCED_COLOR_MIGRATION_KEY,
  chooseAnchor,
  collectorNumberKey,
  ensureSpiritforgedBalancedColorBoardTen,
  lanePositionForCard,
  premiumLanePosition,
  prepareSpiritforgedBalancedColorBoard,
  regularLanePosition
};
