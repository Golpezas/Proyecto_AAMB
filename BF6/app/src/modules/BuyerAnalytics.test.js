const assert = require('node:assert/strict');
const { buildBuyerAnalytics, buildBuyerCaseFile, weekStart } = require('./BuyerAnalytics');
assert.equal(weekStart('2026-08-02T22:00:00.000Z'), '2026-07-27');
const analytics = buildBuyerAnalytics([{ history_id: 1, buyer_name: '@BigBuyer', sale_amount_cents: 300, assigned_at: '2026-08-01T22:00:00.000Z' }, { history_id: 1, buyer_name: 'bigbuyer', sale_amount_cents: 450, assigned_at: '2026-08-02T22:00:00.000Z' }, { history_id: 2, buyer_name: 'Other', sale_amount_cents: 400, assigned_at: '2026-07-25T22:00:00.000Z' }, { history_id: 3, buyer_name: 'CookedBuyer', sale_amount_cents: 500, assigned_at: '2026-07-26T22:00:00.000Z' }], [
  { batch_id: 11, buyer_name: 'BIGBUYER', quantity: 1, market_price_cents: 1000 },
  { batch_id: 12, buyer_name: 'Other', quantity: 1, market_price_cents: null },
  { batch_id: 13, buyer_name: 'cookedbuyer', quantity: 2, market_price_cents: 150 }
]);
assert.equal(analytics.totals.buyerCount, 3);
assert.equal(analytics.buyers[0].buyerName, 'BigBuyer');
assert.equal(analytics.buyers[0].totalSpendCents, 750);
assert.equal(analytics.buyers[0].purchaseCount, 2);
assert.equal(analytics.buyers[0].boxCount, 1);
assert.equal(analytics.buyers[0].totalMarketValueCents, 1000);
assert.equal(analytics.buyers[0].valueDifferenceCents, 250);
assert.equal(analytics.buyers[0].resultStatus, 'profit');
assert.equal(analytics.buyers.find(buyer => buyer.buyerName === 'Other').resultStatus, 'incomplete');
assert.equal(analytics.buyers.find(buyer => buyer.buyerName === 'CookedBuyer').totalMarketValueCents, 300);
assert.equal(analytics.buyers.find(buyer => buyer.buyerName === 'CookedBuyer').valueDifferenceCents, -200);
assert.equal(analytics.buyers.find(buyer => buyer.buyerName === 'CookedBuyer').resultStatus, 'cooked');
assert.equal(analytics.totals.profitBuyerCount, 1);
assert.equal(analytics.totals.cookedBuyerCount, 1);
assert.equal(analytics.totals.incompleteBuyerCount, 1);

const caseFile = buildBuyerCaseFile([
  { history_id: 7, break_name: 'Unleashed Box #2', recorded_at: '2026-08-20T03:00:00.000Z', buyer_name: '@Kod', position: 4, card_name: 'Vi spot', card_number: '4', set_code: 'UNL', rarity: 'Spot', sale_amount_cents: 1300, assigned_at: '2026-08-20T02:12:00.000Z' },
  { history_id: 7, break_name: 'Unleashed Box #2', recorded_at: '2026-08-20T03:00:00.000Z', buyer_name: 'kod', position: 8, card_name: 'Ivern spot', card_number: '8', set_code: 'UNL', rarity: 'Spot', sale_amount_cents: 0, assigned_at: '2026-08-20T02:18:00.000Z' },
  { history_id: 8, break_name: 'Vendetta Box #1', recorded_at: '2026-08-21T03:00:00.000Z', buyer_name: 'Other', position: 1, card_name: 'Akali', sale_amount_cents: 1200 }
], [
  { history_id: 7, break_name: 'Unleashed Box #2', recorded_at: '2026-08-20T03:00:00.000Z', buyer_name: 'KOD', position: 4, card_name: 'Vi', card_number: 'UNL-030', set_code: 'UNL', rarity: 'EPIC', quantity: 1 }
], [
  { batch_id: 20, batch_recorded_at: '2026-08-20T03:00:00.000Z', price_refreshed_at: '2026-08-22T03:00:00.000Z', set_name: 'Unleashed', buyer_name: 'kod', position: 4, card_name: 'Vi', card_number: 'UNL-030', set_code: 'UNL', rarity: 'EPIC', quantity: 1, market_price_cents: 2200, market_source: 'JustTCG', image_url: 'file:///vi.png' }
], '@kOd');
assert.equal(caseFile.found, true);
assert.equal(caseFile.buyerName, 'Kod');
assert.equal(caseFile.totals.breakCount, 1);
assert.equal(caseFile.totals.purchaseCount, 2);
assert.equal(caseFile.totals.unpricedPurchaseCount, 1);
assert.equal(caseFile.totals.totalSpendCents, 1300);
assert.equal(caseFile.totals.totalPulledCards, 1);
assert.equal(caseFile.records[0].pulls[0].cardNumber, 'UNL-030');
assert.equal(caseFile.totals.totalMarketValueCents, 2200);
assert.equal(caseFile.totals.valueDifferenceCents, 900);
assert.equal(caseFile.totals.resultStatus, 'incomplete');
assert.equal(caseFile.valuedBreaks[0].hits[0].marketTotalCents, 2200);


// Pull-History-only outcome mode treats a deliberate saved spot with no hit
// rows as $0 recorded hit value. Older order-only data never enters this call.
const pullOnly = buildBuyerAnalytics([
  { history_id: 100, buyer_name: 'NoHitBuyer', sale_amount_cents: 2500, recorded_at: '2026-08-28T12:00:00.000Z' }
], [], { pullHistorySnapshotCohort: true });
assert.equal(pullOnly.buyers[0].totalSpendCents, 2500);
assert.equal(pullOnly.buyers[0].totalMarketValueCents, 0);
assert.equal(pullOnly.buyers[0].valuationComplete, true);
assert.equal(pullOnly.buyers[0].resultStatus, 'cooked');

const pullOnlyCase = buildBuyerCaseFile([
  { history_id: 100, break_name: 'Origins', recorded_at: '2026-08-28T12:00:00.000Z', buyer_name: 'NoHitBuyer', position: 1, card_name: 'Origins spot', card_number: '1', set_code: 'OGN', rarity: 'Spot', sale_amount_cents: 2500 }
], [], [], '@NoHitBuyer', { pullHistorySnapshotCohort: true });
assert.equal(pullOnlyCase.found, true);
assert.equal(pullOnlyCase.totals.totalSpendCents, 2500);
assert.equal(pullOnlyCase.totals.totalMarketValueCents, 0);
assert.equal(pullOnlyCase.totals.valuationComplete, true);
assert.equal(pullOnlyCase.totals.resultStatus, 'cooked');

console.log('Buyer analytics checks passed.');
