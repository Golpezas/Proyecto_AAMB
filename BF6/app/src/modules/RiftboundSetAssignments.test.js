const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { setCodeFromCardNumber, repairRiftboundSetAssignments } = require('./RiftboundSetAssignments');

assert.equal(setCodeFromCardNumber('UNL-078/219'), 'UNL');
assert.equal(setCodeFromCardNumber('sfd-r03b'), 'SFD');
assert.equal(setCodeFromCardNumber('OP16-001'), '');

const database = new DatabaseSync(':memory:');
database.exec(`
  CREATE TABLE cards (
    id INTEGER PRIMARY KEY,
    official_id TEXT,
    card_number TEXT,
    game_code TEXT,
    game_name TEXT,
    set_code TEXT,
    set_name TEXT,
    product_name TEXT
  );
`);
database.prepare('INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
  1, 'riftbound:lost-set', 'UNL-078/219', '', '', '', '', ''
);
database.prepare('INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
  2, 'onepiece:keep', 'OP16-001', 'ONEPIECE', 'One Piece', 'OP16', 'OP-16', 'OP-16 Booster'
);
const sets = [{ setCode: 'UNL', setName: 'Unleashed', productName: 'Unleashed Booster' }];
assert.deepEqual(repairRiftboundSetAssignments(database, sets), { repairedRiftboundSetAssignments: 1 });
assert.deepEqual({ ...database.prepare('SELECT game_code, set_code, set_name FROM cards WHERE id = 1').get() }, {
  game_code: 'RIFTBOUND', set_code: 'UNL', set_name: 'Unleashed'
});
assert.equal(database.prepare('SELECT set_code FROM cards WHERE id = 2').get().set_code, 'OP16');
database.close();

console.log('RiftboundSetAssignments tests passed');
