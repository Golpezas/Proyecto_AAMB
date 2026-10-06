const { app, BrowserWindow, clipboard, dialog, ipcMain, safeStorage, shell } = require('electron');
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
const crypto = require('node:crypto');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const { DatabaseSync } = require('node:sqlite');
const { BandaiImporter } = require('./modules/BandaiImporter');
const { fetchDonCatalog } = require('./modules/DonCatalogSupplements');
const { createOverlayClaimQueue, createOverlayRevealSourcePresence } = require('./modules/OverlayClaimQueue');
const { applyOverlayLiveAssignments } = require('./modules/OverlayLiveAssignment');
const CardSniper = require('./modules/CardSniper');
const PlayableMarket = require('./modules/PlayableMarket');
const { officialProductSupplements } = require('./modules/OfficialProductSupplements');
const { ALTERNATE_ART, breakRarityForCard, groupRarityEntries, isBreakRarityFilterEntry, MANUAL_GOLD_DON, MANUAL_MANGA, normalizedRarity, rarityFilterDefinition } = require('./modules/RarityFilters');
const { deduplicateOfficialCards, resetLocalLibrary } = require('./modules/LibraryMaintenance');
const { normalizeExistingSpecialCards } = require('./modules/CatalogMigrations');
const { searchTerms } = require('./modules/CatalogSearch');
const { RIFTBOUND_BREAK_DESCRIPTION, WHATNOT_BREAK_DESCRIPTION, decorateBreakBoardListingNames, formatBreakBoardListing, normalizeBreakDescription, riftboundSpotName, vendettaListingSpotName } = require('./modules/BreakBoard');
const { leadingBlockNumber } = require('./modules/BreakLedger');
const { BREAK_BOARD_PRESET_SLOTS, ensureBreakBoardPresetCapacity, normalizePresetName, normalizePresetSlot, resolveWorkingPresetSlot, sameBoardOrder } = require('./modules/BreakBoardPresets');
const { BREAK_BOARD_MAPPING_MODES, buildRiftboundSingleSpot, decorateRiftboundSinglesBoard, isBreakBoardMappingMode, normalizeBreakBoardMappingMode } = require('./modules/BreakBoardMappingMode');
const {
  clearPresetCustomMapping,
  customMappingCardPresentation,
  customMappingSpotDisplayLabel,
  customMappingSignature,
  ensureBreakBoardCustomMappingSchema,
  loadPresetCustomMapping,
  loadRoundCustomMapping,
  savePresetCustomMapping,
  snapshotPresetCustomMapping
} = require('./modules/BreakBoardCustomMapping');
const { BREAK_DISPOSITIONS, currencyToCents, dispositionLabel, ensureBreakOrderHistorySchema, isDeductibleBreakDisposition, normalizeBreakDisposition, normalizeHistoryBreakName, normalizeHistoryNotes, normalizeWhatnotFees, orderHistoryTotals, whatnotFeeBreakdown } = require('./modules/BreakOrderHistory');
const { categoryDefinitions: hitCategoryDefinitions, classifyMajorHit, combinedVisualRecentHits, isVisualTopHitClassification, riftboundCollectorNumberInfo, setKey: hitSetKey } = require('./modules/OrderHitTracker');
const { deletePullHistoryBatch, ensurePullHistorySchema, listPullHistory, pullHistoryImageRows, replacePullHistorySnapshot } = require('./modules/PullHistory');
const { addPullHistoryCardCorrection } = require('./modules/PullHistoryCorrection');
const { topHitsOnly } = require('./renderer/pull-history-buyer-message');
const {
  PRICE_SOURCE_IDS,
  applyCatalogCardPriceInputs,
  applyPullHistoryPriceInputs,
  catalogPriceInputRows,
  displayedCatalogCardIds,
  getPricingSettings,
  normalizePriceSource,
  pullHistoryPriceInputRows,
  refreshCatalogCardPrices,
  refreshPullHistoryPrices,
  savePricingSettings
} = require('./modules/PullHistoryPricing');
const { OPENRIFT_CATALOG_URL, lookupOpenRiftPrinting, openRiftPrintingKey } = require('./modules/OpenRiftPrintingIndex');
const { buildOpenRiftImageIndex, isOpenRiftCardImageUrl, lookupOpenRiftImage, openRiftImageUrl } = require('./modules/OpenRiftImageCatalog');
const { EXPENSE_CATEGORIES, MAX_EXPENSE_NOTES, MAX_EXPENSE_TEXT, ensureBusinessExpenseSchema, normalizeExpenseCategory, normalizeExpenseDate, trim: trimExpenseText } = require('./modules/BusinessExpenses');
const { buildBusinessExpenseReport } = require('./modules/BusinessExpenseReport');
const { businessExpenseReportCsv } = require('./modules/BusinessExpenseExport');
const { availableBusinessYears, buildBusinessSnapshot, normalizeTaxYear } = require('./modules/BusinessSnapshot');
const { buildBuyerAnalytics, buildBuyerCaseFile, buyerKey } = require('./modules/BuyerAnalytics');
const { recentUniqueBuyerNames, splitBuyerMentions } = require('./modules/RecentBuyerMentions');
const { auditBusinessOrderTotals, auditPullHistoryBuyerData } = require('./modules/BuyerPurchaseAudit');
const { RIFTBOUND_GAME_CODE, RIFTBOUND_GAME_NAME, RIFTBOUND_SETS, RIFTBOUND_TREATMENTS, normalizeRiftboundCard, normalizeRiftboundPayload } = require('./modules/RiftboundCatalog');
const { riftboundCardSupplements } = require('./modules/RiftboundCardSupplements');
const { riftboundRuneSupplements } = require('./modules/RiftboundRuneSupplements');
const { repairRiftboundSetAssignments } = require('./modules/RiftboundSetAssignments');
const { ACTIVE_OPEN_CASE_KEY, ACTIVE_TRACKER_KEY, BOX_HIT_FIELDS, TRACKER_RECORD_TYPES, ensureBoxTrackerSchema, hydrateBoxTrackerRows, normalizeBoxCount, normalizeBoxHitCounts, normalizeBoxNote, normalizeBoxStatus, normalizeProductName, normalizeTrackerName, requireTrackerRecordType, trackerHitFieldsForGame } = require('./modules/BoxTracker');
const { syncBoxTrackerFromHistory: syncAutomaticBoxTrackerFromHistory } = require('./modules/AutomaticBoxTracker');
const { changeOrderTrackerDestination } = require('./modules/OrderTrackerDestination');
const {
  TRACKER_DESTINATION_MODES,
  createOpenCaseTracker,
  deleteOpenCaseTracker,
  detachHistoryFromCaseTracker,
  finalizeOpenCaseTracker,
  normalizeTrackerDestinationMode,
  removeOpenCaseBox,
  syncOpenCaseBoxFromHistory,
  updateOpenCaseTracker
} = require('./modules/LiveCaseTracker');
const {
  championFromSpot,
  baronFromSpot,
  cardBelongsToBaron,
  cardBelongsToChampion,
  cardBelongsToPoroSpot,
  cardBelongsToOriginsSpot,
  cardBelongsToSpiritforgedSpot,
  cardBelongsToVendettaSpot,
  isShowcaseRune,
  isOriginsRareEpicDomainCard,
  isSpiritforgedRareColorCard,
  isUnleashedRareColorCard,
  isVendettaRareColorCard,
  poroFromSpot,
  originsSpotFromCard,
  originsSpotLabel,
  poroMapping,
  runeFromSpot,
  runeMapping,
  sortChampionFamily,
  spiritforgedSpotFromCard,
  spiritforgedSpotLabel,
  vendettaSpotFromCard,
  vendettaSpotLabel
} = require('./modules/RiftboundChampionAudit');
const {
  COMBO_CHAMPION_SPOTS,
  COMBO_PORO_SPOTS,
  buildVisualSpot,
  findVisualSpotForAnchor
} = require('./modules/RiftboundComboVisualProfile');
const {
  buildUnleashedTop80Spot,
  decorateUnleashedTop80Board,
  isUnleashedTop80Board
} = require('./modules/RiftboundUnleashedTop80');
const {
  buildUnleashedCaseBreakSpot,
  decorateUnleashedCaseBreakBoard,
  isUnleashedCaseBreakBoard
} = require('./modules/RiftboundUnleashedCaseBreak');
const {
  ensureUnleashedBoardThree
} = require('./modules/RiftboundUnleashedBoardThree');
const {
  buildUnleashedExpandedBreakSpot,
  decorateUnleashedExpandedBreakBoard,
  isUnleashedExpandedBreakBoard
} = require('./modules/RiftboundUnleashedExpandedBreak');
const { ensureCombinedBoardSeven } = require('./modules/RiftboundCombinedBoardSeven');
const { ensureCombinedBoardTwo } = require('./modules/RiftboundCombinedBoardTwo');
const { ensureOriginsBoardEight } = require('./modules/RiftboundOriginsBoardEight');
const {
  buildUnleashedColorBreakSpot,
  decorateUnleashedColorBreakBoard,
  isUnleashedColorBreakBoard
} = require('./modules/RiftboundUnleashedColorBreak');
const {
  ensureUnleashedFullCaseBoardFive,
  isUnleashedFullCaseBreakBoard
} = require('./modules/RiftboundUnleashedFullCase');
const { VENDETTA_BOARD_ONE_STATUS_KEY, ensureVendettaBoardOne } = require('./modules/RiftboundVendettaBoardOne');
const {
  buildSpiritforgedExpandedBreakSpot,
  decorateSpiritforgedExpandedBreakBoard,
  ensureSpiritforgedExpandedBoardSix,
  isSpiritforgedExpandedBreakBoard,
  spiritforgedExpandedProfileForBoard
} = require('./modules/RiftboundSpiritforgedExpandedBreak');
const {
  decorateVendettaBoardTenListing,
  ensureVendettaChaseSinglesBoardTen
} = require('./modules/RiftboundVendettaChaseSingles');
const {
  decorateSpiritforgedBoardNineListing,
  ensureSpiritforgedChaseSinglesBoardNine
} = require('./modules/RiftboundSpiritforgedChaseSingles');
const {
  RIFTBOUND_LINEAR_OVERLAY_PROFILES,
  applyLinearOverlayProfileToCard,
  linearOverlayProfileForCustomMapping,
  linearOverlayProfileForEntry,
  linearOverlayProfileForPresetSlot,
  overlayPreviewCards
} = require('./modules/RiftboundLinearOverlay');

let mainWindow;
let overlayWindow;
let vipAlertWindow;
let database;
let importInProgress = false;
let donCatalogSyncPromise = null;
const CONNECTOR_PORT = 8878;
const CONNECTOR_ORIGIN = `http://127.0.0.1:${CONNECTOR_PORT}`;
const OVERLAY_STYLE_KEY = 'overlay-style-v1';
const STATIC_OVERLAY_ENABLED_KEY = 'static-overlay-enabled-v1';
const SALES_SIGN_KEY = 'sales-sign-v1';
const BREAK_BOARD_WORKING_PRESET_SLOT_KEY = 'break-board-working-preset-slot-v1';
const BREAK_BOARD_WORKING_MAPPING_MODE_KEY = 'break-board-working-mapping-mode-v1';
const SPIRITFORGED_BOARD_NINE_STATIC_OVERLAY_PROFILE = 'spiritforged-board-9-priority-four';
const VENDETTA_BOARD_TEN_STATIC_OVERLAY_PROFILE = 'vendetta-board-10-dense-five';
const ACTIVE_BREAK_ROUND_KEY = 'active-break-round-id-v1';
const BREAK_BOARD_DESCRIPTION_KEYS = Object.freeze({
  ONEPIECE: 'break-board-listing-description-onepiece-v1',
  RIFTBOUND: 'break-board-listing-description-riftbound-v1'
});
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
  popupStatueScale: 92,
  popupCardScale: 90,
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
// OBS reveals are event-driven. Rapid live purchases are queued so each card
// remains visible for the configured duration instead of later events
// overwriting the first popup. Bulk reconciliation stays silent and never
// enters this queue.
const overlayClaimQueue = createOverlayClaimQueue({
  durationMs: () => Number(getOverlayStyle().popupDuration || DEFAULT_OVERLAY_STYLE.popupDuration) * 1000 + 750
});
const overlayRevealSourcePresence = createOverlayRevealSourcePresence();
let browserOverlayCardsCache = null;
let riftboundSpotMapCache = null;
let riftboundSpotOverviewCache = null;
let riftboundSpotOverviewCacheKey = '';
const riftboundSpotMapImageHydration = new Map();
let riftboundSpotImageIndexPromise = null;
let riftboundSpotMapWarmKey = '';
let riftboundSpotMapWarmPromise = null;
// The animated Spot Map is opt-in for each application session. When disabled,
// OBS receives an idle response and BreakSuite does not build mapped families
// or warm card images in the background.
let riftboundSpotMapEnabled = false;
// The steady OBS board stays idle until enabled once. Remember that choice so
// restarting BreakSuite for an update does not silently freeze an active show.
let staticOverlayEnabled = false;
let orderHitTrackerCache = null;
const VIP_MIN_SPEND_CENTS = 1000;
const CHASER_TRACKER_KEY = 'chaser-giveaway-v1';
const ROYAL_CHASER_TRACKER_KEY = 'royal-chaser-v1';
const RIFTBOUND_API_KEY_METADATA = 'riftbound-riot-api-key-v1';
const RIFTBOUND_CONTENT_URL = 'https://americas.api.riotgames.com/riftbound/content/v1/contents';
const RIFTBOUND_GALLERY_URL = 'https://content.publishing.riotgames.com/publishing-content/v2.0/public/channel/riftbound_website/list/riftbound_gallery_cards';
const RIFTBOUND_ZERO_RECOVERY_KEY = 'riftbound-zero-recovery-v0.3.130';
const VIP_ALERT_COOLDOWN_MS = 3 * 60 * 1000;
const VIP_ALERT_FEED_LIMIT = 8;
let vipAlert = null;
let vipAlertFeed = [];
const recentVipAlerts = new Map();

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

function riftboundImageDirectory() {
  const folder = path.join(app.getPath('userData'), 'Images', 'Riot', 'Riftbound');
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
    , game_code: "TEXT NOT NULL DEFAULT 'ONEPIECE'"
    , game_name: "TEXT NOT NULL DEFAULT 'One Piece Card Game'"
    , product_name: "TEXT NOT NULL DEFAULT ''"
    , market_price_cents: 'INTEGER'
    , market_price_source: "TEXT NOT NULL DEFAULT ''"
    , market_price_variant: "TEXT NOT NULL DEFAULT ''"
    , market_price_external_id: "TEXT NOT NULL DEFAULT ''"
    , market_price_updated_at: 'TEXT'
    , market_price_match_status: "TEXT NOT NULL DEFAULT ''"
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
  if (!existing.has('tracker_marked')) {
    database.exec("ALTER TABLE active_break_board_cards ADD COLUMN tracker_marked INTEGER NOT NULL DEFAULT 0");
  }
  // The price belongs only to the confirmed Whatnot Assigned row. It is kept
  // with that live-ledger block so Buyer Bags can show actual buyer spend
  // without touching the official card catalog or the public overlay.
  if (!existing.has('sale_amount_cents')) {
    database.exec("ALTER TABLE active_break_board_cards ADD COLUMN sale_amount_cents INTEGER NOT NULL DEFAULT 0");
  }
}

function addMissingBreakBoardPresetColumns() {
  const existing = new Set(database.prepare('PRAGMA table_info(break_board_presets)').all().map(column => column.name));
  if (!existing.has('mapping_mode')) {
    database.exec("ALTER TABLE break_board_presets ADD COLUMN mapping_mode TEXT NOT NULL DEFAULT 'MAPPED' CHECK(mapping_mode IN ('MAPPED', 'SINGLES'))");
  }
}

function addMissingBreakRoundColumns() {
  const existing = new Set(database.prepare('PRAGMA table_info(break_rounds)').all().map(column => column.name));
  // Leave legacy rows NULL so their mode can be recovered from the saved
  // board whose exact card order created them. New rounds always write it.
  if (!existing.has('mapping_mode')) database.exec('ALTER TABLE break_rounds ADD COLUMN mapping_mode TEXT');
}

function ensureBreakRoundSchema() {
  database.exec(`
    -- One Whatnot live show can contain several sequential boxes. Only the
    -- active_break_board_cards table is connector-facing; finished live
    -- ledgers are copied here before a new board can replace them.
    CREATE TABLE IF NOT EXISTS break_rounds (
      id INTEGER PRIMARY KEY,
      round_key TEXT NOT NULL UNIQUE,
      sequence INTEGER NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      game_code TEXT NOT NULL DEFAULT '',
      set_code TEXT NOT NULL DEFAULT '',
      set_name TEXT NOT NULL DEFAULT '',
      mapping_mode TEXT NOT NULL DEFAULT 'MAPPED' CHECK(mapping_mode IN ('MAPPED', 'SINGLES')),
      ledger_saved_at TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK(status IN ('LIVE', 'PENDING_REVIEW', 'COMPLETED', 'SUPERSEDED')),
      created_at TEXT NOT NULL,
      pending_at TEXT,
      completed_at TEXT,
      order_history_id INTEGER,
      pull_history_batch_id INTEGER,
      FOREIGN KEY(order_history_id) REFERENCES break_order_history(id) ON DELETE SET NULL,
      FOREIGN KEY(pull_history_batch_id) REFERENCES pull_history_batches(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS break_round_cards (
      round_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      card_id INTEGER NOT NULL,
      saved_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ready',
      buyer_name TEXT NOT NULL DEFAULT '',
      called_at TEXT,
      message_marked INTEGER NOT NULL DEFAULT 0,
      tracker_marked INTEGER NOT NULL DEFAULT 0,
      sale_amount_cents INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(round_id, position),
      FOREIGN KEY(round_id) REFERENCES break_rounds(id) ON DELETE CASCADE,
      FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS break_round_pulls (
      round_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      card_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity BETWEEN 1 AND 99),
      updated_at TEXT NOT NULL,
      PRIMARY KEY(round_id, position, card_id),
      FOREIGN KEY(round_id, position) REFERENCES break_round_cards(round_id, position) ON DELETE CASCADE,
      FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_break_rounds_status
      ON break_rounds(status, sequence DESC);
    CREATE INDEX IF NOT EXISTS idx_break_round_cards_buyer
      ON break_round_cards(round_id, buyer_name, position);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_break_rounds_order_history
      ON break_rounds(order_history_id) WHERE order_history_id IS NOT NULL;
  `);
  addMissingBreakRoundColumns();
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

function repairExistingRiftboundCards() {
  const rows = database.prepare(`
    SELECT id, details_json
    FROM cards
    WHERE UPPER(TRIM(COALESCE(game_code, ''))) = 'RIFTBOUND'
      AND TRIM(COALESCE(details_json, '')) != ''
  `).all();
  const update = database.prepare(`
    UPDATE cards
    SET name = ?, card_number = ?, card_type = ?, card_traits = ?, set_code = ?, set_name = ?, variant = ?, variant_source = ?
    WHERE id = ?
  `);
  let repaired = 0;
  database.exec('BEGIN IMMEDIATE');
  try {
    for (const row of rows) {
      try {
        const details = JSON.parse(row.details_json);
        const raw = typeof details?.raw === 'string' ? JSON.parse(details.raw) : (details?.raw || details);
        const card = normalizeRiftboundCard(raw);
        if (!card) continue;
        update.run(card.name, card.card_number, card.card_type, card.traits, card.set_code, card.setName, card.variant, card.variant ? 'Official card number' : '', row.id);
        repaired += 1;
      } catch {
        // Keep manually imported legacy rows untouched when their saved raw
        // details are incomplete. A future official sync can still update them.
      }
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return repaired;
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
  const riftboundCardResult = ensureRiftboundCardSupplements();
  const riftboundRuneResult = ensureRiftboundRuneSupplements();
  const riftboundSetResult = repairRiftboundSetAssignments(database, RIFTBOUND_SETS);
  const donSupplementResult = await syncDonCatalog({ force: true });
  const repair = deduplicateOfficialCards(database);
  return { ...repair, ...supplementResult, ...riftboundCardResult, ...riftboundRuneResult, ...riftboundSetResult, ...donSupplementResult, totalCards: overview().total };
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
      source TEXT NOT NULL DEFAULT 'Bandai',
      market_price_cents INTEGER,
      market_price_source TEXT NOT NULL DEFAULT '',
      market_price_variant TEXT NOT NULL DEFAULT '',
      market_price_external_id TEXT NOT NULL DEFAULT '',
      market_price_updated_at TEXT,
      market_price_match_status TEXT NOT NULL DEFAULT ''
    );

    -- History resolves saved text snapshots back to catalog art. This
    -- expression index matches the legacy TRIM-based lookup exactly, so old
    -- records remain compatible without scanning the complete catalog.
    CREATE INDEX IF NOT EXISTS idx_cards_history_identity
      ON cards(TRIM(set_code), TRIM(card_number));

    CREATE TABLE IF NOT EXISTS catalog_sets (
      game_code TEXT NOT NULL,
      game_name TEXT NOT NULL,
      set_number INTEGER NOT NULL,
      set_code TEXT NOT NULL,
      set_name TEXT NOT NULL,
      product_name TEXT NOT NULL,
      box_count INTEGER NOT NULL DEFAULT 6,
      base_card_count INTEGER,
      PRIMARY KEY(game_code, set_code)
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
      tracker_marked INTEGER NOT NULL DEFAULT 0,
      sale_amount_cents INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE CASCADE
    );

    -- Private packing/audit selections for character breaks. The board card
    -- remains the purchased champion identity; these child rows record the
    -- actual matching printings pulled from the opened box.
    CREATE TABLE IF NOT EXISTS riftbound_champion_pull_audit (
      position INTEGER NOT NULL,
      card_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity BETWEEN 1 AND 99),
      updated_at TEXT NOT NULL,
      PRIMARY KEY(position, card_id),
      FOREIGN KEY(position) REFERENCES active_break_board_cards(position) ON DELETE CASCADE,
      FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE CASCADE
    );

    -- Ten reusable draft setups let the breaker keep separate games and
    -- combinations without changing the one saved live ledger.
    -- A preset is only copied into the working board when it is loaded; it
    -- never changes OBS or the connector until Save Board is pressed.
    CREATE TABLE IF NOT EXISTS break_board_presets (
      slot INTEGER PRIMARY KEY CHECK(slot BETWEEN 1 AND 10),
      name TEXT NOT NULL DEFAULT '',
      saved_at TEXT NOT NULL,
      mapping_mode TEXT NOT NULL DEFAULT 'MAPPED' CHECK(mapping_mode IN ('MAPPED', 'SINGLES'))
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
  addMissingBreakBoardPresetColumns();
  // Existing databases used a five-slot CHECK constraint. Rebuild only these
  // two preset tables transactionally so Boards 1-5 survive byte-for-byte and
  // slots 6-10 become writable.
  ensureBreakBoardPresetCapacity(database);
  CardSniper.initCardSniper(database);
  PlayableMarket.initPlayableMarket(database);
  seedRiftboundSets();
  addMissingActiveBreakBoardColumns();
  ensureBreakOrderHistorySchema(database);
  ensurePullHistorySchema(database);
  ensureBreakRoundSchema();
  ensureBreakBoardCustomMappingSchema(database);
  ensureBusinessExpenseSchema(database);
  ensureBoxTrackerSchema(database);
  normalizeExistingSpecialCards(database);
  removeMalformedOfficialImports();
  repairExistingDonCards();
  repairExistingRiftboundCards();
  repairRiftboundSetAssignments(database, RIFTBOUND_SETS);
  deduplicateOfficialCards(database);
  // A product-page supplement must never prevent the main library window from
  // opening. It is additive only; the normal catalog remains fully usable if
  // Bandai changes a supplemental product page or a local write is busy.
  try {
    ensureOfficialProductSupplements();
  } catch (error) {
    console.error('Unable to add official product-only supplement:', error);
  }
  try {
    ensureRiftboundCardSupplements();
  } catch (error) {
    console.error('Unable to add missing Riftbound card supplements:', error);
  }
  try {
    ensureRiftboundRuneSupplements();
  } catch (error) {
    console.error('Unable to add missing Riftbound Rune supplements:', error);
  }
  deduplicateOfficialCards(database);
  // Install the 33-position Vendetta champion/ON map into saved Board 1 once.
  // The current live round, Buyer Bags, and other saved boards are untouched.
  try {
    ensureVendettaBoardOne(database);
  } catch (error) {
    console.error('Unable to install the Vendetta 33-spot Board 1 preset:', error);
  }
  // Replace only saved Board 3 once with the approved 23-position map. Each
  // Poro owns its matching AA Rune and Rare/Epic color cards, the three named
  // two-printing chases start with their Alternate Art, and Baron keeps all
  // three printings. Existing live/pending/history snapshots stay immutable.
  try {
    ensureUnleashedBoardThree(database);
  } catch (error) {
    console.error('Unable to install the Unleashed 23-spot color-Poro Board 3 preset:', error);
  }
  // Combine the approved reusable Board 1 (Vendetta) and Board 3
  // (Unleashed) mappings into saved Board 7. Every listing label is prefixed
  // [VEN] or [UNL], so Copy Listing keeps same-name spots unambiguous.
  try {
    ensureCombinedBoardSeven(database);
  } catch (error) {
    console.error('Unable to install the combined Vendetta + Unleashed Board 7 preset:', error);
  }
  // Refresh saved Board 8 with the approved 24-position Origins map. The six
  // named playable spots include the 2026-10-01 pairings: Unchecked Power +
  // Sabotage, Thousand-Tailed Watcher + Falling Star, and Time Warp +
  // Zhonya's Hourglass. Each matching rune AA belongs to its seal/domain spot and there is no
  // miscellaneous spot.
  try {
    ensureOriginsBoardEight(database);
  } catch (error) {
    console.error('Unable to install the Origins 24-spot Board 8 preset:', error);
  }
  try {
    const result = ensureCombinedBoardTwo(database, defaultEditorMappingForBoard);
    database.prepare(`INSERT INTO app_metadata (key, value) VALUES ('combined-board-2-install-status', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(result.ready === false
        ? `Board 2 update pending: check Board 8 (Origins) and Board 4 (Spiritforged). ${result.reason}` : '');
  } catch (error) {
    console.error('Unable to combine Origins Board 8 and Spiritforged Board 4 into Board 2:', error);
  }
  // Replace saved Board 5 once with the requested 26-position Unleashed
  // character case. One buyer owns each exact spot across all six boxes.
  // Active Buyer Bags and pending/history snapshots remain untouched.
  try {
    ensureUnleashedFullCaseBoardFive(database);
  } catch (error) {
    console.error('Unable to install the Unleashed 26-spot character-case Board 5 preset:', error);
  }
  // Replace saved Board 9 only with the approved 110-position Spiritforged
  // Epic+ exact-singles setup: 38 Epic, 30 non-promo AA, 30 ON, 12 SIG.
  // Promo rune B variants are deliberately excluded. Boards 6 and 7, active
  // ledgers, Buyer Bags, pending rounds, and history remain untouched.
  try {
    ensureSpiritforgedChaseSinglesBoardNine(database);
  } catch (error) {
    console.error('Unable to install the 110-spot Spiritforged Board 9 Singles preset:', error);
  }
  // Board 6 is a new slot, so this one-time install cannot replace any of the
  // user's five existing setups. It remains retryable until all 39 exact SFD
  // anchor cards are present in the synced catalog.
  try {
    ensureSpiritforgedExpandedBoardSix(database);
  } catch (error) {
    console.error('Unable to install the split 50-spot Spiritforged Board 6 preset:', error);
  }
  // Board 10 is the exact-card Vendetta chase listing: every Signature,
  // Overnumbered, Alternate Art, regular Epic, SP, and Astral Heron receives
  // its own Singles position. Standard Rares are excluded. Only saved Board 10
  // is replaced; live, pending, and historical breaks remain unchanged.
  try {
    ensureVendettaChaseSinglesBoardTen(database);
  } catch (error) {
    console.error('Unable to install the 106-spot Vendetta Board 10 Singles preset:', error);
  }
}

function seedRiftboundSets() {
  const statement = database.prepare(`
    INSERT INTO catalog_sets (
      game_code, game_name, set_number, set_code, set_name, product_name, box_count, base_card_count
    ) VALUES (?, ?, ?, ?, ?, ?, 6, ?)
    ON CONFLICT(game_code, set_code) DO UPDATE SET
      game_name = excluded.game_name,
      set_number = excluded.set_number,
      set_name = excluded.set_name,
      product_name = excluded.product_name,
      box_count = excluded.box_count,
      base_card_count = excluded.base_card_count
  `);
  for (const set of RIFTBOUND_SETS) {
    statement.run(RIFTBOUND_GAME_CODE, RIFTBOUND_GAME_NAME, set.setNumber, set.setCode, set.setName, set.productName, set.baseCardCount);
  }
}

function listCatalogSets() {
  return database.prepare(`
    SELECT s.*, COUNT(c.id) AS imported_cards
    FROM catalog_sets s
    LEFT JOIN cards c ON c.game_code = s.game_code AND c.set_code = s.set_code
    GROUP BY s.game_code, s.set_code
    ORDER BY s.game_code, s.set_number
  `).all();
}

function normalizedGameCode(value) {
  return String(value || 'ONEPIECE').trim().toUpperCase() === RIFTBOUND_GAME_CODE ? RIFTBOUND_GAME_CODE : 'ONEPIECE';
}

function overview(gameCode = 'ONEPIECE') {
  const game = normalizedGameCode(gameCode);
  const total = database.prepare("SELECT COUNT(*) AS count FROM cards WHERE UPPER(TRIM(COALESCE(game_code, 'ONEPIECE'))) = ?").get(game).count;
  const saved = database.prepare("SELECT COUNT(*) AS count FROM saved_cards s JOIN cards c ON c.id=s.card_id WHERE UPPER(TRIM(COALESCE(c.game_code, 'ONEPIECE'))) = ?").get(game).count;
  const board = database.prepare("SELECT COUNT(*) AS count FROM break_board_cards b JOIN cards c ON c.id=b.card_id WHERE UPPER(TRIM(COALESCE(c.game_code, 'ONEPIECE'))) = ?").get(game).count;
  const sets = database.prepare("SELECT COUNT(DISTINCT set_code) AS count FROM cards WHERE UPPER(TRIM(COALESCE(game_code, 'ONEPIECE'))) = ? AND set_code IS NOT NULL AND set_code != ''").get(game).count;
  const latest = database.prepare("SELECT MAX(imported_at) AS date FROM cards WHERE UPPER(TRIM(COALESCE(game_code, 'ONEPIECE'))) = ?").get(game).date;
  const activeBoard = database.prepare("SELECT COUNT(*) AS count FROM active_break_board_cards b JOIN cards c ON c.id=b.card_id WHERE UPPER(TRIM(COALESCE(c.game_code, 'ONEPIECE'))) = ?").get(game).count;
  const registeredSets = database.prepare('SELECT COUNT(*) AS count FROM catalog_sets WHERE game_code = ?').get(game).count;
  return { total, saved, board, activeBoard, sets, registeredSets, latest };
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
    popupStatueScale: boundedNumber(style.popupStatueScale, DEFAULT_OVERLAY_STYLE.popupStatueScale, 60, 130),
    popupCardScale: boundedNumber(style.popupCardScale, DEFAULT_OVERLAY_STYLE.popupCardScale, 60, 130),
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

function getSalesSign() { try { const saved = JSON.parse(getMetadata(SALES_SIGN_KEY) || '{}'); return { text: saved.text || 'SOLD SINGLES & PACKS', style: 'treasure', board: ['primary','secondary','riftbound'].includes(saved.board) ? saved.board : 'primary', size: ['small','medium','large'].includes(saved.size) ? saved.size : 'medium', flash: false }; } catch { return { text: 'SOLD SINGLES & PACKS', style: 'treasure', board: 'primary', size: 'medium', flash: false }; } }
function saveSalesSign(payload = {}) { const value = { text: String(payload.text || '').trim().slice(0, 240) || 'SOLD SINGLES & PACKS', style: 'treasure', board: ['primary','secondary','riftbound'].includes(payload.board) ? payload.board : 'primary', size: ['small','medium','large'].includes(payload.size) ? payload.size : 'medium', flash: false }; setMetadata(SALES_SIGN_KEY, JSON.stringify(value)); return value; }

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
  if (card) {
    const isRiftbound = String(card.game_code || '').toUpperCase() === RIFTBOUND_GAME_CODE;
    const riftboundPrinting = isRiftbound
      ? lookupOpenRiftPrinting(card.card_number, card.set_code)
      : null;
    const manualTreatment = String(card.manual_category || '').trim();
    const collectorTreatment = isRiftbound
      ? (manualTreatment === 'Standard' ? '' : (RIFTBOUND_TREATMENTS.includes(manualTreatment) ? manualTreatment : String(card.variant || '').trim()))
      : '';
    card = {
      ...card,
      break_rarity: isRiftbound ? normalizedRarity(card.rarity) : breakRarityForCard(card),
      collector_treatment: collectorTreatment,
      riftbound_art_variant: riftboundPrinting?.artVariant || ''
    };
  }
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
      const avif = header.subarray(4, 8).toString('ascii') === 'ftyp'
        && ['avif', 'avis'].includes(header.subarray(8, 12).toString('ascii'));
      return jpeg || png || webp || gif || avif;
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
        OR UPPER(TRIM(COALESCE(c.variant, ''))) LIKE ?
        OR UPPER(TRIM(COALESCE(c.manual_category, ''))) LIKE ?
      )`);
      values.push(plain, compact, compact, plain.toUpperCase(), plain.toUpperCase(), plain.toUpperCase());
    }
  }
  if (filters.game && filters.game !== 'All') {
    clauses.push('UPPER(TRIM(COALESCE(c.game_code, ?))) = ?');
    values.push('ONEPIECE', String(filters.game).trim().toUpperCase());
  }
  if (filters.setCode && filters.setCode !== 'All') {
    clauses.push('UPPER(TRIM(COALESCE(c.set_code, ?))) = ?');
    values.push('', String(filters.setCode).trim().toUpperCase());
  }
  const game = normalizedGameCode(filters.game);
  const isRiftbound = game === RIFTBOUND_GAME_CODE;
  const rarityFilter = rarityFilterDefinition(isRiftbound ? 'All' : filters.rarity);
  const rarityValues = rarityFilter.values;
  if (isRiftbound && filters.rarity && filters.rarity !== 'All') {
    const riftboundRarity = String(filters.rarity).trim().toUpperCase();
    if (RIFTBOUND_TREATMENTS.some(value => value.toUpperCase() === riftboundRarity)) {
      clauses.push(`UPPER(CASE
        WHEN TRIM(COALESCE(c.manual_category, '')) = 'Standard' THEN ''
        WHEN TRIM(COALESCE(c.manual_category, '')) IN ('Alternate Art','Overnumbered','Signature') THEN TRIM(c.manual_category)
        ELSE TRIM(COALESCE(c.variant, '')) END) = ?`);
      values.push(riftboundRarity);
    } else {
      clauses.push("UPPER(TRIM(COALESCE(c.rarity, ''))) = ?");
      values.push(riftboundRarity);
    }
  } else if (filters.rarity === 'Gold DON!!') {
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
    LIMIT ?
  `).all(...values, isRiftbound ? 2000 : 300).map(forRenderer);
}

function listRarities(gameCode = 'ONEPIECE', setCode = 'All') {
  const game = normalizedGameCode(gameCode);
  if (game === RIFTBOUND_GAME_CODE) {
    const rows = setCode && setCode !== 'All'
      ? database.prepare('SELECT rarity, variant, manual_category FROM cards WHERE game_code=? AND UPPER(TRIM(set_code))=?').all(game, String(setCode).trim().toUpperCase())
      : database.prepare('SELECT rarity, variant, manual_category FROM cards WHERE game_code=?').all(game);
    const counts = new Map();
    for (const row of rows) {
      const rarity = String(row.rarity || '').trim();
      if (rarity) counts.set(rarity, (counts.get(rarity) || 0) + 1);
      const manual = String(row.manual_category || '').trim();
      const treatment = manual === 'Standard' ? '' : (RIFTBOUND_TREATMENTS.includes(manual) ? manual : String(row.variant || '').trim());
      if (treatment) counts.set(treatment, (counts.get(treatment) || 0) + 1);
    }
    const order = ['SIGNATURE', 'OVERNUMBERED', 'ALTERNATE ART', 'PROMO', 'ULTIMATE', 'EPIC', 'RARE', 'UNCOMMON', 'COMMON'];
    const displayLabels = { PROMO: 'Promo', ULTIMATE: 'Ultimate', EPIC: 'Epic', RARE: 'Rare', UNCOMMON: 'Uncommon', COMMON: 'Common' };
    return [...counts].map(([value, count]) => ({ filter: value, label: displayLabels[value.toUpperCase()] || value, count }))
      .sort((left, right) => {
        const leftRank = order.indexOf(left.label.toUpperCase());
        const rightRank = order.indexOf(right.label.toUpperCase());
        return (leftRank < 0 ? 99 : leftRank) - (rightRank < 0 ? 99 : rightRank) || left.label.localeCompare(right.label);
      });
  }
  const entries = database.prepare(`
    SELECT TRIM(rarity) AS value, TRIM(COALESCE(variant, '')) AS variant,
      TRIM(COALESCE(manual_category, '')) AS manual_category, COUNT(*) AS count
    FROM cards
    WHERE UPPER(TRIM(COALESCE(game_code, 'ONEPIECE'))) = 'ONEPIECE'
      AND TRIM(COALESCE(rarity, '')) != ''
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

function requireOnePieceCard(id, destination) {
  const card = database.prepare("SELECT id, UPPER(TRIM(COALESCE(game_code, 'ONEPIECE'))) AS game_code FROM cards WHERE id = ?").get(Number(id));
  if (!card) throw new Error('Choose a valid One Piece Library card.');
  if (card.game_code !== 'ONEPIECE') throw new Error(`Riftbound cards are isolated from the One Piece ${destination}.`);
  return card;
}

function setSaved(id, shouldSave) {
  if (shouldSave) {
    database.prepare('INSERT OR IGNORE INTO saved_cards (card_id, saved_at) VALUES (?, ?)').run(id, new Date().toISOString());
  } else {
    database.prepare('DELETE FROM saved_cards WHERE card_id = ?').run(id);
  }
  return getCard(id);
}

function boardOrderRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).map(row => ({
    card_id: Number(row.card_id ?? row.id),
    position: Number(row.position)
  })).filter(row => row.card_id > 0 && row.position > 0);
}

function matchingPresetSlotForRows(rows = []) {
  const order = boardOrderRows(rows);
  if (!order.length) return 0;
  const candidates = database.prepare('SELECT slot FROM break_board_presets ORDER BY slot ASC').all()
    .map(row => Number(row.slot))
    .filter(slot => {
      const cards = database.prepare('SELECT card_id, position FROM break_board_preset_cards WHERE slot = ? ORDER BY position ASC').all(slot);
      return sameBoardOrder(order, cards);
    });
  const workingSlot = Number(getMetadata(BREAK_BOARD_WORKING_PRESET_SLOT_KEY) || 0);
  if (candidates.includes(workingSlot)) return workingSlot;
  return candidates.length === 1 ? candidates[0] : 0;
}

function workingCustomMappingForRows(rows = []) {
  const slot = matchingPresetSlotForRows(rows);
  return slot ? loadPresetCustomMapping(database, slot) : null;
}

function decorateBoardWithCustomMapping(rows = [], mapping = null) {
  if (!mapping?.spots?.length) return rows;
  const spots = new Map(mapping.spots.map(spot => [Number(spot.position), spot]));
  return rows.map(row => {
    const spot = spots.get(Number(row.position));
    return spot ? {
      ...row,
      break_spot_label: customMappingSpotDisplayLabel(spot) || String(row.break_spot_label || row.name || 'Mapped Spot'),
      custom_break_mapping: true
    } : row;
  });
}

function decorateSinglesForPreset(rows = [], presetSlot = 0) {
  const singles = decorateRiftboundSinglesBoard(rows);
  if (Number(presetSlot) === 9) return decorateSpiritforgedBoardNineListing(singles);
  if (Number(presetSlot) === 10) return decorateVendettaBoardTenListing(singles);
  return singles;
}

function mappingModeFromMatchingPreset(rows = []) {
  const order = boardOrderRows(rows);
  if (!order.length) return BREAK_BOARD_MAPPING_MODES.MAPPED;
  const presets = database.prepare('SELECT slot, mapping_mode FROM break_board_presets ORDER BY slot ASC').all();
  const matches = presets.filter(preset => {
    const cards = database.prepare('SELECT card_id, position FROM break_board_preset_cards WHERE slot = ? ORDER BY position ASC').all(preset.slot);
    return sameBoardOrder(order, cards);
  });
  const workingSlot = Number(getMetadata(BREAK_BOARD_WORKING_PRESET_SLOT_KEY) || 0);
  const workingMatch = matches.find(preset => Number(preset.slot) === workingSlot);
  if (workingMatch) return normalizeBreakBoardMappingMode(workingMatch.mapping_mode);
  const modes = [...new Set(matches.map(preset => normalizeBreakBoardMappingMode(preset.mapping_mode)))];
  return modes.length === 1 ? modes[0] : BREAK_BOARD_MAPPING_MODES.MAPPED;
}

function workingBreakBoardMappingMode(requestedMode) {
  if (isBreakBoardMappingMode(requestedMode)) return normalizeBreakBoardMappingMode(requestedMode);
  const stored = getMetadata(BREAK_BOARD_WORKING_MAPPING_MODE_KEY);
  if (isBreakBoardMappingMode(stored)) return normalizeBreakBoardMappingMode(stored);
  const workingSlot = Number(getMetadata(BREAK_BOARD_WORKING_PRESET_SLOT_KEY) || 0);
  const preset = workingSlot
    ? database.prepare('SELECT mapping_mode FROM break_board_presets WHERE slot = ?').get(workingSlot)
    : null;
  return normalizeBreakBoardMappingMode(preset?.mapping_mode);
}

function breakRoundMappingMode(round, rows = []) {
  if (isBreakBoardMappingMode(round?.mapping_mode)) return normalizeBreakBoardMappingMode(round.mapping_mode);
  const inferred = mappingModeFromMatchingPreset(rows);
  if (Number(round?.id) > 0) {
    database.prepare('UPDATE break_rounds SET mapping_mode = ? WHERE id = ? AND mapping_mode IS NULL')
      .run(inferred, Number(round.id));
    round.mapping_mode = inferred;
  }
  return inferred;
}

function activeBreakBoardMappingMode(rows = []) {
  return breakRoundMappingMode(activeBreakRound(), rows);
}

function listBreakBoardCards() {
  const cards = database.prepare(`
    SELECT c.*, b.position, CASE WHEN s.card_id IS NULL THEN 0 ELSE 1 END AS is_saved,
      1 AS is_on_board
    FROM break_board_cards b
    JOIN cards c ON c.id = b.card_id
    LEFT JOIN saved_cards s ON s.card_id = c.id
    ORDER BY b.position ASC
  `).all().map(forRenderer);
  const workingSlot = Number(getMetadata(BREAK_BOARD_WORKING_PRESET_SLOT_KEY) || 0);
  const decorated = workingBreakBoardMappingMode() === BREAK_BOARD_MAPPING_MODES.SINGLES
    ? decorateSinglesForPreset(cards, workingSlot)
    : decorateUnleashedExpandedBreakBoard(
      decorateSpiritforgedExpandedBreakBoard(
        decorateUnleashedCaseBreakBoard(decorateUnleashedTop80Board(decorateUnleashedColorBreakBoard(cards)))
      )
    );
  return decorateBoardWithCustomMapping(decorateBreakBoardListingNames(decorated), workingCustomMappingForRows(cards));
}

function listActiveBreakBoardCards() {
  const cards = database.prepare(`
    SELECT c.*, b.position, b.status AS block_status, b.buyer_name, b.called_at, b.message_marked, b.tracker_marked, b.sale_amount_cents,
      CASE WHEN s.card_id IS NULL THEN 0 ELSE 1 END AS is_saved,
      1 AS is_on_board
    FROM active_break_board_cards b
    JOIN cards c ON c.id = b.card_id
    LEFT JOIN saved_cards s ON s.card_id = c.id
    ORDER BY b.position ASC
  `).all().map(forRenderer);
  const activePresetSlot = matchingPresetSlotForRows(cards);
  const decorated = activeBreakBoardMappingMode(cards) === BREAK_BOARD_MAPPING_MODES.SINGLES
    ? decorateSinglesForPreset(cards, activePresetSlot)
    : decorateUnleashedExpandedBreakBoard(
      decorateSpiritforgedExpandedBreakBoard(
        decorateUnleashedCaseBreakBoard(decorateUnleashedTop80Board(decorateUnleashedColorBreakBoard(cards)))
      )
    );
  const round = activeBreakRound();
  return decorateBoardWithCustomMapping(decorated, round ? loadRoundCustomMapping(database, round.id) : null);
}

function historyPageLimit(payload = {}) {
  const value = Number(payload?.limit ?? payload);
  return Number.isInteger(value) && value > 0 ? Math.min(250, value) : 10;
}

function listBreakOrderHistory(payload = {}) {
  const limit = historyPageLimit(payload);
  const includePulls = payload?.includePulls === true;
  const summaryRows = database.prepare(`
    SELECT id, break_name, box_cost_cents, gross_sales_cents, priced_order_count,
      unpriced_order_count, confirmed_order_count,
      whatnot_commission_bps, whatnot_processing_bps,
      whatnot_transaction_fee_cents, whatnot_transaction_count,
      whatnot_fee_tax_bps, whatnot_additional_fee_cents,
      whatnot_actual_fee_cents, notes, disposition, tracker_record_type,
      tracker_game_code, tracker_set_code, tracker_set_name, box_tracker_id,
      recorded_at
    FROM break_order_history
    ORDER BY recorded_at DESC, id DESC
  `).all();
  const histories = database.prepare(`
    SELECT id, break_name, box_cost_cents, gross_sales_cents, priced_order_count,
      unpriced_order_count, confirmed_order_count,
      whatnot_commission_bps, whatnot_processing_bps,
      whatnot_transaction_fee_cents, whatnot_transaction_count,
      whatnot_fee_tax_bps, whatnot_additional_fee_cents,
      whatnot_actual_fee_cents, notes, disposition, tracker_record_type,
      tracker_game_code, tracker_set_code, tracker_set_name, box_tracker_id,
      recorded_at,
      (SELECT COALESCE(SUM(p.quantity), 0)
        FROM break_order_history_pulls p
        WHERE p.history_id = break_order_history.id) AS selected_pull_count
    FROM break_order_history
    ORDER BY recorded_at DESC, id DESC
    LIMIT ?
  `).all(limit);
  const listItems = database.prepare(`
    SELECT i.position, i.buyer_name, i.card_name, i.card_number, i.set_code, i.rarity,
      i.sale_amount_cents, i.assigned_at
    FROM break_order_history_items i
    WHERE i.history_id = ?
    ORDER BY i.position ASC
  `);
  // The visible Orders tab needs purchased spots, not a second copy of Pull
  // History. Pull rows are loaded only by internal audit callers that opt in.
  const listPulls = includePulls ? database.prepare(`
    SELECT p.position, p.buyer_name, p.card_name, p.card_number, p.set_code,
      p.rarity, p.collector_treatment, p.variant_hint, p.quantity, p.source_kind
    FROM break_order_history_pulls p
    WHERE p.history_id = ?
    ORDER BY p.position ASC, p.id ASC
  `) : null;
  const listTrackerCaseLink = database.prepare(`
    SELECT link.tracker_id, link.box_number, tracker.tracker_name
    FROM box_tracker_history_links link
    JOIN box_trackers tracker ON tracker.id = link.tracker_id
    WHERE link.history_id = ?
  `);
  const records = histories.map(history => ({
    ...history,
    tracker_case_link: listTrackerCaseLink.get(history.id) || null,
    whatnot_fees: whatnotFeeBreakdown(history),
    items: listItems.all(history.id),
    pulls: includePulls ? listPulls.all(history.id) : []
  }));
  const completeRows = summaryRows.filter(history => !Number(history.unpriced_order_count || 0) && Number(history.box_cost_cents || 0) > 0);
  return {
    records,
    totalCount: summaryRows.length,
    summary: {
      totalGrossCents: summaryRows.reduce((total, history) => total + Math.max(0, Number(history.gross_sales_cents || 0)), 0),
      totalCostsCents: summaryRows.reduce((total, history) => total + Math.max(0, Number(history.box_cost_cents || 0)), 0),
      totalWhatnotFeesCents: summaryRows.reduce((total, history) => total + whatnotFeeBreakdown(history).totalWhatnotFeeCents, 0),
      incompletePriceCount: summaryRows.reduce((total, history) => total + Math.max(0, Number(history.unpriced_order_count || 0)), 0),
      completeRecordCount: completeRows.length,
      completeNetCents: completeRows.reduce((total, history) => total + whatnotFeeBreakdown(history).netProfitCents, 0)
    }
  };
}

function listPullHistoryForRenderer(payload = {}) {
  const limit = historyPageLimit(payload);
  const batches = listPullHistory(database, { limit });
  const imageRows = pullHistoryImageRows(database, batches.map(batch => batch.id));
  const images = new Map(imageRows.map(row => [Number(row.pull_item_id), row]));
  const records = batches.map(batch => ({
    ...batch,
    items: (batch.items || []).map(item => {
      const image = images.get(Number(item.id)) || {};
      return {
        ...item,
        image_url: image.image_path && hasUsableCachedImage(image.image_path)
          ? pathToFileURL(image.image_path).href
          : String(image.image_url || '')
      };
    })
  }));
  return {
    records,
    totalCount: Number(database.prepare('SELECT COUNT(*) AS count FROM pull_history_batches').get().count || 0)
  };
}

function addSavedPullHistoryCard(payload = {}) {
  const batchId = Math.floor(Number(payload.batchId || payload.batch_id));
  const cardId = Math.floor(Number(payload.cardId || payload.card_id));
  const position = Math.floor(Number(payload.position));
  const quantity = Math.floor(Number(payload.quantity || 1));
  if (!Number.isInteger(batchId) || batchId < 1) throw new Error('Choose a valid Pull History record first.');
  if (!Number.isInteger(cardId) || cardId < 1) throw new Error('Choose the exact missed card first.');
  if (!Number.isInteger(position) || position < 1) throw new Error('Choose the buyer spot that pulled this card.');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error('Quantity must be between 1 and 99.');

  const batch = database.prepare(`
    SELECT id, game_code, set_code, set_name
    FROM pull_history_batches
    WHERE id = ?
  `).get(batchId);
  if (!batch) throw new Error('That Pull History record no longer exists.');
  const spot = database.prepare(`
    SELECT buyer_name, position
    FROM pull_history_spots
    WHERE batch_id = ? AND position = ?
  `).get(batchId, position);
  if (!spot) throw new Error('That saved spot does not belong to this Pull History record.');
  const card = getCard(cardId);
  if (!card) throw new Error('That card is no longer available in the Library.');

  const batchGame = normalizedGameCode(batch.game_code);
  const cardGame = normalizedGameCode(card.game_code);
  if (batchGame !== cardGame) {
    throw new Error(`Choose a ${batchGame === RIFTBOUND_GAME_CODE ? 'Riftbound' : 'One Piece'} card for this saved record.`);
  }
  const batchSet = String(batch.set_code || '').trim().toUpperCase();
  const cardSet = String(card.set_code || '').trim().toUpperCase();
  if (batchSet && batchSet !== 'MULTI' && cardSet !== batchSet) {
    throw new Error(`Choose a ${batchSet} card for this saved Pull History record.`);
  }

  const item = pullHistorySnapshotItem({
    ...card,
    buyer_name: spot.buyer_name,
    position: spot.position,
    quantity,
    source_kind: 'history-edit'
  });
  const result = addPullHistoryCardCorrection(database, {
    batchId,
    position,
    item,
    correctedAt: new Date().toISOString()
  });
  invalidateOrderHitTracker();
  return result;
}

function historyDefaultBreakName(items) {
  const setCodes = [...new Set(items.map(item => String(item.set_code || '').trim()).filter(Boolean))];
  if (setCodes.length === 1) return `${setCodes[0]} character break`;
  return 'Saved character break';
}

function getBuyerAnalytics() {
  // Loyalty/spend history can still use every completed normal-sale order.
  // Profit/Cooked is intentionally separate and reads ONLY Pull History rows
  // that contain their own saved spot/payment snapshot.
  const loyaltyRows = database.prepare(`
    SELECT i.history_id, i.buyer_name, i.sale_amount_cents, i.assigned_at, h.recorded_at
    FROM break_order_history_items i
    JOIN break_order_history h ON h.id = i.history_id
    WHERE TRIM(i.buyer_name) != ''
      AND UPPER(TRIM(COALESCE(h.disposition,'NORMAL_BREAK'))) = 'NORMAL_BREAK'
    ORDER BY COALESCE(i.assigned_at, h.recorded_at) DESC, i.id DESC
  `).all();
  const loyalty = buildBuyerAnalytics(loyaltyRows, []);

  const outcomePurchases = database.prepare(`
    SELECT s.batch_id AS history_id, s.buyer_name,
      s.paid_cents AS sale_amount_cents,
      b.recorded_at AS assigned_at, b.recorded_at
    FROM pull_history_spots s
    JOIN pull_history_batches b ON b.id = s.batch_id
    WHERE TRIM(s.buyer_name) != ''
    ORDER BY b.recorded_at DESC, s.batch_id DESC, s.position ASC
  `).all();
  const outcomeMarket = database.prepare(`
    SELECT i.batch_id AS history_id, i.batch_id, i.buyer_name, i.quantity, i.market_price_cents
    FROM pull_history_items i
    JOIN pull_history_spots s ON s.batch_id=i.batch_id AND s.position=i.position
    JOIN pull_history_batches b ON b.id=i.batch_id
    WHERE TRIM(i.buyer_name) != ''
      AND LOWER(TRIM(REPLACE(i.buyer_name,'@',''))) = LOWER(TRIM(REPLACE(s.buyer_name,'@','')))
    UNION ALL
    SELECT i.batch_id AS history_id, i.batch_id, s.buyer_name, 1 AS quantity, NULL AS market_price_cents
    FROM pull_history_items i
    JOIN pull_history_spots s ON s.batch_id=i.batch_id AND s.position=i.position
    WHERE TRIM(i.buyer_name) != '' AND TRIM(s.buyer_name) != ''
      AND LOWER(TRIM(REPLACE(i.buyer_name,'@',''))) != LOWER(TRIM(REPLACE(s.buyer_name,'@','')))
  `).all();
  const outcomes = buildBuyerAnalytics(outcomePurchases, outcomeMarket, { pullHistorySnapshotCohort: true });
  const coverage = database.prepare(`
    SELECT COUNT(DISTINCT s.batch_id) AS batch_count,
      COUNT(*) AS purchase_count,
      MIN(b.recorded_at) AS first_recorded_at,
      MAX(b.recorded_at) AS last_recorded_at
    FROM pull_history_spots s
    JOIN pull_history_batches b ON b.id=s.batch_id
    WHERE TRIM(s.buyer_name) != ''
  `).get() || {};
  return {
    ...loyalty,
    outcomes,
    pullHistoryCoverage: {
      source: 'PULL_HISTORY_ONLY',
      batchCount: Number(coverage.batch_count || 0),
      purchaseCount: Number(coverage.purchase_count || 0),
      firstRecordedAt: String(coverage.first_recorded_at || ''),
      lastRecordedAt: String(coverage.last_recorded_at || '')
    }
  };
}

function getBuyerCaseFile(value) {
  const key = buyerKey(value);
  if (!key) throw new Error('Enter a Whatnot buyer username, such as @kod.');
  if (key.length > 180) throw new Error('That buyer username is too long.');

  // Buyer outcome files intentionally use Pull History only. Older order-only
  // purchases are excluded because they do not contain the saved pull value
  // needed to decide Profit/Cooked fairly.
  const purchases = database.prepare(`
    SELECT s.batch_id AS history_id, s.position, s.buyer_name,
      (COALESCE(NULLIF(b.set_name,''), NULLIF(b.set_code,''), 'Saved Pull History') || ' spot') AS card_name,
      CAST(s.position AS TEXT) AS card_number, b.set_code, 'Spot' AS rarity,
      s.paid_cents AS sale_amount_cents, b.recorded_at AS assigned_at,
      COALESCE(NULLIF(b.set_name,''), NULLIF(b.set_code,''), 'Saved Pull History') AS break_name,
      '' AS notes, b.recorded_at
    FROM pull_history_spots s
    JOIN pull_history_batches b ON b.id=s.batch_id
    WHERE LOWER(TRIM(REPLACE(s.buyer_name, '@', ''))) = ?
    ORDER BY b.recorded_at DESC, s.position
  `).all(key);
  const pulls = database.prepare(`
    SELECT i.batch_id AS history_id, i.buyer_name, i.position, i.card_name, i.card_number,
      i.set_code, i.rarity, i.collector_treatment, i.variant_hint,
      i.quantity, i.source_kind,
      COALESCE(NULLIF(b.set_name,''), NULLIF(b.set_code,''), 'Saved Pull History') AS break_name,
      '' AS notes, b.recorded_at
    FROM pull_history_items i
    JOIN pull_history_spots s ON s.batch_id=i.batch_id AND s.position=i.position
    JOIN pull_history_batches b ON b.id=i.batch_id
    WHERE LOWER(TRIM(REPLACE(i.buyer_name, '@', ''))) = ?
      AND LOWER(TRIM(REPLACE(i.buyer_name,'@',''))) = LOWER(TRIM(REPLACE(s.buyer_name,'@','')))
    ORDER BY b.recorded_at DESC, i.position, i.id
  `).all(key);
  const marketRows = database.prepare(`
    SELECT i.batch_id AS history_id, i.batch_id, i.buyer_name, i.position, i.card_name, i.card_number,
      i.set_code, i.rarity, i.collector_treatment, i.variant_hint,
      i.quantity, i.market_price_cents, i.market_source, i.market_variant,
      i.market_updated_at, b.game_code, b.set_name,
      COALESCE(NULLIF(b.set_name,''), NULLIF(b.set_code,''), 'Saved Pull History') AS break_name,
      b.recorded_at AS batch_recorded_at, b.price_refreshed_at
    FROM pull_history_items i
    JOIN pull_history_spots s ON s.batch_id=i.batch_id AND s.position=i.position
    JOIN pull_history_batches b ON b.id=i.batch_id
    WHERE LOWER(TRIM(REPLACE(i.buyer_name, '@', ''))) = ?
      AND LOWER(TRIM(REPLACE(i.buyer_name,'@',''))) = LOWER(TRIM(REPLACE(s.buyer_name,'@','')))
    ORDER BY b.recorded_at DESC, i.position, i.id
  `).all(key);
  const result = buildBuyerCaseFile(purchases, pulls, marketRows, value, { pullHistorySnapshotCohort: true });
  const buyerSpotMismatchCount = Number(database.prepare(`
    SELECT COUNT(*) AS count
    FROM pull_history_spots s
    JOIN pull_history_items i ON i.batch_id=s.batch_id AND i.position=s.position
    WHERE LOWER(TRIM(REPLACE(s.buyer_name,'@',''))) = ?
      AND LOWER(TRIM(REPLACE(i.buyer_name,'@',''))) != LOWER(TRIM(REPLACE(s.buyer_name,'@','')))
  `).get(key)?.count || 0);
  if (buyerSpotMismatchCount && result?.totals) {
    result.totals.valuationComplete = false;
    result.totals.resultStatus = 'incomplete';
    result.totals.dataIssueCount = buyerSpotMismatchCount;
  }
  return result;
}

function buyerCaseReport(value) {
  const caseFile = getBuyerCaseFile(value);
  if (!caseFile.found) throw new Error(`No Pull History purchases were found for @${caseFile.buyerName}.`);
  const money = cents => `$${(Math.max(0, Number(cents || 0)) / 100).toFixed(2)}`;
  const when = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Time not captured' : date.toLocaleString('en-US');
  };
  const lines = [
    `BreakSuite Pull History Buyer Result — @${caseFile.buyerName}`,
    `Pull History breaks: ${caseFile.totals.breakCount}`,
    `Tracked Pull History purchases: ${caseFile.totals.purchaseCount}`,
    `Tracked spend: ${money(caseFile.totals.totalSpendCents)}`,
    `Exact saved pull cards: ${caseFile.totals.totalPulledCards}`,
    `Recorded hit market value: ${money(caseFile.totals.totalMarketValueCents)}`,
    `Recorded hit value minus tracked spend: ${caseFile.totals.valuationComplete ? `${caseFile.totals.valueDifferenceCents >= 0 ? '+' : '-'}${money(Math.abs(caseFile.totals.valueDifferenceCents))}` : 'Needs pricing'}`,
    ''
  ];
  for (const record of caseFile.records) {
    lines.push(`${record.breakName} — Pull History ${when(record.recordedAt)}`);
    lines.push('Purchased spots:');
    for (const item of record.purchases) {
      const identity = [item.cardName, item.cardNumber, item.rarity].filter(Boolean).join(' · ');
      lines.push(`- Spot ${item.position}: ${identity || 'Saved spot'} — ${item.paidCents ? money(item.paidCents) : 'price not captured'} — assigned ${when(item.assignedAt)}`);
    }
    lines.push('Saved pulls:');
    if (record.pulls.length) {
      for (const item of record.pulls) {
        const identity = [item.cardName, item.cardNumber, item.rarity, item.collectorTreatment, item.variantHint].filter(Boolean).join(' · ');
        lines.push(`- Spot ${item.position}: ${identity || 'Saved pull'}${item.quantity > 1 ? ` ×${item.quantity}` : ''}`);
      }
    } else lines.push('- No recorded hit cards for this buyer in this Pull History break; recorded hit value is $0.');
    if (record.notes) lines.push(`Break notes: ${record.notes}`);
    lines.push('');
  }
  lines.push('Older saved hits and market values:');
  for (const batch of caseFile.valuedBreaks) {
    lines.push(`${batch.breakLabel} — ${when(batch.recordedAt)} — ${batch.unpricedCards ? 'pricing incomplete' : money(batch.totalMarketValueCents)}`);
    for (const item of batch.hits) {
      const identity = [item.cardName, item.cardNumber, item.rarity, item.collectorTreatment].filter(Boolean).join(' · ');
      lines.push(`- ${identity || 'Saved hit'}${item.quantity > 1 ? ` ×${item.quantity}` : ''} — ${item.marketTotalCents == null ? 'market price missing' : money(item.marketTotalCents)}`);
    }
  }
  const report = lines.join('\n').trim();
  clipboard.writeText(report);
  return { copied: true, buyerName: caseFile.buyerName, report };
}

function getChaserTracker() {
  let settings = { cardId: null, thresholdCents: 1000, slotCount: 15, qualifiers: [], startedAt: '1970-01-01T00:00:00.000Z' };
  try { settings = { ...settings, ...JSON.parse(getMetadata(CHASER_TRACKER_KEY) || '{}') }; } catch {}
  settings.slotCount = Math.max(1, Math.min(20, Number(settings.slotCount || 15)));
  settings.qualifiers = Array.isArray(settings.qualifiers) ? settings.qualifiers.slice(0, settings.slotCount) : [];
  const rows = database.prepare(`SELECT buyer_name, sale_amount_cents, called_at FROM active_break_board_cards WHERE status='called' AND TRIM(buyer_name) != '' AND COALESCE(called_at, saved_at) >= ? ORDER BY COALESCE(called_at, saved_at), position`).all(settings.startedAt || '1970-01-01T00:00:00.000Z');
  const running = new Map();
  for (const row of rows) {
    const key = normalizedBuyerHandle(row.buyer_name); const next = Number(running.get(key) || 0) + Math.max(0, Number(row.sale_amount_cents || 0)); running.set(key, next);
    if (next >= settings.thresholdCents && settings.qualifiers.length < settings.slotCount && !settings.qualifiers.some(item => normalizedBuyerHandle(item.buyer) === key)) settings.qualifiers.push({ buyer: row.buyer_name, amountCents: next, qualifiedAt: row.called_at || new Date().toISOString() });
  }
  setMetadata(CHASER_TRACKER_KEY, JSON.stringify(settings));
  let card = settings.cardId ? database.prepare(`SELECT id,name,card_number,rarity,variant,manual_category FROM cards WHERE id=?`).get(settings.cardId) : null;
  if (card) card = { ...card, break_rarity: breakRarityForCard(card) };
  return { settings, card };
}
function saveChaserTracker(payload = {}) {
  const current = getChaserTracker().settings; const thresholdCents = currencyToCents(payload.threshold);
  const slotCount = Math.max(1, Math.min(20, Number(payload.slotCount || 15)));
  const changed = thresholdCents !== current.thresholdCents || slotCount !== current.slotCount;
  const cardId = Number(payload.cardId || current.cardId || 0);
  const settings = { cardId: Number.isInteger(cardId) && cardId > 0 ? cardId : null, thresholdCents: thresholdCents || current.thresholdCents, slotCount, qualifiers: changed ? [] : current.qualifiers, startedAt: changed ? new Date().toISOString() : (current.startedAt || '1970-01-01T00:00:00.000Z') };
  setMetadata(CHASER_TRACKER_KEY, JSON.stringify(settings)); return getChaserTracker();
}
function refreshChaserTracker() { return getChaserTracker(); }
function resetChaserTracker() { const current = getChaserTracker().settings; current.qualifiers = []; current.startedAt = new Date().toISOString(); setMetadata(CHASER_TRACKER_KEY, JSON.stringify(current)); return getChaserTracker(); }
function copyChaserNames() { const tracker = getChaserTracker(); const names = tracker.settings.qualifiers.map((item, index) => `${index + 1}. @${String(item.buyer).replace(/^@+/, '')}`).join('\n'); clipboard.writeText(`Live Chasers\n${names || 'No qualifiers yet.'}`); return { copied: tracker.settings.qualifiers.length }; }
function getRecentBuyerMentions() {
  const rows = database.prepare(`
    SELECT i.buyer_name
    FROM break_order_history_items i
    JOIN break_order_history h ON h.id = i.history_id
    WHERE TRIM(i.buyer_name) != ''
      AND UPPER(TRIM(COALESCE(h.disposition,'NORMAL_BREAK'))) = 'NORMAL_BREAK'
    ORDER BY COALESCE(i.assigned_at, h.recorded_at) DESC, i.id DESC
  `).all();
  const names = recentUniqueBuyerNames(rows, 100);
  return { names, chunks: splitBuyerMentions(names, 150), maxBuyers: 100, maxCharacters: 150 };
}
function copyRecentBuyerMentionChunk(index) {
  const data = getRecentBuyerMentions();
  const chunkIndex = Number(index);
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= data.chunks.length) throw new Error('That buyer-name group is not available.');
  clipboard.writeText(data.chunks[chunkIndex]);
  return { copied: true, index: chunkIndex, buyerCount: data.names.length, characters: data.chunks[chunkIndex].length };
}
function setChaserCard(cardId) { const card = requireOnePieceCard(cardId, 'Live Chasers'); const settings = getChaserTracker().settings; settings.cardId = card.id; setMetadata(CHASER_TRACKER_KEY, JSON.stringify(settings)); return getChaserTracker(); }

function getRoyalChaserTracker() {
  let settings = { cardId: null, thresholdCents: 25000, slotCount: 15, qualifiers: [], excludedBuyerKeys: [], startedAt: '1970-01-01T00:00:00.000Z' };
  try { settings = { ...settings, ...JSON.parse(getMetadata(ROYAL_CHASER_TRACKER_KEY) || '{}') }; } catch {}
  settings.slotCount = Math.max(1, Math.min(20, Number(settings.slotCount || 15)));
  settings.qualifiers = Array.isArray(settings.qualifiers) ? settings.qualifiers.slice(0, settings.slotCount) : [];
  settings.excludedBuyerKeys = Array.isArray(settings.excludedBuyerKeys) ? settings.excludedBuyerKeys : [];
  const rows = database.prepare(`SELECT i.buyer_name, i.sale_amount_cents, COALESCE(i.assigned_at,h.recorded_at) AS earned_at FROM break_order_history_items i JOIN break_order_history h ON h.id=i.history_id WHERE TRIM(i.buyer_name)!='' AND COALESCE(i.assigned_at,h.recorded_at)>=? ORDER BY COALESCE(i.assigned_at,h.recorded_at),i.id`).all(settings.startedAt || '1970-01-01T00:00:00.000Z');
  const running = new Map(); const names = new Map();
  for (const row of rows) { const key = normalizedBuyerHandle(row.buyer_name); const next = Number(running.get(key) || 0) + Math.max(0, Number(row.sale_amount_cents || 0)); running.set(key, next); names.set(key, row.buyer_name); if (next >= settings.thresholdCents && settings.qualifiers.length < settings.slotCount && !settings.excludedBuyerKeys.includes(key) && !settings.qualifiers.some(item => normalizedBuyerHandle(item.buyer) === key)) settings.qualifiers.push({ buyer: row.buyer_name, amountCents: next, qualifiedAt: row.earned_at || new Date().toISOString() }); }
  setMetadata(ROYAL_CHASER_TRACKER_KEY, JSON.stringify(settings));
  let card = settings.cardId ? database.prepare('SELECT id,name,card_number,rarity,variant,manual_category FROM cards WHERE id=?').get(settings.cardId) : null;
  if (card) card = { ...card, break_rarity: breakRarityForCard(card) };
  const lockedKeys = new Set(settings.qualifiers.map(item => normalizedBuyerHandle(item.buyer)));
  const standings = [...running.entries()].map(([key,totalCents]) => ({ buyer:names.get(key), totalCents, remainingCents:Math.max(0,settings.thresholdCents-totalCents), locked:lockedKeys.has(key) })).sort((a,b)=>b.totalCents-a.totalCents || String(a.buyer).localeCompare(String(b.buyer))).slice(0,settings.slotCount);
  return { settings, card, standings };
}
function saveRoyalChaserTracker(payload = {}) { const current = getRoyalChaserTracker().settings; const thresholdCents = currencyToCents(payload.threshold); const slotCount = Math.max(1, Math.min(20, Number(payload.slotCount || 15))); const changed = thresholdCents !== current.thresholdCents || slotCount !== current.slotCount; const settings = { ...current, thresholdCents: thresholdCents || current.thresholdCents, slotCount, qualifiers: changed ? [] : current.qualifiers, startedAt: changed ? '1970-01-01T00:00:00.000Z' : (current.startedAt || '1970-01-01T00:00:00.000Z') }; setMetadata(ROYAL_CHASER_TRACKER_KEY, JSON.stringify(settings)); return getRoyalChaserTracker(); }
function resetRoyalChaserTracker() { const current = getRoyalChaserTracker().settings; current.qualifiers=[]; current.excludedBuyerKeys=[]; current.startedAt='1970-01-01T00:00:00.000Z'; setMetadata(ROYAL_CHASER_TRACKER_KEY, JSON.stringify(current)); return getRoyalChaserTracker(); }
function copyRoyalChaserNames() { const tracker=getRoyalChaserTracker(); const names=tracker.settings.qualifiers.map((item,index)=>`${index+1}. @${String(item.buyer).replace(/^@+/, '')}`).join('\n'); clipboard.writeText(`Royal Chasers\n${names || 'No qualifiers yet.'}`); return {copied:tracker.settings.qualifiers.length}; }
function setRoyalChaserCard(cardId) { const card=requireOnePieceCard(cardId, 'Royal Chasers'); const settings=getRoyalChaserTracker().settings; settings.cardId=card.id; setMetadata(ROYAL_CHASER_TRACKER_KEY,JSON.stringify(settings)); return getRoyalChaserTracker(); }
function unlockRoyalChaserBuyer(buyer) { const current=getRoyalChaserTracker().settings; const key=normalizedBuyerHandle(buyer); current.qualifiers=(current.qualifiers||[]).filter(item=>normalizedBuyerHandle(item.buyer)!==key); current.excludedBuyerKeys=[...new Set([...(current.excludedBuyerKeys||[]),key])]; setMetadata(ROYAL_CHASER_TRACKER_KEY,JSON.stringify(current)); return getRoyalChaserTracker(); }

function normalizedBuyerHandle(value) {
  return String(value || '').trim().replace(/^@+/, '').toLowerCase();
}

function welcomeVipBuyer(payload = {}) {
  const buyerName = String(payload.buyerName || payload.buyer || '').trim().replace(/^@+/, '');
  const key = normalizedBuyerHandle(buyerName);
  if (!key) throw new Error('A chat buyer name is required.');
  const spend = database.prepare(`
    SELECT COUNT(*) AS purchases, COALESCE(SUM(i.sale_amount_cents), 0) AS total_spend_cents
    FROM break_order_history_items i
    WHERE LOWER(TRIM(REPLACE(i.buyer_name, '@', ''))) = ?
  `).get(key);
  const totalSpendCents = Math.max(0, Number(spend?.total_spend_cents || 0));
  if (totalSpendCents < VIP_MIN_SPEND_CENTS) return { matched: false };
  const now = Date.now();
  if (now - Number(recentVipAlerts.get(key) || 0) < VIP_ALERT_COOLDOWN_MS) return { matched: false, duplicate: true };
  recentVipAlerts.set(key, now);
  while (recentVipAlerts.size > 500) recentVipAlerts.delete(recentVipAlerts.keys().next().value);
  vipAlert = { id: `${now}-${key}`, buyerName, detectedAt: new Date(now).toISOString() };
  vipAlertFeed = [vipAlert, ...vipAlertFeed.filter((alert) => alert.id !== vipAlert.id)].slice(0, VIP_ALERT_FEED_LIMIT);
  openVipAlertWindow();
  return { matched: true, alert: vipAlert };
}

function pullHistorySnapshotItem(card = {}) {
  const rendered = forRenderer(card);
  const gameCode = String(rendered.game_code || '').trim().toUpperCase();
  const isRiftbound = gameCode === RIFTBOUND_GAME_CODE;
  const printing = isRiftbound
    ? lookupOpenRiftPrinting(rendered.card_number, rendered.set_code)
    : null;
  return {
    cardId: Number(rendered.id),
    buyerName: String(rendered.buyer_name || '').trim(),
    position: Number(rendered.position),
    cardName: String(rendered.name || '').trim(),
    cardNumber: String(rendered.card_number || '').trim(),
    setCode: String(rendered.set_code || '').trim(),
    rarity: isRiftbound
      ? (printing?.rarity || '')
      : (breakRarityForCard(rendered) || rendered.rarity || ''),
    collectorTreatment: isRiftbound
      ? (printing?.collectorTreatments.join(' · ') || '')
      : '',
    variantHint: [rendered.variant, rendered.manual_category].filter(value => value && value !== 'Standard').join(' · '),
    quantity: Math.max(1, Number(rendered.quantity || 1)),
    sourceKind: String(rendered.source_kind || 'selected'),
    marketPriceCents: Number.isInteger(rendered.market_price_cents) ? Number(rendered.market_price_cents) : null,
    marketSource: String(rendered.market_price_source || ''),
    marketVariant: String(rendered.market_price_variant || ''),
    marketExternalId: String(rendered.market_price_external_id || ''),
    marketUpdatedAt: rendered.market_price_updated_at || null,
    marketMatchStatus: String(rendered.market_price_match_status || '')
  };
}

function pricingQuantities(cardIds = []) {
  return new Map((Array.isArray(cardIds) ? cardIds : []).map(id => [Number(id), 1]));
}

function liveRiftboundPricingContext() {
  if (!isLiveLedgerCurrent()) throw new Error('Save Board ✓ first so pricing can use the current live ledger.');
  const boardCards = database.prepare(`
    SELECT c.id, b.position, b.status AS block_status, b.buyer_name
    FROM active_break_board_cards b
    JOIN cards c ON c.id = b.card_id
    WHERE UPPER(TRIM(COALESCE(c.game_code, ''))) = ?
    ORDER BY b.position ASC
  `).all(RIFTBOUND_GAME_CODE).filter(card => card.block_status === 'ready' || String(card.buyer_name || '').trim());
  const audit = listRiftboundChampionAudit().filter(entry => String(entry.buyer || '').trim());
  return { boardCards, audit };
}

function buyerBagDisplayedCardIds(buyerKey, roundId = 0) {
  let boardCards;
  let audit;
  if (roundId) {
    requiredPendingBreakRound({ roundId });
    const round = listPendingBreakRounds().find(item => Number(item.id) === Number(roundId));
    if (!round) throw new Error('That pending break is no longer available. Refresh the Breaker Center.');
    boardCards = (round.cards || []).filter(card => card.block_status === 'called'
      && comparableBuyerName(card.buyer_name) === buyerKey);
    audit = (round.audit || []).filter(entry => comparableBuyerName(entry.buyer) === buyerKey);
  } else {
    const live = liveRiftboundPricingContext();
    boardCards = live.boardCards.filter(card => card.block_status !== 'ready'
      && comparableBuyerName(card.buyer_name) === buyerKey);
    audit = live.audit.filter(entry => comparableBuyerName(entry.buyer) === buyerKey);
  }
  return displayedCatalogCardIds(boardCards, audit);
}

function buyerBagPricingSelection(payload = {}) {
  const buyer = String(payload.buyer || '').trim().replace(/^@+/, '');
  if (!buyer) throw new Error('Choose a Buyer Bag first.');
  const buyerKey = comparableBuyerName(buyer);
  const roundId = Math.max(0, Math.floor(Number(payload.roundId) || 0));
  const quantities = pricingQuantities(buyerBagDisplayedCardIds(buyerKey, roundId));
  if (!quantities.size) throw new Error(`No exact cards are displayed in @${buyer}'s Buyer Bag.`);
  return { buyer, roundId, quantities, scope: 'displayed-buyer-bag' };
}

function riftboundBoardPricingSelection() {
  const { boardCards, audit } = liveRiftboundPricingContext();
  const quantities = pricingQuantities(displayedCatalogCardIds(boardCards, audit));
  if (!quantities.size) throw new Error('No Riftbound cards are displayed on the current live board.');
  return { quantities, scope: 'displayed-riftbound-board' };
}

async function refreshBuyerBagPrices(payload = {}) {
  const { buyer, roundId, quantities } = buyerBagPricingSelection(payload);
  const refreshed = await refreshCatalogCardPrices(database, [...quantities.keys()]);
  let matchedCards = 0;
  let unmatchedCards = 0;
  let marketValueCents = 0;
  for (const price of refreshed.prices) {
    const quantity = Number(quantities.get(Number(price.card_id)) || 0);
    if (Number.isInteger(price.market_price_cents)) {
      matchedCards += quantity;
      marketValueCents += Number(price.market_price_cents) * quantity;
    } else {
      unmatchedCards += quantity;
    }
  }
  return {
    buyer,
    roundId,
    refreshedAt: refreshed.refreshedAt,
    selectedCards: [...quantities.values()].reduce((total, quantity) => total + quantity, 0),
    uniqueCards: quantities.size,
    matchedCards,
    unmatchedCards,
    marketValueCents,
    source: refreshed.source
  };
}

function prepareBuyerBagPriceInput(payload = {}) {
  const { buyer, roundId, quantities } = buyerBagPricingSelection(payload);
  const rows = catalogPriceInputRows(database, [...quantities.keys()]).map(row => ({
    ...row,
    quantity: Math.max(1, Number(quantities.get(row.id) || 1))
  }));
  return { buyer, roundId, rows, pricing: getPricingSettings(database) };
}

function applyBuyerBagPriceInput(payload = {}) {
  const { buyer, roundId, quantities } = buyerBagPricingSelection(payload);
  const pricing = getPricingSettings(database);
  const requestedSource = normalizePriceSource(payload.source || pricing.selectedSource);
  if (requestedSource !== pricing.selectedSource) throw new Error('The selected price source changed. Reopen Price Check and try again.');
  if (![PRICE_SOURCE_IDS.CHATGPT, PRICE_SOURCE_IDS.MANUAL].includes(requestedSource)) {
    throw new Error('This price source refreshes automatically and does not accept pasted prices.');
  }
  const applied = applyCatalogCardPriceInputs(database, [...quantities.keys()], payload.entries, requestedSource);
  let matchedCards = 0;
  let unmatchedCards = 0;
  let marketValueCents = 0;
  for (const price of applied.prices) {
    const quantity = Math.max(1, Number(quantities.get(Number(price.id)) || 1));
    if (Number.isInteger(price.currentPriceCents)) {
      matchedCards += quantity;
      marketValueCents += price.currentPriceCents * quantity;
    } else {
      unmatchedCards += quantity;
    }
  }
  return {
    buyer,
    roundId,
    refreshedAt: applied.refreshedAt,
    selectedCards: [...quantities.values()].reduce((total, quantity) => total + quantity, 0),
    uniqueCards: quantities.size,
    matchedCards,
    unmatchedCards,
    marketValueCents,
    source: applied.source
  };
}

async function refreshRiftboundBoardPrices() {
  const { quantities, scope } = riftboundBoardPricingSelection();
  const refreshed = await refreshCatalogCardPrices(database, [...quantities.keys()]);
  return {
    scope,
    refreshedAt: refreshed.refreshedAt,
    displayedCards: quantities.size,
    matchedCards: refreshed.prices.filter(price => Number.isInteger(price.market_price_cents)).length,
    unmatchedCards: refreshed.prices.filter(price => !Number.isInteger(price.market_price_cents)).length,
    source: refreshed.source
  };
}

function prepareRiftboundBoardPriceInput() {
  const { quantities, scope } = riftboundBoardPricingSelection();
  const rows = catalogPriceInputRows(database, [...quantities.keys()]).map(row => ({ ...row, quantity: 1 }));
  return { rows, scope, pricing: getPricingSettings(database) };
}

function applyRiftboundBoardPriceInput(payload = {}) {
  const { quantities, scope } = riftboundBoardPricingSelection();
  const pricing = getPricingSettings(database);
  const requestedSource = normalizePriceSource(payload.source || pricing.selectedSource);
  if (requestedSource !== pricing.selectedSource) throw new Error('The selected price source changed. Reopen Entire Board Pricing and try again.');
  if (![PRICE_SOURCE_IDS.CHATGPT, PRICE_SOURCE_IDS.MANUAL].includes(requestedSource)) {
    throw new Error('This price source refreshes automatically and does not accept pasted prices.');
  }
  const applied = applyCatalogCardPriceInputs(database, [...quantities.keys()], payload.entries, requestedSource);
  return {
    scope,
    refreshedAt: applied.refreshedAt,
    displayedCards: quantities.size,
    matchedCards: applied.prices.filter(price => Number.isInteger(price.currentPriceCents)).length,
    unmatchedCards: applied.prices.filter(price => !Number.isInteger(price.currentPriceCents)).length,
    source: applied.source
  };
}

function libraryListCardIds(values = []) {
  const ids = [...new Set((Array.isArray(values) ? values : [])
    .map(value => Math.floor(Number(value) || 0))
    .filter(value => value > 0))].slice(0, 500);
  if (!ids.length) throw new Error('View at least one card before pricing this list.');
  return ids;
}

async function refreshLibraryListPrices(values = []) {
  const ids = libraryListCardIds(values);
  const refreshed = await refreshCatalogCardPrices(database, ids);
  return {
    scope: 'library-card-list',
    refreshedAt: refreshed.refreshedAt,
    displayedCards: ids.length,
    matchedCards: refreshed.prices.filter(price => Number.isInteger(price.market_price_cents)).length,
    unmatchedCards: refreshed.prices.filter(price => !Number.isInteger(price.market_price_cents)).length,
    marketValueCents: refreshed.prices.reduce((total, price) => total + (Number.isInteger(price.market_price_cents) ? Number(price.market_price_cents) : 0), 0),
    source: refreshed.source
  };
}

function prepareLibraryListPriceInput(values = []) {
  const ids = libraryListCardIds(values);
  const rows = catalogPriceInputRows(database, ids).map(row => ({ ...row, quantity: 1 }));
  return { rows, scope: 'library-card-list', pricing: getPricingSettings(database) };
}

function applyLibraryListPriceInput(payload = {}) {
  const ids = libraryListCardIds(payload.cardIds);
  const pricing = getPricingSettings(database);
  const requestedSource = normalizePriceSource(payload.source || pricing.selectedSource);
  if (requestedSource !== pricing.selectedSource) throw new Error('The selected price source changed. Reopen Price This List and try again.');
  if (![PRICE_SOURCE_IDS.CHATGPT, PRICE_SOURCE_IDS.MANUAL].includes(requestedSource)) {
    throw new Error('This price source refreshes automatically and does not accept pasted prices.');
  }
  const applied = applyCatalogCardPriceInputs(database, ids, payload.entries, requestedSource);
  return {
    scope: 'library-card-list',
    refreshedAt: applied.refreshedAt,
    displayedCards: ids.length,
    matchedCards: applied.prices.filter(price => Number.isInteger(price.currentPriceCents)).length,
    unmatchedCards: applied.prices.filter(price => !Number.isInteger(price.currentPriceCents)).length,
    marketValueCents: applied.prices.reduce((total, price) => total + (Number.isInteger(price.currentPriceCents) ? Number(price.currentPriceCents) : 0), 0),
    source: applied.source
  };
}

function preparePullHistoryPriceInput(batchId) {
  return { ...pullHistoryPriceInputRows(database, batchId), pricing: getPricingSettings(database) };
}

function applyPullHistoryPriceInput(payload = {}) {
  const pricing = getPricingSettings(database);
  const requestedSource = normalizePriceSource(payload.source || pricing.selectedSource);
  if (requestedSource !== pricing.selectedSource) throw new Error('The selected price source changed. Reopen the price editor and try again.');
  return applyPullHistoryPriceInputs(database, payload.batchId, payload.entries, requestedSource);
}

function selectedLiveBuyerBagPricingItems(buyerKey) {
  const direct = database.prepare(`
    SELECT c.*, b.position, b.buyer_name, 1 AS quantity, 'selected' AS source_kind
    FROM active_break_board_cards b
    JOIN cards c ON c.id = b.card_id
    WHERE b.status != 'ready'
      AND LOWER(TRIM(REPLACE(b.buyer_name, '@', ''))) = ?
      AND b.message_marked = 1
    ORDER BY b.position ASC
  `).all(buyerKey);
  const audited = database.prepare(`
    SELECT c.*, a.position, b.buyer_name, a.quantity, 'audit' AS source_kind
    FROM riftbound_champion_pull_audit a
    JOIN active_break_board_cards b ON b.position = a.position
    JOIN cards c ON c.id = a.card_id
    WHERE b.status != 'ready'
      AND LOWER(TRIM(REPLACE(b.buyer_name, '@', ''))) = ?
    ORDER BY a.position ASC, c.card_number ASC, c.name ASC
  `).all(buyerKey);
  return [...direct, ...audited].map(pullHistorySnapshotItem);
}

function selectedPullHistoryItems() {
  const direct = database.prepare(`
    SELECT c.*, b.position, b.buyer_name, 1 AS quantity, 'selected' AS source_kind
    FROM active_break_board_cards b
    JOIN cards c ON c.id = b.card_id
    WHERE b.status = 'called'
      AND TRIM(b.buyer_name) != ''
      AND b.message_marked = 1
    ORDER BY b.position ASC
  `).all();
  const audited = database.prepare(`
    SELECT c.*, a.position, b.buyer_name, a.quantity, 'audit' AS source_kind
    FROM riftbound_champion_pull_audit a
    JOIN active_break_board_cards b ON b.position = a.position
    JOIN cards c ON c.id = a.card_id
    WHERE b.status = 'called'
      AND TRIM(b.buyer_name) != ''
    ORDER BY a.position ASC, c.card_number ASC, c.name ASC
  `).all();
  return [...direct, ...audited].map(pullHistorySnapshotItem);
}

function selectedPullHistorySpots() {
  return database.prepare(`
    SELECT buyer_name AS buyerName, position, sale_amount_cents AS paidCents
    FROM active_break_board_cards
    WHERE status = 'called'
      AND TRIM(buyer_name) != ''
    ORDER BY position ASC
  `).all();
}

function savedPullHistorySnapshotForCurrentLedger() {
  const ledgerSavedAt = String(database.prepare('SELECT MAX(saved_at) AS saved_at FROM active_break_board_cards').get()?.saved_at || '').trim();
  if (!ledgerSavedAt) return { batchId: null, items: [] };
  const batch = database.prepare('SELECT id FROM pull_history_batches WHERE ledger_saved_at = ?').get(ledgerSavedAt);
  if (!batch) return { batchId: null, items: [] };
  const items = database.prepare(`
    SELECT buyer_name AS buyerName, position, card_name AS cardName,
      card_number AS cardNumber, set_code AS setCode, rarity,
      collector_treatment AS collectorTreatment, variant_hint AS variantHint,
      quantity, source_kind AS sourceKind
    FROM pull_history_items
    WHERE batch_id = ?
    ORDER BY position ASC, id ASC
  `).all(batch.id);
  return { batchId: Number(batch.id), items };
}

function gameCodeForPullSet(setCode) {
  const normalized = String(setCode || '').trim().toUpperCase();
  if (/^(?:OGN|OGS|SFD|UNL|VEN)$/.test(normalized)) return RIFTBOUND_GAME_CODE;
  if (normalized) return 'ONEPIECE';
  return '';
}

function saveCurrentPullHistory() {
  if (!isLiveLedgerCurrent()) throw new Error('Save Board ✓ first so Pull History can identify this live board.');
  const ledger = database.prepare('SELECT MAX(saved_at) AS saved_at FROM active_break_board_cards').get();
  const items = selectedPullHistoryItems();
  const spots = selectedPullHistorySpots();
  if (!items.length) throw new Error('Select at least one actual pulled card in Buyer Bags first.');
  const gameCodes = [...new Set(items.map(item => gameCodeForPullSet(item.setCode)).filter(Boolean))];
  const gameCode = gameCodes.length === 1
    ? gameCodes[0]
    : String(database.prepare(`
      SELECT c.game_code
      FROM active_break_board_cards b
      JOIN cards c ON c.id = b.card_id
      ORDER BY b.position ASC
      LIMIT 1
    `).get()?.game_code || '').trim().toUpperCase();
  const setCodes = [...new Set(items.map(item => String(item.setCode || '').trim().toUpperCase()).filter(Boolean))];
  const setName = setCodes.length === 1
    ? String(database.prepare(`
      SELECT set_name FROM catalog_sets
      WHERE UPPER(TRIM(game_code)) = ? AND UPPER(TRIM(set_code)) = ?
      LIMIT 1
    `).get(gameCode, setCodes[0])?.set_name || '')
    : '';
  const result = replacePullHistorySnapshot(database, {
    ledgerSavedAt: ledger?.saved_at,
    gameCode,
    setName,
    recordedAt: new Date().toISOString(),
    items,
    spots
  });
  invalidateOrderHitTracker();
  return result;
}

function pullHistoryPriorityCards() {
  const rows = database.prepare(`
    SELECT i.id, i.batch_id, i.card_name, i.card_number, i.set_code, i.rarity,
      i.collector_treatment, i.quantity, b.game_code, b.recorded_at,
      (SELECT c.id FROM cards c
        WHERE UPPER(TRIM(c.card_number)) = UPPER(TRIM(i.card_number))
          AND UPPER(TRIM(c.set_code)) = UPPER(TRIM(i.set_code))
        ORDER BY CASE WHEN TRIM(COALESCE(c.image_path, '')) != '' THEN 0 ELSE 1 END,
          c.id ASC LIMIT 1) AS library_card_id,
      (SELECT c.image_path FROM cards c
        WHERE UPPER(TRIM(c.card_number)) = UPPER(TRIM(i.card_number))
          AND UPPER(TRIM(c.set_code)) = UPPER(TRIM(i.set_code))
        ORDER BY CASE WHEN TRIM(COALESCE(c.image_path, '')) != '' THEN 0 ELSE 1 END,
          c.id ASC LIMIT 1) AS image_path,
      (SELECT c.image_url FROM cards c
        WHERE UPPER(TRIM(c.card_number)) = UPPER(TRIM(i.card_number))
          AND UPPER(TRIM(c.set_code)) = UPPER(TRIM(i.set_code))
        ORDER BY CASE WHEN TRIM(COALESCE(c.image_path, '')) != '' THEN 0 ELSE 1 END,
          c.id ASC LIMIT 1) AS library_image_url
    FROM pull_history_items i
    JOIN pull_history_batches b ON b.id = i.batch_id
    ORDER BY b.recorded_at DESC, i.id DESC
  `).all();
  const priority = [];
  for (const row of rows) {
    const card = {
      name: row.card_name,
      card_number: row.card_number,
      set_code: row.set_code,
      game_code: row.game_code,
      rarity: row.rarity,
      break_rarity: row.rarity,
      variant: row.collector_treatment,
      collector_treatment: row.collector_treatment
    };
    const classification = classifyMajorHit(card);
    if (!classification || !isVisualTopHitClassification(classification)) continue;
    const libraryCardId = Number(row.library_card_id) || 0;
    const imageUrl = libraryCardId && row.image_path && hasUsableCachedImage(row.image_path)
      ? `${CONNECTOR_ORIGIN}/api/card-image/${libraryCardId}?v=${encodeURIComponent(app.getVersion())}`
      : String(row.library_image_url || '');
    priority.push({
      id: Number(row.id),
      pull_batch_id: Number(row.batch_id),
      game_code: classification.gameCode,
      game_name: classification.gameName,
      set_code: classification.setCode,
      set_name: classification.setName,
      card_name: String(row.card_name || '').trim() || 'Unnamed card',
      card_number: String(row.card_number || '').trim(),
      rarity_label: String(classification.gameCode === 'RIFTBOUND'
        ? (classification.rarityLabel || '')
        : (row.rarity || classification.categoryLabel)).trim(),
      rarity_source: classification.raritySource || (classification.gameCode === 'RIFTBOUND' ? 'Collector number' : 'Pull History'),
      collector_treatment_label: classification.collectorTreatmentLabel || classification.collectorTreatment || '',
      hit_category: classification.categoryKey,
      hit_category_label: classification.categoryLabel,
      quantity: Math.max(1, Number(row.quantity || 1)),
      recorded_at: row.recorded_at,
      image_url: imageUrl
    });
  }
  return priority;
}

function invalidateOrderHitTracker() {
  orderHitTrackerCache = null;
}

function getOrderHitTracker() {
  if (!orderHitTrackerCache) {
    const rows = pullHistoryPriorityCards();
    const grouped = new Map();
    for (const row of rows) {
      const key = hitSetKey(row.game_code, row.set_code);
      if (!grouped.has(key)) grouped.set(key, {
        key,
        gameCode: row.game_code,
        gameName: row.game_name,
        setCode: row.set_code,
        setName: row.set_name,
        totalHits: 0,
        boxIds: new Set(),
        lastRecordedAt: row.recorded_at,
        categoryCounts: new Map()
      });
      const set = grouped.get(key);
      const quantity = Math.max(1, Number(row.quantity || 1));
      set.totalHits += quantity;
      set.boxIds.add(Number(row.pull_batch_id));
      set.categoryCounts.set(row.hit_category, Number(set.categoryCounts.get(row.hit_category) || 0) + quantity);
      if (String(row.recorded_at) > String(set.lastRecordedAt)) set.lastRecordedAt = row.recorded_at;
    }
    const sets = [...grouped.values()].map(set => ({
      key: set.key,
      gameCode: set.gameCode,
      gameName: set.gameName,
      setCode: set.setCode,
      setName: set.setName,
      totalHits: set.totalHits,
      boxCount: set.boxIds.size,
      lastRecordedAt: set.lastRecordedAt,
      categories: hitCategoryDefinitions(set.gameCode).filter(category => isVisualTopHitClassification({
        gameCode: set.gameCode,
        categoryKey: category.key
      })).map(category => ({
        key: category.key,
        label: category.label,
        quantity: Number(set.categoryCounts.get(category.key) || 0)
      }))
    })).sort((left, right) => String(right.lastRecordedAt).localeCompare(String(left.lastRecordedAt)) || left.key.localeCompare(right.key));
    orderHitTrackerCache = { rows, sets };
  }
  const { rows, sets } = orderHitTrackerCache;
  const recentHits = combinedVisualRecentHits(rows, 'RIFTBOUND');
  const categoryCounts = new Map();
  const batchIds = new Set();
  for (const hit of recentHits) {
    const quantity = Math.max(1, Number(hit.quantity || 1));
    categoryCounts.set(hit.hit_category, Number(categoryCounts.get(hit.hit_category) || 0) + quantity);
    batchIds.add(Number(hit.pull_batch_id));
  }
  const selectedSetKey = recentHits.length ? 'RIFTBOUND:RECENT' : '';
  const selectedSet = recentHits.length ? {
    key: selectedSetKey,
    gameCode: 'RIFTBOUND',
    gameName: 'Riftbound',
    setCode: '',
    setName: 'Recent Hits',
    totalHits: recentHits.reduce((total, hit) => total + Math.max(1, Number(hit.quantity || 1)), 0),
    boxCount: batchIds.size,
    lastRecordedAt: recentHits[0]?.recorded_at || '',
    categories: hitCategoryDefinitions('RIFTBOUND').filter(category => isVisualTopHitClassification({
      gameCode: 'RIFTBOUND',
      categoryKey: category.key
    })).map(category => ({
      key: category.key,
      label: category.label,
      quantity: Number(categoryCounts.get(category.key) || 0)
    }))
  } : null;
  return { selectedSetKey, selectedSet, sets, recentHits };
}

function selectOrderHitTrackerSet() {
  // v0.3.207 keeps every Riftbound set in one newest-first slideshow.
  // Keep this IPC entry point for older renderer caches without reintroducing
  // a set filter into the public Recent Hits overlay.
  return getOrderHitTracker();
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
  const disposition = normalizeBreakDisposition(payload.disposition);
  const trackerDestinationMode = normalizeTrackerDestinationMode(payload.trackerDestinationMode);
  const trackerRecordType = trackerDestinationMode === TRACKER_DESTINATION_MODES.OPEN_CASE
    ? 'BOX'
    : requireTrackerRecordType(payload.trackerRecordType);
  const boxCostCents = currencyToCents(payload.boxCost);
  const totals = orderHistoryTotals(assigned);
  const whatnotFees = normalizeWhatnotFees(payload);
  const pullSnapshot = savedPullHistorySnapshotForCurrentLedger();
  const savedPulls = pullSnapshot.items;
  if (pullSnapshot.batchId) {
    const alreadyArchived = database.prepare('SELECT id, break_name FROM break_order_history WHERE pull_history_batch_id = ? LIMIT 1').get(pullSnapshot.batchId);
    if (alreadyArchived) throw new Error(`This saved Pull History snapshot is already archived as “${alreadyArchived.break_name}”. Run Check Pull History if you think the tracked totals are wrong.`);
  }
  if (!savedPulls.length) {
    throw new Error('Save Selected Pulls to Pull History first, then save this box. Orders History only archives the deliberate Pull History snapshot for the current board.');
  }
  const breakName = normalizeHistoryBreakName(payload.breakName, historyDefaultBreakName(assigned));
  const notes = normalizeHistoryNotes(payload.notes);

  database.exec('BEGIN IMMEDIATE');
  try {
    const history = database.prepare(`
      INSERT INTO break_order_history (
        break_name, box_cost_cents, gross_sales_cents, priced_order_count,
        unpriced_order_count, confirmed_order_count,
        whatnot_commission_bps, whatnot_processing_bps,
        whatnot_transaction_fee_cents, whatnot_transaction_count,
        whatnot_fee_tax_bps, whatnot_additional_fee_cents,
        whatnot_actual_fee_cents, notes, disposition, pull_history_batch_id, pull_history_link_verified, recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      breakName,
      boxCostCents,
      totals.grossSalesCents,
      totals.pricedOrderCount,
      totals.unpricedOrderCount,
      totals.confirmedOrderCount,
      whatnotFees.commissionBasisPoints,
      whatnotFees.processingBasisPoints,
      whatnotFees.transactionFeeCents,
      whatnotFees.transactionCount,
      whatnotFees.feeTaxBasisPoints,
      whatnotFees.additionalFeeCents,
      whatnotFees.actualFeeCents,
      notes,
      disposition,
      pullSnapshot.batchId || null,
      1,
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
    const insertPull = database.prepare(`
      INSERT INTO break_order_history_pulls (
        history_id, buyer_name, position, card_name, card_number, set_code,
        rarity, collector_treatment, variant_hint, quantity, source_kind
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    savedPulls.forEach(item => insertPull.run(
      historyId,
      String(item.buyerName || '').trim(),
      Number(item.position),
      String(item.cardName || '').trim(),
      String(item.cardNumber || '').trim(),
      String(item.setCode || '').trim(),
      String(item.rarity || '').trim(),
      String(item.collectorTreatment || '').trim(),
      String(item.variantHint || '').trim(),
      Math.max(1, Math.min(99, Number(item.quantity || 1))),
      String(item.sourceKind || 'selected').trim()
    ));
    const trackerPayload = {
      historyId,
      pullHistoryBatchId: pullSnapshot.batchId,
      recordType: trackerRecordType,
      breakName,
      recordedAt,
      pulls: savedPulls,
      assigned
    };
    const trackerOptions = {
      setActiveTracker: trackerId => setMetadata(ACTIVE_TRACKER_KEY, String(trackerId))
    };
    const tracker = trackerDestinationMode === TRACKER_DESTINATION_MODES.OPEN_CASE
      ? syncOpenCaseBoxFromHistory(database, {
        ...trackerPayload,
        openCaseId: payload.openCaseId
      }, {
        ...trackerOptions,
        setActiveOpenCase: trackerId => setMetadata(ACTIVE_OPEN_CASE_KEY, String(trackerId))
      })
      : syncAutomaticBoxTrackerFromHistory(database, trackerPayload, trackerOptions);
    database.exec('COMMIT');
    invalidateOrderHitTracker();
    return {
      id: historyId,
      breakName,
      boxCostCents,
      ...totals,
      selectedPullCount: savedPulls.reduce((total, item) => total + Math.max(1, Number(item.quantity || 1)), 0),
      pullHistoryBatchId: pullSnapshot.batchId,
      tracker,
      whatnotFees: whatnotFeeBreakdown({
        grossSalesCents: totals.grossSalesCents,
        boxCostCents,
        pricedOrderCount: totals.pricedOrderCount,
        ...whatnotFees
      }),
      recordedAt
    };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function requiredHistoryId(value) {
  const id = Number(value?.id ?? value);
  if (!Number.isInteger(id) || id < 1) throw new Error('Choose a valid saved box record first.');
  return id;
}

function updateBreakOrderHistory(payload = {}) {
  const id = requiredHistoryId(payload);
  const existing = database.prepare(`
    SELECT id, break_name, box_cost_cents, gross_sales_cents, priced_order_count,
      whatnot_commission_bps, whatnot_processing_bps,
      whatnot_transaction_fee_cents, whatnot_transaction_count,
      whatnot_fee_tax_bps, whatnot_additional_fee_cents,
      whatnot_actual_fee_cents, notes
    FROM break_order_history
    WHERE id = ?
  `).get(id);
  if (!existing) throw new Error('That saved box record no longer exists.');

  const hasValue = key => Object.prototype.hasOwnProperty.call(payload, key);
  const breakName = normalizeHistoryBreakName(
    hasValue('breakName') ? payload.breakName : existing.break_name,
    existing.break_name || 'Saved character break'
  );
  const boxCostCents = hasValue('boxCost') ? currencyToCents(payload.boxCost) : Number(existing.box_cost_cents || 0);
  const grossSalesCents = hasValue('finalSales') ? currencyToCents(payload.finalSales) : Number(existing.gross_sales_cents || 0);
  const whatnotFees = normalizeWhatnotFees(payload, {
    commissionBasisPoints: existing.whatnot_commission_bps,
    processingBasisPoints: existing.whatnot_processing_bps,
    transactionFeeCents: existing.whatnot_transaction_fee_cents,
    transactionCount: existing.whatnot_transaction_count,
    feeTaxBasisPoints: existing.whatnot_fee_tax_bps,
    additionalFeeCents: existing.whatnot_additional_fee_cents,
    actualFeeCents: existing.whatnot_actual_fee_cents
  });
  const notes = normalizeHistoryNotes(hasValue('notes') ? payload.notes : existing.notes);
  database.prepare(`
    UPDATE break_order_history
    SET break_name = ?, box_cost_cents = ?, gross_sales_cents = ?,
      whatnot_commission_bps = ?, whatnot_processing_bps = ?,
      whatnot_transaction_fee_cents = ?, whatnot_transaction_count = ?,
      whatnot_fee_tax_bps = ?, whatnot_additional_fee_cents = ?,
      whatnot_actual_fee_cents = ?, notes = ?
    WHERE id = ?
  `).run(
    breakName,
    boxCostCents,
    grossSalesCents,
    whatnotFees.commissionBasisPoints,
    whatnotFees.processingBasisPoints,
    whatnotFees.transactionFeeCents,
    whatnotFees.transactionCount,
    whatnotFees.feeTaxBasisPoints,
    whatnotFees.additionalFeeCents,
    whatnotFees.actualFeeCents,
    notes,
    id
  );
  const linkedTracker = database.prepare('SELECT id, record_type, set_code, set_name FROM box_trackers WHERE order_history_id = ?').get(id);
  if (linkedTracker) {
    const typeLabel = TRACKER_RECORD_TYPES[String(linkedTracker.record_type || '').toUpperCase()] || 'Box';
    const normalizedBreakName = breakName.toUpperCase();
    const includesSet = [linkedTracker.set_name, linkedTracker.set_code]
      .map(value => String(value || '').trim().toUpperCase())
      .filter(Boolean)
      .some(value => normalizedBreakName.includes(value));
    const includesType = /\b(?:BOX|CASE)\b/.test(normalizedBreakName);
    const automaticName = `${linkedTracker.set_name || linkedTracker.set_code || ''} ${typeLabel}`.trim();
    const trackerName = normalizeTrackerName(includesSet && includesType ? breakName : [automaticName, breakName].filter(Boolean).join(' · '));
    database.prepare('UPDATE box_trackers SET tracker_name = ?, overlay_title = ?, updated_at = ? WHERE id = ?')
      .run(trackerName, trackerName, new Date().toISOString(), linkedTracker.id);
  }
  invalidateOrderHitTracker();
  return {
    id,
    breakName,
    boxCostCents,
    grossSalesCents,
    notes,
    whatnotFees: whatnotFeeBreakdown({
      grossSalesCents,
      boxCostCents,
      pricedOrderCount: existing.priced_order_count,
      ...whatnotFees
    })
  };
}

function updateOrderTrackerDestination(payload = {}) {
  database.exec('BEGIN IMMEDIATE');
  try {
    const changed = changeOrderTrackerDestination(database, payload, {
      setActiveTracker: trackerId => setMetadata(ACTIVE_TRACKER_KEY, String(trackerId)),
      setActiveOpenCase: trackerId => setMetadata(ACTIVE_OPEN_CASE_KEY, String(trackerId))
    });
    database.exec('COMMIT');
    return changed;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function deleteBreakOrderHistory(value) {
  const id = requiredHistoryId(value);
  const existing = database.prepare('SELECT break_name FROM break_order_history WHERE id = ?').get(id);
  if (!existing) throw new Error('That saved box record no longer exists.');
  const linkedTracker = database.prepare('SELECT id FROM box_trackers WHERE order_history_id = ?').get(id);
  database.exec('BEGIN IMMEDIATE');
  try {
    // A history inside a live/finalized multi-box case owns only one case
    // position. Remove that position without ever deleting the whole case.
    detachHistoryFromCaseTracker(database, id);
    database.prepare('DELETE FROM break_order_history WHERE id = ?').run(id);
    if (linkedTracker) database.prepare('DELETE FROM box_trackers WHERE id = ?').run(linkedTracker.id);
    const activeId = Number(getMetadata(ACTIVE_TRACKER_KEY) || 0);
    if (linkedTracker && activeId === Number(linkedTracker.id)) {
      const nextTracker = database.prepare('SELECT id FROM box_trackers ORDER BY updated_at DESC, id DESC LIMIT 1').get();
      setMetadata(ACTIVE_TRACKER_KEY, nextTracker ? String(nextTracker.id) : '');
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  invalidateOrderHitTracker();
  return { id, breakName: existing.break_name, deleted: true };
}

function listBusinessExpenses(options = {}) {
  const expenses = database.prepare(`SELECT id, expense_name, category, vendor, amount_cents, purchased_on, notes, created_at FROM business_expenses ORDER BY purchased_on DESC, id DESC`).all();
  const totalExpenseCents = expenses.reduce((total, expense) => total + Math.max(0, Number(expense.amount_cents || 0)), 0);
  const manualWhatnotFeeExpenseCents = expenses
    .filter(expense => expense.category === 'Whatnot fees')
    .reduce((total, expense) => total + Math.max(0, Number(expense.amount_cents || 0)), 0);
  const manualInventoryPurchaseCents = expenses
    .filter(expense => expense.category === 'Inventory / sealed product')
    .reduce((total, expense) => total + Math.max(0, Number(expense.amount_cents || 0)), 0);
  const nonDeductibleManualCents = expenses
    .filter(expense => expense.category === 'Owner / Personal Use')
    .reduce((total, expense) => total + Math.max(0, Number(expense.amount_cents || 0)), 0);
  // Manual inventory purchases are tracked as cash invested, but they are not
  // deducted again here because completed sale boxes already carry their own
  // box cost. This avoids silently counting the same sealed product twice.
  const otherExpenseCents = totalExpenseCents - manualWhatnotFeeExpenseCents - manualInventoryPurchaseCents - nonDeductibleManualCents;
  const savedBoxes = database.prepare(`
    SELECT id, break_name, box_cost_cents, gross_sales_cents, priced_order_count, unpriced_order_count,
      whatnot_commission_bps, whatnot_processing_bps,
      whatnot_transaction_fee_cents, whatnot_transaction_count,
      whatnot_fee_tax_bps, whatnot_additional_fee_cents,
      whatnot_actual_fee_cents, notes, recorded_at, disposition
    FROM break_order_history
    ORDER BY recorded_at DESC, id DESC
  `).all();
  const deductibleBoxes = savedBoxes.filter(box => isDeductibleBreakDisposition(box.disposition));
  const normalBoxes = deductibleBoxes.filter(box => normalizeBreakDisposition(box.disposition) === 'NORMAL_BREAK');
  const adjustmentBoxes = deductibleBoxes.filter(box => normalizeBreakDisposition(box.disposition) !== 'NORMAL_BREAK');
  const personalBoxes = savedBoxes.filter(box => normalizeBreakDisposition(box.disposition) === 'OWNER_PERSONAL_USE');
  const savedBoxSalesCents = savedBoxes.reduce((total, box) => total + Math.max(0, Number(box.gross_sales_cents || 0)), 0);
  const savedBoxCostCents = deductibleBoxes.reduce((total, box) => total + Math.max(0, Number(box.box_cost_cents || 0)), 0);
  const normalBreakBoxCostCents = normalBoxes.reduce((total, box) => total + Math.max(0, Number(box.box_cost_cents || 0)), 0);
  const inventoryAdjustmentCents = adjustmentBoxes.reduce((total, box) => total + Math.max(0, Number(box.box_cost_cents || 0)), 0);
  const nonDeductibleHistoryCents = personalBoxes.reduce((total, box) => total + Math.max(0, Number(box.box_cost_cents || 0)), 0);
  const savedBoxWhatnotFeeCents = savedBoxes.reduce((total, box) => total + whatnotFeeBreakdown(box).totalWhatnotFeeCents, 0);
  const adjustmentTotals = {};
  adjustmentBoxes.forEach(box => {
    const key = normalizeBreakDisposition(box.disposition);
    adjustmentTotals[key] = Number(adjustmentTotals[key] || 0) + Math.max(0, Number(box.box_cost_cents || 0));
  });
  const adjustments = adjustmentBoxes.map(box => ({
    id: Number(box.id),
    breakName: box.break_name,
    disposition: normalizeBreakDisposition(box.disposition),
    dispositionLabel: dispositionLabel(box.disposition),
    amountCents: Math.max(0, Number(box.box_cost_cents || 0)),
    recordedAt: box.recorded_at,
    notes: box.notes || ''
  }));
  const years = availableBusinessYears(savedBoxes, expenses);
  const requestedYear = normalizeTaxYear(options?.year, years[0] || new Date().getFullYear());
  const taxYear = years.includes(requestedYear) ? requestedYear : (years[0] || requestedYear);
  const snapshot = buildBusinessSnapshot(savedBoxes, expenses, { year: taxYear });
  const report = buildBusinessExpenseReport(savedBoxes, expenses, { year: taxYear });
  return {
    expenses,
    adjustments,
    availableYears: years,
    snapshot,
    report,
    totals: {
      totalExpenseCents,
      otherExpenseCents,
      manualInventoryPurchaseCents,
      manualWhatnotFeeExpenseCents,
      nonDeductibleManualCents,
      savedBoxSalesCents,
      savedBoxCostCents,
      normalBreakBoxCostCents,
      inventoryAdjustmentCents,
      nonDeductibleHistoryCents,
      savedBoxWhatnotFeeCents,
      adjustmentTotals,
      recordedProfitCents: savedBoxSalesCents - savedBoxCostCents - savedBoxWhatnotFeeCents - otherExpenseCents
    }
  };
}

function saveBusinessExpense(payload = {}) {
  const expenseName = trimExpenseText(payload.expenseName, MAX_EXPENSE_TEXT);
  if (!expenseName) throw new Error('Enter what you purchased, such as bubble mailers or an OP-16 box.');
  const amountCents = currencyToCents(payload.amount);
  if (!amountCents) throw new Error('Enter the amount you paid.');
  const category = normalizeExpenseCategory(payload.category);
  const vendor = trimExpenseText(payload.vendor, MAX_EXPENSE_TEXT);
  const notes = trimExpenseText(payload.notes, MAX_EXPENSE_NOTES);
  const purchasedOn = normalizeExpenseDate(payload.purchasedOn);
  const result = database.prepare(`INSERT INTO business_expenses (expense_name, category, vendor, amount_cents, purchased_on, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(expenseName, category, vendor, amountCents, purchasedOn, notes, new Date().toISOString());
  return { id: Number(result.lastInsertRowid), expenseName, amountCents };
}

function deleteBusinessExpense(value) {
  const id = Number(value?.id ?? value);
  if (!Number.isInteger(id) || id < 1) throw new Error('Choose a valid expense first.');
  const existing = database.prepare('SELECT expense_name FROM business_expenses WHERE id = ?').get(id);
  if (!existing) throw new Error('That expense no longer exists.');
  database.prepare('DELETE FROM business_expenses WHERE id = ?').run(id);
  return { id, expenseName: existing.expense_name, deleted: true };
}

function activeBoxTrackerId() {
  const value = Number(getMetadata(ACTIVE_TRACKER_KEY));
  if (!Number.isInteger(value) || value < 1) return null;
  return database.prepare('SELECT id FROM box_trackers WHERE id = ?').get(value)?.id || null;
}

function activeOpenCaseId() {
  const stored = Number(getMetadata(ACTIVE_OPEN_CASE_KEY));
  if (Number.isInteger(stored) && stored > 0) {
    const active = database.prepare(`
      SELECT id FROM box_trackers
      WHERE id = ? AND lifecycle_status = 'OPEN' AND source_mode = 'OPEN_CASE'
    `).get(stored);
    if (active) return Number(active.id);
  }
  const newest = database.prepare(`
    SELECT id FROM box_trackers
    WHERE lifecycle_status = 'OPEN' AND source_mode = 'OPEN_CASE'
    ORDER BY updated_at DESC, id DESC
    LIMIT 1
  `).get();
  setMetadata(ACTIVE_OPEN_CASE_KEY, newest ? String(newest.id) : '');
  return newest ? Number(newest.id) : null;
}

function boxTrackerBaseRows(where = '', ...args) {
  return database.prepare(`
    SELECT id, tracker_name, overlay_title, product_name, game_code, set_code,
      set_name, record_type, order_history_id, pull_history_batch_id, source_mode,
      lifecycle_status, completed_at, total_boxes, created_at, updated_at
    FROM box_trackers ${where}
  `).all(...args);
}

function boxTrackerForId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) return null;
  return hydrateBoxTrackerRows(database, boxTrackerBaseRows('WHERE id = ?', id))[0] || null;
}

function listBoxTrackers() {
  const trackers = hydrateBoxTrackerRows(database, boxTrackerBaseRows('ORDER BY updated_at DESC, id DESC'));
  const storedActive = activeBoxTrackerId();
  const activeTrackerId = storedActive || trackers[0]?.id || null;
  if (!storedActive && activeTrackerId) setMetadata(ACTIVE_TRACKER_KEY, String(activeTrackerId));
  return { activeTrackerId, activeOpenCaseId: activeOpenCaseId(), trackers };
}

function listOpenBoxCases() {
  const activeOpenCaseIdValue = activeOpenCaseId();
  const cases = hydrateBoxTrackerRows(database, boxTrackerBaseRows(
    "WHERE lifecycle_status = 'OPEN' AND source_mode = 'OPEN_CASE' ORDER BY updated_at DESC, id DESC"
  ));
  return { activeOpenCaseId: activeOpenCaseIdValue, cases };
}

function createOpenBoxCase(payload = {}) {
  database.exec('BEGIN IMMEDIATE');
  try {
    const created = createOpenCaseTracker(database, payload, {
      setActiveTracker: trackerId => setMetadata(ACTIVE_TRACKER_KEY, String(trackerId)),
      setActiveOpenCase: trackerId => setMetadata(ACTIVE_OPEN_CASE_KEY, String(trackerId))
    });
    database.exec('COMMIT');
    return boxTrackerForId(created.trackerId);
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function finalizeOpenBoxCase(payload = {}) {
  database.exec('BEGIN IMMEDIATE');
  try {
    const finalized = finalizeOpenCaseTracker(database, payload, payload);
    const nextOpen = database.prepare(`
      SELECT id FROM box_trackers
      WHERE lifecycle_status = 'OPEN' AND source_mode = 'OPEN_CASE' AND id != ?
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `).get(finalized.trackerId);
    setMetadata(ACTIVE_TRACKER_KEY, String(finalized.trackerId));
    setMetadata(ACTIVE_OPEN_CASE_KEY, nextOpen ? String(nextOpen.id) : '');
    database.exec('COMMIT');
    return { ...finalized, activeOpenCaseId: nextOpen ? Number(nextOpen.id) : null };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function updateOpenBoxCase(payload = {}) {
  database.exec('BEGIN IMMEDIATE');
  try {
    const updated = updateOpenCaseTracker(database, payload);
    database.exec('COMMIT');
    return boxTrackerForId(updated.trackerId);
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function removeOpenBoxCaseBox(payload = {}) {
  database.exec('BEGIN IMMEDIATE');
  try {
    const removed = removeOpenCaseBox(database, payload);
    database.exec('COMMIT');
    return removed;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function deleteOpenBoxCase(payload = {}) {
  database.exec('BEGIN IMMEDIATE');
  try {
    const deleted = deleteOpenCaseTracker(database, payload);
    const nextOpen = database.prepare(`
      SELECT id FROM box_trackers
      WHERE lifecycle_status = 'OPEN' AND source_mode = 'OPEN_CASE'
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `).get();
    const nextTracker = nextOpen || database.prepare(`
      SELECT id FROM box_trackers
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `).get();
    if (Number(getMetadata(ACTIVE_OPEN_CASE_KEY) || 0) === Number(deleted.trackerId)) {
      setMetadata(ACTIVE_OPEN_CASE_KEY, nextOpen ? String(nextOpen.id) : '');
    }
    if (Number(getMetadata(ACTIVE_TRACKER_KEY) || 0) === Number(deleted.trackerId)) {
      setMetadata(ACTIVE_TRACKER_KEY, nextTracker ? String(nextTracker.id) : '');
    }
    database.exec('COMMIT');
    return {
      ...deleted,
      activeOpenCaseId: nextOpen ? Number(nextOpen.id) : null,
      activeTrackerId: nextTracker ? Number(nextTracker.id) : null
    };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function createBoxTracker(payload = {}) {
  const trackerName = normalizeTrackerName(payload.trackerName);
  const overlayTitle = normalizeTrackerName(payload.overlayTitle || trackerName);
  const productName = normalizeProductName(payload.productName);
  const totalBoxes = normalizeBoxCount(payload.totalBoxes, 12);
  const now = new Date().toISOString();
  database.exec('BEGIN IMMEDIATE');
  try {
    const inserted = database.prepare(`
      INSERT INTO box_trackers (tracker_name, overlay_title, product_name, total_boxes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(trackerName, overlayTitle, productName, totalBoxes, now, now);
    const trackerId = Number(inserted.lastInsertRowid);
    const addBox = database.prepare(`
      INSERT INTO box_tracker_boxes (tracker_id, box_number, status, notes, updated_at)
      VALUES (?, ?, 'sealed', '', ?)
    `);
    for (let boxNumber = 1; boxNumber <= totalBoxes; boxNumber += 1) addBox.run(trackerId, boxNumber, now);
    setMetadata(ACTIVE_TRACKER_KEY, String(trackerId));
    database.exec('COMMIT');
    return boxTrackerForId(trackerId);
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function requiredBoxTrackerId(value) {
  const id = Number(value?.trackerId ?? value?.id ?? value);
  if (!Number.isInteger(id) || id < 1) throw new Error('Choose a saved case tracker first.');
  if (!boxTrackerForId(id)) throw new Error('That case tracker no longer exists.');
  return id;
}

function updateBoxTracker(payload = {}) {
  const trackerId = requiredBoxTrackerId(payload);
  const existing = boxTrackerForId(trackerId);
  const hasValue = key => Object.prototype.hasOwnProperty.call(payload, key);
  const trackerName = normalizeTrackerName(hasValue('trackerName') ? payload.trackerName : existing.tracker_name);
  const overlayTitle = normalizeTrackerName(hasValue('overlayTitle') ? payload.overlayTitle : (existing.overlay_title || existing.tracker_name));
  const productName = normalizeProductName(hasValue('productName') ? payload.productName : existing.product_name);
  const totalBoxes = hasValue('totalBoxes') ? normalizeBoxCount(payload.totalBoxes, existing.total_boxes) : Number(existing.total_boxes);
  const now = new Date().toISOString();
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare(`
      UPDATE box_trackers
      SET tracker_name = ?, overlay_title = ?, product_name = ?, total_boxes = ?, updated_at = ?
      WHERE id = ?
    `).run(trackerName, overlayTitle, productName, totalBoxes, now, trackerId);
    if (totalBoxes < Number(existing.total_boxes)) {
      database.prepare('DELETE FROM box_tracker_boxes WHERE tracker_id = ? AND box_number > ?').run(trackerId, totalBoxes);
    } else if (totalBoxes > Number(existing.total_boxes)) {
      const addBox = database.prepare(`
        INSERT OR IGNORE INTO box_tracker_boxes (tracker_id, box_number, status, notes, updated_at)
        VALUES (?, ?, 'sealed', '', ?)
      `);
      for (let boxNumber = Number(existing.total_boxes) + 1; boxNumber <= totalBoxes; boxNumber += 1) addBox.run(trackerId, boxNumber, now);
    }
    database.exec('COMMIT');
    return boxTrackerForId(trackerId);
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function setActiveBoxTracker(value) {
  const trackerId = requiredBoxTrackerId(value);
  setMetadata(ACTIVE_TRACKER_KEY, String(trackerId));
  const tracker = boxTrackerForId(trackerId);
  if (String(tracker?.lifecycle_status || '').toUpperCase() === 'OPEN'
    && String(tracker?.source_mode || '').toUpperCase() === 'OPEN_CASE') {
    setMetadata(ACTIVE_OPEN_CASE_KEY, String(trackerId));
  }
  return tracker;
}

function updateBoxTrackerBox(payload = {}) {
  const trackerId = requiredBoxTrackerId(payload);
  const tracker = boxTrackerForId(trackerId);
  const boxNumber = Number(payload.boxNumber);
  if (!Number.isInteger(boxNumber) || boxNumber < 1 || boxNumber > Number(tracker.total_boxes)) {
    throw new Error('Choose a valid box number from this case tracker.');
  }
  const existingBox = tracker.boxes.find(box => Number(box.box_number) === boxNumber);
  if (!existingBox) throw new Error('That box is no longer part of this case tracker.');
  const hasValue = key => Object.prototype.hasOwnProperty.call(payload, key);
  const status = hasValue('status') ? normalizeBoxStatus(payload.status) : normalizeBoxStatus(existingBox.status);
  const notes = hasValue('notes') ? normalizeBoxNote(payload.notes) : normalizeBoxNote(existingBox.notes);
  const hitCounts = normalizeBoxHitCounts(payload, existingBox);
  const now = new Date().toISOString();
  database.prepare(`
    UPDATE box_tracker_boxes
    SET status = ?, notes = ?, ${BOX_HIT_FIELDS.map(field => `${field.key} = ?`).join(', ')}, updated_at = ?
    WHERE tracker_id = ? AND box_number = ?
  `).run(status, notes, ...BOX_HIT_FIELDS.map(field => hitCounts[field.key]), now, trackerId, boxNumber);
  database.prepare('UPDATE box_trackers SET updated_at = ? WHERE id = ?').run(now, trackerId);
  return boxTrackerForId(trackerId);
}

function requiredTrackerBox(payload = {}) {
  const trackerId = requiredBoxTrackerId(payload);
  const tracker = boxTrackerForId(trackerId);
  const boxNumber = Number(payload.boxNumber);
  if (!Number.isInteger(boxNumber) || boxNumber < 1 || boxNumber > Number(tracker.total_boxes)) throw new Error('Choose a valid box first.');
  return { trackerId, boxNumber };
}

function trackerWinnerText(value, maximum) {
  return String(value || '').trim().slice(0, maximum);
}

function addBoxTrackerHitWinner(payload = {}) {
  const { trackerId, boxNumber } = requiredTrackerBox(payload);
  const cardName = trackerWinnerText(payload.cardName, 180);
  const buyerName = trackerWinnerText(payload.buyerName, 180).replace(/^@+/, '');
  if (!cardName) throw new Error('Enter the pulled card name.');
  if (!buyerName) throw new Error('Enter the buyer who received that card.');
  const rarity = trackerWinnerText(payload.rarity, 60);
  const note = trackerWinnerText(payload.note, 500);
  const spotNumber = Math.max(0, Number.parseInt(String(payload.spotNumber || ''), 10) || 0);
  const saleAmountCents = Math.max(0, Number.parseInt(String(payload.saleAmountCents || ''), 10) || 0);
  const now = new Date().toISOString();
  const result = database.prepare(`
    INSERT INTO box_tracker_hit_winners (tracker_id, box_number, card_name, rarity, buyer_name, spot_number, sale_amount_cents, note, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(trackerId, boxNumber, cardName, rarity, buyerName, spotNumber, saleAmountCents, note, now);
  database.prepare('UPDATE box_trackers SET updated_at = ? WHERE id = ?').run(now, trackerId);
  return { id: Number(result.lastInsertRowid), trackerId, boxNumber, cardName, buyerName, rarity, spotNumber, saleAmountCents, note, recordedAt: now };
}

function deleteBoxTrackerHitWinner(payload = {}) {
  const { trackerId, boxNumber } = requiredTrackerBox(payload);
  const id = Number(payload.id);
  if (!Number.isInteger(id) || id < 1) throw new Error('Choose a valid saved hit record.');
  const existing = database.prepare('SELECT card_name FROM box_tracker_hit_winners WHERE id = ? AND tracker_id = ? AND box_number = ?').get(id, trackerId, boxNumber);
  if (!existing) throw new Error('That saved hit record no longer exists.');
  database.prepare('DELETE FROM box_tracker_hit_winners WHERE id = ?').run(id);
  database.prepare('UPDATE box_trackers SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), trackerId);
  return { id, deleted: true, cardName: existing.card_name };
}

function deleteBoxTracker(value) {
  const trackerId = requiredBoxTrackerId(value);
  const existing = boxTrackerForId(trackerId);
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare('DELETE FROM box_trackers WHERE id = ?').run(trackerId);
    const nextTracker = database.prepare('SELECT id FROM box_trackers ORDER BY updated_at DESC, id DESC LIMIT 1').get();
    setMetadata(ACTIVE_TRACKER_KEY, nextTracker ? String(nextTracker.id) : '');
    if (Number(getMetadata(ACTIVE_OPEN_CASE_KEY) || 0) === trackerId) {
      const nextOpen = database.prepare(`
        SELECT id FROM box_trackers
        WHERE lifecycle_status = 'OPEN' AND source_mode = 'OPEN_CASE'
        ORDER BY updated_at DESC, id DESC LIMIT 1
      `).get();
      setMetadata(ACTIVE_OPEN_CASE_KEY, nextOpen ? String(nextOpen.id) : '');
    }
    database.exec('COMMIT');
    return { id: trackerId, trackerName: existing.tracker_name, deleted: true, activeTrackerId: nextTracker?.id || null };
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function listBoxTrackerCaseRecords() {
  return database.prepare(`
    SELECT id, tracker_id, case_title, overlay_title, product_name, recorded_at,
      ${BOX_HIT_FIELDS.map(field => field.key).join(', ')}
    FROM box_tracker_case_records
    ORDER BY recorded_at DESC, id DESC
  `).all();
}

function saveBoxTrackerCaseRecord(payload = {}) {
  const trackerId = requiredBoxTrackerId(payload);
  const tracker = boxTrackerForId(trackerId);
  const now = new Date().toISOString();
  const hitCounts = tracker.hit_counts || {};
  const result = database.prepare(`
    INSERT INTO box_tracker_case_records (
      tracker_id, case_title, overlay_title, product_name, recorded_at,
      ${BOX_HIT_FIELDS.map(field => field.key).join(', ')}
    ) VALUES (?, ?, ?, ?, ?, ${BOX_HIT_FIELDS.map(() => '?').join(', ')})
  `).run(
    trackerId,
    tracker.tracker_name,
    tracker.overlay_title || tracker.tracker_name,
    tracker.product_name || '',
    now,
    ...BOX_HIT_FIELDS.map(field => Math.max(0, Number(hitCounts[field.key] || 0)))
  );
  return { id: Number(result.lastInsertRowid), caseTitle: tracker.tracker_name, recordedAt: now };
}

function requiredBoxTrackerCaseRecordId(value) {
  const id = Number(value?.id ?? value);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Choose a saved case record.');
  const record = database.prepare('SELECT id FROM box_tracker_case_records WHERE id=?').get(id);
  if (!record) throw new Error('That saved case record no longer exists.');
  return id;
}

function updateBoxTrackerCaseRecord(payload = {}) {
  const id = requiredBoxTrackerCaseRecordId(payload);
  const current = database.prepare('SELECT * FROM box_tracker_case_records WHERE id=?').get(id);
  const caseTitle = String(payload.caseTitle ?? current.case_title ?? '').trim() || current.case_title;
  const overlayTitle = String(payload.overlayTitle ?? current.overlay_title ?? '').trim();
  const productName = String(payload.productName ?? current.product_name ?? '').trim();
  const values = BOX_HIT_FIELDS.map(field => Math.max(0, Math.floor(Number(payload[field.key] ?? current[field.key] ?? 0) || 0)));
  database.prepare(`UPDATE box_tracker_case_records SET case_title=?, overlay_title=?, product_name=?, ${BOX_HIT_FIELDS.map(field => `${field.key}=?`).join(', ')} WHERE id=?`).run(caseTitle, overlayTitle, productName, ...values, id);
  return { id, caseTitle, updated: true };
}

function deleteBoxTrackerCaseRecord(value) {
  const id = requiredBoxTrackerCaseRecordId(value);
  const current = database.prepare('SELECT case_title FROM box_tracker_case_records WHERE id=?').get(id);
  database.prepare('DELETE FROM box_tracker_case_records WHERE id=?').run(id);
  return { id, caseTitle: current.case_title, deleted: true };
}

function publicBoxTrackerSnapshot() {
  const trackerId = activeBoxTrackerId();
  return { active: trackerId ? boxTrackerForId(trackerId) : null };
}

function publicActiveCaseSnapshot() {
  const trackerId = activeOpenCaseId();
  const activeCase = trackerId ? boxTrackerForId(trackerId) : null;
  if (!activeCase) return { activeCase: null };
  const nextBox = (activeCase.boxes || []).find(box => !box.history_link) || null;
  return {
    activeCase: {
      id: Number(activeCase.id),
      tracker_name: activeCase.tracker_name,
      game_code: activeCase.game_code,
      game_name: activeCase.game_name,
      set_code: activeCase.set_code,
      set_name: activeCase.set_name,
      total_boxes: Number(activeCase.total_boxes || 0),
      opened_count: Number(activeCase.opened_count || 0),
      hit_counts: activeCase.hit_counts,
      next_box_number: nextBox ? Number(nextBox.box_number) : null,
      remaining_count: Math.max(0, Number(activeCase.total_boxes || 0) - Number(activeCase.opened_count || 0)),
      progress_percent: Number(activeCase.total_boxes || 0)
        ? Math.round((Number(activeCase.opened_count || 0) / Number(activeCase.total_boxes)) * 100)
        : 0
    }
  };
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

function consolidateUnleashedPoroRuneSpots(requestedMappingMode) {
  if (workingBreakBoardMappingMode(requestedMappingMode) === BREAK_BOARD_MAPPING_MODES.SINGLES) {
    return { removedRunes: 0, renumbered: false };
  }
  const rows = database.prepare(`
    SELECT b.card_id, b.position, c.name, c.card_number, c.set_code,
      UPPER(TRIM(COALESCE(c.game_code, 'ONEPIECE'))) AS game_code
    FROM break_board_cards b JOIN cards c ON c.id = b.card_id
    ORDER BY b.position ASC
  `).all();
  // Boards 5 and 7 intentionally own all six booster AA Runes in one
  // standalone position. The legacy cleanup is only for older layouts where
  // each Rune was folded into its matching Poro lane.
  if (isUnleashedExpandedBreakBoard(rows) || isUnleashedFullCaseBreakBoard(rows)) {
    return { removedRunes: 0, renumbered: false };
  }
  const poros = new Set(rows
    .filter(row => row.game_code === RIFTBOUND_GAME_CODE)
    .map(row => poroFromSpot(row))
    .filter(Boolean));
  if (!poros.size) return { removedRunes: 0, renumbered: false };
  const runeRows = rows.filter(row => {
    if (row.game_code !== RIFTBOUND_GAME_CODE) return false;
    const rune = runeFromSpot(row);
    if (!rune) return false;
    const mapping = runeMapping(rune, row.set_code);
    return Boolean(mapping && poros.has(mapping.poro));
  });
  const remove = database.prepare('DELETE FROM break_board_cards WHERE card_id = ?');
  runeRows.forEach(row => remove.run(row.card_id));
  const compacted = compactBreakBoardPositions();
  return { removedRunes: runeRows.length, renumbered: compacted.renumbered };
}

function breakBoardOverview() {
  const count = database.prepare('SELECT COUNT(*) AS count FROM break_board_cards').get().count;
  const activeCount = database.prepare('SELECT COUNT(*) AS count FROM active_break_board_cards').get().count;
  const working = database.prepare('SELECT card_id, position FROM break_board_cards ORDER BY position ASC').all();
  const active = database.prepare('SELECT card_id, position FROM active_break_board_cards ORDER BY position ASC').all();
  const mappingMode = workingBreakBoardMappingMode();
  const activeMappingMode = activeBreakBoardMappingMode(active);
  const workingMappingSignature = customMappingSignature(workingCustomMappingForRows(working));
  const round = activeBreakRound();
  const activeMappingSignature = customMappingSignature(round ? loadRoundCustomMapping(database, round.id) : null);
  const ready = count > 0
    && count === activeCount
    && working.every((row, index) => row.card_id === active[index]?.card_id && row.position === active[index]?.position)
    && mappingMode === activeMappingMode
    && workingMappingSignature === activeMappingSignature;
  return { count, activeCount, ready, gameCode: breakBoardGameCode(), mappingMode, activeMappingMode };
}

const BREAK_BOARD_GAME_KEY = 'break-board-game-v1';

function normalizeBreakBoardGame(value) {
  const gameCode = String(value || '').trim().toUpperCase();
  if (!['ONEPIECE', 'RIFTBOUND'].includes(gameCode)) throw new Error('Choose either the One Piece Library or Riftbound Library.');
  return gameCode;
}

function breakBoardGameCode() {
  const card = database.prepare(`
    SELECT UPPER(TRIM(COALESCE(c.game_code, 'ONEPIECE'))) AS game_code
    FROM break_board_cards b JOIN cards c ON c.id = b.card_id
    ORDER BY b.position LIMIT 1
  `).get();
  if (card?.game_code) return normalizeBreakBoardGame(card.game_code);
  try { return normalizeBreakBoardGame(getMetadata(BREAK_BOARD_GAME_KEY) || 'ONEPIECE'); }
  catch { return 'ONEPIECE'; }
}

function setBreakBoardGame(value) {
  const gameCode = normalizeBreakBoardGame(value);
  const currentCount = Number(database.prepare('SELECT COUNT(*) AS count FROM break_board_cards').get().count || 0);
  if (currentCount && breakBoardGameCode() !== gameCode) throw new Error('Clear the working board before changing its card library. Your saved setups and live ledger will stay safe.');
  setMetadata(BREAK_BOARD_GAME_KEY, gameCode);
  if (gameCode !== RIFTBOUND_GAME_CODE) setMetadata(BREAK_BOARD_WORKING_MAPPING_MODE_KEY, BREAK_BOARD_MAPPING_MODES.MAPPED);
  return { gameCode, changed: true };
}

function setBreakBoardMappingMode(value) {
  const mappingMode = normalizeBreakBoardMappingMode(value);
  if (mappingMode === BREAK_BOARD_MAPPING_MODES.SINGLES && breakBoardGameCode() !== RIFTBOUND_GAME_CODE) {
    throw new Error('Singles Buyer Bags are available for Riftbound boards.');
  }
  setMetadata(BREAK_BOARD_WORKING_MAPPING_MODE_KEY, mappingMode);
  return { mappingMode, changed: true };
}

function setCardOnBreakBoard(id, shouldShow) {
  const cardId = Number(id);
  if (!Number.isInteger(cardId) || cardId < 1) throw new Error('Choose a valid library card first.');
  const card = database.prepare("SELECT id, UPPER(TRIM(COALESCE(game_code, 'ONEPIECE'))) AS game_code FROM cards WHERE id = ?").get(cardId);
  if (!card) throw new Error('Choose a valid library card first.');
  if (shouldShow) {
    const currentCount = Number(database.prepare('SELECT COUNT(*) AS count FROM break_board_cards').get().count || 0);
    if (!currentCount) setMetadata(BREAK_BOARD_GAME_KEY, normalizeBreakBoardGame(card.game_code));
    else if (breakBoardGameCode() !== card.game_code) throw new Error(`This working board uses the ${breakBoardGameCode() === 'RIFTBOUND' ? 'Riftbound' : 'One Piece'} Library. Clear it or load another setup before adding cards from a different game.`);
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
  const boardOneInstallWarning = getMetadata(VENDETTA_BOARD_ONE_STATUS_KEY) || '';
  const saved = database.prepare(`
    SELECT p.slot, p.name, p.saved_at, p.mapping_mode, COUNT(pc.card_id) AS card_count,
      COALESCE(MAX(UPPER(TRIM(COALESCE(c.game_code, 'ONEPIECE')))), 'ONEPIECE') AS game_code
    FROM break_board_presets p
    LEFT JOIN break_board_preset_cards pc ON pc.slot = p.slot
    LEFT JOIN cards c ON c.id = pc.card_id
    GROUP BY p.slot, p.name, p.saved_at, p.mapping_mode
  `).all();
  const savedBySlot = new Map(saved.map(preset => [Number(preset.slot), preset]));
  const working = database.prepare('SELECT card_id, position FROM break_board_cards ORDER BY position ASC').all();
  const storedWorkingSlot = getMetadata(BREAK_BOARD_WORKING_PRESET_SLOT_KEY);
  const matchingSlots = BREAK_BOARD_PRESET_SLOTS.filter(slot => {
    const preset = savedBySlot.get(slot);
    if (!preset || !working.length) return false;
    const cards = database.prepare('SELECT card_id, position FROM break_board_preset_cards WHERE slot = ? ORDER BY position ASC').all(slot);
    return sameBoardOrder(working, cards);
  });
  const workingSlot = resolveWorkingPresetSlot(storedWorkingSlot, matchingSlots);
  if (!BREAK_BOARD_PRESET_SLOTS.includes(Number(storedWorkingSlot))) {
    // Older builds identified the working setup by comparing card contents.
    // Migrate that state once, choosing only the first matching slot so two
    // duplicate saved boards can never both appear active.
    setMetadata(BREAK_BOARD_WORKING_PRESET_SLOT_KEY, String(workingSlot));
  }
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
      gameCode: preset?.game_code || null,
      mappingMode: normalizeBreakBoardMappingMode(preset?.mapping_mode),
      customizedMapping: Boolean(preset && database.prepare('SELECT 1 FROM break_board_custom_spots WHERE slot = ? LIMIT 1').get(slot)),
      installWarning: slot === 1 ? boardOneInstallWarning : slot === 2 ? getMetadata('combined-board-2-install-status') || '' : '',
      isLoaded: slot === workingSlot
    };
  });
}

function saveBreakBoardPreset(value = {}) {
  const slot = normalizePresetSlot(value.slot);
  const mappingMode = workingBreakBoardMappingMode(value.mappingMode);
  consolidateUnleashedPoroRuneSpots(mappingMode);
  compactBreakBoardPositions();
  const cards = listBreakBoardCards();
  if (!cards.length) throw new Error('Add at least one card before saving a board setup.');
  const savedAt = new Date().toISOString();
  const name = normalizePresetName(value.name, `Board ${slot}`);
  const previousPreset = database.prepare('SELECT mapping_mode FROM break_board_presets WHERE slot = ?').get(slot);
  const previousCards = previousPreset
    ? database.prepare('SELECT card_id, position FROM break_board_preset_cards WHERE slot = ? ORDER BY position ASC').all(slot)
    : [];
  const keepCustomMapping = Boolean(previousPreset)
    && normalizeBreakBoardMappingMode(previousPreset.mapping_mode) === mappingMode
    && sameBoardOrder(boardOrderRows(cards), previousCards);
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare(`
      INSERT INTO break_board_presets (slot, name, saved_at, mapping_mode) VALUES (?, ?, ?, ?)
      ON CONFLICT(slot) DO UPDATE SET name = excluded.name, saved_at = excluded.saved_at,
        mapping_mode = excluded.mapping_mode
    `).run(slot, name, savedAt, mappingMode);
    database.prepare('DELETE FROM break_board_preset_cards WHERE slot = ?').run(slot);
    const insert = database.prepare(`
      INSERT INTO break_board_preset_cards (slot, position, card_id, added_at)
      VALUES (?, ?, ?, ?)
    `);
    cards.forEach(card => insert.run(slot, card.position, card.id, savedAt));
    if (!keepCustomMapping) database.prepare('DELETE FROM break_board_custom_spots WHERE slot = ?').run(slot);
    setMetadata(BREAK_BOARD_WORKING_PRESET_SLOT_KEY, String(slot));
    setMetadata(BREAK_BOARD_WORKING_MAPPING_MODE_KEY, mappingMode);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return { slot, name, savedAt, savedCards: cards.length, gameCode: breakBoardGameCode(), mappingMode };
}

function loadBreakBoardPreset(value) {
  const slot = normalizePresetSlot(value);
  const preset = database.prepare('SELECT slot, name, saved_at, mapping_mode FROM break_board_presets WHERE slot = ?').get(slot);
  if (!preset) {
    database.exec('BEGIN IMMEDIATE');
    try {
      database.prepare('DELETE FROM break_board_cards').run();
      setMetadata(BREAK_BOARD_WORKING_PRESET_SLOT_KEY, String(slot));
      setMetadata(BREAK_BOARD_WORKING_MAPPING_MODE_KEY, BREAK_BOARD_MAPPING_MODES.MAPPED);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return { slot, name: `Board ${slot}`, savedAt: null, loadedCards: 0, removedRunes: 0, renumbered: false, gameCode: breakBoardGameCode(), mappingMode: BREAK_BOARD_MAPPING_MODES.MAPPED, empty: true };
  }
  const cards = database.prepare(`
    SELECT card_id, position, added_at
    FROM break_board_preset_cards
    WHERE slot = ?
    ORDER BY position ASC
  `).all(slot);
  if (!cards.length) throw new Error(`Saved setup ${slot} has no cards.`);
  const presetGame = database.prepare(`SELECT UPPER(TRIM(COALESCE(c.game_code, 'ONEPIECE'))) AS game_code FROM break_board_preset_cards pc JOIN cards c ON c.id=pc.card_id WHERE pc.slot=? ORDER BY pc.position LIMIT 1`).get(slot)?.game_code || 'ONEPIECE';
  const renumbered = cards.some((card, index) => Number(card.position) !== index + 1);
  let consolidation = { removedRunes: 0, renumbered: false };
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare('DELETE FROM break_board_cards').run();
    const insert = database.prepare('INSERT INTO break_board_cards (card_id, position, added_at) VALUES (?, ?, ?)');
    cards.forEach((card, index) => insert.run(card.card_id, index + 1, card.added_at));
    setMetadata(BREAK_BOARD_GAME_KEY, normalizeBreakBoardGame(presetGame));
    // Upgrade the saved setup too. This preserves its card order but prevents
    // an old gap (for example 1–8, 10–83) from coming back on a later load.
    if (renumbered) {
      database.prepare('UPDATE break_board_preset_cards SET position = -position WHERE slot = ?').run(slot);
      const updatePresetPosition = database.prepare('UPDATE break_board_preset_cards SET position = ? WHERE slot = ? AND card_id = ?');
      cards.forEach((card, index) => updatePresetPosition.run(index + 1, slot, card.card_id));
    }
    // Upgrade older 25-spot Unleashed setups permanently: when all six Poros
    // are present, their matching Runes belong inside those six bundles rather
    // than returning as standalone spots on every future load.
    consolidation = consolidateUnleashedPoroRuneSpots(preset.mapping_mode);
    if (consolidation.removedRunes) {
      const upgraded = database.prepare('SELECT card_id, position, added_at FROM break_board_cards ORDER BY position ASC').all();
      database.prepare('DELETE FROM break_board_preset_cards WHERE slot = ?').run(slot);
      const insertUpgraded = database.prepare('INSERT INTO break_board_preset_cards (slot, position, card_id, added_at) VALUES (?, ?, ?, ?)');
      upgraded.forEach(card => insertUpgraded.run(slot, card.position, card.card_id, card.added_at));
    }
    if (renumbered || consolidation.removedRunes) {
      database.prepare('DELETE FROM break_board_custom_spots WHERE slot = ?').run(slot);
    }
    setMetadata(BREAK_BOARD_WORKING_PRESET_SLOT_KEY, String(slot));
    setMetadata(BREAK_BOARD_WORKING_MAPPING_MODE_KEY, normalizeBreakBoardMappingMode(preset.mapping_mode));
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  const loadedCards = Number(database.prepare('SELECT COUNT(*) AS count FROM break_board_cards').get().count || 0);
  return { slot, name: preset.name, savedAt: preset.saved_at, loadedCards, removedRunes: consolidation.removedRunes, renumbered: renumbered || consolidation.renumbered, gameCode: presetGame, mappingMode: normalizeBreakBoardMappingMode(preset.mapping_mode) };
}

function clearBreakBoardPreset(value) {
  const slot = normalizePresetSlot(value);
  const preset = database.prepare('SELECT name FROM break_board_presets WHERE slot = ?').get(slot);
  if (!preset) return { slot, removedCards: 0, removed: false, clearedWorkingBoard: false };
  const presetCards = database.prepare(`
    SELECT card_id, position
    FROM break_board_preset_cards
    WHERE slot = ?
    ORDER BY position ASC
  `).all(slot);
  const clearedWorkingBoard = Number(getMetadata(BREAK_BOARD_WORKING_PRESET_SLOT_KEY) || 0) === slot;

  database.exec('BEGIN IMMEDIATE');
  try {
    // Remove the child rows explicitly instead of depending only on the
    // foreign-key cascade. This guarantees the setup cannot reappear after a
    // refresh, even for databases created by older BreakSuite builds.
    database.prepare('DELETE FROM break_board_preset_cards WHERE slot = ?').run(slot);
    database.prepare('DELETE FROM break_board_presets WHERE slot = ?').run(slot);

    // If this setup is the board currently shown in the editor, empty that
    // draft as part of the same action. Other saved setups and the live OBS
    // ledger are intentionally left untouched.
    if (clearedWorkingBoard) {
      database.prepare('DELETE FROM break_board_cards').run();
      setMetadata(BREAK_BOARD_WORKING_MAPPING_MODE_KEY, BREAK_BOARD_MAPPING_MODES.MAPPED);
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return { slot, removedCards: presetCards.length, removed: true, clearedWorkingBoard };
}

function nextBreakRoundSequence() {
  return Number(database.prepare('SELECT COALESCE(MAX(sequence), 0) + 1 AS value FROM break_rounds').get()?.value || 1);
}

function breakRoundIdentityFromRows(rows = []) {
  const first = rows[0] || {};
  const gameCode = String(first.game_code || '').trim().toUpperCase();
  const setCodes = [...new Set(rows.map(row => String(row.set_code || '').trim().toUpperCase()).filter(Boolean))];
  const setCode = setCodes.length === 1 ? setCodes[0] : (setCodes.length ? 'MULTI' : '');
  const setRow = setCode && setCode !== 'MULTI'
    ? database.prepare(`
      SELECT set_name FROM catalog_sets
      WHERE UPPER(TRIM(game_code)) = ? AND UPPER(TRIM(set_code)) = ?
      LIMIT 1
    `).get(gameCode, setCode)
    : null;
  const setName = String(setRow?.set_name || first.set_name || setCode || (gameCode === RIFTBOUND_GAME_CODE ? 'Riftbound' : 'One Piece')).trim();
  const sameSetCount = Number(database.prepare(`
    SELECT COUNT(*) AS count FROM break_rounds
    WHERE UPPER(TRIM(game_code)) = ? AND UPPER(TRIM(set_code)) = ?
  `).get(gameCode, setCode)?.count || 0);
  return {
    gameCode,
    setCode,
    setName,
    displayName: `${setName || 'Break'} Box ${sameSetCount + 1}`
  };
}

function insertLiveBreakRound(rows, ledgerSavedAt, requestedMappingMode) {
  const identity = breakRoundIdentityFromRows(rows);
  const mappingMode = normalizeBreakBoardMappingMode(requestedMappingMode, mappingModeFromMatchingPreset(rows));
  const sequence = nextBreakRoundSequence();
  const roundKey = `round-${sequence}-${crypto.randomUUID()}`;
  const inserted = database.prepare(`
    INSERT INTO break_rounds (
      round_key, sequence, display_name, game_code, set_code, set_name,
      mapping_mode, ledger_saved_at, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'LIVE', ?)
  `).run(
    roundKey,
    sequence,
    identity.displayName,
    identity.gameCode,
    identity.setCode,
    identity.setName,
    mappingMode,
    ledgerSavedAt,
    ledgerSavedAt
  );
  const roundId = Number(inserted.lastInsertRowid);
  setMetadata(ACTIVE_BREAK_ROUND_KEY, String(roundId));
  return { id: roundId, roundKey, sequence, ...identity, mappingMode, ledgerSavedAt, status: 'LIVE' };
}

function activeBreakRound() {
  const ledgerSavedAt = String(database.prepare('SELECT MAX(saved_at) AS value FROM active_break_board_cards').get()?.value || '').trim();
  if (!ledgerSavedAt) return null;
  const metadataId = Number(getMetadata(ACTIVE_BREAK_ROUND_KEY));
  let round = metadataId
    ? database.prepare("SELECT * FROM break_rounds WHERE id = ? AND status = 'LIVE'").get(metadataId)
    : null;
  if (!round || String(round.ledger_saved_at) !== ledgerSavedAt) {
    round = database.prepare("SELECT * FROM break_rounds WHERE ledger_saved_at = ? AND status = 'LIVE'").get(ledgerSavedAt) || null;
    if (round) setMetadata(ACTIVE_BREAK_ROUND_KEY, String(round.id));
  }
  return round;
}

function ensureCurrentActiveRound() {
  const existing = activeBreakRound();
  if (existing) return existing;
  const rows = database.prepare(`
    SELECT c.id, b.position, c.game_code, c.set_code, c.set_name
    FROM active_break_board_cards b
    JOIN cards c ON c.id = b.card_id
    ORDER BY b.position ASC
  `).all();
  if (!rows.length) return null;
  const ledgerSavedAt = String(database.prepare('SELECT MAX(saved_at) AS value FROM active_break_board_cards').get()?.value || '').trim();
  return insertLiveBreakRound(rows, ledgerSavedAt, mappingModeFromMatchingPreset(rows));
}

function holdCurrentRoundForReview() {
  const confirmedAssignments = Number(database.prepare(`
    SELECT COUNT(*) AS count FROM active_break_board_cards
    WHERE status = 'called' AND TRIM(buyer_name) != ''
  `).get()?.count || 0);
  const current = ensureCurrentActiveRound();
  if (!current) return null;
  if (!confirmedAssignments) {
    database.prepare("DELETE FROM break_rounds WHERE id = ? AND status = 'LIVE'").run(current.id);
    return null;
  }
  const pendingAt = new Date().toISOString();
  database.prepare(`
    INSERT INTO break_round_cards (
      round_id, position, card_id, saved_at, status, buyer_name, called_at,
      message_marked, tracker_marked, sale_amount_cents
    )
    SELECT ?, position, card_id, saved_at, status, buyer_name, called_at,
      message_marked, tracker_marked, sale_amount_cents
    FROM active_break_board_cards
  `).run(current.id);
  database.prepare(`
    INSERT INTO break_round_pulls (round_id, position, card_id, quantity, updated_at)
    SELECT ?, position, card_id, quantity, updated_at
    FROM riftbound_champion_pull_audit
  `).run(current.id);
  database.prepare(`
    UPDATE break_rounds
    SET status = 'PENDING_REVIEW', pending_at = ?
    WHERE id = ? AND status = 'LIVE'
  `).run(pendingAt, current.id);
  return {
    id: Number(current.id),
    roundKey: current.round_key,
    displayName: current.display_name,
    confirmedAssignments,
    pendingAt
  };
}

function saveBreakBoard(value = {}) {
  const mappingMode = workingBreakBoardMappingMode(value.mappingMode);
  const consolidation = consolidateUnleashedPoroRuneSpots(mappingMode);
  const numbering = compactBreakBoardPositions();
  const cards = listBreakBoardCards();
  if (!cards.length) throw new Error('Add at least one card before saving the live ledger.');
  const customMappingSlot = mappingMode === BREAK_BOARD_MAPPING_MODES.MAPPED
    ? matchingPresetSlotForRows(cards)
    : 0;
  const savedAt = new Date().toISOString();
  let pendingRound = null;
  let liveRound = null;
  database.exec('BEGIN IMMEDIATE');
  try {
    pendingRound = holdCurrentRoundForReview();
    database.prepare('DELETE FROM active_break_board_cards').run();
    const insert = database.prepare(`
      INSERT INTO active_break_board_cards (position, card_id, saved_at, status, buyer_name, called_at, message_marked)
      VALUES (?, ?, ?, 'ready', '', NULL, 0)
    `);
    cards.forEach(card => insert.run(card.position, card.id, savedAt));
    liveRound = insertLiveBreakRound(cards, savedAt, mappingMode);
    if (customMappingSlot) snapshotPresetCustomMapping(database, customMappingSlot, liveRound.id);
    setMetadata(BREAK_BOARD_WORKING_MAPPING_MODE_KEY, mappingMode);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  connectorStatus.lastBlock = null;
  overlayClaimQueue.clear();
  return {
    savedCards: cards.length,
    savedAt,
    pendingRound,
    liveRound,
    mappingMode,
    removedRunes: consolidation.removedRunes,
    renumbered: numbering.renumbered || consolidation.renumbered
  };
}

function finishLiveBreakRoundForReview() {
  const confirmedAssignments = Number(database.prepare(`
    SELECT COUNT(*) AS count FROM active_break_board_cards
    WHERE status = 'called' AND TRIM(buyer_name) != ''
  `).get()?.count || 0);
  if (!confirmedAssignments) throw new Error('The live box has no confirmed Buyer Bags to move into review.');
  let pendingRound;
  database.exec('BEGIN IMMEDIATE');
  try {
    pendingRound = holdCurrentRoundForReview();
    if (!pendingRound) throw new Error('The live box could not be held for review.');
    database.prepare('DELETE FROM active_break_board_cards').run();
    setMetadata(ACTIVE_BREAK_ROUND_KEY, '');
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  connectorStatus.lastBlock = null;
  overlayClaimQueue.clear();
  broadcastBreakBoardChange();
  return pendingRound;
}

function isLiveLedgerCurrent() {
  return breakBoardOverview().ready;
}

function getConnectorStatus() {
  const board = breakBoardOverview();
  const ledgerSavedAt = database.prepare('SELECT MAX(saved_at) AS value FROM active_break_board_cards').get().value || null;
  const testAssignments = database.prepare("SELECT COUNT(*) AS count FROM active_break_board_cards WHERE status = 'test-called'").get().count;
  const activeAssignments = database.prepare("SELECT COUNT(*) AS count FROM active_break_board_cards WHERE status = 'called' AND TRIM(buyer_name) != ''").get().count;
  const round = activeBreakRound();
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
    liveRoundId: round ? Number(round.id) : null,
    liveRoundKey: round?.round_key || null,
    liveRoundName: round?.display_name || '',
    activeAssignments,
    testAssignments
  };
}

function assertCurrentConnectorLedger(payload = {}) {
  const expected = String(database.prepare('SELECT MAX(saved_at) AS value FROM active_break_board_cards').get()?.value || '').trim();
  const received = String(payload.ledgerSavedAt || payload.ledgerKey || '').trim();
  if (!expected) throw new Error('Save Board ✓ first so the connector has a current live ledger.');
  if (!received) throw new Error('Reload the updated BreakSuite connector before scanning this round.');
  if (received !== expected) throw new Error('That connector event belongs to the previous box and was safely ignored. Reconnect + Scan Now for the live box.');
  return expected;
}

function notifyConnectorStatus() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('connector:status-changed', getConnectorStatus());
  }
}

function broadcastBreakBoardChange({ keepOverlayVisuals = false } = {}) {
  if (!keepOverlayVisuals) browserOverlayCardsCache = null;
  riftboundSpotMapCache = null;
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

function receiveLedgerBlock(value, { source = 'Connector', buyerName = '', saleAmountCents = 0, assignmentStatus = 'called', announce = true } = {}) {
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
      broadcastBreakBoardChange({ keepOverlayVisuals: true });
      return { ...cardForActivePosition(position), claim_announced: false, reveal_sequence: null };
    }
    return { ...target, claim_announced: false, reveal_sequence: null };
  }
  const receivedAt = new Date().toISOString();
  database.prepare(`
    UPDATE active_break_board_cards
    SET status = ?, buyer_name = ?, called_at = ?, message_marked = 0, tracker_marked = 0, sale_amount_cents = ?
    WHERE position = ?
  `).run(status, String(buyerName || '').trim(), receivedAt, status === 'called' ? amountCents : 0, position);
  connectorStatus.lastBlock = {
    position,
    cardId: target.id,
    cardName: target.name,
    source,
    receivedAt
  };
  const reveal = announce ? overlayClaimQueue.enqueue({ position, calledAt: receivedAt }) : null;
  broadcastBreakBoardChange({ keepOverlayVisuals: true });
  return {
    ...cardForActivePosition(position),
    claim_announced: Boolean(reveal),
    reveal_sequence: reveal?.sequence || null
  };
}

function receiveConnectorPayload(payload, { test = false, announce = true } = {}) {
  return receiveLedgerBlock(connectorValueFromPayload(payload), {
    source: String(payload?.source || (test ? 'Simulated Whatnot assigned row' : 'Connector')).slice(0, 80),
    buyerName: String(payload?.buyerName || payload?.buyer || '').slice(0, 180),
    saleAmountCents: saleAmountCentsFromPayload(payload),
    assignmentStatus: test ? 'test-called' : 'called',
    announce
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

  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare('DELETE FROM riftbound_champion_pull_audit WHERE position = ?').run(position);
    database.prepare(`
      UPDATE active_break_board_cards
      SET status = 'ready', buyer_name = '', called_at = NULL, message_marked = 0, tracker_marked = 0, sale_amount_cents = 0
      WHERE position = ? AND status = 'called'
    `).run(position);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  connectorStatus.lastBlock = {
    position,
    cardId: target.id,
    cardName: target.name,
    source,
    receivedAt: new Date().toISOString(),
    action: 'released'
  };
  broadcastBreakBoardChange({ keepOverlayVisuals: true });
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
  broadcastBreakBoardChange({ keepOverlayVisuals: true });
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
  broadcastBreakBoardChange({ keepOverlayVisuals: true });
  return { buyer, clearedCards: result.changes };
}

function markBuyerCardsTracked(positions) {
  const unique = [...new Set((Array.isArray(positions) ? positions : []).map(leadingBlockNumber).filter(Boolean))];
  if (!unique.length) throw new Error('Select at least one card first.');
  if (!isLiveLedgerCurrent()) throw new Error('Save Board ✓ first so Buyer Bags have a current live ledger.');
  const mark = database.prepare(`UPDATE active_break_board_cards SET tracker_marked = 1 WHERE position = ? AND status != 'ready'`);
  database.exec('BEGIN IMMEDIATE');
  try {
    unique.forEach(position => mark.run(position));
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  broadcastBreakBoardChange({ keepOverlayVisuals: true });
  return { markedCards: unique.length };
}

function unleashedTop80Catalog() {
  return database.prepare(`
    SELECT * FROM cards
    WHERE UPPER(TRIM(COALESCE(game_code, ''))) = ?
      AND UPPER(TRIM(COALESCE(set_code, ''))) = 'UNL'
  `).all(RIFTBOUND_GAME_CODE);
}

function spiritforgedExpandedCatalog() {
  return database.prepare(`
    SELECT * FROM cards
    WHERE UPPER(TRIM(COALESCE(game_code, ''))) = ?
      AND UPPER(TRIM(COALESCE(set_code, ''))) = 'SFD'
  `).all(RIFTBOUND_GAME_CODE);
}

function buildRiftboundSinglesAudit(assigned = [], selected = []) {
  const quantityByKey = new Map(selected.map(row => [`${row.position}:${row.card_id}`, Number(row.quantity || 0)]));
  return assigned.map(spotRow => {
    const renderedSpot = forRenderer(spotRow);
    const visual = buildRiftboundSingleSpot(renderedSpot);
    const renderCard = card => ({
      ...forRenderer(card),
      riftbound_single: true,
      audit_quantity: quantityByKey.get(`${spotRow.position}:${card.id}`) || 0
    });
    return {
      position: Number(spotRow.position),
      buyer: String(spotRow.buyer_name || ''),
      champion: '',
      baron: '',
      poro: '',
      spotType: 'RIFTBOUND_SINGLE',
      visualOnly: false,
      color: '',
      domain: '',
      mappedCardName: '',
      runeName: '',
      champions: [],
      extras: [],
      spotLabel: visual.displayLabel,
      listingNote: visual.listingNote,
      bundleGroups: visual.bundleGroups.map(group => ({
        ...group,
        cards: group.cards.map(renderCard)
      })),
      bundleKind: 'riftbound-single',
      setCode: String(spotRow.set_code || '').trim().toUpperCase(),
      spotCard: {
        ...renderedSpot,
        break_spot_label: visual.displayLabel,
        riftbound_single: true
      },
      heroCards: visual.heroCards.map(forRenderer),
      family: visual.family.map(renderCard)
    };
  });
}

function buildSpiritforgedExpandedBreakAudit(assigned = [], selected = [], profile = undefined) {
  const quantityByKey = new Map(selected.map(row => [`${row.position}:${row.card_id}`, Number(row.quantity || 0)]));
  const catalog = spiritforgedExpandedCatalog();
  return assigned.map(spotRow => {
    const visual = buildSpiritforgedExpandedBreakSpot(catalog, spotRow, profile);
    if (!visual) return null;
    const renderCard = card => ({
      ...forRenderer(card),
      audit_quantity: quantityByKey.get(`${spotRow.position}:${card.id}`) || 0
    });
    return {
      position: Number(spotRow.position),
      buyer: String(spotRow.buyer_name || ''),
      champion: visual.champion || '',
      baron: '',
      poro: '',
      spotType: 'SPIRITFORGED_EXPANDED',
      expandedKind: visual.kind,
      visualOnly: false,
      color: visual.color,
      domain: visual.domain,
      mappedCardName: '',
      runeName: visual.rune || '',
      champions: visual.champions,
      extras: [],
      spotLabel: visual.displayLabel,
      listingNote: visual.listingNote,
      instruction: visual.instruction,
      rewardTitle: visual.rewardTitle,
      rewardCaption: visual.rewardCaption,
      bundleGroups: visual.bundleGroups.map(group => ({
        ...group,
        cards: group.cards.map(renderCard)
      })),
      bundleKind: `spiritforged-expanded-${visual.kind}`,
      setCode: 'SFD',
      spotCard: {
        ...forRenderer(spotRow),
        break_spot_label: visual.displayLabel,
        spiritforged_expanded_break: true
      },
      heroCards: visual.heroCards.map(forRenderer),
      family: visual.family.map(renderCard)
    };
  }).filter(Boolean);
}

function buildUnleashedTop80Audit(assigned = [], selected = []) {
  const quantityByKey = new Map(selected.map(row => [`${row.position}:${row.card_id}`, Number(row.quantity || 0)]));
  const catalog = unleashedTop80Catalog();
  return assigned.map(spotRow => {
    const visual = buildUnleashedTop80Spot(catalog, spotRow);
    if (!visual) return null;
    const renderCard = card => ({
      ...forRenderer(card),
      audit_quantity: quantityByKey.get(`${spotRow.position}:${card.id}`) || 0
    });
    return {
      position: Number(spotRow.position),
      buyer: String(spotRow.buyer_name || ''),
      champion: '',
      baron: '',
      poro: '',
      spotType: 'UNLEASHED_TOP80',
      visualOnly: false,
      color: '',
      domain: '',
      mappedCardName: '',
      runeName: '',
      champions: [],
      extras: [],
      spotLabel: visual.displayLabel,
      listingNote: visual.listingNote,
      bundleGroups: visual.bundleGroups.map(group => ({
        ...group,
        cards: group.cards.map(renderCard)
      })),
      bundleKind: 'unleashed-top80',
      setCode: 'UNL',
      spotCard: {
        ...forRenderer(spotRow),
        break_spot_label: visual.displayLabel,
        unleashed_top80: true,
        collectr_rank: visual.collectrRank,
        collectr_snapshot_price_cents: visual.collectrSnapshotPriceCents
      },
      heroCards: visual.heroCards.map(forRenderer),
      family: visual.family.map(renderCard)
    };
  }).filter(Boolean);
}

function buildUnleashedCaseBreakAudit(assigned = [], selected = []) {
  const quantityByKey = new Map(selected.map(row => [`${row.position}:${row.card_id}`, Number(row.quantity || 0)]));
  const catalog = unleashedTop80Catalog();
  return assigned.map(spotRow => {
    const visual = buildUnleashedCaseBreakSpot(catalog, spotRow);
    if (!visual) return null;
    const renderCard = card => ({
      ...forRenderer(card),
      audit_quantity: quantityByKey.get(`${spotRow.position}:${card.id}`) || 0
    });
    return {
      position: Number(spotRow.position),
      buyer: String(spotRow.buyer_name || ''),
      champion: visual.champion || '',
      baron: visual.baron ? 'Baron Nashor' : '',
      poro: visual.poro || '',
      spotType: 'UNLEASHED_CASE_BREAK',
      caseKind: visual.kind,
      visualOnly: false,
      color: visual.color,
      domain: visual.domain,
      mappedCardName: visual.mappedCardName || '',
      runeName: visual.baron ? 'All 6 AA Runes' : '',
      champions: visual.champions,
      extras: [],
      spotLabel: visual.displayLabel,
      listingNote: visual.listingNote,
      bundleGroups: visual.bundleGroups.map(group => ({
        ...group,
        cards: group.cards.map(renderCard)
      })),
      bundleKind: `unleashed-case-${visual.kind}`,
      setCode: 'UNL',
      spotCard: {
        ...forRenderer(spotRow),
        break_spot_label: visual.displayLabel,
        unleashed_case_break: true
      },
      heroCards: visual.heroCards.map(forRenderer),
      family: visual.family.map(renderCard)
    };
  }).filter(Boolean);
}

function buildUnleashedExpandedBreakAudit(assigned = [], selected = []) {
  const quantityByKey = new Map(selected.map(row => [`${row.position}:${row.card_id}`, Number(row.quantity || 0)]));
  const catalog = unleashedTop80Catalog();
  return assigned.map(spotRow => {
    const visual = buildUnleashedExpandedBreakSpot(catalog, spotRow);
    if (!visual) return null;
    const renderCard = card => ({
      ...forRenderer(card),
      audit_quantity: quantityByKey.get(`${spotRow.position}:${card.id}`) || 0
    });
    return {
      position: Number(spotRow.position),
      buyer: String(spotRow.buyer_name || ''),
      champion: visual.champion || '',
      baron: visual.baron ? 'Baron Nashor' : '',
      poro: visual.poro || '',
      spotType: 'UNLEASHED_EXPANDED',
      expandedKind: visual.kind,
      expandedMode: visual.mode,
      laneSymbol: visual.laneSymbol,
      laneLabel: visual.laneLabel,
      visualOnly: false,
      color: visual.color,
      domain: visual.domain,
      mappedCardName: '',
      runeName: visual.rune || '',
      champions: visual.champions,
      extras: [],
      spotLabel: visual.displayLabel,
      listingNote: visual.listingNote,
      instruction: visual.instruction,
      rewardTitle: visual.rewardTitle,
      rewardCaption: visual.rewardCaption,
      bundleGroups: visual.bundleGroups.map(group => ({
        ...group,
        cards: group.cards.map(renderCard)
      })),
      bundleKind: `unleashed-expanded-${visual.kind}`,
      setCode: 'UNL',
      spotCard: {
        ...forRenderer(spotRow),
        break_spot_label: visual.displayLabel,
        unleashed_expanded_break: true
      },
      heroCards: visual.heroCards.map(forRenderer),
      family: visual.family.map(renderCard)
    };
  }).filter(Boolean);
}

// Keep the previous seven-color profile readable for a live or pending round
// that was started before this update. It is no longer installed into Board 1.
function buildUnleashedColorBreakAudit(assigned = [], selected = []) {
  const quantityByKey = new Map(selected.map(row => [`${row.position}:${row.card_id}`, Number(row.quantity || 0)]));
  const catalog = unleashedTop80Catalog();
  return assigned.map(spotRow => {
    const visual = buildUnleashedColorBreakSpot(catalog, spotRow);
    if (!visual) return null;
    const renderCard = card => ({
      ...forRenderer(card),
      audit_quantity: quantityByKey.get(`${spotRow.position}:${card.id}`) || 0
    });
    const mapping = visual.poro ? poroMapping(visual.poro, 'UNL') : null;
    return {
      position: Number(spotRow.position),
      buyer: String(spotRow.buyer_name || ''),
      champion: visual.champions[0] || '',
      baron: visual.baron ? 'Baron Nashor' : '',
      poro: visual.poro || '',
      spotType: 'UNLEASHED_COLOR_BREAK',
      visualOnly: false,
      color: visual.color,
      domain: visual.domain,
      mappedCardName: mapping?.mappedCard || '',
      runeName: mapping?.rune || '',
      champions: visual.champions,
      extras: [],
      spotLabel: visual.displayLabel,
      listingNote: visual.listingNote,
      bundleGroups: visual.bundleGroups.map(group => ({
        ...group,
        cards: group.cards.map(renderCard)
      })),
      bundleKind: 'unleashed-color-break',
      setCode: 'UNL',
      spotCard: {
        ...forRenderer(spotRow),
        break_spot_label: visual.displayLabel,
        unleashed_color_break: true
      },
      heroCards: visual.heroCards.map(forRenderer),
      family: visual.family.map(renderCard)
    };
  }).filter(Boolean);
}

function riftboundComboBoardDetected(boardRows = []) {
  const rows = Array.isArray(boardRows) ? boardRows : [];
  const sets = new Set(rows.map(row => String(row.set_code || '').trim().toUpperCase()));
  if (!sets.has('UNL') || !sets.has('VEN')) return false;
  const anchors = rows.filter(row => findVisualSpotForAnchor(row));
  // Require several recognized anchors so an ordinary mixed-set test board
  // cannot accidentally turn into the custom combo visual profile.
  return anchors.length >= 6;
}

function riftboundComboCatalog() {
  return database.prepare(`
    SELECT * FROM cards
    WHERE UPPER(TRIM(COALESCE(game_code, ''))) = ?
      AND UPPER(TRIM(COALESCE(set_code, ''))) IN ('UNL', 'VEN')
  `).all(RIFTBOUND_GAME_CODE);
}

function comboPrefix(value = '') {
  return String(value || '').split(',')[0].trim().toLowerCase();
}

function comboTreatment(card = {}) {
  return String(card.collector_treatment || card.variant || card.manual_category || '').trim().toUpperCase();
}

function buildRiftboundComboVisualAudit(assigned = [], selected = []) {
  const quantityByKey = new Map(selected.map(row => [`${row.position}:${row.card_id}`, Number(row.quantity || 0)]));
  const catalog = riftboundComboCatalog();
  return assigned.map(spotRow => {
    const spot = findVisualSpotForAnchor(spotRow);
    if (!spot) return null;
    const visual = buildVisualSpot(catalog, spotRow);
    if (!visual) return null;
    const family = (visual.family || []).map(card => ({
      ...forRenderer(card),
      audit_quantity: quantityByKey.get(`${spotRow.position}:${card.id}`) || 0
    }));
    let bundleGroups = [];
    if (spot.champions) {
      bundleGroups = spot.champions.map(member => ({
        key: `combo-${String(member.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        label: member.name,
        caption: `${member.setCode} · every mapped printing pulled`,
        role: 'champion',
        cards: family.filter(card => cardBelongsToChampion(card, member.name, member.setCode))
      }));
      (spot.extraOnChampions || []).forEach((extraName, extraIndex) => {
        bundleGroups.push({
          key: `combo-extra-on-${extraIndex + 1}`,
          label: `${extraName} ON (VEN)`,
          caption: 'Assigned standalone Overnumbered chase for this visual combo spot',
          role: 'overnumbered',
          cards: family.filter(card => String(card.set_code || '').trim().toUpperCase() === 'VEN'
            && comboPrefix(card.name) === String(extraName).toLowerCase()
            && comboTreatment(card) === 'OVERNUMBERED')
        });
      });
      // Visual-only: Baron is anchored by the real Baron spot but paired with Renekton.
      // Keep Baron printings visible as their own horizontal group without touching ledger logic.
      if (spot.baron) {
        const groupedIds = new Set(bundleGroups.flatMap(group => group.cards || []).map(card => Number(card.id)));
        const baronCards = family.filter(card => !groupedIds.has(Number(card.id)));
        bundleGroups.unshift({
          key: 'combo-baron',
          label: 'Baron Nashor',
          caption: 'UNL · every mapped Baron printing pulled',
          role: 'baron',
          cards: baronCards
        });
      }
    } else if (spot.poro) {
      // Visual-only combo grouping: use the custom color/domain attached to the
      // combo profile rather than the reusable single-set Poro mapping. This
      // keeps Plundering->Ahri, Veteran->Sett, Rift Herald->Yellow, etc. out of
      // the connector/ledger/card-library logic.
      const pairedSpNumber = String(spot.pairedSpNumber || '').trim().toUpperCase();
      const spCards = pairedSpNumber
        ? family.filter(card => String(card.set_code || '').trim().toUpperCase() === 'VEN' && String(card.card_number || '').trim().toUpperCase() === pairedSpNumber)
        : [];
      const poroCards = family.filter(card => comboPrefix(card.name) === String(spot.poro).toLowerCase());
      const runeName = String(spot.visualRune || '').trim();
      const runeCards = family.filter(card => comboPrefix(card.name) === runeName.toLowerCase());
      const reservedIds = new Set([...poroCards, ...spCards, ...runeCards].map(card => Number(card.id)));
      const remainingCards = family.filter(card => !reservedIds.has(Number(card.id)));
      const epicCards = remainingCards.filter(card => String(card.rarity || card.source_rarity || '').trim().toUpperCase() === 'EPIC');
      const epicIds = new Set(epicCards.map(card => Number(card.id)));
      const rareCards = remainingCards.filter(card => !epicIds.has(Number(card.id)));
      const visualDomain = String(spot.visualDomain || '').trim();
      bundleGroups = [
        { key: 'poro', label: spot.poro, caption: 'Every Poro printing pulled', role: 'poro', cards: poroCards },
        { key: 'paired-sp', label: `${spot.spAnchor || 'Crystal Rose'} SP (VEN)`, caption: 'Matching Crystal Rose SP chase', role: 'sp', cards: spCards },
        { key: 'rune', label: runeName || 'Rune / Showcase', caption: 'Matching UNL + VEN Rune / Showcase printings', role: 'rune', cards: runeCards },
        { key: 'epic-color', label: `${visualDomain || 'Color'} Epic Cards`, caption: 'Epic + alternate-art Epic cards in this visual color family', role: 'epic-color', cards: epicCards },
        { key: 'rare-color', label: `${visualDomain || 'Color'} Rare Cards`, caption: 'Rare units, spells, gear and other mapped color-family cards', role: 'rare-color', cards: rareCards }
      ];
    } else if (spot.spNumber) {
      const spNumber = String(spot.spNumber).toUpperCase();
      const spCards = family.filter(card => String(card.card_number || '').trim().toUpperCase() === spNumber);
      bundleGroups = [
        { key: 'crystal-rose', label: `${spot.vendettaColorSpot} Crystal Rose SP`, caption: 'Crystal Rose SP chase', role: 'sp', cards: spCards },
        { key: 'vendetta-color-family', label: `${spot.displayLabel.replace(/^[^+]+\+\s*/, '')} Family`, caption: 'Mapped Showcase Rune, Rare units, spells, gear and named color chases', role: 'rare-color', cards: family.filter(card => !spCards.some(spCard => Number(spCard.id) === Number(card.id))) }
      ];
    } else if (spot.baron) {
      bundleGroups = [{ key: 'baron', label: 'Baron Nashor', caption: 'Every mapped Baron printing pulled', role: 'baron', cards: family }];
    }
    return {
      position: Number(spotRow.position),
      buyer: String(spotRow.buyer_name || ''),
      champion: spot.champions?.[0]?.name || '',
      baron: spot.baron ? 'Baron Nashor' : '',
      poro: spot.poro || '',
      spotType: 'COMBO_VISUAL',
      visualOnly: true,
      color: '',
      domain: '',
      mappedCardName: '',
      runeName: '',
      champions: spot.champions?.map(member => member.name) || [],
      extras: [...(spot.extraOnChampions || [])],
      spotLabel: visual.displayLabel,
      listingNote: visual.listingNote,
      bundleGroups,
      bundleKind: 'unl-ven-combo-visual',
      setCode: 'UNL + VEN',
      spotCard: forRenderer(spotRow),
      heroCards: (visual.heroCards || []).map(forRenderer),
      family
    };
  }).filter(Boolean);
}

function buildDefaultRiftboundMappedAudit(board = [], assigned = board, selected = []) {
  if (isSpiritforgedExpandedBreakBoard(board)) {
    return buildSpiritforgedExpandedBreakAudit(assigned, selected, spiritforgedExpandedProfileForBoard(board));
  }
  if (isUnleashedExpandedBreakBoard(board)) return buildUnleashedExpandedBreakAudit(assigned, selected);
  if (isUnleashedCaseBreakBoard(board)) return buildUnleashedCaseBreakAudit(assigned, selected);
  if (isUnleashedTop80Board(board)) return buildUnleashedTop80Audit(assigned, selected);
  if (isUnleashedColorBreakBoard(board)) return buildUnleashedColorBreakAudit(assigned, selected);
  return riftboundComboBoardDetected(board)
    ? buildRiftboundComboVisualAudit(assigned, selected)
    : buildRiftboundChampionAudit(assigned, selected);
}

function buildCustomMappingAudit(assigned = [], selected = [], mapping = null) {
  if (!mapping?.spots?.length) return [];
  const linearOverlayProfile = linearOverlayProfileForCustomMapping(mapping);
  const quantityByKey = new Map(selected.map(row => [`${row.position}:${row.card_id}`, Number(row.quantity || 0)]));
  const spots = new Map(mapping.spots.map(spot => [Number(spot.position), spot]));
  return assigned.map(spotRow => {
    const mappedSpot = spots.get(Number(spotRow.position));
    if (!mappedSpot) return null;
    const family = (mappedSpot.cards || []).map(card => ({
      ...forRenderer(card),
      audit_quantity: quantityByKey.get(`${spotRow.position}:${card.id}`) || 0
    }));
    const anchorPresentation = customMappingCardPresentation(forRenderer(spotRow));
    const laneSymbol = ['signature', 'ultimate', 'overnumbered', 'alternate-art'].includes(anchorPresentation.role)
      ? anchorPresentation.badge
      : '';
    const laneLabel = anchorPresentation.role === 'signature'
      ? 'SIG'
      : anchorPresentation.role === 'ultimate'
        ? 'ULTIMATE'
        : anchorPresentation.role === 'overnumbered'
          ? 'ON'
          : anchorPresentation.role === 'alternate-art' ? 'AA' : '';
    const setCodes = [...new Set(family.map(card => String(card.set_code || '').trim().toUpperCase()).filter(Boolean))];
    return {
      position: Number(spotRow.position),
      buyer: String(spotRow.buyer_name || ''),
      champion: String(spotRow.name || '').split(',')[0].trim(),
      baron: '',
      poro: '',
      spotType: 'CUSTOM_MAPPING',
      customMapping: true,
      linearOverlayProfile: linearOverlayProfile?.id || '',
      laneSymbol,
      laneLabel,
      visualOnly: false,
      color: '',
      domain: '',
      mappedCardName: '',
      runeName: '',
      champions: [],
      extras: [],
      spotLabel: customMappingSpotDisplayLabel(mappedSpot) || String(spotRow.name || 'Mapped Spot'),
      listingNote: 'Exact saved-board assignment from Frame Studio.',
      instruction: 'Select only the exact cards displayed in this saved mapping.',
      rewardTitle: 'CUSTOM SAVED MAP',
      rewardCaption: `${family.length} EXACT CARD${family.length === 1 ? '' : 'S'} · NO DUPLICATE OWNERSHIP`,
      bundleGroups: family.map((card, index) => {
        const presentation = customMappingCardPresentation(card);
        return {
          key: `custom-${Number(card.id) || index + 1}`,
          label: card.name || presentation.badgeLabel,
          caption: [card.set_code, card.card_number, presentation.badgeLabel].filter(Boolean).join(' · '),
          role: presentation.role,
          badge: presentation.badge,
          badgeLabel: presentation.badgeLabel,
          cards: [card]
        };
      }),
      bundleKind: linearOverlayProfile?.bundleKind || 'custom-saved-map',
      setCode: setCodes.length === 1 ? setCodes[0] : (setCodes.length ? setCodes.join(' + ') : String(spotRow.set_code || '')),
      spotCard: {
        ...forRenderer(spotRow),
        break_spot_label: customMappingSpotDisplayLabel(mappedSpot) || String(spotRow.name || 'Mapped Spot'),
        custom_break_mapping: true
      },
      // Boards 6, 7 and 9 use one lead card followed by the rest of the exact
      // mapped family in a straight line. A saved mapping must not turn the
      // second sequence card into a side-by-side + preview.
      heroCards: overlayPreviewCards(family, linearOverlayProfile),
      family
    };
  }).filter(Boolean);
}

function boardMappingEditorCard(card = {}) {
  const rendered = forRenderer(card) || {};
  const presentation = customMappingCardPresentation(rendered);
  return {
    id: Number(rendered.id) || 0,
    name: String(rendered.name || ''),
    cardNumber: String(rendered.card_number || ''),
    setCode: String(rendered.set_code || ''),
    setName: String(rendered.set_name || ''),
    rarity: String(rendered.rarity || rendered.break_rarity || ''),
    treatment: String(rendered.collector_treatment || ''),
    imageUrl: String(rendered.image_url || ''),
    role: presentation.role,
    badge: presentation.badge,
    badgeLabel: presentation.badgeLabel,
    additionType: String(rendered.mappingAdditionType || rendered.additionType || 'SEQUENCE').trim().toUpperCase()
  };
}

function presetBoardCardsForMapping(slot) {
  return database.prepare(`
    SELECT c.*, pc.position
    FROM break_board_preset_cards pc
    JOIN cards c ON c.id = pc.card_id
    WHERE pc.slot = ?
    ORDER BY pc.position ASC
  `).all(slot);
}

function defaultEditorMappingForBoard(board = []) {
  const audit = buildDefaultRiftboundMappedAudit(board, board, []);
  const auditByPosition = new Map(audit.map(entry => [Number(entry.position), entry]));
  const anchorOwners = new Map(board.map(card => [Number(card.id), Number(card.position)]));
  const claimed = new Set();
  return board.map(anchor => {
    const position = Number(anchor.position);
    const entry = auditByPosition.get(position);
    const cards = [anchor, ...(entry?.family || [])];
    const unique = [];
    for (const card of cards) {
      const cardId = Number(card?.id) || 0;
      if (!cardId || claimed.has(cardId)) continue;
      const reservedPosition = anchorOwners.get(cardId);
      if (reservedPosition && reservedPosition !== position) continue;
      claimed.add(cardId);
      unique.push(card);
    }
    return {
      position,
      label: String(entry?.spotLabel || riftboundSpotName(forRenderer(anchor)) || anchor.name || `Spot ${position}`),
      cards: unique
    };
  });
}

function boardMappingEditorState(value) {
  const slot = normalizePresetSlot(value);
  const preset = database.prepare('SELECT slot, name, saved_at, mapping_mode FROM break_board_presets WHERE slot = ?').get(slot);
  if (!preset) {
    return {
      slot,
      name: `Board ${slot}`,
      gameCode: '',
      mappingMode: BREAK_BOARD_MAPPING_MODES.MAPPED,
      editable: false,
      customized: false,
      reason: `Board ${slot} is empty. Build and save its positions in Break Board first.`,
      spots: [],
      mappedCardCount: 0
    };
  }
  const board = presetBoardCardsForMapping(slot);
  const gameCodes = [...new Set(board.map(card => String(card.game_code || 'ONEPIECE').trim().toUpperCase()))];
  const gameCode = gameCodes.length === 1 ? gameCodes[0] : 'MIXED';
  const mappingMode = normalizeBreakBoardMappingMode(preset.mapping_mode);
  const editable = Boolean(board.length && gameCode === RIFTBOUND_GAME_CODE && mappingMode === BREAK_BOARD_MAPPING_MODES.MAPPED);
  const savedMapping = editable ? loadPresetCustomMapping(database, slot) : null;
  const sourceSpots = savedMapping?.spots?.length
    ? savedMapping.spots
    : (editable ? defaultEditorMappingForBoard(board) : board.map(card => ({ position: Number(card.position), label: card.name, cards: [card] })));
  const anchors = new Map(board.map(card => [Number(card.position), card]));
  const spots = sourceSpots.map(spot => {
    const anchor = anchors.get(Number(spot.position));
    return {
      position: Number(spot.position),
      label: String(spot.label || anchor?.name || `Spot ${spot.position}`),
      displayLabel: customMappingSpotDisplayLabel(spot),
      anchorCardId: Number(anchor?.id) || 0,
      anchorCard: boardMappingEditorCard({ ...(anchor || {}), mappingAdditionType: 'ANCHOR' }),
      cards: (spot.cards || []).map(card => boardMappingEditorCard({
        ...card,
        mappingAdditionType: Number(card.id) === Number(anchor?.id)
          ? 'ANCHOR'
          : (card.mappingAdditionType || 'SEQUENCE')
      }))
    };
  });
  let reason = '';
  if (!board.length) reason = `Board ${slot} has no saved positions.`;
  else if (gameCode !== RIFTBOUND_GAME_CODE) reason = 'One Piece boards already use one exact card per position, so no grouped mapping is needed.';
  else if (mappingMode !== BREAK_BOARD_MAPPING_MODES.MAPPED) reason = 'This Riftbound board uses Singles mode; every position already owns only its exact displayed card.';
  return {
    slot,
    name: String(preset.name || `Board ${slot}`),
    savedAt: preset.saved_at,
    gameCode,
    mappingMode,
    editable,
    customized: Boolean(savedMapping?.spots?.length),
    reason,
    spots,
    mappedCardCount: spots.reduce((total, spot) => total + spot.cards.length, 0)
  };
}

function searchBoardMappingLibrary(payload = {}) {
  const editor = boardMappingEditorState(payload.slot);
  if (!editor.editable) throw new Error(editor.reason || 'Choose a mapped Riftbound board first.');
  const query = String(payload.query || '').trim();
  const cards = listCards({ game: RIFTBOUND_GAME_CODE, query, setCode: 'All', rarity: 'All' });
  return cards.slice(0, 100).map(boardMappingEditorCard);
}

function saveBoardMappingEditor(payload = {}) {
  const result = savePresetCustomMapping(database, payload.slot, payload);
  riftboundSpotMapCache = null;
  riftboundSpotOverviewCache = null;
  riftboundSpotOverviewCacheKey = '';
  return { ...result, editor: boardMappingEditorState(result.slot) };
}

function resetBoardMappingEditor(value) {
  const slot = normalizePresetSlot(value);
  const result = clearPresetCustomMapping(database, slot);
  riftboundSpotMapCache = null;
  riftboundSpotOverviewCache = null;
  riftboundSpotOverviewCacheKey = '';
  return { ...result, editor: boardMappingEditorState(slot) };
}

function listRiftboundChampionAudit() {
  const assigned = database.prepare(`
    SELECT c.*, b.position, b.status AS block_status, b.buyer_name
    FROM active_break_board_cards b
    JOIN cards c ON c.id = b.card_id
    WHERE b.status != 'ready' AND UPPER(TRIM(COALESCE(c.game_code, ''))) = ?
    ORDER BY b.position ASC
  `).all(RIFTBOUND_GAME_CODE);
  const selected = database.prepare('SELECT position, card_id, quantity FROM riftbound_champion_pull_audit').all();
  const board = database.prepare(`
    SELECT c.*, b.position, b.status AS block_status, b.buyer_name
    FROM active_break_board_cards b
    JOIN cards c ON c.id = b.card_id
    WHERE UPPER(TRIM(COALESCE(c.game_code, ''))) = ?
    ORDER BY b.position ASC
  `).all(RIFTBOUND_GAME_CODE);
  if (activeBreakBoardMappingMode(board) === BREAK_BOARD_MAPPING_MODES.SINGLES) {
    return buildRiftboundSinglesAudit(assigned, selected);
  }
  const round = activeBreakRound();
  const customMapping = round ? loadRoundCustomMapping(database, round.id) : null;
  return customMapping?.spots?.length
    ? buildCustomMappingAudit(assigned, selected, customMapping)
    : buildDefaultRiftboundMappedAudit(board, assigned, selected);
}

function spotMapRemoteThumbnailUrl(value = '') {
  const source = String(value || '').trim();
  if (!/^https?:\/\//i.test(source)) return '';
  try {
    const url = new URL(source);
    if (url.hostname.toLowerCase() === 'openrift.app' && /-(?:full|400w|120w)\.webp$/i.test(url.pathname)) {
      url.pathname = url.pathname.replace(/-(?:full|400w|120w)\.webp$/i, '-400w.webp');
      return url.toString();
    }
  } catch {}
  return source;
}

async function riftboundSpotImageIndex() {
  if (!riftboundSpotImageIndexPromise) {
    riftboundSpotImageIndexPromise = fetchOpenRiftImageCatalog()
      .then(buildOpenRiftImageIndex)
      .catch(error => {
        console.error('Unable to load OpenRift Spot Map image index:', error.message);
        riftboundSpotImageIndexPromise = null;
        return new Map();
      });
  }
  return riftboundSpotImageIndexPromise;
}

async function riftboundSpotRemoteImageUrl(card = {}) {
  const existing = spotMapRemoteThumbnailUrl(card.image_url);
  if (existing) return existing;
  const index = await riftboundSpotImageIndex();
  const exact = lookupOpenRiftImage(index, card.card_number, card.set_code);
  const resolved = spotMapRemoteThumbnailUrl(exact?.imageUrl || '');
  if (resolved && Number(card.id)) {
    // Repair only the remote URL metadata when it was absent. This does not
    // touch break mapping, ledger ownership, or the connector.
    try {
      database.prepare("UPDATE cards SET image_url = CASE WHEN COALESCE(image_url,'')='' THEN ? ELSE image_url END WHERE id = ?")
        .run(exact.imageUrl, Number(card.id));
    } catch {}
  }
  return resolved;
}

function riftboundSpotMapImageUrl(card = {}) {
  const cardId = Number(card.id) || 0;
  if (!cardId) return '';
  // One permanent loopback URL per card. The renderer never switches from a
  // remote URL to a local URL after it has already drawn the card, so images
  // cannot disappear during a refresh/cache warm.
  return `${CONNECTOR_ORIGIN}/api/riftbound-spot-image/${cardId}?v=241`;
}

function riftboundSpotMapFallbackUrl(card = {}) {
  return spotMapRemoteThumbnailUrl(card.image_url);
}

async function resolveRiftboundSpotMapImagePath(cardId) {
  const id = Number(cardId) || 0;
  if (!id) return '';
  const card = database.prepare('SELECT id, image_path, image_url, card_number, set_code FROM cards WHERE id = ?').get(id);
  if (!card) return '';
  if (card.image_path && hasUsableCachedImage(card.image_path)) return card.image_path;

  const remoteUrl = await riftboundSpotRemoteImageUrl(card);
  if (!remoteUrl) return '';
  const key = `${id}|${remoteUrl}`;
  if (!riftboundSpotMapImageHydration.has(key)) {
    const promise = cacheRiftboundImage({ image_url: remoteUrl, image_path: '' })
      .then(imagePath => imagePath && hasUsableCachedImage(imagePath) ? imagePath : '')
      .catch(error => {
        console.error(`Unable to hydrate Spot Map image for card ${id}:`, error.message);
        return '';
      })
      .finally(() => riftboundSpotMapImageHydration.delete(key));
    riftboundSpotMapImageHydration.set(key, promise);
  }
  return riftboundSpotMapImageHydration.get(key);
}

function spotMapEntryCardIds(entries = []) {
  const ids = new Set();
  const add = card => { const id = Number(card?.id) || 0; if (id) ids.add(id); };
  for (const entry of Array.isArray(entries) ? entries : []) {
    add(entry?.spotCard);
    (entry?.heroCards || []).forEach(add);
    (entry?.family || []).forEach(add);
    (entry?.bundleGroups || []).forEach(group => (group?.cards || []).forEach(add));
  }
  return [...ids];
}

function scheduleRiftboundSpotMapImageWarm(entries = [], cacheKey = '') {
  const ids = spotMapEntryCardIds(entries);
  if (!ids.length) return;
  const warmKey = `${cacheKey}|${ids.join(',')}`;
  if (riftboundSpotMapWarmPromise && riftboundSpotMapWarmKey === warmKey) return;
  riftboundSpotMapWarmKey = warmKey;
  const pending = [...ids];
  // Spot Map thumbnails are only 400w, so a few concurrent workers can make a
  // saved board viewer-ready quickly without decoding hundreds of full images.
  riftboundSpotMapWarmPromise = Promise.all(Array.from({ length: Math.min(4, pending.length) }, async () => {
    while (pending.length) {
      const cardId = pending.shift();
      await resolveRiftboundSpotMapImagePath(cardId);
    }
  })).catch(error => console.error('Spot Map background image warm failed:', error.message));
}

function spotMapStaticCard(card) {
  if (!card) return null;
  const rendered = browserOverlayCard(card);
  if (!rendered) return null;
  const primaryUrl = riftboundSpotMapImageUrl(card);
  return {
    ...rendered,
    // Every Spot Map card uses one stable local URL for the lifetime of the
    // board. The server resolves/caches the artwork behind that URL.
    image_url: primaryUrl,
    image_fallback_url: riftboundSpotMapFallbackUrl(card)
  };
}

function spotMapStaticEntry(entry) {
  if (!entry) return null;
  const linearOverlayProfile = linearOverlayProfileForEntry(entry);
  return {
    ...entry,
    spotCard: spotMapStaticCard(entry.spotCard),
    heroCards: overlayPreviewCards(
      (Array.isArray(entry.heroCards) ? entry.heroCards : []).map(spotMapStaticCard).filter(Boolean),
      linearOverlayProfile
    ),
    bundleGroups: (Array.isArray(entry.bundleGroups) ? entry.bundleGroups : []).map(group => ({
      ...group,
      cards: (Array.isArray(group.cards) ? group.cards : []).map(spotMapStaticCard).filter(Boolean)
    })),
    family: (Array.isArray(entry.family) ? entry.family : []).map(spotMapStaticCard).filter(Boolean)
  };
}

function listRiftboundSpotOverview() {
  const board = database.prepare(`
    SELECT c.*, b.position, b.status AS block_status, b.buyer_name
    FROM active_break_board_cards b
    JOIN cards c ON c.id = b.card_id
    WHERE UPPER(TRIM(COALESCE(c.game_code, ''))) = ?
    ORDER BY b.position ASC
  `).all(RIFTBOUND_GAME_CODE);
  // Mapping and artwork for the overview are static for a saved board. Buyer
  // assignments only change status/buyer fields, so do not rebuild hundreds of
  // mapped card objects on every connector event.
  const mappingMode = activeBreakBoardMappingMode(board);
  const activePresetSlot = matchingPresetSlotForRows(board);
  const round = activeBreakRound();
  const customMapping = round ? loadRoundCustomMapping(database, round.id) : null;
  const activeLinearOverlayProfile = linearOverlayProfileForPresetSlot(activePresetSlot)
    || linearOverlayProfileForCustomMapping(customMapping);
  const cacheKey = `${mappingMode}|${customMappingSignature(customMapping)}|${board.map(row => `${Number(row.position)}:${Number(row.id)}`).join('|')}`;
  if (riftboundSpotOverviewCache && cacheKey === riftboundSpotOverviewCacheKey) {
    return riftboundSpotOverviewCache;
  }
  const mappedEntries = mappingMode === BREAK_BOARD_MAPPING_MODES.SINGLES
    ? buildRiftboundSinglesAudit(board, [])
    : customMapping?.spots?.length
      ? buildCustomMappingAudit(board, [], customMapping)
      : buildDefaultRiftboundMappedAudit(board, board, []);
  const mappedByPosition = new Map(
    mappedEntries.map(entry => [Number(entry.position), activeLinearOverlayProfile
      ? { ...entry, linearOverlayProfile: activeLinearOverlayProfile.id }
      : entry])
  );
  const entries = board.map(spotRow => mappedByPosition.get(Number(spotRow.position)) || {
    position: Number(spotRow.position),
    buyer: '',
    champion: '',
    baron: '',
    poro: '',
    spotType: 'DIRECT',
    color: '',
    domain: '',
    mappedCardName: '',
    runeName: '',
    champions: [],
    extras: [],
    spotLabel: String(spotRow.name || 'Named Chase'),
    bundleGroups: [{
      key: 'direct',
      label: String(spotRow.name || 'Named Chase'),
      caption: 'Displayed card only when this exact chase is pulled',
      role: 'direct',
      cards: [{ ...forRenderer(spotRow), audit_quantity: 0 }]
    }],
    bundleKind: 'direct',
    setCode: String(spotRow.set_code || '').trim().toUpperCase(),
    spotCard: forRenderer(spotRow),
    family: [{ ...forRenderer(spotRow), audit_quantity: 0 }]
  }).map(spotMapStaticEntry).filter(Boolean);
  riftboundSpotOverviewCache = entries;
  riftboundSpotOverviewCacheKey = cacheKey;
  // Pull any missing remote artwork into the local Riftbound image cache in the
  // background as soon as this saved board map is built. The UI/OBS then asks
  // only the local BreakSuite server for images; it never waits on OpenRift
  // directly while switching champion families.
  scheduleRiftboundSpotMapImageWarm(entries, cacheKey);
  return entries;
}

function publicRiftboundSpotMap() {
  if (riftboundSpotMapCache) return riftboundSpotMapCache;
  const publicCard = card => {
    // listRiftboundSpotOverview() already chose a sticky image source plus an
    // optional remote fallback. Preserve both exactly for Browser/OBS.
    const rendered = card;
    return rendered ? {
      id: Number(rendered.id) || 0,
      name: String(rendered.name || ''),
      card_number: String(rendered.card_number || ''),
      set_code: String(rendered.set_code || ''),
      rarity: String(rendered.rarity || ''),
      collector_treatment: String(rendered.collector_treatment || ''),
      image_url: String(rendered.image_url || ''),
      image_fallback_url: String(rendered.image_fallback_url || '')
    } : null;
  };
  const readyPositions = new Set(database.prepare(`
    SELECT b.position
    FROM active_break_board_cards b
    JOIN cards c ON c.id = b.card_id
    WHERE b.status = 'ready' AND UPPER(TRIM(COALESCE(c.game_code, ''))) = ?
  `).all(RIFTBOUND_GAME_CODE).map(row => Number(row.position)));
  riftboundSpotMapCache = listRiftboundSpotOverview()
    .filter(entry => readyPositions.has(Number(entry.position)))
    .map(entry => ({
      position: Number(entry.position),
      champion: String(entry.champion || ''),
      baron: String(entry.baron || ''),
      poro: String(entry.poro || ''),
      spotType: String(entry.spotType || ''),
      spotLabel: String(entry.spotLabel || ''),
      setCode: String(entry.setCode || ''),
      visualOnly: Boolean(entry.visualOnly),
      bundleKind: String(entry.bundleKind || ''),
      linearOverlay: Boolean(linearOverlayProfileForEntry(entry)),
      spotCard: publicCard(entry.spotCard),
      heroCards: (Array.isArray(entry.heroCards) ? entry.heroCards : []).map(publicCard).filter(Boolean),
      bundleGroups: (Array.isArray(entry.bundleGroups) ? entry.bundleGroups : []).map(group => ({
        key: String(group.key || ''),
        label: String(group.label || ''),
        caption: String(group.caption || ''),
        role: String(group.role || ''),
        cards: (Array.isArray(group.cards) ? group.cards : []).map(publicCard).filter(Boolean)
      })),
      family: (Array.isArray(entry.family) ? entry.family : []).map(publicCard).filter(Boolean)
    }));
  return riftboundSpotMapCache;
}

function riftboundSpotMapStatus() {
  return { enabled: Boolean(riftboundSpotMapEnabled) };
}

function staticOverlayStatus() {
  return { enabled: Boolean(staticOverlayEnabled) };
}

function setStaticOverlayEnabled(value) {
  staticOverlayEnabled = Boolean(value?.enabled ?? value);
  setMetadata(STATIC_OVERLAY_ENABLED_KEY, staticOverlayEnabled ? 'true' : 'false');
  if (!staticOverlayEnabled) browserOverlayCardsCache = null;
  return staticOverlayStatus();
}

function setRiftboundSpotMapEnabled(value) {
  riftboundSpotMapEnabled = Boolean(value?.enabled ?? value);
  if (!riftboundSpotMapEnabled) {
    // Release generated visual data. Cached image files remain safely on disk,
    // but no map objects or warming jobs are retained for OBS.
    riftboundSpotMapCache = null;
    riftboundSpotOverviewCache = null;
    riftboundSpotOverviewCacheKey = '';
    riftboundSpotMapWarmKey = '';
    riftboundSpotMapWarmPromise = null;
    riftboundSpotMapImageHydration.clear();
  }
  return riftboundSpotMapStatus();
}

function buildRiftboundChampionAudit(assigned, selected) {
  const quantityByKey = new Map(selected.map(row => [`${row.position}:${row.card_id}`, Number(row.quantity || 0)]));
  const catalogBySet = new Map();
  return assigned.map(spotRow => {
    const champion = championFromSpot(spotRow);
    const baron = baronFromSpot(spotRow);
    const poro = poroFromSpot(spotRow);
    const originsSpot = originsSpotFromCard(spotRow);
    const vendettaSpot = vendettaSpotFromCard(spotRow);
    const spiritforgedSpot = spiritforgedSpotFromCard(spotRow);
    if (!champion && !baron && !poro && !originsSpot && !vendettaSpot && !spiritforgedSpot) return null;
    const setCode = String(spotRow.set_code || '').trim().toUpperCase();
    if (!catalogBySet.has(setCode)) {
      catalogBySet.set(setCode, database.prepare(`
        SELECT * FROM cards
        WHERE UPPER(TRIM(COALESCE(game_code, ''))) = ? AND UPPER(TRIM(COALESCE(set_code, ''))) = ?
      `).all(RIFTBOUND_GAME_CODE, setCode));
    }
    const family = catalogBySet.get(setCode)
      .filter(card => vendettaSpot
        ? cardBelongsToVendettaSpot(card, vendettaSpot, setCode)
        : champion
          ? cardBelongsToChampion(card, champion, setCode)
          : baron
          ? cardBelongsToBaron(card, setCode)
          : poro
            ? cardBelongsToPoroSpot(card, poro, setCode)
            : originsSpot
              ? cardBelongsToOriginsSpot(card, originsSpot, setCode)
              : cardBelongsToSpiritforgedSpot(card, spiritforgedSpot, setCode))
      .map(card => ({
        ...forRenderer(card),
        audit_quantity: quantityByKey.get(`${spotRow.position}:${card.id}`) || 0
      }))
      .sort(sortChampionFamily);
    const mapping = poro ? poroMapping(poro, setCode) : null;
    const unleashedGroups = mapping ? [
      {
        key: 'poro',
        label: mapping.poro,
        caption: 'Every printing pulled',
        role: 'poro',
        cards: family.filter(card => String(card.name || '').split(',')[0].trim().toLowerCase() === mapping.poro.toLowerCase())
      },
      {
        key: 'mapped',
        label: mapping.mappedCard,
        caption: 'Every rarity and treatment pulled',
        role: 'mapped',
        cards: family.filter(card => String(card.name || '').split(',')[0].trim().toLowerCase() === mapping.mappedCard.toLowerCase())
      },
      {
        key: 'rune',
        label: `${mapping.color} Showcase Rune`,
        caption: `${mapping.rune} · matching color Rune`,
        role: 'rune',
        cards: family.filter(card => String(card.name || '').split(',')[0].trim().toLowerCase() === mapping.rune.toLowerCase())
      },
      {
        key: 'rare-color',
        label: `Rare + Epic ${mapping.domain} Cards`,
        caption: 'Rare/Epic units, spells & gear · purchased champion families stay with champion spots · Common/Uncommon hidden',
        role: 'rare-color',
        cards: family.filter(card => isUnleashedRareColorCard(card, mapping, 'UNL'))
      }
    ] : [];
    const baronGroups = baron ? [{
      key: 'baron',
      label: 'Baron Nashor',
      caption: 'Standalone Baron spot · every Baron Nashor printing pulled',
      role: 'baron',
      cards: family.filter(card => cardBelongsToBaron(card, 'UNL'))
    }] : [];
    const originsGroups = originsSpot ? [
      {
        key: 'seal',
        label: originsSpot.seal,
        caption: `${originsSpot.color} ${originsSpot.domain} Seal · primary chase`,
        role: 'seal',
        cards: family.filter(card => String(card.name || '').split(',')[0].trim().toLowerCase() === originsSpot.seal.toLowerCase())
      },
      {
        key: 'rune',
        label: `${originsSpot.rune} AA`,
        caption: `${originsSpot.color} Alternate-Art Rune · booster printing only`,
        role: 'rune',
        cards: family.filter(card => String(card.name || '').split(',')[0].trim().toLowerCase() === originsSpot.rune.toLowerCase())
      },
      {
        key: 'rare-epic-color',
        label: `Rare + Epic ${originsSpot.domain} Cards`,
        caption: 'Units, spells, gear & side Champion Units · featured champion families stay with champion spots · Common/Uncommon excluded',
        role: 'rare-color',
        cards: family.filter(card => isOriginsRareEpicDomainCard(card, originsSpot))
      }
    ] : [];
    const vendettaGroups = vendettaSpot ? [
      ...vendettaSpot.champions.map(member => ({
        key: `champion-${member}`,
        label: member,
        caption: 'Every matching printing pulled',
        role: 'champion',
        cards: family.filter(card => cardBelongsToChampion(card, member, 'VEN'))
      })),
      ...(vendettaSpot.rune ? [{
        key: 'rune',
        label: `${vendettaSpot.color} Showcase Rune`,
        caption: `${vendettaSpot.rune} · Showcase Foil chase`,
        role: 'rune',
        cards: family.filter(card => String(card.name || '').split(',')[0].trim().toLowerCase() === vendettaSpot.rune.toLowerCase())
      }] : []),
      ...(vendettaSpot.extras.length ? [{
        key: 'chases',
        label: 'Paired Chase Cards',
        caption: vendettaSpot.extras.join(' + '),
        role: 'mapped',
        cards: family.filter(card => vendettaSpot.extras.some(name => String(card.name || '').split(',')[0].trim().toLowerCase() === name.toLowerCase()))
      }] : []),
      ...(vendettaSpot.color ? [{
        key: 'rare-color',
        label: `Rare ${vendettaSpot.domain} Cards`,
        caption: 'Rare units, spells, gear & more · Common/Uncommon hidden',
        role: 'rare-color',
        cards: family.filter(card => isVendettaRareColorCard(card, vendettaSpot, 'VEN'))
      }] : [])
    ] : [];
    const spiritforgedGroups = spiritforgedSpot
      ? spiritforgedSpot.kind === 'champion'
        ? (() => {
          const sameChampion = String(spiritforgedSpot.signatureChampion).toLowerCase() === String(spiritforgedSpot.champion).toLowerCase();
          const signatureCards = family.filter(card => {
            if (!sameChampion) return cardBelongsToChampion(card, spiritforgedSpot.signatureChampion, 'SFD');
            const treatment = String(card.collector_treatment || card.variant || card.manual_category || '').trim().toUpperCase();
            return treatment === 'SIGNATURE' || String(card.name || '').trim().toLowerCase() === spiritforgedSpot.signatureCard.toLowerCase();
          });
          const signatureIds = new Set(signatureCards.map(card => Number(card.id)));
          const championCards = family.filter(card => sameChampion
            ? !signatureIds.has(Number(card.id))
            : cardBelongsToChampion(card, spiritforgedSpot.champion, 'SFD'));
          return [
            { key: 'signature', label: `${spiritforgedSpot.signatureChampion} Signature`, caption: 'Signature champion · every matching printing', role: 'signature', cards: signatureCards },
            { key: 'champion', label: spiritforgedSpot.champion, caption: 'Paired champion · every matching printing', role: 'champion', cards: championCards }
          ];
        })()
        : [
          { key: 'seal', label: spiritforgedSpot.seal, caption: `${spiritforgedSpot.color} Seal chase`, role: 'seal', cards: family.filter(card => String(card.name || '').trim().toLowerCase() === spiritforgedSpot.seal.toLowerCase()) },
          { key: 'rune', label: `${spiritforgedSpot.rune} Showcase`, caption: `${spiritforgedSpot.color} Showcase Rune`, role: 'rune', cards: family.filter(card => String(card.name || '').trim().toLowerCase() === spiritforgedSpot.rune.toLowerCase()) },
          { key: 'rare-color', label: `Rare + Epic ${spiritforgedSpot.domain} Cards`, caption: 'Rare/Epic units, spells, gear & unpaired Rare Champion Units · mapped Signature-pair champions stay in their champion spots · Common/Uncommon hidden', role: 'rare-color', cards: family.filter(card => isSpiritforgedRareColorCard(card, spiritforgedSpot, 'SFD')) }
        ]
      : [];
    return {
      position: Number(spotRow.position),
      buyer: String(spotRow.buyer_name || ''),
      champion,
      baron,
      poro,
      spotType: originsSpot
        ? 'ORIGINS_COLOR'
        : spiritforgedSpot
          ? (spiritforgedSpot.kind === 'color' ? 'SPIRITFORGED_COLOR' : 'SPIRITFORGED_PAIR')
          : vendettaSpot
            ? (vendettaSpot.color ? 'VENDETTA_COLOR' : 'VENDETTA_PAIR')
            : champion ? 'CHAMPION' : (baron ? 'BARON' : (poro ? 'PORO' : 'CHAMPION')),
      color: mapping?.color || originsSpot?.color || vendettaSpot?.color || spiritforgedSpot?.color || '',
      domain: mapping?.domain || originsSpot?.domain || vendettaSpot?.domain || spiritforgedSpot?.domain || '',
      mappedCardName: mapping?.mappedCard || '',
      runeName: mapping?.rune || originsSpot?.rune || vendettaSpot?.rune || spiritforgedSpot?.rune || '',
      champions: vendettaSpot?.champions || (spiritforgedSpot?.kind === 'champion' ? [spiritforgedSpot.signatureChampion, spiritforgedSpot.champion] : []),
      extras: vendettaSpot?.extras || [],
      spotLabel: originsSpot ? originsSpotLabel(originsSpot) : (vendettaSpot ? vendettaSpotLabel(vendettaSpot) : (spiritforgedSpot ? spiritforgedSpotLabel(spiritforgedSpot) : '')),
      bundleGroups: unleashedGroups.length ? unleashedGroups : (baronGroups.length ? baronGroups : (originsGroups.length ? originsGroups : (spiritforgedGroups.length ? spiritforgedGroups : vendettaGroups))),
      bundleKind: mapping ? 'unleashed-color' : (baron ? 'unleashed-baron' : (originsSpot ? 'origins-color' : (spiritforgedSpot?.kind || ''))),
      setCode,
      spotCard: forRenderer(spotRow),
      family
    };
  }).filter(Boolean);
}

function requiredPendingBreakRound(value) {
  const roundId = Number(value?.roundId ?? value?.id ?? value);
  if (!Number.isInteger(roundId) || roundId < 1) throw new Error('Choose a pending break first.');
  const round = database.prepare("SELECT * FROM break_rounds WHERE id = ? AND status = 'PENDING_REVIEW'").get(roundId);
  if (!round) throw new Error('That break is no longer pending review. Refresh the Breaker Center.');
  return round;
}

function listPendingBreakRounds() {
  const rounds = database.prepare(`
    SELECT id, round_key, sequence, display_name, game_code, set_code, set_name,
      mapping_mode, ledger_saved_at, status, created_at, pending_at
    FROM break_rounds
    WHERE status = 'PENDING_REVIEW'
    ORDER BY sequence DESC
  `).all();
  const listCards = database.prepare(`
    SELECT c.*, b.position, b.status AS block_status, b.buyer_name, b.called_at,
      b.message_marked, b.tracker_marked, b.sale_amount_cents
    FROM break_round_cards b
    JOIN cards c ON c.id = b.card_id
    WHERE b.round_id = ?
    ORDER BY b.position ASC
  `);
  const listAssignedRiftbound = database.prepare(`
    SELECT c.*, b.position, b.status AS block_status, b.buyer_name
    FROM break_round_cards b
    JOIN cards c ON c.id = b.card_id
    WHERE b.round_id = ? AND b.status = 'called'
      AND TRIM(b.buyer_name) != ''
      AND UPPER(TRIM(COALESCE(c.game_code, ''))) = ?
    ORDER BY b.position ASC
  `);
  const listRoundRiftboundBoard = database.prepare(`
    SELECT c.*, b.position, b.status AS block_status, b.buyer_name
    FROM break_round_cards b
    JOIN cards c ON c.id = b.card_id
    WHERE b.round_id = ? AND UPPER(TRIM(COALESCE(c.game_code, ''))) = ?
    ORDER BY b.position ASC
  `);
  const listSelected = database.prepare(`
    SELECT position, card_id, quantity
    FROM break_round_pulls
    WHERE round_id = ?
  `);
  return rounds.map(round => {
    const assignedRiftbound = listAssignedRiftbound.all(round.id, RIFTBOUND_GAME_CODE);
    const roundRiftboundBoard = listRoundRiftboundBoard.all(round.id, RIFTBOUND_GAME_CODE);
    const mappingMode = breakRoundMappingMode(round, roundRiftboundBoard);
    const customMapping = mappingMode === BREAK_BOARD_MAPPING_MODES.MAPPED
      ? loadRoundCustomMapping(database, round.id)
      : null;
    const rawCards = listCards.all(round.id).map(forRenderer);
    const decoratedCards = mappingMode === BREAK_BOARD_MAPPING_MODES.SINGLES
      ? decorateSinglesForPreset(rawCards, matchingPresetSlotForRows(rawCards))
      : decorateUnleashedExpandedBreakBoard(
        decorateSpiritforgedExpandedBreakBoard(
          decorateUnleashedCaseBreakBoard(decorateUnleashedTop80Board(decorateUnleashedColorBreakBoard(rawCards)))
        )
      );
    const cards = decorateBoardWithCustomMapping(decoratedCards, customMapping);
    const audit = (mappingMode === BREAK_BOARD_MAPPING_MODES.SINGLES
      ? buildRiftboundSinglesAudit(assignedRiftbound, listSelected.all(round.id))
      : customMapping?.spots?.length
        ? buildCustomMappingAudit(assignedRiftbound, listSelected.all(round.id), customMapping)
        : buildDefaultRiftboundMappedAudit(roundRiftboundBoard, assignedRiftbound, listSelected.all(round.id)))
      .map(entry => ({ ...entry, roundId: Number(round.id) }));
    const assigned = cards.filter(card => card.block_status === 'called' && String(card.buyer_name || '').trim());
    const selectedDirect = assigned.filter(card => Number(card.message_marked)).length;
    const selectedAudit = audit.reduce((total, entry) => total + entry.family.reduce((sum, card) => sum + Number(card.audit_quantity || 0), 0), 0);
    return {
      id: Number(round.id),
      roundKey: round.round_key,
      sequence: Number(round.sequence),
      displayName: round.display_name,
      gameCode: round.game_code,
      setCode: round.set_code,
      setName: round.set_name,
      ledgerSavedAt: round.ledger_saved_at,
      status: round.status,
      createdAt: round.created_at,
      pendingAt: round.pending_at,
      mappingMode,
      assignedCount: assigned.length,
      selectedPullCount: selectedDirect + selectedAudit,
      capturedSpendCents: assigned.reduce((total, card) => total + Math.max(0, Number(card.sale_amount_cents || 0)), 0),
      cards,
      audit
    };
  });
}

function removePendingRoundAssignment(payload = {}) {
  const round = requiredPendingBreakRound(payload);
  const position = leadingBlockNumber(payload.position);
  if (!position) throw new Error('Choose a valid pending spot to remove.');
  const card = pendingRoundCard(round.id, position);
  if (!card || card.block_status !== 'called' || !String(card.buyer_name || '').trim()) {
    throw new Error(`Spot ${position} is not an assigned spot in this pending review.`);
  }
  const buyer = String(card.buyer_name || '').trim();
  let remainingAssignments = 0;
  let roundDeleted = false;
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare('DELETE FROM break_round_pulls WHERE round_id = ? AND position = ?').run(round.id, position);
    const removed = database.prepare(`
      UPDATE break_round_cards
      SET status = 'ready', buyer_name = '', called_at = NULL,
        message_marked = 0, tracker_marked = 0, sale_amount_cents = 0
      WHERE round_id = ? AND position = ? AND status = 'called'
    `).run(round.id, position);
    if (removed.changes !== 1) throw new Error('That pending spot changed before it could be removed. Refresh and try again.');
    remainingAssignments = Number(database.prepare(`
      SELECT COUNT(*) AS count FROM break_round_cards
      WHERE round_id = ? AND status = 'called' AND TRIM(buyer_name) != ''
    `).get(round.id)?.count || 0);
    if (!remainingAssignments) {
      database.prepare("DELETE FROM break_rounds WHERE id = ? AND status = 'PENDING_REVIEW'").run(round.id);
      roundDeleted = true;
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return {
    roundId: Number(round.id),
    position,
    buyer,
    removed: true,
    remainingAssignments,
    roundDeleted
  };
}

function discardPendingBreakRound(payload = {}) {
  const round = requiredPendingBreakRound(payload);
  database.exec('BEGIN IMMEDIATE');
  try {
    const removed = database.prepare("DELETE FROM break_rounds WHERE id = ? AND status = 'PENDING_REVIEW'").run(round.id);
    if (removed.changes !== 1) throw new Error('That pending review changed before it could be discarded. Refresh and try again.');
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return { roundId: Number(round.id), displayName: round.display_name, discarded: true };
}

function pendingRoundCard(roundId, position) {
  const card = database.prepare(`
    SELECT c.*, b.position, b.status AS block_status, b.buyer_name, b.called_at,
      b.message_marked, b.tracker_marked, b.sale_amount_cents
    FROM break_round_cards b
    JOIN cards c ON c.id = b.card_id
    WHERE b.round_id = ? AND b.position = ?
  `).get(roundId, position);
  return card ? forRenderer(card) : null;
}

function setPendingRoundMessageCardMarked(payload = {}) {
  const round = requiredPendingBreakRound(payload);
  const position = leadingBlockNumber(payload.position);
  const card = pendingRoundCard(round.id, position);
  if (!card || card.block_status !== 'called') throw new Error(`Spot ${position || '?'} is not in this pending Buyer Bag.`);
  database.prepare(`
    UPDATE break_round_cards SET message_marked = ?
    WHERE round_id = ? AND position = ? AND status = 'called'
  `).run(payload.marked ? 1 : 0, round.id, position);
  return pendingRoundCard(round.id, position);
}

function setPendingRoundPullQuantity(payload = {}) {
  const round = requiredPendingBreakRound(payload);
  const position = leadingBlockNumber(payload.position);
  const cardId = Number(payload.cardId);
  const quantity = Math.max(0, Math.min(99, Math.floor(Number(payload.quantity) || 0)));
  if (!position || !Number.isInteger(cardId) || cardId < 1) throw new Error('Choose a valid pending pull.');
  const spot = pendingRoundCard(round.id, position);
  if (!spot || spot.block_status !== 'called' || String(spot.game_code || '').toUpperCase() !== RIFTBOUND_GAME_CODE) {
    throw new Error(`Spot ${position} is not in this pending Riftbound Buyer Bag.`);
  }
  const champion = championFromSpot(spot);
  const baron = baronFromSpot(spot);
  const poro = poroFromSpot(spot);
  const originsSpot = originsSpotFromCard(spot);
  const vendettaSpot = vendettaSpotFromCard(spot);
  const spiritforgedSpot = spiritforgedSpotFromCard(spot);
  const card = database.prepare('SELECT * FROM cards WHERE id = ?').get(cardId);
  const roundRiftboundBoard = database.prepare(`
    SELECT c.*, b.position, b.status AS block_status, b.buyer_name
    FROM break_round_cards b JOIN cards c ON c.id = b.card_id
    WHERE b.round_id = ? AND UPPER(TRIM(COALESCE(c.game_code, ''))) = ?
  `).all(round.id, RIFTBOUND_GAME_CODE);
  const mappingMode = breakRoundMappingMode(round, roundRiftboundBoard);
  const customMapping = mappingMode === BREAK_BOARD_MAPPING_MODES.MAPPED
    ? loadRoundCustomMapping(database, round.id)
    : null;
  const customSpot = customMapping?.spots?.find(entry => Number(entry.position) === position) || null;
  const singlesSpot = mappingMode === BREAK_BOARD_MAPPING_MODES.SINGLES
    ? buildRiftboundSingleSpot(spot)
    : null;
  const spiritforgedExpandedProfile = !singlesSpot ? spiritforgedExpandedProfileForBoard(roundRiftboundBoard) : null;
  const spiritforgedExpandedSpot = spiritforgedExpandedProfile
    ? buildSpiritforgedExpandedBreakSpot(spiritforgedExpandedCatalog(), spot, spiritforgedExpandedProfile)
    : null;
  const unleashedExpandedSpot = !singlesSpot && !spiritforgedExpandedSpot && isUnleashedExpandedBreakBoard(roundRiftboundBoard)
    ? buildUnleashedExpandedBreakSpot(unleashedTop80Catalog(), spot)
    : null;
  const caseSpot = !singlesSpot && !spiritforgedExpandedSpot && !unleashedExpandedSpot && isUnleashedCaseBreakBoard(roundRiftboundBoard)
    ? buildUnleashedCaseBreakSpot(unleashedTop80Catalog(), spot)
    : null;
  const top80Spot = !singlesSpot && !unleashedExpandedSpot && !caseSpot && isUnleashedTop80Board(roundRiftboundBoard)
    ? buildUnleashedTop80Spot(unleashedTop80Catalog(), spot)
    : null;
  const legacyColorSpot = !unleashedExpandedSpot && !caseSpot && !top80Spot && isUnleashedColorBreakBoard(roundRiftboundBoard)
    ? buildUnleashedColorBreakSpot(unleashedTop80Catalog(), spot)
    : null;
  const comboSpot = !unleashedExpandedSpot && !caseSpot && !top80Spot && !legacyColorSpot && riftboundComboBoardDetected(roundRiftboundBoard)
    ? buildVisualSpot(riftboundComboCatalog(), spot)
    : null;
  const profileSpot = customSpot
    ? { family: customSpot.cards || [], displayLabel: customMappingSpotDisplayLabel(customSpot) }
    : singlesSpot || spiritforgedExpandedSpot || unleashedExpandedSpot || caseSpot || top80Spot || legacyColorSpot || comboSpot;
  const belongs = card && (profileSpot
    ? profileSpot.family.some(member => Number(member.id) === cardId)
    : vendettaSpot
      ? cardBelongsToVendettaSpot(card, vendettaSpot, spot.set_code)
      : champion
        ? cardBelongsToChampion(card, champion, spot.set_code)
        : baron
        ? cardBelongsToBaron(card, spot.set_code)
        : poro
          ? cardBelongsToPoroSpot(card, poro, spot.set_code)
          : originsSpot
            ? cardBelongsToOriginsSpot(card, originsSpot, spot.set_code)
            : spiritforgedSpot && cardBelongsToSpiritforgedSpot(card, spiritforgedSpot, spot.set_code));
  if (!belongs) throw new Error('That card does not belong to this pending Riftbound spot.');
  if (!quantity) {
    database.prepare('DELETE FROM break_round_pulls WHERE round_id = ? AND position = ? AND card_id = ?').run(round.id, position, cardId);
  } else {
    database.prepare(`
      INSERT INTO break_round_pulls (round_id, position, card_id, quantity, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(round_id, position, card_id) DO UPDATE SET
        quantity = excluded.quantity, updated_at = excluded.updated_at
    `).run(round.id, position, cardId, quantity, new Date().toISOString());
  }
  return { roundId: Number(round.id), position, cardId, quantity };
}

function clearPendingRoundBuyerPulls(payload = {}) {
  const round = requiredPendingBreakRound(payload);
  const buyer = String(payload.buyer || '').trim().replace(/^@+/, '');
  if (!buyer) throw new Error('Choose a pending Buyer Bag first.');
  const buyerKey = comparableBuyerName(buyer);
  const audit = database.prepare(`
    DELETE FROM break_round_pulls
    WHERE round_id = ? AND position IN (
      SELECT position FROM break_round_cards
      WHERE round_id = ? AND status = 'called'
        AND LOWER(TRIM(REPLACE(buyer_name, '@', ''))) = ?
    )
  `).run(round.id, round.id, buyerKey);
  const direct = database.prepare(`
    UPDATE break_round_cards SET message_marked = 0
    WHERE round_id = ? AND status = 'called'
      AND LOWER(TRIM(REPLACE(buyer_name, '@', ''))) = ?
      AND message_marked != 0
  `).run(round.id, buyerKey);
  return { roundId: Number(round.id), buyer, clearedCards: audit.changes + direct.changes };
}

function pendingRoundSelectedPulls(roundId, buyerKey = '') {
  const buyerFilter = buyerKey ? " AND LOWER(TRIM(REPLACE(b.buyer_name, '@', ''))) = ?" : '';
  const params = buyerKey ? [roundId, buyerKey] : [roundId];
  const direct = database.prepare(`
    SELECT c.*, b.position, b.buyer_name, 1 AS quantity, 'selected' AS source_kind
    FROM break_round_cards b
    JOIN cards c ON c.id = b.card_id
    WHERE b.round_id = ? AND b.status = 'called' AND TRIM(b.buyer_name) != ''
      AND b.message_marked = 1${buyerFilter}
    ORDER BY b.position ASC
  `).all(...params);
  const audited = database.prepare(`
    SELECT c.*, p.position, b.buyer_name, p.quantity, 'audit' AS source_kind
    FROM break_round_pulls p
    JOIN break_round_cards b ON b.round_id = p.round_id AND b.position = p.position
    JOIN cards c ON c.id = p.card_id
    WHERE p.round_id = ? AND b.status = 'called' AND TRIM(b.buyer_name) != ''${buyerFilter}
    ORDER BY p.position ASC, c.card_number ASC, c.name ASC
  `).all(...params);
  return [...direct, ...audited].map(pullHistorySnapshotItem);
}

function copyPendingRoundBuyerPulls(payload = {}) {
  const round = requiredPendingBreakRound(payload);
  const buyer = String(payload.buyer || '').trim().replace(/^@+/, '');
  if (!buyer) throw new Error('Choose a pending Buyer Bag first.');
  const recordedCards = pendingRoundSelectedPulls(round.id, comparableBuyerName(buyer));
  if (!recordedCards.length) throw new Error(`Record at least one actual pull for @${buyer} first.`);
  const cards = topHitsOnly(recordedCards);
  if (!cards.length) throw new Error(`No Alternate Art-or-higher hits are recorded for @${buyer}. Epics and lower stay recorded but are not copied.`);
  const list = cards.map(card => {
    const treatment = String(card.collectorTreatment || '').trim();
    const setCode = String(card.setCode || card.set_code || '').trim().toUpperCase();
    const cardNumber = String(card.cardNumber || card.card_number || '').trim();
    const reference = cardNumber
      ? (/^[A-Z0-9]+-/i.test(cardNumber) ? cardNumber : [setCode, cardNumber].filter(Boolean).join(' '))
      : setCode;
    const identity = [card.cardName, treatment || card.rarity || 'Riftbound Card', reference].filter(Boolean).join(' — ');
    return `• ${identity}${Number(card.quantity) > 1 ? ` ×${card.quantity}` : ''}`;
  }).join('\n');
  const message = `Hi @${buyer},\n\nThank you for stopping by! Here are your top hits:\n\n${list}\n\nI truly appreciate your support!\n\n⭐⭐⭐⭐⭐`;
  clipboard.writeText(message);
  return { roundId: Number(round.id), buyer, copiedCards: cards.reduce((total, card) => total + Number(card.quantity || 1), 0), message };
}

function completeAndArchiveBreakRound(payload = {}) {
  const round = requiredPendingBreakRound(payload);
  const disposition = normalizeBreakDisposition(payload.disposition);
  const dispositionName = dispositionLabel(disposition);
  const breakNameForVoid = normalizeHistoryBreakName(payload.breakName, round.display_name || 'Test / Void');
  if (disposition === 'TEST_VOID') {
    database.exec('BEGIN IMMEDIATE');
    try {
      database.prepare("DELETE FROM break_rounds WHERE id = ? AND status = 'PENDING_REVIEW'").run(round.id);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return { roundId: Number(round.id), breakName: breakNameForVoid, disposition, dispositionLabel: dispositionName, voided: true, confirmedOrderCount: 0, selectedPullCount: 0 };
  }
  const trackerDestinationMode = normalizeTrackerDestinationMode(payload.trackerDestinationMode);
  const trackerRecordType = trackerDestinationMode === TRACKER_DESTINATION_MODES.OPEN_CASE
    ? 'BOX'
    : requireTrackerRecordType(payload.trackerRecordType);
  const assigned = database.prepare(`
    SELECT b.position, b.buyer_name, b.called_at, b.sale_amount_cents,
      c.name AS card_name, c.card_number, c.set_code, c.rarity, c.variant,
      c.manual_category
    FROM break_round_cards b
    JOIN cards c ON c.id = b.card_id
    WHERE b.round_id = ? AND b.status = 'called' AND TRIM(b.buyer_name) != ''
    ORDER BY b.position ASC
  `).all(round.id).map(row => ({ ...row, rarity: breakRarityForCard(row) || row.rarity || '' }));
  if (!assigned.length) throw new Error('This pending break has no confirmed Assigned spots to archive.');
  const pulls = pendingRoundSelectedPulls(round.id);
  if (!pulls.length && disposition === 'NORMAL_BREAK') throw new Error('Select the exact cards in this pending Buyer Bag before Complete & Archive.');

  const recordedAt = new Date().toISOString();
  const boxCostCents = currencyToCents(payload.boxCost);
  const rawTotals = orderHistoryTotals(assigned);
  const zeroRevenue = disposition !== 'NORMAL_BREAK';
  const totals = zeroRevenue ? {
    confirmedOrderCount: rawTotals.confirmedOrderCount,
    pricedOrderCount: 0,
    unpricedOrderCount: 0,
    grossSalesCents: 0
  } : rawTotals;
  const whatnotFees = zeroRevenue ? {
    commissionBasisPoints: 0,
    processingBasisPoints: 0,
    transactionFeeCents: 0,
    transactionCount: 0,
    feeTaxBasisPoints: 0,
    additionalFeeCents: 0,
    actualFeeCents: 0
  } : normalizeWhatnotFees(payload);
  const breakName = normalizeHistoryBreakName(payload.breakName, round.display_name || historyDefaultBreakName(assigned));
  const notes = normalizeHistoryNotes(payload.notes);
  const pullSetCodes = [...new Set(pulls.map(item => String(item.setCode || '').trim().toUpperCase()).filter(Boolean))];
  const pullSetCode = pullSetCodes.length === 1 ? pullSetCodes[0] : (pullSetCodes.length ? 'MULTI' : '');
  let historyId = 0;
  let pullHistoryBatchId = 0;
  let tracker = null;
  const pullMarketKey = item => [
    comparableBuyerName(item.buyerName || item.buyer_name),
    Number(item.position || 0),
    String(item.setCode || item.set_code || '').trim().toUpperCase(),
    String(item.cardNumber || item.card_number || '').trim().toUpperCase(),
    String(item.cardName || item.card_name || '').trim().toUpperCase(),
    String(item.rarity || '').trim().toUpperCase(),
    String(item.collectorTreatment || item.collector_treatment || '').trim().toUpperCase()
  ].join('|');

  database.exec('BEGIN IMMEDIATE');
  try {
    // If the breaker already used the older Save Selected Pulls button before
    // starting the next box, update that same Pull History batch instead of
    // creating a duplicate. Its saved market matches are retained by key.
    const existingBatch = database.prepare(`
      SELECT id FROM pull_history_batches
      WHERE ledger_saved_at IN (?, ?)
      ORDER BY CASE WHEN ledger_saved_at = ? THEN 0 ELSE 1 END
      LIMIT 1
    `).get(`round:${round.round_key}`, round.ledger_saved_at, `round:${round.round_key}`);
    if (existingBatch) {
      pullHistoryBatchId = Number(existingBatch.id);
      database.prepare(`
        UPDATE pull_history_batches
        SET game_code = ?, set_code = ?, set_name = ?, recorded_at = ?
        WHERE id = ?
      `).run(round.game_code, pullSetCode, round.set_name || '', recordedAt, pullHistoryBatchId);
    } else {
      const batch = database.prepare(`
        INSERT INTO pull_history_batches (
          ledger_saved_at, game_code, set_code, set_name, recorded_at
        ) VALUES (?, ?, ?, ?, ?)
      `).run(`round:${round.round_key}`, round.game_code, pullSetCode, round.set_name || '', recordedAt);
      pullHistoryBatchId = Number(batch.lastInsertRowid);
    }
    const savedMarkets = new Map(database.prepare(`
      SELECT buyer_name, position, card_name, card_number, set_code, rarity,
        collector_treatment, market_price_cents, market_source, market_variant,
        market_external_id, market_updated_at, market_match_status
      FROM pull_history_items WHERE batch_id = ?
    `).all(pullHistoryBatchId).map(item => [pullMarketKey(item), item]));
    database.prepare('DELETE FROM pull_history_items WHERE batch_id = ?').run(pullHistoryBatchId);
    database.prepare('DELETE FROM pull_history_spots WHERE batch_id = ?').run(pullHistoryBatchId);
    const insertPullHistoryItem = database.prepare(`
      INSERT INTO pull_history_items (
        batch_id, buyer_name, position, card_name, card_number, set_code,
        rarity, collector_treatment, variant_hint, quantity, source_kind,
        market_price_cents, market_source, market_variant, market_external_id,
        market_updated_at, market_match_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    pulls.forEach(item => {
      const market = savedMarkets.get(pullMarketKey(item)) || {
        market_price_cents: item.marketPriceCents,
        market_source: item.marketSource,
        market_variant: item.marketVariant,
        market_external_id: item.marketExternalId,
        market_updated_at: item.marketUpdatedAt,
        market_match_status: item.marketMatchStatus
      };
      insertPullHistoryItem.run(
        pullHistoryBatchId, item.buyerName, item.position, item.cardName,
        item.cardNumber, item.setCode, item.rarity, item.collectorTreatment,
        item.variantHint, item.quantity, item.sourceKind,
        market.market_price_cents ?? null, market.market_source || '',
        market.market_variant || '', market.market_external_id || '',
        market.market_updated_at || null, market.market_match_status || ''
      );
    });
    const cachedPriceRefreshedAt = pulls
      .map(item => item.marketUpdatedAt)
      .filter(Boolean)
      .sort()
      .at(-1) || null;
    if (cachedPriceRefreshedAt) {
      database.prepare(`
        UPDATE pull_history_batches
        SET price_refreshed_at = CASE
          WHEN price_refreshed_at IS NULL OR price_refreshed_at < ? THEN ?
          ELSE price_refreshed_at
        END
        WHERE id = ?
      `).run(cachedPriceRefreshedAt, cachedPriceRefreshedAt, pullHistoryBatchId);
    }
    const insertSpot = database.prepare(`
      INSERT INTO pull_history_spots (batch_id, buyer_name, position, paid_cents)
      VALUES (?, ?, ?, ?)
    `);
    assigned.forEach(item => insertSpot.run(
      pullHistoryBatchId, String(item.buyer_name || '').trim(), Number(item.position), disposition === 'NORMAL_BREAK' ? Math.max(0, Number(item.sale_amount_cents || 0)) : 0
    ));

    const history = database.prepare(`
      INSERT INTO break_order_history (
        break_name, box_cost_cents, gross_sales_cents, priced_order_count,
        unpriced_order_count, confirmed_order_count,
        whatnot_commission_bps, whatnot_processing_bps,
        whatnot_transaction_fee_cents, whatnot_transaction_count,
        whatnot_fee_tax_bps, whatnot_additional_fee_cents,
        whatnot_actual_fee_cents, notes, disposition, pull_history_batch_id, pull_history_link_verified, recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      breakName, boxCostCents, totals.grossSalesCents, totals.pricedOrderCount,
      totals.unpricedOrderCount, totals.confirmedOrderCount,
      whatnotFees.commissionBasisPoints, whatnotFees.processingBasisPoints,
      whatnotFees.transactionFeeCents, whatnotFees.transactionCount,
      whatnotFees.feeTaxBasisPoints, whatnotFees.additionalFeeCents,
      whatnotFees.actualFeeCents, notes, disposition, pullHistoryBatchId || null, 1, recordedAt
    );
    historyId = Number(history.lastInsertRowid);
    const insertHistoryItem = database.prepare(`
      INSERT INTO break_order_history_items (
        history_id, position, buyer_name, card_name, card_number, set_code,
        rarity, sale_amount_cents, assigned_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    assigned.forEach(item => insertHistoryItem.run(
      historyId, item.position, String(item.buyer_name || '').trim(), item.card_name,
      item.card_number || '', item.set_code || '', item.rarity || '',
      disposition === 'NORMAL_BREAK' ? Math.max(0, Number(item.sale_amount_cents || 0)) : 0, item.called_at || null
    ));
    const insertHistoryPull = database.prepare(`
      INSERT INTO break_order_history_pulls (
        history_id, buyer_name, position, card_name, card_number, set_code,
        rarity, collector_treatment, variant_hint, quantity, source_kind
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    pulls.forEach(item => insertHistoryPull.run(
      historyId, item.buyerName, item.position, item.cardName, item.cardNumber,
      item.setCode, item.rarity, item.collectorTreatment, item.variantHint,
      item.quantity, item.sourceKind
    ));
    const trackerPayload = {
      historyId,
      pullHistoryBatchId,
      recordType: trackerRecordType,
      breakName,
      recordedAt,
      gameCode: round.game_code,
      setCode: round.set_code || pullSetCode,
      setName: round.set_name,
      pulls,
      assigned
    };
    const trackerOptions = {
      setActiveTracker: trackerId => setMetadata(ACTIVE_TRACKER_KEY, String(trackerId))
    };
    tracker = trackerDestinationMode === TRACKER_DESTINATION_MODES.OPEN_CASE
      ? syncOpenCaseBoxFromHistory(database, {
        ...trackerPayload,
        openCaseId: payload.openCaseId
      }, {
        ...trackerOptions,
        setActiveOpenCase: trackerId => setMetadata(ACTIVE_OPEN_CASE_KEY, String(trackerId))
      })
      : syncAutomaticBoxTrackerFromHistory(database, trackerPayload, trackerOptions);
    const completed = database.prepare(`
      UPDATE break_rounds
      SET status = 'COMPLETED', completed_at = ?, order_history_id = ?, pull_history_batch_id = ?
      WHERE id = ? AND status = 'PENDING_REVIEW'
    `).run(recordedAt, historyId, pullHistoryBatchId, round.id);
    if (completed.changes !== 1) throw new Error('This pending break changed while it was being archived. Nothing was saved.');
    // The immutable Orders/Pull History snapshots now own the completed data.
    // Remove the working review rows so a later catalog reset is never blocked
    // by a box that has already been fully archived.
    database.prepare('DELETE FROM break_round_cards WHERE round_id = ?').run(round.id);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  invalidateOrderHitTracker();
  return {
    roundId: Number(round.id),
    historyId,
    pullHistoryBatchId,
    tracker,
    breakName,
    boxCostCents,
    disposition,
    dispositionLabel: dispositionName,
    selectedPullCount: pulls.reduce((total, item) => total + Math.max(1, Number(item.quantity || 1)), 0),
    ...totals,
    whatnotFees: whatnotFeeBreakdown({
      grossSalesCents: totals.grossSalesCents,
      boxCostCents,
      pricedOrderCount: totals.pricedOrderCount,
      ...whatnotFees
    }),
    recordedAt
  };
}

function setRiftboundChampionPullQuantity(payload = {}) {
  const position = leadingBlockNumber(payload.position);
  const cardId = Number(payload.cardId);
  const quantity = Math.max(0, Math.min(99, Math.floor(Number(payload.quantity) || 0)));
  if (!position || !Number.isInteger(cardId) || cardId <= 0) throw new Error('Choose a valid champion pull.');
  const spot = cardForActivePosition(position);
  if (!spot || spot.block_status === 'ready' || String(spot.game_code || '').toUpperCase() !== RIFTBOUND_GAME_CODE) {
    throw new Error(`Spot ${position} is not in a Riftbound Buyer Bag.`);
  }
  const champion = championFromSpot(spot);
  const baron = baronFromSpot(spot);
  const poro = poroFromSpot(spot);
  const originsSpot = originsSpotFromCard(spot);
  const vendettaSpot = vendettaSpotFromCard(spot);
  const spiritforgedSpot = spiritforgedSpotFromCard(spot);
  const card = database.prepare('SELECT * FROM cards WHERE id = ?').get(cardId);
  const activeRiftboundBoard = database.prepare(`
    SELECT c.*, b.position, b.status AS block_status, b.buyer_name
    FROM active_break_board_cards b JOIN cards c ON c.id = b.card_id
    WHERE UPPER(TRIM(COALESCE(c.game_code, ''))) = ?
  `).all(RIFTBOUND_GAME_CODE);
  const mappingMode = activeBreakBoardMappingMode(activeRiftboundBoard);
  const activeRound = activeBreakRound();
  const customMapping = mappingMode === BREAK_BOARD_MAPPING_MODES.MAPPED && activeRound
    ? loadRoundCustomMapping(database, activeRound.id)
    : null;
  const customSpot = customMapping?.spots?.find(entry => Number(entry.position) === position) || null;
  const singlesSpot = mappingMode === BREAK_BOARD_MAPPING_MODES.SINGLES
    ? buildRiftboundSingleSpot(spot)
    : null;
  const spiritforgedExpandedProfile = !singlesSpot ? spiritforgedExpandedProfileForBoard(activeRiftboundBoard) : null;
  const spiritforgedExpandedSpot = spiritforgedExpandedProfile
    ? buildSpiritforgedExpandedBreakSpot(spiritforgedExpandedCatalog(), spot, spiritforgedExpandedProfile)
    : null;
  const unleashedExpandedSpot = !singlesSpot && !spiritforgedExpandedSpot && isUnleashedExpandedBreakBoard(activeRiftboundBoard)
    ? buildUnleashedExpandedBreakSpot(unleashedTop80Catalog(), spot)
    : null;
  const caseSpot = !singlesSpot && !spiritforgedExpandedSpot && !unleashedExpandedSpot && isUnleashedCaseBreakBoard(activeRiftboundBoard)
    ? buildUnleashedCaseBreakSpot(unleashedTop80Catalog(), spot)
    : null;
  const top80Spot = !singlesSpot && !unleashedExpandedSpot && !caseSpot && isUnleashedTop80Board(activeRiftboundBoard)
    ? buildUnleashedTop80Spot(unleashedTop80Catalog(), spot)
    : null;
  const legacyColorSpot = !unleashedExpandedSpot && !caseSpot && !top80Spot && isUnleashedColorBreakBoard(activeRiftboundBoard)
    ? buildUnleashedColorBreakSpot(unleashedTop80Catalog(), spot)
    : null;
  const comboSpot = !unleashedExpandedSpot && !caseSpot && !top80Spot && !legacyColorSpot && riftboundComboBoardDetected(activeRiftboundBoard)
    ? buildVisualSpot(riftboundComboCatalog(), spot)
    : null;
  const profileSpot = customSpot
    ? { family: customSpot.cards || [], displayLabel: customMappingSpotDisplayLabel(customSpot) }
    : singlesSpot || spiritforgedExpandedSpot || unleashedExpandedSpot || caseSpot || top80Spot || legacyColorSpot || comboSpot;
  if (!profileSpot && !champion && !baron && !poro && !originsSpot && !vendettaSpot && !spiritforgedSpot) {
    throw new Error(`Spot ${position} is not a champion or mapped Riftbound position.`);
  }
  const belongs = card && (profileSpot
    ? profileSpot.family.some(member => Number(member.id) === cardId)
    : vendettaSpot
      ? cardBelongsToVendettaSpot(card, vendettaSpot, spot.set_code)
      : champion
        ? cardBelongsToChampion(card, champion, spot.set_code)
        : baron
        ? cardBelongsToBaron(card, spot.set_code)
        : poro
        ? cardBelongsToPoroSpot(card, poro, spot.set_code)
        : originsSpot
          ? cardBelongsToOriginsSpot(card, originsSpot, spot.set_code)
          : cardBelongsToSpiritforgedSpot(card, spiritforgedSpot, spot.set_code));
  if (!belongs) {
    const spotName = (customSpot ? customMappingSpotDisplayLabel(customSpot) : '') || singlesSpot?.displayLabel || spiritforgedExpandedSpot?.displayLabel || unleashedExpandedSpot?.displayLabel || caseSpot?.displayLabel || top80Spot?.displayLabel || legacyColorSpot?.displayLabel || (vendettaSpot ? vendettaSpotLabel(vendettaSpot) : champion || baron || poro || (originsSpot ? originsSpotLabel(originsSpot) : spiritforgedSpotLabel(spiritforgedSpot)));
    throw new Error(`That card does not belong to the ${spotName || 'mapped Riftbound'} spot.`);
  }
  if (!quantity) {
    database.prepare('DELETE FROM riftbound_champion_pull_audit WHERE position = ? AND card_id = ?').run(position, cardId);
  } else {
    database.prepare(`
      INSERT INTO riftbound_champion_pull_audit (position, card_id, quantity, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(position, card_id) DO UPDATE SET quantity = excluded.quantity, updated_at = excluded.updated_at
    `).run(position, cardId, quantity, new Date().toISOString());
  }
  return { position, cardId, quantity };
}

function clearRiftboundBuyerPullSelections(value) {
  const buyer = String(value || '').trim().replace(/^@+/, '');
  if (!buyer) throw new Error('Choose a Riftbound Buyer Bag first.');
  const buyerKey = comparableBuyerName(buyer);
  const audit = database.prepare(`
    DELETE FROM riftbound_champion_pull_audit
    WHERE position IN (
      SELECT position FROM active_break_board_cards
      WHERE status != 'ready' AND LOWER(TRIM(REPLACE(buyer_name, '@', ''))) = ?
    )
  `).run(buyerKey);
  const board = database.prepare(`
    UPDATE active_break_board_cards SET message_marked = 0
    WHERE status != 'ready' AND LOWER(TRIM(REPLACE(buyer_name, '@', ''))) = ? AND message_marked != 0
  `).run(buyerKey);
  broadcastBreakBoardChange({ keepOverlayVisuals: true });
  return { buyer, clearedCards: audit.changes + board.changes };
}

function copyRiftboundBuyerPulls(value) {
  const buyer = String(value || '').trim().replace(/^@+/, '');
  if (!buyer) throw new Error('Choose a Riftbound Buyer Bag first.');
  const buyerKey = comparableBuyerName(buyer);
  const audited = database.prepare(`
    SELECT c.*, a.position, a.quantity, s.name AS spot_name
    FROM riftbound_champion_pull_audit a
    JOIN cards c ON c.id = a.card_id
    JOIN active_break_board_cards b ON b.position = a.position
    JOIN cards s ON s.id = b.card_id
    WHERE b.status != 'ready' AND LOWER(TRIM(REPLACE(b.buyer_name, '@', ''))) = ?
    ORDER BY a.position ASC, c.card_number ASC, c.name ASC
  `).all(buyerKey).map(forRenderer);
  const direct = database.prepare(`
    SELECT c.*, b.position, 1 AS quantity, c.name AS spot_name
    FROM active_break_board_cards b
    JOIN cards c ON c.id = b.card_id
    WHERE b.status != 'ready' AND LOWER(TRIM(REPLACE(b.buyer_name, '@', ''))) = ?
      AND b.message_marked = 1
    ORDER BY b.position ASC
  `).all(buyerKey).map(forRenderer);
  const recordedCards = [...audited, ...direct];
  if (!recordedCards.length) throw new Error(`Record at least one actual Riftbound pull for @${buyer} first.`);
  const cards = topHitsOnly(recordedCards);
  if (!cards.length) throw new Error(`No Alternate Art-or-higher hits are recorded for @${buyer}. Epics and lower stay recorded but are not copied.`);
  const list = cards.map(card => {
    const treatment = String(card.manual_category || '').trim() === 'Standard' ? '' : (card.collector_treatment || card.variant || '');
    const setCode = String(card.set_code || '').trim();
    const cardNumber = String(card.card_number || '').trim();
    // Official Riftbound numbers already include their set prefix (for
    // example VEN-086/166). Do not produce the confusing `VEN VEN-086/166`.
    const reference = cardNumber
      ? (/^[A-Z0-9]+-/i.test(cardNumber) ? cardNumber : [setCode, cardNumber].filter(Boolean).join(' '))
      : setCode;
    const identity = [card.name, treatment || card.rarity || 'Riftbound Card', reference].filter(Boolean).join(' — ');
    const quantity = Number(card.quantity || 1);
    return `• ${identity}${quantity > 1 ? ` ×${quantity}` : ''}`;
  }).join('\n');
  const message = `Hi @${buyer},\n\nThank you for stopping by! Here are your top hits:\n\n${list}\n\nI truly appreciate your support!\n\n⭐⭐⭐⭐⭐`;
  clipboard.writeText(message);
  return { buyer, copiedCards: cards.reduce((total, card) => total + Number(card.quantity || 1), 0), message };
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
    const isRiftbound = String(card.game_code || '').toUpperCase() === RIFTBOUND_GAME_CODE;
    const rarity = isRiftbound
      ? (card.collector_treatment || card.break_rarity || card.rarity || 'Riftbound Card')
      : (breakRarityForCard(card) || card.rarity || 'Card');
    const setCode = String(card.set_code || '').trim().toUpperCase();
    const cardNumber = String(card.card_number || '').trim();
    const reference = isRiftbound
      ? (cardNumber ? (/^[A-Z0-9]+-/i.test(cardNumber) ? cardNumber : [setCode, cardNumber].filter(Boolean).join(' ')) : setCode)
      : '';
    const identity = [card.name, rarity, reference].filter(Boolean).join(' — ');
    return `• ${identity}`;
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

function adoptConnectorAssignments(payload) {
  if (!isLiveLedgerCurrent()) throw new Error('Save Board ✓ first so the connector has a current live ledger.');
  const assignments = Array.isArray(payload?.assignments) ? payload.assignments : [];
  const byPosition = new Map();
  assignments.forEach(assignment => {
    const position = leadingBlockNumber(connectorValueFromPayload(assignment));
    const buyer = String(assignment?.buyer || assignment?.buyerName || '').trim().replace(/^@+/, '');
    if (position && buyer) byPosition.set(position, { buyer, saleAmountCents: saleAmountCentsFromPayload(assignment) });
  });
  const receivedAt = new Date().toISOString();
  const adopt = database.prepare(`
    UPDATE active_break_board_cards
    SET status = 'called', buyer_name = ?, called_at = ?, message_marked = 0, tracker_marked = 0, sale_amount_cents = ?
    WHERE position = ? AND status = 'ready'
  `);
  const adopted = [];
  database.exec('BEGIN IMMEDIATE');
  try {
    byPosition.forEach((assignment, position) => {
      const block = cardForActivePosition(position);
      if (!block || block.block_status !== 'ready') return;
      const amountCents = normalizeSaleAmountCents(assignment.saleAmountCents);
      if (adopt.run(assignment.buyer, receivedAt, amountCents, position).changes !== 1) return;
      adopted.push({ position, cardId: block.id, cardName: block.name, buyer: assignment.buyer, saleAmountCents: amountCents });
    });
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  // Baseline adoption deliberately does not enter the overlay claim queue. These
  // are historical Whatnot rows, not live reveals.
  if (adopted.length) {
    const last = adopted.at(-1);
    connectorStatus.lastBlock = {
      position: last.position,
      cardId: last.cardId,
      cardName: last.cardName,
      source: 'Whatnot startup baseline adopted silently',
      receivedAt
    };
    broadcastBreakBoardChange({ keepOverlayVisuals: true });
  }
  return { foundCount: byPosition.size, adoptedCount: adopted.length, adoptedBlocks: adopted };
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
  const repriced = [];
  const claim = database.prepare(`
    UPDATE active_break_board_cards
    SET status = 'called', buyer_name = ?, called_at = ?, message_marked = 0, tracker_marked = 0, sale_amount_cents = ?
    WHERE position = ? AND status != 'test-called'
  `);
  const updatePrice = database.prepare(`
    UPDATE active_break_board_cards SET sale_amount_cents = ?
    WHERE position = ? AND status = 'called'
  `);
  const release = database.prepare(`
    UPDATE active_break_board_cards
    SET status = 'ready', buyer_name = '', called_at = NULL, message_marked = 0, tracker_marked = 0, sale_amount_cents = 0
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
      if (block.status === 'called' && priorBuyer === nextBuyer) {
        if (Number(block.sale_amount_cents || 0) !== amountCents && updatePrice.run(amountCents, position).changes === 1) repriced.push(position);
        // A delayed Whatnot price must not replace called_at: the pending
        // popup event uses that timestamp to find the exact live sale.
        return;
      }
      if (claim.run(assignment.buyer, receivedAt, amountCents, position).changes !== 1) return;
      const item = { position, cardId: block.id, cardName: block.name, buyer: assignment.buyer, saleAmountCents: amountCents };
      if (block.status === 'ready') adopted.push(item);
      else reassigned.push(item);
    });

    // A real called row absent from the current Assigned list was returned,
    // rerolled, or cancelled. Test rows are never changed by this sync.
    ledgerBlocks.filter(block => block.status === 'called').forEach(block => {
      const current = currentByPosition.get(Number(block.position));
      // A changed buyer was already handled above as a reassignment. Only an
      // absent Assigned row can return this position to ready.
      if (current) return;
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
  }
  if (adopted.length || reassigned.length || returned.length || repriced.length) broadcastBreakBoardChange({ keepOverlayVisuals: true });
  return {
    foundCount: currentByPosition.size,
    deliveredCount: adopted.length,
    reassignedCount: reassigned.length,
    releasedCount: returned.length,
    priceUpdatedCount: repriced.length,
    deliveredBlocks: adopted,
    reassignedBlocks: reassigned,
    releasedBlocks: returned
  };
}

function clearLiveSaleAmounts() {
  if (!isLiveLedgerCurrent()) throw new Error('Save Board ✓ first so the connector has a current live ledger.');
  // This deliberately changes money values only. Current buyer ownership,
  // card assignments, Buyer Bags, and the viewer board stay untouched.
  const result = database.prepare(`
    UPDATE active_break_board_cards
    SET sale_amount_cents = 0
    WHERE status = 'called' AND sale_amount_cents != 0
  `).run();
  if (result.changes) broadcastBreakBoardChange({ keepOverlayVisuals: true });
  return { clearedPrices: result.changes };
}

function resetTestAssignments() {
  const result = database.prepare(`
    UPDATE active_break_board_cards
    SET status = 'ready', buyer_name = '', called_at = NULL, message_marked = 0, tracker_marked = 0, sale_amount_cents = 0
    WHERE status = 'test-called'
  `).run();
  if (/^(Simulated Whatnot assigned row|Automated 15-buyer stress test)$/.test(connectorStatus.lastBlock?.source || '')) connectorStatus.lastBlock = null;
  broadcastBreakBoardChange({ keepOverlayVisuals: true });
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
      SET status = 'ready', buyer_name = '', called_at = NULL, message_marked = 0, tracker_marked = 0, sale_amount_cents = 0
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
      SET status = 'test-called', buyer_name = ?, called_at = ?, message_marked = 0, tracker_marked = 0, sale_amount_cents = 0
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
    broadcastBreakBoardChange({ keepOverlayVisuals: true });
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
  requireOnePieceCard(normalizedId, 'rarity classifications');
  if (![ '', ALTERNATE_ART, MANUAL_MANGA, MANUAL_GOLD_DON ].includes(normalizedClassification)) throw new Error('Choose Alternate Art, Manga, Gold DON!!, or Standard.');
  const isAlternateArt = normalizedClassification === ALTERNATE_ART;
  const manualCategory = [MANUAL_MANGA, MANUAL_GOLD_DON].includes(normalizedClassification) ? normalizedClassification : '';
  const result = database.prepare(`
    UPDATE cards
    SET variant = ?, variant_source = ?, manual_category = ?
    WHERE id = ?
  `).run(isAlternateArt ? ALTERNATE_ART : '', isAlternateArt ? 'Manual' : '', manualCategory, normalizedId);
  if (!result.changes) throw new Error('That card is no longer in the local library.');
  invalidateOrderHitTracker();
  return getCard(normalizedId);
}

function setRiftboundTreatment(id, treatment) {
  const normalizedId = Number(id);
  const normalizedTreatment = String(treatment || '').trim();
  if (!Number.isInteger(normalizedId) || normalizedId < 1) throw new Error('Choose a valid Riftbound card first.');
  const card = database.prepare('SELECT game_code FROM cards WHERE id=?').get(normalizedId);
  if (!card || String(card.game_code || '').toUpperCase() !== RIFTBOUND_GAME_CODE) throw new Error('Choose a card from the Riftbound Library.');
  if (!['', 'Standard', ...RIFTBOUND_TREATMENTS].includes(normalizedTreatment)) throw new Error('Choose Automatic, Standard, Alternate Art, Overnumbered, or Signature.');
  database.prepare('UPDATE cards SET manual_category=? WHERE id=?').run(normalizedTreatment, normalizedId);
  invalidateOrderHitTracker();
  browserOverlayCardsCache = null;
  return getCard(normalizedId);
}

function deriveSetCode(card) {
  const riftboundSetCode = String(card?.set_code || '').trim().toUpperCase();
  if (String(card?.game_code || '').trim().toUpperCase() === RIFTBOUND_GAME_CODE
      && /^[A-Z0-9]{2,12}$/.test(riftboundSetCode)) {
    return riftboundSetCode;
  }
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

function ensureRiftboundRuneSupplements() {
  const supplements = riftboundRuneSupplements();
  const existingByIdentity = database.prepare(`
    SELECT official_id, image_url, image_path, rarity, source_rarity, variant, variant_source
    FROM cards
    WHERE UPPER(TRIM(COALESCE(game_code, ''))) = 'RIFTBOUND'
      AND UPPER(TRIM(COALESCE(set_code, ''))) = ?
      AND UPPER(TRIM(COALESCE(card_number, ''))) = ?
    LIMIT 1
  `);
  const missing = [];
  const refresh = [];
  for (const card of supplements) {
    const existing = existingByIdentity.get(card.set_code, card.card_number.toUpperCase());
    if (!existing) {
      missing.push(card);
      refresh.push(card);
      continue;
    }
    const imageChanged = String(existing.image_url || '') !== String(card.image_url || '');
    const metadataChanged = normalizedRarity(existing.rarity) !== normalizedRarity(card.rarity)
      || String(existing.source_rarity || '').trim().toLowerCase() !== String(card.source_rarity || '').trim().toLowerCase()
      || String(existing.variant || '').trim().toLowerCase() !== String(card.variant || '').trim().toLowerCase()
      || String(existing.variant_source || '').trim().toLowerCase() !== String(card.variant_source || '').trim().toLowerCase();
    if (imageChanged) database.prepare('UPDATE cards SET image_path = ? WHERE official_id = ?').run('', existing.official_id);
    if (imageChanged || metadataChanged) refresh.push({ ...card, official_id: existing.official_id || card.official_id });
  }
  if (refresh.length) saveImportedCards(refresh, new Date().toISOString());
  return {
    addedRiftboundRunes: missing.length,
    refreshedRiftboundRunes: refresh.length - missing.length,
    availableRiftboundRunes: supplements.length
  };
}

function ensureRiftboundCardSupplements() {
  const supplements = riftboundCardSupplements();
  const existingByOfficialId = database.prepare(`
    SELECT official_id, image_url, image_path, rarity, source_rarity, variant, variant_source
    FROM cards
    WHERE official_id = ?
    LIMIT 1
  `);
  const existingByNumber = database.prepare(`
    SELECT official_id, image_url, image_path, rarity, source_rarity, variant, variant_source
    FROM cards
    WHERE UPPER(TRIM(COALESCE(game_code, ''))) = 'RIFTBOUND'
      AND UPPER(TRIM(COALESCE(set_code, ''))) = ?
      AND UPPER(TRIM(COALESCE(card_number, ''))) IN (?, ?)
    ORDER BY CASE WHEN UPPER(TRIM(COALESCE(variant, ''))) = 'FOIL' THEN 1 ELSE 0 END, id
    LIMIT 1
  `);
  const existingByNumberAndVariant = database.prepare(`
    SELECT official_id, image_url, image_path, rarity, source_rarity, variant, variant_source
    FROM cards
    WHERE UPPER(TRIM(COALESCE(game_code, ''))) = 'RIFTBOUND'
      AND UPPER(TRIM(COALESCE(set_code, ''))) = ?
      AND UPPER(TRIM(COALESCE(card_number, ''))) IN (?, ?)
      AND UPPER(TRIM(COALESCE(variant, ''))) = ?
    LIMIT 1
  `);
  const existingByCollectorKey = new Map();
  for (const row of database.prepare(`
    SELECT official_id, image_url, image_path, rarity, source_rarity, variant,
      variant_source, set_code, card_number
    FROM cards
    WHERE UPPER(TRIM(COALESCE(game_code, ''))) = 'RIFTBOUND'
  `).all()) {
    const key = openRiftPrintingKey(row.card_number, row.set_code);
    if (!key) continue;
    const matches = existingByCollectorKey.get(key) || [];
    matches.push(row);
    existingByCollectorKey.set(key, matches);
  }
  const missing = [];
  const refresh = [];
  for (const card of supplements) {
    const shortNumber = card.card_number.replace(/\/\d+$/, '');
    const collectorKey = openRiftPrintingKey(card.card_number, card.set_code);
    const normalizedMatches = existingByCollectorKey.get(collectorKey) || [];
    const normalizedExisting = card.distinct_variant
      ? normalizedMatches.find(row => String(row.variant || '').trim().toUpperCase() === String(card.variant || '').trim().toUpperCase())
      : normalizedMatches.find(row => String(row.variant || '').trim().toUpperCase() !== 'FOIL') || normalizedMatches[0];
    const existing = existingByOfficialId.get(card.official_id)
      || normalizedExisting
      || (card.distinct_variant
        ? existingByNumberAndVariant.get(card.set_code, card.card_number.toUpperCase(), shortNumber.toUpperCase(), String(card.variant || '').toUpperCase())
        : existingByNumber.get(card.set_code, card.card_number.toUpperCase(), shortNumber.toUpperCase()));
    if (!existing) {
      missing.push(card);
      refresh.push(card);
      continue;
    }
    // The complete Vendetta chase snapshot is an offline recovery path. Keep
    // richer Riot-imported rows byte-for-byte when the exact printing exists.
    if (card.fallback_only) continue;
    const imageChanged = String(existing.image_url || '') !== String(card.image_url || '');
    const metadataChanged = normalizedRarity(existing.rarity) !== normalizedRarity(card.rarity)
      || String(existing.source_rarity || '').trim().toLowerCase() !== String(card.source_rarity || '').trim().toLowerCase()
      || String(existing.variant || '').trim().toLowerCase() !== String(card.variant || '').trim().toLowerCase()
      || String(existing.variant_source || '').trim().toLowerCase() !== String(card.variant_source || '').trim().toLowerCase();
    if (imageChanged) {
      // A URL change means the cached file came from the obsolete source.
      // Clearing only this reference lets the new verified image replace it.
      database.prepare('UPDATE cards SET image_path = ? WHERE official_id = ?').run('', existing.official_id);
    }
    if (imageChanged || metadataChanged) refresh.push({ ...card, official_id: existing.official_id || card.official_id });
  }
  if (refresh.length) saveImportedCards(refresh, new Date().toISOString());
  return {
    addedRiftboundCards: missing.length,
    refreshedRiftboundCards: refresh.length - missing.length,
    availableRiftboundCards: supplements.length
  };
}

async function cacheRiftboundRuneSupplementImages(cards = riftboundRuneSupplements()) {
  let cachedImages = 0;
  for (const card of cards) {
    try {
      const imagePath = await cacheRiftboundImage(card);
      if (!imagePath) continue;
      saveImportedCards([{ ...card, image_path: imagePath }], new Date().toISOString());
      cachedImages += 1;
    } catch (error) {
      console.error(`Unable to cache Riftbound Rune image for ${card.card_number}:`, error.message);
    }
  }
  return cachedImages;
}

async function cacheRiftboundCardSupplementImages(cards = riftboundCardSupplements()) {
  let cachedImages = 0;
  for (const card of cards) {
    try {
      // Only cache rows that the supplement installer actually owns. A
      // fallback that matched an existing Riot row must not create a second
      // catalog record merely to cache the same artwork.
      if (!database.prepare('SELECT id FROM cards WHERE official_id = ? LIMIT 1').get(card.official_id)) continue;
      const imagePath = await cacheRiftboundImage(card);
      if (!imagePath) continue;
      saveImportedCards([{ ...card, image_path: imagePath }], new Date().toISOString());
      cachedImages += 1;
    } catch (error) {
      console.error(`Unable to cache Riftbound supplemental image for ${card.card_number}:`, error.message);
    }
  }
  return cachedImages;
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

function defaultBreakBoardDescription(gameCode) {
  return normalizeBreakBoardGame(gameCode) === 'RIFTBOUND' ? RIFTBOUND_BREAK_DESCRIPTION : WHATNOT_BREAK_DESCRIPTION;
}

function getBreakBoardDescription(gameCode) {
  const game = normalizeBreakBoardGame(gameCode);
  return normalizeBreakDescription(getMetadata(BREAK_BOARD_DESCRIPTION_KEYS[game])) || defaultBreakBoardDescription(game);
}

function getBreakBoardDescriptions() {
  return {
    ONEPIECE: getBreakBoardDescription('ONEPIECE'),
    RIFTBOUND: getBreakBoardDescription('RIFTBOUND')
  };
}

function saveBreakBoardDescription(payload = {}) {
  const gameCode = normalizeBreakBoardGame(payload.gameCode);
  const description = normalizeBreakDescription(payload.description);
  if (!description) throw new Error('Enter listing notes before saving.');
  setMetadata(BREAK_BOARD_DESCRIPTION_KEYS[gameCode], description);
  return { gameCode, description };
}

function resetBreakBoardDescription(gameCode) {
  const game = normalizeBreakBoardGame(gameCode);
  database.prepare('DELETE FROM app_metadata WHERE key = ?').run(BREAK_BOARD_DESCRIPTION_KEYS[game]);
  return { gameCode: game, description: defaultBreakBoardDescription(game) };
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
      imported_at, source_updated_at, source, game_code, game_name, product_name, variant, variant_source
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
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
      source = excluded.source,
      game_code = excluded.game_code,
      game_name = excluded.game_name,
      product_name = excluded.product_name,
      variant = CASE WHEN excluded.variant = '' THEN cards.variant ELSE excluded.variant END,
      variant_source = CASE WHEN excluded.variant_source = '' THEN cards.variant_source ELSE excluded.variant_source END
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
        card.source || 'Official Bandai',
        card.game_code || 'ONEPIECE',
        card.game_name || 'One Piece Card Game',
        card.product_name || '',
        card.variant || '',
        card.variant_source || ''
      );
    }
    database.exec('COMMIT');
    invalidateOrderHitTracker();
    browserOverlayCardsCache = null;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return cards.length;
}

function imageExtensionFromResponse(url, contentType = '') {
  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.endsWith('.png') || /png/i.test(contentType)) return '.png';
  if (pathname.endsWith('.webp') || /webp/i.test(contentType)) return '.webp';
  if (pathname.endsWith('.avif') || /avif/i.test(contentType)) return '.avif';
  return '.jpg';
}

async function cacheRiftboundImage(card) {
  if (card.image_path && hasUsableCachedImage(card.image_path)) return card.image_path;
  if (!card.image_url) return '';
  if (String(card.image_url).startsWith('breaksuite-asset://')) return '';
  const imageHash = crypto.createHash('sha1').update(card.image_url).digest('hex');
  for (const extension of ['.png', '.webp', '.avif', '.jpg']) {
    const cachedPath = path.join(riftboundImageDirectory(), `${imageHash}${extension}`);
    if (hasUsableCachedImage(cachedPath)) return cachedPath;
  }
  const response = await fetch(card.image_url, {
    headers: { 'User-Agent': 'BreakSuite6 Riftbound Library/0.3.193', Accept: 'image/*' },
    signal: AbortSignal.timeout(45000)
  });
  if (!response.ok) return '';
  const extension = imageExtensionFromResponse(card.image_url, response.headers.get('content-type') || '');
  const destination = path.join(riftboundImageDirectory(), `${imageHash}${extension}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 32) return '';
  const temporary = `${destination}.part`;
  fs.writeFileSync(temporary, bytes);
  fs.renameSync(temporary, destination);
  return destination;
}

function cachedRiftboundImageMatchesUrl(imagePath, imageUrl) {
  if (!hasUsableCachedImage(imagePath) || !imageUrl) return false;
  const expectedHash = crypto.createHash('sha1').update(String(imageUrl)).digest('hex');
  return path.basename(String(imagePath)).toLowerCase().startsWith(expectedHash);
}

async function fetchOpenRiftImageCatalog() {
  const response = await fetch(OPENRIFT_CATALOG_URL, {
    headers: {
      Accept: 'application/json',
      Referer: 'https://openrift.app/cards',
      'User-Agent': 'BreakSuite6 Riftbound Library/0.3.193'
    },
    signal: AbortSignal.timeout(60000)
  });
  if (response.status === 429) throw new Error('OpenRift temporarily rate-limited the image catalog. Wait a few minutes and try again.');
  if (!response.ok) throw new Error(`OpenRift image catalog download failed with status ${response.status}.`);
  const payload = await response.json();
  if (!payload?.printings || !Array.isArray(payload?.sets)) throw new Error('OpenRift returned an unsupported catalog format.');
  return payload;
}

async function syncOpenRiftLibraryImages(sender) {
  const notify = progress => sender?.send?.('riftbound:import-progress', progress);
  notify({ phase: 'openrift-catalog', message: 'Reading exact English printings from OpenRift…', importedCards: 0, cachedImages: 0 });
  const payload = await fetchOpenRiftImageCatalog();
  const imageIndex = buildOpenRiftImageIndex(payload);
  if (!imageIndex.size) throw new Error('OpenRift returned no supported English card images.');

  const cards = database.prepare(`
    SELECT id, name, card_number, set_code, image_url, image_path
    FROM cards
    WHERE UPPER(TRIM(COALESCE(game_code, ''))) = ?
      AND UPPER(TRIM(COALESCE(set_code, ''))) IN ('OGN','OGS','SFD','UNL','VEN')
    ORDER BY set_code, card_number, id
  `).all(RIFTBOUND_GAME_CODE);
  const matched = [];
  const unmatched = [];
  const ready = new Map();
  const pending = [];
  let reusedImages = 0;

  for (const card of cards) {
    const image = lookupOpenRiftImage(imageIndex, card.card_number, card.set_code);
    if (!image) {
      unmatched.push(card);
      continue;
    }
    const item = { card, image };
    matched.push(item);
    if (String(card.image_url || '') === image.imageUrl && cachedRiftboundImageMatchesUrl(card.image_path, image.imageUrl)) {
      ready.set(card.id, { imageUrl: image.imageUrl, imagePath: card.image_path });
      reusedImages += 1;
    } else {
      pending.push(item);
    }
  }

  let completed = 0;
  let downloadedImages = 0;
  const failures = [];
  const workers = Array.from({ length: Math.min(4, pending.length) }, async () => {
    while (pending.length) {
      const item = pending.shift();
      try {
        const imagePath = await cacheRiftboundImage({ image_url: item.image.imageUrl, image_path: '' });
        if (imagePath && cachedRiftboundImageMatchesUrl(imagePath, item.image.imageUrl)) {
          ready.set(item.card.id, { imageUrl: item.image.imageUrl, imagePath });
          downloadedImages += 1;
        } else {
          failures.push(item.card);
        }
      } catch (error) {
        failures.push(item.card);
        console.error(`Unable to cache OpenRift image for ${item.card.card_number}:`, error.message);
      }
      completed += 1;
      if (completed % 10 === 0 || completed === matched.length - reusedImages) {
        notify({
          phase: 'openrift-images',
          message: `Caching OpenRift card images ${completed.toLocaleString()} of ${(matched.length - reusedImages).toLocaleString()}…`,
          importedCards: cards.length,
          cachedImages: ready.size
        });
      }
    }
  });
  await Promise.all(workers);

  const updateImage = database.prepare('UPDATE cards SET image_url=?, image_path=?, source_updated_at=? WHERE id=?');
  const clearImage = database.prepare('UPDATE cards SET image_url=?, image_path=?, source_updated_at=? WHERE id=?');
  const completedAt = new Date().toISOString();
  let clearedExternalImages = 0;
  database.exec('BEGIN IMMEDIATE');
  try {
    for (const [cardId, image] of ready) updateImage.run(image.imageUrl, image.imagePath, completedAt, cardId);
    for (const card of [...unmatched, ...failures]) {
      if (!isOpenRiftCardImageUrl(card.image_url) && (card.image_url || card.image_path)) {
        clearImage.run('', '', completedAt, card.id);
        clearedExternalImages += 1;
      }
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  browserOverlayCardsCache = null;

  const result = {
    success: true,
    scannedCards: cards.length,
    catalogImages: imageIndex.size,
    matchedCards: matched.length,
    cachedImages: ready.size,
    downloadedImages,
    reusedImages,
    clearedExternalImages,
    missingImages: unmatched.length + failures.length
  };
  const missingCopy = result.missingImages
    ? ` ${result.missingImages.toLocaleString()} local record${result.missingImages === 1 ? '' : 's'} had no downloadable exact image and now use a clean placeholder instead of an outside photo.`
    : '';
  notify({
    phase: 'complete',
    message: `OpenRift image refresh complete.${missingCopy}`,
    importedCards: cards.length,
    cachedImages: ready.size,
    missingImages: result.missingImages
  });
  return result;
}

async function runOpenRiftImageRefresh(sender) {
  if (importInProgress) throw new Error('Wait for the current official import to finish.');
  importInProgress = true;
  try {
    return await syncOpenRiftLibraryImages(sender);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The OpenRift image refresh failed.';
    sender?.send?.('riftbound:import-progress', { phase: 'failed', message, importedCards: 0, cachedImages: 0 });
    throw new Error(message);
  } finally {
    importInProgress = false;
  }
}

function riftboundApiKeyStatus() {
  return { configured: Boolean(getMetadata(RIFTBOUND_API_KEY_METADATA)) };
}

function saveRiftboundApiKey(apiKey) {
  const normalized = String(apiKey || '').trim();
  if (!normalized) {
    setMetadata(RIFTBOUND_API_KEY_METADATA, '');
    return { configured: false };
  }
  if (!/^RGAPI-[A-Za-z0-9_-]{20,}$/.test(normalized)) {
    throw new Error('Enter the complete Riot API key beginning with RGAPI-.');
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Windows secure storage is not available. Restart Windows and try again.');
  }
  setMetadata(RIFTBOUND_API_KEY_METADATA, safeStorage.encryptString(normalized).toString('base64'));
  return { configured: true };
}

function riftboundApiKey() {
  const encrypted = getMetadata(RIFTBOUND_API_KEY_METADATA);
  if (!encrypted) throw new Error('Save an approved Riot Riftbound API key before downloading cards.');
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
  } catch {
    throw new Error('The saved Riot API key could not be unlocked on this Windows account. Save the key again.');
  }
}

async function saveRiftboundPayload(payload, sender, startedAt) {
  const normalized = normalizeRiftboundPayload(payload);
  if (!normalized.cards.length) {
    throw new Error('The official Riot response did not contain any supported Riftbound gallery cards.');
  }
  sender.send('riftbound:import-progress', { phase: 'saving', message: 'Saving official Riftbound card records…', importedCards: 0, cachedImages: 0 });
  saveImportedCards(normalized.cards, startedAt);
  const cardSupplementResult = ensureRiftboundCardSupplements();
  const runeResult = ensureRiftboundRuneSupplements();
  const boardOneResult = ensureVendettaBoardOne(database);
  const boardThreeResult = ensureUnleashedBoardThree(database);
  const boardSixResult = ensureSpiritforgedExpandedBoardSix(database);
  const boardSevenResult = ensureUnleashedExpandedBoardSeven(database);
  const boardTenResult = ensureVendettaChaseSinglesBoardTen(database);
  const openRiftImages = await syncOpenRiftLibraryImages(sender);
  const result = {
    success: true,
    importedCards: normalized.cards.length + cardSupplementResult.addedRiftboundCards + runeResult.addedRiftboundRunes,
    cachedImages: openRiftImages.cachedImages,
    ignoredCards: normalized.ignored,
    availableRiftboundRunes: runeResult.availableRiftboundRunes,
    boardOneResult,
    boardThreeResult,
    boardSixResult,
    boardSevenResult,
    boardTenResult,
    openRiftImages
  };
  sender.send('riftbound:import-progress', { phase: 'complete', message: 'Riftbound card sync and OpenRift image refresh complete.', ...result });
  return result;
}

async function runOfficialRiftboundImport(sender) {
  if (importInProgress) throw new Error('Wait for the current official import to finish.');
  importInProgress = true;
  const startedAt = new Date().toISOString();
  try {
    sender.send('riftbound:import-progress', { phase: 'downloading', message: 'Reading the official Riftbound Card Gallery…', importedCards: 0, cachedImages: 0 });
    const records = [];
    const limit = 200;
    for (let from = 0, page = 1; page <= 20; page += 1) {
      const url = new URL(RIFTBOUND_GALLERY_URL);
      url.searchParams.set('locale', 'en_US');
      url.searchParams.set('from', String(from));
      url.searchParams.set('limit', String(limit));
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          Referer: 'https://playriftbound.com/en-us/card-gallery/',
          'User-Agent': 'BreakSuite6 Riftbound Library/0.3.104'
        },
        signal: AbortSignal.timeout(45000)
      });
      if (response.status === 429) throw new Error('The official gallery temporarily rate-limited the download. Wait a few minutes and try again.');
      if (!response.ok) throw new Error(`Official Riftbound gallery download failed with status ${response.status}.`);
      const payload = await response.json();
      const items = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.data)
          ? payload.data
        : Array.isArray(payload?.data?.items)
          ? payload.data.items
          : Array.isArray(payload?.results)
            ? payload.results
            : [];
      records.push(...items);
      sender.send('riftbound:import-progress', {
        phase: 'downloading',
        message: `Reading official gallery records ${records.length.toLocaleString()}…`,
        importedCards: 0,
        cachedImages: 0
      });
      const total = Number(payload?.totalItems ?? payload?.metadata?.totalItems ?? payload?.pagination?.totalItems ?? 0);
      from += limit;
      if (!items.length || (total > 0 && from >= total) || (!payload?.linkdata?.next && total <= 0)) break;
    }
    if (!records.length) throw new Error('The official gallery returned no card records. Riot may have changed the gallery format.');
    return await saveRiftboundPayload({ items: records }, sender, startedAt);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The official Riftbound download failed.';
    sender.send('riftbound:import-progress', { phase: 'failed', message, importedCards: 0, cachedImages: 0 });
    throw new Error(message);
  } finally {
    importInProgress = false;
  }
}

async function recoverEmptyRiftboundLibrary() {
  const existingCards = Number(overview(RIFTBOUND_GAME_CODE).total) || 0;
  if (existingCards >= 100 || getMetadata(RIFTBOUND_ZERO_RECOVERY_KEY) === 'complete') {
    return { skipped: true, existingCards };
  }
  const sender = mainWindow && !mainWindow.isDestroyed()
    ? mainWindow.webContents
    : { send() {} };
  const result = await runOfficialRiftboundImport(sender);
  repairRiftboundSetAssignments(database, RIFTBOUND_SETS);
  setMetadata(RIFTBOUND_ZERO_RECOVERY_KEY, 'complete');
  return { ...result, recovered: true };
}

async function runRiftboundJsonImport(sender) {
  if (importInProgress) throw new Error('Wait for the current official import to finish.');
  const selection = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose an official Riot Riftbound JSON export',
    properties: ['openFile'],
    filters: [{ name: 'JSON files', extensions: ['json'] }]
  });
  if (selection.canceled || !selection.filePaths[0]) return { canceled: true };
  importInProgress = true;
  const startedAt = new Date().toISOString();
  try {
    const payload = JSON.parse(fs.readFileSync(selection.filePaths[0], 'utf8'));
    return await saveRiftboundPayload(payload, sender, startedAt);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The Riftbound import failed.';
    sender.send('riftbound:import-progress', { phase: 'failed', message, importedCards: 0, cachedImages: 0 });
    throw new Error(message);
  } finally {
    importInProgress = false;
  }
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
  if (browserOverlayCardsCache) {
    const liveAssignments = database.prepare(`
      SELECT position, card_id, status AS block_status, buyer_name, called_at,
        message_marked, tracker_marked, sale_amount_cents
      FROM active_break_board_cards ORDER BY position ASC
    `).all();
    if (applyOverlayLiveAssignments(browserOverlayCardsCache, liveAssignments)) return browserOverlayCardsCache;
    browserOverlayCardsCache = null;
  }
  const liveCards = listActiveBreakBoardCards();
  const liveRound = activeBreakRound();
  const customMapping = liveRound ? loadRoundCustomMapping(database, liveRound.id) : null;
  const activePresetSlot = matchingPresetSlotForRows(liveCards);
  const customLinearOverlayProfile = linearOverlayProfileForPresetSlot(activePresetSlot)
    || linearOverlayProfileForCustomMapping(customMapping);
  const staticOverlayProfile = Number(activePresetSlot) === 9
    ? SPIRITFORGED_BOARD_NINE_STATIC_OVERLAY_PROFILE
    : Number(activePresetSlot) === 10
      ? VENDETTA_BOARD_TEN_STATIC_OVERLAY_PROFILE
      : '';
  const customSpots = new Map((customMapping?.spots || []).map(spot => [Number(spot.position), spot]));
  const needsSpiritforged = liveCards.some(card => String(card.set_code || '').trim().toUpperCase() === 'SFD');
  const needsVendetta = liveCards.some(card => String(card.set_code || '').trim().toUpperCase() === 'VEN');
  const spiritforgedCatalog = needsSpiritforged
    ? database.prepare(`SELECT * FROM cards WHERE UPPER(TRIM(COALESCE(game_code, ''))) = ? AND UPPER(TRIM(COALESCE(set_code, ''))) = 'SFD'`).all(RIFTBOUND_GAME_CODE).map(forRenderer)
    : [];
  const vendettaCatalog = needsVendetta
    ? database.prepare(`SELECT * FROM cards WHERE UPPER(TRIM(COALESCE(game_code, ''))) = ? AND UPPER(TRIM(COALESCE(set_code, ''))) = 'VEN'`).all(RIFTBOUND_GAME_CODE).map(forRenderer)
    : [];
  const spiritforgedExpandedProfile = spiritforgedExpandedProfileForBoard(liveCards);
  const spiritforgedExpandedDetected = Boolean(spiritforgedExpandedProfile);
  const unleashedExpandedDetected = isUnleashedExpandedBreakBoard(liveCards);
  const unleashedExpandedCatalog = unleashedExpandedDetected ? unleashedTop80Catalog() : [];
  const caseDetected = !unleashedExpandedDetected && isUnleashedCaseBreakBoard(liveCards);
  const caseCatalog = caseDetected ? unleashedTop80Catalog() : [];
  const top80Detected = !caseDetected && isUnleashedTop80Board(liveCards);
  const top80Catalog = top80Detected ? unleashedTop80Catalog() : [];
  const legacyColorDetected = !caseDetected && !top80Detected && isUnleashedColorBreakBoard(liveCards);
  const legacyColorCatalog = legacyColorDetected ? unleashedTop80Catalog() : [];
  const comboDetected = riftboundComboBoardDetected(liveCards);
  const comboCatalog = comboDetected ? riftboundComboCatalog() : [];
  browserOverlayCardsCache = liveCards.map(card => {
    const publicCard = {
      ...browserOverlayCard(card),
      static_overlay_profile: staticOverlayProfile
    };
    const customSpot = customSpots.get(Number(card.position));
    if (customSpot) {
      const previewCards = overlayPreviewCards(
        (customSpot.cards || []).map(browserOverlayCard).filter(Boolean),
        customLinearOverlayProfile
      );
      const baseLabel = customMappingSpotDisplayLabel(customSpot) || String(card.break_spot_label || card.name || 'Mapped Spot');
      const anchorPresentation = customMappingCardPresentation(previewCards[0]);
      const anchorBadge = customLinearOverlayProfile === RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_9
        ? anchorPresentation.badge
        : '';
      const label = anchorBadge && !baseLabel.includes(anchorBadge) ? `${anchorBadge} ${baseLabel}` : baseLabel;
      return {
        ...publicCard,
        spot_bundle: {
          kind: customLinearOverlayProfile?.bundleKind || 'custom-saved-map',
          label,
          effect_group: anchorPresentation.role === 'signature'
            ? 'SIGNATURE'
            : anchorPresentation.role === 'ultimate'
              ? 'ULTIMATE'
              : anchorPresentation.role === 'overnumbered'
                ? 'OVERNUMBERED'
                : anchorPresentation.role === 'alternate-art' ? 'ALT_ART' : '',
          preview_title: customLinearOverlayProfile?.previewTitle || 'CUSTOM SAVED MAP',
          cards: (previewCards.length ? previewCards : [publicCard]).map((preview, index) => ({
            ...preview,
            bundle_role: index === 0 ? 'primary' : 'paired',
            bundle_caption: String(preview.name || '').split(',')[0].trim() || preview.name
          }))
        }
      };
    }
    if (card.riftbound_single) {
      return {
        ...publicCard,
        spot_bundle: {
          kind: 'riftbound-single',
          label: String(card.break_spot_label || card.name || 'Riftbound single'),
          popup_label: String(card.break_popup_label || ''),
          effect_group: String(card.break_popup_effect_group || ''),
          preview_title: 'RIFTBOUND SINGLE',
          cards: [{
            ...publicCard,
            bundle_role: 'primary',
            bundle_caption: String(card.break_spot_label || card.name || 'Exact card')
          }]
        }
      };
    }
    if (spiritforgedExpandedDetected) {
      const visual = buildSpiritforgedExpandedBreakSpot(spiritforgedCatalog, card, spiritforgedExpandedProfile);
      const heroCards = Array.isArray(visual?.heroCards) ? visual.heroCards.map(browserOverlayCard).filter(Boolean) : [];
      if (visual && heroCards.length) {
        const previewCards = overlayPreviewCards(heroCards, RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_6);
        return {
          ...publicCard,
          spot_bundle: {
            kind: `spiritforged-expanded-${visual.kind}`,
            label: visual.displayLabel,
            preview_title: 'SPIRITFORGED 50-SPOT',
            cards: previewCards.map((hero, index) => ({
              ...hero,
              bundle_role: index === 0 ? 'primary' : 'paired',
              bundle_caption: String(hero.name || '').split(',')[0].trim() || hero.name
            }))
          }
        };
      }
    }
    if (unleashedExpandedDetected) {
      const visual = buildUnleashedExpandedBreakSpot(unleashedExpandedCatalog, card);
      const heroCards = Array.isArray(visual?.heroCards) ? visual.heroCards.map(browserOverlayCard).filter(Boolean) : [];
      if (visual && heroCards.length) {
        const previewCards = overlayPreviewCards(heroCards, RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_7);
        return {
          ...publicCard,
          spot_bundle: {
            kind: `unleashed-expanded-${visual.kind}`,
            label: visual.displayLabel,
            preview_title: 'UNLEASHED 39-SPOT · BOARD 7',
            cards: previewCards.map((hero, index) => ({
              ...hero,
              bundle_role: index === 0 ? 'primary' : 'paired',
              bundle_caption: String(hero.name || '').split(',')[0].trim() || hero.name
            }))
          }
        };
      }
    }
    const vendettaMapping = vendettaSpotFromCard(card);
    if (vendettaMapping) return { ...publicCard, spot_bundle: vendettaOverlayBundle(vendettaMapping, vendettaCatalog, card) };
    const mapping = spiritforgedSpotFromCard(card);
    if (mapping) return { ...publicCard, spot_bundle: spiritforgedOverlayBundle(mapping, spiritforgedCatalog, card) };
    if (caseDetected) {
      const visual = buildUnleashedCaseBreakSpot(caseCatalog, card);
      const heroCards = Array.isArray(visual?.heroCards) ? visual.heroCards.map(browserOverlayCard).filter(Boolean) : [];
      if (visual && heroCards.length) {
        return {
          ...publicCard,
          spot_bundle: {
            kind: `unleashed-case-${visual.kind}`,
            label: visual.displayLabel,
            preview_title: 'UNLEASHED 19-SPOT CASE',
            cards: heroCards.slice(0, 2).map((hero, index) => ({
              ...hero,
              bundle_role: index === 0 ? 'primary' : 'paired',
              bundle_caption: visual.kind === 'baron-runes' && index === 1
                ? 'All 6 AA Runes'
                : (String(hero.name || '').split(',')[0].trim() || hero.name)
            }))
          }
        };
      }
    }
    if (top80Detected) {
      const visual = buildUnleashedTop80Spot(top80Catalog, card);
      const heroCards = Array.isArray(visual?.heroCards) ? visual.heroCards.map(browserOverlayCard).filter(Boolean) : [];
      if (visual && heroCards.length) {
        return {
          ...publicCard,
          spot_bundle: {
            kind: 'unleashed-top80',
            label: visual.displayLabel,
            preview_title: 'UNLEASHED TOP 80',
            cards: heroCards.slice(0, 1).map(hero => ({
              ...hero,
              bundle_role: 'primary',
              bundle_caption: `COLLECTR RANK ${visual.collectrRank}`
            }))
          }
        };
      }
    }
    if (legacyColorDetected) {
      const visual = buildUnleashedColorBreakSpot(legacyColorCatalog, card);
      const heroCards = Array.isArray(visual?.heroCards) ? visual.heroCards.map(browserOverlayCard).filter(Boolean) : [];
      if (visual && heroCards.length >= 2) {
        return {
          ...publicCard,
          spot_bundle: {
            kind: 'unleashed-color-break',
            label: visual.displayLabel,
            preview_title: 'UNLEASHED COLOR BREAK',
            cards: heroCards.slice(0, 2).map((hero, index) => ({
              ...hero,
              bundle_role: index === 0 ? 'primary' : 'paired',
              bundle_caption: String(hero.name || '').split(',')[0].trim() || hero.name
            }))
          }
        };
      }
    }
    if (comboDetected) {
      const visual = buildVisualSpot(comboCatalog, card);
      const heroCards = Array.isArray(visual?.heroCards) ? visual.heroCards.map(browserOverlayCard).filter(Boolean) : [];
      if (visual && heroCards.length >= 2) {
        return {
          ...publicCard,
          spot_bundle: {
            kind: 'combo-visual',
            label: visual.displayLabel,
            preview_title: 'UNLEASHED + VENDETTA COMBO',
            cards: heroCards.slice(0, 2).map((hero, index) => ({
              ...hero,
              bundle_role: index === 0 ? 'primary' : 'paired',
              bundle_caption: String(hero.name || '').split(',')[0].trim() || hero.name
            }))
          }
        };
      }
    }
    return publicCard;
  }).map(card => applyLinearOverlayProfileToCard(card, customLinearOverlayProfile));
  return browserOverlayCardsCache;
}

function browserOverlayCard(card) {
  if (!card) return null;
  const rendered = forRenderer(card);
  return {
    ...rendered,
    // Browser and OBS views cannot reliably load an Electron file:// image.
    // Serve the verified local image through the same loopback bridge instead.
    // The app version invalidates OBS/browser image caches after an artwork
    // repair even though the database card id remains unchanged.
    image_url: rendered.image_path && hasUsableCachedImage(rendered.image_path)
      ? `${CONNECTOR_ORIGIN}/api/card-image/${rendered.id}?v=${encodeURIComponent(app.getVersion())}`
      : rendered.image_url
  };
}

function firstCardNumber(value) {
  return String(value || '').toUpperCase().match(/(?:SFD-)?(\d+)/)?.[1] || '';
}

function normalizedCardTitle(value) {
  return String(value || '').trim().toLowerCase().replace(/[’‘]/g, "'");
}

function spiritforgedPreviewCard(cards, { name, number = '', treatment = '' } = {}) {
  const title = normalizedCardTitle(name);
  const wantedTreatment = String(treatment || '').trim().toUpperCase();
  return [...cards]
    .filter(card => normalizedCardTitle(card.name) === title)
    .sort((left, right) => {
      const score = card => {
        const actualTreatment = String(card.collector_treatment || card.variant || card.manual_category || '').trim().toUpperCase();
        let value = 0;
        if (wantedTreatment && actualTreatment === wantedTreatment) value += 100;
        if (number && firstCardNumber(card.card_number) === String(number)) value += 60;
        if (wantedTreatment === 'SIGNATURE' && /\*/.test(String(card.card_number || ''))) value += 20;
        return value;
      };
      return score(right) - score(left) || Number(left.id) - Number(right.id);
    })[0] || null;
}

function spiritforgedOverlayBundle(mapping, catalog, fallbackCard) {
  let previewCards;
  if (mapping.kind === 'champion') {
    const signature = spiritforgedPreviewCard(catalog, { name: mapping.signatureCard, number: mapping.signatureNumber, treatment: 'SIGNATURE' });
    const champion = spiritforgedPreviewCard(catalog, { name: mapping.championCard, number: mapping.championNumber, treatment: 'OVERNUMBERED' });
    previewCards = [
      { ...(signature || fallbackCard), bundle_role: 'signature', bundle_caption: `${mapping.signatureChampion} Signature` },
      { ...(champion || fallbackCard), bundle_role: 'champion', bundle_caption: mapping.champion }
    ];
  } else {
    const seal = spiritforgedPreviewCard(catalog, { name: mapping.seal });
    const rune = [...catalog]
      .filter(card => normalizedCardTitle(card.name) === normalizedCardTitle(mapping.rune) && isShowcaseRune(card))
      .sort(sortChampionFamily)[0] || spiritforgedPreviewCard(catalog, { name: mapping.rune });
    previewCards = [
      { ...(seal || fallbackCard), bundle_role: 'seal', bundle_caption: mapping.seal },
      { ...(rune || fallbackCard), bundle_role: 'rune', bundle_caption: `${mapping.rune} Showcase` }
    ];
  }
  return {
    kind: mapping.kind,
    label: spiritforgedSpotLabel(mapping),
    color: mapping.color || '',
    cards: previewCards.map(browserOverlayCard).filter(Boolean)
  };
}

function vendettaOverlayBundle(mapping, catalog, fallbackCard) {
  const previewCards = mapping.champions.slice(0, 2).map(champion => {
    const representative = [...catalog]
      .filter(card => cardBelongsToChampion(card, champion, 'VEN'))
      .sort(sortChampionFamily)[0] || fallbackCard;
    return {
      ...representative,
      bundle_role: champion === mapping.spot ? 'primary' : 'paired',
      bundle_caption: champion
    };
  });
  return {
    kind: mapping.rune ? 'vendetta-color' : 'vendetta-combination',
    label: vendettaListingSpotName(fallbackCard),
    color: mapping.color || '',
    preview_title: mapping.rune ? 'VENDETTA SP + RUNE SPOT' : 'VENDETTA COMBINED SPOT',
    cards: previewCards.map(browserOverlayCard).filter(Boolean)
  };
}

function browserOverlayClaim(cards = browserOverlayCards()) {
  const event = overlayClaimQueue.current();
  if (!event) return null;
  const card = cards.find(item => Number(item.position) === Number(event.position));
  if (!card || card.block_status === 'ready' || card.called_at !== event.calledAt) return null;
  return { ...card, reveal_sequence: event.sequence };
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

function serveBrowserOverlayImage(response, assetName, contentType) {
  const assetPath = path.join(__dirname, 'renderer', assetName);
  try {
    const body = fs.readFileSync(assetPath);
    response.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    });
    response.end(body);
  } catch {
    sendText(response, 404, 'text/plain; charset=utf-8', 'Overlay image not found.');
  }
}

// The pirate sign is deliberately sent as one self-contained page.  OBS and
// some browser sources can drop a second local image request, which used to
// leave only the message text visible.  Keeping the board image inline means
// the sign arrives as one reliable response.
function servePirateSalesSign(response) {
  try {
    const pagePath = path.join(__dirname, 'renderer', 'sales-sign.html');
    const primaryImagePath = path.join(__dirname, 'renderer', 'assets', 'pirate-sold-singles-v2.png');
    const secondaryImagePath = path.join(__dirname, 'renderer', 'assets', 'pirate-sold-singles-secondary.png');
    const riftboundImagePath = path.join(__dirname, 'renderer', 'assets', 'riftbound-recall-sign.png');
    const primaryImageDataUri = `data:image/png;base64,${fs.readFileSync(primaryImagePath).toString('base64')}`;
    const secondaryImageDataUri = `data:image/png;base64,${fs.readFileSync(secondaryImagePath).toString('base64')}`;
    const riftboundImageDataUri = `data:image/png;base64,${fs.readFileSync(riftboundImagePath).toString('base64')}`;
    // Replace the value-only token.  The old token matched the JavaScript
    // variable name first, corrupting the script before OBS could render it.
    const page = fs.readFileSync(pagePath, 'utf8')
      .replace('__PIRATE_SALES_BOARD_DATA_URI__', JSON.stringify(primaryImageDataUri))
      .replace('__PIRATE_SALES_BOARD_SECONDARY_DATA_URI__', JSON.stringify(secondaryImageDataUri))
      .replace('__RIFTBOUND_SALES_BOARD_DATA_URI__', JSON.stringify(riftboundImageDataUri));
    sendText(response, 200, 'text/html; charset=utf-8', page);
  } catch {
    sendText(response, 500, 'text/plain; charset=utf-8', 'Pirate Sold Singles board could not be loaded.');
  }
}

function openVipAlertWindow() {
  if (vipAlertWindow && !vipAlertWindow.isDestroyed()) {
    vipAlertWindow.showInactive();
    vipAlertWindow.webContents.send('vip-alert:changed', vipAlertFeed);
    return;
  }
  vipAlertWindow = new BrowserWindow({
    width: 470, height: 430, minWidth: 420, minHeight: 300, resizable: true,
    alwaysOnTop: true, frame: false, transparent: false, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  vipAlertWindow.setAlwaysOnTop(true, 'floating');
  vipAlertWindow.loadURL(`${CONNECTOR_ORIGIN}/vip-alert.html`).catch(() => {});
  vipAlertWindow.once('ready-to-show', () => vipAlertWindow?.showInactive());
  vipAlertWindow.on('closed', () => { vipAlertWindow = undefined; });
}

function serveLocalImageFile(response, imagePath) {
  if (!imagePath || !hasUsableCachedImage(imagePath)) {
    sendText(response, 404, 'text/plain; charset=utf-8', 'Card image not cached.');
    return;
  }
  const extension = path.extname(imagePath).toLowerCase();
  const contentType = { '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }[extension] || 'image/jpeg';
  response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable', 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(imagePath).on('error', () => {
    if (!response.headersSent) sendText(response, 404, 'text/plain; charset=utf-8', 'Card image could not be read.');
    else response.destroy();
  }).pipe(response);
}

function serveCachedCardImage(response, cardId) {
  const card = database.prepare('SELECT image_path FROM cards WHERE id = ?').get(cardId);
  return serveLocalImageFile(response, card?.image_path || '');
}

async function serveRiftboundSpotMapImage(response, cardId) {
  const id = Number(cardId) || 0;
  const imagePath = await resolveRiftboundSpotMapImagePath(id);
  if (imagePath) return serveLocalImageFile(response, imagePath);

  const card = id ? database.prepare('SELECT id, image_url, card_number, set_code FROM cards WHERE id = ?').get(id) : null;
  const remoteUrl = card ? await riftboundSpotRemoteImageUrl(card) : '';
  if (remoteUrl) {
    // If caching failed transiently, still show the card instead of a blank box.
    response.writeHead(302, { Location: remoteUrl, 'Cache-Control': 'no-store' });
    response.end();
    return;
  }
  sendText(response, 404, 'text/plain; charset=utf-8', 'Spot Map image unavailable.');
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
    const requestUrl = new URL(String(request.url || '/'), CONNECTOR_ORIGIN);
    const requestPath = requestUrl.pathname;
    if (request.method === 'OPTIONS') return sendJson(response, 204, {});
    if (request.method === 'GET' && requestPath === '/overlay.html') {
      return serveBrowserOverlayAsset(response, 'browser-overlay.html', 'text/html; charset=utf-8');
    }
    if (request.method === 'GET' && requestPath === '/popup.html') {
      return serveBrowserOverlayAsset(response, 'browser-overlay.html', 'text/html; charset=utf-8');
    }
    if (request.method === 'GET' && requestPath === '/overlay.css') {
      return serveBrowserOverlayAsset(response, 'browser-overlay.css', 'text/css; charset=utf-8');
    }
    if (request.method === 'GET' && requestPath === '/overlay.js') {
      return serveBrowserOverlayAsset(response, 'browser-overlay.js', 'application/javascript; charset=utf-8');
    }
    if (request.method === 'GET' && requestPath === '/viewer-card-filter.js') {
      return serveBrowserOverlayAsset(response, 'viewer-card-filter.js', 'application/javascript; charset=utf-8');
    }
    if (request.method === 'GET' && requestPath === '/riftbound-popup-name.js') {
      return serveBrowserOverlayAsset(response, 'riftbound-popup-name.js', 'application/javascript; charset=utf-8');
    }
    if (request.method === 'GET' && requestPath === '/box-tracker.html') {
      return serveBrowserOverlayAsset(response, 'box-tracker.html', 'text/html; charset=utf-8');
    }
    if (request.method === 'GET' && requestPath === '/active-case.html') {
      return serveBrowserOverlayAsset(response, 'active-case.html', 'text/html; charset=utf-8');
    }
    // Keep both URLs working, but always serve the self-contained pirate board.
    // This also upgrades an existing OBS source that still uses sales-sign.html.
    if (request.method === 'GET' && requestPath === '/sales-sign.html') return servePirateSalesSign(response);
    if (request.method === 'GET' && requestPath === '/pirate-sales-sign.html') return servePirateSalesSign(response);
    if (request.method === 'GET' && requestPath === '/sales-sign.css') return serveBrowserOverlayAsset(response, 'sales-sign.css', 'text/css; charset=utf-8');
    if (request.method === 'GET' && requestPath === '/sales-sign.js') return serveBrowserOverlayAsset(response, 'sales-sign.js', 'application/javascript; charset=utf-8');
    if (request.method === 'GET' && requestPath === '/assets/treasure-sold-singles.png') return serveBrowserOverlayImage(response, 'assets/treasure-sold-singles.png', 'image/png');
    if (request.method === 'GET' && requestPath === '/assets/popup-theme-concepts.png') return serveBrowserOverlayImage(response, 'assets/popup-theme-concepts.png', 'image/png');
    if (request.method === 'GET' && requestPath === '/assets/popup-statue-diamond.png') return serveBrowserOverlayImage(response, 'assets/popup-statue-diamond.png', 'image/png');
    if (request.method === 'GET' && requestPath === '/assets/popup-statue-signature.png') return serveBrowserOverlayImage(response, 'assets/popup-statue-signature.png', 'image/png');
    if (request.method === 'GET' && requestPath === '/assets/popup-statue-fire.png') return serveBrowserOverlayImage(response, 'assets/popup-statue-fire.png', 'image/png');
    if (request.method === 'GET' && requestPath === '/assets/popup-statue-bomb.png') return serveBrowserOverlayImage(response, 'assets/popup-statue-bomb.png', 'image/png');
    if (request.method === 'GET' && requestPath === '/assets/popup-statue-heart.png') return serveBrowserOverlayImage(response, 'assets/popup-statue-heart.png', 'image/png');
    if (request.method === 'GET' && requestPath === '/assets/popup-statue-construction.png') return serveBrowserOverlayImage(response, 'assets/popup-statue-construction.png', 'image/png');
    if (request.method === 'GET' && requestPath === '/assets/popup-statue-rose.png') return serveBrowserOverlayImage(response, 'assets/popup-statue-rose.png', 'image/png');
    if (request.method === 'GET' && requestPath === '/assets/popup-statue-signature-board10.png') return serveBrowserOverlayImage(response, 'assets/popup-statue-signature-board10.png', 'image/png');
    if (request.method === 'GET' && requestPath === '/assets/popup-statue-fire-board10.png') return serveBrowserOverlayImage(response, 'assets/popup-statue-fire-board10.png', 'image/png');
    if (request.method === 'GET' && requestPath === '/assets/popup-statue-bomb-board10.png') return serveBrowserOverlayImage(response, 'assets/popup-statue-bomb-board10.png', 'image/png');
    if (request.method === 'GET' && requestPath === '/assets/popup-statue-heart-board10.png') return serveBrowserOverlayImage(response, 'assets/popup-statue-heart-board10.png', 'image/png');
    if (request.method === 'GET' && requestPath === '/assets/popup-statue-construction-board10.png') return serveBrowserOverlayImage(response, 'assets/popup-statue-construction-board10.png', 'image/png');
    if (request.method === 'GET' && requestPath === '/assets/popup-statue-rose-board10.png') return serveBrowserOverlayImage(response, 'assets/popup-statue-rose-board10.png', 'image/png');
    if (request.method === 'GET' && requestPath === '/assets/popup-statue-ultimate-board10.png') return serveBrowserOverlayImage(response, 'assets/popup-statue-ultimate-board10.png', 'image/png');
    if (request.method === 'GET' && requestPath === '/assets/pirate-sold-singles-v2.png') return serveBrowserOverlayImage(response, 'assets/pirate-sold-singles-v2.png', 'image/png');
    if (request.method === 'GET' && requestPath === '/assets/pirate-sold-singles-secondary.png') return serveBrowserOverlayImage(response, 'assets/pirate-sold-singles-secondary.png', 'image/png');
    if (request.method === 'GET' && requestPath === '/assets/riftbound-recall-sign.png') return serveBrowserOverlayImage(response, 'assets/riftbound-recall-sign.png', 'image/png');
    if (request.method === 'GET' && requestPath === '/api/sales-sign') return sendJson(response, 200, { ok: true, sign: getSalesSign() });
    if (request.method === 'GET' && requestPath === '/riftbound-spot-map.html') return serveBrowserOverlayAsset(response, 'riftbound-spot-map-overlay.html', 'text/html; charset=utf-8');
    if (request.method === 'GET' && requestPath === '/riftbound-spot-map.css') return serveBrowserOverlayAsset(response, 'riftbound-spot-map-overlay.css', 'text/css; charset=utf-8');
    if (request.method === 'GET' && requestPath === '/riftbound-spot-map.js') return serveBrowserOverlayAsset(response, 'riftbound-spot-map-overlay.js', 'application/javascript; charset=utf-8');
    if (request.method === 'GET' && requestPath === '/assets/cinzel-decorative-latin-400-normal.woff2') return serveBrowserOverlayAsset(response, 'assets/cinzel-decorative-latin-400-normal.woff2', 'font/woff2');
    if (request.method === 'GET' && requestPath === '/assets/cinzel-decorative-latin-700-normal.woff2') return serveBrowserOverlayAsset(response, 'assets/cinzel-decorative-latin-700-normal.woff2', 'font/woff2');
    if (request.method === 'GET' && requestPath === '/box-tracker.css') {
      return serveBrowserOverlayAsset(response, 'box-tracker.css', 'text/css; charset=utf-8');
    }
    if (request.method === 'GET' && requestPath === '/box-tracker.js') {
      return serveBrowserOverlayAsset(response, 'box-tracker.js', 'application/javascript; charset=utf-8');
    }
    if (request.method === 'GET' && requestPath === '/active-case.css') {
      return serveBrowserOverlayAsset(response, 'active-case.css', 'text/css; charset=utf-8');
    }
    if (request.method === 'GET' && requestPath === '/active-case.js') {
      return serveBrowserOverlayAsset(response, 'active-case.js', 'application/javascript; charset=utf-8');
    }
    if (request.method === 'GET' && requestPath === '/vip-alert.html') {
      return serveBrowserOverlayAsset(response, 'vip-alert.html', 'text/html; charset=utf-8');
    }
    if (request.method === 'GET' && requestPath === '/vip-alert.css') {
      return serveBrowserOverlayAsset(response, 'vip-alert.css', 'text/css; charset=utf-8');
    }
    if (request.method === 'GET' && requestPath === '/vip-alert.js') {
      return serveBrowserOverlayAsset(response, 'vip-alert.js', 'application/javascript; charset=utf-8');
    }
    const imageMatch = requestPath.match(/^\/api\/card-image\/(\d+)$/);
    if (request.method === 'GET' && imageMatch) {
      return serveCachedCardImage(response, Number(imageMatch[1]));
    }
    const spotMapImageMatch = requestPath.match(/^\/api\/riftbound-spot-image\/(\d+)$/);
    if (request.method === 'GET' && spotMapImageMatch) {
      return serveRiftboundSpotMapImage(response, Number(spotMapImageMatch[1]));
    }
    if (request.method === 'GET' && requestPath === '/api/health') {
      return sendJson(response, 200, { ok: true, connector: getConnectorStatus() });
    }
    if (request.method === 'GET' && requestPath === '/api/overlay') {
      const revealOnly = requestUrl.searchParams.get('view') === 'reveal';
      if (revealOnly) overlayRevealSourcePresence.noteDedicatedSource();
      // Older OBS scenes may have only the board URL. Let it reveal sales while
      // the dedicated popup source is absent, then automatically hand reveals
      // to popup.html when that source is polling again.
      const boardReveal = !revealOnly && overlayRevealSourcePresence.boardShouldReveal();
      if (!staticOverlayEnabled && !revealOnly) {
        return sendJson(response, 200, {
          ok: true,
          build: app.getVersion(),
          enabled: false,
          cards: [],
          boardReveal,
          claim: boardReveal && overlayClaimQueue.size() ? browserOverlayClaim(browserOverlayCards()) : null,
          style: getOverlayStyle(),
          connector: getConnectorStatus()
        });
      }
      const cards = browserOverlayCards();
      return sendJson(response, 200, {
        ok: true,
        build: app.getVersion(),
        enabled: true,
        cards: revealOnly ? [] : cards,
        boardReveal,
        claim: (revealOnly || boardReveal) ? browserOverlayClaim(cards) : null,
        style: getOverlayStyle(),
        connector: getConnectorStatus()
      });
    }
    if (request.method === 'GET' && requestPath === '/api/box-tracker') {
      return sendJson(response, 200, { ok: true, ...publicBoxTrackerSnapshot() });
    }
    if (request.method === 'GET' && requestPath === '/api/active-case') {
      return sendJson(response, 200, { ok: true, ...publicActiveCaseSnapshot() });
    }
    if (request.method === 'GET' && requestPath === '/api/vip-alert') {
      return sendJson(response, 200, { ok: true, alerts: vipAlertFeed });
    }
    if (request.method === 'GET' && requestPath === '/api/chaser-tracker') return sendJson(response, 200, { ok: true, ...getChaserTracker() });
    if (request.method === 'GET' && requestPath === '/api/royal-chaser') return sendJson(response, 200, { ok: true, ...getRoyalChaserTracker() });
    if (request.method === 'GET' && requestPath === '/api/riftbound-spot-map') {
      return sendJson(response, 200, {
        ok: true,
        enabled: riftboundSpotMapEnabled,
        entries: riftboundSpotMapEnabled ? publicRiftboundSpotMap() : []
      });
    }
    if (request.method === 'GET' && requestPath === '/chaser-tracker.html') return serveBrowserOverlayAsset(response, 'chaser-tracker.html', 'text/html; charset=utf-8');
    if (request.method === 'GET' && requestPath === '/royal-chaser.html') return serveBrowserOverlayAsset(response, 'royal-chaser.html', 'text/html; charset=utf-8');
    if (request.method === 'GET' && requestPath === '/chaser-tracker.css') return serveBrowserOverlayAsset(response, 'chaser-tracker.css', 'text/css; charset=utf-8');
    if (request.method === 'GET' && requestPath === '/chaser-tracker.js') return serveBrowserOverlayAsset(response, 'chaser-tracker.js', 'application/javascript; charset=utf-8');
    if (request.method === 'POST' && requestPath === '/api/vip/chat') {
      try {
        return sendJson(response, 200, { ok: true, ...welcomeVipBuyer(await readJsonRequest(request)) });
      } catch (error) {
        return sendJson(response, 400, { ok: false, error: error.message || 'VIP chat lookup failed.' });
      }
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
        assertCurrentConnectorLedger(payload);
        const card = receiveConnectorPayload(payload);
        return sendJson(response, 200, {
          ok: true,
          announced: card.claim_announced === true,
          revealSequence: card.reveal_sequence || null,
          block: { position: card.position, cardId: card.id, cardName: card.name, calledAt: card.called_at }
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The connector could not process this block.';
        const isUnready = /Save Board|not on the saved live ledger/.test(message);
        return sendJson(response, isUnready ? 409 : 400, { ok: false, error: message });
      }
    }
    if (request.method === 'POST' && requestPath === '/api/connector/adopt') {
      try {
        const payload = await readJsonRequest(request);
        assertCurrentConnectorLedger(payload);
        return sendJson(response, 200, { ok: true, ...adoptConnectorAssignments(payload) });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The connector could not adopt its startup baseline.';
        const isUnready = /Save Board|not on the saved live ledger/.test(message);
        return sendJson(response, isUnready ? 409 : 400, { ok: false, error: message });
      }
    }
    if (request.method === 'POST' && requestPath === '/api/connector/reversal') {
      try {
        const payload = await readJsonRequest(request);
        assertCurrentConnectorLedger(payload);
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
        assertCurrentConnectorLedger(payload);
        return sendJson(response, 200, { ok: true, ...reconcileConnectorAssignments(payload) });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The connector could not reconcile the Assigned list.';
        const isUnready = /Save Board|not on the saved live ledger/.test(message);
        return sendJson(response, isUnready ? 409 : 400, { ok: false, error: message });
      }
    }
    if (request.method === 'POST' && requestPath === '/api/connector/clear-sale-amounts') {
      try {
        return sendJson(response, 200, { ok: true, ...clearLiveSaleAmounts() });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The connector could not clear live sale amounts.';
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
  ipcMain.handle('library:overview', (_event, gameCode) => overview(gameCode));
  ipcMain.handle('library:cards', (_event, filters) => listCards(filters));
  ipcMain.handle('library:sets', () => listCatalogSets());
  ipcMain.handle('library:rarities', (_event, gameCode, setCode) => listRarities(gameCode, setCode));
  ipcMain.handle('library:card', (_event, id) => getCard(id));
  ipcMain.handle('library:set-saved', (_event, id, shouldSave) => setSaved(id, shouldSave));
  ipcMain.handle('library:set-classification', (_event, id, classification) => setCardClassification(id, classification));
  ipcMain.handle('library:set-riftbound-treatment', (_event, id, treatment) => setRiftboundTreatment(id, treatment));
  ipcMain.handle('break:board-cards', () => listBreakBoardCards());
  ipcMain.handle('break:active-board-cards', () => listActiveBreakBoardCards());
  ipcMain.handle('break:board-overview', () => breakBoardOverview());
  ipcMain.handle('break:set-game', (_event, gameCode) => setBreakBoardGame(gameCode));
  ipcMain.handle('break:set-mapping-mode', (_event, mappingMode) => setBreakBoardMappingMode(mappingMode));
  ipcMain.handle('break:list-presets', () => listBreakBoardPresets());
  ipcMain.handle('break:save-preset', (_event, payload) => saveBreakBoardPreset(payload));
  ipcMain.handle('break:mapping-editor', (_event, slot) => boardMappingEditorState(slot));
  ipcMain.handle('break:mapping-search', (_event, payload) => searchBoardMappingLibrary(payload));
  ipcMain.handle('break:save-mapping', (_event, payload) => {
    const result = saveBoardMappingEditor(payload);
    broadcastBreakBoardChange();
    return result;
  });
  ipcMain.handle('break:reset-mapping', (_event, slot) => {
    const result = resetBoardMappingEditor(slot);
    broadcastBreakBoardChange();
    return result;
  });
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
  ipcMain.handle('break:save-board', (_event, payload) => {
    const result = saveBreakBoard(payload);
    broadcastBreakBoardChange();
    return result;
  });
  ipcMain.handle('break:listing-descriptions', () => getBreakBoardDescriptions());
  ipcMain.handle('break:save-listing-description', (_event, payload) => saveBreakBoardDescription(payload));
  ipcMain.handle('break:reset-listing-description', (_event, gameCode) => resetBreakBoardDescription(gameCode));
  ipcMain.handle('break:copy-listing', () => {
    const consolidation = consolidateUnleashedPoroRuneSpots();
    const numbering = compactBreakBoardPositions();
    const cards = listBreakBoardCards();
    const listing = formatBreakBoardListing(cards, getBreakBoardDescriptions());
    clipboard.writeText(listing);
    return { copiedCards: cards.length, listing, removedRunes: consolidation.removedRunes, renumbered: numbering.renumbered || consolidation.renumbered };
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
  ipcMain.handle('breaker:mark-tracker-cards', (_event, positions) => markBuyerCardsTracked(positions));
  ipcMain.handle('breaker:copy-buyer-congratulations', (_event, buyer) => copyBuyerCongratulations(buyer));
  ipcMain.handle('breaker:riftbound-champion-audit', () => listRiftboundChampionAudit());
  ipcMain.handle('breaker:copy-riftbound-spot-map-overlay', () => {
    const url = `${CONNECTOR_ORIGIN}/riftbound-spot-map.html?obs=1&v=305`;
    clipboard.writeText(url);
    return { url };
  });
  ipcMain.handle('breaker:riftbound-spot-map-status', () => riftboundSpotMapStatus());
  ipcMain.handle('breaker:set-riftbound-spot-map-enabled', (_event, payload) => setRiftboundSpotMapEnabled(payload));
  ipcMain.handle('breaker:copy-static-overlay', () => {
    const url = `${CONNECTOR_ORIGIN}/overlay.html?obs=1&v=368`;
    clipboard.writeText(url);
    return { url };
  });
  ipcMain.handle('breaker:static-overlay-status', () => staticOverlayStatus());
  ipcMain.handle('breaker:set-static-overlay-enabled', (_event, payload) => setStaticOverlayEnabled(payload));
  ipcMain.handle('breaker:set-riftbound-champion-pull', (_event, payload) => setRiftboundChampionPullQuantity(payload));
  ipcMain.handle('breaker:clear-riftbound-pulls', (_event, buyer) => clearRiftboundBuyerPullSelections(buyer));
  ipcMain.handle('breaker:copy-riftbound-pulls', (_event, buyer) => copyRiftboundBuyerPulls(buyer));
  ipcMain.handle('break-rounds:pending', () => listPendingBreakRounds());
  ipcMain.handle('break-rounds:finish-live', () => finishLiveBreakRoundForReview());
  ipcMain.handle('break-rounds:set-message-card', (_event, payload) => setPendingRoundMessageCardMarked(payload));
  ipcMain.handle('break-rounds:set-pull', (_event, payload) => setPendingRoundPullQuantity(payload));
  ipcMain.handle('break-rounds:clear-buyer-pulls', (_event, payload) => clearPendingRoundBuyerPulls(payload));
  ipcMain.handle('break-rounds:copy-buyer-pulls', (_event, payload) => copyPendingRoundBuyerPulls(payload));
  ipcMain.handle('pricing:settings', () => getPricingSettings(database));
  ipcMain.handle('pricing:save-settings', (_event, payload) => savePricingSettings(database, payload));
  ipcMain.handle('riftbound-board:refresh-prices', () => refreshRiftboundBoardPrices());
  ipcMain.handle('riftbound-board:prepare-price-input', () => prepareRiftboundBoardPriceInput());
  ipcMain.handle('riftbound-board:apply-price-input', (_event, payload) => applyRiftboundBoardPriceInput(payload));
  ipcMain.handle('library-list:refresh-prices', (_event, cardIds) => refreshLibraryListPrices(cardIds));
  ipcMain.handle('library-list:prepare-price-input', (_event, cardIds) => prepareLibraryListPriceInput(cardIds));
  ipcMain.handle('library-list:apply-price-input', (_event, payload) => applyLibraryListPriceInput(payload));
  ipcMain.handle('buyer-bag:refresh-prices', (_event, payload) => refreshBuyerBagPrices(payload));
  ipcMain.handle('buyer-bag:prepare-price-input', (_event, payload) => prepareBuyerBagPriceInput(payload));
  ipcMain.handle('buyer-bag:apply-price-input', (_event, payload) => applyBuyerBagPriceInput(payload));
  ipcMain.handle('break-rounds:remove-assignment', (_event, payload) => removePendingRoundAssignment(payload));
  ipcMain.handle('break-rounds:discard', (_event, payload) => discardPendingBreakRound(payload));
  ipcMain.handle('break-rounds:complete-archive', (_event, payload) => completeAndArchiveBreakRound(payload));
  ipcMain.handle('pull-history:list', (_event, payload) => listPullHistoryForRenderer(payload));
  ipcMain.handle('pull-history:save-current', () => saveCurrentPullHistory());
  ipcMain.handle('pull-history:refresh-prices', (_event, batchId) => refreshPullHistoryPrices(database, batchId));
  ipcMain.handle('pull-history:prepare-price-input', (_event, batchId) => preparePullHistoryPriceInput(batchId));
  ipcMain.handle('pull-history:apply-price-input', (_event, payload) => applyPullHistoryPriceInput(payload));
  ipcMain.handle('pull-history:add-card', (_event, payload) => addSavedPullHistoryCard(payload));
  ipcMain.handle('pull-history:delete', (_event, batchId) => deletePullHistoryBatch(database, batchId));
  ipcMain.handle('history:list', (_event, payload) => listBreakOrderHistory(payload));
  ipcMain.handle('history:save-current-break', (_event, payload) => saveBreakOrderHistory(payload));
  ipcMain.handle('history:update', (_event, payload) => updateBreakOrderHistory(payload));
  ipcMain.handle('history:change-tracker-destination', (_event, payload) => updateOrderTrackerDestination(payload));
  ipcMain.handle('history:delete', (_event, id) => deleteBreakOrderHistory(id));
  ipcMain.handle('expenses:list', (_event, payload) => listBusinessExpenses(payload));
  ipcMain.handle('expenses:save', (_event, payload) => saveBusinessExpense(payload));
  ipcMain.handle('expenses:delete', (_event, id) => deleteBusinessExpense(id));
  ipcMain.handle('buyer-analytics:get', () => getBuyerAnalytics());
  ipcMain.handle('buyer-analytics:audit-purchases', () => {
    const audit = auditPullHistoryBuyerData(database);
    return { audit, analytics: getBuyerAnalytics() };
  });
  ipcMain.handle('business:reconcile-purchases', () => auditBusinessOrderTotals(database, { repair: true }));
  ipcMain.handle('business:download-pdf', async (event, requestedYear) => {
    const year = normalizeTaxYear(requestedYear);
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);
    const selection = await dialog.showSaveDialog(ownerWindow, {
      title: `Save ${year} Business Expense Report PDF`,
      defaultPath: `BreakSuite6-${year}-Business-Expense-Report.pdf`,
      filters: [{ name: 'PDF document', extensions: ['pdf'] }]
    });
    if (selection.canceled || !selection.filePath) return { canceled: true };
    const pdf = await event.sender.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      landscape: false,
      preferCSSPageSize: true
    });
    fs.writeFileSync(selection.filePath, pdf);
    return { canceled: false, filePath: selection.filePath };
  });
  ipcMain.handle('business:download-csv', async (event, requestedYear) => {
    const year = normalizeTaxYear(requestedYear);
    const report = listBusinessExpenses({ year }).report;
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);
    const selection = await dialog.showSaveDialog(ownerWindow, {
      title: `Save ${year} Business Expense Report for Excel`,
      defaultPath: `BreakSuite6-${year}-Business-Expense-Report.csv`,
      filters: [{ name: 'Excel-compatible CSV', extensions: ['csv'] }]
    });
    if (selection.canceled || !selection.filePath) return { canceled: true };
    fs.writeFileSync(selection.filePath, `\uFEFF${businessExpenseReportCsv(report)}`, 'utf8');
    return { canceled: false, filePath: selection.filePath };
  });
  ipcMain.handle('buyer-analytics:case-file', (_event, buyer) => getBuyerCaseFile(buyer));
  ipcMain.handle('buyer-analytics:copy-case-report', (_event, buyer) => buyerCaseReport(buyer));
  ipcMain.handle('chaser:get', () => getChaserTracker());
  ipcMain.handle('chaser:save', (_event, payload) => saveChaserTracker(payload));
  ipcMain.handle('chaser:refresh', () => refreshChaserTracker());
  ipcMain.handle('chaser:reset', () => resetChaserTracker());
  ipcMain.handle('chaser:copy-names', () => copyChaserNames());
  ipcMain.handle('chaser:recent-buyers', () => getRecentBuyerMentions());
  ipcMain.handle('chaser:copy-recent-buyer-chunk', (_event, index) => copyRecentBuyerMentionChunk(index));
  ipcMain.handle('chaser:set-card', (_event, id) => setChaserCard(id));
  ipcMain.handle('chaser:copy-overlay', () => { const url = `${CONNECTOR_ORIGIN}/chaser-tracker.html`; clipboard.writeText(url); return { url }; });
  ipcMain.handle('royal-chaser:get', () => getRoyalChaserTracker());
  ipcMain.handle('royal-chaser:save', (_event,payload) => saveRoyalChaserTracker(payload));
  ipcMain.handle('royal-chaser:reset', () => resetRoyalChaserTracker());
  ipcMain.handle('royal-chaser:copy-names', () => copyRoyalChaserNames());
  ipcMain.handle('royal-chaser:set-card', (_event,id) => setRoyalChaserCard(id));
  ipcMain.handle('royal-chaser:unlock', (_event,buyer) => unlockRoyalChaserBuyer(buyer));
  ipcMain.handle('royal-chaser:copy-overlay', () => { const url = `${CONNECTOR_ORIGIN}/royal-chaser.html`; clipboard.writeText(url); return { url }; });
  ipcMain.handle('box-tracker:list', () => listBoxTrackers());
  ipcMain.handle('box-tracker:open-cases', () => listOpenBoxCases());
  ipcMain.handle('box-tracker:create-open-case', (_event, payload) => createOpenBoxCase(payload));
  ipcMain.handle('box-tracker:finalize-open-case', (_event, payload) => finalizeOpenBoxCase(payload));
  ipcMain.handle('box-tracker:update-open-case', (_event, payload) => updateOpenBoxCase(payload));
  ipcMain.handle('box-tracker:remove-open-case-box', (_event, payload) => removeOpenBoxCaseBox(payload));
  ipcMain.handle('box-tracker:delete-open-case', (_event, payload) => deleteOpenBoxCase(payload));
  ipcMain.handle('box-tracker:create', (_event, payload) => createBoxTracker(payload));
  ipcMain.handle('box-tracker:update', (_event, payload) => updateBoxTracker(payload));
  ipcMain.handle('box-tracker:set-active', (_event, id) => setActiveBoxTracker(id));
  ipcMain.handle('box-tracker:update-box', (_event, payload) => updateBoxTrackerBox(payload));
  ipcMain.handle('box-tracker:add-hit-winner', (_event, payload) => addBoxTrackerHitWinner(payload));
  ipcMain.handle('box-tracker:delete-hit-winner', (_event, payload) => deleteBoxTrackerHitWinner(payload));
  ipcMain.handle('box-tracker:case-records', () => listBoxTrackerCaseRecords());
  ipcMain.handle('box-tracker:save-case-record', (_event, payload) => saveBoxTrackerCaseRecord(payload));
  ipcMain.handle('sales-sign:get', () => getSalesSign());
  ipcMain.handle('sales-sign:save', (_event, payload) => saveSalesSign(payload));
  ipcMain.handle('sales-sign:copy-overlay', () => {
    const url = `${CONNECTOR_ORIGIN}/sales-sign.html?v=132`;
    clipboard.writeText(url);
    return { url };
  });
  ipcMain.handle('box-tracker:update-case-record', (_event, payload) => updateBoxTrackerCaseRecord(payload));
  ipcMain.handle('box-tracker:delete-case-record', (_event, payload) => deleteBoxTrackerCaseRecord(payload));
  ipcMain.handle('box-tracker:delete', (_event, id) => deleteBoxTracker(id));
  ipcMain.handle('box-tracker:copy-overlay-link', () => {
    const url = `${CONNECTOR_ORIGIN}/box-tracker.html?obs=1&v=121`;
    clipboard.writeText(url);
    return { url };
  });
  ipcMain.handle('box-tracker:copy-title-overlay-link', () => {
    const url = `${CONNECTOR_ORIGIN}/box-tracker.html?obs=1&part=title&v=121`;
    clipboard.writeText(url);
    return { url };
  });
  ipcMain.handle('box-tracker:copy-hits-overlay-link', () => {
    const url = `${CONNECTOR_ORIGIN}/box-tracker.html?obs=1&part=hits&v=121`;
    clipboard.writeText(url);
    return { url };
  });
  ipcMain.handle('box-tracker:open-overlay', () => {
    const url = `${CONNECTOR_ORIGIN}/box-tracker.html?obs=1&v=121`;
    shell.openExternal(url);
    return { url };
  });
  ipcMain.handle('box-tracker:copy-active-case-overlay-link', () => {
    const url = `${CONNECTOR_ORIGIN}/active-case.html?obs=1&v=360`;
    clipboard.writeText(url);
    return { url };
  });
  ipcMain.handle('box-tracker:open-active-case-overlay', () => {
    const url = `${CONNECTOR_ORIGIN}/active-case.html?obs=1&v=360`;
    shell.openExternal(url);
    return { url };
  });
  ipcMain.handle('library:repair', () => repairLibrary());
  ipcMain.handle('library:reset', (_event, confirmation) => {
    const result = resetLibrary(confirmation);
    broadcastBreakBoardChange();
    return result;
  });
  ipcMain.handle('import:run-official', event => runOfficialImport(event.sender));
  ipcMain.handle('import:riftbound-api-status', () => riftboundApiKeyStatus());
  ipcMain.handle('import:save-riftbound-api-key', (_event, apiKey) => saveRiftboundApiKey(apiKey));
  ipcMain.handle('import:run-riftbound-official', event => runOfficialRiftboundImport(event.sender));
  ipcMain.handle('import:refresh-openrift-images', event => runOpenRiftImageRefresh(event.sender));
  ipcMain.handle('import:riftbound-json', event => runRiftboundJsonImport(event.sender));
  ipcMain.handle('import:last-session', () => latestImport());
  ipcMain.handle('sniper:status', () => CardSniper.getStatus(database));
  ipcMain.handle('sniper:save-settings', (_event, settings) => CardSniper.setSettings(database, settings));
  ipcMain.handle('sniper:sets', () => CardSniper.getSets(database));
  ipcMain.handle('sniper:latest', (_event, setCode) => CardSniper.getLatest(database, setCode));
  ipcMain.handle('sniper:scan-set', (_event, setCode) => CardSniper.scanSet(database, setCode));
  ipcMain.handle('playable-market:sets', () => PlayableMarket.getSets(database));
  ipcMain.handle('playable-market:dashboard', (_event, options) => {
    const result = PlayableMarket.getDashboard(database, options);
    return { ...result, cards: result.cards.map(forRenderer) };
  });
  ipcMain.handle('playable-market:prepare-research', (_event, setCode) => PlayableMarket.prepareResearch(database, setCode));
  ipcMain.handle('playable-market:apply-research', (_event, payload) => PlayableMarket.applyResearch(database, payload));
  ipcMain.handle('playable-market:remove-card', (_event, cardId) => PlayableMarket.removeTrackedCard(database, cardId));
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
    title: 'BreakSuite6 v0.3.321 — Board 10 Balanced Spiritforged Color',
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
  mainWindow.webContents.once('did-finish-load', () => {
    void recoverEmptyRiftboundLibrary().catch(error => {
      console.error('Unable to recover the empty Riftbound Library:', error);
    });
  });
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

function runBreakRoundSelfTest() {
  const cards = database.prepare(`
    SELECT id FROM cards
    WHERE UPPER(TRIM(COALESCE(game_code, ''))) = ?
    ORDER BY id ASC LIMIT 2
  `).all(RIFTBOUND_GAME_CODE);
  if (cards.length < 2) throw new Error('Round self-test needs two Riftbound catalog cards.');
  database.prepare('DELETE FROM break_board_cards').run();
  const add = database.prepare('INSERT INTO break_board_cards (card_id, position, added_at) VALUES (?, ?, ?)');
  const startedAt = new Date().toISOString();
  cards.forEach((card, index) => add.run(card.id, index + 1, startedAt));

  const firstLive = saveBreakBoard();
  receiveLedgerBlock(1, { buyerName: 'SameBuyer', saleAmountCents: 700, announce: false });
  setBuyerMessageCardMarked(1, true);
  const preSavedPulls = saveCurrentPullHistory();
  database.prepare(`
    UPDATE pull_history_items SET market_price_cents = 1234, market_source = 'self-test'
    WHERE batch_id = ?
  `).run(preSavedPulls.id);
  const second = saveBreakBoard();
  if (!second.pendingRound || listPendingBreakRounds().length !== 1) throw new Error('Box 1 did not move to Pending Review.');
  let staleLedgerRejected = false;
  try { assertCurrentConnectorLedger({ ledgerSavedAt: firstLive.savedAt }); }
  catch (error) { staleLedgerRejected = /previous box/.test(String(error.message || error)); }
  if (!staleLedgerRejected) throw new Error('A stale Box 1 connector event was not rejected after Box 2 became live.');
  assertCurrentConnectorLedger({ ledgerSavedAt: second.savedAt });
  receiveLedgerBlock(1, { buyerName: 'SameBuyer', saleAmountCents: 900, announce: false });
  setBuyerMessageCardMarked(1, true);
  const firstResult = completeAndArchiveBreakRound({ roundId: second.pendingRound.id, breakName: 'Self Test Box 1', boxCost: '50.00', trackerRecordType: 'BOX' });
  if (firstResult.confirmedOrderCount !== 1 || firstResult.selectedPullCount !== 1) throw new Error('Box 1 did not transfer every spot and pull.');
  if (database.prepare('SELECT COUNT(*) AS count FROM pull_history_batches').get().count !== 1) throw new Error('A pre-saved Pull History batch was duplicated.');
  if (database.prepare('SELECT market_price_cents FROM pull_history_items WHERE batch_id = ?').get(firstResult.pullHistoryBatchId)?.market_price_cents !== 1234) {
    throw new Error('Completing a pre-saved Pull History batch lost its market match.');
  }
  const liveBuyer = database.prepare('SELECT buyer_name FROM active_break_board_cards WHERE position = 1').get()?.buyer_name;
  if (liveBuyer !== 'SameBuyer') throw new Error('Completing Box 1 changed Box 2 live ownership.');

  const third = saveBreakBoard();
  if (!third.pendingRound) throw new Error('Box 2 did not move to Pending Review.');
  const historyBeforeFailure = Number(database.prepare('SELECT COUNT(*) AS count FROM break_order_history').get().count);
  const pullsBeforeFailure = Number(database.prepare('SELECT COUNT(*) AS count FROM pull_history_batches').get().count);
  database.exec(`
    CREATE TEMP TRIGGER force_round_archive_failure
    BEFORE INSERT ON break_order_history_pulls
    BEGIN SELECT RAISE(ABORT, 'forced round archive failure'); END;
  `);
  let forcedFailure = false;
  try {
    completeAndArchiveBreakRound({ roundId: third.pendingRound.id, breakName: 'Self Test Box 2', boxCost: '60.00', trackerRecordType: 'BOX' });
  } catch (error) {
    forcedFailure = /forced round archive failure/.test(String(error.message || error));
  }
  database.exec('DROP TRIGGER force_round_archive_failure');
  if (!forcedFailure) throw new Error('The forced archive failure did not execute.');
  const stillPending = database.prepare("SELECT status FROM break_rounds WHERE id = ?").get(third.pendingRound.id)?.status;
  const historyAfterFailure = Number(database.prepare('SELECT COUNT(*) AS count FROM break_order_history').get().count);
  const pullsAfterFailure = Number(database.prepare('SELECT COUNT(*) AS count FROM pull_history_batches').get().count);
  if (stillPending !== 'PENDING_REVIEW' || historyAfterFailure !== historyBeforeFailure || pullsAfterFailure !== pullsBeforeFailure) {
    throw new Error('A failed archive did not roll back completely.');
  }
  completeAndArchiveBreakRound({ roundId: third.pendingRound.id, breakName: 'Self Test Box 2', boxCost: '60.00', trackerRecordType: 'BOX' });
  if (database.prepare("SELECT COUNT(*) AS count FROM break_rounds WHERE status = 'PENDING_REVIEW'").get().count !== 0) {
    throw new Error('Completed boxes remained in Pending Review.');
  }
  if (database.prepare('SELECT COUNT(*) AS count FROM break_order_history').get().count !== 2
      || database.prepare('SELECT COUNT(*) AS count FROM pull_history_batches').get().count !== 2) {
    throw new Error('Completed boxes were duplicated or missing from history.');
  }
  const analytics = getBuyerAnalytics();
  if (analytics.totals.buyerCount !== 1 || analytics.totals.purchaseCount !== 2 || analytics.totals.totalSpendCents !== 1600) {
    throw new Error('Completed rounds did not reach Buyer Analytics correctly.');
  }
  const archivedBags = listBreakOrderHistory({ limit: 250, includePulls: true }).records;
  if (archivedBags.length !== 2 || archivedBags.some(record => record.items.length !== 1 || record.pulls.length !== 1)) {
    throw new Error('Orders History could not rebuild every archived Buyer Bag.');
  }
  database.close();
  initializeDatabase();
  if (database.prepare('SELECT COUNT(*) AS count FROM break_order_history').get().count !== 2
      || database.prepare('SELECT COUNT(*) AS count FROM pull_history_batches').get().count !== 2
      || database.prepare("SELECT COUNT(*) AS count FROM break_rounds WHERE status = 'PENDING_REVIEW'").get().count !== 0) {
    throw new Error('Completed multi-box records did not survive an application restart.');
  }
  console.log('BreakSuite multi-box self-test passed: pending preservation, same buyer/spot isolation, atomic rollback, histories, and restart persistence.');
}

async function startApplication() {
  try {
    initializeDatabase();
    staticOverlayEnabled = getMetadata(STATIC_OVERLAY_ENABLED_KEY) === 'true';
    registerIpc();
    if (process.argv.includes('--rounds-self-test')) {
      runBreakRoundSelfTest();
      app.quit();
      return;
    }
    if (process.argv.includes('--smoke-test')) {
      console.log(`BreakSuite6 database ready: ${overview().total} official cards`);
      app.quit();
      return;
    }
    startConnectorServer();
    createWindow();
    void cacheProductSupplementImages().catch(error => {
      console.error('Unable to cache product-only DON!! images:', error);
    });
    // Keep recovery-only Riftbound artwork available without requiring the
    // user to run another full official import after installing an update.
    void cacheRiftboundCardSupplementImages().catch(error => {
      console.error('Unable to cache supplemental Riftbound images:', error);
    });
    void cacheRiftboundRuneSupplementImages().catch(error => {
      console.error('Unable to cache supplemental Riftbound Rune images:', error);
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
