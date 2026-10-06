const assert = require('node:assert/strict');
const { buildBusinessSnapshot, availableBusinessYears } = require('./BusinessSnapshot');

const history = [
  { recorded_at: '2026-01-10T12:00:00Z', disposition: 'NORMAL_BREAK', gross_sales_cents: 45000, box_cost_cents: 15000, unpriced_order_count: 0, priced_order_count: 18, whatnot_actual_fee_cents: 5000 },
  { recorded_at: '2026-02-10T12:00:00Z', disposition: 'PROMOTIONAL_GIVEAWAY', gross_sales_cents: 0, box_cost_cents: 10000, unpriced_order_count: 0, priced_order_count: 0, whatnot_actual_fee_cents: 0 },
  { recorded_at: '2025-12-10T12:00:00Z', disposition: 'NORMAL_BREAK', gross_sales_cents: 10000, box_cost_cents: 5000, unpriced_order_count: 0, priced_order_count: 2, whatnot_actual_fee_cents: 1000 }
];
const expenses = [
  { purchased_on: '2026-01-11', category: 'Shipping supplies', amount_cents: 2500 },
  { purchased_on: '2026-01-12', category: 'Equipment', amount_cents: 3000 },
  { purchased_on: '2026-01-13', category: 'Inventory / sealed product', amount_cents: 12000 },
  { purchased_on: '2026-01-14', category: 'Whatnot fees', amount_cents: 1000 },
  { purchased_on: '2026-01-15', category: 'Owner / Personal Use', amount_cents: 500 }
];

const snapshot = buildBusinessSnapshot(history, expenses, { year: 2026 });
assert.equal(snapshot.grossSalesCents, 45000);
assert.equal(snapshot.whatnotFeeCents, 5000);
assert.equal(snapshot.soldBoxCostCents, 15000);
assert.equal(snapshot.adjustmentCostCents, 10000);
assert.equal(snapshot.operatingExpenseCents, 5500);
assert.equal(snapshot.inventoryPurchaseCents, 12000);
assert.equal(snapshot.manualWhatnotFeeCents, 1000);
assert.equal(snapshot.personalUseCents, 500);
assert.equal(snapshot.trackedProfitCents, 9500);
assert.equal(snapshot.tax.selfEmploymentTaxCents, 0, 'SE net earnings under $400 should not create tax');
assert.deepEqual(availableBusinessYears(history, expenses, 2026), [2026, 2025]);

const profitable = buildBusinessSnapshot([
  { recorded_at: '2026-03-01T12:00:00Z', disposition: 'NORMAL_BREAK', gross_sales_cents: 1000000, box_cost_cents: 200000, unpriced_order_count: 0, priced_order_count: 10, whatnot_actual_fee_cents: 100000 }
], [], { year: 2026 });
assert.equal(profitable.trackedProfitCents, 700000);
assert(profitable.tax.selfEmploymentTaxCents > 0);
assert.equal(profitable.tax.federalScenarios.length, 3);
assert.equal(profitable.tax.federalScenarios[1].ratePercent, 12);
assert(profitable.tax.federalScenarios[2].combinedFederalTaxCents > profitable.tax.federalScenarios[0].combinedFederalTaxCents);
console.log('BusinessSnapshot tests passed.');
