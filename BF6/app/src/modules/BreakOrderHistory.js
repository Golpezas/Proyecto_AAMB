const MAX_HISTORY_NAME_LENGTH = 140;
const MAX_HISTORY_NOTES_LENGTH = 1200;

const BREAK_DISPOSITIONS = Object.freeze({
  NORMAL_BREAK: 'Normal Break / Sale',
  PROMOTIONAL_GIVEAWAY: 'Promotional Giveaway',
  CUSTOMER_COMPENSATION: 'Customer Compensation / Make-Good',
  DAMAGED_INVENTORY: 'Damaged Inventory',
  LOST_INVENTORY: 'Lost Inventory',
  OWNER_PERSONAL_USE: 'Owner / Personal Use',
  TEST_VOID: 'Test / Void'
});
const DEDUCTIBLE_DISPOSITIONS = new Set([
  'NORMAL_BREAK', 'PROMOTIONAL_GIVEAWAY', 'CUSTOMER_COMPENSATION',
  'DAMAGED_INVENTORY', 'LOST_INVENTORY'
]);
function normalizeBreakDisposition(value) {
  const key = String(value || '').trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(BREAK_DISPOSITIONS, key) ? key : 'NORMAL_BREAK';
}
function isDeductibleBreakDisposition(value) {
  return DEDUCTIBLE_DISPOSITIONS.has(normalizeBreakDisposition(value));
}
function dispositionLabel(value) {
  const key = normalizeBreakDisposition(value);
  return BREAK_DISPOSITIONS[key];
}

const DEFAULT_WHATNOT_FEES = Object.freeze({
  commissionBasisPoints: 800,
  processingBasisPoints: 290,
  transactionFeeCents: 30,
  transactionCount: -1,
  feeTaxBasisPoints: 660,
  additionalFeeCents: 0,
  actualFeeCents: null
});

function ensureHistoryColumn(database, columns, name, definition) {
  if (columns.has(name)) return;
  database.exec(`ALTER TABLE break_order_history ADD COLUMN ${name} ${definition}`);
  columns.add(name);
}

function ensureBreakOrderHistorySchema(database) {
  database.exec(`
    -- A history row is an immutable, text-only snapshot of one completed
    -- break.  It deliberately does not point back to image files or the live
    -- ledger, so a later board, library repair, refund, or image cleanup can
    -- never change what the breaker recorded for that box.
    CREATE TABLE IF NOT EXISTS break_order_history (
      id INTEGER PRIMARY KEY,
      break_name TEXT NOT NULL,
      box_cost_cents INTEGER NOT NULL DEFAULT 0,
      gross_sales_cents INTEGER NOT NULL DEFAULT 0,
      priced_order_count INTEGER NOT NULL DEFAULT 0,
      unpriced_order_count INTEGER NOT NULL DEFAULT 0,
      confirmed_order_count INTEGER NOT NULL DEFAULT 0,
      whatnot_commission_bps INTEGER NOT NULL DEFAULT 800,
      whatnot_processing_bps INTEGER NOT NULL DEFAULT 290,
      whatnot_transaction_fee_cents INTEGER NOT NULL DEFAULT 30,
      whatnot_transaction_count INTEGER NOT NULL DEFAULT -1,
      whatnot_fee_tax_bps INTEGER NOT NULL DEFAULT 660,
      whatnot_additional_fee_cents INTEGER NOT NULL DEFAULT 0,
      whatnot_actual_fee_cents INTEGER,
      notes TEXT NOT NULL DEFAULT '',
      disposition TEXT NOT NULL DEFAULT 'NORMAL_BREAK',
      pull_history_batch_id INTEGER,
      pull_history_link_verified INTEGER NOT NULL DEFAULT 0,
      tracker_record_type TEXT NOT NULL DEFAULT '',
      tracker_game_code TEXT NOT NULL DEFAULT '',
      tracker_set_code TEXT NOT NULL DEFAULT '',
      tracker_set_name TEXT NOT NULL DEFAULT '',
      box_tracker_id INTEGER,
      recorded_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS break_order_history_items (
      id INTEGER PRIMARY KEY,
      history_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      buyer_name TEXT NOT NULL,
      card_name TEXT NOT NULL,
      card_number TEXT NOT NULL DEFAULT '',
      set_code TEXT NOT NULL DEFAULT '',
      rarity TEXT NOT NULL DEFAULT '',
      sale_amount_cents INTEGER NOT NULL DEFAULT 0,
      assigned_at TEXT,
      FOREIGN KEY(history_id) REFERENCES break_order_history(id) ON DELETE CASCADE,
      UNIQUE(history_id, position)
    );

    -- A saved box can also retain the exact pull cards copied from the current
    -- board's deliberate Pull History checkpoint. These are a separate,
    -- immutable snapshot from both the purchased spots and Pull History.
    CREATE TABLE IF NOT EXISTS break_order_history_pulls (
      id INTEGER PRIMARY KEY,
      history_id INTEGER NOT NULL,
      buyer_name TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL,
      card_name TEXT NOT NULL,
      card_number TEXT NOT NULL DEFAULT '',
      set_code TEXT NOT NULL DEFAULT '',
      rarity TEXT NOT NULL DEFAULT '',
      collector_treatment TEXT NOT NULL DEFAULT '',
      variant_hint TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity BETWEEN 1 AND 99),
      source_kind TEXT NOT NULL DEFAULT 'selected',
      FOREIGN KEY(history_id) REFERENCES break_order_history(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_break_order_history_recorded_at
      ON break_order_history(recorded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_break_order_history_items_history
      ON break_order_history_items(history_id, position);
    CREATE INDEX IF NOT EXISTS idx_break_order_history_pulls_history
      ON break_order_history_pulls(history_id, position, id);
  `);

  // Existing databases keep every saved box and receive only the accounting
  // columns needed for the Whatnot fee calculation. A transaction count of -1
  // means "use this record's priced spot count," which upgrades old records
  // without rewriting their buyer/card snapshots.
  const columns = new Set(database.prepare('PRAGMA table_info(break_order_history)').all().map(column => column.name));
  ensureHistoryColumn(database, columns, 'whatnot_commission_bps', 'INTEGER NOT NULL DEFAULT 800');
  ensureHistoryColumn(database, columns, 'whatnot_processing_bps', 'INTEGER NOT NULL DEFAULT 290');
  ensureHistoryColumn(database, columns, 'whatnot_transaction_fee_cents', 'INTEGER NOT NULL DEFAULT 30');
  ensureHistoryColumn(database, columns, 'whatnot_transaction_count', 'INTEGER NOT NULL DEFAULT -1');
  ensureHistoryColumn(database, columns, 'whatnot_fee_tax_bps', 'INTEGER NOT NULL DEFAULT 660');
  ensureHistoryColumn(database, columns, 'whatnot_additional_fee_cents', 'INTEGER NOT NULL DEFAULT 0');
  ensureHistoryColumn(database, columns, 'whatnot_actual_fee_cents', 'INTEGER');
  ensureHistoryColumn(database, columns, 'disposition', "TEXT NOT NULL DEFAULT 'NORMAL_BREAK'");
  ensureHistoryColumn(database, columns, 'pull_history_batch_id', 'INTEGER');
  ensureHistoryColumn(database, columns, 'pull_history_link_verified', 'INTEGER NOT NULL DEFAULT 0');
  ensureHistoryColumn(database, columns, 'tracker_record_type', "TEXT NOT NULL DEFAULT ''");
  ensureHistoryColumn(database, columns, 'tracker_game_code', "TEXT NOT NULL DEFAULT ''");
  ensureHistoryColumn(database, columns, 'tracker_set_code', "TEXT NOT NULL DEFAULT ''");
  ensureHistoryColumn(database, columns, 'tracker_set_name', "TEXT NOT NULL DEFAULT ''");
  ensureHistoryColumn(database, columns, 'box_tracker_id', 'INTEGER');
  database.exec('CREATE INDEX IF NOT EXISTS idx_break_order_history_pull_batch ON break_order_history(pull_history_batch_id)');
  database.exec('CREATE INDEX IF NOT EXISTS idx_break_order_history_box_tracker ON break_order_history(box_tracker_id)');
}

function trimText(value, maximum) {
  return String(value ?? '').trim().slice(0, maximum);
}

function normalizeHistoryBreakName(value, fallback = 'Untitled break') {
  return trimText(value, MAX_HISTORY_NAME_LENGTH) || fallback;
}

function normalizeHistoryNotes(value) {
  return trimText(value, MAX_HISTORY_NOTES_LENGTH);
}

function currencyToCents(value, label = 'box cost') {
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  const normalized = raw.replace(/[$,\s]/g, '');
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`Enter the ${label} as a dollar amount, such as 120 or 120.50.`);
  }
  return Math.round(Number(normalized) * 100);
}

function percentageToBasisPoints(value, fallback, label) {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(raw) || Number(raw) > 100) {
    throw new Error(`Enter the ${label} as a percentage from 0 to 100.`);
  }
  return Math.round(Number(raw) * 100);
}

function transactionCount(value, fallback = -1) {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  if (!/^\d{1,4}$/.test(raw)) throw new Error('Enter the number of Whatnot transactions as a whole number.');
  return Number(raw);
}

function nullableCurrencyToCents(value, label) {
  return String(value ?? '').trim() ? currencyToCents(value, label) : null;
}

function normalizeWhatnotFees(payload = {}, defaults = DEFAULT_WHATNOT_FEES) {
  const has = key => Object.prototype.hasOwnProperty.call(payload, key);
  return {
    commissionBasisPoints: percentageToBasisPoints(
      has('whatnotCommissionRate') ? payload.whatnotCommissionRate : '',
      Number(defaults.commissionBasisPoints ?? DEFAULT_WHATNOT_FEES.commissionBasisPoints),
      'Whatnot commission rate'
    ),
    processingBasisPoints: percentageToBasisPoints(
      has('whatnotProcessingRate') ? payload.whatnotProcessingRate : '',
      Number(defaults.processingBasisPoints ?? DEFAULT_WHATNOT_FEES.processingBasisPoints),
      'payment processing rate'
    ),
    transactionFeeCents: has('whatnotTransactionFee')
      ? currencyToCents(payload.whatnotTransactionFee, 'per-transaction fee')
      : Math.max(0, Number(defaults.transactionFeeCents ?? DEFAULT_WHATNOT_FEES.transactionFeeCents)),
    transactionCount: has('whatnotTransactionCount')
      ? transactionCount(payload.whatnotTransactionCount, -1)
      : Number(defaults.transactionCount ?? DEFAULT_WHATNOT_FEES.transactionCount),
    feeTaxBasisPoints: percentageToBasisPoints(
      has('whatnotFeeTaxRate') ? payload.whatnotFeeTaxRate : '',
      Number(defaults.feeTaxBasisPoints ?? DEFAULT_WHATNOT_FEES.feeTaxBasisPoints),
      'tax rate on payment processing fees'
    ),
    additionalFeeCents: has('whatnotAdditionalFees')
      ? currencyToCents(payload.whatnotAdditionalFees, 'additional Whatnot fees')
      : Math.max(0, Number(defaults.additionalFeeCents ?? DEFAULT_WHATNOT_FEES.additionalFeeCents)),
    actualFeeCents: has('whatnotActualFees')
      ? nullableCurrencyToCents(payload.whatnotActualFees, 'actual total Whatnot fees')
      : (defaults.actualFeeCents == null ? null : Math.max(0, Number(defaults.actualFeeCents)))
  };
}

function whatnotFeeBreakdown(record = {}) {
  const grossSalesCents = Math.max(0, Number(record.gross_sales_cents ?? record.grossSalesCents ?? 0));
  const boxCostCents = Math.max(0, Number(record.box_cost_cents ?? record.boxCostCents ?? 0));
  const pricedOrderCount = Math.max(0, Number(record.priced_order_count ?? record.pricedOrderCount ?? 0));
  const commissionBasisPoints = Math.max(0, Number(record.whatnot_commission_bps ?? record.commissionBasisPoints ?? DEFAULT_WHATNOT_FEES.commissionBasisPoints));
  const processingBasisPoints = Math.max(0, Number(record.whatnot_processing_bps ?? record.processingBasisPoints ?? DEFAULT_WHATNOT_FEES.processingBasisPoints));
  const transactionFeeCents = Math.max(0, Number(record.whatnot_transaction_fee_cents ?? record.transactionFeeCents ?? DEFAULT_WHATNOT_FEES.transactionFeeCents));
  const savedTransactionCount = Number(record.whatnot_transaction_count ?? record.transactionCount ?? DEFAULT_WHATNOT_FEES.transactionCount);
  const resolvedTransactionCount = savedTransactionCount >= 0 ? Math.floor(savedTransactionCount) : pricedOrderCount;
  const feeTaxBasisPoints = Math.max(0, Number(record.whatnot_fee_tax_bps ?? record.feeTaxBasisPoints ?? DEFAULT_WHATNOT_FEES.feeTaxBasisPoints));
  const additionalFeeCents = Math.max(0, Number(record.whatnot_additional_fee_cents ?? record.additionalFeeCents ?? 0));
  const rawActualFee = record.whatnot_actual_fee_cents ?? record.actualFeeCents;
  const actualFeeCents = rawActualFee == null ? null : Math.max(0, Number(rawActualFee));
  const commissionFeeCents = Math.round(grossSalesCents * commissionBasisPoints / 10000);
  const processingPercentageFeeCents = Math.round(grossSalesCents * processingBasisPoints / 10000);
  const transactionFeesCents = resolvedTransactionCount * transactionFeeCents;
  const processingFeeCents = processingPercentageFeeCents + transactionFeesCents;
  const feeTaxCents = Math.round(processingFeeCents * feeTaxBasisPoints / 10000);
  const estimatedFeeCents = commissionFeeCents + processingFeeCents + feeTaxCents + additionalFeeCents;
  const usesActualFee = actualFeeCents != null;
  const totalWhatnotFeeCents = usesActualFee ? actualFeeCents : estimatedFeeCents;
  const netPayoutCents = grossSalesCents - totalWhatnotFeeCents;
  return {
    commissionBasisPoints,
    processingBasisPoints,
    transactionFeeCents,
    transactionCount: resolvedTransactionCount,
    transactionCountIsAutomatic: savedTransactionCount < 0,
    feeTaxBasisPoints,
    additionalFeeCents,
    actualFeeCents,
    commissionFeeCents,
    processingPercentageFeeCents,
    transactionFeesCents,
    processingFeeCents,
    feeTaxCents,
    estimatedFeeCents,
    totalWhatnotFeeCents,
    usesActualFee,
    netPayoutCents,
    netProfitCents: netPayoutCents - boxCostCents
  };
}

function orderHistoryTotals(items = []) {
  const rows = Array.isArray(items) ? items : [];
  const pricedItems = rows.filter(item => Number(item.sale_amount_cents || 0) > 0);
  return {
    confirmedOrderCount: rows.length,
    pricedOrderCount: pricedItems.length,
    unpricedOrderCount: rows.length - pricedItems.length,
    grossSalesCents: pricedItems.reduce((total, item) => total + Math.max(0, Number(item.sale_amount_cents || 0)), 0)
  };
}

module.exports = {
  BREAK_DISPOSITIONS,
  DEFAULT_WHATNOT_FEES,
  currencyToCents,
  dispositionLabel,
  ensureBreakOrderHistorySchema,
  isDeductibleBreakDisposition,
  normalizeBreakDisposition,
  normalizeHistoryBreakName,
  normalizeHistoryNotes,
  normalizeWhatnotFees,
  orderHistoryTotals,
  whatnotFeeBreakdown
};
