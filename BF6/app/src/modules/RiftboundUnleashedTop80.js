'use strict';

const UNLEASHED_TOP80_PROFILE_ID = 'UNL_TOP_80_COLLECTR_2026_09_06_V1';
const UNLEASHED_TOP80_BOARD_SLOT = 1;
const UNLEASHED_TOP80_BOARD_NAME = 'Unleashed · Top 80 Price Spots · Collectr 2026-09-06';
const UNLEASHED_TOP80_BOARD_MIGRATION_KEY = 'unleashed-top-80-board-1-collectr-2026-09-06-v1';
const UNLEASHED_TOP80_SINGLES_MODE_MIGRATION_KEY = 'unleashed-top-80-board-1-singles-mode-v1';
const UNLEASHED_TOP80_SOURCE_URL = 'https://app.getcollectr.com/sets/category/89/unleashed?groupId=24560&cardType=cards&sortType=price&sortOrder=DESC';

function spot(position, name, cardNumber, priceCents, options = {}) {
  return Object.freeze({
    position,
    key: `UNL_TOP80_${String(position).padStart(2, '0')}`,
    name,
    cardNumber,
    priceCents,
    rarity: options.rarity || '',
    finish: options.finish || '',
    treatment: options.treatment || ''
  });
}

// Snapshot of Collectr's Unleashed Cards view with Price: High to Low selected
// on 2026-09-06. Position is the sale spot and therefore remains stable even
// if the market changes after this preset is installed.
const UNLEASHED_TOP80_SPOTS = Object.freeze([
  spot(1, 'Baron Nashor (Ultimate)', 'UNL-238/219', 174689, { rarity: 'Showcase', treatment: 'Ultimate' }),
  spot(2, 'Diana - Scorn of the Moon (Signature)', 'UNL-234*/219', 152986, { rarity: 'Showcase', treatment: 'Signature' }),
  spot(3, 'LeBlanc - Deceiver (Signature)', 'UNL-235*/219', 90066, { rarity: 'Showcase', treatment: 'Signature' }),
  spot(4, 'Vex - Gloomist (Signature)', 'UNL-232*/219', 62931, { rarity: 'Showcase', treatment: 'Signature' }),
  spot(5, 'Vi - Piltover Enforcer (Signature)', 'UNL-229*/219', 62915, { rarity: 'Showcase', treatment: 'Signature' }),
  spot(6, 'Jhin - Virtuoso (Signature)', 'UNL-226*/219', 60380, { rarity: 'Showcase', treatment: 'Signature' }),
  spot(7, 'Pyke - Bloodharbor Ripper (Signature)', 'UNL-228*/219', 56733, { rarity: 'Showcase', treatment: 'Signature' }),
  spot(8, 'Rengar - Pridestalker (Signature)', 'UNL-227*/219', 49857, { rarity: 'Rare', treatment: 'Signature' }),
  spot(9, 'Master Yi - Wuju Master (Signature)', 'UNL-231*/219', 47044, { rarity: 'Showcase', treatment: 'Signature' }),
  spot(10, 'Lillia - Bashful Bloom (Signature)', 'UNL-230*/219', 46144, { rarity: 'Showcase', treatment: 'Signature' }),
  spot(11, 'Poppy - Keeper of the Hammer (Signature)', 'UNL-237*/219', 42249, { rarity: 'Showcase', treatment: 'Signature' }),
  spot(12, "Kha'Zix - Voidreaver (Signature)", 'UNL-236*/219', 39547, { rarity: 'Showcase', treatment: 'Signature' }),
  spot(13, 'Ivern - Green Father (Signature)', 'UNL-233*/219', 38384, { rarity: 'Showcase', treatment: 'Signature' }),
  spot(14, 'Lonely Poro (Overnumbered)', 'UNL-221/219', 33088, { rarity: 'Showcase', treatment: 'Overnumbered' }),
  spot(15, 'Diana - Scorn of the Moon (Overnumbered)', 'UNL-234/219', 24359, { rarity: 'Showcase', treatment: 'Overnumbered' }),
  spot(16, 'Plundering Poro (Overnumbered)', 'UNL-222/219', 18009, { rarity: 'Showcase', treatment: 'Overnumbered' }),
  spot(17, 'LeBlanc - Deceiver (Overnumbered)', 'UNL-235/219', 15144, { rarity: 'Showcase', treatment: 'Overnumbered' }),
  spot(18, 'Mystic Poro (Overnumbered)', 'UNL-224/219', 12925, { rarity: 'Showcase', treatment: 'Overnumbered' }),
  spot(19, 'Pouty Poro (Overnumbered)', 'UNL-220/219', 12803, { rarity: 'Showcase', treatment: 'Overnumbered' }),
  spot(20, 'Daring Poro (Overnumbered)', 'UNL-225/219', 12443, { rarity: 'Showcase', treatment: 'Overnumbered' }),
  spot(21, 'Veteran Poro (Overnumbered)', 'UNL-223/219', 12164, { rarity: 'Showcase', treatment: 'Overnumbered' }),
  spot(22, 'Rengar - Pridestalker (Overnumbered)', 'UNL-227/219', 11605, { rarity: 'Rare', treatment: 'Overnumbered' }),
  spot(23, 'Vex - Gloomist (Overnumbered)', 'UNL-232/219', 10277, { rarity: 'Showcase', treatment: 'Overnumbered' }),
  spot(24, "Kha'Zix - Voidreaver (Overnumbered)", 'UNL-236/219', 9920, { rarity: 'Showcase', treatment: 'Overnumbered' }),
  spot(25, 'Pyke - Bloodharbor Ripper (Overnumbered)', 'UNL-228/219', 9656, { rarity: 'Showcase', treatment: 'Overnumbered' }),
  spot(26, 'Vi - Piltover Enforcer (Overnumbered)', 'UNL-229/219', 8838, { rarity: 'Showcase', treatment: 'Overnumbered' }),
  spot(27, 'Lillia - Bashful Bloom (Overnumbered)', 'UNL-230/219', 8371, { rarity: 'Showcase', treatment: 'Overnumbered' }),
  spot(28, 'Jhin - Virtuoso (Overnumbered)', 'UNL-226/219', 6949, { rarity: 'Showcase', treatment: 'Overnumbered' }),
  spot(29, 'Ivern - Green Father (Overnumbered)', 'UNL-233/219', 6261, { rarity: 'Showcase', treatment: 'Overnumbered' }),
  spot(30, 'Master Yi - Wuju Master (Overnumbered)', 'UNL-231/219', 5229, { rarity: 'Showcase', treatment: 'Overnumbered' }),
  spot(31, 'Poppy - Keeper of the Hammer (Overnumbered)', 'UNL-237/219', 5078, { rarity: 'Showcase', treatment: 'Overnumbered' }),
  spot(32, 'Rengar - Trophy Hunter (Alternate Art)', 'UNL-120a/219', 3581, { rarity: 'Showcase', treatment: 'Alternate Art' }),
  spot(33, 'Rengar - Trophy Hunter', 'UNL-120/219', 3411, { rarity: 'Epic' }),
  spot(34, 'Baron Nashor (Alternate Art)', 'UNL-147a/219', 2628, { rarity: 'Showcase', treatment: 'Alternate Art' }),
  spot(35, 'Vilemaw (Alternate Art)', 'UNL-060a/219', 2566, { rarity: 'Showcase', treatment: 'Alternate Art' }),
  spot(36, 'Vex - Apathetic (Alternate Art)', 'UNL-150a/219', 2495, { rarity: 'Showcase', treatment: 'Alternate Art' }),
  spot(37, 'Vilemaw', 'UNL-060/219', 2287, { rarity: 'Epic' }),
  spot(38, 'Elder Dragon (Alternate Art)', 'UNL-118a/219', 2058, { rarity: 'Showcase', treatment: 'Alternate Art' }),
  spot(39, 'Baron Nashor', 'UNL-147/219', 1900, { rarity: 'Epic' }),
  spot(40, 'Pyke - Dockside Butcher (Alternate Art)', 'UNL-028a/219', 1808, { rarity: 'Showcase', treatment: 'Alternate Art' }),
  spot(41, 'Pyke - Dockside Butcher', 'UNL-028/219', 1758, { rarity: 'Epic' }),
  spot(42, 'Vex - Apathetic', 'UNL-150/219', 1682, { rarity: 'Epic' }),
  spot(43, 'Vi - Peacekeeper (Alternate Art)', 'UNL-176a/219', 1555, { rarity: 'Showcase', treatment: 'Alternate Art' }),
  spot(44, 'Elder Dragon', 'UNL-118/219', 1461, { rarity: 'Epic' }),
  spot(45, 'Moonfall', 'UNL-198/219', 1360, { rarity: 'Epic' }),
  spot(46, 'Thrill of the Hunt', 'UNL-184/219', 1076, { rarity: 'Epic' }),
  spot(47, 'Chaos Rune (R05b)', 'UNL-R05b', 1069, { rarity: 'Promo' }),
  spot(48, 'Chaos Rune (Alternate Art)', 'UNL-R05a', 1037, { rarity: 'Showcase', treatment: 'Alternate Art' }),
  spot(49, 'Calm Rune (Alternate Art)', 'UNL-R02a', 973, { rarity: 'Showcase', treatment: 'Alternate Art' }),
  spot(50, 'Rift Herald (Alternate Art)', 'UNL-179a/219', 933, { rarity: 'Showcase', treatment: 'Alternate Art' }),
  spot(51, 'Calm Rune (R02b)', 'UNL-R02b', 885, { rarity: 'Promo' }),
  spot(52, 'Jhin - Murderous Artist (Alternate Art)', 'UNL-022a/219', 818, { rarity: 'Showcase', treatment: 'Alternate Art' }),
  spot(53, 'The Ruination', 'UNL-180/219', 799, { rarity: 'Epic' }),
  spot(54, "Kha'Zix - Mutating Horror (Alternate Art)", 'UNL-143a/219', 768, { rarity: 'Showcase', treatment: 'Alternate Art' }),
  spot(55, 'Sprite Fountain (Foil)', 'UNL-078/219', 743, { rarity: 'Uncommon', finish: 'Foil' }),
  spot(56, 'Mirror Image', 'UNL-200/219', 721, { rarity: 'Epic' }),
  spot(57, 'Mind Rune (R03b)', 'UNL-R03b', 706, { rarity: 'Promo' }),
  spot(58, 'Pyke - Returned (Alternate Art)', 'UNL-145a/219', 695, { rarity: 'Showcase', treatment: 'Alternate Art' }),
  spot(59, 'Diana - No Longer Human (Alternate Art)', 'UNL-149a/219', 683, { rarity: 'Showcase', treatment: 'Alternate Art' }),
  spot(60, 'Diana - Lunari (Alternate Art)', 'UNL-079a/219', 652, { rarity: 'Showcase', treatment: 'Alternate Art' }),
  spot(61, 'Fury Rune (R01b)', 'UNL-R01b', 645, { rarity: 'Promo' }),
  spot(62, 'Blue Sentinel (Alternate Art)', 'UNL-087a/219', 642, { rarity: 'Showcase', treatment: 'Alternate Art' }),
  spot(63, 'Lillia - Fae Fawn (Alternate Art)', 'UNL-082a/219', 632, { rarity: 'Showcase', treatment: 'Alternate Art' }),
  spot(64, 'Lillia - Protector of Dreams (Alternate Art)', 'UNL-058a/219', 624, { rarity: 'Showcase', treatment: 'Alternate Art' }),
  spot(65, 'Body Rune (Alternate Art)', 'UNL-R04a', 616, { rarity: 'Showcase', treatment: 'Alternate Art' }),
  spot(66, 'Mind Rune (Alternate Art)', 'UNL-R03a', 582, { rarity: 'Showcase', treatment: 'Alternate Art' }),
  spot(67, 'LeBlanc - Everywhere At Once (Alternate Art)', 'UNL-090a/219', 571, { rarity: 'Showcase', treatment: 'Alternate Art' }),
  spot(68, 'Deadly Flourish', 'UNL-073/219', 539, { rarity: 'Uncommon' }),
  spot(69, 'Irresistible Faefolk', 'UNL-112/219', 522, { rarity: 'Rare' }),
  spot(70, 'Jhin - Meticulous Killer (Alternate Art)', 'UNL-089a/219', 481, { rarity: 'Showcase', treatment: 'Alternate Art' }),
  spot(71, 'Order Rune (Alternate Art)', 'UNL-R06a', 470, { rarity: 'Showcase', treatment: 'Alternate Art' }),
  spot(72, 'Order Rune (R06b)', 'UNL-R06b', 448, { rarity: 'Promo' }),
  spot(73, 'Fury Rune (Alternate Art)', 'UNL-R01a', 430, { rarity: 'Showcase', treatment: 'Alternate Art' }),
  spot(74, 'Abandon', 'UNL-131/219', 420, { rarity: 'Uncommon' }),
  spot(75, 'Sprite Fountain (Normal)', 'UNL-078/219', 400, { rarity: 'Uncommon', finish: 'Normal' }),
  spot(76, 'Void Assault', 'UNL-202/219', 399, { rarity: 'Epic' }),
  spot(77, 'Rift Herald', 'UNL-179/219', 397, { rarity: 'Epic' }),
  spot(78, 'Scuttle Crab', 'UNL-053/219', 354, { rarity: 'Rare' }),
  spot(79, 'Vi - Peacekeeper', 'UNL-176/219', 343, { rarity: 'Rare' }),
  spot(80, 'Vi - Hotheaded (Alternate Art)', 'UNL-030a/219', 327, { rarity: 'Showcase', treatment: 'Alternate Art' })
]);

function setCode(card = {}) {
  return String(card.set_code || '').trim().toUpperCase();
}

function collectorNumberKey(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^UNL[-\s]*/, '')
    .split('/')[0]
    .replace(/-STAR$/, '*')
    .replace(/^0+(?=\d)/, '');
}

function explicitFinish(card = {}) {
  return [card.collector_treatment, card.variant, card.manual_category]
    .map(value => String(value || '').trim().toUpperCase())
    .find(Boolean) || '';
}

function matchesTop80Spot(card = {}, definition = {}) {
  if (setCode(card) !== 'UNL') return false;
  if (collectorNumberKey(card.card_number || card.number) !== collectorNumberKey(definition.cardNumber)) return false;
  const finish = explicitFinish(card);
  if (definition.finish === 'Foil') return finish === 'FOIL';
  if (definition.finish === 'Normal') return finish !== 'FOIL';
  return true;
}

function spotLabel(definition = {}) {
  const number = String(definition.cardNumber || '').replace(/^UNL-/i, '');
  return [definition.name, number].filter(Boolean).join(' · ');
}

function unleashedTop80SpotForCard(card = {}, position = 0) {
  const wantedPosition = Number(position || card.position || 0);
  if (wantedPosition) {
    const definition = UNLEASHED_TOP80_SPOTS.find(entry => entry.position === wantedPosition);
    return definition && matchesTop80Spot(card, definition) ? definition : null;
  }
  return UNLEASHED_TOP80_SPOTS.find(definition => matchesTop80Spot(card, definition)) || null;
}

function isUnleashedTop80Board(boardRows = []) {
  const rows = [...(Array.isArray(boardRows) ? boardRows : [])]
    .sort((left, right) => Number(left.position || 0) - Number(right.position || 0));
  if (rows.length !== UNLEASHED_TOP80_SPOTS.length) return false;
  return UNLEASHED_TOP80_SPOTS.every((definition, index) => {
    const row = rows[index];
    return Number(row?.position || 0) === definition.position && matchesTop80Spot(row, definition);
  });
}

function decorateUnleashedTop80Board(boardRows = []) {
  const rows = Array.isArray(boardRows) ? boardRows : [];
  if (!isUnleashedTop80Board(rows)) return rows;
  return rows.map(row => {
    const definition = unleashedTop80SpotForCard(row, row.position);
    return definition ? {
      ...row,
      break_spot_label: spotLabel(definition),
      break_spot_key: definition.key,
      unleashed_top80: true,
      collectr_rank: definition.position,
      collectr_snapshot_price_cents: definition.priceCents
    } : row;
  });
}

function matchingCards(catalog = [], definition = {}) {
  return (Array.isArray(catalog) ? catalog : []).filter(card => matchesTop80Spot(card, definition));
}

function chooseBoardCard(catalog = [], definition = {}) {
  return [...matchingCards(catalog, definition)].sort((left, right) => {
    const leftFinish = explicitFinish(left);
    const rightFinish = explicitFinish(right);
    const wantedFinish = String(definition.finish || '').toUpperCase();
    const leftFinishRank = wantedFinish ? Number(leftFinish !== wantedFinish) : Number(leftFinish === 'FOIL');
    const rightFinishRank = wantedFinish ? Number(rightFinish !== wantedFinish) : Number(rightFinish === 'FOIL');
    return leftFinishRank - rightFinishRank
      || Number(Boolean(right.image_path || right.image_url)) - Number(Boolean(left.image_path || left.image_url))
      || Number(left.id || 0) - Number(right.id || 0);
  })[0] || null;
}

function buildUnleashedTop80Spot(catalog = [], boardAnchor = {}) {
  const definition = unleashedTop80SpotForCard(boardAnchor, boardAnchor.position);
  if (!definition) return null;
  const exactCard = (Array.isArray(catalog) ? catalog : []).find(card => Number(card.id) === Number(boardAnchor.id))
    || chooseBoardCard(catalog, definition)
    || boardAnchor;
  const label = spotLabel(definition);
  const family = [exactCard];
  return {
    profileId: UNLEASHED_TOP80_PROFILE_ID,
    position: definition.position,
    key: definition.key,
    displayLabel: label,
    listingNote: label,
    collectrRank: definition.position,
    collectrSnapshotPriceCents: definition.priceCents,
    sourceUrl: UNLEASHED_TOP80_SOURCE_URL,
    color: '',
    domain: '',
    anchor: definition.name,
    champions: [],
    poro: '',
    baron: false,
    family,
    heroCards: family,
    bundleGroups: [{
      key: definition.key,
      label: definition.name,
      caption: `Exact ${definition.finish || definition.treatment || definition.rarity || 'Unleashed'} printing only · ${String(definition.cardNumber).replace(/^UNL-/i, '')}`,
      role: 'direct',
      cards: family
    }]
  };
}

function ensureUnleashedTop80BoardOne(database) {
  const existingMarker = database.prepare('SELECT value FROM app_metadata WHERE key = ?')
    .get(UNLEASHED_TOP80_BOARD_MIGRATION_KEY)?.value;
  const existingSinglesMarker = database.prepare('SELECT value FROM app_metadata WHERE key = ?')
    .get(UNLEASHED_TOP80_SINGLES_MODE_MIGRATION_KEY)?.value;
  if (existingMarker) {
    if (!existingSinglesMarker) {
      const updatedAt = new Date().toISOString();
      database.exec('BEGIN IMMEDIATE');
      try {
        database.prepare("UPDATE break_board_presets SET mapping_mode = 'SINGLES' WHERE slot = ?")
          .run(UNLEASHED_TOP80_BOARD_SLOT);
        const workingSlot = Number(database.prepare("SELECT value FROM app_metadata WHERE key = 'break-board-working-preset-slot-v1'").get()?.value || 0);
        if (workingSlot === UNLEASHED_TOP80_BOARD_SLOT) {
          database.prepare(`
            INSERT INTO app_metadata (key, value) VALUES ('break-board-working-mapping-mode-v1', 'SINGLES')
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
          `).run();
        }
        database.prepare(`
          INSERT INTO app_metadata (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `).run(UNLEASHED_TOP80_SINGLES_MODE_MIGRATION_KEY, updatedAt);
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
      return { seeded: false, skipped: true, reason: 'already-installed', mappingModeUpdated: true };
    }
    return { seeded: false, skipped: true, reason: 'already-installed', mappingModeUpdated: false };
  }

  const catalog = database.prepare(`
    SELECT * FROM cards
    WHERE UPPER(TRIM(COALESCE(game_code, ''))) = 'RIFTBOUND'
      AND UPPER(TRIM(COALESCE(set_code, ''))) = 'UNL'
  `).all();
  const anchors = UNLEASHED_TOP80_SPOTS.map(definition => chooseBoardCard(catalog, definition));
  const missing = UNLEASHED_TOP80_SPOTS
    .filter((_definition, index) => !anchors[index])
    .map(definition => ({ position: definition.position, name: definition.name, cardNumber: definition.cardNumber }));
  if (missing.length) return { seeded: false, skipped: true, reason: 'missing-catalog-cards', missing };
  if (new Set(anchors.map(card => Number(card.id))).size !== anchors.length) {
    return { seeded: false, skipped: true, reason: 'duplicate-catalog-cards' };
  }

  const savedAt = new Date().toISOString();
  const workingSlot = Number(database.prepare("SELECT value FROM app_metadata WHERE key = 'break-board-working-preset-slot-v1'").get()?.value || 0);
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare(`
      INSERT INTO break_board_presets (slot, name, saved_at, mapping_mode) VALUES (?, ?, ?, 'SINGLES')
      ON CONFLICT(slot) DO UPDATE SET name = excluded.name, saved_at = excluded.saved_at,
        mapping_mode = excluded.mapping_mode
    `).run(UNLEASHED_TOP80_BOARD_SLOT, UNLEASHED_TOP80_BOARD_NAME, savedAt);
    database.prepare('DELETE FROM break_board_preset_cards WHERE slot = ?').run(UNLEASHED_TOP80_BOARD_SLOT);
    const insertPreset = database.prepare(`
      INSERT INTO break_board_preset_cards (slot, position, card_id, added_at)
      VALUES (?, ?, ?, ?)
    `);
    anchors.forEach((card, index) => insertPreset.run(UNLEASHED_TOP80_BOARD_SLOT, index + 1, card.id, savedAt));

    // Refresh the draft only when Board 1 is already loaded. The current live
    // ledger, buyer calls, pull selections and history stay untouched.
    if (workingSlot === UNLEASHED_TOP80_BOARD_SLOT) {
      database.prepare('DELETE FROM break_board_cards').run();
      const insertWorking = database.prepare('INSERT INTO break_board_cards (card_id, position, added_at) VALUES (?, ?, ?)');
      anchors.forEach((card, index) => insertWorking.run(card.id, index + 1, savedAt));
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
    `).run(UNLEASHED_TOP80_BOARD_MIGRATION_KEY, savedAt);
    database.prepare(`
      INSERT INTO app_metadata (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(UNLEASHED_TOP80_SINGLES_MODE_MIGRATION_KEY, savedAt);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return {
    seeded: true,
    slot: UNLEASHED_TOP80_BOARD_SLOT,
    name: UNLEASHED_TOP80_BOARD_NAME,
    savedCards: anchors.length,
    loadedWorkingBoard: workingSlot === UNLEASHED_TOP80_BOARD_SLOT
  };
}

module.exports = {
  UNLEASHED_TOP80_BOARD_MIGRATION_KEY,
  UNLEASHED_TOP80_BOARD_NAME,
  UNLEASHED_TOP80_BOARD_SLOT,
  UNLEASHED_TOP80_SINGLES_MODE_MIGRATION_KEY,
  UNLEASHED_TOP80_PROFILE_ID,
  UNLEASHED_TOP80_SOURCE_URL,
  UNLEASHED_TOP80_SPOTS,
  buildUnleashedTop80Spot,
  chooseBoardCard,
  collectorNumberKey,
  decorateUnleashedTop80Board,
  ensureUnleashedTop80BoardOne,
  explicitFinish,
  isUnleashedTop80Board,
  matchesTop80Spot,
  spotLabel,
  unleashedTop80SpotForCard
};
