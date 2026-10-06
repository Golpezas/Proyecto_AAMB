'use strict';

const {
  cardBelongsToChampion,
  cardBelongsToVendettaSpot,
  isShowcaseRune,
  isVendettaRareColorCard,
  sortChampionFamily,
  vendettaSpotLabel,
  vendettaSpotMapping
} = require('./RiftboundChampionAudit');

const VENDETTA_SPLIT_PROFILE_ID = 'VEN_16_COMBINED_BOARD_9_2026_09_23_V4';
const VENDETTA_SPLIT_BOARD_SLOT = 9;
const VENDETTA_SPLIT_BOARD_NAME = 'Vendetta · 16 Spots · Combined SIG / SP + ON';
const VENDETTA_SPLIT_MIGRATION_KEY = 'vendetta-board-9-16-combined-spots-2026-09-23-v4';

function mappedSpot(position, spot, anchorName, anchorNumber) {
  const mapping = vendettaSpotMapping(spot);
  if (!mapping) throw new Error(`Unknown Vendetta mapping: ${spot}`);
  return Object.freeze({
    position,
    key: `VEN_SPLIT_${String(position).padStart(2, '0')}`,
    kind: mapping.kind,
    label: vendettaSpotLabel(mapping),
    champion: mapping.champions[0] || '',
    champions: mapping.champions,
    mapping,
    anchorName,
    anchorNumber,
    color: mapping.color,
    domain: mapping.domain,
    rune: mapping.rune,
    includeRune: mapping.kind === 'color',
    names: Object.freeze([]),
    extras: mapping.extras,
    includeRareDomain: mapping.kind === 'color'
  });
}

// Restored compact Vendetta layout. Each Signature anchor owns its complete
// family plus its designated Rival ON family. Each Crystal Rose SP/color anchor
// owns one paired Rival ON family. Astral Heron is its own named chase lane with
// Irelia and Helm of Suppression; Riven belongs to Sona.
const VENDETTA_SPLIT_SPOTS = Object.freeze([
  mappedSpot(1, 'Akali', 'Akali, Rogue Assassin', '189*'),
  mappedSpot(2, 'Renekton', 'Renekton, Butcher of the Sands', '190*'),
  mappedSpot(3, 'Zed', 'Zed, Master of Shadows', '191*'),
  mappedSpot(4, 'Nasus', 'Nasus, Curator of the Sands', '192*'),
  mappedSpot(5, 'Shen', 'Shen, Eye of Twilight', '193*'),
  mappedSpot(6, 'Jayce', 'Jayce, Defender of Tomorrow', '194*'),
  mappedSpot(7, 'Mel', "Mel, Soul's Reflection", '195*'),
  mappedSpot(8, 'Ambessa', 'Ambessa, Matriarch of War', '196*'),
  mappedSpot(9, 'Kennen', 'Kennen, Heart of the Tempest', '197*'),
  mappedSpot(10, "Kai'Sa", "Kai'Sa, Survivor", 'SP1'),
  mappedSpot(11, 'Sona', 'Sona, Harmonious', 'SP2'),
  mappedSpot(12, 'Astral Heron', 'Astral Heron', '044'),
  mappedSpot(13, 'Ahri', 'Ahri, Inquisitive', 'SP3'),
  mappedSpot(14, 'Sett', 'Sett, Brawler', 'SP4'),
  mappedSpot(15, 'Ezreal', 'Ezreal, Prodigy', 'SP5'),
  mappedSpot(16, 'Lux', 'Lux, Crownguard', 'SP6')
]);

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
    .replace(/^(?:VEN|VND)[-\s]*/, '')
    .split('/')[0]
    .replace(/-STAR$/, '*')
    .replace(/^0+(?=\d)/, '');
}

function cardNameMatches(card = {}, wanted = '') {
  const full = norm(card.name);
  const prefix = norm(String(card.name || '').split(',')[0]);
  return full === norm(wanted) || prefix === norm(wanted);
}

function normalizedTreatment(card = {}) {
  return String(card.collector_treatment || card.variant || card.manual_category || '')
    .trim()
    .toUpperCase();
}

function normalizedRarity(card = {}) {
  return String(card.break_rarity || card.rarity || card.source_rarity || '')
    .trim()
    .toUpperCase();
}

function isAlternateArtPrinting(card = {}) {
  const treatment = normalizedTreatment(card);
  const number = collectorNumberKey(card.card_number || card.number);
  return ['ALTERNATE ART', 'ALT ART'].includes(treatment) || /A$/.test(number);
}

function isOvernumberedPrinting(card = {}) {
  return /\bOVERNUMBERED\b/.test(normalizedTreatment(card));
}

function isSignaturePrinting(card = {}) {
  return /\bSIGNATURE\b/.test(normalizedTreatment(card));
}

function isPromotionalPrinting(card = {}) {
  return [card.rarity, card.source_rarity, card.collector_treatment, card.variant, card.manual_category]
    .some(value => /\bPROMO(?:TIONAL)?\b/i.test(String(value || '')));
}

function matchesVendettaSplitAnchor(card = {}, definition = {}) {
  return String(card.set_code || '').trim().toUpperCase() === 'VEN'
    && collectorNumberKey(card.card_number || card.number) === collectorNumberKey(definition.anchorNumber);
}

function chooseVendettaSplitAnchor(catalog = [], definition = {}) {
  return (Array.isArray(catalog) ? catalog : [])
    .filter(card => matchesVendettaSplitAnchor(card, definition))
    .sort((left, right) =>
      Number(Boolean(right.image_path || right.image_url)) - Number(Boolean(left.image_path || left.image_url))
      || Number(left.id || 0) - Number(right.id || 0)
    )[0] || null;
}

function colorMapping(definition = {}) {
  return definition.mapping || {
    kind: 'color',
    spot: definition.champion || definition.label,
    champions: definition.champion ? [definition.champion] : [],
    color: definition.color,
    domain: definition.domain,
    rune: definition.rune,
    extras: definition.extras || []
  };
}

function splitChampionBuckets(catalog = [], definition = {}) {
  const chase = collectorNumberKey(definition.chaseNumber);
  const family = uniqueCards((Array.isArray(catalog) ? catalog : [])
    .filter(card => cardBelongsToChampion(card, definition.champion, 'VEN'))
    .filter(card => !isPromotionalPrinting(card)))
    .sort(sortChampionFamily);
  const secondary = family.filter(card => {
    const number = collectorNumberKey(card.card_number || card.number);
    return number !== chase && number !== `${chase}*`;
  });
  const regular = secondary.filter(card => !isOvernumberedPrinting(card) && !isSignaturePrinting(card));
  return {
    family,
    extraOvernumbered: secondary.filter(isOvernumberedPrinting),
    alternateArts: regular.filter(isAlternateArtPrinting),
    epics: regular.filter(card => !isAlternateArtPrinting(card) && normalizedRarity(card) === 'EPIC'),
    rares: regular.filter(card => !isAlternateArtPrinting(card) && normalizedRarity(card) === 'RARE')
  };
}

function splitChampionFamily(catalog = [], definition = {}) {
  if (definition.kind !== 'champion-split') return [];
  const buckets = splitChampionBuckets(catalog, definition);
  const side = definition.mode === 'signature' ? 0 : 1;
  const anchor = chooseVendettaSplitAnchor(catalog, definition);
  return uniqueCards([
    anchor,
    ...(definition.mode === 'overnumbered' ? buckets.extraOvernumbered : []),
    buckets.alternateArts[side],
    buckets.epics[side],
    buckets.rares[side]
  ].filter(Boolean));
}

function cardBelongsToVendettaSplitSpot(card = {}, definition = {}, catalog = []) {
  if (String(card.set_code || '').trim().toUpperCase() !== 'VEN' || !definition) return false;
  if (definition.mapping) return cardBelongsToVendettaSpot(card, definition.mapping, 'VEN');
  if (definition.kind === 'champion-split') {
    if (matchesVendettaSplitAnchor(card, definition)) return true;
    return splitChampionFamily(catalog, definition).some(member => Number(member.id) === Number(card.id));
  }
  if (definition.champion && cardBelongsToChampion(card, definition.champion, 'VEN')) return true;
  if ((definition.names || []).some(name => cardNameMatches(card, name))) return true;
  if (definition.includeRune && definition.rune && cardNameMatches(card, definition.rune) && isShowcaseRune(card)) return true;
  if ((definition.extras || []).some(name => cardNameMatches(card, name))) return true;
  return definition.includeRareDomain
    && isVendettaRareColorCard(card, colorMapping(definition), 'VEN');
}

function uniqueCards(cards = []) {
  const seen = new Set();
  return cards.filter(card => {
    const key = Number(card.id) || [
      String(card.set_code || '').toUpperCase(),
      collectorNumberKey(card.card_number || card.number),
      norm(card.name),
      norm(card.collector_treatment || card.variant || card.manual_category)
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cardsForVendettaSplitSpot(catalog = [], definition = {}) {
  if (definition.kind === 'champion-split') return splitChampionFamily(catalog, definition);
  return uniqueCards((Array.isArray(catalog) ? catalog : [])
    .filter(card => cardBelongsToVendettaSplitSpot(card, definition))
    .sort(sortChampionFamily));
}

function orderedSpotCards(catalog = [], definition = {}, anchor = null) {
  const selectedAnchor = anchor || chooseVendettaSplitAnchor(catalog, definition);
  const family = cardsForVendettaSplitSpot(catalog, definition);
  return uniqueCards([selectedAnchor, ...family].filter(Boolean));
}

function missingRequiredCards(definition = {}, family = []) {
  const missing = [];
  if (definition.mapping) {
    const mapping = definition.mapping;
    const anchorKey = collectorNumberKey(definition.anchorNumber);
    if (anchorKey.endsWith('*')) {
      const unsigned = anchorKey.slice(0, -1);
      if (!family.some(card => collectorNumberKey(card.card_number || card.number) === unsigned)) {
        missing.push(`${definition.champion} own ON ${unsigned}`);
      }
    }

    const rivalChampions = mapping.kind === 'named'
      ? mapping.champions
      : mapping.champions.slice(1);
    for (const champion of rivalChampions) {
      if (!family.some(card => cardBelongsToChampion(card, champion, 'VEN') && isOvernumberedPrinting(card))) {
        missing.push(`${champion} Rival ON`);
      }
    }
    if (mapping.kind === 'color'
      && mapping.rune
      && !family.some(card => cardNameMatches(card, mapping.rune) && isShowcaseRune(card))) {
      missing.push(`${mapping.rune} Showcase`);
    }
    for (const name of mapping.extras || []) {
      if (!family.some(card => cardNameMatches(card, name))) missing.push(name);
    }
    if (mapping.kind === 'color'
      && !family.some(card => isVendettaRareColorCard(card, mapping, 'VEN'))) {
      missing.push(`Rare ${mapping.domain} Cards`);
    }
    return missing;
  }
  if (definition.kind === 'champion-split') {
    if (!family.some(card => matchesVendettaSplitAnchor(card, definition))) missing.push(`${definition.champion} ${definition.mode} anchor`);
    if (!family.some(isAlternateArtPrinting)) missing.push(`${definition.champion} assigned Alternate Art`);
    if (!family.some(card => !isOvernumberedPrinting(card) && !isSignaturePrinting(card)
      && !isAlternateArtPrinting(card) && normalizedRarity(card) === 'EPIC')) missing.push(`${definition.champion} assigned Epic`);
    if (!family.some(card => !matchesVendettaSplitAnchor(card, definition)
      && !isOvernumberedPrinting(card) && !isSignaturePrinting(card)
      && !isAlternateArtPrinting(card) && normalizedRarity(card) === 'RARE')) missing.push(`${definition.champion} assigned Rare`);
    return missing;
  }
  const anchorKey = collectorNumberKey(definition.anchorNumber);
  if (anchorKey.endsWith('*')) {
    const unsigned = anchorKey.slice(0, -1);
    if (!family.some(card => collectorNumberKey(card.card_number || card.number) === unsigned)) {
      missing.push(`${definition.champion} own ON ${unsigned}`);
    }
  }
  if (definition.includeRune && definition.rune && !family.some(card => cardNameMatches(card, definition.rune) && isShowcaseRune(card))) {
    missing.push(`${definition.rune} Showcase`);
  }
  for (const name of [...(definition.names || []), ...(definition.extras || [])]) {
    if (!family.some(card => cardNameMatches(card, name))) missing.push(name);
  }
  if (definition.includeRareDomain
    && !family.some(card => isVendettaRareColorCard(card, colorMapping(definition), 'VEN'))) {
    missing.push(`Rare ${definition.domain} Cards`);
  }
  return missing;
}

function missingSplitPoolCards(definition = {}, catalog = []) {
  if (definition.kind !== 'champion-split') return [];
  const buckets = splitChampionBuckets(catalog, definition);
  const missing = [];
  if (buckets.alternateArts.length < 2) missing.push(`${definition.champion} needs two Alternate Arts`);
  if (buckets.epics.length < 2) missing.push(`${definition.champion} needs two Epics`);
  if (buckets.rares.length < 2) missing.push(`${definition.champion} needs two Rares`);
  return missing;
}

function isVendettaSplitBreakBoard(boardRows = []) {
  const rows = [...(Array.isArray(boardRows) ? boardRows : [])]
    .sort((left, right) => Number(left.position || 0) - Number(right.position || 0));
  return rows.length === VENDETTA_SPLIT_SPOTS.length
    && VENDETTA_SPLIT_SPOTS.every((definition, index) =>
      Number(rows[index]?.position || 0) === definition.position
      && matchesVendettaSplitAnchor(rows[index], definition)
    );
}

function prepareVendettaSplitBoard(catalog = []) {
  const anchors = VENDETTA_SPLIT_SPOTS.map(definition => chooseVendettaSplitAnchor(catalog, definition));
  const missingAnchors = VENDETTA_SPLIT_SPOTS
    .filter((_definition, index) => !anchors[index])
    .map(definition => ({ position: definition.position, label: definition.label, cardNumber: definition.anchorNumber }));
  if (missingAnchors.length) return { ready: false, reason: 'missing-anchor-cards', missing: missingAnchors };
  if (new Set(anchors.map(card => Number(card.id))).size !== anchors.length) {
    return { ready: false, reason: 'duplicate-anchor-cards' };
  }

  const spots = VENDETTA_SPLIT_SPOTS.map((definition, index) => {
    const cards = orderedSpotCards(catalog, definition, anchors[index]);
    return {
      definition,
      anchor: anchors[index],
      cards,
      missing: [...missingRequiredCards(definition, cards), ...missingSplitPoolCards(definition, catalog)]
    };
  });
  const missing = spots.flatMap(spot => spot.missing.map(card => ({
    position: spot.definition.position,
    label: spot.definition.label,
    card
  })));
  if (missing.length) return { ready: false, reason: 'missing-mapped-cards', missing };

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
  return { ready: true, anchors, spots, mappedCards: owners.size };
}

function isVendettaSplitCustomMapping(mapping = null) {
  if (!mapping?.spots?.length) return false;
  const anchorRows = mapping.spots.map(spot => {
    const cards = Array.isArray(spot.cards) ? spot.cards : [];
    const anchor = cards.find(card => String(card.mappingAdditionType || card.additionType || '').trim().toUpperCase() === 'ANCHOR')
      || cards[0];
    return anchor ? { ...anchor, position: Number(spot.position) } : null;
  }).filter(Boolean);
  return isVendettaSplitBreakBoard(anchorRows);
}

function ensureVendettaSplitBoardNine(database) {
  const existingMarker = database.prepare('SELECT value FROM app_metadata WHERE key = ?')
    .get(VENDETTA_SPLIT_MIGRATION_KEY)?.value;
  if (existingMarker) return { seeded: false, skipped: true, reason: 'already-installed' };

  const catalog = database.prepare(`
    SELECT * FROM cards
    WHERE UPPER(TRIM(COALESCE(game_code, ''))) = 'RIFTBOUND'
      AND UPPER(TRIM(COALESCE(set_code, ''))) = 'VEN'
  `).all();
  const prepared = prepareVendettaSplitBoard(catalog);
  if (!prepared.ready) return { seeded: false, skipped: true, ...prepared };

  const savedAt = new Date().toISOString();
  const workingSlot = Number(database.prepare("SELECT value FROM app_metadata WHERE key = 'break-board-working-preset-slot-v1'").get()?.value || 0);
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare(`
      INSERT INTO break_board_presets (slot, name, saved_at, mapping_mode) VALUES (?, ?, ?, 'MAPPED')
      ON CONFLICT(slot) DO UPDATE SET name = excluded.name, saved_at = excluded.saved_at,
        mapping_mode = excluded.mapping_mode
    `).run(VENDETTA_SPLIT_BOARD_SLOT, VENDETTA_SPLIT_BOARD_NAME, savedAt);

    // Only Board 9 is replaced. Every other saved board and every live or
    // historical break remains untouched.
    database.prepare('DELETE FROM break_board_custom_spot_cards WHERE slot = ?').run(VENDETTA_SPLIT_BOARD_SLOT);
    database.prepare('DELETE FROM break_board_custom_spots WHERE slot = ?').run(VENDETTA_SPLIT_BOARD_SLOT);
    database.prepare('DELETE FROM break_board_preset_cards WHERE slot = ?').run(VENDETTA_SPLIT_BOARD_SLOT);

    const insertPreset = database.prepare(`
      INSERT INTO break_board_preset_cards (slot, position, card_id, added_at)
      VALUES (?, ?, ?, ?)
    `);
    const insertCustomSpot = database.prepare(`
      INSERT INTO break_board_custom_spots (slot, position, label, updated_at)
      VALUES (?, ?, ?, ?)
    `);
    const insertCustomCard = database.prepare(`
      INSERT INTO break_board_custom_spot_cards
        (slot, position, card_id, sort_order, addition_type, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const spot of prepared.spots) {
      insertPreset.run(VENDETTA_SPLIT_BOARD_SLOT, spot.definition.position, spot.anchor.id, savedAt);
      insertCustomSpot.run(VENDETTA_SPLIT_BOARD_SLOT, spot.definition.position, spot.definition.label, savedAt);
      spot.cards.forEach((card, index) => insertCustomCard.run(
        VENDETTA_SPLIT_BOARD_SLOT,
        spot.definition.position,
        card.id,
        index + 1,
        Number(card.id) === Number(spot.anchor.id) ? 'ANCHOR' : 'SEQUENCE',
        savedAt
      ));
    }

    // The editable draft follows Board 9 only when Board 9 was already open.
    // The active live ledger, Buyer Bags, pending rounds, and history never move.
    if (workingSlot === VENDETTA_SPLIT_BOARD_SLOT) {
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
    `).run(VENDETTA_SPLIT_MIGRATION_KEY, savedAt);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  return {
    seeded: true,
    slot: VENDETTA_SPLIT_BOARD_SLOT,
    name: VENDETTA_SPLIT_BOARD_NAME,
    savedCards: prepared.anchors.length,
    mappedCards: prepared.mappedCards,
    loadedWorkingBoard: workingSlot === VENDETTA_SPLIT_BOARD_SLOT,
    mappingMode: 'MAPPED'
  };
}

module.exports = {
  VENDETTA_SPLIT_BOARD_NAME,
  VENDETTA_SPLIT_BOARD_SLOT,
  VENDETTA_SPLIT_MIGRATION_KEY,
  VENDETTA_SPLIT_PROFILE_ID,
  VENDETTA_SPLIT_SPOTS,
  cardBelongsToVendettaSplitSpot,
  cardsForVendettaSplitSpot,
  chooseVendettaSplitAnchor,
  collectorNumberKey,
  ensureVendettaSplitBoardNine,
  isVendettaSplitBreakBoard,
  isVendettaSplitCustomMapping,
  isAlternateArtPrinting,
  isOvernumberedPrinting,
  matchesVendettaSplitAnchor,
  missingRequiredCards,
  prepareVendettaSplitBoard,
  splitChampionFamily
};
