'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const roundWindow = require('./round-assignment-window');
let listener;
const context = vm.createContext({
  document: { documentElement: {} }, MutationObserver: class { observe() {} },
  setInterval() {}, setTimeout() { return 1; }, clearTimeout() {},
  chrome: { runtime: { sendMessage: async () => ({ ok: true }),
    onMessage: { addListener(cb) { listener = cb; } } },
    storage: { local: { get: () => new Promise(() => {}), set: async () => {} } } },
  BreakSuiteRoundAssignmentWindow: roundWindow
});
vm.runInContext(fs.readFileSync(require.resolve('./whatnot-content.js'), 'utf8'), context);
vm.runInContext(`
  activeLedgerSavedAt = 'round-a'; roundStartAssignedCount = 10;
  waitForAssignedRows = async () => {};
  queueScan = () => {};
  let attempts = 0;
  assignedCountFromPage = () => 12;
  status = () => ({ ledgerSavedAt: activeLedgerSavedAt, assignedCount: 12 });
  allAssignedCandidates = async () => {
    attempts++;
    return attempts === 1 ? [{ number: 1, buyer: 'alice' }] :
      [{ number: 2, buyer: 'bob' }, { number: 1, buyer: 'alice' }, { number: 99, buyer: 'old' }];
  };
`, context);
function scan() { return new Promise(resolve => listener({ type: 'breaksuite:scan-now' }, null, resolve)); }
(async () => {
  const recovered = await scan();
  assert.equal(recovered.scanComplete, true);
  assert.equal(recovered.allCandidates.length, 2);
  assert.equal(recovered.allCandidates[0].buyer, 'bob');
  assert.equal(vm.runInContext('attempts', context), 2, 'Retry a partial viewport internally');
  await new Promise(resolve => setImmediate(resolve));
  vm.runInContext(`allAssignedCandidates = async () => [{ number: 1, buyer: 'alice' }];`, context);
  const incomplete = await scan();
  assert.equal(incomplete.ok, false, 'An incomplete list must not become authoritative');
  assert.equal(incomplete.allCandidates, undefined);
  await new Promise(resolve => setImmediate(resolve));
  vm.runInContext(`allAssignedCandidates = async () => {
    activeLedgerSavedAt = activeLedgerSavedAt === 'round-a' ? 'round-b' : 'round-a';
    return [{ number: 2, buyer: 'bob' }, { number: 1, buyer: 'alice' }];
  };`, context);
  assert.equal((await scan()).ok, false, 'Never apply rows to a changed round');
  await new Promise(resolve => setImmediate(resolve));
  vm.runInContext(`allAssignedCandidates = async () => [{ number: 1, buyer: 'alice' }, { number: 1, buyer: 'bob' }];`, context);
  assert.equal((await scan()).ok, false, 'Conflicting owners require a stable list');
  console.log('Full-list recovery retries, current-round filtering, incomplete-list protection and round-change checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
