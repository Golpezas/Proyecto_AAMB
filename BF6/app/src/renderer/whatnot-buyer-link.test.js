const assert = require('node:assert/strict');
const { username, profileUrl } = require('./whatnot-buyer-link');

assert.equal(username(' @buyer.name '), 'buyer.name');
assert.equal(username('buyer_name-23'), 'buyer_name-23');
assert.equal(profileUrl('@buyer.name'), 'https://www.whatnot.com/user/buyer.name');
assert.equal(profileUrl(' buyer_name-23 '), 'https://www.whatnot.com/user/buyer_name-23');
assert.equal(profileUrl('buyer name'), '');
assert.equal(profileUrl('buyer/name'), '');
assert.equal(profileUrl('https://example.com'), '');
assert.equal(profileUrl(''), '');

console.log('Whatnot buyer profile link tests passed.');
