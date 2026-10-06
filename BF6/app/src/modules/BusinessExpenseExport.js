function csvCell(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  return `"${text.replace(/"/g, '""')}"`;
}

function dollars(cents) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function businessExpenseReportCsv(report = {}) {
  const year = Number(report.taxYear || new Date().getFullYear());
  const totals = report.totals || {};
  const rows = Array.isArray(report.allExpenseRows) ? report.allExpenseRows : [];
  const output = [
    ['BreakSuite6 Business Expense & Break Report'],
    ['Tax Year', year],
    [],
    ['Summary', 'Amount'],
    ['Gross break sales', dollars(totals.grossSalesCents)],
    ['Whatnot fees', dollars(totals.whatnotFeeCents)],
    ['Sold-break inventory', dollars(totals.soldInventoryCostCents)],
    ['Giveaways / adjustments', dollars(totals.adjustmentCostCents)],
    ['Other operating expenses', dollars(totals.operatingExpenseCents)],
    ['Total tracked deductible costs', dollars(totals.trackedDeductibleCostCents)],
    ['Tracked business result', dollars(totals.trackedProfitCents)],
    ['Inventory purchases tracked separately', dollars(totals.inventoryPurchaseCents)],
    [],
    ['Date', 'Source', 'Category', 'Description', 'Vendor', 'Accounting treatment', 'Amount paid', 'Gross sales', 'Break net', 'Notes']
  ];
  for (const row of rows) {
    output.push([
      row.occurredOn || '', row.source || '', row.category || '', row.description || '', row.vendor || '',
      row.treatment?.label || '', dollars(row.amountCents),
      row.grossSalesCents == null ? '' : dollars(row.grossSalesCents),
      row.netResultCents == null ? '' : dollars(row.netResultCents), row.notes || ''
    ]);
  }
  return output.map(row => row.map(csvCell).join(',')).join('\r\n');
}

module.exports = { businessExpenseReportCsv, csvCell, dollars };
