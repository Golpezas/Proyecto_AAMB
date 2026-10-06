'use strict';

const COMBINED_BOARD_SEVEN_SLOT = 7;
const COMBINED_BOARD_SEVEN_NAME = 'Vendetta + Unleashed · 56 Spots · Board 1 + Board 3';
const COMBINED_BOARD_SEVEN_MIGRATION_KEY = 'riftbound-board-7-vendetta-board1-unleashed-board3-combined-2026-09-30-v1';
const VENDETTA_SOURCE_SLOT = 1;
const UNLEASHED_SOURCE_SLOT = 3;

function setPrefixForSource(slot) {
  return Number(slot) === VENDETTA_SOURCE_SLOT ? 'VEN' : 'UNL';
}

function prefixedLabel(prefix, label, fallback) {
  const clean = String(label || fallback || '').trim();
  return `[${prefix}] ${clean}`;
}

function readMappedBoard(database, slot) {
  const preset = database.prepare(`
    SELECT slot, name, mapping_mode
    FROM break_board_presets
    WHERE slot = ?
  `).get(slot);
  if (!preset) return null;

  const anchors = database.prepare(`
    SELECT p.position, p.card_id, c.set_code, c.card_number, c.name
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
  const mappedByPosition = new Map();
  for (const row of mappedRows) {
    const position = Number(row.position);
    if (!mappedByPosition.has(position)) mappedByPosition.set(position, []);
    mappedByPosition.get(position).push(row);
  }

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

function prepareCombinedBoardSeven(database) {
  const vendetta = readMappedBoard(database, VENDETTA_SOURCE_SLOT);
  const unleashed = readMappedBoard(database, UNLEASHED_SOURCE_SLOT);
  if (!vendetta || !unleashed) {
    return {
      ready: false,
      reason: 'missing-source-board',
      missing: [
        !vendetta ? 'Board 1 (Vendetta)' : null,
        !unleashed ? 'Board 3 (Unleashed)' : null
      ].filter(Boolean)
    };
  }

  // These are the approved source layouts. Do not silently create a partial
  // combined board if one of the reusable source boards failed to install.
  if (vendetta.spots.length !== 33 || unleashed.spots.length !== 23) {
    return {
      ready: false,
      reason: 'unexpected-source-size',
      sourceCounts: { board1: vendetta.spots.length, board3: unleashed.spots.length }
    };
  }

  const combined = [];
  for (const source of [vendetta, unleashed]) {
    const prefix = setPrefixForSource(source.preset.slot);
    const offset = source.preset.slot === VENDETTA_SOURCE_SLOT ? 0 : vendetta.spots.length;
    for (const spot of source.spots) {
      combined.push({
        sourceSlot: Number(source.preset.slot),
        sourcePosition: Number(spot.position),
        position: offset + Number(spot.position),
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
    (spot.prefix === 'VEN' && spot.anchorSetCode !== 'VEN')
      || (spot.prefix === 'UNL' && spot.anchorSetCode !== 'UNL')
  );
  if (wrongSets.length) {
    return { ready: false, reason: 'source-set-mismatch', wrongSets };
  }

  return { ready: true, spots: combined };
}

function ensureCombinedBoardSeven(database) {
  const existingMarker = database.prepare('SELECT value FROM app_metadata WHERE key = ?')
    .get(COMBINED_BOARD_SEVEN_MIGRATION_KEY)?.value;
  if (existingMarker) return { seeded: false, skipped: true, reason: 'already-installed' };

  const prepared = prepareCombinedBoardSeven(database);
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
    `).run(COMBINED_BOARD_SEVEN_SLOT, COMBINED_BOARD_SEVEN_NAME, savedAt);

    database.prepare('DELETE FROM break_board_custom_spot_cards WHERE slot = ?').run(COMBINED_BOARD_SEVEN_SLOT);
    database.prepare('DELETE FROM break_board_custom_spots WHERE slot = ?').run(COMBINED_BOARD_SEVEN_SLOT);
    database.prepare('DELETE FROM break_board_preset_cards WHERE slot = ?').run(COMBINED_BOARD_SEVEN_SLOT);

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
      insertPreset.run(COMBINED_BOARD_SEVEN_SLOT, spot.position, spot.anchorCardId, savedAt);
      insertSpot.run(COMBINED_BOARD_SEVEN_SLOT, spot.position, spot.label, savedAt);
      spot.mappedCards.forEach((row, index) => insertMapped.run(
        COMBINED_BOARD_SEVEN_SLOT,
        spot.position,
        row.card_id,
        Number(row.sort_order || index + 1),
        row.addition_type || (Number(row.card_id) === spot.anchorCardId ? 'ANCHOR' : 'SEQUENCE'),
        savedAt
      ));
    }

    // If Board 7 is open in the editor, refresh only that editable draft.
    // The active/live board remains unchanged until Save Board is pressed.
    if (workingSlot === COMBINED_BOARD_SEVEN_SLOT) {
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
    `).run(COMBINED_BOARD_SEVEN_MIGRATION_KEY, savedAt);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  return {
    seeded: true,
    slot: COMBINED_BOARD_SEVEN_SLOT,
    name: COMBINED_BOARD_SEVEN_NAME,
    positions: prepared.spots.length,
    vendettaPositions: prepared.spots.filter(spot => spot.prefix === 'VEN').length,
    unleashedPositions: prepared.spots.filter(spot => spot.prefix === 'UNL').length
  };
}

module.exports = {
  COMBINED_BOARD_SEVEN_MIGRATION_KEY,
  COMBINED_BOARD_SEVEN_NAME,
  COMBINED_BOARD_SEVEN_SLOT,
  ensureCombinedBoardSeven,
  prepareCombinedBoardSeven
};
