const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const {
  deletePullHistoryBatch,
  ensurePullHistorySchema,
  listPullHistory,
  normalizePullHistoryItem,
  pullHistoryImageRows,
  replacePullHistorySnapshot
} = require('./PullHistory');

assert.deepEqual(normalizePullHistoryItem({
  buyer_name: ' @buyer ',
  position: 7,
  card_name: ' Vi, Piltover Enforcer ',
  card_number: 'unl-229*/219',
  set_code: 'unl',
  rarity: 'Showcase',
  collector_treatment: 'Overnumbered · Signature',
  quantity: 2,
  source_kind: 'audit'
}), {
  buyerName: '@buyer',
  position: 7,
  cardName: 'Vi, Piltover Enforcer',
  cardNumber: 'unl-229*/219',
  setCode: 'UNL',
  rarity: 'Showcase',
  collectorTreatment: 'Overnumbered · Signature',
  variantHint: '',
  quantity: 2,
  sourceKind: 'audit',
  marketPriceCents: null,
  marketSource: '',
  marketVariant: '',
  marketExternalId: '',
  marketUpdatedAt: null,
  marketMatchStatus: ''
});

const database = new DatabaseSync(':memory:');
database.exec('PRAGMA foreign_keys = ON');
ensurePullHistorySchema(database);
database.exec(`
  CREATE TABLE cards (
    id INTEGER PRIMARY KEY,
    card_number TEXT,
    set_code TEXT,
    image_path TEXT,
    image_url TEXT
  );
  INSERT INTO cards(id, card_number, set_code, image_path, image_url) VALUES
    (1, 'UNL-229/219', 'UNL', '/images/unsigned.webp', 'https://images.example/unsigned.webp'),
    (2, 'UNL-229*/219', 'UNL', '/images/signed.webp', 'https://images.example/signed.webp'),
    (3, 'UNL-229*/219', 'VEN', '/images/wrong-set.webp', 'https://images.example/wrong-set.webp');
`);

const first = replacePullHistorySnapshot(database, {
  ledgerSavedAt: '2026-08-18T01:00:00.000Z',
  gameCode: 'RIFTBOUND',
  recordedAt: '2026-08-18T02:00:00.000Z',
  spots: [
    { buyerName: 'buyer-a', position: 4, paidCents: 2000 },
    { buyerName: 'buyer-b', position: 16, paidCents: 1200 }
  ],
  items: [
    { buyerName: 'buyer-a', position: 4, cardName: 'Piltover Enforcer', cardNumber: 'UNL-229*/219', setCode: 'UNL', rarity: 'Showcase', collectorTreatment: 'Overnumbered · Signature', quantity: 1, sourceKind: 'audit' },
    { buyerName: 'buyer-b', position: 16, cardName: 'Elder Dragon', cardNumber: 'UNL-118/219', setCode: 'UNL', rarity: 'Epic', quantity: 2, sourceKind: 'audit' }
  ]
});
assert.equal(first.updated, false);
assert.equal(first.savedCards, 3);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM pull_history_batches').get().count, 1);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM pull_history_items').get().count, 2);
assert.equal(database.prepare('SELECT SUM(paid_cents) AS total FROM pull_history_spots').get().total, 3200);
database.prepare("UPDATE pull_history_items SET market_price_cents = 8000, market_source = 'JustTCG', market_match_status = 'matched' WHERE card_number = 'UNL-229*/219'").run();

const corrected = replacePullHistorySnapshot(database, {
  ledgerSavedAt: '2026-08-18T01:00:00.000Z',
  gameCode: 'RIFTBOUND',
  recordedAt: '2026-08-18T02:30:00.000Z',
  spots: [{ buyerName: 'buyer-a', position: 4, paidCents: 2000 }],
  items: [
    { buyerName: 'buyer-a', position: 4, cardName: 'Piltover Enforcer', cardNumber: 'UNL-229*/219', setCode: 'UNL', rarity: 'Showcase', collectorTreatment: 'Overnumbered · Signature', quantity: 1, sourceKind: 'audit' }
  ]
});
assert.equal(corrected.updated, true);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM pull_history_batches').get().count, 1);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM pull_history_items').get().count, 1);
assert.equal(database.prepare('SELECT market_price_cents FROM pull_history_items').get().market_price_cents, 8000);

replacePullHistorySnapshot(database, {
  ledgerSavedAt: '2026-08-18T03:00:00.000Z',
  gameCode: 'ONEPIECE',
  recordedAt: '2026-08-18T04:00:00.000Z',
  spots: [{ buyerName: 'buyer-c', position: 1, paidCents: 3500 }],
  items: [
    { buyerName: 'buyer-c', position: 1, cardName: 'Sakazuki', cardNumber: 'OP16-065', setCode: 'OP-16', rarity: 'MANGA', quantity: 1, sourceKind: 'selected' }
  ]
});
database.exec(`
  CREATE TABLE break_order_history (
    id INTEGER PRIMARY KEY,
    break_name TEXT NOT NULL,
    pull_history_batch_id INTEGER
  );
`);
database.prepare('INSERT INTO break_order_history (break_name, pull_history_batch_id) VALUES (?, ?)').run('Vendetta Box 1', first.id);
const history = listPullHistory(database);
assert.equal(history.length, 2);
assert.equal(history[0].game_code, 'ONEPIECE');
assert.equal(history[0].total_cards, 1);
assert.equal(history[1].items[0].card_number, 'UNL-229*/219');
assert.equal(history[1].saved_box_name, 'Vendetta Box 1');
assert.equal(history[1].valuation.paid_cents, 2000);
assert.equal(history[1].valuation.pull_value_cents, 8000);
assert.equal(history[1].valuation.value_difference_cents, 6000);
assert.equal(history[1].valuation.complete, true);
const firstPage = listPullHistory(database, { limit: 1 });
assert.equal(firstPage.length, 1);
assert.equal(firstPage[0].id, history[0].id);
const imageRows = pullHistoryImageRows(database);
const signedImage = imageRows.find(row => row.image_path === '/images/signed.webp');
assert.ok(signedImage);
assert.equal(imageRows.some(row => row.image_path === '/images/unsigned.webp'), false);
assert.equal(imageRows.some(row => row.image_path === '/images/wrong-set.webp'), false);
const firstPageImages = pullHistoryImageRows(database, [firstPage[0].id]);
assert.equal(firstPageImages.length, firstPage[0].items.length);
database.exec('CREATE TABLE live_connector_guard (id INTEGER PRIMARY KEY, value TEXT); INSERT INTO live_connector_guard VALUES (1, \'untouched\');');
const deleted = deletePullHistoryBatch(database, firstPage[0].id);
assert.equal(deleted.deleted, true);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM pull_history_batches').get().count, 1);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM pull_history_items WHERE batch_id = ?').get(firstPage[0].id).count, 0);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM pull_history_spots WHERE batch_id = ?').get(firstPage[0].id).count, 0);
assert.equal(database.prepare('SELECT value FROM live_connector_guard WHERE id = 1').get().value, 'untouched');
assert.throws(() => deletePullHistoryBatch(database, firstPage[0].id), /no longer exists/);
database.close();

const legacy = new DatabaseSync(':memory:');
legacy.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE pull_history_batches (
    id INTEGER PRIMARY KEY, ledger_saved_at TEXT NOT NULL UNIQUE,
    game_code TEXT NOT NULL, set_code TEXT NOT NULL DEFAULT '',
    set_name TEXT NOT NULL DEFAULT '', recorded_at TEXT NOT NULL
  );
  CREATE TABLE pull_history_items (
    id INTEGER PRIMARY KEY, batch_id INTEGER NOT NULL, buyer_name TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL, card_name TEXT NOT NULL, card_number TEXT NOT NULL DEFAULT '',
    set_code TEXT NOT NULL DEFAULT '', rarity TEXT NOT NULL DEFAULT '',
    collector_treatment TEXT NOT NULL DEFAULT '', quantity INTEGER NOT NULL DEFAULT 1,
    source_kind TEXT NOT NULL DEFAULT 'selected',
    FOREIGN KEY(batch_id) REFERENCES pull_history_batches(id) ON DELETE CASCADE
  );
`);
ensurePullHistorySchema(legacy);
assert.ok(legacy.prepare('PRAGMA table_info(pull_history_batches)').all().some(column => column.name === 'price_refreshed_at'));
assert.ok(legacy.prepare('PRAGMA table_info(pull_history_items)').all().some(column => column.name === 'market_price_cents'));
assert.ok(legacy.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pull_history_spots'").get());
legacy.close();

console.log('Pull History checks passed.');
