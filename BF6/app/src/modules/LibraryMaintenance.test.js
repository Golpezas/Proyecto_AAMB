const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { deduplicateOfficialCards, resetLocalLibrary } = require('./LibraryMaintenance');

const database = new DatabaseSync(':memory:');
database.exec(`
  CREATE TABLE cards (
    id INTEGER PRIMARY KEY,
    source TEXT NOT NULL,
    card_number TEXT,
    rarity TEXT,
    card_type TEXT,
    name TEXT,
    image_url TEXT,
    image_path TEXT,
    details_json TEXT
  );
  CREATE TABLE saved_cards (card_id INTEGER PRIMARY KEY, saved_at TEXT NOT NULL);
  CREATE TABLE break_board_cards (card_id INTEGER PRIMARY KEY, position INTEGER UNIQUE NOT NULL, added_at TEXT NOT NULL);
  CREATE TABLE active_break_board_cards (position INTEGER PRIMARY KEY, card_id INTEGER UNIQUE NOT NULL, saved_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ready', buyer_name TEXT NOT NULL DEFAULT '', called_at TEXT);
  CREATE TABLE break_board_presets (slot INTEGER PRIMARY KEY, name TEXT NOT NULL, saved_at TEXT NOT NULL);
  CREATE TABLE break_board_preset_cards (slot INTEGER NOT NULL, position INTEGER NOT NULL, card_id INTEGER NOT NULL, added_at TEXT NOT NULL, PRIMARY KEY(slot, position), UNIQUE(slot, card_id));
  CREATE TABLE import_sessions (id INTEGER PRIMARY KEY, source TEXT);
  CREATE TABLE app_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

const insert = database.prepare('INSERT INTO cards (id, source, card_number, rarity, card_type, name, image_url, image_path, details_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
insert.run(1, 'Official Bandai', 'OP16-001', 'L', 'LEADER', 'Portgas.D.Ace', 'https://en.onepiece-cardgame.com/images/cardlist/card/OP16-001.png?cache=old', '', '{"short":true}');
insert.run(2, 'Official Bandai', 'OP16-001', 'L', 'LEADER', 'Portgas.D.Ace', 'https://en.onepiece-cardgame.com/images/cardlist/card/OP16-001.png?cache=new', 'cached-image.png', '{"complete":true}');
insert.run(3, 'Official Bandai', 'OP16-001', 'L', 'LEADER', 'Portgas.D.Ace', 'https://en.onepiece-cardgame.com/images/cardlist/card/OP16-001_parallel.png?cache=new', 'parallel-image.png', '{"variant":true}');
database.prepare('INSERT INTO saved_cards (card_id, saved_at) VALUES (?, ?)').run(1, new Date().toISOString());
database.prepare('INSERT INTO break_board_cards (card_id, position, added_at) VALUES (?, ?, ?)').run(1, 1, new Date().toISOString());
database.prepare('INSERT INTO active_break_board_cards (position, card_id, saved_at) VALUES (?, ?, ?)').run(1, 1, new Date().toISOString());
database.prepare('INSERT INTO break_board_presets (slot, name, saved_at) VALUES (?, ?, ?)').run(1, 'OP-16 · 82 cards', new Date().toISOString());
database.prepare('INSERT INTO break_board_preset_cards (slot, position, card_id, added_at) VALUES (?, ?, ?, ?)').run(1, 1, 1, new Date().toISOString());

const repair = deduplicateOfficialCards(database);
assert.deepEqual(repair, { removedDuplicates: 1, groupsRepaired: 1 });
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM cards').get().count, 2);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM saved_cards').get().count, 1);
assert.equal(database.prepare('SELECT card_id FROM saved_cards').get().card_id, 2);
assert.equal(database.prepare('SELECT card_id FROM break_board_cards').get().card_id, 2);
assert.equal(database.prepare('SELECT card_id FROM active_break_board_cards').get().card_id, 2);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM cards WHERE image_url LIKE ?').get('%parallel%').count, 1);

database.prepare('INSERT INTO import_sessions (source) VALUES (?)').run('Official Bandai');
assert.throws(() => resetLocalLibrary(database, 'delete'), /Type DELETE exactly/);
const reset = resetLocalLibrary(database, 'DELETE');
assert.deepEqual(reset, { deletedCards: 2, imagesPreserved: true });
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM cards').get().count, 0);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM saved_cards').get().count, 0);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM break_board_cards').get().count, 0);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM active_break_board_cards').get().count, 0);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM break_board_presets').get().count, 0);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM break_board_preset_cards').get().count, 0);
assert.equal(database.prepare('SELECT COUNT(*) AS count FROM import_sessions').get().count, 0);
database.close();
console.log('Library maintenance test passed.');
