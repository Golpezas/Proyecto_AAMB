'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const gate = require('./assignment-count-gate');
const stability = require('./live-row-stability');

const deliveries = [];
let listener;
const context = vm.createContext({
  document: { documentElement: {} },
  MutationObserver: class { observe() {} },
  setInterval() {},
  setTimeout() { return 1; },
  clearTimeout() {},
  chrome: {
    runtime: {
      sendMessage: async message => {
        if (message.type === 'breaksuite:candidate') {
          deliveries.push(message.candidate);
          return { ok: true, accepted: true };
        }
        return { ok: true };
      },
      onMessage: { addListener(callback) { listener = callback; } }
    },
    storage: { local: { get: () => new Promise(() => {}), set: async () => {} } }
  },
  BreakSuiteAssignmentCountGate: gate,
  BreakSuiteLiveRowStability: stability
});
vm.runInContext(fs.readFileSync(path.join(__dirname, 'whatnot-content.js'), 'utf8'), context);

const oldRow = { buyer: 'oldbuyer', number: 3, text: '03 — Old spot' };
const newRow = { buyer: 'newbuyer', number: 7, text: '07 — New spot' };
vm.runInContext(`
  armed = true;
  baselineReady = true;
  activeLedgerSavedAt = 'current-box';
  baselineAssignedCount = 10;
  observedSignatures.add('oldbuyer|3');
  rowCandidates = () => [${JSON.stringify(oldRow)}];
  assignedCountFromPage = () => 11;
  assignedViewportAtTop = () => false;
  latestAssignedCandidates = async () => [${JSON.stringify(newRow)}];
  reportCandidates();
`, context);

(async () => {
  await new Promise(setImmediate);
  assert.deepEqual(deliveries.map(row => row.buyer), ['newbuyer'], 'A count increase finds the unseen top row even when the seller is scrolled away');
  assert.equal(vm.runInContext('baselineAssignedCount', context), 11);

  deliveries.length = 0;
  vm.runInContext(`
    baselineAssignedCount = 10;
    observedSignatures.delete('newbuyer|7');
    latestAssignedCandidates = async () => [${JSON.stringify(oldRow)}];
    reportCandidates();
  `, context);
  await new Promise(setImmediate);
  assert.equal(deliveries.length, 0, 'A stale historical top row cannot become a new popup');
  assert.equal(vm.runInContext('baselineAssignedCount', context), 10);

  vm.runInContext(`
    assignedCountFromPage = () => 10;
    latestAssignedCandidates = async () => [${JSON.stringify(newRow)}, ${JSON.stringify(oldRow)}];
  `, context);
  await vm.runInContext('probeOffscreenAssignedTop()', context);
  assert.equal(deliveries.length, 0, 'A stale count needs a second stable top-row observation');
  vm.runInContext('offscreenProbeFirstSeenAt = Date.now() - 1200', context);
  await vm.runInContext('probeOffscreenAssignedTop()', context);
  assert.deepEqual(deliveries.map(row => row.buyer), ['newbuyer'], 'The offscreen top probe delivers a stable new buyer without a manual refresh');
  assert.equal(vm.runInContext('acceptedBeforeCountRefresh', context), 1);

  vm.runInContext(`
    pendingSignatures.add('newbuyer|7');
    stableTopSignature = 'newbuyer|7';
    stableTopFirstSeenAt = 100;
  `, context);
  listener({ type: 'breaksuite:set-armed' }, null, () => {});
  assert.equal(vm.runInContext("pendingSignatures.has('newbuyer|7')", context), true, 'Repeated preflight must not interrupt delivery');
  assert.equal(vm.runInContext('stableTopFirstSeenAt', context), 100);

  vm.runInContext('pendingSignatures.clear(); acceptedBeforeCountRefresh = 1;', context);
  let acknowledged;
  listener({ type: 'breaksuite:reconcile-complete', assignedCount: 10 }, null, result => { acknowledged = result; });
  assert.equal(acknowledged.ok, true);
  assert.equal(vm.runInContext('acceptedBeforeCountRefresh', context), 1, 'A stale heading must still consume an earlier accepted sale when it catches up');
  console.log('Live Assigned watcher checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
