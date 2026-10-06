'use strict';

const VENDETTA_CHASE_SINGLES_BOARD_SLOT = 10;
const VENDETTA_CHASE_SINGLES_BOARD_NAME = 'Vendetta · 106 Exact Chase Singles · No Rares';
const VENDETTA_CHASE_SINGLES_MIGRATION_KEY = 'vendetta-board-10-106-exact-chase-singles-2026-09-23-v2';

const VENDETTA_SIGNATURE_NUMBERS = Object.freeze(
  Array.from({ length: 9 }, (_value, index) => `${189 + index}*`)
);
const VENDETTA_OVERNUMBERED_NUMBERS = Object.freeze(
  Array.from({ length: 31 }, (_value, index) => String(167 + index))
);
const VENDETTA_ALTERNATE_ART_NUMBERS = Object.freeze([
  '019A', '021A', '023A', '038A', '041A', '042A', '046A',
  '063A', '068A', '069A', '069B', '084A', '088A', '092A',
  '110A', '112A', '113A', '135A', '136A', '138A', '139A',
  'R01A', 'R01B', 'R02A', 'R02B', 'R03A', 'R03B',
  'R04A', 'R04B', 'R05A', 'R05B', 'R06A', 'R06B'
]);
// Astral Heron (044) is deliberately removed from this regular-Epic group so
// it can appear once, by itself, in the final named chase position.
const VENDETTA_EPIC_NUMBERS = Object.freeze([
  '021', '022', '023', '045', '046', '067', '068', '069',
  '090', '091', '092', '113', '114', '115', '136', '137',
  '138', '140', '142', '144', '146', '148', '150', '152',
  '154', '156'
]);
const VENDETTA_SP_NUMBERS = Object.freeze(
  Array.from({ length: 6 }, (_value, index) => `SP${index + 1}`)
);
const VENDETTA_ASTRAL_HERON_NUMBER = '044';
const VENDETTA_BOARD_TEN_EPIC_SYMBOL = '⭐';
const VENDETTA_BOARD_TEN_RARE_SYMBOL = '⚡';
const VENDETTA_BOARD_TEN_SP_SYMBOL = '🌹';
const VENDETTA_BOARD_TEN_POPUP_EFFECTS = Object.freeze({
  EPIC: 'EPIC_HEART',
  RARE: 'RARE_CONSTRUCTION',
  SP: 'SP_ROSE'
});

const CATEGORY_GROUPS = Object.freeze([
  Object.freeze({ key: 'SIG', label: 'Signature', numbers: VENDETTA_SIGNATURE_NUMBERS }),
  Object.freeze({ key: 'ON', label: 'Overnumbered', numbers: VENDETTA_OVERNUMBERED_NUMBERS }),
  Object.freeze({ key: 'AA', label: 'Alternate Art', numbers: VENDETTA_ALTERNATE_ART_NUMBERS }),
  Object.freeze({ key: 'EPIC', label: 'Epic', numbers: VENDETTA_EPIC_NUMBERS }),
  Object.freeze({ key: 'SP', label: 'SP', numbers: VENDETTA_SP_NUMBERS }),
  Object.freeze({ key: 'ASTRAL', label: 'Astral Heron', numbers: Object.freeze([VENDETTA_ASTRAL_HERON_NUMBER]) })
]);

function collectorNumberKey(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^VEN[-\s]*/, '')
    .split('/')[0]
    .replace(/-STAR$/, '*')
    .replace(/^0+(?=\d)/, '');
}

function exactSpot(position, category, categoryLabel, collectorNumber) {
  return Object.freeze({
    position,
    key: `VEN_CHASE_SINGLE_${String(position).padStart(3, '0')}`,
    category,
    categoryLabel,
    collectorNumber,
    label: `${categoryLabel} · VEN-${collectorNumber}`
  });
}

let nextPosition = 1;
const VENDETTA_CHASE_SINGLES_SPOTS = Object.freeze(CATEGORY_GROUPS.flatMap(group =>
  group.numbers.map(number => exactSpot(nextPosition++, group.key, group.label, number))
));

function matchesVendettaChaseSingle(card = {}, definition = {}) {
  return String(card.set_code || '').trim().toUpperCase() === 'VEN'
    && collectorNumberKey(card.card_number || card.number) === collectorNumberKey(definition.collectorNumber);
}

function chooseVendettaChaseSingle(catalog = [], definition = {}) {
  return (Array.isArray(catalog) ? catalog : [])
    .filter(card => matchesVendettaChaseSingle(card, definition))
    .sort((left, right) =>
      Number(Boolean(right.image_path || right.image_url)) - Number(Boolean(left.image_path || left.image_url))
      || Number(left.id || 0) - Number(right.id || 0)
    )[0] || null;
}

function vendettaChaseCategory(card = {}) {
  const definition = VENDETTA_CHASE_SINGLES_SPOTS.find(spot => matchesVendettaChaseSingle(card, spot));
  return definition?.category || '';
}

function vendettaBoardTenStandardRarity(card = {}) {
  const category = vendettaChaseCategory(card);
  // Astral Heron is separated into its own named chase position, but it is
  // still an Epic printing and should advertise that rarity in the listing.
  if (category === 'EPIC' || category === 'ASTRAL') return 'Epic';
  // Signature, ON, AA, and SP already identify their printing in the title or
  // collector number. Do not add a competing base-rarity label to them.
  if (category) return '';

  const treatment = [card.collector_treatment, card.manual_category, card.variant]
    .map(value => String(value || '').trim().toUpperCase())
    .find(value => value && value !== 'STANDARD') || '';
  if (treatment) return '';
  const rarity = String(card.break_rarity || card.rarity || card.source_rarity || '').trim().toUpperCase();
  if (rarity === 'EPIC') return 'Epic';
  if (rarity === 'RARE') return 'Rare';
  return '';
}

function vendettaBoardTenPopupLabel(card = {}) {
  const category = vendettaChaseCategory(card);
  if (category === 'SIG') return 'SIG';
  if (category === 'ON') return 'OVERNUMBERED';
  if (category === 'AA') return 'ALTERNATE ART';
  if (category === 'SP') return 'SP';
  if (category === 'EPIC' || category === 'ASTRAL') return 'EPIC';
  const rarity = vendettaBoardTenStandardRarity(card);
  return rarity ? rarity.toUpperCase() : '';
}

function decorateVendettaBoardTenListing(boardRows = []) {
  return (Array.isArray(boardRows) ? boardRows : []).map(card => {
    const category = vendettaChaseCategory(card);
    const popupLabel = vendettaBoardTenPopupLabel(card);
    if (category === 'SP') {
      // VEN-SP1 through VEN-SP6 identify themselves. Preserve the user's
      // compact SP titles even when a fallback catalog marks them Showcase,
      // while the rose distinguishes these six chase listings and popups.
      return {
        ...card,
        break_spot_label: [String(card.name || 'Riftbound card').trim(), String(card.card_number || '').trim()]
          .filter(Boolean)
          .join(' · '),
        break_listing_symbol: VENDETTA_BOARD_TEN_SP_SYMBOL,
        break_listing_symbol_suppressed: false,
        break_popup_label: popupLabel,
        break_popup_effect_group: VENDETTA_BOARD_TEN_POPUP_EFFECTS.SP
      };
    }
    const rarity = vendettaBoardTenStandardRarity(card);
    if (!rarity) return popupLabel ? { ...card, break_popup_label: popupLabel } : card;
    const baseLabel = String(card.break_spot_label || card.name || 'Riftbound card').trim();
    const alreadyLabeled = new RegExp(`(?:^|\\s·\\s)${rarity}$`, 'i').test(baseLabel);
    return {
      ...card,
      break_spot_label: alreadyLabeled ? baseLabel : `${baseLabel} · ${rarity}`,
      break_listing_symbol: rarity === 'Epic'
        ? VENDETTA_BOARD_TEN_EPIC_SYMBOL
        : VENDETTA_BOARD_TEN_RARE_SYMBOL,
      break_popup_label: popupLabel,
      break_popup_effect_group: rarity === 'Epic'
        ? VENDETTA_BOARD_TEN_POPUP_EFFECTS.EPIC
        : VENDETTA_BOARD_TEN_POPUP_EFFECTS.RARE
    };
  });
}

function prepareVendettaChaseSinglesBoard(catalog = []) {
  const anchors = VENDETTA_CHASE_SINGLES_SPOTS.map(definition => chooseVendettaChaseSingle(catalog, definition));
  const missing = VENDETTA_CHASE_SINGLES_SPOTS
    .filter((_definition, index) => !anchors[index])
    .map(definition => ({
      position: definition.position,
      category: definition.category,
      label: definition.label,
      cardNumber: definition.collectorNumber
    }));
  if (missing.length) return { ready: false, reason: 'missing-exact-cards', missing };
  if (new Set(anchors.map(card => Number(card.id))).size !== anchors.length) {
    return { ready: false, reason: 'duplicate-exact-cards' };
  }
  const categoryCounts = Object.fromEntries(CATEGORY_GROUPS.map(group => [
    group.key,
    VENDETTA_CHASE_SINGLES_SPOTS.filter(spot => spot.category === group.key).length
  ]));
  return { ready: true, anchors, spots: VENDETTA_CHASE_SINGLES_SPOTS, categoryCounts };
}

function isVendettaChaseSinglesBoard(boardRows = []) {
  const rows = [...(Array.isArray(boardRows) ? boardRows : [])]
    .sort((left, right) => Number(left.position || 0) - Number(right.position || 0));
  return rows.length === VENDETTA_CHASE_SINGLES_SPOTS.length
    && VENDETTA_CHASE_SINGLES_SPOTS.every((definition, index) =>
      Number(rows[index]?.position || 0) === definition.position
      && matchesVendettaChaseSingle(rows[index], definition)
    );
}

function ensureVendettaChaseSinglesBoardTen(database) {
  const existingMarker = database.prepare('SELECT value FROM app_metadata WHERE key = ?')
    .get(VENDETTA_CHASE_SINGLES_MIGRATION_KEY)?.value;
  if (existingMarker) return { seeded: false, skipped: true, reason: 'already-installed' };

  const catalog = database.prepare(`
    SELECT * FROM cards
    WHERE UPPER(TRIM(COALESCE(game_code, ''))) = 'RIFTBOUND'
      AND UPPER(TRIM(COALESCE(set_code, ''))) = 'VEN'
  `).all();
  const prepared = prepareVendettaChaseSinglesBoard(catalog);
  if (!prepared.ready) return { seeded: false, skipped: true, ...prepared };

  const savedAt = new Date().toISOString();
  const workingSlot = Number(database.prepare("SELECT value FROM app_metadata WHERE key = 'break-board-working-preset-slot-v1'").get()?.value || 0);
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare(`
      INSERT INTO break_board_presets (slot, name, saved_at, mapping_mode) VALUES (?, ?, ?, 'SINGLES')
      ON CONFLICT(slot) DO UPDATE SET name = excluded.name, saved_at = excluded.saved_at,
        mapping_mode = excluded.mapping_mode
    `).run(VENDETTA_CHASE_SINGLES_BOARD_SLOT, VENDETTA_CHASE_SINGLES_BOARD_NAME, savedAt);

    // Replace saved Board 10 only. Existing live, pending, and historical
    // rounds keep their immutable snapshots and ownership modes.
    database.prepare('DELETE FROM break_board_custom_spot_cards WHERE slot = ?').run(VENDETTA_CHASE_SINGLES_BOARD_SLOT);
    database.prepare('DELETE FROM break_board_custom_spots WHERE slot = ?').run(VENDETTA_CHASE_SINGLES_BOARD_SLOT);
    database.prepare('DELETE FROM break_board_preset_cards WHERE slot = ?').run(VENDETTA_CHASE_SINGLES_BOARD_SLOT);

    const insertPreset = database.prepare(`
      INSERT INTO break_board_preset_cards (slot, position, card_id, added_at)
      VALUES (?, ?, ?, ?)
    `);
    prepared.anchors.forEach((card, index) => insertPreset.run(
      VENDETTA_CHASE_SINGLES_BOARD_SLOT,
      index + 1,
      card.id,
      savedAt
    ));

    // Follow Board 10 only when the user already has Board 10 open. Saving the
    // reusable preset never pushes it onto the active live ledger by itself.
    if (workingSlot === VENDETTA_CHASE_SINGLES_BOARD_SLOT) {
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
    `).run(VENDETTA_CHASE_SINGLES_MIGRATION_KEY, savedAt);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  return {
    seeded: true,
    slot: VENDETTA_CHASE_SINGLES_BOARD_SLOT,
    name: VENDETTA_CHASE_SINGLES_BOARD_NAME,
    savedCards: prepared.anchors.length,
    categoryCounts: prepared.categoryCounts,
    loadedWorkingBoard: workingSlot === VENDETTA_CHASE_SINGLES_BOARD_SLOT,
    mappingMode: 'SINGLES'
  };
}

module.exports = {
  VENDETTA_ALTERNATE_ART_NUMBERS,
  VENDETTA_ASTRAL_HERON_NUMBER,
  VENDETTA_BOARD_TEN_EPIC_SYMBOL,
  VENDETTA_BOARD_TEN_POPUP_EFFECTS,
  VENDETTA_BOARD_TEN_RARE_SYMBOL,
  VENDETTA_BOARD_TEN_SP_SYMBOL,
  VENDETTA_CHASE_SINGLES_BOARD_NAME,
  VENDETTA_CHASE_SINGLES_BOARD_SLOT,
  VENDETTA_CHASE_SINGLES_MIGRATION_KEY,
  VENDETTA_CHASE_SINGLES_SPOTS,
  VENDETTA_EPIC_NUMBERS,
  VENDETTA_OVERNUMBERED_NUMBERS,
  VENDETTA_SIGNATURE_NUMBERS,
  VENDETTA_SP_NUMBERS,
  chooseVendettaChaseSingle,
  collectorNumberKey,
  decorateVendettaBoardTenListing,
  ensureVendettaChaseSinglesBoardTen,
  isVendettaChaseSinglesBoard,
  matchesVendettaChaseSingle,
  prepareVendettaChaseSinglesBoard,
  vendettaBoardTenStandardRarity,
  vendettaBoardTenPopupLabel,
  vendettaChaseCategory
};
