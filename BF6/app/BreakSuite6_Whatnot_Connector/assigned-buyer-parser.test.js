const assert = require('assert');
const { extract } = require('./assigned-buyer-parser');

assert.strictEqual(extract('Sold to: N narigha'), 'narigha');
assert.strictEqual(extract('Sold to: @real_buyer'), 'real_buyer');
assert.strictEqual(extract('Sold to M buyer.two'), 'buyer.two');
assert.strictEqual(extract('Winner: W actual-winner'), 'actual-winner');
assert.strictEqual(extract('Buyer: @buyer_name'), 'buyer_name');
assert.strictEqual(extract('Username: user.name'), 'user.name');
assert.strictEqual(extract('Add winner will be displayed after the auction'), '');
assert.strictEqual(extract('10 — LeBlanc Add winner will receive a card'), '');
assert.strictEqual(extract('Winner will be selected automatically'), '');
assert.strictEqual(extract('irrelevant row text', '@profile_user'), 'profile_user');
console.log('assigned-buyer-parser tests passed');
