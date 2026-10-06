const assert = require('node:assert/strict');
const { count, select } = require('./round-assignment-window');

assert.equal(count(83, 82), 1);
assert.equal(count(82, 82), 0);
assert.equal(count(80, 82), 0);

const newestFirst = [
  { buyer: 'samebuyer', number: 1, round: 2 },
  { buyer: 'other', number: 4, round: 1 },
  { buyer: 'samebuyer', number: 1, round: 1 }
];
assert.deepEqual(select({ candidates: newestFirst, pageCount: 12, roundStartCount: 10 }), newestFirst.slice(0, 2));
assert.deepEqual(select({ candidates: newestFirst, pageCount: 10, roundStartCount: 10 }), []);
assert.deepEqual(select({ candidates: newestFirst, pageCount: null, roundStartCount: 10 }), []);
console.log('Round assignment window tests passed.');
