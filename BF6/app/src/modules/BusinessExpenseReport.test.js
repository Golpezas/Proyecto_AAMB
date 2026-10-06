const assert = require('node:assert/strict');
const { buildBusinessExpenseReport, manualExpenseTreatment } = require('./BusinessExpenseReport');

const history = [
  { id: 1, recorded_at: '2026-01-10T12:00:00Z', break_name: 'Unleashed Box 1', disposition: 'NORMAL_BREAK', gross_sales_cents: 45000, box_cost_cents: 15000, priced_order_count: 18, unpriced_order_count: 0, whatnot_actual_fee_cents: 5000 },
  { id: 2, recorded_at: '2026-02-10T12:00:00Z', break_name: 'OP-16 Giveaway', disposition: 'PROMOTIONAL_GIVEAWAY', gross_sales_cents: 0, box_cost_cents: 10000, priced_order_count: 0, unpriced_order_count: 0, whatnot_actual_fee_cents: 0 },
  { id: 3, recorded_at: '2026-03-10T12:00:00Z', break_name: 'Personal Box', disposition: 'OWNER_PERSONAL_USE', gross_sales_cents: 0, box_cost_cents: 4000, priced_order_count: 0, unpriced_order_count: 0, whatnot_actual_fee_cents: 0 },
  { id: 4, recorded_at: '2025-12-10T12:00:00Z', break_name: 'Old Box', disposition: 'NORMAL_BREAK', gross_sales_cents: 10000, box_cost_cents: 5000, priced_order_count: 2, unpriced_order_count: 0, whatnot_actual_fee_cents: 1000 }
];
const expenses = [
  { id: 1, purchased_on: '2026-01-11', category: 'Shipping supplies', expense_name: 'Bubble mailers', vendor: 'Supply Store', amount_cents: 2500 },
  { id: 2, purchased_on: '2026-01-12', category: 'Equipment', expense_name: 'Camera stand', amount_cents: 3000 },
  { id: 3, purchased_on: '2026-01-13', category: 'Inventory / sealed product', expense_name: 'Vendetta box', amount_cents: 12000 },
  { id: 4, purchased_on: '2026-01-14', category: 'Whatnot fees', expense_name: 'Manual fee', amount_cents: 1000 },
  { id: 5, purchased_on: '2026-01-15', category: 'Owner / Personal Use', expense_name: 'Personal cards', amount_cents: 500 },
  { id: 6, purchased_on: '2025-12-15', category: 'Shipping supplies', expense_name: 'Old supplies', amount_cents: 9999 }
];

const report = buildBusinessExpenseReport(history, expenses, { year: 2026 });
assert.equal(report.taxYear, 2026);
assert.equal(report.completedBreakRows.length, 1);
assert.equal(report.adjustmentRows.length, 1);
assert.equal(report.excludedBreakRows.length, 1);
assert.equal(report.manualExpenseRows.length, 5);
assert.equal(report.allExpenseRows.length, 9);
assert.equal(report.allExpenseRows[0].description, 'Personal Box', 'all expenses should be sorted newest first');
assert.equal(
  report.allExpenseRows.filter(row => ['DEDUCTIBLE', 'OPERATING'].includes(row.treatment.code)).reduce((sum, row) => sum + row.amountCents, 0),
  35500,
  'the combined table should preserve the same tracked deductible total'
);
assert(report.allExpenseRows.some(row => row.category === 'Sold break inventory'));
assert(report.allExpenseRows.some(row => row.category === 'Whatnot fees' && row.source === 'Orders History'));
assert(report.allExpenseRows.some(row => row.category === 'Promotional Giveaway' && row.source === 'Final Accounting'));
assert(report.allExpenseRows.some(row => row.category === 'Shipping supplies' && row.source === 'Manual expense'));
assert.equal(report.completedBreakRows[0].feeSource, 'Actual');
assert.equal(report.totals.grossSalesCents, 45000);
assert.equal(report.totals.whatnotFeeCents, 5000);
assert.equal(report.totals.soldInventoryCostCents, 15000);
assert.equal(report.totals.adjustmentCostCents, 10000);
assert.equal(report.totals.operatingExpenseCents, 5500);
assert.equal(report.totals.trackedDeductibleCostCents, 35500);
assert.equal(report.totals.trackedProfitCents, 9500);
assert.equal(report.totals.inventoryPurchaseCents, 12000);
assert.equal(report.totals.duplicateManualFeeCents, 1000);
assert.equal(report.totals.personalUseCents, 4500);
assert.equal(manualExpenseTreatment('Shipping supplies').code, 'OPERATING');
assert.equal(manualExpenseTreatment('Whatnot fees').code, 'DUPLICATE_FEE');
assert.equal(manualExpenseTreatment('Inventory / sealed product').code, 'INVENTORY_TRACKED');
assert.equal(manualExpenseTreatment('Owner / Personal Use').code, 'PERSONAL');

console.log('BusinessExpenseReport tests passed.');
