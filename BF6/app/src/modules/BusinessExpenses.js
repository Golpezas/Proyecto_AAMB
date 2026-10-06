const MAX_EXPENSE_TEXT = 140;
const MAX_EXPENSE_NOTES = 1200;
const EXPENSE_CATEGORIES = new Set([
  'Shipping supplies',
  'Inventory / sealed product',
  'Promotional Giveaway',
  'Customer Compensation / Make-Good',
  'Damaged Inventory',
  'Lost Inventory',
  'Owner / Personal Use',
  'Whatnot fees',
  'Equipment',
  'Other'
]);

function trim(value, maximum) { return String(value ?? '').trim().slice(0, maximum); }
function normalizeExpenseCategory(value) { return EXPENSE_CATEGORIES.has(value) ? value : 'Other'; }
function normalizeExpenseDate(value) {
  const text = String(value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : new Date().toISOString().slice(0, 10);
}
function ensureBusinessExpenseSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS business_expenses (
      id INTEGER PRIMARY KEY,
      expense_name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Other',
      vendor TEXT NOT NULL DEFAULT '',
      amount_cents INTEGER NOT NULL DEFAULT 0,
      purchased_on TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_business_expenses_date ON business_expenses(purchased_on DESC, id DESC);
  `);
}

module.exports = { EXPENSE_CATEGORIES, MAX_EXPENSE_NOTES, MAX_EXPENSE_TEXT, ensureBusinessExpenseSchema, normalizeExpenseCategory, normalizeExpenseDate, trim };
