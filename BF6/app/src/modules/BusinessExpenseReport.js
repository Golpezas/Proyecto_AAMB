const {
  dispositionLabel,
  isDeductibleBreakDisposition,
  normalizeBreakDisposition,
  whatnotFeeBreakdown
} = require('./BreakOrderHistory');
const { normalizeTaxYear } = require('./BusinessSnapshot');

const OPERATING_EXPENSE_EXCLUSIONS = new Set([
  'Whatnot fees',
  'Inventory / sealed product',
  'Owner / Personal Use'
]);

function cents(value) {
  return Math.max(0, Number(value || 0));
}

function yearFromDate(value) {
  const match = String(value || '').trim().match(/^(\d{4})/);
  return match ? Number(match[1]) : 0;
}

function total(rows, field) {
  return rows.reduce((sum, row) => sum + cents(row[field]), 0);
}

function manualExpenseTreatment(category) {
  if (category === 'Whatnot fees') {
    return {
      code: 'DUPLICATE_FEE',
      label: 'Review only - excluded because saved breaks already include Whatnot fees'
    };
  }
  if (category === 'Inventory / sealed product') {
    return {
      code: 'INVENTORY_TRACKED',
      label: 'Inventory tracked separately - not deducted again until sold or otherwise used'
    };
  }
  if (category === 'Owner / Personal Use') {
    return { code: 'PERSONAL', label: 'Owner / personal use - not deducted' };
  }
  return { code: 'OPERATING', label: 'Included in tracked operating expenses' };
}

function breakReportRow(row) {
  const fees = whatnotFeeBreakdown(row);
  const grossSalesCents = cents(row.gross_sales_cents);
  const inventoryCostCents = cents(row.box_cost_cents);
  const whatnotFeeCents = cents(fees.totalWhatnotFeeCents);
  return {
    id: Number(row.id || 0),
    recordedAt: row.recorded_at || '',
    breakName: String(row.break_name || 'Untitled break'),
    disposition: normalizeBreakDisposition(row.disposition),
    dispositionLabel: dispositionLabel(row.disposition),
    grossSalesCents,
    whatnotFeeCents,
    feeSource: fees.usesActualFee ? 'Actual' : 'Estimated',
    inventoryCostCents,
    netResultCents: grossSalesCents - whatnotFeeCents - inventoryCostCents,
    pricedOrderCount: cents(row.priced_order_count),
    unpricedOrderCount: cents(row.unpriced_order_count),
    notes: String(row.notes || '')
  };
}

function manualExpenseRow(row) {
  const category = String(row.category || 'Other');
  return {
    id: Number(row.id || 0),
    purchasedOn: row.purchased_on || '',
    category,
    expenseName: String(row.expense_name || 'Expense'),
    vendor: String(row.vendor || ''),
    notes: String(row.notes || ''),
    amountCents: cents(row.amount_cents),
    treatment: manualExpenseTreatment(category)
  };
}

function combinedExpenseRows(completedBreakRows, adjustmentRows, manualExpenseRows, excludedBreakRows) {
  const rows = [];
  for (const row of completedBreakRows) {
    rows.push({
      id: `break-${row.id}-inventory`,
      occurredOn: row.recordedAt,
      source: 'Orders History',
      category: 'Sold break inventory',
      description: row.breakName,
      notes: row.notes,
      amountCents: row.inventoryCostCents,
      grossSalesCents: row.grossSalesCents,
      netResultCents: row.netResultCents,
      treatment: { code: 'DEDUCTIBLE', label: 'Included - sold-break inventory cost' }
    });
    rows.push({
      id: `break-${row.id}-fees`,
      occurredOn: row.recordedAt,
      source: 'Orders History',
      category: 'Whatnot fees',
      description: row.breakName,
      notes: `${row.feeSource} fee${row.notes ? ` · ${row.notes}` : ''}`,
      amountCents: row.whatnotFeeCents,
      grossSalesCents: row.grossSalesCents,
      netResultCents: row.netResultCents,
      treatment: { code: 'DEDUCTIBLE', label: 'Included - fee from saved break' }
    });
  }
  for (const row of adjustmentRows) {
    rows.push({
      id: `adjustment-${row.id}`,
      occurredOn: row.recordedAt,
      source: 'Final Accounting',
      category: row.dispositionLabel,
      description: row.breakName,
      notes: row.notes,
      amountCents: row.inventoryCostCents,
      treatment: { code: 'DEDUCTIBLE', label: 'Included - business inventory adjustment' }
    });
  }
  for (const row of manualExpenseRows) {
    rows.push({
      id: `manual-${row.id}`,
      occurredOn: row.purchasedOn,
      source: 'Manual expense',
      category: row.category,
      description: row.expenseName,
      vendor: row.vendor,
      notes: row.notes,
      amountCents: row.amountCents,
      treatment: row.treatment
    });
  }
  for (const row of excludedBreakRows) {
    const personal = row.disposition === 'OWNER_PERSONAL_USE';
    rows.push({
      id: `excluded-${row.id}`,
      occurredOn: row.recordedAt,
      source: 'Orders History',
      category: row.dispositionLabel,
      description: row.breakName,
      notes: row.notes,
      amountCents: row.inventoryCostCents,
      treatment: personal
        ? { code: 'PERSONAL', label: 'Owner / personal use - not deducted' }
        : { code: 'EXCLUDED', label: 'Review only - not included in tracked costs' }
    });
  }
  return rows.sort((left, right) => {
    const byDate = String(right.occurredOn || '').localeCompare(String(left.occurredOn || ''));
    return byDate || String(left.id).localeCompare(String(right.id));
  });
}

function buildBusinessExpenseReport(historyRows = [], expenseRows = [], options = {}) {
  const taxYear = normalizeTaxYear(options.year);
  const history = (Array.isArray(historyRows) ? historyRows : [])
    .filter(row => yearFromDate(row.recorded_at) === taxYear);
  const expenses = (Array.isArray(expenseRows) ? expenseRows : [])
    .filter(row => yearFromDate(row.purchased_on) === taxYear);

  const completedBreakRows = history
    .filter(row => normalizeBreakDisposition(row.disposition) === 'NORMAL_BREAK')
    .map(breakReportRow);
  const adjustmentRows = history
    .filter(row => isDeductibleBreakDisposition(row.disposition) && normalizeBreakDisposition(row.disposition) !== 'NORMAL_BREAK')
    .map(breakReportRow);
  const excludedBreakRows = history
    .filter(row => !isDeductibleBreakDisposition(row.disposition))
    .map(breakReportRow);
  const manualExpenseRows = expenses.map(manualExpenseRow);

  const operatingExpenseRows = manualExpenseRows.filter(row => !OPERATING_EXPENSE_EXCLUSIONS.has(row.category));
  const inventoryPurchaseRows = manualExpenseRows.filter(row => row.category === 'Inventory / sealed product');
  const duplicateFeeRows = manualExpenseRows.filter(row => row.category === 'Whatnot fees');
  const personalExpenseRows = manualExpenseRows.filter(row => row.category === 'Owner / Personal Use');
  const personalBreakRows = excludedBreakRows.filter(row => row.disposition === 'OWNER_PERSONAL_USE');

  const grossSalesCents = total(completedBreakRows, 'grossSalesCents');
  const whatnotFeeCents = total(completedBreakRows, 'whatnotFeeCents');
  const soldInventoryCostCents = total(completedBreakRows, 'inventoryCostCents');
  const adjustmentCostCents = total(adjustmentRows, 'inventoryCostCents');
  const operatingExpenseCents = total(operatingExpenseRows, 'amountCents');
  const trackedProfitCents = grossSalesCents - whatnotFeeCents - soldInventoryCostCents - adjustmentCostCents - operatingExpenseCents;
  const allExpenseRows = combinedExpenseRows(completedBreakRows, adjustmentRows, manualExpenseRows, excludedBreakRows);

  return {
    taxYear,
    allExpenseRows,
    completedBreakRows,
    adjustmentRows,
    manualExpenseRows,
    excludedBreakRows,
    totals: {
      grossSalesCents,
      whatnotFeeCents,
      soldInventoryCostCents,
      adjustmentCostCents,
      operatingExpenseCents,
      trackedDeductibleCostCents: whatnotFeeCents + soldInventoryCostCents + adjustmentCostCents + operatingExpenseCents,
      trackedProfitCents,
      inventoryPurchaseCents: total(inventoryPurchaseRows, 'amountCents'),
      duplicateManualFeeCents: total(duplicateFeeRows, 'amountCents'),
      personalUseCents: total(personalExpenseRows, 'amountCents') + total(personalBreakRows, 'inventoryCostCents')
    },
    counts: {
      completedBreaks: completedBreakRows.length,
      adjustments: adjustmentRows.length,
      manualExpenses: manualExpenseRows.length,
      excludedBreaks: excludedBreakRows.length
    }
  };
}

module.exports = {
  buildBusinessExpenseReport,
  manualExpenseTreatment
};
