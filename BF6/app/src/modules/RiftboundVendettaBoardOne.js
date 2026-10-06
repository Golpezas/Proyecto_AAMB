'use strict';

const { cardBelongsToChampion } = require('./RiftboundChampionAudit');

const VENDETTA_BOARD_ONE_SLOT = 1;
const VENDETTA_BOARD_ONE_NAME = 'Vendetta · 33 Spots · Champions + ON';
const VENDETTA_BOARD_ONE_MIGRATION_KEY = 'vendetta-board-1-33-champions-on-2026-09-27-v3';
const VENDETTA_BOARD_ONE_STATUS_KEY = 'vendetta-board-1-33-install-status-v3';

const SIGNATURE_CHAMPIONS = Object.freeze([
  ['Akali', '189', ''],
  ['Renekton', '190', '177'],
  ['Zed', '191', '169'],
  ['Nasus', '192', '178'],
  ['Shen', '193', '170'],
  ['Jayce', '194', '175'],
  ['Mel', '195', '188'],
  ['Ambessa', '196', '187'],
  ['Kennen', '197', '']
]);
const SINGLE_ON_CHAMPIONS = Object.freeze([
  ['Vi', '167'], ['Jinx', '168'], ['Riven', '171'],
  ['Draven', '172'], ['Swain', '173'], ['Irelia', '174'],
  ['Viktor', '176'], ['Rengar', '179'], ["Kha'Zix", '180'],
  ['Gangplank', '181'], ['Illaoi', '182'], ['Diana', '183'],
  ['Leona', '184'], ['Kayle', '185'], ['Morgana', '186']
]);
const SP_CHAMPIONS = Object.freeze(["Kai'Sa", 'Sona', 'Ahri', 'Sett', 'Ezreal', 'Lux']);
const RUNE_NUMBERS = Object.freeze(
  Array.from({ length: 6 }, (_unused, index) => [
    `R0${index + 1}A`, `R0${index + 1}B`
  ]).flat()
);

const VENDETTA_BOARD_ONE_SPOTS = Object.freeze([
  ...SIGNATURE_CHAMPIONS.map(([champion, number, secondOn], index) => Object.freeze({
    position: index + 1,
    kind: 'champion',
    champion,
    anchorNumber: `${number}*`,
    requiredNumbers: Object.freeze([`${number}*`, number, ...(secondOn ? [secondOn] : [])]),
    label: `${champion} · SIG VEN-${number}* + ON VEN-${number}${secondOn ? `, VEN-${secondOn}` : ''}`
  })),
  ...SINGLE_ON_CHAMPIONS.map(([champion, number], index) => Object.freeze({
    position: index + 10,
    kind: 'champion',
    champion,
    anchorNumber: number,
    requiredNumbers: Object.freeze([number]),
    label: `${champion} · ON VEN-${number}`
  })),
  ...SP_CHAMPIONS.map((champion, index) => Object.freeze({
    position: index + 25,
    kind: 'sp',
    champion,
    anchorNumber: `SP${index + 1}`,
    requiredNumbers: Object.freeze([`SP${index + 1}`]),
    label: `${champion} · VEN-SP${index + 1}`
  })),
  Object.freeze({ position: 31, kind: 'astral', anchorNumber: '044', requiredNumbers: Object.freeze(['044']), label: 'Astral Heron · VEN-044' }),
  Object.freeze({ position: 32, kind: 'runes', anchorNumber: 'R01A', requiredNumbers: RUNE_NUMBERS, label: 'All Showcase Runes · VEN-R01A/B–R06A/B' }),
  Object.freeze({ position: 33, kind: 'gear-spells', anchorNumber: '045', requiredNumbers: Object.freeze(['045']), label: 'Remaining Gear & Spells · Rare, Epic, AA' })
]);

// Collector numbers are authoritative for the promised chase positions. Old
// local catalogs sometimes retain a correct number with incomplete name,
// rarity, or card-type metadata; those rows must still install Board 1.
const REQUIRED_NUMBER_OWNER = new Map(VENDETTA_BOARD_ONE_SPOTS.flatMap(spot =>
  spot.requiredNumbers.map(number => [number.replace(/^0+(?=\d)/, ''), spot.position])
));
// The nine Epic signature Spells have their champion's dual domain, but their
// printed names do not contain the champion name in an offline catalog.
const SIGNATURE_SPELL_OWNER = new Map(
  ['140', '142', '144', '146', '148', '150', '152', '154', '156']
    .map((number, index) => [number, index + 1])
);

function collectorNumberKey(value) {
  return String(value || '').trim().toUpperCase()
    .replace(/^VEN[-\s]*/, '').split('/')[0]
    .replace(/-STAR$/, '*').replace(/^0+(?=\d)/, '');
}

function championKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9']+/g, ' ');
}

function treatment(card = {}) {
  return String(card.collector_treatment || card.variant || card.manual_category || '').trim().toUpperCase();
}

function rarity(card = {}) {
  return String(card.break_rarity || card.rarity || card.source_rarity || '').trim().toUpperCase();
}

function isAdvertisedHit(card = {}) {
  return ['RARE', 'EPIC'].includes(rarity(card))
    || ['SIGNATURE', 'OVERNUMBERED', 'ALTERNATE ART', 'ALT ART'].includes(treatment(card))
    || (rarity(card) === 'SHOWCASE' && /[AB]$/.test(collectorNumberKey(card.card_number || card.number)));
}

function isGearOrSpell(card = {}) {
  return /\b(?:GEAR|SPELL)\b/i.test(String(card.card_type || ''));
}

function isPromotionalPrinting(card = {}) {
  return [card.rarity, card.source_rarity, card.collector_treatment,
    card.variant, card.variant_source, card.manual_category, card.product_name]
    .some(value => /\bPROMO(?:TIONAL)?\b/i.test(String(value || '')))
    || /^P\d/.test(collectorNumberKey(card.card_number || card.number));
}

function chooseExact(catalog = [], number = '') {
  return catalog.filter(card => collectorNumberKey(card.card_number || card.number) === collectorNumberKey(number))
    .sort((left, right) =>
      Number(Boolean(right.image_path || right.image_url)) - Number(Boolean(left.image_path || left.image_url))
      || Number(left.id || 0) - Number(right.id || 0)
    )[0] || null;
}

function ownerForCard(card = {}) {
  if (isPromotionalPrinting(card)) return 0;
  const number = collectorNumberKey(card.card_number || card.number);
  if (REQUIRED_NUMBER_OWNER.has(number)) return REQUIRED_NUMBER_OWNER.get(number);
  const signatureSpellOwner = SIGNATURE_SPELL_OWNER.get(number.replace(/[AB]$/, ''));
  if (signatureSpellOwner) return signatureSpellOwner;
  if (!isAdvertisedHit(card)) return 0;
  const prefix = championKey(String(card.name || '').split(',')[0]);
  const directOwner = VENDETTA_BOARD_ONE_SPOTS.find(spot =>
    spot.kind === 'champion' && championKey(spot.champion) === prefix
  )?.position;
  if (directOwner) return directOwner;
  const taggedOwners = VENDETTA_BOARD_ONE_SPOTS.filter(spot =>
    spot.kind === 'champion' && cardBelongsToChampion(card, spot.champion, 'VEN')
  );
  if (taggedOwners.length === 1) return taggedOwners[0].position;
  return isGearOrSpell(card) ? 33 : 0;
}

function prepareVendettaBoardOne(catalog = []) {
  const cards = (Array.isArray(catalog) ? catalog : []).filter(card =>
    String(card.set_code || '').trim().toUpperCase() === 'VEN' && !isPromotionalPrinting(card)
  );
  const spots = VENDETTA_BOARD_ONE_SPOTS.map(definition => {
    const anchor = chooseExact(cards, definition.anchorNumber);
    const family = cards.filter(card => ownerForCard(card) === definition.position);
    const ordered = [anchor, ...definition.requiredNumbers.map(number => chooseExact(family, number)), ...family]
      .filter(Boolean);
    const seen = new Set();
    return {
      definition,
      anchor,
      cards: ordered.filter(card => {
        if (seen.has(Number(card.id))) return false;
        seen.add(Number(card.id));
        return true;
      }),
      missing: definition.requiredNumbers.filter(number => !chooseExact(family, number))
    };
  });
  const missing = spots.flatMap(spot => [
    ...(!spot.anchor ? [spot.definition.anchorNumber] : []),
    ...spot.missing
  ].map(number => ({ position: spot.definition.position, label: spot.definition.label, cardNumber: `VEN-${number}` })));
  if (missing.length) return { ready: false, reason: 'missing-catalog-cards', missing };
  const owners = new Map();
  for (const spot of spots) {
    for (const card of spot.cards) {
      const id = Number(card.id);
      if (owners.has(id)) return { ready: false, reason: 'duplicate-owner', cardId: id, positions: [owners.get(id), spot.definition.position] };
      owners.set(id, spot.definition.position);
    }
  }
  return { ready: true, spots, mappedCards: owners.size };
}

function isVendettaBoardOne(rows = []) {
  const sorted = [...(Array.isArray(rows) ? rows : [])]
    .sort((left, right) => Number(left.position || 0) - Number(right.position || 0));
  return sorted.length === VENDETTA_BOARD_ONE_SPOTS.length
    && VENDETTA_BOARD_ONE_SPOTS.every((spot, index) =>
      Number(sorted[index]?.position || 0) === spot.position
      && String(sorted[index]?.set_code || '').trim().toUpperCase() === 'VEN'
      && collectorNumberKey(sorted[index]?.card_number || sorted[index]?.number) === collectorNumberKey(spot.anchorNumber)
    );
}

function ensureVendettaBoardOne(database) {
  if (database.prepare('SELECT value FROM app_metadata WHERE key = ?')
    .get(VENDETTA_BOARD_ONE_MIGRATION_KEY)?.value) {
    return { seeded: false, skipped: true, reason: 'already-installed' };
  }
  const catalog = database.prepare(`
    SELECT * FROM cards
    WHERE UPPER(TRIM(COALESCE(game_code, ''))) = 'RIFTBOUND'
      AND UPPER(TRIM(COALESCE(set_code, ''))) = 'VEN'
  `).all();
  const prepared = prepareVendettaBoardOne(catalog);
  if (!prepared.ready) {
    const missing = (prepared.missing || []).slice(0, 5).map(entry => entry.cardNumber).join(', ');
    const status = missing
      ? `Vendetta Board 1 update pending: sync cards (${missing}${prepared.missing.length > 5 ? ', …' : ''}).`
      : `Vendetta Board 1 update pending: ${prepared.reason}.`;
    database.prepare('INSERT INTO app_metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(VENDETTA_BOARD_ONE_STATUS_KEY, status);
    return { seeded: false, skipped: true, ...prepared };
  }

  const savedAt = new Date().toISOString();
  const workingSlot = Number(database.prepare("SELECT value FROM app_metadata WHERE key = 'break-board-working-preset-slot-v1'").get()?.value || 0);
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare(`
      INSERT INTO break_board_presets (slot, name, saved_at, mapping_mode) VALUES (?, ?, ?, 'MAPPED')
      ON CONFLICT(slot) DO UPDATE SET name = excluded.name, saved_at = excluded.saved_at, mapping_mode = excluded.mapping_mode
    `).run(VENDETTA_BOARD_ONE_SLOT, VENDETTA_BOARD_ONE_NAME, savedAt);
    database.prepare('DELETE FROM break_board_custom_spot_cards WHERE slot = ?').run(VENDETTA_BOARD_ONE_SLOT);
    database.prepare('DELETE FROM break_board_custom_spots WHERE slot = ?').run(VENDETTA_BOARD_ONE_SLOT);
    database.prepare('DELETE FROM break_board_preset_cards WHERE slot = ?').run(VENDETTA_BOARD_ONE_SLOT);
    const insertPreset = database.prepare('INSERT INTO break_board_preset_cards (slot, position, card_id, added_at) VALUES (?, ?, ?, ?)');
    const insertSpot = database.prepare('INSERT INTO break_board_custom_spots (slot, position, label, updated_at) VALUES (?, ?, ?, ?)');
    const insertCard = database.prepare(`
      INSERT INTO break_board_custom_spot_cards (slot, position, card_id, sort_order, addition_type, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const spot of prepared.spots) {
      const position = spot.definition.position;
      insertPreset.run(VENDETTA_BOARD_ONE_SLOT, position, spot.anchor.id, savedAt);
      insertSpot.run(VENDETTA_BOARD_ONE_SLOT, position, spot.definition.label, savedAt);
      spot.cards.forEach((card, index) => insertCard.run(
        VENDETTA_BOARD_ONE_SLOT, position, card.id, index + 1,
        Number(card.id) === Number(spot.anchor.id) ? 'ANCHOR' : 'SEQUENCE', savedAt
      ));
    }
    if (workingSlot === VENDETTA_BOARD_ONE_SLOT) {
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
    database.prepare('INSERT INTO app_metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(VENDETTA_BOARD_ONE_MIGRATION_KEY, savedAt);
    database.prepare('DELETE FROM app_metadata WHERE key = ?').run(VENDETTA_BOARD_ONE_STATUS_KEY);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return {
    seeded: true,
    slot: VENDETTA_BOARD_ONE_SLOT,
    name: VENDETTA_BOARD_ONE_NAME,
    savedCards: prepared.spots.length,
    mappedCards: prepared.mappedCards,
    loadedWorkingBoard: workingSlot === VENDETTA_BOARD_ONE_SLOT,
    mappingMode: 'MAPPED'
  };
}

module.exports = {
  RUNE_NUMBERS,
  SIGNATURE_CHAMPIONS,
  SINGLE_ON_CHAMPIONS,
  VENDETTA_BOARD_ONE_MIGRATION_KEY,
  VENDETTA_BOARD_ONE_NAME,
  VENDETTA_BOARD_ONE_STATUS_KEY,
  VENDETTA_BOARD_ONE_SPOTS,
  collectorNumberKey,
  ensureVendettaBoardOne,
  isVendettaBoardOne,
  ownerForCard,
  prepareVendettaBoardOne
};
