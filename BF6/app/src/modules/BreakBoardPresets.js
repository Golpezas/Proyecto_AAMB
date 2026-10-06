const BREAK_BOARD_PRESET_CAPACITY = 10;
const BREAK_BOARD_PRESET_SLOTS = Object.freeze(
  Array.from({ length: BREAK_BOARD_PRESET_CAPACITY }, (_value, index) => index + 1)
);

function normalizePresetSlot(value) {
  const slot = Number(value);
  if (!BREAK_BOARD_PRESET_SLOTS.includes(slot)) throw new Error(`Choose one of the ${BREAK_BOARD_PRESET_CAPACITY} saved board setups.`);
  return slot;
}

function ensureBreakBoardPresetCapacity(database) {
  const schema = String(database.prepare(`
    SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'break_board_presets'
  `).get()?.sql || '');
  if (!schema) return { migrated: false, reason: 'table-missing' };

  const upperBound = Number(schema.match(/CHECK\s*\(\s*slot\s+BETWEEN\s+1\s+AND\s+(\d+)\s*\)/i)?.[1] || 0);
  if (!upperBound || upperBound >= BREAK_BOARD_PRESET_CAPACITY) {
    return { migrated: false, reason: 'capacity-ready', capacity: upperBound || null };
  }

  const foreignKeysEnabled = Number(database.prepare('PRAGMA foreign_keys').get()?.foreign_keys || 0) === 1;
  database.exec('PRAGMA foreign_keys = OFF');
  database.exec('BEGIN IMMEDIATE');
  try {
    database.exec(`
      ALTER TABLE break_board_preset_cards RENAME TO break_board_preset_cards_pre_v0291;
      ALTER TABLE break_board_presets RENAME TO break_board_presets_pre_v0291;

      CREATE TABLE break_board_presets (
        slot INTEGER PRIMARY KEY CHECK(slot BETWEEN 1 AND 10),
        name TEXT NOT NULL DEFAULT '',
        saved_at TEXT NOT NULL,
        mapping_mode TEXT NOT NULL DEFAULT 'MAPPED' CHECK(mapping_mode IN ('MAPPED', 'SINGLES'))
      );

      CREATE TABLE break_board_preset_cards (
        slot INTEGER NOT NULL,
        position INTEGER NOT NULL,
        card_id INTEGER NOT NULL,
        added_at TEXT NOT NULL,
        PRIMARY KEY(slot, position),
        UNIQUE(slot, card_id),
        FOREIGN KEY(slot) REFERENCES break_board_presets(slot) ON DELETE CASCADE,
        FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE CASCADE
      );

      INSERT INTO break_board_presets (slot, name, saved_at, mapping_mode)
      SELECT slot, name, saved_at, mapping_mode FROM break_board_presets_pre_v0291;

      INSERT INTO break_board_preset_cards (slot, position, card_id, added_at)
      SELECT slot, position, card_id, added_at FROM break_board_preset_cards_pre_v0291;

      DROP TABLE break_board_preset_cards_pre_v0291;
      DROP TABLE break_board_presets_pre_v0291;
    `);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  } finally {
    database.exec(`PRAGMA foreign_keys = ${foreignKeysEnabled ? 'ON' : 'OFF'}`);
  }

  const violation = database.prepare('PRAGMA foreign_key_check(break_board_preset_cards)').get();
  if (violation) throw new Error('Saved board expansion failed its foreign-key safety check.');
  return { migrated: true, fromCapacity: upperBound, capacity: BREAK_BOARD_PRESET_CAPACITY };
}

function normalizePresetName(value, fallback = 'Saved board') {
  const name = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return name || fallback;
}

function sameBoardOrder(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return left.every((card, index) => Number(card.card_id) === Number(right[index]?.card_id)
    && Number(card.position) === Number(right[index]?.position));
}

function resolveWorkingPresetSlot(value, matchingSlots = []) {
  const storedSlot = Number(value);
  if (BREAK_BOARD_PRESET_SLOTS.includes(storedSlot)) return storedSlot;
  return matchingSlots.map(Number).find(slot => BREAK_BOARD_PRESET_SLOTS.includes(slot)) || BREAK_BOARD_PRESET_SLOTS[0];
}

module.exports = {
  BREAK_BOARD_PRESET_CAPACITY,
  BREAK_BOARD_PRESET_SLOTS,
  ensureBreakBoardPresetCapacity,
  normalizePresetName,
  normalizePresetSlot,
  resolveWorkingPresetSlot,
  sameBoardOrder
};
