const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { normalizeExistingSpecialCards } = require('./CatalogMigrations');

const database = new DatabaseSync(':memory:');
database.exec('CREATE TABLE cards (id INTEGER PRIMARY KEY, rarity TEXT, source_rarity TEXT)');
database.prepare('INSERT INTO cards (id, rarity, source_rarity) VALUES (?, ?, ?)').run(1, 'SP CARD', '');
database.prepare('INSERT INTO cards (id, rarity, source_rarity) VALUES (?, ?, ?)').run(2, 'SPECIAL', '');
database.prepare('INSERT INTO cards (id, rarity, source_rarity) VALUES (?, ?, ?)').run(3, 'SP', 'SP CARD');

normalizeExistingSpecialCards(database);
const rows = database.prepare('SELECT id, rarity, source_rarity FROM cards ORDER BY id').all().map(row => ({ ...row }));
assert.deepEqual(rows, [
  { id: 1, rarity: 'SP', source_rarity: 'SP CARD' },
  { id: 2, rarity: 'SP', source_rarity: 'SPECIAL' },
  { id: 3, rarity: 'SP', source_rarity: 'SP CARD' }
]);
database.close();
console.log('SP rarity migration test passed.');
