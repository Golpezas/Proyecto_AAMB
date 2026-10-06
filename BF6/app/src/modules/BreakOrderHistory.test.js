const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const {
  currencyToCents,
  ensureBreakOrderHistorySchema,
  normalizeHistoryBreakName,
  normalizeHistoryNotes,
  normalizeWhatnotFees,
  orderHistoryTotals,
  whatnotFeeBreakdown
} = require('./BreakOrderHistory');

assert.equal(currencyToCents('120'), 12000);
assert.equal(currencyToCents('$120.50'), 12050);
assert.equal(currencyToCents(''), 0);
assert.throws(() => currencyToCents('12.999'), /dollar amount/);
assert.equal(normalizeHistoryBreakName('  OP-16 Box 1  '), 'OP-16 Box 1');
assert.equal(normalizeHistoryBreakName('', 'Saved box'), 'Saved box');
assert.equal(normalizeHistoryNotes(' note '), 'note');

const totals = orderHistoryTotals([
  { sale_amount_cents: 300 },
  { sale_amount_cents: 0 },
  { sale_amount_cents: 425 }
]);
assert.deepEqual(totals, {
  confirmedOrderCount: 3,
  pricedOrderCount: 2,
  unpricedOrderCount: 1,
  grossSalesCents: 725
});

assert.deepEqual(normalizeWhatnotFees({
  whatnotCommissionRate: '8',
  whatnotProcessingRate: '2.9',
  whatnotTransactionFee: '0.30',
  whatnotTransactionCount: '',
  whatnotFeeTaxRate: '6.6',
  whatnotAdditionalFees: '1.25',
  whatnotActualFees: ''
}), {
  commissionBasisPoints: 800,
  processingBasisPoints: 290,
  transactionFeeCents: 30,
  transactionCount: -1,
  feeTaxBasisPoints: 660,
  additionalFeeCents: 125,
  actualFeeCents: null
});

assert.deepEqual(whatnotFeeBreakdown({
  gross_sales_cents: 22000,
  box_cost_cents: 12000,
  priced_order_count: 22
}), {
  commissionBasisPoints: 800,
  processingBasisPoints: 290,
  transactionFeeCents: 30,
  transactionCount: 22,
  transactionCountIsAutomatic: true,
  feeTaxBasisPoints: 660,
  additionalFeeCents: 0,
  actualFeeCents: null,
  commissionFeeCents: 1760,
  processingPercentageFeeCents: 638,
  transactionFeesCents: 660,
  processingFeeCents: 1298,
  feeTaxCents: 86,
  estimatedFeeCents: 3144,
  totalWhatnotFeeCents: 3144,
  usesActualFee: false,
  netPayoutCents: 18856,
  netProfitCents: 6856
});

assert.equal(whatnotFeeBreakdown({
  gross_sales_cents: 22000,
  box_cost_cents: 12000,
  priced_order_count: 22,
  whatnot_actual_fee_cents: 3000
}).netProfitCents, 7000);

const database = new DatabaseSync(':memory:');
database.exec('PRAGMA foreign_keys = ON');
ensureBreakOrderHistorySchema(database);
const history = database.prepare(`
  INSERT INTO break_order_history (
    break_name, box_cost_cents, gross_sales_cents, priced_order_count,
    unpriced_order_count, confirmed_order_count, notes, recorded_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run('OP-16 Box 1', 12000, 725, 2, 1, 3, 'Recorded after live', '2026-08-01T00:00:00.000Z');
const historyId = Number(history.lastInsertRowid);
database.prepare(`
  INSERT INTO break_order_history_items (
    history_id, position, buyer_name, card_name, card_number, set_code,
    rarity, sale_amount_cents, assigned_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(historyId, 7, 'buyer', 'Card Name', 'OP16-007', 'OP-16', 'SP', 300, '2026-08-01T00:00:00.000Z');
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM break_order_history').get().count, 1);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM break_order_history_items').get().count, 1);
assert.equal(database.prepare('SELECT SUM(sale_amount_cents) AS total FROM break_order_history_items').get().total, 300);
database.prepare(`
  INSERT INTO break_order_history_pulls (
    history_id, buyer_name, position, card_name, card_number, set_code,
    rarity, collector_treatment, variant_hint, quantity, source_kind
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(historyId, 'buyer', 7, 'Actual Pull', 'OP16-099', 'OP-16', 'SR', '', '', 2, 'selected');
assert.equal(database.prepare('SELECT SUM(quantity) AS total FROM break_order_history_pulls').get().total, 2);
database.close();

const legacyDatabase = new DatabaseSync(':memory:');
legacyDatabase.exec(`
  CREATE TABLE break_order_history (
    id INTEGER PRIMARY KEY,
    break_name TEXT NOT NULL,
    box_cost_cents INTEGER NOT NULL DEFAULT 0,
    gross_sales_cents INTEGER NOT NULL DEFAULT 0,
    priced_order_count INTEGER NOT NULL DEFAULT 0,
    unpriced_order_count INTEGER NOT NULL DEFAULT 0,
    confirmed_order_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    recorded_at TEXT NOT NULL
  );
`);
ensureBreakOrderHistorySchema(legacyDatabase);
const migratedColumns = new Set(legacyDatabase.prepare('PRAGMA table_info(break_order_history)').all().map(column => column.name));
assert.equal(migratedColumns.has('whatnot_commission_bps'), true);
assert.equal(migratedColumns.has('whatnot_actual_fee_cents'), true);
assert.equal(migratedColumns.has('pull_history_batch_id'), true);
assert.equal(migratedColumns.has('pull_history_link_verified'), true);
assert.equal(migratedColumns.has('tracker_record_type'), true);
assert.equal(migratedColumns.has('tracker_game_code'), true);
assert.equal(migratedColumns.has('tracker_set_code'), true);
assert.equal(migratedColumns.has('tracker_set_name'), true);
assert.equal(migratedColumns.has('box_tracker_id'), true);
legacyDatabase.close();

console.log('Break order history checks passed.');
