'use strict';

const assert = require('node:assert/strict');
const { recentUniqueBuyerNames, splitBuyerMentions } = require('./RecentBuyerMentions');

const rows = [
  { buyer_name: '@NewestBuyer' },
  { buyer_name: 'secondBuyer' },
  { buyer_name: 'newestbuyer' },
  { buyer_name: ' thirdBuyer ' }
];
assert.deepEqual(recentUniqueBuyerNames(rows, 100), ['NewestBuyer', 'secondBuyer', 'thirdBuyer']);

const chunks = splitBuyerMentions(['alpha', 'bravo', 'charlie'], 20);
assert.deepEqual(chunks, ['@alpha @bravo', '@charlie']);
assert.ok(chunks.every(chunk => chunk.length <= 20));
assert.equal(splitBuyerMentions(['name'])[0], '@name');
console.log('RecentBuyerMentions tests passed.');
