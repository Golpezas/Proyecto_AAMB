function buyerKey(value) {
  return String(value || '').trim().replace(/^@+/, '').toLowerCase();
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function tableExists(database, name) {
  return Boolean(database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
}

function tableHasColumns(database, name, required = []) {
  if (!tableExists(database, name)) return false;
  const columns = new Set(database.prepare(`PRAGMA table_info(${name})`).all().map(row => String(row.name || '')));
  return required.every(column => columns.has(column));
}

function normalizedPullSignature(row = {}) {
  return [
    Number(row.position || 0),
    buyerKey(row.buyer_name),
    clean(row.set_code).toUpperCase(),
    clean(row.card_number).toUpperCase(),
    clean(row.card_name).toUpperCase(),
    clean(row.rarity).toUpperCase(),
    clean(row.collector_treatment).toUpperCase(),
    Math.max(1, Number(row.quantity || 1))
  ].join('|');
}

function normalizedSpotSignature(row = {}) {
  return `${Number(row.position || 0)}|${buyerKey(row.buyer_name)}`;
}

function signaturesEqual(left = [], right = []) {
  if (left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((value, index) => value === b[index]);
}

function auditBuyerPurchases(database, options = {}) {
  const repair = options.repair !== false;
  const checkedAt = new Date().toISOString();
  const histories = database.prepare(`
    SELECT id, break_name, disposition, recorded_at, pull_history_batch_id, pull_history_link_verified
    FROM break_order_history
    WHERE UPPER(TRIM(COALESCE(disposition,'NORMAL_BREAK'))) = 'NORMAL_BREAK'
    ORDER BY recorded_at ASC, id ASC
  `).all();
  const historyIds = histories.map(row => Number(row.id));
  const getHistoryItems = database.prepare(`
    SELECT history_id, position, buyer_name, sale_amount_cents
    FROM break_order_history_items WHERE history_id = ? ORDER BY position, id
  `);
  const getHistoryPulls = database.prepare(`
    SELECT history_id, position, buyer_name, card_name, card_number, set_code,
      rarity, collector_treatment, quantity
    FROM break_order_history_pulls WHERE history_id = ? ORDER BY position, id
  `);
  const batches = database.prepare(`
    SELECT id, recorded_at FROM pull_history_batches ORDER BY recorded_at ASC, id ASC
  `).all();
  const getBatchSpots = database.prepare(`
    SELECT batch_id, position, buyer_name, paid_cents
    FROM pull_history_spots WHERE batch_id = ? ORDER BY position
  `);
  const getBatchItems = database.prepare(`
    SELECT batch_id, position, buyer_name, card_name, card_number, set_code,
      rarity, collector_treatment, quantity, market_price_cents
    FROM pull_history_items WHERE batch_id = ? ORDER BY position, id
  `);
  const batchCache = new Map();
  const batchRecord = id => {
    const batchId = Number(id);
    if (!batchCache.has(batchId)) batchCache.set(batchId, {
      spots: getBatchSpots.all(batchId),
      items: getBatchItems.all(batchId)
    });
    return batchCache.get(batchId);
  };
  const hasBreakRounds = tableExists(database, 'break_rounds');
  const roundLinks = hasBreakRounds ? database.prepare(`
    SELECT id AS round_id, order_history_id, pull_history_batch_id
    FROM break_rounds
    WHERE order_history_id IS NOT NULL AND pull_history_batch_id IS NOT NULL
    ORDER BY id ASC
  `).all() : [];
  const roundByHistory = new Map(roundLinks.map(row => [Number(row.order_history_id), row]));
  const getRoundCards = hasBreakRounds && tableHasColumns(database, 'break_round_cards', ['round_id', 'position', 'buyer_name', 'sale_amount_cents'])
    ? database.prepare(`
        SELECT round_id, position, buyer_name, sale_amount_cents
        FROM break_round_cards WHERE round_id = ? ORDER BY position
      `)
    : null;

  let linkedFromRounds = 0;
  let linkedFromExactSnapshot = 0;
  let recoveredOrderPrices = 0;
  let recoveredPullPrices = 0;
  let recoveredRoundPrices = 0;
  let insertedMissingPullSpots = 0;
  let summaryRowsRepaired = 0;
  let conflictingSpotPrices = 0;
  let buyerPositionConflicts = 0;
  let ambiguousHistoryLinks = 0;
  let invalidHistoryLinksCleared = 0;
  let verifiedExistingLinks = 0;
  let roundLinkConflicts = 0;
  let usedBatchIds = new Set();

  if (repair) database.exec('BEGIN IMMEDIATE');
  try {
    // Existing links are trusted only after they match the immutable archived
    // pull snapshot (or were already verified by a current-version archive).
    for (const history of histories) {
      const batchId = Number(history.pull_history_batch_id || 0);
      if (!batchId) continue;
      const batchExists = Boolean(database.prepare('SELECT 1 FROM pull_history_batches WHERE id=?').get(batchId));
      const historyPulls = getHistoryPulls.all(history.id);
      if (batchExists && historyPulls.length) {
        const exact = signaturesEqual(historyPulls.map(normalizedPullSignature), batchRecord(batchId).items.map(normalizedPullSignature));
        if (exact) {
          if (!Number(history.pull_history_link_verified || 0)) {
            if (repair) database.prepare('UPDATE break_order_history SET pull_history_link_verified=1 WHERE id=?').run(history.id);
            history.pull_history_link_verified = 1;
            verifiedExistingLinks += 1;
          }
          continue;
        }
        if (repair) database.prepare('UPDATE break_order_history SET pull_history_batch_id=NULL, pull_history_link_verified=0 WHERE id=?').run(history.id);
        history.pull_history_batch_id = null;
        history.pull_history_link_verified = 0;
        invalidHistoryLinksCleared += 1;
      } else if (!batchExists) {
        if (repair) database.prepare('UPDATE break_order_history SET pull_history_batch_id=NULL, pull_history_link_verified=0 WHERE id=?').run(history.id);
        history.pull_history_batch_id = null;
        history.pull_history_link_verified = 0;
        invalidHistoryLinksCleared += 1;
      } else if (!Number(history.pull_history_link_verified || 0)) {
        // No immutable pull snapshot means the association cannot be proved.
        // Keep the stored id for forensic review but do not allow it into the
        // profit/cooked calculation until a later exact check can prove it.
        if (repair) database.prepare('UPDATE break_order_history SET pull_history_link_verified=0 WHERE id=?').run(history.id);
      }
    }

    usedBatchIds = new Set(histories.map(row => Number(row.pull_history_batch_id || 0)).filter(Boolean));
    for (const link of roundLinks) {
      const historyId = Number(link.order_history_id || 0);
      const batchId = Number(link.pull_history_batch_id || 0);
      if (!historyIds.includes(historyId) || !batchId) continue;
      const history = histories.find(row => Number(row.id) === historyId);
      if (!history) continue;
      if (!database.prepare('SELECT 1 FROM pull_history_batches WHERE id=?').get(batchId)) continue;

      // A completed-round link is strong evidence because both ids were written
      // in one archive transaction. When immutable history pulls/spots exist,
      // verify them too before allowing the link into Profit/Cooked.
      const historyPulls = getHistoryPulls.all(historyId);
      const historyItems = getHistoryItems.all(historyId);
      const snapshot = batchRecord(batchId);
      const pullsMatch = !historyPulls.length || signaturesEqual(
        historyPulls.map(normalizedPullSignature), snapshot.items.map(normalizedPullSignature)
      );
      const spotsMatch = !snapshot.spots.length || signaturesEqual(
        historyItems.map(normalizedSpotSignature), snapshot.spots.map(normalizedSpotSignature)
      );
      if (!pullsMatch || !spotsMatch) {
        roundLinkConflicts += 1;
        continue;
      }

      if (Number(history.pull_history_batch_id || 0) === batchId) {
        if (!Number(history.pull_history_link_verified || 0)) {
          if (repair) database.prepare('UPDATE break_order_history SET pull_history_link_verified=1 WHERE id=?').run(historyId);
          history.pull_history_link_verified = 1;
          linkedFromRounds += 1;
        }
        usedBatchIds.add(batchId);
        continue;
      }
      if (history.pull_history_batch_id) continue;
      if (repair) database.prepare('UPDATE break_order_history SET pull_history_batch_id=?, pull_history_link_verified=1 WHERE id=?').run(batchId, historyId);
      history.pull_history_batch_id = batchId;
      history.pull_history_link_verified = 1;
      usedBatchIds.add(batchId);
      linkedFromRounds += 1;
    }

    for (const history of histories) {
      if (Number(history.pull_history_batch_id || 0)) continue;
      const historyPulls = getHistoryPulls.all(history.id);
      if (!historyPulls.length) continue;
      const historyItems = getHistoryItems.all(history.id);
      const pullSignatures = historyPulls.map(normalizedPullSignature);
      const spotSignatures = historyItems.map(normalizedSpotSignature);
      const candidates = [];
      for (const batch of batches) {
        const batchId = Number(batch.id);
        if (usedBatchIds.has(batchId)) continue;
        const snapshot = batchRecord(batchId);
        if (!signaturesEqual(pullSignatures, snapshot.items.map(normalizedPullSignature))) continue;
        if (snapshot.spots.length && !signaturesEqual(spotSignatures, snapshot.spots.map(normalizedSpotSignature))) continue;
        candidates.push(batchId);
      }
      if (candidates.length === 1) {
        const batchId = candidates[0];
        if (repair) database.prepare('UPDATE break_order_history SET pull_history_batch_id=?, pull_history_link_verified=1 WHERE id=?').run(batchId, history.id);
        history.pull_history_batch_id = batchId;
        history.pull_history_link_verified = 1;
        usedBatchIds.add(batchId);
        linkedFromExactSnapshot += 1;
      } else if (candidates.length > 1) {
        ambiguousHistoryLinks += 1;
      }
    }

    for (const history of histories) {
      const batchId = Number(history.pull_history_batch_id || 0);
      const historyItems = getHistoryItems.all(history.id);
      if (batchId && Number(history.pull_history_link_verified || 0) === 1 && database.prepare('SELECT 1 FROM pull_history_batches WHERE id=?').get(batchId)) {
        const snapshot = batchRecord(batchId);
        const spotsByPosition = new Map(snapshot.spots.map(row => [Number(row.position), row]));
        const historyByPosition = new Map(historyItems.map(row => [Number(row.position), row]));
        const roundLink = roundByHistory.get(Number(history.id));
        const roundCards = roundLink && Number(roundLink.pull_history_batch_id || 0) === batchId && getRoundCards
          ? getRoundCards.all(Number(roundLink.round_id))
          : [];
        const roundByPosition = new Map(roundCards.map(row => [Number(row.position), row]));
        for (const item of historyItems) {
          const position = Number(item.position);
          let spot = spotsByPosition.get(position);
          const historyBuyer = buyerKey(item.buyer_name);
          const roundCard = roundByPosition.get(position);
          const roundBuyerMatches = roundCard && historyBuyer === buyerKey(roundCard.buyer_name);
          const roundPaid = roundBuyerMatches ? Math.max(0, Number(roundCard.sale_amount_cents || 0)) : 0;
          if (roundCard && !roundBuyerMatches) buyerPositionConflicts += 1;

          let historyPaid = Math.max(0, Number(item.sale_amount_cents || 0));
          if (!spot) {
            const provenPaid = historyPaid || roundPaid;
            if (provenPaid && repair) {
              database.prepare(`INSERT INTO pull_history_spots (batch_id,buyer_name,position,paid_cents) VALUES (?,?,?,?)`)
                .run(batchId, clean(item.buyer_name), position, provenPaid);
              spot = { batch_id: batchId, buyer_name: item.buyer_name, position, paid_cents: provenPaid };
              spotsByPosition.set(position, spot);
              snapshot.spots.push(spot);
              insertedMissingPullSpots += 1;
              if (!historyPaid && roundPaid) {
                database.prepare('UPDATE break_order_history_items SET sale_amount_cents=? WHERE history_id=? AND position=?')
                  .run(roundPaid, history.id, position);
                item.sale_amount_cents = roundPaid;
                historyPaid = roundPaid;
                recoveredRoundPrices += 1;
              }
            }
            if (!spot) continue;
          }
          if (historyBuyer !== buyerKey(spot.buyer_name)) {
            buyerPositionConflicts += 1;
            continue;
          }
          let pullPaid = Math.max(0, Number(spot.paid_cents || 0));
          if (!historyPaid && !pullPaid && roundPaid) {
            if (repair) {
              database.prepare('UPDATE break_order_history_items SET sale_amount_cents=? WHERE history_id=? AND position=?')
                .run(roundPaid, history.id, position);
              database.prepare('UPDATE pull_history_spots SET paid_cents=? WHERE batch_id=? AND position=?')
                .run(roundPaid, batchId, position);
            }
            item.sale_amount_cents = roundPaid;
            spot.paid_cents = roundPaid;
            historyPaid = roundPaid;
            pullPaid = roundPaid;
            recoveredRoundPrices += 1;
          } else if (!historyPaid && pullPaid) {
            if (repair) database.prepare('UPDATE break_order_history_items SET sale_amount_cents=? WHERE history_id=? AND position=?')
              .run(pullPaid, history.id, position);
            item.sale_amount_cents = pullPaid;
            recoveredOrderPrices += 1;
          } else if (historyPaid && !pullPaid) {
            if (repair) database.prepare('UPDATE pull_history_spots SET paid_cents=? WHERE batch_id=? AND position=?')
              .run(historyPaid, batchId, position);
            spot.paid_cents = historyPaid;
            recoveredPullPrices += 1;
          } else if (historyPaid && pullPaid && historyPaid !== pullPaid) {
            conflictingSpotPrices += 1;
          }
        }
        for (const spot of snapshot.spots) {
          if (!historyByPosition.has(Number(spot.position))) buyerPositionConflicts += 1;
        }
      }

      const refreshedItems = getHistoryItems.all(history.id);
      const confirmed = refreshedItems.length;
      const priced = refreshedItems.filter(row => Number(row.sale_amount_cents || 0) > 0).length;
      const gross = refreshedItems.reduce((total, row) => total + Math.max(0, Number(row.sale_amount_cents || 0)), 0);
      const current = database.prepare(`
        SELECT gross_sales_cents, priced_order_count, unpriced_order_count, confirmed_order_count
        FROM break_order_history WHERE id=?
      `).get(history.id);
      const unpriced = confirmed - priced;
      if (Number(current.gross_sales_cents) !== gross || Number(current.priced_order_count) !== priced ||
          Number(current.unpriced_order_count) !== unpriced || Number(current.confirmed_order_count) !== confirmed) {
        if (repair) database.prepare(`
          UPDATE break_order_history
          SET gross_sales_cents=?, priced_order_count=?, unpriced_order_count=?, confirmed_order_count=?
          WHERE id=?
        `).run(gross, priced, unpriced, confirmed, history.id);
        summaryRowsRepaired += 1;
      }
    }

    if (repair) database.exec('COMMIT');
  } catch (error) {
    if (repair) database.exec('ROLLBACK');
    throw error;
  }

  const totals = database.prepare(`
    SELECT COUNT(*) AS purchase_count,
      COALESCE(SUM(CASE WHEN i.sale_amount_cents > 0 THEN 1 ELSE 0 END),0) AS priced_purchase_count,
      COALESCE(SUM(CASE WHEN i.sale_amount_cents <= 0 THEN 1 ELSE 0 END),0) AS unpriced_purchase_count,
      COALESCE(SUM(i.sale_amount_cents),0) AS total_spend_cents,
      COUNT(DISTINCT LOWER(TRIM(REPLACE(i.buyer_name,'@','')))) AS buyer_count
    FROM break_order_history_items i
    JOIN break_order_history h ON h.id=i.history_id
    WHERE UPPER(TRIM(COALESCE(h.disposition,'NORMAL_BREAK')))='NORMAL_BREAK'
      AND TRIM(i.buyer_name)!=''
  `).get();
  const linkStats = database.prepare(`
    SELECT COUNT(*) AS history_count,
      COALESCE(SUM(CASE WHEN h.pull_history_link_verified = 1 AND h.pull_history_batch_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM pull_history_batches b WHERE b.id=h.pull_history_batch_id)
        AND EXISTS (SELECT 1 FROM pull_history_items pi WHERE pi.batch_id=h.pull_history_batch_id)
        THEN 1 ELSE 0 END),0) AS linked_history_count
    FROM break_order_history h
    WHERE UPPER(TRIM(COALESCE(h.disposition,'NORMAL_BREAK')))='NORMAL_BREAK'
  `).get();
  const marketStats = database.prepare(`
    SELECT COALESCE(SUM(i.quantity),0) AS market_card_count,
      COALESCE(SUM(CASE WHEN i.market_price_cents IS NULL THEN i.quantity ELSE 0 END),0) AS unpriced_market_cards,
      COALESCE(SUM(CASE WHEN i.market_price_cents IS NOT NULL THEN i.market_price_cents * i.quantity ELSE 0 END),0) AS total_market_value_cents
    FROM break_order_history h
    JOIN pull_history_items i ON i.batch_id=h.pull_history_batch_id
    WHERE UPPER(TRIM(COALESCE(h.disposition,'NORMAL_BREAK')))='NORMAL_BREAK'
      AND h.pull_history_link_verified = 1
  `).get();
  const activePurchases = database.prepare(`SELECT COUNT(*) AS count FROM active_break_board_cards WHERE status='called' AND TRIM(buyer_name)!=''`).get()?.count || 0;
  const pendingPurchases = tableExists(database, 'break_rounds')
    ? database.prepare(`
        SELECT COUNT(*) AS count FROM break_round_cards c
        JOIN break_rounds r ON r.id=c.round_id
        WHERE r.status='PENDING_REVIEW' AND c.status='called' AND TRIM(c.buyer_name)!=''
      `).get()?.count || 0
    : 0;
  const missingPullLinks = Math.max(0, Number(linkStats.history_count || 0) - Number(linkStats.linked_history_count || 0));
  const issues = Number(totals.unpriced_purchase_count || 0) + Number(marketStats.unpriced_market_cards || 0)
    + missingPullLinks + conflictingSpotPrices + buyerPositionConflicts + ambiguousHistoryLinks + roundLinkConflicts;

  return {
    checkedAt,
    verified: issues === 0,
    historyCount: Number(linkStats.history_count || 0),
    linkedHistoryCount: Number(linkStats.linked_history_count || 0),
    missingPullLinks,
    purchaseCount: Number(totals.purchase_count || 0),
    pricedPurchaseCount: Number(totals.priced_purchase_count || 0),
    unpricedPurchaseCount: Number(totals.unpriced_purchase_count || 0),
    buyerCount: Number(totals.buyer_count || 0),
    totalSpendCents: Number(totals.total_spend_cents || 0),
    marketCardCount: Number(marketStats.market_card_count || 0),
    unpricedMarketCards: Number(marketStats.unpriced_market_cards || 0),
    totalMarketValueCents: Number(marketStats.total_market_value_cents || 0),
    linkedFromRounds,
    linkedFromExactSnapshot,
    recoveredOrderPrices,
    recoveredPullPrices,
    recoveredRoundPrices,
    insertedMissingPullSpots,
    summaryRowsRepaired,
    conflictingSpotPrices,
    buyerPositionConflicts,
    ambiguousHistoryLinks,
    invalidHistoryLinksCleared,
    verifiedExistingLinks,
    roundLinkConflicts,
    activePurchases: Number(activePurchases),
    pendingPurchases: Number(pendingPurchases),
    issueCount: issues
  };
}

module.exports = { auditBuyerPurchases, buyerKey, normalizedPullSignature, normalizedSpotSignature };

// Profit/Cooked coverage audit that deliberately reads Pull History only.
// It never backfills from Orders History because older order-only rows do not
// contain enough pull information to support a fair buyer outcome comparison.
function auditPullHistoryBuyerData(database) {
  const checkedAt = new Date().toISOString();
  const totals = database.prepare(`
    SELECT COUNT(*) AS purchase_count,
      COALESCE(SUM(CASE WHEN s.paid_cents > 0 THEN 1 ELSE 0 END),0) AS priced_purchase_count,
      COALESCE(SUM(CASE WHEN s.paid_cents <= 0 THEN 1 ELSE 0 END),0) AS unpriced_purchase_count,
      COALESCE(SUM(s.paid_cents),0) AS total_spend_cents,
      COUNT(DISTINCT LOWER(TRIM(REPLACE(s.buyer_name,'@','')))) AS buyer_count,
      COUNT(DISTINCT s.batch_id) AS batch_count,
      MIN(b.recorded_at) AS first_recorded_at,
      MAX(b.recorded_at) AS last_recorded_at
    FROM pull_history_spots s
    JOIN pull_history_batches b ON b.id=s.batch_id
    WHERE TRIM(s.buyer_name)!=''
  `).get();
  const marketStats = database.prepare(`
    SELECT COALESCE(SUM(i.quantity),0) AS market_card_count,
      COALESCE(SUM(CASE WHEN i.market_price_cents IS NULL THEN i.quantity ELSE 0 END),0) AS unpriced_market_cards,
      COALESCE(SUM(CASE WHEN i.market_price_cents IS NOT NULL THEN i.market_price_cents * i.quantity ELSE 0 END),0) AS total_market_value_cents
    FROM pull_history_items i
    JOIN pull_history_spots s ON s.batch_id=i.batch_id AND s.position=i.position
    WHERE TRIM(i.buyer_name)!=''
      AND LOWER(TRIM(REPLACE(i.buyer_name,'@',''))) = LOWER(TRIM(REPLACE(s.buyer_name,'@','')))
  `).get();
  const orphanPullItemCount = Number(database.prepare(`
    SELECT COUNT(*) AS count
    FROM pull_history_items i
    LEFT JOIN pull_history_spots s ON s.batch_id=i.batch_id AND s.position=i.position
    WHERE TRIM(i.buyer_name)!=''
      AND EXISTS (SELECT 1 FROM pull_history_spots cohort WHERE cohort.batch_id=i.batch_id)
      AND (s.batch_id IS NULL OR LOWER(TRIM(REPLACE(i.buyer_name,'@',''))) != LOWER(TRIM(REPLACE(s.buyer_name,'@',''))))
  `).get()?.count || 0);
  const zeroRecordedHitSpots = Number(database.prepare(`
    SELECT COUNT(*) AS count
    FROM pull_history_spots s
    WHERE TRIM(s.buyer_name)!=''
      AND NOT EXISTS (
        SELECT 1 FROM pull_history_items i
        WHERE i.batch_id=s.batch_id AND i.position=s.position
          AND LOWER(TRIM(REPLACE(i.buyer_name,'@',''))) = LOWER(TRIM(REPLACE(s.buyer_name,'@','')))
      )
  `).get()?.count || 0);
  const legacyPullBatchCount = Number(database.prepare(`
    SELECT COUNT(*) AS count
    FROM pull_history_batches b
    WHERE EXISTS (SELECT 1 FROM pull_history_items i WHERE i.batch_id=b.id)
      AND NOT EXISTS (SELECT 1 FROM pull_history_spots s WHERE s.batch_id=b.id)
  `).get()?.count || 0);
  const unpricedPurchaseCount = Number(totals.unpriced_purchase_count || 0);
  const unpricedMarketCards = Number(marketStats.unpriced_market_cards || 0);
  const issues = unpricedPurchaseCount + unpricedMarketCards + orphanPullItemCount;
  return {
    checkedAt,
    source: 'PULL_HISTORY_ONLY',
    verified: issues === 0,
    historyCount: Number(totals.batch_count || 0),
    linkedHistoryCount: Number(totals.batch_count || 0),
    missingPullLinks: 0,
    purchaseCount: Number(totals.purchase_count || 0),
    pricedPurchaseCount: Number(totals.priced_purchase_count || 0),
    unpricedPurchaseCount,
    buyerCount: Number(totals.buyer_count || 0),
    totalSpendCents: Number(totals.total_spend_cents || 0),
    marketCardCount: Number(marketStats.market_card_count || 0),
    unpricedMarketCards,
    totalMarketValueCents: Number(marketStats.total_market_value_cents || 0),
    orphanPullItemCount,
    zeroRecordedHitSpots,
    legacyPullBatchCount,
    firstRecordedAt: String(totals.first_recorded_at || ''),
    lastRecordedAt: String(totals.last_recorded_at || ''),
    activePurchases: 0,
    pendingPurchases: 0,
    issueCount: issues
  };
}

module.exports.auditPullHistoryBuyerData = auditPullHistoryBuyerData;

// Accounting-only reconciliation. This intentionally never reads or writes
// Pull History, so running the Business Snapshot cannot change the hard
// Profit/Cooked coverage cutoff.
function auditBusinessOrderTotals(database, options = {}) {
  const repair = options.repair !== false;
  const checkedAt = new Date().toISOString();
  const histories = database.prepare(`
    SELECT id, gross_sales_cents, priced_order_count, unpriced_order_count, confirmed_order_count
    FROM break_order_history
    WHERE UPPER(TRIM(COALESCE(disposition,'NORMAL_BREAK')))='NORMAL_BREAK'
    ORDER BY recorded_at ASC, id ASC
  `).all();
  const getItems = database.prepare(`
    SELECT sale_amount_cents
    FROM break_order_history_items
    WHERE history_id=? AND TRIM(buyer_name)!=''
    ORDER BY id
  `);
  let repairedSummaryRows = 0;
  let purchaseCount = 0;
  let pricedPurchaseCount = 0;
  let totalSpendCents = 0;
  if (repair) database.exec('BEGIN IMMEDIATE');
  try {
    for (const history of histories) {
      const items = getItems.all(history.id);
      const confirmed = items.length;
      const priced = items.filter(row => Number(row.sale_amount_cents || 0) > 0).length;
      const unpriced = confirmed - priced;
      const gross = items.reduce((total, row) => total + Math.max(0, Number(row.sale_amount_cents || 0)), 0);
      purchaseCount += confirmed;
      pricedPurchaseCount += priced;
      totalSpendCents += gross;
      if (Number(history.gross_sales_cents || 0) !== gross
          || Number(history.priced_order_count || 0) !== priced
          || Number(history.unpriced_order_count || 0) !== unpriced
          || Number(history.confirmed_order_count || 0) !== confirmed) {
        if (repair) database.prepare(`
          UPDATE break_order_history
          SET gross_sales_cents=?, priced_order_count=?, unpriced_order_count=?, confirmed_order_count=?
          WHERE id=?
        `).run(gross, priced, unpriced, confirmed, history.id);
        repairedSummaryRows += 1;
      }
    }
    if (repair) database.exec('COMMIT');
  } catch (error) {
    if (repair) database.exec('ROLLBACK');
    throw error;
  }
  const unpricedPurchaseCount = purchaseCount - pricedPurchaseCount;
  return {
    checkedAt,
    source: 'ORDERS_ACCOUNTING_ONLY',
    historyCount: histories.length,
    purchaseCount,
    pricedPurchaseCount,
    unpricedPurchaseCount,
    totalSpendCents,
    repairedSummaryRows,
    issueCount: unpricedPurchaseCount
  };
}

module.exports.auditBusinessOrderTotals = auditBusinessOrderTotals;
