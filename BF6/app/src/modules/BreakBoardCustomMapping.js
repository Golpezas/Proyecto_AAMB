'use strict';

const { lookupOpenRiftPrinting } = require('./OpenRiftPrintingIndex');

const MAX_CUSTOM_MAPPING_SPOTS = 200;
const MAX_CUSTOM_MAPPING_CARDS = 1200;
const MAX_CUSTOM_SPOT_LABEL_LENGTH = 180;
const CUSTOM_MAPPING_ADDITION_TYPES = Object.freeze({
  ANCHOR: 'ANCHOR',
  SEQUENCE: 'SEQUENCE',
  PLUS: 'PLUS'
});

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`${label} must be a positive whole number.`);
  return number;
}

function normalizeCustomSpotLabel(value, fallback = 'Mapped Spot') {
  const label = String(value || '').replace(/\s+/g, ' ').trim().slice(0, MAX_CUSTOM_SPOT_LABEL_LENGTH);
  return label || String(fallback || 'Mapped Spot').replace(/\s+/g, ' ').trim().slice(0, MAX_CUSTOM_SPOT_LABEL_LENGTH) || 'Mapped Spot';
}

function normalizeCustomMappingAdditionType(value, fallback = CUSTOM_MAPPING_ADDITION_TYPES.SEQUENCE) {
  const normalized = String(value || '').trim().toUpperCase();
  return Object.values(CUSTOM_MAPPING_ADDITION_TYPES).includes(normalized) ? normalized : fallback;
}

function customMappingSpotDisplayLabel(spot = {}) {
  const base = normalizeCustomSpotLabel(spot.label, 'Mapped Spot');
  const seen = new Set();
  const plusNames = [];
  for (const card of spot.cards || []) {
    if (normalizeCustomMappingAdditionType(card.mappingAdditionType ?? card.additionType) !== CUSTOM_MAPPING_ADDITION_TYPES.PLUS) continue;
    const name = String(card.name || '').replace(/\s+/g, ' ').trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key) || base.toLowerCase().includes(key)) continue;
    seen.add(key);
    plusNames.push(name);
  }
  let label = [base, ...plusNames].join(' + ');

  // Copy Listing should identify each named card inside a combo, not just the
  // anchor card. Pick the strongest presentation badge for each card name and
  // place it directly beside that name in the public/listing label. This keeps
  // mixed-rarity pairs readable: `⭐ Unchecked Power + ⚡ Sabotage`.
  const badgeRank = new Map([['💎', 0], ['🔥', 1], ['💣', 2], ['💀', 3], ['🌹', 4], ['⭐', 5], ['⚡', 6]]);
  const badgesByName = new Map();
  for (const card of spot.cards || []) {
    const fullName = String(card.name || '').replace(/\s+/g, ' ').trim();
    if (!fullName) continue;
    const presentation = customMappingCardPresentation(card);
    const badge = String(presentation.badge || '').trim();
    if (!badge) continue;
    const candidates = [fullName, String(fullName.split(',')[0] || '').trim()].filter(Boolean);
    for (const name of candidates) {
      if (!label.toLowerCase().includes(name.toLowerCase())) continue;
      const key = name.toLowerCase();
      const current = badgesByName.get(key);
      if (!current || (badgeRank.get(badge) ?? 99) < (badgeRank.get(current.badge) ?? 99)) {
        badgesByName.set(key, { name, badge });
      }
    }
  }
  const replacements = [...badgesByName.values()].sort((a, b) => b.name.length - a.name.length);
  for (const { name, badge } of replacements) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?<![💎🔥💣💀🌹⭐⚡]\\s)${escaped}`, 'gi');
    label = label.replace(pattern, match => `${badge} ${match}`);
  }
  return label;
}

function normalizedTreatment(card = {}) {
  return String(card.collector_treatment || card.variant || card.manual_category || '').trim().toUpperCase();
}

function normalizedRarity(card = {}) {
  return String(card.break_rarity || card.rarity || card.source_rarity || '').trim().toUpperCase();
}

function isUltimatePrinting(card = {}) {
  const explicitVariant = String(
    card.riftbound_art_variant || card.art_variant || card.artVariant || ''
  ).trim().toUpperCase();
  if (explicitVariant === 'ULTIMATE') return true;
  const printing = lookupOpenRiftPrinting(
    card.card_number || card.cardNumber,
    card.set_code || card.setCode
  );
  if (String(printing?.artVariant || '').toUpperCase() === 'ULTIMATE') return true;
  const treatment = normalizedTreatment(card);
  return treatment === 'ULTIMATE'
    || (normalizedRarity(card) === 'ULTIMATE' && !['SIGNATURE', 'OVERNUMBERED'].includes(treatment));
}

function customMappingCardPresentation(card = {}) {
  const treatment = normalizedTreatment(card);
  if (treatment === 'SIGNATURE') return { role: 'signature', badge: '💎', badgeLabel: 'Signature' };
  if (isUltimatePrinting(card)) return { role: 'ultimate', badge: '💀', badgeLabel: 'Ultimate' };
  if (treatment === 'OVERNUMBERED') return { role: 'overnumbered', badge: '🔥', badgeLabel: 'Overnumbered' };
  if (treatment === 'ALTERNATE ART') return { role: 'alternate-art', badge: '💣', badgeLabel: 'Alternate Art' };
  const rarity = normalizedRarity(card);
  if (rarity === 'EPIC') return { role: 'epic', badge: '⭐', badgeLabel: 'Epic' };
  if (rarity === 'RARE') return { role: 'rare', badge: '⚡', badgeLabel: 'Rare' };
  if (rarity === 'SHOWCASE') return { role: 'showcase', badge: '', badgeLabel: 'Showcase' };
  return { role: 'mapped', badge: '', badgeLabel: treatment || rarity || 'Mapped card' };
}

function ensureBreakBoardCustomMappingSchema(database) {
  database.exec(`
    -- User-owned exact-card maps for reusable saved boards. They are isolated
    -- by preset slot and never modify the official card catalog.
    CREATE TABLE IF NOT EXISTS break_board_custom_spots (
      slot INTEGER NOT NULL,
      position INTEGER NOT NULL,
      label TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(slot, position),
      FOREIGN KEY(slot) REFERENCES break_board_presets(slot) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS break_board_custom_spot_cards (
      slot INTEGER NOT NULL,
      position INTEGER NOT NULL,
      card_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL,
      addition_type TEXT NOT NULL DEFAULT 'SEQUENCE' CHECK(addition_type IN ('ANCHOR', 'SEQUENCE', 'PLUS')),
      updated_at TEXT NOT NULL,
      PRIMARY KEY(slot, position, card_id),
      UNIQUE(slot, card_id),
      FOREIGN KEY(slot, position) REFERENCES break_board_custom_spots(slot, position) ON DELETE CASCADE,
      FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE CASCADE
    );

    -- Every live box receives an immutable copy of its custom map. Editing a
    -- saved board later therefore cannot change a current or Pending Buyer Bag.
    CREATE TABLE IF NOT EXISTS break_round_custom_spots (
      round_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      label TEXT NOT NULL,
      PRIMARY KEY(round_id, position),
      FOREIGN KEY(round_id) REFERENCES break_rounds(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS break_round_custom_spot_cards (
      round_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      card_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL,
      addition_type TEXT NOT NULL DEFAULT 'SEQUENCE' CHECK(addition_type IN ('ANCHOR', 'SEQUENCE', 'PLUS')),
      PRIMARY KEY(round_id, position, card_id),
      UNIQUE(round_id, card_id),
      FOREIGN KEY(round_id, position) REFERENCES break_round_custom_spots(round_id, position) ON DELETE CASCADE,
      FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE RESTRICT
    );
  `);
  const presetColumns = new Set(database.prepare('PRAGMA table_info(break_board_custom_spot_cards)').all().map(column => column.name));
  if (!presetColumns.has('addition_type')) {
    database.exec("ALTER TABLE break_board_custom_spot_cards ADD COLUMN addition_type TEXT NOT NULL DEFAULT 'SEQUENCE' CHECK(addition_type IN ('ANCHOR', 'SEQUENCE', 'PLUS'))");
  }
  const roundColumns = new Set(database.prepare('PRAGMA table_info(break_round_custom_spot_cards)').all().map(column => column.name));
  if (!roundColumns.has('addition_type')) {
    database.exec("ALTER TABLE break_round_custom_spot_cards ADD COLUMN addition_type TEXT NOT NULL DEFAULT 'SEQUENCE' CHECK(addition_type IN ('ANCHOR', 'SEQUENCE', 'PLUS'))");
  }
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_break_board_custom_spot_cards_position
      ON break_board_custom_spot_cards(slot, position, sort_order);
    CREATE INDEX IF NOT EXISTS idx_break_round_custom_spot_cards_position
      ON break_round_custom_spot_cards(round_id, position, sort_order);
  `);
}

function mappingFromTables(database, ownerId, spotsTable, cardsTable, ownerColumn) {
  const spots = database.prepare(`
    SELECT position, label
    FROM ${spotsTable}
    WHERE ${ownerColumn} = ?
    ORDER BY position ASC
  `).all(ownerId);
  if (!spots.length) return null;
  const cards = database.prepare(`
    SELECT m.position AS mapping_position, m.sort_order AS mapping_sort_order,
      m.addition_type AS mapping_addition_type, c.*
    FROM ${cardsTable} m
    JOIN cards c ON c.id = m.card_id
    WHERE m.${ownerColumn} = ?
    ORDER BY m.position ASC, m.sort_order ASC, m.card_id ASC
  `).all(ownerId);
  const cardsByPosition = new Map();
  for (const card of cards) {
    const position = Number(card.mapping_position);
    if (!cardsByPosition.has(position)) cardsByPosition.set(position, []);
    const { mapping_position: _position, mapping_sort_order, mapping_addition_type, ...catalogCard } = card;
    cardsByPosition.get(position).push({
      ...catalogCard,
      mappingSortOrder: Number(mapping_sort_order),
      mappingAdditionType: normalizeCustomMappingAdditionType(mapping_addition_type)
    });
  }
  return {
    spots: spots.map(spot => ({
      position: Number(spot.position),
      label: String(spot.label || ''),
      cards: cardsByPosition.get(Number(spot.position)) || []
    }))
  };
}

function loadPresetCustomMapping(database, slotValue) {
  const slot = positiveInteger(slotValue, 'Board');
  return mappingFromTables(database, slot, 'break_board_custom_spots', 'break_board_custom_spot_cards', 'slot');
}

function loadRoundCustomMapping(database, roundValue) {
  const roundId = positiveInteger(roundValue, 'Break round');
  return mappingFromTables(database, roundId, 'break_round_custom_spots', 'break_round_custom_spot_cards', 'round_id');
}

function customMappingSignature(mapping) {
  if (!mapping?.spots?.length) return '';
  return JSON.stringify([...mapping.spots]
    .sort((left, right) => Number(left.position) - Number(right.position))
    .map(spot => [
      Number(spot.position),
      String(spot.label || ''),
      [...(spot.cards || [])]
        .sort((left, right) => Number(left.mappingSortOrder || 0) - Number(right.mappingSortOrder || 0) || Number(left.id) - Number(right.id))
        .map(card => [Number(card.id), normalizeCustomMappingAdditionType(card.mappingAdditionType ?? card.additionType)])
    ]));
}

function normalizedCustomMappingPayload(database, slotValue, payload = {}) {
  const slot = positiveInteger(slotValue, 'Board');
  const preset = database.prepare('SELECT slot, name, mapping_mode FROM break_board_presets WHERE slot = ?').get(slot);
  if (!preset) throw new Error(`Board ${slot} is empty. Save its card positions before creating a mapping.`);
  if (String(preset.mapping_mode || '').trim().toUpperCase() !== 'MAPPED') {
    throw new Error('This board uses Singles mode, so each position already owns only its exact displayed card.');
  }
  const anchors = database.prepare(`
    SELECT pc.position, pc.card_id, UPPER(TRIM(COALESCE(c.game_code, 'ONEPIECE'))) AS game_code,
      c.name
    FROM break_board_preset_cards pc
    JOIN cards c ON c.id = pc.card_id
    WHERE pc.slot = ?
    ORDER BY pc.position ASC
  `).all(slot);
  if (!anchors.length) throw new Error(`Board ${slot} has no saved positions.`);
  if (anchors.some(anchor => anchor.game_code !== 'RIFTBOUND')) {
    throw new Error('Custom grouped mappings are for Riftbound boards. One Piece boards already use one exact card per position.');
  }
  if (anchors.length > MAX_CUSTOM_MAPPING_SPOTS) throw new Error(`A custom map supports up to ${MAX_CUSTOM_MAPPING_SPOTS} positions.`);

  const incoming = Array.isArray(payload.spots) ? payload.spots : [];
  const byPosition = new Map();
  for (const raw of incoming) {
    const position = positiveInteger(raw?.position, 'Spot position');
    if (byPosition.has(position)) throw new Error(`Spot ${position} appears more than once.`);
    byPosition.set(position, raw);
  }
  if (byPosition.size !== anchors.length || anchors.some(anchor => !byPosition.has(Number(anchor.position)))) {
    throw new Error(`Save all ${anchors.length} Board ${slot} spots together so no buyer position is left unmapped.`);
  }

  const globalOwner = new Map();
  const normalized = anchors.map(anchor => {
    const raw = byPosition.get(Number(anchor.position));
    const incomingCards = Array.isArray(raw?.cards)
      ? raw.cards.map(card => ({
        cardId: Number(card?.cardId ?? card?.id),
        additionType: normalizeCustomMappingAdditionType(card?.additionType)
      }))
      : (Array.isArray(raw?.cardIds) ? raw.cardIds : []).map(cardId => ({
        cardId: Number(cardId),
        additionType: CUSTOM_MAPPING_ADDITION_TYPES.SEQUENCE
      }));
    const seenInSpot = new Set();
    const cards = incomingCards.filter(card => {
      if (!Number.isInteger(card.cardId) || card.cardId < 1 || seenInSpot.has(card.cardId)) return false;
      seenInSpot.add(card.cardId);
      return true;
    }).map(card => {
      const requestedType = normalizeCustomMappingAdditionType(card.additionType);
      return {
        ...card,
        additionType: card.cardId === Number(anchor.card_id)
          ? CUSTOM_MAPPING_ADDITION_TYPES.ANCHOR
          : requestedType === CUSTOM_MAPPING_ADDITION_TYPES.PLUS
            ? CUSTOM_MAPPING_ADDITION_TYPES.PLUS
            : CUSTOM_MAPPING_ADDITION_TYPES.SEQUENCE
      };
    }).sort((left, right) => Number(right.cardId === Number(anchor.card_id)) - Number(left.cardId === Number(anchor.card_id)));
    if (!cards.length) throw new Error(`Spot ${anchor.position} needs at least its displayed anchor card.`);
    if (!cards.some(card => card.cardId === Number(anchor.card_id))) {
      throw new Error(`Spot ${anchor.position} must keep its displayed anchor “${anchor.name}”. Change the position itself from Break Board if you want a different anchor.`);
    }
    for (const card of cards) {
      const existing = globalOwner.get(card.cardId);
      if (existing) throw new Error(`One card cannot belong to both Spot ${existing} and Spot ${anchor.position}. Move it instead of duplicating it.`);
      globalOwner.set(card.cardId, Number(anchor.position));
    }
    return {
      position: Number(anchor.position),
      label: normalizeCustomSpotLabel(raw?.label, anchor.name),
      anchorCardId: Number(anchor.card_id),
      cards,
      cardIds: cards.map(card => card.cardId)
    };
  });
  const totalMappedCards = globalOwner.size;
  if (totalMappedCards > MAX_CUSTOM_MAPPING_CARDS) throw new Error(`A custom map supports up to ${MAX_CUSTOM_MAPPING_CARDS} exact cards.`);

  const allCardIds = [...globalOwner.keys()];
  const placeholders = allCardIds.map(() => '?').join(', ');
  const catalogCards = database.prepare(`
    SELECT id, UPPER(TRIM(COALESCE(game_code, 'ONEPIECE'))) AS game_code
    FROM cards WHERE id IN (${placeholders})
  `).all(...allCardIds);
  if (catalogCards.length !== allCardIds.length) throw new Error('One or more mapped cards are no longer in the Card Library. Refresh the editor and try again.');
  if (catalogCards.some(card => card.game_code !== 'RIFTBOUND')) throw new Error('A Riftbound mapping cannot contain One Piece cards.');

  return { slot, preset, anchors, spots: normalized, totalCards: totalMappedCards };
}

function savePresetCustomMapping(database, slotValue, payload = {}) {
  const normalized = normalizedCustomMappingPayload(database, slotValue, payload);
  const savedAt = new Date().toISOString();
  const insertSpot = database.prepare(`
    INSERT INTO break_board_custom_spots (slot, position, label, updated_at)
    VALUES (?, ?, ?, ?)
  `);
  const insertCard = database.prepare(`
    INSERT INTO break_board_custom_spot_cards (slot, position, card_id, sort_order, addition_type, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare('DELETE FROM break_board_custom_spots WHERE slot = ?').run(normalized.slot);
    for (const spot of normalized.spots) {
      insertSpot.run(normalized.slot, spot.position, spot.label, savedAt);
      spot.cards.forEach((card, index) => insertCard.run(normalized.slot, spot.position, card.cardId, index + 1, card.additionType, savedAt));
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return {
    slot: normalized.slot,
    name: String(normalized.preset.name || `Board ${normalized.slot}`),
    spots: normalized.spots.length,
    mappedCards: normalized.totalCards,
    savedAt
  };
}

function clearPresetCustomMapping(database, slotValue) {
  const slot = positiveInteger(slotValue, 'Board');
  const previous = loadPresetCustomMapping(database, slot);
  database.prepare('DELETE FROM break_board_custom_spots WHERE slot = ?').run(slot);
  return {
    slot,
    removedSpots: previous?.spots?.length || 0,
    removedCards: previous?.spots?.reduce((total, spot) => total + spot.cards.length, 0) || 0
  };
}

function snapshotPresetCustomMapping(database, slotValue, roundValue) {
  const slot = positiveInteger(slotValue, 'Board');
  const roundId = positiveInteger(roundValue, 'Break round');
  database.prepare('DELETE FROM break_round_custom_spots WHERE round_id = ?').run(roundId);
  const mapping = loadPresetCustomMapping(database, slot);
  if (!mapping?.spots?.length) return { roundId, customized: false, spots: 0, mappedCards: 0 };
  const insertSpot = database.prepare('INSERT INTO break_round_custom_spots (round_id, position, label) VALUES (?, ?, ?)');
  const insertCard = database.prepare('INSERT INTO break_round_custom_spot_cards (round_id, position, card_id, sort_order, addition_type) VALUES (?, ?, ?, ?, ?)');
  let mappedCards = 0;
  for (const spot of mapping.spots) {
    insertSpot.run(roundId, spot.position, spot.label);
    spot.cards.forEach((card, index) => {
      insertCard.run(roundId, spot.position, card.id, index + 1, normalizeCustomMappingAdditionType(card.mappingAdditionType));
      mappedCards += 1;
    });
  }
  return { roundId, customized: true, spots: mapping.spots.length, mappedCards };
}

module.exports = {
  CUSTOM_MAPPING_ADDITION_TYPES,
  MAX_CUSTOM_MAPPING_CARDS,
  MAX_CUSTOM_MAPPING_SPOTS,
  MAX_CUSTOM_SPOT_LABEL_LENGTH,
  clearPresetCustomMapping,
  customMappingCardPresentation,
  customMappingSpotDisplayLabel,
  customMappingSignature,
  ensureBreakBoardCustomMappingSchema,
  loadPresetCustomMapping,
  loadRoundCustomMapping,
  normalizeCustomSpotLabel,
  normalizeCustomMappingAdditionType,
  normalizedCustomMappingPayload,
  savePresetCustomMapping,
  snapshotPresetCustomMapping
};
