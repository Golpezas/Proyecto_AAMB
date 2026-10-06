const assert = require('node:assert/strict');
const stability = require('./live-row-stability');

const base = {
  candidateSignature: 'buyer|17',
  visibleTopSignature: 'buyer|17',
  baselineCount: 8,
  pageCount: 8,
  pending: false,
  viewportAtTop: true,
  ledgerReady: true,
  minimumStableMs: 1100
};

assert.deepEqual(
  stability.decide({ ...base, previousSignature: '', firstSeenAt: 0, now: 1000 }),
  { action: 'track', signature: 'buyer|17', firstSeenAt: 1000 }
);
assert.deepEqual(
  stability.decide({ ...base, previousSignature: 'buyer|17', firstSeenAt: 1000, now: 1800 }),
  { action: 'track', signature: 'buyer|17', firstSeenAt: 1000 }
);
assert.deepEqual(
  stability.decide({ ...base, previousSignature: 'buyer|17', firstSeenAt: 1000, now: 2100 }),
  { action: 'emit', signature: 'buyer|17', firstSeenAt: 1000 }
);
assert.equal(stability.decide({ ...base, viewportAtTop: false }).action, 'reset');
assert.equal(stability.decide({ ...base, pending: true }).action, 'reset');
assert.equal(stability.decide({ ...base, ledgerReady: false }).action, 'reset');
assert.equal(stability.decide({ ...base, pageCount: 9 }).action, 'reset');
assert.equal(stability.decide({ ...base, visibleTopSignature: 'older|4' }).action, 'reset');

// Some Whatnot layouts temporarily omit Assigned (n). A stable top row still
// needs to reach BreakSuite without asking the seller to refresh the list.
assert.equal(stability.decide({
  ...base,
  pageCount: null,
  previousSignature: 'buyer|17',
  firstSeenAt: 1000,
  now: 2200
}).action, 'emit');

console.log('Live row stability tests passed.');
