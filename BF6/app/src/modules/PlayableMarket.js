const RIFTBOUND_SETS = Object.freeze([
  Object.freeze({ set_code: 'OGN', set_name: 'Origins', set_order: 1 }),
  Object.freeze({ set_code: 'OGS', set_name: 'Origins - Proving Grounds', set_order: 2 }),
  Object.freeze({ set_code: 'SFD', set_name: 'Spiritforged', set_order: 3 }),
  Object.freeze({ set_code: 'UNL', set_name: 'Unleashed', set_order: 4 }),
  Object.freeze({ set_code: 'VEN', set_name: 'Vendetta', set_order: 5 })
]);

const WINDOWS = Object.freeze(['24h', '7d', '30d', '90d']);
const SIGNALS = new Set(['ON_FIRE', 'RISING', 'BUY_DIP', 'TAKE_PROFIT', 'WATCH', 'STABLE']);
const TIERS = new Set(['STAPLE', 'META', 'NICHE', 'SPECULATIVE']);
const CONFIDENCE = new Set(['HIGH', 'MEDIUM', 'LOW']);

function clean(value = '', max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}

function setCode(value = '') {
  return clean(value, 24).toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

function normalizeWindow(value = '') {
  const normalized = clean(value, 8).toLowerCase();
  return WINDOWS.includes(normalized) ? normalized : '24h';
}

function enumValue(value, allowed, fallback) {
  const normalized = clean(value, 40).toUpperCase().replace(/[\s-]+/g, '_');
  if (normalized === 'HOT' || normalized === 'FIRE') return allowed === SIGNALS ? 'ON_FIRE' : fallback;
  if (normalized === 'DIP' || normalized === 'BUY') return allowed === SIGNALS ? 'BUY_DIP' : fallback;
  return allowed.has(normalized) ? normalized : fallback;
}

function moneyToCents(value, { required = false } = {}) {
  if (value === null || value === undefined || value === '') {
    if (required) throw new Error('Current price is required.');
    return null;
  }
  const normalized = typeof value === 'string' ? value.replace(/[$,\s]/g, '') : value;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1000000) {
    throw new Error('Prices must be valid non-negative USD amounts.');
  }
  return Math.round((amount + Number.EPSILON) * 100);
}

function httpsUrl(value = '') {
  const raw = clean(value, 2000);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}

function normalizeSources(entry = {}) {
  const supplied = Array.isArray(entry.sources) ? [...entry.sources] : [];
  if (!supplied.length && (entry.sourceUrl || entry.sourceName)) {
    supplied.push({ name: entry.sourceName || 'Market source', url: entry.sourceUrl });
  }
  const seen = new Set();
  const sources = [];
  for (const source of supplied.slice(0, 8)) {
    const url = httpsUrl(source?.url || source?.sourceUrl);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    sources.push({
      name: clean(source?.name || source?.sourceName || new URL(url).hostname, 100),
      url,
      note: clean(source?.note || source?.basis, 240)
    });
  }
  return sources;
}

function safeJson(value, fallback = []) {
  try {
    const parsed = JSON.parse(String(value || ''));
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function validTimestamp(value) {
  const parsed = new Date(value || Date.now());
  if (!Number.isFinite(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function change(currentCents, priorCents) {
  if (!Number.isInteger(currentCents) || !Number.isInteger(priorCents) || priorCents <= 0) {
    return { cents: null, pct: null };
  }
  const cents = currentCents - priorCents;
  return { cents, pct: (cents / priorCents) * 100 };
}

function initPlayableMarket(db) {
  db.exec(`
CREATE TABLE IF NOT EXISTS playable_market_watchlist(
  card_id INTEGER PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE,
  playability_tier TEXT NOT NULL DEFAULT 'META',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS playable_market_batches(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  set_code TEXT NOT NULL,
  researched_at TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  card_count INTEGER NOT NULL DEFAULT 0,
  replace_set INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS playable_market_snapshots(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER REFERENCES playable_market_batches(id) ON DELETE SET NULL,
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  captured_at TEXT NOT NULL,
  current_price_cents INTEGER NOT NULL,
  price_24h_cents INTEGER,
  price_7d_cents INTEGER,
  price_30d_cents INTEGER,
  price_90d_cents INTEGER,
  signal TEXT NOT NULL DEFAULT 'WATCH',
  playability_tier TEXT NOT NULL DEFAULT 'META',
  confidence TEXT NOT NULL DEFAULT 'MEDIUM',
  analysis TEXT NOT NULL DEFAULT '',
  catalyst TEXT NOT NULL DEFAULT '',
  source_json TEXT NOT NULL DEFAULT '[]',
  buy_url TEXT NOT NULL DEFAULT '',
  sell_url TEXT NOT NULL DEFAULT '',
  UNIQUE(card_id, captured_at)
);
CREATE INDEX IF NOT EXISTS idx_playable_market_snapshot_card_time ON playable_market_snapshots(card_id,captured_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_playable_market_batch_set_time ON playable_market_batches(set_code,researched_at DESC);
`);
}

function getSets(db) {
  const imported = db.prepare(`
SELECT UPPER(TRIM(set_code)) AS set_code,
       MAX(COALESCE(NULLIF(set_name,''),set_code)) AS set_name,
       COUNT(*) AS card_count
FROM cards
WHERE UPPER(TRIM(COALESCE(game_code,'')))='RIFTBOUND'
  AND TRIM(COALESCE(set_code,''))!=''
GROUP BY UPPER(TRIM(set_code))`).all();
  const tracked = db.prepare(`
SELECT UPPER(TRIM(c.set_code)) AS set_code, COUNT(*) AS tracked_count,
       MAX(s.captured_at) AS last_researched_at
FROM playable_market_watchlist w
JOIN cards c ON c.id=w.card_id
LEFT JOIN playable_market_snapshots s ON s.id=(
  SELECT s2.id FROM playable_market_snapshots s2
  WHERE s2.card_id=w.card_id ORDER BY s2.captured_at DESC,s2.id DESC LIMIT 1
)
WHERE UPPER(TRIM(COALESCE(c.game_code,'')))='RIFTBOUND'
GROUP BY UPPER(TRIM(c.set_code))`).all();

  const rows = new Map(RIFTBOUND_SETS.map(set => [set.set_code, {
    ...set,
    card_count: 0,
    tracked_count: 0,
    last_researched_at: null
  }]));
  for (const row of imported) {
    const code = setCode(row.set_code);
    if (!code) continue;
    rows.set(code, {
      ...(rows.get(code) || { set_code: code, set_name: row.set_name || code, set_order: 999 }),
      set_name: row.set_name || rows.get(code)?.set_name || code,
      card_count: Number(row.card_count || 0)
    });
  }
  for (const row of tracked) {
    const code = setCode(row.set_code);
    if (!rows.has(code)) continue;
    Object.assign(rows.get(code), {
      tracked_count: Number(row.tracked_count || 0),
      last_researched_at: row.last_researched_at || null
    });
  }
  return [...rows.values()].sort((left, right) => left.set_order - right.set_order || left.set_code.localeCompare(right.set_code));
}

function prepareResearch(db, requestedSetCode) {
  const code = setCode(requestedSetCode);
  if (!code) throw new Error('Choose one Riftbound set before copying a research request.');
  const set = getSets(db).find(row => row.set_code === code);
  if (!set) throw new Error('That Riftbound set is not available in this library.');
  const rows = db.prepare(`
SELECT id,name,card_number,set_code,set_name,rarity,color,card_type,cost,power,
       COALESCE(NULLIF(manual_category,''),NULLIF(variant,''),'Standard') AS treatment
FROM cards
WHERE UPPER(TRIM(COALESCE(game_code,'')))='RIFTBOUND'
  AND UPPER(TRIM(set_code))=?
ORDER BY card_number COLLATE NOCASE,name COLLATE NOCASE,id`).all(code);
  if (!rows.length) throw new Error(`${set.set_name || code} has no imported cards yet. Sync the Riftbound Library first.`);
  return {
    set: { setCode: code, setName: set.set_name, cardCount: rows.length },
    candidates: rows.slice(0, 700).map(row => ({
      id: Number(row.id),
      name: row.name,
      cardNumber: row.card_number || '',
      rarity: row.rarity || '',
      type: row.card_type || '',
      color: row.color || '',
      cost: row.cost || '',
      power: row.power || '',
      treatment: row.treatment || 'Standard'
    }))
  };
}

function latestRows(db) {
  return db.prepare(`
SELECT c.id,c.name,c.card_number,c.set_code,c.set_name,c.rarity,c.color,c.card_type,
       c.image_url,c.image_path,c.game_code,c.detail_url,
       w.playability_tier AS watchlist_tier,w.created_at AS tracked_at,w.updated_at AS tracked_updated_at,
       s.id AS snapshot_id,s.captured_at,s.current_price_cents,s.price_24h_cents,s.price_7d_cents,
       s.price_30d_cents,s.price_90d_cents,s.signal,s.playability_tier,s.confidence,
       s.analysis,s.catalyst,s.source_json,s.buy_url,s.sell_url
FROM playable_market_watchlist w
JOIN cards c ON c.id=w.card_id
LEFT JOIN playable_market_snapshots s ON s.id=(
  SELECT s2.id FROM playable_market_snapshots s2
  WHERE s2.card_id=w.card_id ORDER BY s2.captured_at DESC,s2.id DESC LIMIT 1
)
WHERE UPPER(TRIM(COALESCE(c.game_code,'')))='RIFTBOUND'`).all();
}

function marketCard(row) {
  const current = Number.isInteger(row.current_price_cents) ? row.current_price_cents : null;
  const prices = {
    current,
    '24h': Number.isInteger(row.price_24h_cents) ? row.price_24h_cents : null,
    '7d': Number.isInteger(row.price_7d_cents) ? row.price_7d_cents : null,
    '30d': Number.isInteger(row.price_30d_cents) ? row.price_30d_cents : null,
    '90d': Number.isInteger(row.price_90d_cents) ? row.price_90d_cents : null
  };
  const changes = Object.fromEntries(WINDOWS.map(window => [window, change(current, prices[window])]));
  return {
    id: Number(row.id),
    name: row.name,
    card_number: row.card_number || '',
    set_code: row.set_code || '',
    set_name: row.set_name || '',
    rarity: row.rarity || '',
    color: row.color || '',
    card_type: row.card_type || '',
    image_url: row.image_url || '',
    image_path: row.image_path || '',
    detail_url: row.detail_url || '',
    game_code: 'RIFTBOUND',
    captured_at: row.captured_at || null,
    tracked_at: row.tracked_at || null,
    prices,
    changes,
    signal: enumValue(row.signal, SIGNALS, 'WATCH'),
    playability_tier: enumValue(row.playability_tier || row.watchlist_tier, TIERS, 'META'),
    confidence: enumValue(row.confidence, CONFIDENCE, 'MEDIUM'),
    analysis: row.analysis || '',
    catalyst: row.catalyst || '',
    sources: safeJson(row.source_json, []),
    buy_url: httpsUrl(row.buy_url),
    sell_url: httpsUrl(row.sell_url)
  };
}

function getDashboard(db, options = {}) {
  const selectedSet = setCode(options.setCode);
  const selectedSignal = clean(options.signal, 30).toUpperCase();
  const selectedWindow = normalizeWindow(options.window);
  const query = clean(options.query, 200).toLowerCase();
  const sort = clean(options.sort, 30).toLowerCase() || 'change';
  const direction = clean(options.direction, 8).toLowerCase() === 'asc' ? 1 : -1;
  let cards = latestRows(db).map(marketCard);
  if (selectedSet && selectedSet !== 'ALL') cards = cards.filter(card => setCode(card.set_code) === selectedSet);
  const summaryCards = [...cards];
  if (selectedSignal && selectedSignal !== 'ALL') cards = cards.filter(card => card.signal === selectedSignal);
  if (query) cards = cards.filter(card => [card.name, card.card_number, card.set_code, card.rarity, card.card_type, card.analysis, card.catalyst].join(' ').toLowerCase().includes(query));

  function nullableNumber(value, nullValue) {
    return Number.isFinite(Number(value)) ? Number(value) : nullValue;
  }
  cards.sort((left, right) => {
    let comparison = 0;
    if (sort === 'price') comparison = nullableNumber(left.prices.current, direction > 0 ? Infinity : -Infinity) - nullableNumber(right.prices.current, direction > 0 ? Infinity : -Infinity);
    else if (sort === 'name') comparison = left.name.localeCompare(right.name);
    else if (sort === 'updated') comparison = String(left.captured_at || '').localeCompare(String(right.captured_at || ''));
    else comparison = nullableNumber(left.changes[selectedWindow].pct, direction > 0 ? Infinity : -Infinity) - nullableNumber(right.changes[selectedWindow].pct, direction > 0 ? Infinity : -Infinity);
    if (comparison === 0) comparison = left.name.localeCompare(right.name);
    return comparison * direction;
  });

  const biggestMover = [...summaryCards]
    .filter(card => Number.isFinite(card.changes[selectedWindow].pct))
    .sort((left, right) => Math.abs(right.changes[selectedWindow].pct) - Math.abs(left.changes[selectedWindow].pct))[0] || null;
  const lastResearchAt = summaryCards.reduce((latest, card) => String(card.captured_at || '') > String(latest || '') ? card.captured_at : latest, null);
  return {
    window: selectedWindow,
    cards,
    summary: {
      tracked: summaryCards.length,
      onFire: summaryCards.filter(card => card.signal === 'ON_FIRE' || card.signal === 'RISING').length,
      buyDips: summaryCards.filter(card => card.signal === 'BUY_DIP').length,
      takeProfit: summaryCards.filter(card => card.signal === 'TAKE_PROFIT').length,
      biggestMover: biggestMover ? { id: biggestMover.id, name: biggestMover.name, pct: biggestMover.changes[selectedWindow].pct } : null,
      lastResearchAt
    }
  };
}

function preparedEntry(entry, catalogById) {
  const id = Number(entry?.id);
  const card = catalogById.get(id);
  if (!Number.isInteger(id) || !card) throw new Error('Card id is not in the selected set.');
  const sources = normalizeSources(entry);
  if (!sources.length) throw new Error('At least one supporting HTTPS source is required.');
  return {
    id,
    current: moneyToCents(entry.currentPriceUsd ?? entry.priceUsd, { required: true }),
    price24h: moneyToCents(entry.price24hAgoUsd),
    price7d: moneyToCents(entry.price7dAgoUsd),
    price30d: moneyToCents(entry.price30dAgoUsd),
    price90d: moneyToCents(entry.price90dAgoUsd),
    signal: enumValue(entry.signal, SIGNALS, 'WATCH'),
    tier: enumValue(entry.playabilityTier, TIERS, 'META'),
    confidence: enumValue(entry.confidence, CONFIDENCE, 'MEDIUM'),
    analysis: clean(entry.analysis, 1400),
    catalyst: clean(entry.catalyst, 800),
    sources,
    buyUrl: httpsUrl(entry.buyUrl) || sources[0].url,
    sellUrl: httpsUrl(entry.sellUrl)
  };
}

function applyResearch(db, payload = {}) {
  const code = setCode(payload.setCode);
  if (!code) throw new Error('A Riftbound set code is required.');
  const entries = Array.isArray(payload.cards) ? payload.cards : Array.isArray(payload.playables) ? payload.playables : [];
  if (!entries.length) throw new Error('The JSON needs a cards array with at least one researched playable.');
  if (entries.length > 700) throw new Error('This research batch is too large. Import one set at a time.');
  const catalog = db.prepare(`
SELECT id,name,card_number FROM cards
WHERE UPPER(TRIM(COALESCE(game_code,'')))='RIFTBOUND' AND UPPER(TRIM(set_code))=?`).all(code);
  if (!catalog.length) throw new Error('This set is not imported in the Riftbound Library yet.');
  const catalogById = new Map(catalog.map(card => [Number(card.id), card]));
  const valid = new Map();
  const skipped = [];
  for (const entry of entries) {
    try {
      const prepared = preparedEntry(entry, catalogById);
      valid.set(prepared.id, prepared);
    } catch (error) {
      skipped.push({ id: Number(entry?.id) || null, reason: error.message });
    }
  }
  if (!valid.size) throw new Error(skipped[0]?.reason || 'No valid playable cards were found in that response.');

  const capturedAt = validTimestamp(payload.researchedAt || payload.asOf);
  const importedAt = new Date().toISOString();
  const replaceSet = Boolean(payload.replaceSet);
  const insertBatch = db.prepare(`INSERT INTO playable_market_batches(set_code,researched_at,imported_at,card_count,replace_set) VALUES(?,?,?,?,?)`);
  const upsertWatch = db.prepare(`
INSERT INTO playable_market_watchlist(card_id,playability_tier,created_at,updated_at) VALUES(?,?,?,?)
ON CONFLICT(card_id) DO UPDATE SET playability_tier=excluded.playability_tier,updated_at=excluded.updated_at`);
  const insertSnapshot = db.prepare(`
INSERT INTO playable_market_snapshots(
  batch_id,card_id,captured_at,current_price_cents,price_24h_cents,price_7d_cents,price_30d_cents,price_90d_cents,
  signal,playability_tier,confidence,analysis,catalyst,source_json,buy_url,sell_url
) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
ON CONFLICT(card_id,captured_at) DO UPDATE SET
  batch_id=excluded.batch_id,current_price_cents=excluded.current_price_cents,
  price_24h_cents=excluded.price_24h_cents,price_7d_cents=excluded.price_7d_cents,
  price_30d_cents=excluded.price_30d_cents,price_90d_cents=excluded.price_90d_cents,
  signal=excluded.signal,playability_tier=excluded.playability_tier,confidence=excluded.confidence,
  analysis=excluded.analysis,catalyst=excluded.catalyst,source_json=excluded.source_json,
  buy_url=excluded.buy_url,sell_url=excluded.sell_url`);

  db.exec('BEGIN IMMEDIATE');
  let batchId;
  try {
    if (replaceSet) {
      db.prepare(`DELETE FROM playable_market_watchlist WHERE card_id IN(
        SELECT id FROM cards WHERE UPPER(TRIM(COALESCE(game_code,'')))='RIFTBOUND' AND UPPER(TRIM(set_code))=?
      )`).run(code);
    }
    batchId = Number(insertBatch.run(code, capturedAt, importedAt, valid.size, replaceSet ? 1 : 0).lastInsertRowid);
    for (const entry of valid.values()) {
      upsertWatch.run(entry.id, entry.tier, importedAt, importedAt);
      insertSnapshot.run(
        batchId, entry.id, capturedAt, entry.current, entry.price24h, entry.price7d, entry.price30d, entry.price90d,
        entry.signal, entry.tier, entry.confidence, entry.analysis, entry.catalyst, JSON.stringify(entry.sources), entry.buyUrl, entry.sellUrl
      );
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const trackedCount = Number(db.prepare(`
SELECT COUNT(*) AS count FROM playable_market_watchlist w JOIN cards c ON c.id=w.card_id
WHERE UPPER(TRIM(COALESCE(c.game_code,'')))='RIFTBOUND' AND UPPER(TRIM(c.set_code))=?`).get(code)?.count || 0);
  return {
    batchId,
    setCode: code,
    importedCards: valid.size,
    skippedCards: skipped.length,
    skipped: skipped.slice(0, 20),
    trackedCards: trackedCount,
    researchedAt: capturedAt,
    replacedSet: replaceSet
  };
}

function removeTrackedCard(db, cardId) {
  const id = Number(cardId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('A valid card id is required.');
  const result = db.prepare('DELETE FROM playable_market_watchlist WHERE card_id=?').run(id);
  return { removed: Number(result.changes || 0), cardId: id };
}

module.exports = {
  initPlayableMarket,
  getSets,
  prepareResearch,
  getDashboard,
  applyResearch,
  removeTrackedCard,
  _test: { change, moneyToCents, normalizeSources, normalizeWindow, marketCard }
};
