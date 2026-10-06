const MAX_TRACKER_NAME_LENGTH = 140;
const MAX_PRODUCT_NAME_LENGTH = 140;
const MAX_BOX_NOTE_LENGTH = 500;
const MIN_BOX_COUNT = 1;
const MAX_BOX_COUNT = 100;
const MAX_BOX_HIT_COUNT = 99;
const BOX_STATUSES = new Set(['sealed', 'live', 'opened']);
const ACTIVE_TRACKER_KEY = 'box-tracker-active-id-v1';
const ACTIVE_OPEN_CASE_KEY = 'box-tracker-active-open-case-id-v1';
const TRACKER_RECORD_TYPES = Object.freeze({ BOX: 'Box', CASE: 'Case' });
const TRACKER_SP_HIT_FIELD = Object.freeze({ key: 'sp_count', payloadKey: 'spCount', label: 'SP' });
const ONE_PIECE_TRACKER_HIT_FIELDS = Object.freeze([
  { key: 'manga_count', payloadKey: 'mangaCount', label: 'Manga' },
  TRACKER_SP_HIT_FIELD,
  { key: 'sec_count', payloadKey: 'secCount', label: 'SEC' },
  { key: 'sec_aa_count', payloadKey: 'secAaCount', label: 'SEC AA' },
  { key: 'leader_aa_count', payloadKey: 'leaderAaCount', label: 'L AA' },
  { key: 'sr_aa_count', payloadKey: 'srAaCount', label: 'SR AA' },
  { key: 'r_aa_count', payloadKey: 'rAaCount', label: 'R AA' },
  { key: 'tr_count', payloadKey: 'trCount', label: 'TR' },
  { key: 'gold_don_count', payloadKey: 'goldDonCount', label: 'Gold DON!!' }
]);
const RIFTBOUND_TRACKER_HIT_FIELDS = Object.freeze([
  { key: 'epic_count', payloadKey: 'epicCount', label: 'Epic' },
  TRACKER_SP_HIT_FIELD,
  { key: 'alt_art_count', payloadKey: 'altArtCount', label: 'Alternate Art' },
  { key: 'overnumbered_count', payloadKey: 'overnumberedCount', label: 'Overnumbered' },
  { key: 'signature_count', payloadKey: 'signatureCount', label: 'Signature' }
]);
// SP is shared by One Piece and Riftbound. Keep one physical database column
// while exposing it in the hit-field list for either game.
const BOX_HIT_FIELDS = Object.freeze([...new Map([
  ...ONE_PIECE_TRACKER_HIT_FIELDS,
  ...RIFTBOUND_TRACKER_HIT_FIELDS
].map(field => [field.key, field])).values()]);

function trimText(value, maximum) {
  return String(value ?? '').trim().slice(0, maximum);
}

function normalizeTrackerName(value) {
  return trimText(value, MAX_TRACKER_NAME_LENGTH) || 'Untitled case tracker';
}

function normalizeProductName(value) {
  return trimText(value, MAX_PRODUCT_NAME_LENGTH);
}

function normalizeTrackerRecordType(value, fallback = '') {
  const type = String(value || '').trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(TRACKER_RECORD_TYPES, type) ? type : fallback;
}

function requireTrackerRecordType(value) {
  const type = normalizeTrackerRecordType(value);
  if (!type) throw new Error('Choose Box or Case before saving to Order History.');
  return type;
}

function trackerHitFieldsForGame(value) {
  return String(value || '').trim().toUpperCase() === 'RIFTBOUND'
    ? RIFTBOUND_TRACKER_HIT_FIELDS
    : ONE_PIECE_TRACKER_HIT_FIELDS;
}

function normalizeBoxCount(value, fallback = 12) {
  const numeric = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(MIN_BOX_COUNT, Math.min(MAX_BOX_COUNT, numeric));
}

function normalizeBoxStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  return BOX_STATUSES.has(status) ? status : 'sealed';
}

function normalizeBoxNote(value) {
  return trimText(value, MAX_BOX_NOTE_LENGTH);
}

function normalizeBoxHitCount(value, fallback = 0) {
  const numeric = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(MAX_BOX_HIT_COUNT, numeric));
}

function normalizeBoxHitCounts(payload = {}, fallback = {}) {
  return BOX_HIT_FIELDS.reduce((counts, field) => {
    const hasValue = Object.prototype.hasOwnProperty.call(payload, field.payloadKey)
      || Object.prototype.hasOwnProperty.call(payload, field.key);
    const supplied = Object.prototype.hasOwnProperty.call(payload, field.payloadKey)
      ? payload[field.payloadKey]
      : payload[field.key];
    counts[field.key] = normalizeBoxHitCount(
      hasValue ? supplied : fallback[field.key],
      normalizeBoxHitCount(fallback[field.key], 0)
    );
    return counts;
  }, {});
}

function ensureBoxTrackerSchema(database) {
  database.exec(`
    -- These records are a separate case/box log. They never touch cards,
    -- buyer bags, the live ledger, or any public-card images.
    CREATE TABLE IF NOT EXISTS box_trackers (
      id INTEGER PRIMARY KEY,
      tracker_name TEXT NOT NULL,
      overlay_title TEXT NOT NULL DEFAULT '',
      product_name TEXT NOT NULL DEFAULT '',
      game_code TEXT NOT NULL DEFAULT 'ONEPIECE',
      set_code TEXT NOT NULL DEFAULT '',
      set_name TEXT NOT NULL DEFAULT '',
      record_type TEXT NOT NULL DEFAULT 'CASE',
      order_history_id INTEGER,
      pull_history_batch_id INTEGER,
      source_mode TEXT NOT NULL DEFAULT 'LEGACY',
      lifecycle_status TEXT NOT NULL DEFAULT 'FINALIZED',
      completed_at TEXT,
      total_boxes INTEGER NOT NULL CHECK(total_boxes BETWEEN ${MIN_BOX_COUNT} AND ${MAX_BOX_COUNT}),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS box_tracker_boxes (
      tracker_id INTEGER NOT NULL,
      box_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'sealed' CHECK(status IN ('sealed', 'live', 'opened')),
      notes TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      PRIMARY KEY(tracker_id, box_number),
      FOREIGN KEY(tracker_id) REFERENCES box_trackers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_box_tracker_boxes_tracker
      ON box_tracker_boxes(tracker_id, box_number);

    CREATE TABLE IF NOT EXISTS box_tracker_hit_winners (
      id INTEGER PRIMARY KEY,
      tracker_id INTEGER NOT NULL,
      box_number INTEGER NOT NULL,
      card_name TEXT NOT NULL,
      rarity TEXT NOT NULL DEFAULT '',
      buyer_name TEXT NOT NULL,
      spot_number INTEGER NOT NULL DEFAULT 0,
      sale_amount_cents INTEGER NOT NULL DEFAULT 0,
      card_number TEXT NOT NULL DEFAULT '',
      category_key TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 1,
      source_history_id INTEGER,
      note TEXT NOT NULL DEFAULT '',
      recorded_at TEXT NOT NULL,
      FOREIGN KEY(tracker_id, box_number) REFERENCES box_tracker_boxes(tracker_id, box_number) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_box_tracker_hit_winners_box
      ON box_tracker_hit_winners(tracker_id, box_number, id DESC);

    -- A live case can contain many separately archived boxes. This link makes
    -- each history snapshot occupy exactly one case position, so retries and
    -- later Pull History corrections replace that box instead of duplicating
    -- its cards or counts.
    CREATE TABLE IF NOT EXISTS box_tracker_history_links (
      tracker_id INTEGER NOT NULL,
      history_id INTEGER NOT NULL UNIQUE,
      box_number INTEGER NOT NULL,
      pull_history_batch_id INTEGER,
      linked_at TEXT NOT NULL,
      PRIMARY KEY(tracker_id, box_number),
      FOREIGN KEY(tracker_id) REFERENCES box_trackers(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_box_tracker_history_links_tracker
      ON box_tracker_history_links(tracker_id, box_number);

    -- A completed case is saved as a text-and-count snapshot. It is separate
    -- from the editable live tracker so starting the next case never changes
    -- a prior case's recorded totals.
    CREATE TABLE IF NOT EXISTS box_tracker_case_records (
      id INTEGER PRIMARY KEY,
      tracker_id INTEGER NOT NULL,
      case_title TEXT NOT NULL,
      overlay_title TEXT NOT NULL DEFAULT '',
      product_name TEXT NOT NULL DEFAULT '',
      recorded_at TEXT NOT NULL,
      ${BOX_HIT_FIELDS.map(field => `${field.key} INTEGER NOT NULL DEFAULT 0`).join(',\n      ')}
    );
    CREATE INDEX IF NOT EXISTS idx_box_tracker_case_records_recorded
      ON box_tracker_case_records(recorded_at DESC, id DESC);
  `);

  // Existing case trackers keep their saved status data. Add the per-box
  // hit record columns in place so no prior case needs to be recreated.
  const existing = new Set(database.prepare('PRAGMA table_info(box_tracker_boxes)').all().map(column => column.name));
  for (const field of BOX_HIT_FIELDS) {
    if (!existing.has(field.key)) database.exec(`ALTER TABLE box_tracker_boxes ADD COLUMN ${field.key} INTEGER NOT NULL DEFAULT 0`);
  }
  const caseRecordColumns = new Set(database.prepare('PRAGMA table_info(box_tracker_case_records)').all().map(column => column.name));
  for (const field of BOX_HIT_FIELDS) {
    if (!caseRecordColumns.has(field.key)) database.exec(`ALTER TABLE box_tracker_case_records ADD COLUMN ${field.key} INTEGER NOT NULL DEFAULT 0`);
  }
  const winnerColumns = new Set(database.prepare('PRAGMA table_info(box_tracker_hit_winners)').all().map(column => column.name));
  if (!winnerColumns.has('spot_number')) database.exec('ALTER TABLE box_tracker_hit_winners ADD COLUMN spot_number INTEGER NOT NULL DEFAULT 0');
  if (!winnerColumns.has('sale_amount_cents')) database.exec('ALTER TABLE box_tracker_hit_winners ADD COLUMN sale_amount_cents INTEGER NOT NULL DEFAULT 0');
  if (!winnerColumns.has('card_number')) database.exec("ALTER TABLE box_tracker_hit_winners ADD COLUMN card_number TEXT NOT NULL DEFAULT ''");
  if (!winnerColumns.has('category_key')) database.exec("ALTER TABLE box_tracker_hit_winners ADD COLUMN category_key TEXT NOT NULL DEFAULT ''");
  if (!winnerColumns.has('quantity')) database.exec('ALTER TABLE box_tracker_hit_winners ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1');
  if (!winnerColumns.has('source_history_id')) database.exec('ALTER TABLE box_tracker_hit_winners ADD COLUMN source_history_id INTEGER');
  const trackerColumns = new Set(database.prepare('PRAGMA table_info(box_trackers)').all().map(column => column.name));
  if (!trackerColumns.has('overlay_title')) database.exec("ALTER TABLE box_trackers ADD COLUMN overlay_title TEXT NOT NULL DEFAULT ''");
  const trackerAdditions = [
    ['game_code', "TEXT NOT NULL DEFAULT 'ONEPIECE'"],
    ['set_code', "TEXT NOT NULL DEFAULT ''"],
    ['set_name', "TEXT NOT NULL DEFAULT ''"],
    ['record_type', "TEXT NOT NULL DEFAULT 'CASE'"],
    ['order_history_id', 'INTEGER'],
    ['pull_history_batch_id', 'INTEGER'],
    ['source_mode', "TEXT NOT NULL DEFAULT 'LEGACY'"],
    ['lifecycle_status', "TEXT NOT NULL DEFAULT 'FINALIZED'"],
    ['completed_at', 'TEXT']
  ];
  for (const [name, definition] of trackerAdditions) {
    if (!trackerColumns.has(name)) database.exec(`ALTER TABLE box_trackers ADD COLUMN ${name} ${definition}`);
  }
  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_box_trackers_order_history
      ON box_trackers(order_history_id) WHERE order_history_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_box_trackers_game_set
      ON box_trackers(game_code, set_code, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_box_trackers_lifecycle
      ON box_trackers(lifecycle_status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_box_tracker_hit_winners_history
      ON box_tracker_hit_winners(source_history_id, tracker_id);
  `);
}

// A tracker list used to load each record's boxes, history link and winners
// separately. With a growing break history that made opening Box Tracker a
// synchronous 3 × N database operation on Electron's main process.
function hydrateBoxTrackerRows(database, rows) {
  if (!rows.length) return [];
  const boxesByTracker = new Map(rows.map(row => [Number(row.id), []]));
  const linksByTracker = new Map();
  const winnersByTracker = new Map();
  // Stay below SQLite's variable limit even for a long-running seller's log.
  for (let offset = 0; offset < rows.length; offset += 300) {
    const ids = rows.slice(offset, offset + 300).map(row => Number(row.id));
    const placeholders = ids.map(() => '?').join(', ');
    const boxes = database.prepare(`
      SELECT tracker_id, box_number, status, notes, updated_at,
        ${BOX_HIT_FIELDS.map(field => field.key).join(', ')}
      FROM box_tracker_boxes WHERE tracker_id IN (${placeholders})
      ORDER BY tracker_id, box_number
    `).all(...ids);
    for (const box of boxes) boxesByTracker.get(Number(box.tracker_id)).push(box);
    const links = database.prepare(`
      SELECT link.tracker_id, link.box_number, link.history_id, link.pull_history_batch_id,
        link.linked_at, history.break_name, history.recorded_at
      FROM box_tracker_history_links link
      LEFT JOIN break_order_history history ON history.id = link.history_id
      WHERE link.tracker_id IN (${placeholders})
      ORDER BY link.tracker_id, link.box_number
    `).all(...ids);
    for (const link of links) {
      if (!linksByTracker.has(Number(link.tracker_id))) linksByTracker.set(Number(link.tracker_id), new Map());
      linksByTracker.get(Number(link.tracker_id)).set(Number(link.box_number), link);
    }
    const winners = database.prepare(`
      SELECT id, tracker_id, box_number, card_name, rarity, buyer_name, spot_number,
        sale_amount_cents, card_number, category_key, quantity,
        source_history_id, note, recorded_at
      FROM box_tracker_hit_winners WHERE tracker_id IN (${placeholders})
      ORDER BY tracker_id, box_number, id DESC
    `).all(...ids);
    for (const winner of winners) {
      const trackerId = Number(winner.tracker_id);
      if (!winnersByTracker.has(trackerId)) winnersByTracker.set(trackerId, new Map());
      const byBox = winnersByTracker.get(trackerId);
      if (!byBox.has(Number(winner.box_number))) byBox.set(Number(winner.box_number), []);
      byBox.get(Number(winner.box_number)).push(winner);
    }
  }
  return rows.map(row => {
    const id = Number(row.id);
    const boxes = boxesByTracker.get(id);
    const links = linksByTracker.get(id) || new Map();
    const winners = winnersByTracker.get(id) || new Map();
    const counts = { sealed: 0, live: 0, opened: 0 };
    const hitCounts = Object.fromEntries(BOX_HIT_FIELDS.map(field => [field.key, 0]));
    for (const box of boxes) {
      // Keep the public response identical to the old single-record loader.
      delete box.tracker_id;
      box.history_link = links.get(Number(box.box_number)) || null;
      if (box.history_link) delete box.history_link.tracker_id;
      box.hit_winners = winners.get(Number(box.box_number)) || [];
      for (const winner of box.hit_winners) delete winner.tracker_id;
      counts[box.status] = (counts[box.status] || 0) + 1;
      for (const field of BOX_HIT_FIELDS) hitCounts[field.key] += Number(box[field.key] || 0);
    }
    return {
      ...row,
      game_name: String(row.game_code || '').toUpperCase() === 'RIFTBOUND' ? 'Riftbound' : 'One Piece',
      record_type_label: TRACKER_RECORD_TYPES[String(row.record_type || '').toUpperCase()] || 'Case',
      hit_fields: trackerHitFieldsForGame(row.game_code),
      boxes,
      sealed_count: counts.sealed,
      live_count: counts.live,
      opened_count: counts.opened,
      hit_counts: hitCounts
    };
  });
}

module.exports = {
  ACTIVE_OPEN_CASE_KEY,
  ACTIVE_TRACKER_KEY,
  BOX_HIT_FIELDS,
  BOX_STATUSES,
  MAX_BOX_COUNT,
  MAX_BOX_HIT_COUNT,
  ONE_PIECE_TRACKER_HIT_FIELDS,
  RIFTBOUND_TRACKER_HIT_FIELDS,
  TRACKER_RECORD_TYPES,
  ensureBoxTrackerSchema,
  hydrateBoxTrackerRows,
  normalizeBoxCount,
  normalizeBoxHitCount,
  normalizeBoxHitCounts,
  normalizeBoxNote,
  normalizeBoxStatus,
  normalizeProductName,
  normalizeTrackerName,
  normalizeTrackerRecordType,
  requireTrackerRecordType,
  trackerHitFieldsForGame
};
