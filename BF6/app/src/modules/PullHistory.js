const MAX_TEXT = 220;

function clean(value, maximum = MAX_TEXT) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maximum);
}

function ensurePullHistorySchema(database) {
  database.exec(`
    -- Pull History is separate from Orders History. Orders retain purchased
    -- spots; these tables retain only exact cards explicitly selected in
    -- Buyer Bags after the box is opened.
    CREATE TABLE IF NOT EXISTS pull_history_batches (
      id INTEGER PRIMARY KEY,
      ledger_saved_at TEXT NOT NULL UNIQUE,
      game_code TEXT NOT NULL,
      set_code TEXT NOT NULL DEFAULT '',
      set_name TEXT NOT NULL DEFAULT '',
      recorded_at TEXT NOT NULL,
      price_refreshed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS pull_history_items (
      id INTEGER PRIMARY KEY,
      batch_id INTEGER NOT NULL,
      buyer_name TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL,
      card_name TEXT NOT NULL,
      card_number TEXT NOT NULL DEFAULT '',
      set_code TEXT NOT NULL DEFAULT '',
      rarity TEXT NOT NULL DEFAULT '',
      collector_treatment TEXT NOT NULL DEFAULT '',
      variant_hint TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity BETWEEN 1 AND 99),
      source_kind TEXT NOT NULL DEFAULT 'selected',
      market_price_cents INTEGER,
      market_source TEXT NOT NULL DEFAULT '',
      market_variant TEXT NOT NULL DEFAULT '',
      market_external_id TEXT NOT NULL DEFAULT '',
      market_updated_at TEXT,
      market_match_status TEXT NOT NULL DEFAULT '',
      FOREIGN KEY(batch_id) REFERENCES pull_history_batches(id) ON DELETE CASCADE
    );

    -- Purchase amounts are snapshotted inside Pull History so valuation never
    -- needs to read Orders History. A spot is stored once even when it has
    -- several selected pull rows.
    CREATE TABLE IF NOT EXISTS pull_history_spots (
      batch_id INTEGER NOT NULL,
      buyer_name TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL,
      paid_cents INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(batch_id, position),
      FOREIGN KEY(batch_id) REFERENCES pull_history_batches(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_pull_history_batches_recorded_at
      ON pull_history_batches(recorded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_pull_history_items_batch
      ON pull_history_items(batch_id, position, id);
    CREATE INDEX IF NOT EXISTS idx_pull_history_items_set
      ON pull_history_items(set_code, card_number);
    CREATE INDEX IF NOT EXISTS idx_pull_history_spots_buyer
      ON pull_history_spots(batch_id, buyer_name);
  `);
  const batchColumns = new Set(database.prepare('PRAGMA table_info(pull_history_batches)').all().map(column => column.name));
  if (!batchColumns.has('price_refreshed_at')) database.exec('ALTER TABLE pull_history_batches ADD COLUMN price_refreshed_at TEXT');
  const itemColumns = new Set(database.prepare('PRAGMA table_info(pull_history_items)').all().map(column => column.name));
  const additions = [
    ['variant_hint', "TEXT NOT NULL DEFAULT ''"],
    ['market_price_cents', 'INTEGER'],
    ['market_source', "TEXT NOT NULL DEFAULT ''"],
    ['market_variant', "TEXT NOT NULL DEFAULT ''"],
    ['market_external_id', "TEXT NOT NULL DEFAULT ''"],
    ['market_updated_at', 'TEXT'],
    ['market_match_status', "TEXT NOT NULL DEFAULT ''"]
  ];
  for (const [name, definition] of additions) {
    if (!itemColumns.has(name)) database.exec(`ALTER TABLE pull_history_items ADD COLUMN ${name} ${definition}`);
  }
}

function normalizePullHistoryItem(item = {}) {
  const marketPriceValue = item.marketPriceCents ?? item.market_price_cents;
  const rawMarketPrice = marketPriceValue === null || marketPriceValue === undefined || marketPriceValue === ''
    ? Number.NaN
    : Number(marketPriceValue);
  return {
    buyerName: clean(item.buyerName || item.buyer_name),
    position: Math.max(1, Math.floor(Number(item.position) || 0)),
    cardName: clean(item.cardName || item.card_name) || 'Unnamed card',
    cardNumber: clean(item.cardNumber || item.card_number, 100),
    setCode: clean(item.setCode || item.set_code, 30).toUpperCase(),
    rarity: clean(item.rarity, 80),
    collectorTreatment: clean(item.collectorTreatment || item.collector_treatment, 100),
    variantHint: clean(item.variantHint || item.variant_hint, 100),
    quantity: Math.max(1, Math.min(99, Math.floor(Number(item.quantity) || 1))),
    sourceKind: clean(item.sourceKind || item.source_kind || 'selected', 30),
    marketPriceCents: Number.isInteger(rawMarketPrice) && rawMarketPrice >= 0 ? rawMarketPrice : null,
    marketSource: clean(item.marketSource || item.market_source, 40),
    marketVariant: clean(item.marketVariant || item.market_variant, 120),
    marketExternalId: clean(item.marketExternalId || item.market_external_id, 180),
    marketUpdatedAt: clean(item.marketUpdatedAt || item.market_updated_at, 80) || null,
    marketMatchStatus: clean(item.marketMatchStatus || item.market_match_status, 30)
  };
}

function normalizePullHistorySpot(spot = {}) {
  return {
    buyerName: clean(spot.buyerName || spot.buyer_name),
    position: Math.max(1, Math.floor(Number(spot.position) || 0)),
    paidCents: Math.max(0, Math.min(100000000, Math.round(Number(spot.paidCents ?? spot.paid_cents) || 0)))
  };
}

function buyerKey(value) {
  return clean(value).replace(/^@+/, '').toLowerCase();
}

function itemPriceKey(item = {}) {
  return [
    buyerKey(item.buyerName || item.buyer_name),
    Number(item.position || 0),
    clean(item.setCode || item.set_code, 30).toUpperCase(),
    clean(item.cardNumber || item.card_number, 100).toUpperCase(),
    clean(item.cardName || item.card_name).toUpperCase(),
    clean(item.rarity, 80).toUpperCase(),
    clean(item.collectorTreatment || item.collector_treatment, 100).toUpperCase()
  ].join('|');
}

// Transaction-neutral so a Pull History correction can update the saved
// batch, its archived Order History copy, and its linked Box Tracker as one
// atomic operation. The buyer always comes from the saved spot; callers
// cannot accidentally move a missed card into a different buyer's bag.
function addPullHistoryItem(database, payload = {}) {
  const batchId = Math.floor(Number(payload.batchId || payload.batch_id));
  const position = Math.floor(Number(payload.position ?? payload.item?.position));
  if (!Number.isInteger(batchId) || batchId < 1) throw new Error('Choose a valid Pull History record first.');
  if (!Number.isInteger(position) || position < 1) throw new Error('Choose the buyer spot that pulled this card.');

  const batch = database.prepare(`
    SELECT id, game_code, set_code, set_name, recorded_at
    FROM pull_history_batches
    WHERE id = ?
  `).get(batchId);
  if (!batch) throw new Error('That Pull History record no longer exists.');
  const spot = database.prepare(`
    SELECT buyer_name, position, paid_cents
    FROM pull_history_spots
    WHERE batch_id = ? AND position = ?
  `).get(batchId, position);
  if (!spot) throw new Error('That saved spot does not belong to this Pull History record.');

  const item = normalizePullHistoryItem({
    ...(payload.item || {}),
    buyerName: spot.buyer_name,
    position: spot.position,
    sourceKind: payload.item?.sourceKind || payload.item?.source_kind || 'history-edit'
  });
  const batchSetCode = clean(batch.set_code, 30).toUpperCase();
  if (batchSetCode && batchSetCode !== 'MULTI' && item.setCode !== batchSetCode) {
    throw new Error(`Choose a ${batchSetCode} card for this saved Pull History record.`);
  }

  const existingRows = database.prepare(`
    SELECT id, buyer_name, position, card_name, card_number, set_code, rarity,
      collector_treatment, quantity
    FROM pull_history_items
    WHERE batch_id = ? AND position = ?
  `).all(batchId, position);
  const existing = existingRows.find(row => itemPriceKey(row) === itemPriceKey(item));
  let itemId = 0;
  let quantity = item.quantity;
  let merged = false;
  if (existing) {
    quantity = Number(existing.quantity || 1) + item.quantity;
    if (quantity > 99) throw new Error('That exact saved card is already at the maximum quantity of 99.');
    database.prepare('UPDATE pull_history_items SET quantity = ? WHERE id = ?').run(quantity, existing.id);
    itemId = Number(existing.id);
    merged = true;
  } else {
    const inserted = database.prepare(`
      INSERT INTO pull_history_items (
        batch_id, buyer_name, position, card_name, card_number, set_code,
        rarity, collector_treatment, variant_hint, quantity, source_kind,
        market_price_cents, market_source, market_variant, market_external_id,
        market_updated_at, market_match_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      batchId,
      item.buyerName,
      item.position,
      item.cardName,
      item.cardNumber,
      item.setCode,
      item.rarity,
      item.collectorTreatment,
      item.variantHint,
      item.quantity,
      item.sourceKind,
      item.marketPriceCents,
      item.marketSource,
      item.marketVariant,
      item.marketExternalId,
      item.marketUpdatedAt,
      item.marketMatchStatus
    );
    itemId = Number(inserted.lastInsertRowid);
  }

  const setCodes = database.prepare(`
    SELECT DISTINCT UPPER(TRIM(set_code)) AS set_code
    FROM pull_history_items
    WHERE batch_id = ? AND TRIM(set_code) != ''
    ORDER BY set_code
  `).all(batchId).map(row => row.set_code);
  const correctedSetCode = setCodes.length === 1 ? setCodes[0] : (setCodes.length ? 'MULTI' : '');
  database.prepare('UPDATE pull_history_batches SET set_code = ? WHERE id = ?').run(correctedSetCode, batchId);
  if (item.marketUpdatedAt) {
    database.prepare(`
      UPDATE pull_history_batches
      SET price_refreshed_at = CASE
        WHEN price_refreshed_at IS NULL OR price_refreshed_at < ? THEN ?
        ELSE price_refreshed_at
      END
      WHERE id = ?
    `).run(item.marketUpdatedAt, item.marketUpdatedAt, batchId);
  }

  return {
    batchId,
    itemId,
    buyerName: String(spot.buyer_name || ''),
    position,
    cardName: item.cardName,
    cardNumber: item.cardNumber,
    quantity,
    addedQuantity: item.quantity,
    merged,
    gameCode: String(batch.game_code || ''),
    setCode: correctedSetCode
  };
}

function replacePullHistorySnapshot(database, payload = {}) {
  const ledgerSavedAt = clean(payload.ledgerSavedAt || payload.ledger_saved_at, 80);
  const gameCode = clean(payload.gameCode || payload.game_code, 30).toUpperCase();
  const recordedAt = clean(payload.recordedAt || payload.recorded_at, 80) || new Date().toISOString();
  const items = (Array.isArray(payload.items) ? payload.items : []).map(normalizePullHistoryItem);
  const spots = (Array.isArray(payload.spots) ? payload.spots : []).map(normalizePullHistorySpot);
  if (!ledgerSavedAt) throw new Error('Save Board ✓ first so Pull History can identify this live board.');
  if (!gameCode) throw new Error('The live board game could not be identified.');
  if (!items.length) throw new Error('Select at least one actual pulled card in Buyer Bags first.');

  const setCodes = [...new Set(items.map(item => item.setCode).filter(Boolean))];
  const setCode = setCodes.length === 1 ? setCodes[0] : (setCodes.length ? 'MULTI' : '');
  const setName = clean(payload.setName || payload.set_name);
  const cachedPriceRefreshedAt = items
    .map(item => item.marketUpdatedAt)
    .filter(Boolean)
    .sort()
    .at(-1) || null;
  let batchId = 0;
  let updated = false;
  database.exec('BEGIN IMMEDIATE');
  try {
    const existing = database.prepare('SELECT id FROM pull_history_batches WHERE ledger_saved_at = ?').get(ledgerSavedAt);
    updated = Boolean(existing);
    database.prepare(`
      INSERT INTO pull_history_batches (ledger_saved_at, game_code, set_code, set_name, recorded_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(ledger_saved_at) DO UPDATE SET
        game_code = excluded.game_code,
        set_code = excluded.set_code,
        set_name = excluded.set_name,
        recorded_at = excluded.recorded_at
    `).run(ledgerSavedAt, gameCode, setCode, setName, recordedAt);
    batchId = Number(database.prepare('SELECT id FROM pull_history_batches WHERE ledger_saved_at = ?').get(ledgerSavedAt).id);
    const savedPrices = new Map(database.prepare(`
      SELECT buyer_name, position, card_name, card_number, set_code, rarity,
        collector_treatment, market_price_cents, market_source, market_variant,
        market_external_id, market_updated_at, market_match_status
      FROM pull_history_items
      WHERE batch_id = ?
    `).all(batchId).map(item => [itemPriceKey(item), item]));
    database.prepare('DELETE FROM pull_history_items WHERE batch_id = ?').run(batchId);
    database.prepare('DELETE FROM pull_history_spots WHERE batch_id = ?').run(batchId);
    const insert = database.prepare(`
      INSERT INTO pull_history_items (
        batch_id, buyer_name, position, card_name, card_number, set_code,
        rarity, collector_treatment, variant_hint, quantity, source_kind,
        market_price_cents, market_source, market_variant, market_external_id,
        market_updated_at, market_match_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of items) {
      const savedPrice = savedPrices.get(itemPriceKey(item)) || {
        market_price_cents: item.marketPriceCents,
        market_source: item.marketSource,
        market_variant: item.marketVariant,
        market_external_id: item.marketExternalId,
        market_updated_at: item.marketUpdatedAt,
        market_match_status: item.marketMatchStatus
      };
      insert.run(
        batchId,
        item.buyerName,
        item.position,
        item.cardName,
        item.cardNumber,
        item.setCode,
        item.rarity,
        item.collectorTreatment,
        item.variantHint,
        item.quantity,
        item.sourceKind,
        savedPrice.market_price_cents ?? null,
        savedPrice.market_source || '',
        savedPrice.market_variant || '',
        savedPrice.market_external_id || '',
        savedPrice.market_updated_at || null,
        savedPrice.market_match_status || ''
      );
    }
    if (cachedPriceRefreshedAt) {
      database.prepare(`
        UPDATE pull_history_batches
        SET price_refreshed_at = CASE
          WHEN price_refreshed_at IS NULL OR price_refreshed_at < ? THEN ?
          ELSE price_refreshed_at
        END
        WHERE id = ?
      `).run(cachedPriceRefreshedAt, cachedPriceRefreshedAt, batchId);
    }
    const insertSpot = database.prepare(`
      INSERT INTO pull_history_spots (batch_id, buyer_name, position, paid_cents)
      VALUES (?, ?, ?, ?)
    `);
    const uniqueSpots = new Map(spots.map(spot => [spot.position, spot]));
    for (const spot of uniqueSpots.values()) {
      insertSpot.run(batchId, spot.buyerName, spot.position, spot.paidCents);
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  return {
    id: batchId,
    updated,
    gameCode,
    setCode,
    recordedAt,
    uniqueCards: items.length,
    savedCards: items.reduce((total, item) => total + item.quantity, 0),
    savedSpots: spots.length,
    capturedSpendCents: spots.reduce((total, spot) => total + spot.paidCents, 0)
  };
}

function summarizePullHistoryBatch(items, spots) {
  const buyers = new Map();
  const ensureBuyer = (name) => {
    const key = buyerKey(name) || `unknown:${clean(name)}`;
    if (!buyers.has(key)) buyers.set(key, {
      buyer_name: clean(name) || 'Unknown buyer',
      spot_count: 0,
      missing_spot_prices: 0,
      paid_cents: 0,
      pulled_cards: 0,
      priced_cards: 0,
      unpriced_cards: 0,
      pull_value_cents: 0
    });
    return buyers.get(key);
  };
  for (const spot of spots) {
    const buyer = ensureBuyer(spot.buyer_name);
    buyer.spot_count += 1;
    buyer.paid_cents += Math.max(0, Number(spot.paid_cents || 0));
    if (Number(spot.paid_cents || 0) <= 0) buyer.missing_spot_prices += 1;
  }
  for (const item of items) {
    const buyer = ensureBuyer(item.buyer_name);
    const quantity = Math.max(1, Number(item.quantity || 1));
    buyer.pulled_cards += quantity;
    if (Number.isInteger(item.market_price_cents) && item.market_price_cents >= 0) {
      buyer.priced_cards += quantity;
      buyer.pull_value_cents += item.market_price_cents * quantity;
    } else {
      buyer.unpriced_cards += quantity;
    }
  }
  const buyerSummaries = [...buyers.values()].map(buyer => ({
    ...buyer,
    complete: buyer.unpriced_cards === 0 && buyer.missing_spot_prices === 0 && buyer.pulled_cards > 0 && buyer.spot_count > 0,
    value_difference_cents: buyer.pull_value_cents - buyer.paid_cents
  })).sort((left, right) => right.paid_cents - left.paid_cents || left.buyer_name.localeCompare(right.buyer_name));
  const totals = buyerSummaries.reduce((total, buyer) => ({
    spot_count: total.spot_count + buyer.spot_count,
    missing_spot_prices: total.missing_spot_prices + buyer.missing_spot_prices,
    paid_cents: total.paid_cents + buyer.paid_cents,
    pulled_cards: total.pulled_cards + buyer.pulled_cards,
    priced_cards: total.priced_cards + buyer.priced_cards,
    unpriced_cards: total.unpriced_cards + buyer.unpriced_cards,
    pull_value_cents: total.pull_value_cents + buyer.pull_value_cents
  }), { spot_count: 0, missing_spot_prices: 0, paid_cents: 0, pulled_cards: 0, priced_cards: 0, unpriced_cards: 0, pull_value_cents: 0 });
  return {
    buyers: buyerSummaries,
    totals: {
      ...totals,
      complete: buyerSummaries.length > 0 && buyerSummaries.every(buyer => buyer.complete),
      value_difference_cents: totals.pull_value_cents - totals.paid_cents
    }
  };
}

function listPullHistory(database, options = {}) {
  const requestedLimit = Number(options.limit);
  const requestedOffset = Number(options.offset);
  const hasLimit = Number.isInteger(requestedLimit) && requestedLimit > 0;
  const limit = hasLimit ? Math.min(250, requestedLimit) : null;
  const offset = Number.isInteger(requestedOffset) && requestedOffset > 0 ? requestedOffset : 0;
  const hasOrderHistory = Boolean(database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='break_order_history'").get());
  const savedBoxNameSql = hasOrderHistory
    ? `, COALESCE((SELECT h.break_name FROM break_order_history h WHERE h.pull_history_batch_id = pull_history_batches.id ORDER BY h.id DESC LIMIT 1), '') AS saved_box_name`
    : ", '' AS saved_box_name";
  const batchSql = `
    SELECT id, ledger_saved_at, game_code, set_code, set_name, recorded_at, price_refreshed_at${savedBoxNameSql}
    FROM pull_history_batches
    ORDER BY recorded_at DESC, id DESC
    ${hasLimit ? 'LIMIT ? OFFSET ?' : ''}
  `;
  const batches = hasLimit
    ? database.prepare(batchSql).all(limit, offset)
    : database.prepare(batchSql).all();
  const itemsForBatch = database.prepare(`
    SELECT id, batch_id, buyer_name, position, card_name, card_number, set_code,
      rarity, collector_treatment, variant_hint, quantity, source_kind,
      market_price_cents, market_source, market_variant, market_external_id,
      market_updated_at, market_match_status
    FROM pull_history_items
    WHERE batch_id = ?
    ORDER BY position ASC, card_number ASC, card_name ASC, id ASC
  `);
  const spotsForBatch = database.prepare(`
    SELECT batch_id, buyer_name, position, paid_cents
    FROM pull_history_spots
    WHERE batch_id = ?
    ORDER BY position ASC
  `);
  return batches.map(batch => {
    const items = itemsForBatch.all(batch.id).map(item => ({
      ...item,
      market_total_cents: Number.isInteger(item.market_price_cents)
        ? item.market_price_cents * Math.max(1, Number(item.quantity || 1))
        : null
    }));
    const spots = spotsForBatch.all(batch.id);
    const valuation = summarizePullHistoryBatch(items, spots);
    return {
      ...batch,
      total_cards: items.reduce((total, item) => total + Number(item.quantity || 1), 0),
      items,
      spots,
      buyer_summaries: valuation.buyers,
      valuation: valuation.totals
    };
  });
}

function pullHistoryImageRows(database, batchIds) {
  const ids = Array.isArray(batchIds)
    ? [...new Set(batchIds.map(Number).filter(id => Number.isInteger(id) && id > 0))]
    : null;
  if (ids && !ids.length) return [];
  const filter = ids ? `WHERE i.batch_id IN (${ids.map(() => '?').join(', ')})` : '';
  return database.prepare(`
    SELECT i.id AS pull_item_id,
      (SELECT c.image_path FROM cards c
        WHERE UPPER(TRIM(c.card_number)) = UPPER(TRIM(i.card_number))
          AND UPPER(TRIM(c.set_code)) = UPPER(TRIM(i.set_code))
        ORDER BY CASE WHEN TRIM(COALESCE(c.image_path, '')) != '' THEN 0 ELSE 1 END,
          c.id ASC LIMIT 1) AS image_path,
      (SELECT c.image_url FROM cards c
        WHERE UPPER(TRIM(c.card_number)) = UPPER(TRIM(i.card_number))
          AND UPPER(TRIM(c.set_code)) = UPPER(TRIM(i.set_code))
        ORDER BY CASE WHEN TRIM(COALESCE(c.image_path, '')) != '' THEN 0 ELSE 1 END,
          c.id ASC LIMIT 1) AS image_url
    FROM pull_history_items i
    ${filter}
  `).all(...(ids || []));
}

function deletePullHistoryBatch(database, value) {
  const id = Number(value?.id ?? value);
  if (!Number.isInteger(id) || id < 1) throw new Error('Choose a valid Pull History record first.');
  const existing = database.prepare(`
    SELECT id, game_code, set_code, set_name, recorded_at
    FROM pull_history_batches
    WHERE id = ?
  `).get(id);
  if (!existing) throw new Error('That Pull History record no longer exists.');
  database.prepare('DELETE FROM pull_history_batches WHERE id = ?').run(id);
  return { ...existing, deleted: true };
}

module.exports = {
  addPullHistoryItem,
  ensurePullHistorySchema,
  deletePullHistoryBatch,
  itemPriceKey,
  listPullHistory,
  normalizePullHistoryItem,
  normalizePullHistorySpot,
  pullHistoryImageRows,
  summarizePullHistoryBatch,
  replacePullHistorySnapshot
};
