'use strict';

const SPIRITFORGED_CHASE_SINGLES_BOARD_SLOT = 9;
const SPIRITFORGED_CHASE_SINGLES_BOARD_NAME = 'Spiritforged · 110 Epic+ Exact Singles · No Promos';
const SPIRITFORGED_CHASE_SINGLES_MIGRATION_KEY = 'spiritforged-board-9-110-epic-plus-no-promos-2026-10-05-v1';

const SPIRITFORGED_EPIC_NUMBERS = Object.freeze([
  '027','028','029','030','057','058','059','060','087','088','089','090',
  '117','118','119','120','147','148','149','150','177','178','179','180',
  '182','184','186','188','190','191','192','194','196','198','200','202','204','206'
]);

// The 30 non-promo Alternate Arts: 24 numbered A variants + one A rune per domain.
// R01B-R06B are intentionally excluded because the user requested NO promo cards.
// Extended-art variants (118A/178A in the printing index) are not part of this AA group.
const SPIRITFORGED_ALTERNATE_ART_NUMBERS = Object.freeze([
  '020A','026A','028A','029A','050A','054A','057A','058A','082A','085A','088A','089A',
  '110A','113A','119A','120A','141A','143A','148A','149A','170A','171A','177A','180A',
  'R01A','R02A','R03A','R04A','R05A','R06A'
]);

const SPIRITFORGED_OVERNUMBERED_NUMBERS = Object.freeze(
  Array.from({ length: 30 }, (_value, index) => String(222 + index))
);

const SPIRITFORGED_SIGNATURE_NUMBERS = Object.freeze([
  '223*','224*','225*','227*','228*','230*','232*','233*','235*','236*','237*','239*'
]);

const CATEGORY_GROUPS = Object.freeze([
  Object.freeze({ key: 'EPIC', label: 'EPIC', symbol: '⭐', numbers: SPIRITFORGED_EPIC_NUMBERS }),
  Object.freeze({ key: 'AA', label: 'AA', symbol: '💣', numbers: SPIRITFORGED_ALTERNATE_ART_NUMBERS }),
  Object.freeze({ key: 'ON', label: 'ON', symbol: '🔥', numbers: SPIRITFORGED_OVERNUMBERED_NUMBERS }),
  Object.freeze({ key: 'SIG', label: 'SIG', symbol: '💎', numbers: SPIRITFORGED_SIGNATURE_NUMBERS })
]);

function collectorNumberKey(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^SFD[-\s]*/, '')
    .split('/')[0]
    .replace(/-STAR$/, '*')
    .replace(/^0+(?=\d)/, '');
}

function exactSpot(position, category, categoryLabel, symbol, collectorNumber) {
  return Object.freeze({
    position,
    key: `SFD_CHASE_SINGLE_${String(position).padStart(3, '0')}`,
    category,
    categoryLabel,
    symbol,
    collectorNumber
  });
}

let nextPosition = 1;
const SPIRITFORGED_CHASE_SINGLES_SPOTS = Object.freeze(CATEGORY_GROUPS.flatMap(group =>
  group.numbers.map(number => exactSpot(nextPosition++, group.key, group.label, group.symbol, number))
));

function matchesSpiritforgedChaseSingle(card = {}, definition = {}) {
  return String(card.set_code || '').trim().toUpperCase() === 'SFD'
    && collectorNumberKey(card.card_number || card.number) === collectorNumberKey(definition.collectorNumber);
}

function chooseSpiritforgedChaseSingle(catalog = [], definition = {}) {
  return (Array.isArray(catalog) ? catalog : [])
    .filter(card => matchesSpiritforgedChaseSingle(card, definition))
    .sort((left, right) =>
      Number(Boolean(right.image_path || right.image_url)) - Number(Boolean(left.image_path || left.image_url))
      || Number(left.id || 0) - Number(right.id || 0)
    )[0] || null;
}

function spiritforgedChaseCategory(card = {}) {
  const definition = SPIRITFORGED_CHASE_SINGLES_SPOTS.find(spot => matchesSpiritforgedChaseSingle(card, spot));
  return definition?.category || '';
}

function displayCardNumber(value) {
  const key = collectorNumberKey(value);
  if (!key) return '';
  return /^R\d+[A-Z]?$/.test(key) ? `SFD-${key}` : `SFD-${key}/221`;
}

function decorateSpiritforgedBoardNineListing(boardRows = []) {
  return (Array.isArray(boardRows) ? boardRows : []).map(card => {
    const definition = SPIRITFORGED_CHASE_SINGLES_SPOTS.find(spot => matchesSpiritforgedChaseSingle(card, spot));
    if (!definition) return card;
    const name = String(card.name || 'Spiritforged card').trim();
    return {
      ...card,
      break_spot_label: `${definition.symbol} ${name} · ${definition.categoryLabel} ${displayCardNumber(card.card_number || definition.collectorNumber)}`,
      break_listing_symbol: definition.symbol,
      break_listing_symbol_suppressed: true,
      break_popup_label: definition.categoryLabel,
      riftbound_single: true
    };
  });
}

function prepareSpiritforgedChaseSinglesBoard(catalog = []) {
  const anchors = SPIRITFORGED_CHASE_SINGLES_SPOTS.map(definition => chooseSpiritforgedChaseSingle(catalog, definition));
  const missing = SPIRITFORGED_CHASE_SINGLES_SPOTS
    .filter((_definition, index) => !anchors[index])
    .map(definition => ({
      position: definition.position,
      category: definition.category,
      cardNumber: definition.collectorNumber
    }));
  if (missing.length) return { ready: false, reason: 'missing-exact-cards', missing };
  if (new Set(anchors.map(card => Number(card.id))).size !== anchors.length) {
    return { ready: false, reason: 'duplicate-exact-cards' };
  }
  const categoryCounts = Object.fromEntries(CATEGORY_GROUPS.map(group => [group.key, group.numbers.length]));
  return { ready: true, anchors, spots: SPIRITFORGED_CHASE_SINGLES_SPOTS, categoryCounts };
}

function isSpiritforgedChaseSinglesBoard(boardRows = []) {
  const rows = [...(Array.isArray(boardRows) ? boardRows : [])]
    .sort((left, right) => Number(left.position || 0) - Number(right.position || 0));
  return rows.length === SPIRITFORGED_CHASE_SINGLES_SPOTS.length
    && SPIRITFORGED_CHASE_SINGLES_SPOTS.every((definition, index) =>
      Number(rows[index]?.position || 0) === definition.position
      && matchesSpiritforgedChaseSingle(rows[index], definition)
    );
}

function ensureSpiritforgedChaseSinglesBoardNine(database) {
  const existingMarker = database.prepare('SELECT value FROM app_metadata WHERE key = ?')
    .get(SPIRITFORGED_CHASE_SINGLES_MIGRATION_KEY)?.value;
  if (existingMarker) return { seeded: false, skipped: true, reason: 'already-installed' };

  const catalog = database.prepare(`
    SELECT * FROM cards
    WHERE UPPER(TRIM(COALESCE(game_code, ''))) = 'RIFTBOUND'
      AND UPPER(TRIM(COALESCE(set_code, ''))) = 'SFD'
  `).all();
  const prepared = prepareSpiritforgedChaseSinglesBoard(catalog);
  if (!prepared.ready) return { seeded: false, skipped: true, ...prepared };

  const savedAt = new Date().toISOString();
  const workingSlot = Number(database.prepare("SELECT value FROM app_metadata WHERE key = 'break-board-working-preset-slot-v1'").get()?.value || 0);
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare(`
      INSERT INTO break_board_presets (slot, name, saved_at, mapping_mode) VALUES (?, ?, ?, 'SINGLES')
      ON CONFLICT(slot) DO UPDATE SET name = excluded.name, saved_at = excluded.saved_at,
        mapping_mode = excluded.mapping_mode
    `).run(SPIRITFORGED_CHASE_SINGLES_BOARD_SLOT, SPIRITFORGED_CHASE_SINGLES_BOARD_NAME, savedAt);

    // Board 9 only. Existing live/pending/history snapshots and all other boards remain untouched.
    database.prepare('DELETE FROM break_board_custom_spot_cards WHERE slot = ?').run(SPIRITFORGED_CHASE_SINGLES_BOARD_SLOT);
    database.prepare('DELETE FROM break_board_custom_spots WHERE slot = ?').run(SPIRITFORGED_CHASE_SINGLES_BOARD_SLOT);
    database.prepare('DELETE FROM break_board_preset_cards WHERE slot = ?').run(SPIRITFORGED_CHASE_SINGLES_BOARD_SLOT);

    const insertPreset = database.prepare(`
      INSERT INTO break_board_preset_cards (slot, position, card_id, added_at)
      VALUES (?, ?, ?, ?)
    `);
    prepared.anchors.forEach((card, index) => insertPreset.run(
      SPIRITFORGED_CHASE_SINGLES_BOARD_SLOT,
      index + 1,
      card.id,
      savedAt
    ));

    if (workingSlot === SPIRITFORGED_CHASE_SINGLES_BOARD_SLOT) {
      database.prepare('DELETE FROM break_board_cards').run();
      const insertWorking = database.prepare('INSERT INTO break_board_cards (card_id, position, added_at) VALUES (?, ?, ?)');
      prepared.anchors.forEach((card, index) => insertWorking.run(card.id, index + 1, savedAt));
      database.prepare(`
        INSERT INTO app_metadata (key, value) VALUES ('break-board-game-v1', 'RIFTBOUND')
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run();
      database.prepare(`
        INSERT INTO app_metadata (key, value) VALUES ('break-board-working-mapping-mode-v1', 'SINGLES')
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run();
    }

    database.prepare(`
      INSERT INTO app_metadata (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(SPIRITFORGED_CHASE_SINGLES_MIGRATION_KEY, savedAt);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  return {
    seeded: true,
    slot: SPIRITFORGED_CHASE_SINGLES_BOARD_SLOT,
    name: SPIRITFORGED_CHASE_SINGLES_BOARD_NAME,
    savedCards: prepared.anchors.length,
    categoryCounts: prepared.categoryCounts,
    loadedWorkingBoard: workingSlot === SPIRITFORGED_CHASE_SINGLES_BOARD_SLOT,
    mappingMode: 'SINGLES'
  };
}

module.exports = {
  SPIRITFORGED_ALTERNATE_ART_NUMBERS,
  SPIRITFORGED_CHASE_SINGLES_BOARD_NAME,
  SPIRITFORGED_CHASE_SINGLES_BOARD_SLOT,
  SPIRITFORGED_CHASE_SINGLES_MIGRATION_KEY,
  SPIRITFORGED_CHASE_SINGLES_SPOTS,
  SPIRITFORGED_EPIC_NUMBERS,
  SPIRITFORGED_OVERNUMBERED_NUMBERS,
  SPIRITFORGED_SIGNATURE_NUMBERS,
  chooseSpiritforgedChaseSingle,
  collectorNumberKey,
  decorateSpiritforgedBoardNineListing,
  ensureSpiritforgedChaseSinglesBoardNine,
  isSpiritforgedChaseSinglesBoard,
  matchesSpiritforgedChaseSingle,
  prepareSpiritforgedChaseSinglesBoard,
  spiritforgedChaseCategory
};
