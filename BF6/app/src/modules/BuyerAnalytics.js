function buyerKey(value) {
  return String(value || '').trim().replace(/^@+/, '').toLowerCase();
}

function buyerDisplayName(value) {
  return String(value || '').trim().replace(/^@+/, '') || 'Unknown buyer';
}

function weekStart(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = local.getUTCDay() || 7;
  local.setUTCDate(local.getUTCDate() - day + 1);
  return local.toISOString().slice(0, 10);
}

function buildBuyerAnalytics(rows = [], marketRows = [], options = {}) {
  const pullHistorySnapshotCohort = Boolean(options.pullHistorySnapshotCohort);
  const buyers = new Map();
  const ensureBuyer = value => {
    const key = buyerKey(value);
    if (!key) return null;
    if (!buyers.has(key)) buyers.set(key, {
      buyerName: buyerDisplayName(value), purchaseCount: 0, pricedPurchaseCount: 0,
      totalSpendCents: 0, boxes: new Set(), weeks: new Set(), firstPurchaseAt: '',
      lastPurchaseAt: '', weeklySpend: new Map(), valuedBreaks: new Set(),
      totalPulledCards: 0, pricedMarketCards: 0, unpricedMarketCards: 0,
      totalMarketValueCents: 0
    });
    return buyers.get(key);
  };
  for (const row of rows) {
    const existing = ensureBuyer(row.buyer_name);
    if (!existing) continue;
    const when = row.assigned_at || row.recorded_at || '';
    const amount = Math.max(0, Number(row.sale_amount_cents || 0));
    existing.purchaseCount += 1;
    existing.totalSpendCents += amount;
    if (amount) existing.pricedPurchaseCount += 1;
    if (row.history_id) existing.boxes.add(Number(row.history_id));
    const week = weekStart(when);
    if (week) { existing.weeks.add(week); existing.weeklySpend.set(week, (existing.weeklySpend.get(week) || 0) + amount); }
    if (when && (!existing.firstPurchaseAt || when < existing.firstPurchaseAt)) existing.firstPurchaseAt = when;
    if (when && (!existing.lastPurchaseAt || when > existing.lastPurchaseAt)) existing.lastPurchaseAt = when;
  }
  for (const row of marketRows) {
    const buyer = ensureBuyer(row.buyer_name);
    if (!buyer) continue;
    const quantity = Math.max(1, Number(row.quantity || 1));
    buyer.totalPulledCards += quantity;
    if (row.history_id) buyer.valuedBreaks.add(Number(row.history_id));
    else if (row.batch_id) buyer.valuedBreaks.add(Number(row.batch_id));
    if (Number.isInteger(row.market_price_cents) && row.market_price_cents >= 0) {
      buyer.pricedMarketCards += quantity;
      buyer.totalMarketValueCents += Number(row.market_price_cents) * quantity;
    } else buyer.unpricedMarketCards += quantity;
  }
  const sorted = [...buyers.values()].map(buyer => {
    const boxCount = buyer.boxes.size;
    // In Pull-History-only mode, every purchase row already belongs to a
    // deliberate saved Pull History snapshot. A buyer with no saved hit rows
    // in that snapshot is therefore treated as $0 recorded hit value rather
    // than as missing historical data. Older Orders-only rows never enter this
    // cohort at all.
    const valuedBreakCount = pullHistorySnapshotCohort ? boxCount : buyer.valuedBreaks.size;
    const valueDifferenceCents = buyer.totalMarketValueCents - buyer.totalSpendCents;
    const valuationComplete = buyer.purchaseCount > 0
      && buyer.pricedPurchaseCount === buyer.purchaseCount
      && (pullHistorySnapshotCohort || buyer.totalPulledCards > 0)
      && buyer.unpricedMarketCards === 0
      && valuedBreakCount >= boxCount;
    return {
      buyerName: buyer.buyerName,
      purchaseCount: buyer.purchaseCount,
      pricedPurchaseCount: buyer.pricedPurchaseCount,
      totalSpendCents: buyer.totalSpendCents,
      boxCount,
      valuedBreakCount,
      activeWeekCount: buyer.weeks.size,
      firstPurchaseAt: buyer.firstPurchaseAt,
      lastPurchaseAt: buyer.lastPurchaseAt,
      totalPulledCards: buyer.totalPulledCards,
      pricedMarketCards: buyer.pricedMarketCards,
      unpricedMarketCards: buyer.unpricedMarketCards,
      totalMarketValueCents: buyer.totalMarketValueCents,
      valueDifferenceCents,
      valuationComplete,
      resultStatus: valuationComplete ? (valueDifferenceCents >= 0 ? 'profit' : 'cooked') : 'incomplete',
      weeklySpend: [...buyer.weeklySpend.entries()].map(([week, totalSpendCents]) => ({ week, totalSpendCents })).sort((a, b) => b.week.localeCompare(a.week))
    };
  }).sort((a, b) => b.totalSpendCents - a.totalSpendCents || b.purchaseCount - a.purchaseCount || a.buyerName.localeCompare(b.buyerName));
  const weekTotals = new Map();
  for (const buyer of sorted) for (const week of buyer.weeklySpend) weekTotals.set(week.week, (weekTotals.get(week.week) || 0) + week.totalSpendCents);
  return { buyers: sorted, totals: { buyerCount: sorted.length, purchaseCount: sorted.reduce((total, buyer) => total + buyer.purchaseCount, 0), totalSpendCents: sorted.reduce((total, buyer) => total + buyer.totalSpendCents, 0), totalMarketValueCents: sorted.reduce((total, buyer) => total + buyer.totalMarketValueCents, 0), profitBuyerCount: sorted.filter(buyer => buyer.resultStatus === 'profit').length, cookedBuyerCount: sorted.filter(buyer => buyer.resultStatus === 'cooked').length, incompleteBuyerCount: sorted.filter(buyer => buyer.resultStatus === 'incomplete').length }, weeklyTotals: [...weekTotals.entries()].map(([week, totalSpendCents]) => ({ week, totalSpendCents })).sort((a, b) => b.week.localeCompare(a.week)) };
}

function buildBuyerCaseFile(purchaseRows = [], pullRows = [], marketRows = [], requestedBuyer = '', options = {}) {
  const pullHistorySnapshotCohort = Boolean(options.pullHistorySnapshotCohort);
  const requestedKey = buyerKey(requestedBuyer);
  const purchases = purchaseRows.filter(row => buyerKey(row.buyer_name) === requestedKey);
  const pulls = pullRows.filter(row => buyerKey(row.buyer_name) === requestedKey);
  const marketItems = marketRows.filter(row => buyerKey(row.buyer_name) === requestedKey);
  const displayName = buyerDisplayName(
    purchases[0]?.buyer_name || pulls[0]?.buyer_name || marketItems[0]?.buyer_name || requestedBuyer
  );
  const breaks = new Map();

  function ensureBreak(row) {
    const id = Number(row.history_id || 0);
    if (!breaks.has(id)) {
      breaks.set(id, {
        historyId: id,
        breakName: String(row.break_name || 'Saved break'),
        recordedAt: String(row.recorded_at || ''),
        notes: String(row.notes || ''),
        purchases: [],
        pulls: [],
        totalSpendCents: 0,
        pricedPurchaseCount: 0,
        unpricedPurchaseCount: 0,
        totalPulledCards: 0
      });
    }
    return breaks.get(id);
  }

  for (const row of purchases) {
    const record = ensureBreak(row);
    const amount = Math.max(0, Number(row.sale_amount_cents || 0));
    record.purchases.push({
      position: Number(row.position || 0),
      cardName: String(row.card_name || ''),
      cardNumber: String(row.card_number || ''),
      setCode: String(row.set_code || ''),
      rarity: String(row.rarity || ''),
      paidCents: amount,
      assignedAt: String(row.assigned_at || row.recorded_at || '')
    });
    record.totalSpendCents += amount;
    if (amount > 0) record.pricedPurchaseCount += 1;
    else record.unpricedPurchaseCount += 1;
  }

  for (const row of pulls) {
    const record = ensureBreak(row);
    const quantity = Math.max(1, Number(row.quantity || 1));
    record.pulls.push({
      position: Number(row.position || 0),
      cardName: String(row.card_name || ''),
      cardNumber: String(row.card_number || ''),
      setCode: String(row.set_code || ''),
      rarity: String(row.rarity || ''),
      collectorTreatment: String(row.collector_treatment || ''),
      variantHint: String(row.variant_hint || ''),
      quantity,
      sourceKind: String(row.source_kind || 'selected')
    });
    record.totalPulledCards += quantity;
  }

  const records = [...breaks.values()]
    .map(record => ({
      ...record,
      purchases: record.purchases.sort((a, b) => a.position - b.position),
      pulls: record.pulls.sort((a, b) => a.position - b.position || a.cardName.localeCompare(b.cardName))
    }))
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt) || b.historyId - a.historyId);

  const purchaseCount = records.reduce((total, record) => total + record.purchases.length, 0);
  const pricedPurchaseCount = records.reduce((total, record) => total + record.pricedPurchaseCount, 0);
  const totalSpendCents = records.reduce((total, record) => total + record.totalSpendCents, 0);
  const totalPulledCards = records.reduce((total, record) => total + record.totalPulledCards, 0);
  const marketBreaks = new Map();
  for (const row of marketItems) {
    const historyId = Number(row.history_id || 0);
    const batchId = Number(row.batch_id || 0);
    const marketKey = historyId ? `history:${historyId}` : `batch:${batchId}`;
    if (!marketBreaks.has(marketKey)) marketBreaks.set(marketKey, {
      historyId,
      batchId,
      breakLabel: String(row.break_name || row.set_name || row.set_code || row.game_code || 'Saved Pull History'),
      recordedAt: String(row.batch_recorded_at || ''),
      priceRefreshedAt: String(row.price_refreshed_at || ''),
      totalCards: 0,
      pricedCards: 0,
      unpricedCards: 0,
      totalMarketValueCents: 0,
      hits: []
    });
    const batch = marketBreaks.get(marketKey);
    const quantity = Math.max(1, Number(row.quantity || 1));
    const priceIsKnown = Number.isInteger(row.market_price_cents) && row.market_price_cents >= 0;
    const marketPriceCents = priceIsKnown ? Number(row.market_price_cents) : null;
    batch.totalCards += quantity;
    if (priceIsKnown) {
      batch.pricedCards += quantity;
      batch.totalMarketValueCents += marketPriceCents * quantity;
    } else batch.unpricedCards += quantity;
    batch.hits.push({
      position: Number(row.position || 0),
      cardName: String(row.card_name || ''),
      cardNumber: String(row.card_number || ''),
      setCode: String(row.set_code || ''),
      rarity: String(row.rarity || ''),
      collectorTreatment: String(row.collector_treatment || ''),
      variantHint: String(row.variant_hint || ''),
      quantity,
      marketPriceCents,
      marketTotalCents: priceIsKnown ? marketPriceCents * quantity : null,
      marketSource: String(row.market_source || ''),
      marketVariant: String(row.market_variant || ''),
      marketUpdatedAt: String(row.market_updated_at || '')
    });
  }
  const valuedBreaks = [...marketBreaks.values()]
    .map(batch => ({ ...batch, hits: batch.hits.sort((a, b) => b.marketTotalCents - a.marketTotalCents || a.position - b.position) }))
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt) || b.historyId - a.historyId || b.batchId - a.batchId);
  const marketPulledCards = valuedBreaks.reduce((total, batch) => total + batch.totalCards, 0);
  const pricedMarketCards = valuedBreaks.reduce((total, batch) => total + batch.pricedCards, 0);
  const unpricedMarketCards = valuedBreaks.reduce((total, batch) => total + batch.unpricedCards, 0);
  const totalMarketValueCents = valuedBreaks.reduce((total, batch) => total + batch.totalMarketValueCents, 0);
  const valueDifferenceCents = totalMarketValueCents - totalSpendCents;
  const valuedHistoryIds = new Set(valuedBreaks.map(batch => Number(batch.historyId || 0)).filter(Boolean));
  const missingMarketBreaks = pullHistorySnapshotCohort
    ? 0
    : records.filter(record => !valuedHistoryIds.has(Number(record.historyId || 0))).length;
  const valuationComplete = purchaseCount > 0 && pricedPurchaseCount === purchaseCount
    && (pullHistorySnapshotCohort || marketPulledCards > 0)
    && unpricedMarketCards === 0 && missingMarketBreaks === 0;
  const purchaseTimes = purchases
    .map(row => String(row.assigned_at || row.recorded_at || ''))
    .filter(Boolean)
    .sort();

  return {
    found: Boolean(requestedKey && (purchases.length || pulls.length || marketItems.length)),
    buyerName: displayName,
    buyerKey: requestedKey,
    totals: {
      breakCount: records.length,
      purchaseCount,
      pricedPurchaseCount,
      unpricedPurchaseCount: purchaseCount - pricedPurchaseCount,
      totalSpendCents,
      totalPulledCards,
      valuedBreakCount: valuedBreaks.length,
      marketPulledCards,
      pricedMarketCards,
      unpricedMarketCards,
      totalMarketValueCents,
      valueDifferenceCents,
      missingMarketBreaks,
      valuationComplete,
      resultStatus: valuationComplete ? (valueDifferenceCents >= 0 ? 'profit' : 'cooked') : 'incomplete',
      firstPurchaseAt: purchaseTimes[0] || '',
      lastPurchaseAt: purchaseTimes[purchaseTimes.length - 1] || ''
    },
    records,
    valuedBreaks
  };
}

module.exports = { buildBuyerAnalytics, buildBuyerCaseFile, buyerKey, weekStart };
