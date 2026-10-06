const { isDeductibleBreakDisposition, normalizeBreakDisposition, whatnotFeeBreakdown } = require('./BreakOrderHistory');

const SOCIAL_SECURITY_WAGE_BASE_CENTS = Object.freeze({
  2024: 16860000,
  2025: 17610000,
  2026: 18450000
});
const SE_NET_EARNINGS_FACTOR = 0.9235;
const SOCIAL_SECURITY_RATE = 0.124;
const MEDICARE_RATE = 0.029;
const FEDERAL_SCENARIO_RATES = Object.freeze([10, 12, 22]);

function dateYear(value) {
  const match = String(value || '').trim().match(/^(\d{4})/);
  return match ? Number(match[1]) : 0;
}

function normalizeTaxYear(value, fallback = new Date().getFullYear()) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2200 ? year : fallback;
}

function sum(rows, selector) {
  return rows.reduce((total, row) => total + Math.max(0, Number(selector(row) || 0)), 0);
}

function buildBusinessSnapshot(historyRows = [], expenseRows = [], options = {}) {
  const taxYear = normalizeTaxYear(options.year);
  const history = (Array.isArray(historyRows) ? historyRows : []).filter(row => dateYear(row.recorded_at) === taxYear);
  const expenses = (Array.isArray(expenseRows) ? expenseRows : []).filter(row => dateYear(row.purchased_on) === taxYear);
  const normalBoxes = history.filter(row => normalizeBreakDisposition(row.disposition) === 'NORMAL_BREAK');
  const adjustmentBoxes = history.filter(row => isDeductibleBreakDisposition(row.disposition) && normalizeBreakDisposition(row.disposition) !== 'NORMAL_BREAK');
  const personalBoxes = history.filter(row => normalizeBreakDisposition(row.disposition) === 'OWNER_PERSONAL_USE');

  const grossSalesCents = sum(normalBoxes, row => row.gross_sales_cents);
  const whatnotFeeCents = sum(normalBoxes, row => whatnotFeeBreakdown(row).totalWhatnotFeeCents);
  const soldBoxCostCents = sum(normalBoxes, row => row.box_cost_cents);
  const adjustmentCostCents = sum(adjustmentBoxes, row => row.box_cost_cents);
  const personalHistoryCents = sum(personalBoxes, row => row.box_cost_cents);

  const manualWhatnotFeeRows = expenses.filter(row => row.category === 'Whatnot fees');
  const inventoryRows = expenses.filter(row => row.category === 'Inventory / sealed product');
  const personalRows = expenses.filter(row => row.category === 'Owner / Personal Use');
  const operatingRows = expenses.filter(row => !['Whatnot fees', 'Inventory / sealed product', 'Owner / Personal Use'].includes(row.category));
  const manualWhatnotFeeCents = sum(manualWhatnotFeeRows, row => row.amount_cents);
  const inventoryPurchaseCents = sum(inventoryRows, row => row.amount_cents);
  const personalExpenseCents = sum(personalRows, row => row.amount_cents);
  const operatingExpenseCents = sum(operatingRows, row => row.amount_cents);

  const trackedProfitCents = grossSalesCents - whatnotFeeCents - soldBoxCostCents - adjustmentCostCents - operatingExpenseCents;
  const profitMarginPercent = grossSalesCents > 0 ? trackedProfitCents / grossSalesCents * 100 : 0;
  const positiveProfitCents = Math.max(0, trackedProfitCents);
  const seNetEarningsCents = Math.round(positiveProfitCents * SE_NET_EARNINGS_FACTOR);
  const wageBaseCents = SOCIAL_SECURITY_WAGE_BASE_CENTS[taxYear] || null;
  let selfEmploymentTaxCents = 0;
  let socialSecurityTaxCents = 0;
  let medicareTaxCents = 0;
  if (seNetEarningsCents >= 40000) {
    const socialSecurityTaxableCents = wageBaseCents == null ? seNetEarningsCents : Math.min(seNetEarningsCents, wageBaseCents);
    socialSecurityTaxCents = Math.round(socialSecurityTaxableCents * SOCIAL_SECURITY_RATE);
    medicareTaxCents = Math.round(seNetEarningsCents * MEDICARE_RATE);
    selfEmploymentTaxCents = socialSecurityTaxCents + medicareTaxCents;
  }
  const halfSelfEmploymentTaxDeductionCents = Math.round(selfEmploymentTaxCents / 2);
  const approximateFederalIncomeBaseCents = Math.max(0, positiveProfitCents - halfSelfEmploymentTaxDeductionCents);
  const federalScenarios = FEDERAL_SCENARIO_RATES.map(ratePercent => {
    const federalIncomeTaxCents = Math.round(approximateFederalIncomeBaseCents * ratePercent / 100);
    return {
      ratePercent,
      federalIncomeTaxCents,
      combinedFederalTaxCents: selfEmploymentTaxCents + federalIncomeTaxCents
    };
  });

  const boxesMissingCost = normalBoxes.filter(row => Number(row.box_cost_cents || 0) <= 0).length;
  const unpricedPurchaseCount = sum(normalBoxes, row => row.unpriced_order_count);
  const actualFeeBoxCount = normalBoxes.filter(row => row.whatnot_actual_fee_cents != null).length;
  const estimatedFeeBoxCount = Math.max(0, normalBoxes.length - actualFeeBoxCount);
  const manualAdjustmentRows = operatingRows.filter(row => ['Promotional Giveaway', 'Customer Compensation / Make-Good', 'Damaged Inventory', 'Lost Inventory'].includes(row.category));
  const possibleAdjustmentOverlap = adjustmentBoxes.length > 0 && manualAdjustmentRows.length > 0;

  const healthIssues = [];
  if (boxesMissingCost) healthIssues.push(`${boxesMissingCost} completed sale box${boxesMissingCost === 1 ? '' : 'es'} missing box cost`);
  if (unpricedPurchaseCount) healthIssues.push(`${unpricedPurchaseCount} archived purchase${unpricedPurchaseCount === 1 ? '' : 's'} missing sale price`);
  if (estimatedFeeBoxCount) healthIssues.push(`${estimatedFeeBoxCount} box${estimatedFeeBoxCount === 1 ? '' : 'es'} still using estimated Whatnot fees`);
  if (manualWhatnotFeeRows.length) healthIssues.push(`${manualWhatnotFeeRows.length} manual Whatnot fee entr${manualWhatnotFeeRows.length === 1 ? 'y is' : 'ies are'} excluded to prevent double counting`);
  if (inventoryRows.length) healthIssues.push(`${inventoryRows.length} inventory purchase entr${inventoryRows.length === 1 ? 'y is' : 'ies are'} tracked separately from sold-box cost`);
  if (possibleAdjustmentOverlap) healthIssues.push('manual giveaway/loss adjustment expenses may overlap with Final Accounting adjustments');

  return {
    taxYear,
    grossSalesCents,
    whatnotFeeCents,
    soldBoxCostCents,
    adjustmentCostCents,
    operatingExpenseCents,
    inventoryPurchaseCents,
    manualWhatnotFeeCents,
    personalUseCents: personalHistoryCents + personalExpenseCents,
    trackedProfitCents,
    profitMarginPercent,
    normalBoxCount: normalBoxes.length,
    adjustmentBoxCount: adjustmentBoxes.length,
    expenseCount: expenses.length,
    tax: {
      seNetEarningsCents,
      socialSecurityTaxCents,
      medicareTaxCents,
      selfEmploymentTaxCents,
      halfSelfEmploymentTaxDeductionCents,
      approximateFederalIncomeBaseCents,
      socialSecurityWageBaseCents: wageBaseCents,
      federalScenarios,
      additionalMedicareIncluded: false,
      assumesNoOtherWagesForSocialSecurityCap: true
    },
    health: {
      verified: healthIssues.length === 0,
      issueCount: healthIssues.length,
      issues: healthIssues,
      boxesMissingCost,
      unpricedPurchaseCount,
      actualFeeBoxCount,
      estimatedFeeBoxCount,
      manualInventoryEntryCount: inventoryRows.length,
      manualWhatnotFeeEntryCount: manualWhatnotFeeRows.length,
      possibleAdjustmentOverlap
    }
  };
}

function availableBusinessYears(historyRows = [], expenseRows = [], currentYear = new Date().getFullYear()) {
  const years = new Set([normalizeTaxYear(currentYear)]);
  for (const row of Array.isArray(historyRows) ? historyRows : []) {
    const year = dateYear(row.recorded_at);
    if (year) years.add(year);
  }
  for (const row of Array.isArray(expenseRows) ? expenseRows : []) {
    const year = dateYear(row.purchased_on);
    if (year) years.add(year);
  }
  return [...years].sort((a, b) => b - a);
}

module.exports = {
  FEDERAL_SCENARIO_RATES,
  MEDICARE_RATE,
  SE_NET_EARNINGS_FACTOR,
  SOCIAL_SECURITY_RATE,
  SOCIAL_SECURITY_WAGE_BASE_CENTS,
  availableBusinessYears,
  buildBusinessSnapshot,
  normalizeTaxYear
};
