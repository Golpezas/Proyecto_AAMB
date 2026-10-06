const assert = require('node:assert/strict');
const gate = require('./assignment-count-gate');

assert.deepEqual(
  gate.decide({ baselineCount: null, pageCount: 18, freshCount: 18 }),
  { action: 'baseline', nextCount: 18, emitIndex: -1 }
);
assert.deepEqual(
  gate.decide({ baselineCount: 18, pageCount: 18, freshCount: 1 }),
  { action: 'wait', nextCount: 18, emitIndex: -1 }
);
assert.deepEqual(
  gate.decide({ baselineCount: 18, pageCount: 19, freshCount: 1 }),
  { action: 'emit', nextCount: 19, emitIndex: 0, emitCount: 1 }
);
assert.deepEqual(
  gate.decide({ baselineCount: 18, pageCount: 19, freshCount: 7 }),
  { action: 'emit', nextCount: 19, emitIndex: 0, emitCount: 1 }
);
assert.deepEqual(
  gate.decide({ baselineCount: 18, pageCount: 21, freshCount: 3 }),
  { action: 'emit', nextCount: 21, emitIndex: 0, emitCount: 3 }
);
assert.deepEqual(
  gate.decide({ baselineCount: 18, pageCount: 19, freshCount: 0 }),
  { action: 'probe', nextCount: 19, emitIndex: -1, emitCount: 1 }
);
assert.deepEqual(
  gate.decide({ baselineCount: 18, pageCount: 19, freshCount: 1, pendingTarget: 19 }),
  { action: 'wait', nextCount: 18, emitIndex: -1 }
);
assert.deepEqual(
  gate.decide({ baselineCount: 18, pageCount: 17, freshCount: 1 }),
  { action: 'sync', nextCount: 17, emitIndex: -1 }
);
assert.deepEqual(
  gate.decide({ baselineCount: 18, pageCount: null, freshCount: 1 }),
  { action: 'sync', nextCount: 18, emitIndex: -1 }
);

console.log('assignment count gate tests passed');
