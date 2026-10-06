const { app, BrowserWindow, clipboard, dialog, ipcMain, shell } = require('electron');
// Keep the same Windows user-data folder for portable builds and the installer.
// The installer may show the product name as BreakSuite6, but this permanent
// application name preserves the existing local catalog and image cache.
app.setName('breaksuite6');
// A second click must bring the existing window forward rather than create
// another hidden Electron process. This also prevents the updater from being
// blocked by a pile of background BreakSuite6 instances.
const hasSingleInstanceLock = app.requestSingleInstanceLock();
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const { DatabaseSync } = require('node:sqlite');
const { BandaiImporter } = require('./modules/BandaiImporter');
const { fetchDonCatalog } = require('./modules/DonCatalogSupplements');
const { officialProductSupplements } = require('./modules/OfficialProductSupplements');
const { ALTERNATE_ART, breakRarityForCard, groupRarityEntries, isBreakRarityFilterEntry, MANUAL_GOLD_DON, MANUAL_MANGA, normalizedRarity, rarityFilterDefinition } = require('./modules/RarityFilters');
const { deduplicateOfficialCards, resetLocalLibrary } = require('./modules/LibraryMaintenance');
const { normalizeExistingSpecialCards } = require('./modules/CatalogMigrations');
const { searchTerms } = require('./modules/CatalogSearch');
const { formatBreakBoardListing } = require('./modules/BreakBoard');
const { leadingBlockNumber } = require('./modules/BreakLedger');
const { BREAK_BOARD_PRESET_SLOTS, normalizePresetName, normalizePresetSlot, sameBoardOrder } = require('./modules/BreakBoardPresets');
const { currencyToCents, ensureBreakOrderHistorySchema, normalizeHistoryBreakName, normalizeHistoryNotes, orderHistoryTotals } = require('./modules/BreakOrderHistory');

let mainWindow;
let overlayWindow;
let database;
let importInProgress = false;
let donCatalogSyncPromise = null;
const CONNECTOR_PORT = 8878;
const CONNECTOR_ORIGIN = `http://127.0.0.1:${CONNECTOR_PORT}`;
const OVERLAY_STYLE_KEY = 'overlay-style-v1';
const OVERLAY_FRAME_STYLES = new Set(['color-sync', 'haki-crack', 'holo-reactor', 'boss-awakening']);
const OVERLAY_CORNER_SHAPES = new Set(['rounded', 'bevel', 'square']);
const DEFAULT_OVERLAY_STYLE = Object.freeze({
  frameStyle: 'color-sync',
  primaryColor: '#55dcff',
  secondaryColor: '#9b7dff',
  glowIntensity: 78,
  frameThickness: 3,
  pulseSpeed: 55,
  particles: true,
  cornerShape: 'rounded',
  boardX: 50,
  boardY: 50,
  boardScale: 100,
  popupX: 50,
  popupY: 50,
  popupScale: 100,
  popupDuration: 8
});
const TEST_BUYER_ALIASES = [
  'Test Buyer Aurora', 'Test Buyer Blaze', 'Test Buyer Comet', 'Test Buyer Drift',
  'Test Buyer Echo', 'Test Buyer Frost', 'Test Buyer Glow', 'Test Buyer Harbor',
  'Test Buyer Indigo', 'Test Buyer Juniper', 'Test Buyer Kestrel', 'Test Buyer Luna',
  'Test Buyer Mist', 'Test Buyer Nova', 'Test Buyer Orion', 'Test Buyer Prism',
  'Test Buyer Quartz', 'Test Buyer River', 'Test Buyer Sol', 'Test Buyer Tide'
];
let connectorServer;
let connectorStatus = {
  running: false,
  port: CONNECTOR_PORT,
  error: '',
  lastBlock: null,
  browserOverlayLastSeenAt: null
};

function databaseFile() {
  const folder = path.join(app.getPath('userData'), 'Database');
  fs.mkdirSync(folder, { recursive: true });
  return path.join(folder, 'breaksuite6.sqlite');
}

function imageDirectory() {
  const folder = path.join(app.getPath('userData'), 'Images', 'Bandai');
  fs.mkdirSync(folder, { recursive: true });
  return folder;
}

function addMissingCardColumns() {
  const existing = new Set(database.prepare('PRAGMA table_info(cards)').all().map(column => column.name));
  const needed = {
    image_path: 'TEXT',
    life: 'TEXT',
    cost: 'TEXT',
    attribute: 'TEXT',
    power: 'TEXT',
    counter: 'TEXT',
    block_icon: 'TEXT',
    card_traits: 'TEXT',
    effect_text: 'TEXT',
    set_name: 'TEXT',
    details_json: 'TEXT',
    source_updated_at: 'TEXT',
    source_rarity: 'TEXT',
    variant: "TEXT NOT NULL DEFAULT ''",
    variant_source: "TEXT NOT NULL DEFAULT ''",
    manual_category: "TEXT NOT NULL DEFAULT ''"
  };
  for (const [column, definition] of Object.entries(needed)) {
    if (!existing.has(column)) database.exec(`ALTER TABLE cards ADD COLUMN ${column} ${definition}`);
  }
}

function addMissingActiveBreakBoardColumns() {
  const existing = new Set(database.prepare('PRAGMA table_info(active_break_board_cards)').all().map(column => column.name));
  // These flags are local packing/message workflow metadata. They never alter
  // the official card catalog or the Whatnot/OBS block identity.
  if (!existing.has('message_marked')) {
    database.exec("ALTER TABLE active_break_board_cards ADD COLUMN message_marked INTEGER NOT NULL DEFAULT 0");
  }
  // The price belongs only to the confirmed Whatnot Assigned row. It is kept
  // with that live-ledger block so Buyer Bags can show actual buyer spend
  // without touching the official card catalog or the public overlay.
  if (!existing.has('sale_amount_cents')) {
    database.exec("ALTER TABLE active_break_board_cards ADD COLUMN sale_amount_cents INTEGER NOT NULL DEFAULT 0");
  }
}

function removeMalformedOfficialImports() {
  database.prepare(`
    DELETE FROM cards
    WHERE source = 'Official Bandai'
      AND (name LIKE '%TEXT VIEW%' OR name LIKE '%CARD VIEW%')
  `).run();
}

function repairExistingDonCards() {
  // Older imports stored some DON!! cards with '-' or an empty rarity.  Their
  // card type is still official and reliable, so normalize those existing
  // rows when the update is first opened.  This does not remove any cards.
  database.prepare(`
    UPDATE cards
    SET rarity = CASE
      WHEN LOWER(COALESCE(name, '') || ' ' || COALESCE(image_url, '') || ' ' || COALESCE(details_json, '')) LIKE '%gold%'
        THEN 'GOLD DON'
      ELSE 'DON!! CARD'
    END
    WHERE (
        UPPER(TRIM(COALESCE(card_type, ''))) LIKE 'DON!!%'
        OR UPPER(TRIM(COALESCE(card_number, ''))) LIKE 'DON!!%'
      )
  `).run();
}

function resetLibrary(confirmation) {
  if (importInProgress) throw new Error('Wait for the current official import to finish before clearing the library.');
  return resetLocalLibrary(database, confirmation);
}

async function repairLibrary() {
  if (importInProgress) throw new Error('Wait for the current official import to finish before repairing the library.');
  removeMalformedOfficialImports();
  repairExistingDonCards();
  // Repair is also the safe recovery path for records that are published on a
  // Bandai product page rather than in its Card List.  This is an upsert by a
  // stable official identity, so it adds only a missing record and never
  // creates a second copy of an existing card.
  const supplementResult = ensureOfficialProductSupplements();
  const donSupplementResult = await syncDonCatalog({ force: true });
  const repair = deduplicateOfficialCards(database);
  return { ...repair, ...supplementResult, ...donSupplementResult, totalCards: overview().total };
}

function initializeDatabase() {
  database = new DatabaseSync(databaseFile());
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY,
      official_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      card_number TEXT,
      set_code TEXT,
      rarity TEXT,
      color TEXT,
      card_type TEXT,
      image_url TEXT,
      image_path TEXT,
      detail_url TEXT,
      artist TEXT,
      life TEXT,
      cost TEXT,
      attribute TEXT,
      power TEXT,
      counter TEXT,
      block_icon TEXT,
      card_traits TEXT,
      effect_text TEXT,
      set_name TEXT,
      details_json TEXT,
      imported_at TEXT NOT NULL,
      source_updated_at TEXT,
      source_rarity TEXT,
      variant TEXT NOT NULL DEFAULT '',
      variant_source TEXT NOT NULL DEFAULT '',
      manual_category TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'Bandai'
    );

    CREATE TABLE IF NOT EXISTS saved_cards (
      card_id INTEGER PRIMARY KEY,
      saved_at TEXT NOT NULL,
      FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE CASCADE
    );

    -- The break board is a separate selection layer. It never creates a new
    -- card record and remains intact while the regular library is browsed.
    CREATE TABLE IF NOT EXISTS break_board_cards (
      card_id INTEGER PRIMARY KEY,
      position INTEGER NOT NULL UNIQUE,
      added_at TEXT NOT NULL,
      FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE CASCADE
    );

    -- The saved ledger is the single live board used by the connector and
    -- overlay. Saving simply replaces its rows with the current Break Board;
    -- it is intentionally reusable for every set and every break.
    CREATE TABLE IF NOT EXISTS active_break_board_cards (
      position INTEGER PRIMARY KEY,
      card_id INTEGER NOT NULL UNIQUE,
      saved_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ready',
      buyer_name TEXT NOT NULL DEFAULT '',
      called_at TEXT,
      message_marked INTEGER NOT NULL DEFAULT 0,
      sale_amount_cents INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE CASCADE
    );

    -- Five reusable draft setups let the breaker keep separate 49-card,
    -- 82-card, or other boards without changing the one saved live ledger.
    -- A preset is only copied into the working board when it is loaded; it
    -- never changes OBS or the connector until Save Board is pressed.
    CREATE TABLE IF NOT EXISTS break_board_presets (
      slot INTEGER PRIMARY KEY CHECK(slot BETWEEN 1 AND 5),
      name TEXT NOT NULL DEFAULT '',
      saved_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS break_board_preset_cards (
      slot INTEGER NOT NULL,
      position INTEGER NOT NULL,
      card_id INTEGER NOT NULL,
      added_at TEXT NOT NULL,
      PRIMARY KEY(slot, position),
      UNIQUE(slot, card_id),
      FOREIGN KEY(slot) REFERENCES break_board_presets(slot) ON DELETE CASCADE,
      FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS import_sessions (
      id INTEGER PRIMARY KEY,
      source TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      status TEXT NOT NULL,
      cards_imported INTEGER NOT NULL DEFAULT 0,
      details TEXT
    );

    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  addMissingCardColumns();
  addMissingActiveBreakBoardColumns();
  ensureBreakOrderHistorySchema(database);
  normalizeExistingSpecialCards(database);
  removeMalformedOfficialImports();
  repairExistingDonCards();
  deduplicateOfficialCards(database);
  // A product-page supplement must never prevent the main library window from
  // opening. It is additive only; the normal catalog remains fully usable if
  // Bandai changes a supplemental product page or a local write is busy.
  try {
    ensureOfficialProductSupplements();
  } catch (error) {
    console.error('Unable to add official product-only supplement:', error);
  }
  deduplicateOfficialCards(database);
}

function overview() {
  const total = database.prepare('SELECT COUNT(*) AS count FROM cards').get().count;
  const saved = database.prepare('SELECT COUNT(*) AS count FROM saved_cards').get().count;
  const board = database.prepare('SELECT COUNT(*) AS count FROM break_board_cards').get().count;
  const sets = database.prepare("SELECT COUNT(DISTINCT set_code) AS count FROM cards WHERE set_code IS NOT NULL AND set_code != ''").get().count;
  const latest = database.prepare('SELECT MAX(imported_at) AS date FROM cards').get().date;
  const activeBoard = database.prepare('SELECT COUNT(*) AS count FROM active_break_board_cards').get().count;
  return { total, saved, board, activeBoard, sets, latest };
}

function boundedNumber(value, fallback, minimum, maximum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.round(numeric)));
}

function hexColor(value, fallback) {
  const color = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
}

function normalizeOverlayStyle(value = {}) {
  const style = value && typeof value === 'object' ? value : {};
  return {
    frameStyle: OVERLAY_FRAME_STYLES.has(style.frameStyle) ? style.frameStyle : DEFAULT_OVERLAY_STYLE.frameStyle,
    primaryColor: hexColor(style.primaryColor, DEFAULT_OVERLAY_STYLE.primaryColor),
    secondaryColor: hexColor(style.secondaryColor, DEFAULT_OVERLAY_STYLE.secondaryColor),
    glowIntensity: boundedNumber(style.glowIntensity, DEFAULT_OVERLAY_STYLE.glowIntensity, 20, 100),
    frameThickness: boundedNumber(style.frameThickness, DEFAULT_OVERLAY_STYLE.frameThickness, 1, 8),
    pulseSpeed: boundedNumber(style.pulseSpeed, DEFAULT_OVERLAY_STYLE.pulseSpeed, 15, 100),
    particles: style.particles === undefined ? DEFAULT_OVERLAY_STYLE.particles : Boolean(style.particles),
    cornerShape: OVERLAY_CORNER_SHAPES.has(style.cornerShape) ? style.cornerShape : DEFAULT_OVERLAY_STYLE.cornerShape,
    boardX: boundedNumber(style.boardX, DEFAULT_OVERLAY_STYLE.boardX, 8, 92),
    boardY: boundedNumber(style.boardY, DEFAULT_OVERLAY_STYLE.boardY, 8, 92),
    boardScale: boundedNumber(style.boardScale, DEFAULT_OVERLAY_STYLE.boardScale, 68, 122),
    popupX: boundedNumber(style.popupX, DEFAULT_OVERLAY_STYLE.popupX, 8, 92),
    popupY: boundedNumber(style.popupY, DEFAULT_OVERLAY_STYLE.popupY, 8, 92),
    popupScale: boundedNumber(style.popupScale, DEFAULT_OVERLAY_STYLE.popupScale, 65, 135),
    popupDuration: boundedNumber(style.popupDuration, DEFAULT_OVERLAY_STYLE.popupDuration, 2, 15)
  };
}

function getOverlayStyle() {
  const stored = database.prepare('SELECT value FROM app_metadata WHERE key = ?').get(OVERLAY_STYLE_KEY);
  if (!stored?.value) return { ...DEFAULT_OVERLAY_STYLE };
  try {
    return normalizeOverlayStyle(JSON.parse(stored.value));
  } catch {
    return { ...DEFAULT_OVERLAY_STYLE };
  }
}

function saveOverlayStyle(value) {
  const style = normalizeOverlayStyle(value);
  database.prepare(`
    INSERT INTO app_metadata (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(OVERLAY_STYLE_KEY, JSON.stringify(style));
  return style;
}

function resetOverlayStyle() {
  database.prepare('DELETE FROM app_metadata WHERE key = ?').run(OVERLAY_STYLE_KEY);
  return { ...DEFAULT_OVERLAY_STYLE };
}

function forRenderer(card) {
  if (card) card = { ...card, break_rarity: breakRarityForCard(card) };
  if (card?.image_path && hasUsableCachedImage(card.image_path)) {
    return { ...card, image_url: pathToFileURL(card.image_path).href };
  }
  return card;
}

function hasUsableCachedImage(imagePath) {
  try {
    const descriptor = fs.openSync(imagePath, 'r');
    try {
      const header = Buffer.alloc(16);
      const read = fs.readSync(descriptor, header, 0, header.length, 0);
      if (read < 12) return false;
      const jpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
      const png = header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      const webp = header.subarray(0, 4).toString('ascii') === 'RIFF' && header.subarray(8, 12).toString('ascii') === 'WEBP';
      const gif = header.subarray(0, 3).toString('ascii') === 'GIF';
      return jpeg || png || webp || gif;
    } finally {
      fs.closeSync(descriptor);
    }
  } catch {
    return false;
  }
}

function listCards(filters = {}) {
  const clauses = [];
  const values = [];

  if (filters.query && filters.query.trim()) {
    for (const { plain, compact } of searchTerms(filters.query)) {
      clauses.push(`(
        c.name LIKE ?
        OR REPLACE(REPLACE(UPPER(COALESCE(c.card_number, '')), '-', ''), ' ', '') LIKE ?
        OR REPLACE(REPLACE(UPPER(COALESCE(c.set_code, '')), '-', ''), ' ', '') LIKE ?
        OR UPPER(TRIM(COALESCE(c.rarity, ''))) LIKE ?
        OR UPPER(TRIM(COALESCE(c.manual_category, ''))) LIKE ?
      )`);
      values.push(plain, compact, compact, plain.toUpperCase(), plain.toUpperCase());
    }
  }
  const rarityFilter = rarityFilterDefinition(filters.rarity);
  const rarityValues = rarityFilter.values;
  if (filters.rarity === 'Gold DON!!') {
    clauses.push(`(
      UPPER(TRIM(c.rarity)) IN (${rarityValues.map(() => '?').join(', ')})
      OR TRIM(COALESCE(c.manual_category, '')) = ?
      OR (
        UPPER(TRIM(COALESCE(c.card_type, ''))) LIKE 'DON!!%'
        AND LOWER(COALESCE(c.name, '') || ' ' || COALESCE(c.image_url, '') || ' ' || COALESCE(c.details_json, '')) LIKE '%gold%'
      )
    )`);
    values.push(...rarityValues, MANUAL_GOLD_DON);
  } else if (rarityFilter.manualCategory) {
    clauses.push(`(
      UPPER(TRIM(c.rarity)) IN (${rarityValues.map(() => '?').join(', ')})
      OR TRIM(COALESCE(c.manual_category, '')) = ?
    )`);
    values.push(...rarityValues, rarityFilter.manualCategory);
  } else if (filters.rarity === 'DON!! Card') {
    // The official page has used '-' and blank rarity text for DON!! cards.
    // Filtering by the official card type/number makes every saved DON!!
    // entry visible even when Bandai's rarity label is absent or changes.
    clauses.push(`(
      UPPER(TRIM(c.rarity)) IN (${rarityValues.map(() => '?').join(', ')})
      OR UPPER(TRIM(COALESCE(c.card_type, ''))) LIKE 'DON!!%'
      OR UPPER(TRIM(COALESCE(c.card_number, ''))) LIKE 'DON!!%'
    )`);
    values.push(...rarityValues);
  } else if (rarityValues.length) {
    clauses.push(`UPPER(TRIM(c.rarity)) IN (${rarityValues.map(() => '?').join(', ')})`);
    values.push(...rarityValues);
  }
  if (rarityFilter.requiredVariant) {
    clauses.push("LOWER(TRIM(COALESCE(c.variant, ''))) = ?");
    values.push(rarityFilter.requiredVariant.toLowerCase());
  } else if (rarityFilter.excludedVariant) {
    clauses.push("LOWER(TRIM(COALESCE(c.variant, ''))) != ?");
    values.push(rarityFilter.excludedVariant.toLowerCase());
  }
  if (rarityFilter.excludesManualCategory) {
    clauses.push("TRIM(COALESCE(c.manual_category, '')) = ''");
  }
  if (filters.savedOnly) {
    clauses.push('s.card_id IS NOT NULL');
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return database.prepare(`
    SELECT c.*, CASE WHEN s.card_id IS NULL THEN 0 ELSE 1 END AS is_saved,
      CASE WHEN b.card_id IS NULL THEN 0 ELSE 1 END AS is_on_board
    FROM cards c
    LEFT JOIN saved_cards s ON s.card_id = c.id
    LEFT JOIN break_board_cards b ON b.card_id = c.id
    ${where}
    ORDER BY c.set_code ASC, c.card_number ASC, c.name ASC
    LIMIT 300
  `).all(...values).map(forRenderer);
}

function listRarities() {
  const entries = database.prepare(`
    SELECT TRIM(rarity) AS value, TRIM(COALESCE(variant, '')) AS variant,
      TRIM(COALESCE(manual_category, '')) AS manual_category, COUNT(*) AS count
    FROM cards
    WHERE TRIM(COALESCE(rarity, '')) != ''
    GROUP BY TRIM(rarity), TRIM(COALESCE(variant, '')), TRIM(COALESCE(manual_category, ''))
  `).all();
  // P is Bandai's promotional-card source code. Keep those records in the
  // catalog, but do not present P as a break rarity unless a user has given
  // that specific card a real local classification such as Manga.
  return groupRarityEntries(entries.filter(isBreakRarityFilterEntry));
}

function getCard(id) {
  const card = database.prepare(`
    SELECT c.*, CASE WHEN s.card_id IS NULL THEN 0 ELSE 1 END AS is_saved,
      CASE WHEN b.card_id IS NULL THEN 0 ELSE 1 END AS is_on_board,
      b.position AS board_position
    FROM cards c
    LEFT JOIN saved_cards s ON s.card_id = c.id
    LEFT JOIN break_board_cards b ON b.card_id = c.id
    WHERE c.id = ?
  `).get(id) || null;
  return card ? forRenderer(card) : null;
}

function setSaved(id, shouldSave) {
  if (shouldSave) {
    database.prepare('INSERT OR IGNORE INTO saved_cards (card_id, saved_at) VALUES (?, ?)').run(id, new Date().toISOString());
  } else {
    database.prepare('DELETE FROM saved_cards WHERE card_id = ?').run(id);
  }
  return getCard(id);
}

function listBreakBoardCards() {
  return database.prepare(`
    SELECT c.*, b.position, CASE WHEN s.card_id IS NULL THEN 0 ELSE 1 END AS is_saved,
      1 AS is_on_board
    FROM break_board_cards b
    JOIN cards c ON c.id = b.card_id
    LEFT JOIN saved_cards s ON s.card_id = c.id
    ORDER BY b.position ASC
  `).all().map(forRenderer);
}

function listActiveBreakBoardCards() {
  return database.prepare(`
    SELECT c.*, b.position, b.status AS block_status, b.buyer_name, b.called_at, b.message_marked, b.sale_amount_cents,
      CASE WHEN s.card_id IS NULL THEN 0 ELSE 1 END AS is_saved,
      1 AS is_on_board
    FROM active_break_board_cards b
    JOIN cards c ON c.id = b.card_id
    LEFT JOIN saved_cards s ON s.card_id = c.id
    ORDER BY b.position ASC
  `).all().map(forRenderer);
}

function listBreakOrderHistory() {
  const histories = database.prepare(`
    SELECT id, break_name, box_cost_cents, gross_sales_cents, priced_order_count,
      unpriced_order_count, confirmed_order_count, notes, recorded_at
    FROM break_order_history
    ORDER BY recorded_at DESC, id DESC
  `).all();
  const listItems = database.prepare(`
    SELECT position, buyer_name, card_name, card_number, set_code, rarity,
      sale_amount_cents, assigned_at
    FROM break_order_history_items
    WHERE history_id = ?
    ORDER BY position ASC
  `);
  return histories.map(history => ({
    ...history,
    items: listItems.all(history.id)
  }));
}

function historyDefaultBreakName(items) {
  const setCodes = [...new Set(items.map(item => String(item.set_code || '').trim()).filter(Boolean))];
  if (setCodes.length === 1) return `${setCodes[0]} character break`;
  return 'Saved character break';
}

function saveBreakOrderHistory(payload = {}) {
  if (!isLiveLedgerCurrent()) throw new Error('Save Board ✓ first so the order history can snapshot the current live ledger.');
  // Only confirmed live assignments belong to accounting history. Pending
  // payment rows never reach the ledger; test rows are intentionally excluded.
  const assigned = database.prepare(`
    SELECT b.position, b.buyer_name, b.called_at, b.sale_amount_cents,
      c.name AS card_name, c.card_number, c.set_code, c.rarity, c.variant,
      c.manual_category
    FROM active_break_board_cards b
    JOIN cards c ON c.id = b.card_id
    WHERE b.status = 'called'
      AND TRIM(b.buyer_name) != ''
    ORDER BY b.position ASC
  `).all().map(row => ({
    ...row,
    rarity: breakRarityForCard(row) || row.rarity || ''
  }));
  if (!assigned.length) throw new Error('There are no confirmed Assigned spots to store yet. Pending payments and test cards are not saved to history.');

  const recordedAt = new Date().toISOString();
  const boxCostCents = currencyToCents(payload.boxCost);
  const totals = orderHistoryTotals(assigned);
  const breakName = normalizeHistoryBreakName(payload.breakName, historyDefaultBreakName(assigned));
  const notes = normalizeHistoryNotes(payload.notes);

  database.exec('BEGIN IMMEDIATE');
  try {
    const history = database.prepare(`
      INSERT INTO break_order_history (
        break_name, box_cost_cents, gross_sales_cents, priced_order_count,
        unpriced_order_count, confirmed_order_count, notes, recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      breakName,
      boxCostCents,
      totals.grossSalesCents,
      totals.pricedOrderCount,
      totals.unpricedOrderCount,
      totals.confirmedOrderCount,
      notes,
      recordedAt
    );
    const historyId = Number(history.lastInsertRowid);
    const insertItem = database.prepare(`
      INSERT INTO break_order_history_items (
        history_id, position, buyer_name, card_name, card_number, set_code,
        rarity, sale_amount_cents, assigned_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    assigned.forEach(item => insertItem.run(
      historyId,
      Number(item.position),
      String(item.buyer_name || '').trim(),
      String(item.card_name || '').trim(),
      String(item.card_number || '').trim(),
      String(item.set_code || '').trim(),
      String(item.rarity || '').trim(),
      Math.max(0, Number(item.sale_amount_cents || 0)),
      item.called_at || null
    ));
    database.exec('COMMIT');
    return {
      id: historyId,
      breakName,
      boxCostCents,
      ...totals,
      recordedAt
    };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function compactBreakBoardPositions() {
  const rows = database.prepare('SELECT card_id FROM break_board_cards ORDER BY position ASC').all();
  if (!rows.length) return { count: 0, renumbered: false };
  const renumbered = rows.some((row, index) => Number(row.position) !== index + 1);
  if (!renumbered) return { count: rows.length, renumbered: false };
  // The temporary negative positions avoid SQLite's UNIQUE(position)
  // collision while compacting a board after a card is removed or an older
  // saved setup with a missing block number is loaded.
  database.prepare('UPDATE break_board_cards SET position = -position').run();
  const update = database.prepare('UPDATE break_board_cards SET position = ? WHERE card_id = ?');
  rows.forEach((row, index) => update.run(index + 1, row.card_id));
  return { count: rows.length, renumbered: true };
}

function breakBoardOverview() {
  const count = database.prepare('SELECT COUNT(*) AS count FROM break_board_cards').get().count;
  const activeCount = database.prepare('SELECT COUNT(*) AS count FROM active_break_board_cards').get().count;
  const working = database.prepare('SELECT card_id, position FROM break_board_cards ORDER BY position ASC').all();
  const active = database.prepare('SELECT card_id, position FROM active_break_board_cards ORDER BY position ASC').all();
  const ready = count > 0 && count === activeCount && working.every((row, index) => row.card_id === active[index]?.card_id && row.position === active[index]?.position);
  return { count, activeCount, ready };
}

function setCardOnBreakBoard(id, shouldShow) {
  const cardId = Number(id);
  if (!Number.isInteger(cardId) || cardId < 1) throw new Error('Choose a valid library card first.');
  if (!database.prepare('SELECT id FROM cards WHERE id = ?').get(cardId)) throw new Error('That card is no longer in the local library.');
  if (shouldShow) {
    const nextPosition = database.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS position FROM break_board_cards').get().position;
    database.prepare('INSERT OR IGNORE INTO break_board_cards (card_id, position, added_at) VALUES (?, ?, ?)')
      .run(cardId, nextPosition, new Date().toISOString());
  } else {
    database.prepare('DELETE FROM break_board_cards WHERE card_id = ?').run(cardId);
  }
  compactBreakBoardPositions();
  return getCard(cardId);
}

function clearBreakBoard() {
  const removedCards = database.prepare('SELECT COUNT(*) AS count FROM break_board_cards').get().count;
  database.prepare('DELETE FROM break_board_cards').run();
  return { removedCards };
}

function listBreakBoardPresets() {
  const saved = database.prepare(`
    SELECT p.slot, p.name, p.saved_at, COUNT(pc.card_id) AS card_count
    FROM break_board_presets p
    LEFT JOIN break_board_preset_cards pc ON pc.slot = p.slot
    GROUP BY p.slot, p.name, p.saved_at
  `).all();
  const savedBySlot = new Map(saved.map(preset => [Number(preset.slot), preset]));
  const working = database.prepare('SELECT card_id, position FROM break_board_cards ORDER BY position ASC').all();
  return BREAK_BOARD_PRESET_SLOTS.map(slot => {
    const preset = savedBySlot.get(slot);
    const cards = preset
      ? database.prepare('SELECT card_id, position FROM break_board_preset_cards WHERE slot = ? ORDER BY position ASC').all(slot)
      : [];
    return {
      slot,
      name: String(preset?.name || ''),
      savedAt: preset?.saved_at || null,
      count: Number(preset?.card_count || 0),
      isLoaded: cards.length > 0 && sameBoardOrder(working, cards)
    };
  });
}

function saveBreakBoardPreset(value = {}) {
  const slot = normalizePresetSlot(value.slot);
  compactBreakBoardPositions();
  const cards = listBreakBoardCards();
  if (!cards.length) throw new Error('Add at least one card before saving a board setup.');
  const savedAt = new Date().toISOString();
  const name = normalizePresetName(value.name, `Board ${slot}`);
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare(`
      INSERT INTO break_board_presets (slot, name, saved_at) VALUES (?, ?, ?)
      ON CONFLICT(slot) DO UPDATE SET name = excluded.name, saved_at = excluded.saved_at
    `).run(slot, name, savedAt);
    database.prepare('DELETE FROM break_board_preset_cards WHERE slot = ?').run(slot);
    const insert = database.prepare(`
      INSERT INTO break_board_preset_cards (slot, position, card_id, added_at)
      VALUES (?, ?, ?, ?)
    `);
    cards.forEach(card => insert.run(slot, card.position, card.id, savedAt));
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return { slot, name, savedAt, savedCards: cards.length };
}

function loadBreakBoardPreset(value) {
  const slot = normalizePresetSlot(value);
  const preset = database.prepare('SELECT slot, name, saved_at FROM break_board_presets WHERE slot = ?').get(slot);
  if (!preset) throw new Error(`Save a board in setup ${slot} before loading it.`);
  const cards = database.prepare(`
    SELECT card_id, position, added_at
    FROM break_board_preset_cards
    WHERE slot = ?
    ORDER BY position ASC
  `).all(slot);
  if (!cards.length) throw new Error(`Saved setup ${slot} has no cards.`);
  const renumbered = cards.some((card, index) => Number(card.position) !== index + 1);
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare('DELETE FROM break_board_cards').run();
    const insert = database.prepare('INSERT INTO break_board_cards (card_id, position, added_at) VALUES (?, ?, ?)');
    cards.forEach((card, index) => insert.run(card.card_id, index + 1, card.added_at));
    // Upgrade the saved setup too. This preserves its card order but prevents
    // an old gap (for example 1–8, 10–83) from coming back on a later load.
    if (renumbered) {
      database.prepare('UPDATE break_board_preset_cards SET position = -position WHERE slot = ?').run(slot);
      const updatePresetPosition = database.prepare('UPDATE break_board_preset_cards SET position = ? WHERE slot = ? AND card_id = ?');
      cards.forEach((card, index) => updatePresetPosition.run(index + 1, slot, card.card_id));
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return { slot, name: preset.name, savedAt: preset.saved_at, loadedCards: cards.length, renumbered };
}

function clearBreakBoardPreset(value) {
  const slot = normalizePresetSlot(value);
  const preset = database.prepare('SELECT name FROM break_board_presets WHERE slot = ?').get(slot);
  if (!preset) return { slot, removedCards: 0, removed: false };
  const removedCards = database.prepare('SELECT COUNT(*) AS count FROM break_board_preset_cards WHERE slot = ?').get(slot).count;
  database.prepare('DELETE FROM break_board_presets WHERE slot = ?').run(slot);
  return { slot, removedCards, removed: true };
}

function saveBreakBoard() {
  const numbering = compactBreakBoardPositions();
  const cards = listBreakBoardCards();
  if (!cards.length) throw new Error('Add at least one card before saving the live ledger.');
  const savedAt = new Date().toISOString();
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare('DELETE FROM active_break_board_cards').run();
    const insert = database.prepare(`
      INSERT INTO active_break_board_cards (position, card_id, saved_at, status, buyer_name, called_at, message_marked)
      VALUES (?, ?, ?, 'ready', '', NULL, 0)
    `);
    cards.forEach(card => insert.run(card.position, card.id, savedAt));
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  connectorStatus.lastBlock = null;
  return { savedCards: cards.length, savedAt, renumbered: numbering.renumbered };
}

function isLiveLedgerCurrent() {
  return breakBoardOverview().ready;
}

function getConnectorStatus() {
  const board = breakBoardOverview();
  const ledgerSavedAt = database.prepare('SELECT MAX(saved_at) AS value FROM active_break_board_cards').get().value || null;
  const testAssignments = database.prepare("SELECT COUNT(*) AS count FROM active_break_board_cards WHERE status = 'test-called'").get().count;
  const overlayHeartbeatAgeMs = connectorStatus.browserOverlayLastSeenAt
    ? Date.now() - new Date(connectorStatus.browserOverlayLastSeenAt).getTime()
    : null;
  return {
    ...connectorStatus,
    overlayOpen: Boolean(overlayWindow && !overlayWindow.isDestroyed()),
    browserOverlayConnected: overlayHeartbeatAgeMs !== null && overlayHeartbeatAgeMs < 15000,
    overlayHeartbeatAgeMs,
    boardCards: board.count,
    activeCards: board.activeCount,
    boardReady: board.ready,
    ledgerSavedAt,
    testAssignments
  };
}

function notifyConnectorStatus() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('connector:status-changed', getConnectorStatus());
  }
}

function broadcastBreakBoardChange() {
  const draftCards = listBreakBoardCards();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('break:board-changed', draftCards);
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('break:board-changed', listActiveBreakBoardCards());
  }
  notifyConnectorStatus();
}

function cardForActivePosition(position) {
  const card = database.prepare(`
    SELECT c.*, b.position, b.status AS block_status, b.buyer_name, b.called_at, b.sale_amount_cents
    FROM active_break_board_cards b
    JOIN cards c ON c.id = b.card_id
    WHERE b.position = ?
  `).get(position);
  return card ? forRenderer(card) : null;
}

function receiveLedgerBlock(value, { source = 'Connector', buyerName = '', saleAmountCents = 0, assignmentStatus = 'called' } = {}) {
  const position = leadingBlockNumber(value);
  if (!position) throw new Error('The connector needs the first block number, such as 17.');
  if (!isLiveLedgerCurrent()) throw new Error('Save Board ✓ first so the connector has a current live ledger.');
  const target = cardForActivePosition(position);
  if (!target) throw new Error(`Block ${position} is not on the saved live ledger.`);
  const status = assignmentStatus === 'test-called' ? 'test-called' : 'called';
  if (status === 'test-called' && target.block_status !== 'ready') {
    throw new Error(`Block ${position} is already assigned. Reset the simulated test or choose a ready block.`);
  }
  // Whatnot can repaint the same Assigned row several times while the page is
  // updating. A repeated live row must never re-count, re-announce, or replace
  // the buyer already stored for that ledger block.
  const amountCents = normalizeSaleAmountCents(saleAmountCents);
  if (status === 'called' && target.block_status !== 'ready') {
    // A detail row can arrive before its price is rendered. Keep a prior
    // confirmed amount, but accept a later non-zero price for the same spot.
    if (amountCents > 0 && Number(target.sale_amount_cents || 0) !== amountCents) {
      database.prepare('UPDATE active_break_board_cards SET sale_amount_cents = ? WHERE position = ?').run(amountCents, position);
      broadcastBreakBoardChange();
      return cardForActivePosition(position);
    }
    return target;
  }
  const receivedAt = new Date().toISOString();
  database.prepare(`
    UPDATE active_break_board_cards
    SET status = ?, buyer_name = ?, called_at = ?, message_marked = 0, sale_amount_cents = ?
    WHERE position = ?
  `).run(status, String(buyerName || '').trim(), receivedAt, status === 'called' ? amountCents : 0, position);
  connectorStatus.lastBlock = {
    position,
    cardId: target.id,
    cardName: target.name,
    source,
    receivedAt
  };
  broadcastBreakBoardChange();
  return cardForActivePosition(position);
}

function receiveConnectorPayload(payload, { test = false } = {}) {
  return receiveLedgerBlock(connectorValueFromPayload(payload), {
    source: String(payload?.source || (test ? 'Simulated Whatnot assigned row' : 'Connector')).slice(0, 80),
    buyerName: String(payload?.buyerName || payload?.buyer || '').slice(0, 180),
    saleAmountCents: saleAmountCentsFromPayload(payload),
    assignmentStatus: test ? 'test-called' : 'called'
  });
}

function comparableBuyerName(value) {
  return String(value || '').trim().replace(/^@+/, '').toLowerCase();
}

function releaseLedgerBlock(value, { source = 'Whatnot assignment reversed', buyerName = '' } = {}) {
  const position = leadingBlockNumber(value);
  if (!position) throw new Error('The connector needs the first block number, such as 17.');
  if (!isLiveLedgerCurrent()) throw new Error('Save Board ✓ first so the connector has a current live ledger.');
  const target = cardForActivePosition(position);
  if (!target) throw new Error(`Block ${position} is not on the saved live ledger.`);

  // A stale page repaint must never return a newer buyer's card to the board.
  // When Whatnot gives the same numbered spot to somebody else, only the
  // buyer that originally owned the called block is allowed to release it.
  const expectedBuyer = comparableBuyerName(buyerName);
  const storedBuyer = comparableBuyerName(target.buyer_name);
  if (target.block_status === 'ready' || target.block_status === 'test-called' || (expectedBuyer && storedBuyer && expectedBuyer !== storedBuyer)) {
    return { ...target, released: false };
  }

  database.prepare(`
    UPDATE active_break_board_cards
    SET status = 'ready', buyer_name = '', called_at = NULL, message_marked = 0, sale_amount_cents = 0
    WHERE position = ? AND status = 'called'
  `).run(position);
  connectorStatus.lastBlock = {
    position,
    cardId: target.id,
    cardName: target.name,
    source,
    receivedAt: new Date().toISOString(),
    action: 'released'
  };
  broadcastBreakBoardChange();
  return { ...cardForActivePosition(position), released: true };
}

function setBuyerMessageCardMarked(value, shouldMark) {
  const position = leadingBlockNumber(value);
  if (!position) throw new Error('Choose a valid assigned block to include in the buyer message.');
  if (!isLiveLedgerCurrent()) throw new Error('Save Board ✓ first so Buyer Bags have a current live ledger.');
  const target = cardForActivePosition(position);
  if (!target || target.block_status === 'ready') throw new Error(`Block ${position} is not currently in a Buyer Bag.`);
  database.prepare(`
    UPDATE active_break_board_cards
    SET message_marked = ?
    WHERE position = ? AND status != 'ready'
  `).run(shouldMark ? 1 : 0, position);
  broadcastBreakBoardChange();
  return cardForActivePosition(position);
}

function clearBuyerMessageSelections(value) {
  const buyer = String(value || '').trim().replace(/^@+/, '');
  if (!buyer) throw new Error('Choose a Buyer Bag first.');
  if (!isLiveLedgerCurrent()) throw new Error('Save Board ✓ first so Buyer Bags have a current live ledger.');
  const result = database.prepare(`
    UPDATE active_break_board_cards
    SET message_marked = 0
    WHERE status != 'ready'
      AND LOWER(TRIM(REPLACE(buyer_name, '@', ''))) = ?
      AND message_marked != 0
  `).run(comparableBuyerName(buyer));
  broadcastBreakBoardChange();
  return { buyer, clearedCards: result.changes };
}

function copyBuyerCongratulations(value) {
  const buyer = String(value || '').trim().replace(/^@+/, '');
  if (!buyer) throw new Error('Choose a Buyer Bag first.');
  const buyerKey = comparableBuyerName(buyer);
  const cards = database.prepare(`
    SELECT c.*, b.position, b.status AS block_status, b.buyer_name, b.message_marked
    FROM active_break_board_cards b
    JOIN cards c ON c.id = b.card_id
    WHERE b.status != 'ready'
      AND LOWER(TRIM(REPLACE(b.buyer_name, '@', ''))) = ?
      AND b.message_marked = 1
    ORDER BY b.position ASC
  `).all(buyerKey).map(forRenderer);
  if (!cards.length) throw new Error(`Mark at least one card in @${buyer}'s bag first.`);
  const list = cards.map(card => {
    const rarity = breakRarityForCard(card) || card.rarity || 'Card';
    const identity = [card.name, rarity].filter(Boolean).join(' — ');
    return `• ${identity} (Spot ${card.position})`;
  }).join('\n');
  const message = `Hi @${buyer},\n\nThank you for stopping by! Here are your pulls:\n\n${list}\n\nI truly appreciate your support!\n\n⭐⭐⭐⭐⭐`;
  clipboard.writeText(message);
  return { buyer, copiedCards: cards.length, message };
}

function receiveConnectorReversal(payload) {
  return releaseLedgerBlock(connectorValueFromPayload(payload), {
    source: String(payload?.source || 'Whatnot assignment reversed').slice(0, 80),
    buyerName: String(payload?.buyerName || payload?.buyer || '').slice(0, 180)
  });
}

function reconcileConnectorAssignments(payload) {
  if (!isLiveLedgerCurrent()) throw new Error('Save Board ✓ first so the connector has a current live ledger.');
  const assignments = Array.isArray(payload?.assignments) ? payload.assignments : [];
  const currentByPosition = new Map();
  assignments.forEach(assignment => {
    const position = leadingBlockNumber(connectorValueFromPayload(assignment));
    const buyer = String(assignment?.buyer || assignment?.buyerName || '').trim().replace(/^@+/, '');
    if (position && buyer) currentByPosition.set(position, { buyer, saleAmountCents: saleAmountCentsFromPayload(assignment) });
  });
  const ledgerBlocks = database.prepare(`
    SELECT b.position, b.status, b.buyer_name, b.sale_amount_cents, c.id, c.name
    FROM active_break_board_cards b
    JOIN cards c ON c.id = b.card_id
    ORDER BY b.position ASC
  `).all();
  const byPosition = new Map(ledgerBlocks.map(block => [Number(block.position), block]));
  const receivedAt = new Date().toISOString();
  const adopted = [];
  const reassigned = [];
  const returned = [];
  const claim = database.prepare(`
    UPDATE active_break_board_cards
    SET status = 'called', buyer_name = ?, called_at = ?, message_marked = 0, sale_amount_cents = ?
    WHERE position = ? AND status != 'test-called'
  `);
  const release = database.prepare(`
    UPDATE active_break_board_cards
    SET status = 'ready', buyer_name = '', called_at = NULL, message_marked = 0, sale_amount_cents = 0
    WHERE position = ? AND status = 'called'
  `);
  // `node:sqlite` exposes BEGIN/COMMIT through `exec`; unlike better-sqlite3
  // it does not provide a `database.transaction()` helper.  Keep the whole
  // reconciliation atomic so a partially-read Whatnot list can never leave
  // the live ledger half updated.
  database.exec('BEGIN IMMEDIATE');
  try {
    // Adopt every row currently visible in Whatnot's Assigned section. This is
    // intentionally not a new-event path: arming after sales happened must
    // immediately bring those already-taken spots into Breaker Center.
    currentByPosition.forEach((assignment, position) => {
      const block = byPosition.get(position);
      if (!block || block.status === 'test-called') return;
      const priorBuyer = comparableBuyerName(block.buyer_name);
      const nextBuyer = comparableBuyerName(assignment.buyer);
      // Never erase a confirmed price when Whatnot temporarily renders an
      // Assigned row before the amount is visible.
      const amountCents = assignment.saleAmountCents > 0
        ? assignment.saleAmountCents
        : normalizeSaleAmountCents(block.sale_amount_cents);
      if (block.status === 'called' && priorBuyer === nextBuyer && Number(block.sale_amount_cents || 0) === amountCents) return;
      if (claim.run(assignment.buyer, receivedAt, amountCents, position).changes !== 1) return;
      const item = { position, cardId: block.id, cardName: block.name, buyer: assignment.buyer, saleAmountCents: amountCents };
      if (block.status === 'ready') adopted.push(item);
      else reassigned.push(item);
    });

    // A real called row absent from the current Assigned list was returned,
    // rerolled, or cancelled. Test rows are never changed by this sync.
    ledgerBlocks.filter(block => block.status === 'called').forEach(block => {
      const current = currentByPosition.get(Number(block.position));
      if (current && comparableBuyerName(current.buyer) === comparableBuyerName(block.buyer_name)) return;
      if (release.run(block.position).changes === 1) {
        returned.push({ position: Number(block.position), cardId: block.id, cardName: block.name });
      }
    });
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  if (adopted.length || reassigned.length || returned.length) {
    const last = [...adopted, ...reassigned].at(-1) || returned.at(-1);
    connectorStatus.lastBlock = {
      position: last.position,
      cardId: last.cardId,
      cardName: last.cardName,
      source: adopted.length || reassigned.length ? 'Whatnot Assigned list synchronized' : 'Whatnot Assigned list reconciled',
      receivedAt,
      action: returned.length && !adopted.length && !reassigned.length ? 'released' : 'claimed'
    };
    broadcastBreakBoardChange();
  }
  return {
    foundCount: currentByPosition.size,
    deliveredCount: adopted.length,
    reassignedCount: reassigned.length,
    releasedCount: returned.length,
    deliveredBlocks: adopted,
    reassignedBlocks: reassigned,
    releasedBlocks: returned
  };
}

function resetTestAssignments() {
  const result = database.prepare(`
    UPDATE active_break_board_cards
    SET status = 'ready', buyer_name = '', called_at = NULL, message_marked = 0, sale_amount_cents = 0
    WHERE status = 'test-called'
  `).run();
  if (/^(Simulated Whatnot assigned row|Automated 15-buyer stress test)$/.test(connectorStatus.lastBlock?.source || '')) connectorStatus.lastBlock = null;
  broadcastBreakBoardChange();
  return { resetBlocks: result.changes };
}

function shuffled(items) {
  const values = [...items];
  for (let index = values.length - 1; index > 0; index -= 1) {
    const replacement = Math.floor(Math.random() * (index + 1));
    [values[index], values[replacement]] = [values[replacement], values[index]];
  }
  return values;
}

function runFullLedgerStressTest() {
  if (!isLiveLedgerCurrent()) throw new Error('Save Board ✓ first so the automated test has a current live ledger.');

  // A new run always starts cleanly, but only releases prior simulated calls.
  // Real connector assignments remain called and are never changed by this tool.
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare(`
      UPDATE active_break_board_cards
      SET status = 'ready', buyer_name = '', called_at = NULL, message_marked = 0, sale_amount_cents = 0
      WHERE status = 'test-called'
    `).run();
    const readyBlocks = database.prepare(`
      SELECT position
      FROM active_break_board_cards
      WHERE status = 'ready'
      ORDER BY position
    `).all();
    if (!readyBlocks.length) throw new Error('There are no ready saved blocks available for the automated test.');

    const buyerCount = Math.min(15, readyBlocks.length);
    const buyers = shuffled(TEST_BUYER_ALIASES).slice(0, buyerCount);
    const assignments = shuffled(readyBlocks).map((block, index) => ({
      position: Number(block.position),
      buyer: buyers[index % buyers.length]
    }));
    const calledAt = new Date().toISOString();
    const assign = database.prepare(`
    UPDATE active_break_board_cards
      SET status = 'test-called', buyer_name = ?, called_at = ?, message_marked = 0, sale_amount_cents = 0
      WHERE position = ? AND status = 'ready'
    `);
    assignments.forEach(assignment => {
      const result = assign.run(assignment.buyer, calledAt, assignment.position);
      if (result.changes !== 1) throw new Error(`Block ${assignment.position} could not be reserved for the automated test.`);
    });
    database.exec('COMMIT');

    const lastAssignment = assignments.at(-1);
    const lastCard = lastAssignment ? cardForActivePosition(lastAssignment.position) : null;
    connectorStatus.lastBlock = lastCard ? {
      position: lastCard.position,
      cardId: lastCard.id,
      cardName: lastCard.name,
      source: 'Automated 15-buyer stress test',
      receivedAt: calledAt
    } : null;
    broadcastBreakBoardChange();
    return {
      assignedCards: assignments.length,
      buyerCount: buyers.length,
      buyers,
      remainingReadyCards: 0
    };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function setCardClassification(id, classification) {
  const normalizedId = Number(id);
  const normalizedClassification = String(classification || '').trim();
  if (!Number.isInteger(normalizedId) || normalizedId < 1) throw new Error('Choose a valid card before changing its classification.');
  if (![ '', ALTERNATE_ART, MANUAL_MANGA, MANUAL_GOLD_DON ].includes(normalizedClassification)) throw new Error('Choose Alternate Art, Manga, Gold DON!!, or Standard.');
  const isAlternateArt = normalizedClassification === ALTERNATE_ART;
  const manualCategory = [MANUAL_MANGA, MANUAL_GOLD_DON].includes(normalizedClassification) ? normalizedClassification : '';
  const result = database.prepare(`
    UPDATE cards
    SET variant = ?, variant_source = ?, manual_category = ?
    WHERE id = ?
  `).run(isAlternateArt ? ALTERNATE_ART : '', isAlternateArt ? 'Manual' : '', manualCategory, normalizedId);
  if (!result.changes) throw new Error('That card is no longer in the local library.');
  return getCard(normalizedId);
}

function deriveSetCode(card) {
  if (/^(?:OP|ST|EB|PRB|PB|P|DP)-?\d{1,3}$/i.test(String(card.set_code || '').trim())) {
    const explicit = String(card.set_code).trim().toUpperCase();
    return explicit.includes('-') ? explicit : explicit.replace(/^([A-Z]+)(\d+)/, '$1-$2');
  }
  const source = `${card.setName || ''} ${card.card_number || ''}`;
  if (/\bOP-?PR\b/i.test(source)) return 'OP-PR';
  if (/\bOPDD\b/i.test(source)) return 'OPDD';
  const found = source.match(/\b(?:OP|ST|EB|PRB|PB|P|DP)-?\d{1,3}\b/i);
  if (!found) return '';
  const normalized = found[0].toUpperCase();
  return normalized.includes('-') ? normalized : normalized.replace(/^([A-Z]+)(\d+)/, '$1-$2');
}

function ensureOfficialProductSupplements() {
  const supplements = officialProductSupplements();
  if (!supplements.length) return { addedOfficialCards: 0, refreshedOfficialCards: 0 };
  const existingRecord = database.prepare('SELECT official_id, image_url FROM cards WHERE official_id = ?');
  const missing = [];
  const needsRefresh = [];
  for (const card of supplements) {
    const existing = existingRecord.get(card.official_id);
    if (!existing) {
      missing.push(card);
      needsRefresh.push(card);
    } else if (String(existing.image_url || '') !== String(card.image_url || '')) {
      // The prior product page used a packaging artwork address. Remove only
      // that stale local image reference before saving the corrected full-card
      // image; no card record, saved card, or manual classification is removed.
      database.prepare('UPDATE cards SET image_path = ? WHERE official_id = ?').run('', card.official_id);
      needsRefresh.push(card);
    }
  }
  if (needsRefresh.length) saveImportedCards(needsRefresh, new Date().toISOString());
  return { addedOfficialCards: missing.length, refreshedOfficialCards: needsRefresh.length - missing.length };
}

async function cacheProductSupplementImages() {
  const importer = new BandaiImporter({ imageDirectory: imageDirectory(), saveCards: saveImportedCards });
  let cachedImages = 0;
  for (const card of officialProductSupplements()) {
    try {
      const imagePath = await importer.cacheImage(card);
      if (!imagePath) continue;
      saveImportedCards([{ ...card, image_path: imagePath }], new Date().toISOString());
      cachedImages += 1;
    } catch {
      // The direct image address remains available to the renderer, and an
      // unavailable image host must never affect the rest of the library.
    }
  }
  return cachedImages;
}

function donorLogicalIdentity(card) {
  const setCode = deriveSetCode(card);
  const name = String(card.name || '')
    .toUpperCase()
    .replace(/DON!!\s*CARD/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
  return `${setCode}|${name}`;
}

function getMetadata(key) {
  return database.prepare('SELECT value FROM app_metadata WHERE key = ?').get(key)?.value || '';
}

function setMetadata(key, value) {
  database.prepare(`
    INSERT INTO app_metadata (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

async function cacheDonSupplementImages(cards) {
  if (!cards.length) return 0;
  const importer = new BandaiImporter({ imageDirectory: imageDirectory(), saveCards: saveImportedCards });
  let next = 0;
  let cachedImages = 0;
  const workers = Array.from({ length: Math.min(3, cards.length) }, async () => {
    while (next < cards.length) {
      const card = cards[next++];
      try {
        const imagePath = await importer.cacheImage(card);
        if (!imagePath) continue;
        saveImportedCards([{ ...card, image_path: imagePath }], new Date().toISOString());
        cachedImages += 1;
      } catch {
        // A temporarily unavailable supplemental image remains usable from its
        // public address and can be cached on the next repair.
      }
    }
  });
  await Promise.all(workers);
  return cachedImages;
}

async function syncDonCatalog({ force = false } = {}) {
  if (!force && getMetadata('don-catalog-supplement-v3')) {
    return { addedDonCards: 0, refreshedDonCards: 0, cachedDonImages: 0, skippedDonCatalogSync: true };
  }
  if (donCatalogSyncPromise) return donCatalogSyncPromise;
  donCatalogSyncPromise = (async () => {
    const catalogCards = await fetchDonCatalog();
    const existing = database.prepare(`
      SELECT official_id, image_url, image_path, name, set_code, card_type
      FROM cards
      WHERE UPPER(TRIM(COALESCE(card_type, ''))) LIKE 'DON!!%'
    `).all();
    const byOfficialId = new Map(existing.map(card => [card.official_id, card]));
    const byLogicalIdentity = new Map(existing.map(card => [donorLogicalIdentity(card), card]));
    const missing = [];
    const needsRefresh = [];
    let representedByBandai = 0;
    for (const card of catalogCards) {
      const exact = byOfficialId.get(card.official_id);
      if (exact) {
        if (String(exact.image_url || '') !== String(card.image_url || '') && !hasUsableCachedImage(exact.image_path)) {
          database.prepare('UPDATE cards SET image_path = ? WHERE official_id = ?').run('', card.official_id);
          needsRefresh.push(card);
        }
        continue;
      }
      // A matching existing Bandai DON!! record is already the same printing.
      // Do not create a second row just because the supplemental image address
      // differs from Bandai's own card-list image address.
      if (byLogicalIdentity.has(donorLogicalIdentity(card))) {
        representedByBandai += 1;
        continue;
      }
      missing.push(card);
      needsRefresh.push(card);
      byOfficialId.set(card.official_id, card);
      byLogicalIdentity.set(donorLogicalIdentity(card), card);
    }
    if (needsRefresh.length) saveImportedCards(needsRefresh, new Date().toISOString());
    const cachedDonImages = await cacheDonSupplementImages(needsRefresh);
    setMetadata('don-catalog-supplement-v3', JSON.stringify({
      completedAt: new Date().toISOString(),
      catalogRecords: catalogCards.length,
      addedDonCards: missing.length,
      representedByBandai
    }));
    return {
      addedDonCards: missing.length,
      refreshedDonCards: needsRefresh.length - missing.length,
      cachedDonImages,
      representedByBandai,
      discoveredDonCards: catalogCards.length,
      skippedDonCatalogSync: false
    };
  })();
  try {
    return await donCatalogSyncPromise;
  } finally {
    donCatalogSyncPromise = null;
  }
}

function saveImportedCards(cards, importedAt) {
  if (!cards.length) return 0;
  const statement = database.prepare(`
    INSERT INTO cards (
      official_id, name, card_number, set_code, rarity, source_rarity, color, card_type,
      image_url, image_path, detail_url, life, cost, attribute, power, counter,
      block_icon, card_traits, effect_text, set_name, details_json,
      imported_at, source_updated_at, source
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(official_id) DO UPDATE SET
      name = excluded.name,
      card_number = excluded.card_number,
      set_code = excluded.set_code,
      rarity = excluded.rarity,
      source_rarity = excluded.source_rarity,
      color = excluded.color,
      card_type = excluded.card_type,
      image_url = excluded.image_url,
      image_path = CASE WHEN excluded.image_path IS NULL OR excluded.image_path = '' THEN cards.image_path ELSE excluded.image_path END,
      detail_url = excluded.detail_url,
      life = excluded.life,
      cost = excluded.cost,
      attribute = excluded.attribute,
      power = excluded.power,
      counter = excluded.counter,
      block_icon = excluded.block_icon,
      card_traits = excluded.card_traits,
      effect_text = excluded.effect_text,
      set_name = excluded.set_name,
      details_json = excluded.details_json,
      imported_at = excluded.imported_at,
      source_updated_at = excluded.source_updated_at,
      source = excluded.source
  `);
  database.exec('BEGIN IMMEDIATE');
  try {
    for (const card of cards) {
      const details = {
        Life: card.life,
        Cost: card.cost,
        Attribute: card.attribute,
        Power: card.power,
        Counter: card.counter,
        Color: card.color,
        Block: card.block,
        Type: card.traits,
        Effect: card.effect,
        'Card Set(s)': card.setName,
        raw: card.raw_details
      };
      statement.run(
        card.official_id,
        card.name || '',
        card.card_number || '',
        deriveSetCode(card),
        normalizedRarity(card.rarity) || '',
        card.rarity || '',
        card.color || '',
        card.card_type || '',
        card.image_url || '',
        card.image_path || '',
        card.detail_url || '',
        card.life || '',
        card.cost || '',
        card.attribute || '',
        card.power || '',
        card.counter || '',
        card.block || '',
        card.traits || '',
        card.effect || '',
        card.setName || '',
        JSON.stringify(details),
        importedAt,
        new Date().toISOString(),
        card.source || 'Official Bandai'
      );
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return cards.length;
}

function latestImport() {
  return database.prepare('SELECT * FROM import_sessions ORDER BY id DESC LIMIT 1').get() || null;
}

async function runOfficialImport(sender) {
  if (importInProgress) throw new Error('An official Bandai import is already running.');
  importInProgress = true;
  const startedAt = new Date().toISOString();
  const session = database.prepare('INSERT INTO import_sessions (source, started_at, status, details) VALUES (?, ?, ?, ?)').run(
    'Official Bandai One Piece Card Game', startedAt, 'running', 'Starting official card import'
  );
  const sessionId = Number(session.lastInsertRowid);
  const sendProgress = progress => {
    database.prepare('UPDATE import_sessions SET cards_imported = ?, details = ? WHERE id = ?').run(
      progress.importedCards || 0, JSON.stringify(progress), sessionId
    );
    sender.send('import:progress', progress);
  };
  try {
    const importer = new BandaiImporter({ imageDirectory: imageDirectory(), saveCards: saveImportedCards, onProgress: sendProgress });
    const result = await importer.importEverything();
    const repair = deduplicateOfficialCards(database);
    const finalResult = { ...result, ...repair };
    database.prepare('UPDATE import_sessions SET completed_at = ?, status = ?, cards_imported = ?, details = ? WHERE id = ?').run(
      new Date().toISOString(), 'completed', result.importedCards, JSON.stringify(finalResult), sessionId
    );
    sender.send('import:progress', {
      phase: 'complete',
      message: repair.removedDuplicates
        ? `Import complete — removed ${repair.removedDuplicates.toLocaleString()} duplicate record${repair.removedDuplicates === 1 ? '' : 's'}.`
        : 'Import complete — no duplicate cards were created.',
      importedCards: result.importedCards,
      cachedImages: result.cachedImages,
      currentSet: result.sets,
      totalSets: result.sets,
      completedAt: new Date().toISOString()
    });
    return { success: true, ...finalResult };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The official import could not be completed.';
    database.prepare('UPDATE import_sessions SET completed_at = ?, status = ?, details = ? WHERE id = ?').run(
      new Date().toISOString(), 'failed', JSON.stringify({ message }), sessionId
    );
    sender.send('import:progress', { phase: 'failed', message, importedCards: 0, cachedImages: 0 });
    throw new Error(message);
  } finally {
    importInProgress = false;
  }
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  response.end(JSON.stringify(body));
}

function readJsonRequest(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => {
      body += chunk;
      if (body.length > 64 * 1024) {
        reject(new Error('Connector request is too large.'));
        request.destroy();
      }
    });
    request.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Connector request must be valid JSON.'));
      }
    });
    request.on('error', reject);
  });
}

function connectorValueFromPayload(payload) {
  return payload?.number ?? payload?.blockNumber ?? payload?.spotNumber ?? payload?.value ?? payload?.text;
}

function normalizeSaleAmountCents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  // $10,000 per spot is far beyond a normal break listing and keeps malformed
  // page text from polluting the buyer-giveaway ranking.
  return Math.min(1000000, Math.round(amount));
}

function saleAmountCentsFromPayload(payload) {
  const directCents = payload?.saleAmountCents ?? payload?.amountCents;
  const normalizedDirect = normalizeSaleAmountCents(directCents);
  if (normalizedDirect) return normalizedDirect;
  const amount = Number(payload?.saleAmount ?? payload?.amount ?? payload?.price);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return normalizeSaleAmountCents(amount * 100);
}

function browserOverlayCards() {
  return listActiveBreakBoardCards().map(card => ({
    ...card,
    // Browser and OBS views cannot reliably load an Electron file:// image.
    // Serve the verified local image through the same loopback bridge instead.
    image_url: card.image_path && hasUsableCachedImage(card.image_path)
      ? `${CONNECTOR_ORIGIN}/api/card-image/${card.id}`
      : card.image_url
  }));
}

function sendText(response, statusCode, contentType, body) {
  response.writeHead(statusCode, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  response.end(body);
}

function serveBrowserOverlayAsset(response, assetName, contentType) {
  const assetPath = path.join(__dirname, 'renderer', assetName);
  try {
    sendText(response, 200, contentType, fs.readFileSync(assetPath, 'utf8'));
  } catch {
    sendText(response, 404, 'text/plain; charset=utf-8', 'Overlay file not found.');
  }
}

function serveCachedCardImage(response, cardId) {
  const card = database.prepare('SELECT image_path FROM cards WHERE id = ?').get(cardId);
  if (!card?.image_path || !hasUsableCachedImage(card.image_path)) {
    sendText(response, 404, 'text/plain; charset=utf-8', 'Card image not cached.');
    return;
  }
  const extension = path.extname(card.image_path).toLowerCase();
  const contentType = { '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }[extension] || 'image/jpeg';
  response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600', 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(card.image_path).on('error', () => {
    if (!response.headersSent) sendText(response, 404, 'text/plain; charset=utf-8', 'Card image could not be read.');
    else response.destroy();
  }).pipe(response);
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  return true;
}

function startConnectorServer() {
  if (connectorServer) return;
  connectorServer = http.createServer(async (request, response) => {
    const requestPath = String(request.url || '').split('?')[0];
    if (request.method === 'OPTIONS') return sendJson(response, 204, {});
    if (request.method === 'GET' && requestPath === '/overlay.html') {
      return serveBrowserOverlayAsset(response, 'browser-overlay.html', 'text/html; charset=utf-8');
    }
    if (request.method === 'GET' && requestPath === '/overlay.css') {
      return serveBrowserOverlayAsset(response, 'browser-overlay.css', 'text/css; charset=utf-8');
    }
    if (request.method === 'GET' && requestPath === '/overlay.js') {
      return serveBrowserOverlayAsset(response, 'browser-overlay.js', 'application/javascript; charset=utf-8');
    }
    const imageMatch = requestPath.match(/^\/api\/card-image\/(\d+)$/);
    if (request.method === 'GET' && imageMatch) {
      return serveCachedCardImage(response, Number(imageMatch[1]));
    }
    if (request.method === 'GET' && requestPath === '/api/health') {
      return sendJson(response, 200, { ok: true, connector: getConnectorStatus() });
    }
    if (request.method === 'GET' && requestPath === '/api/overlay') {
      return sendJson(response, 200, { ok: true, cards: browserOverlayCards(), style: getOverlayStyle(), connector: getConnectorStatus() });
    }
    if (request.method === 'POST' && requestPath === '/api/overlay/heartbeat') {
      connectorStatus.browserOverlayLastSeenAt = new Date().toISOString();
      notifyConnectorStatus();
      return sendJson(response, 200, { ok: true });
    }
    if (request.method === 'POST' && requestPath === '/api/app/focus') {
      return sendJson(response, 200, { ok: focusMainWindow() });
    }
    if (request.method === 'POST' && ['/api/ledger/number', '/api/connector/event'].includes(requestPath)) {
      try {
        const payload = await readJsonRequest(request);
        const card = receiveConnectorPayload(payload);
        return sendJson(response, 200, {
          ok: true,
          block: { position: card.position, cardId: card.id, cardName: card.name, calledAt: card.called_at }
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The connector could not process this block.';
        const isUnready = /Save Board|not on the saved live ledger/.test(message);
        return sendJson(response, isUnready ? 409 : 400, { ok: false, error: message });
      }
    }
    if (request.method === 'POST' && requestPath === '/api/connector/reversal') {
      try {
        const payload = await readJsonRequest(request);
        const card = receiveConnectorReversal(payload);
        return sendJson(response, 200, {
          ok: true,
          released: Boolean(card.released),
          block: { position: card.position, cardId: card.id, cardName: card.name, status: card.block_status }
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The connector could not reverse this block.';
        const isUnready = /Save Board|not on the saved live ledger/.test(message);
        return sendJson(response, isUnready ? 409 : 400, { ok: false, error: message });
      }
    }
    if (request.method === 'POST' && requestPath === '/api/connector/reconcile') {
      try {
        const payload = await readJsonRequest(request);
        return sendJson(response, 200, { ok: true, ...reconcileConnectorAssignments(payload) });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The connector could not reconcile the Assigned list.';
        const isUnready = /Save Board|not on the saved live ledger/.test(message);
        return sendJson(response, isUnready ? 409 : 400, { ok: false, error: message });
      }
    }
    return sendJson(response, 404, { ok: false, error: 'Connector endpoint not found.' });
  });
  connectorServer.on('error', error => {
    connectorStatus = { ...connectorStatus, running: false, error: error.message || 'Connector could not start.' };
    console.error('BreakSuite connector error:', error);
    notifyConnectorStatus();
  });
  connectorServer.listen(CONNECTOR_PORT, '127.0.0.1', () => {
    connectorStatus = { ...connectorStatus, running: true, error: '' };
    notifyConnectorStatus();
  });
}

function stopConnectorServer() {
  if (!connectorServer) return;
  connectorServer.close();
  connectorServer = undefined;
  connectorStatus = { ...connectorStatus, running: false };
}

function registerIpc() {
  ipcMain.handle('library:overview', () => overview());
  ipcMain.handle('library:cards', (_event, filters) => listCards(filters));
  ipcMain.handle('library:rarities', () => listRarities());
  ipcMain.handle('library:card', (_event, id) => getCard(id));
  ipcMain.handle('library:set-saved', (_event, id, shouldSave) => setSaved(id, shouldSave));
  ipcMain.handle('library:set-classification', (_event, id, classification) => setCardClassification(id, classification));
  ipcMain.handle('break:board-cards', () => listBreakBoardCards());
  ipcMain.handle('break:active-board-cards', () => listActiveBreakBoardCards());
  ipcMain.handle('break:board-overview', () => breakBoardOverview());
  ipcMain.handle('break:list-presets', () => listBreakBoardPresets());
  ipcMain.handle('break:save-preset', (_event, payload) => saveBreakBoardPreset(payload));
  ipcMain.handle('break:load-preset', (_event, slot) => {
    const result = loadBreakBoardPreset(slot);
    broadcastBreakBoardChange();
    return result;
  });
  ipcMain.handle('break:clear-preset', (_event, slot) => clearBreakBoardPreset(slot));
  ipcMain.handle('break:set-card', (_event, id, shouldShow) => {
    const card = setCardOnBreakBoard(id, Boolean(shouldShow));
    broadcastBreakBoardChange();
    return card;
  });
  ipcMain.handle('break:clear-board', () => {
    const result = clearBreakBoard();
    broadcastBreakBoardChange();
    return result;
  });
  ipcMain.handle('break:save-board', () => {
    const result = saveBreakBoard();
    broadcastBreakBoardChange();
    return result;
  });
  ipcMain.handle('break:copy-listing', () => {
    const numbering = compactBreakBoardPositions();
    const cards = listBreakBoardCards();
    const listing = formatBreakBoardListing(cards);
    clipboard.writeText(listing);
    return { copiedCards: cards.length, listing, renumbered: numbering.renumbered };
  });
  ipcMain.handle('break:open-overlay', () => {
    openOverlayWindow();
    return { opened: true };
  });
  ipcMain.handle('overlay:get-style', () => getOverlayStyle());
  ipcMain.handle('overlay:save-style', (_event, style) => saveOverlayStyle(style));
  ipcMain.handle('overlay:reset-style', () => resetOverlayStyle());
  ipcMain.handle('connector:status', () => getConnectorStatus());
  ipcMain.handle('connector:test-assignment', (_event, payload) => receiveConnectorPayload({
    number: payload?.number,
    buyer: payload?.buyer,
    source: 'Simulated Whatnot assigned row'
  }, { test: true }));
  ipcMain.handle('connector:run-stress-test', () => runFullLedgerStressTest());
  ipcMain.handle('connector:reset-test-assignments', () => resetTestAssignments());
  ipcMain.handle('breaker:set-message-card-marked', (_event, position, shouldMark) => setBuyerMessageCardMarked(position, Boolean(shouldMark)));
  ipcMain.handle('breaker:clear-message-selections', (_event, buyer) => clearBuyerMessageSelections(buyer));
  ipcMain.handle('breaker:copy-buyer-congratulations', (_event, buyer) => copyBuyerCongratulations(buyer));
  ipcMain.handle('history:list', () => listBreakOrderHistory());
  ipcMain.handle('history:save-current-break', (_event, payload) => saveBreakOrderHistory(payload));
  ipcMain.handle('library:repair', () => repairLibrary());
  ipcMain.handle('library:reset', (_event, confirmation) => {
    const result = resetLibrary(confirmation);
    broadcastBreakBoardChange();
    return result;
  });
  ipcMain.handle('import:run-official', event => runOfficialImport(event.sender));
  ipcMain.handle('import:last-session', () => latestImport());
  ipcMain.handle('app:database-status', () => ({ ready: Boolean(database), path: databaseFile() }));
  ipcMain.handle('app:open-external', (_event, url) => {
    if (typeof url === 'string' && /^https:\/\//.test(url)) return shell.openExternal(url);
    return false;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1100,
    minHeight: 720,
    title: 'BreakSuite6 v0.3.52 — One Piece Card Library',
    backgroundColor: '#101728',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function openOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.show();
    overlayWindow.focus();
    return;
  }
  overlayWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 900,
    minHeight: 540,
    title: 'BreakSuite6 — Break Board Display',
    backgroundColor: '#080d18',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  overlayWindow.on('closed', () => { overlayWindow = undefined; });
  overlayWindow.on('closed', () => notifyConnectorStatus());
  overlayWindow.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));
  notifyConnectorStatus();
}

function showStartupFailure(error) {
  const message = error instanceof Error ? error.message : String(error || 'Unknown startup error.');
  console.error('BreakSuite6 startup failure:', error);
  dialog.showErrorBox(
    'BreakSuite6 could not open',
    `Your local card library was not changed.\n\n${message}\n\nClose any old BreakSuite6 processes in Task Manager, then run the update again.`
  );
}

async function startApplication() {
  try {
    initializeDatabase();
    registerIpc();
    if (process.argv.includes('--smoke-test')) {
      console.log(`BreakSuite6 database ready: ${overview().total} official cards`);
      app.quit();
      return;
    }
    createWindow();
    startConnectorServer();
    void cacheProductSupplementImages().catch(error => {
      console.error('Unable to cache product-only DON!! images:', error);
    });
    // v0.3.12 fills or repairs the wider DON!! catalog once in the background. This is
    // additive only and never runs the full Bandai import again.
    void syncDonCatalog().then(result => {
      if (mainWindow && !mainWindow.isDestroyed() && !result.skippedDonCatalogSync) {
        mainWindow.webContents.send('library:don-sync-complete', result);
      }
    }).catch(error => {
      console.error('Unable to sync supplemental DON!! catalog:', error);
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  } catch (error) {
    showStartupFailure(error);
    app.quit();
  }
}

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.whenReady().then(startApplication).catch(error => {
    showStartupFailure(error);
    app.quit();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopConnectorServer();
  database?.close();
});
