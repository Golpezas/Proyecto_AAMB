const assert = require('node:assert/strict');
const { businessExpenseReportCsv } = require('./BusinessExpenseExport');

const csv = businessExpenseReportCsv({
  taxYear: 2026,
  totals: { grossSalesCents: 120050, trackedProfitCents: -999 },
  allExpenseRows: [{
    occurredOn: '2026-09-19', source: 'Manual expense', category: 'Shipping supplies',
    description: 'Sleeves, top loaders', vendor: 'Card "Shop"', amountCents: 2499,
    treatment: { label: 'Included' }, notes: 'One receipt\nkept'
  }]
});

assert.match(csv, /"Tax Year","2026"/);
assert.match(csv, /"Gross break sales","1200.50"/);
assert.match(csv, /"Tracked business result","-9.99"/);
assert.match(csv, /"Sleeves, top loaders"/);
assert.match(csv, /"Card ""Shop"""/);
assert.match(csv, /"One receipt kept"/);
console.log('BusinessExpenseExport tests passed.');
