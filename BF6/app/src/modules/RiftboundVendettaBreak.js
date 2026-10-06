'use strict';

const VENDETTA_BREAK_PROFILE_ID = 'VEN_15_PRICE_BALANCED_2026_09_08_V1';
const VENDETTA_BREAK_BOARD_SLOT = 5;
const VENDETTA_BREAK_BOARD_NAME = 'Vendetta · 15 Price-Balanced Spots · 2026-09-08';
const VENDETTA_BREAK_MIGRATION_KEY = 'vendetta-board-5-15-price-balanced-2026-09-08-v1';

function spot(position, anchor, cardNumber) {
  return Object.freeze({
    position,
    key: `VEN_BALANCED_${String(position).padStart(2, '0')}`,
    anchor,
    cardNumber
  });
}

// Board anchors only. RiftboundChampionAudit owns the complete mapped family
// behind each anchor, including the price-balanced Rival ON assignments.
const VENDETTA_BREAK_SPOTS = Object.freeze([
  spot(1, 'Akali', 'VEN-189*/166'),
  spot(2, 'Renekton', 'VEN-190*/166'),
  spot(3, 'Zed', 'VEN-191*/166'),
  spot(4, 'Nasus', 'VEN-192*/166'),
  spot(5, 'Shen', 'VEN-193*/166'),
  spot(6, 'Jayce', 'VEN-194*/166'),
  spot(7, 'Mel', 'VEN-195*/166'),
  spot(8, 'Ambessa', 'VEN-196*/166'),
  spot(9, 'Kennen', 'VEN-197*/166'),
  spot(10, "Kai'Sa", 'VEN-SP1/006'),
  spot(11, 'Sona', 'VEN-SP2/006'),
  spot(12, 'Ahri', 'VEN-SP3/006'),
  spot(13, 'Sett', 'VEN-SP4/006'),
  spot(14, 'Ezreal', 'VEN-SP5/006'),
  spot(15, 'Lux', 'VEN-SP6/006')
]);

function collectorNumberKey(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^(?:VEN|VND)[-\s]*/, '')
    .split('/')[0]
    .replace(/-STAR$/, '*')
    .replace(/^0+(?=\d)/, '');
}

function matchesVendettaBreakSpot(card = {}, definition = {}) {
  return String(card.set_code || '').trim().toUpperCase() === 'VEN'
    && collectorNumberKey(card.card_number || card.number) === collectorNumberKey(definition.cardNumber);
}

function chooseVendettaBoardCard(catalog = [], definition = {}) {
  return (Array.isArray(catalog) ? catalog : [])
    .filter(card => matchesVendettaBreakSpot(card, definition))
    .sort((left, right) =>
      Number(Boolean(right.image_path || right.image_url)) - Number(Boolean(left.image_path || left.image_url))
      || Number(left.id || 0) - Number(right.id || 0)
    )[0] || null;
}

function isVendettaBreakBoard(boardRows = []) {
  const rows = [...(Array.isArray(boardRows) ? boardRows : [])]
    .sort((left, right) => Number(left.position || 0) - Number(right.position || 0));
  return rows.length === VENDETTA_BREAK_SPOTS.length
    && VENDETTA_BREAK_SPOTS.every((definition, index) =>
      Number(rows[index]?.position || 0) === definition.position
      && matchesVendettaBreakSpot(rows[index], definition)
    );
}

function ensureVendettaBreakBoardFive(database) {
  const existingMarker = database.prepare('SELECT value FROM app_metadata WHERE key = ?')
    .get(VENDETTA_BREAK_MIGRATION_KEY)?.value;
  if (existingMarker) return { seeded: false, skipped: true, reason: 'already-installed' };

  const catalog = database.prepare(`
    SELECT * FROM cards
    WHERE UPPER(TRIM(COALESCE(game_code, ''))) = 'RIFTBOUND'
      AND UPPER(TRIM(COALESCE(set_code, ''))) = 'VEN'
  `).all();
  const anchors = VENDETTA_BREAK_SPOTS.map(definition => chooseVendettaBoardCard(catalog, definition));
  const missing = VENDETTA_BREAK_SPOTS
    .filter((_definition, index) => !anchors[index])
    .map(definition => ({ position: definition.position, anchor: definition.anchor, cardNumber: definition.cardNumber }));
  if (missing.length) return { seeded: false, skipped: true, reason: 'missing-catalog-cards', missing };
  if (new Set(anchors.map(card => Number(card.id))).size !== anchors.length) {
    return { seeded: false, skipped: true, reason: 'duplicate-catalog-cards' };
  }

  const savedAt = new Date().toISOString();
  const workingSlot = Number(database.prepare("SELECT value FROM app_metadata WHERE key = 'break-board-working-preset-slot-v1'").get()?.value || 0);
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare(`
      INSERT INTO break_board_presets (slot, name, saved_at, mapping_mode) VALUES (?, ?, ?, 'MAPPED')
      ON CONFLICT(slot) DO UPDATE SET name = excluded.name, saved_at = excluded.saved_at,
        mapping_mode = excluded.mapping_mode
    `).run(VENDETTA_BREAK_BOARD_SLOT, VENDETTA_BREAK_BOARD_NAME, savedAt);
    database.prepare('DELETE FROM break_board_preset_cards WHERE slot = ?').run(VENDETTA_BREAK_BOARD_SLOT);
    const insertPreset = database.prepare(`
      INSERT INTO break_board_preset_cards (slot, position, card_id, added_at)
      VALUES (?, ?, ?, ?)
    `);
    anchors.forEach((card, index) => insertPreset.run(VENDETTA_BREAK_BOARD_SLOT, index + 1, card.id, savedAt));

    // Refresh only the editable draft when Board 5 is already loaded. The
    // active ledger, buyers, pending rounds, pulls, and histories are immutable.
    if (workingSlot === VENDETTA_BREAK_BOARD_SLOT) {
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
    `).run(VENDETTA_BREAK_MIGRATION_KEY, savedAt);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  return {
    seeded: true,
    slot: VENDETTA_BREAK_BOARD_SLOT,
    name: VENDETTA_BREAK_BOARD_NAME,
    savedCards: anchors.length,
    loadedWorkingBoard: workingSlot === VENDETTA_BREAK_BOARD_SLOT,
    mappingMode: 'MAPPED'
  };
}

module.exports = {
  VENDETTA_BREAK_BOARD_NAME,
  VENDETTA_BREAK_BOARD_SLOT,
  VENDETTA_BREAK_MIGRATION_KEY,
  VENDETTA_BREAK_PROFILE_ID,
  VENDETTA_BREAK_SPOTS,
  chooseVendettaBoardCard,
  collectorNumberKey,
  ensureVendettaBreakBoardFive,
  isVendettaBreakBoard,
  matchesVendettaBreakSpot
};
