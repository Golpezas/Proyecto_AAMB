'use strict';

const COMBINED_BOARD_TWO_SLOT = 2;
const COMBINED_BOARD_TWO_NAME = 'Origins + Spiritforged · Board 8 + Board 4';
const COMBINED_BOARD_TWO_MIGRATION_KEY = 'riftbound-board-2-origins8-spiritforged4-runes-with-seals-2026-10-03-v2';
const ORIGINS_SOURCE_SLOT = 8;
const SPIRITFORGED_SOURCE_SLOT = 4;

function setPrefixForSource(slot) {
  return Number(slot) === ORIGINS_SOURCE_SLOT ? 'OGN' : 'SFD';
}

function prefixedLabel(prefix, label, fallback) {
  let clean = String(label || fallback || '').trim();
  if (/Seal of /i.test(clean) && !/Non-Champion/i.test(clean)) clean += ' · Non-Champion';
  return `[${prefix}] ${clean}`;
}

function readMappedBoard(database, slot, resolveDefaultMapping) {
  const preset = database.prepare(`
    SELECT slot, name, mapping_mode
    FROM break_board_presets
    WHERE slot = ?
  `).get(slot);
  if (!preset) return null;

  const anchors = database.prepare(`
    SELECT c.*, p.position, p.card_id
    FROM break_board_preset_cards p
    JOIN cards c ON c.id = p.card_id
    WHERE p.slot = ?
    ORDER BY p.position
  `).all(slot);
  if (!anchors.length) return null;

  const labels = new Map(database.prepare(`
    SELECT position, label
    FROM break_board_custom_spots
    WHERE slot = ?
  `).all(slot).map(row => [Number(row.position), String(row.label || '')]));

  const mappedRows = database.prepare(`
    SELECT position, card_id, sort_order, addition_type
    FROM break_board_custom_spot_cards
    WHERE slot = ?
    ORDER BY position, sort_order, card_id
  `).all(slot);
  if (preset.mapping_mode !== 'MAPPED') return null;
  if (!mappedRows.length) {
    const generated = resolveDefaultMapping?.(anchors) || [];
    if (generated.length !== anchors.length) return null;
    for (const spot of generated) {
      labels.set(Number(spot.position), spot.label);
      spot.cards.forEach((card, index) => mappedRows.push({
        position: Number(spot.position), card_id: Number(card.id), sort_order: index + 1,
        addition_type: index === 0 ? 'ANCHOR' : 'SEQUENCE'
      }));
    }
  }
  const mappedByPosition = new Map();
  for (const row of mappedRows) {
    const position = Number(row.position);
    if (!mappedByPosition.has(position)) mappedByPosition.set(position, []);
    mappedByPosition.get(position).push(row);
  }

  if (anchors.some(anchor => !mappedByPosition.has(Number(anchor.position)))) return null;

  return {
    preset,
    spots: anchors.map(anchor => ({
      ...anchor,
      position: Number(anchor.position),
      label: labels.get(Number(anchor.position)) || String(anchor.name || `Spot ${anchor.position}`),
      mappedCards: mappedByPosition.get(Number(anchor.position)) || [{
        position: Number(anchor.position),
        card_id: Number(anchor.card_id),
        sort_order: 1,
        addition_type: 'ANCHOR'
      }]
    }))
  };
}

function prepareCombinedBoardTwo(database, resolveDefaultMapping) {
  const origins = readMappedBoard(database, ORIGINS_SOURCE_SLOT, resolveDefaultMapping);
  const spiritforged = readMappedBoard(database, SPIRITFORGED_SOURCE_SLOT, resolveDefaultMapping);
  if (!origins || !spiritforged) {
    return {
      ready: false,
      reason: 'missing-source-board',
      missing: [
        !origins ? 'Board 8 (Origins)' : null,
        !spiritforged ? 'Board 4 (Spiritforged)' : null
      ].filter(Boolean)
    };
  }

  // These are the approved source layouts. Do not silently create a partial
  // combined board if one of the reusable source boards failed to install.
  if (origins.spots.length !== 24 || !spiritforged.spots.length) {
    return {
      ready: false,
      reason: 'unexpected-source-size',
      sourceCounts: { board8: origins.spots.length, board4: spiritforged.spots.length }
    };
  }

  const combined = [];
  for (const source of [origins, spiritforged]) {
    const prefix = setPrefixForSource(source.preset.slot);
    for (const spot of source.spots) {
      combined.push({
        sourceSlot: Number(source.preset.slot),
        sourcePosition: Number(spot.position),
        position: combined.length + 1,
        prefix,
        anchorCardId: Number(spot.card_id),
        anchorSetCode: String(spot.set_code || '').trim().toUpperCase(),
        label: prefixedLabel(prefix, spot.label, spot.name),
        mappedCards: spot.mappedCards.map(row => ({
          card_id: Number(row.card_id),
          sort_order: Number(row.sort_order || 0),
          addition_type: String(row.addition_type || 'SEQUENCE')
        }))
      });
    }
  }

  const wrongSets = combined.filter(spot =>
    (spot.prefix === 'OGN' && spot.anchorSetCode !== 'OGN')
      || (spot.prefix === 'SFD' && spot.anchorSetCode !== 'SFD')
  );
  if (wrongSets.length) {
    return { ready: false, reason: 'source-set-mismatch', wrongSets };
  }

  const ids = new Set();
  for (const spot of combined) {
    if (!spot.mappedCards.some(row => row.card_id === spot.anchorCardId)) return { ready: false, reason: 'missing-anchor' };
    for (const row of spot.mappedCards) {
      if (ids.has(row.card_id)) return { ready: false, reason: 'duplicate-card-ownership' };
      ids.add(row.card_id);
      const card = database.prepare('SELECT set_code FROM cards WHERE id = ?').get(row.card_id);
      if (String(card?.set_code || '').trim().toUpperCase() !== spot.prefix) return { ready: false, reason: 'mapped-set-mismatch' };
    }
  }
  return { ready: true, spots: combined };
}

function ensureCombinedBoardTwo(database, resolveDefaultMapping) {
  const existingMarker = database.prepare('SELECT value FROM app_metadata WHERE key = ?')
    .get(COMBINED_BOARD_TWO_MIGRATION_KEY)?.value;
  if (existingMarker) return { seeded: false, skipped: true, reason: 'already-installed' };

  const prepared = prepareCombinedBoardTwo(database, resolveDefaultMapping);
  if (!prepared.ready) return { seeded: false, skipped: true, ...prepared };

  const boardName = `Origins + Spiritforged · ${prepared.spots.length} Spots · Board 8 + Board 4`;
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
    `).run(COMBINED_BOARD_TWO_SLOT, boardName, savedAt);

    database.prepare('DELETE FROM break_board_custom_spot_cards WHERE slot = ?').run(COMBINED_BOARD_TWO_SLOT);
    database.prepare('DELETE FROM break_board_custom_spots WHERE slot = ?').run(COMBINED_BOARD_TWO_SLOT);
    database.prepare('DELETE FROM break_board_preset_cards WHERE slot = ?').run(COMBINED_BOARD_TWO_SLOT);

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
      insertPreset.run(COMBINED_BOARD_TWO_SLOT, spot.position, spot.anchorCardId, savedAt);
      insertSpot.run(COMBINED_BOARD_TWO_SLOT, spot.position, spot.label, savedAt);
      spot.mappedCards.forEach((row, index) => insertMapped.run(
        COMBINED_BOARD_TWO_SLOT,
        spot.position,
        row.card_id,
        Number(row.sort_order || index + 1),
        row.addition_type || (Number(row.card_id) === spot.anchorCardId ? 'ANCHOR' : 'SEQUENCE'),
        savedAt
      ));
    }

    // If Board 2 is open in the editor, refresh only that editable draft.
    // The active/live board remains unchanged until Save Board is pressed.
    if (workingSlot === COMBINED_BOARD_TWO_SLOT) {
      database.prepare('DELETE FROM break_board_cards').run();
      const insertWorking = database.prepare(`
        INSERT INTO break_board_cards (card_id, position, added_at)
        VALUES (?, ?, ?)
      `);
      prepared.spots.forEach(spot => insertWorking.run(spot.anchorCardId, spot.position, savedAt));
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
    `).run(COMBINED_BOARD_TWO_MIGRATION_KEY, savedAt);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  return {
    seeded: true,
    slot: COMBINED_BOARD_TWO_SLOT,
    name: boardName,
    positions: prepared.spots.length,
    originsPositions: prepared.spots.filter(spot => spot.prefix === 'OGN').length,
    spiritforgedPositions: prepared.spots.filter(spot => spot.prefix === 'SFD').length
  };
}

module.exports = {
  COMBINED_BOARD_TWO_MIGRATION_KEY,
  COMBINED_BOARD_TWO_NAME,
  COMBINED_BOARD_TWO_SLOT,
  ensureCombinedBoardTwo,
  prepareCombinedBoardTwo
};
