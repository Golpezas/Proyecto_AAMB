'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  shouldTriggerAutoGoLive,
  createPinAutoGoLiveController
} = require('./PinAutoGoLive');

test('shouldTriggerAutoGoLive requires toggle, client, and new ledger', () => {
  assert.equal(shouldTriggerAutoGoLive({
    enabled: true,
    hasClient: true,
    ledgerKey: 'ledger-1',
    lastFiredLedgerKey: ''
  }), true);
  assert.equal(shouldTriggerAutoGoLive({
    enabled: false,
    hasClient: true,
    ledgerKey: 'ledger-1',
    lastFiredLedgerKey: ''
  }), false);
  assert.equal(shouldTriggerAutoGoLive({
    enabled: true,
    hasClient: false,
    ledgerKey: 'ledger-1',
    lastFiredLedgerKey: ''
  }), false);
  assert.equal(shouldTriggerAutoGoLive({
    enabled: true,
    hasClient: true,
    ledgerKey: '',
    lastFiredLedgerKey: ''
  }), false);
  assert.equal(shouldTriggerAutoGoLive({
    enabled: true,
    hasClient: true,
    ledgerKey: 'ledger-1',
    lastFiredLedgerKey: 'ledger-1'
  }), false);
});

test('controller fires once per ledger and never awaits setLive', async () => {
  const calls = [];
  let resolveLive;
  const livePromise = new Promise(resolve => { resolveLive = resolve; });
  const controller = createPinAutoGoLiveController({
    getSettings: () => ({
      baseUrl: 'https://api.example.com',
      channelId: 'ch1',
      apiKey: 'pin_sk_x',
      autoGoLiveOnShowReady: true
    }),
    buildClient: () => ({
      setLive: (live) => {
        calls.push(live);
        return livePromise;
      }
    }),
    getLedgerKey: () => 'ledger-a',
    logError: () => {}
  });

  const first = controller.maybeAfterReconcileSuccess();
  assert.equal(first.fired, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0], true);

  const second = controller.maybeAfterReconcileSuccess();
  assert.equal(second.fired, false);
  assert.equal(calls.length, 1);

  resolveLive({ is_live: true });
  await livePromise;
});

test('controller skips when auto toggle is off', () => {
  const calls = [];
  const controller = createPinAutoGoLiveController({
    getSettings: () => ({
      baseUrl: 'https://api.example.com',
      channelId: 'ch1',
      apiKey: 'pin_sk_x',
      autoGoLiveOnShowReady: false
    }),
    buildClient: () => ({ setLive: (live) => { calls.push(live); return Promise.resolve({ is_live: true }); } }),
    getLedgerKey: () => 'ledger-b',
    logError: () => {}
  });
  assert.equal(controller.maybeAfterReconcileSuccess().fired, false);
  assert.equal(calls.length, 0);
});

test('setLive failure is logged and does not throw', async () => {
  const errors = [];
  const controller = createPinAutoGoLiveController({
    getSettings: () => ({
      baseUrl: 'https://api.example.com',
      channelId: 'ch1',
      apiKey: 'pin_sk_x',
      autoGoLiveOnShowReady: true
    }),
    buildClient: () => ({
      setLive: async () => {
        throw new Error('quota exceeded');
      }
    }),
    getLedgerKey: () => 'ledger-c',
    logError: (...args) => { errors.push(args.join(' ')); }
  });

  assert.equal(controller.maybeAfterReconcileSuccess().fired, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.match(errors.join('\n'), /quota exceeded/);
});

test('new ledger after board save can fire again', () => {
  let ledger = 'ledger-1';
  const calls = [];
  const controller = createPinAutoGoLiveController({
    getSettings: () => ({
      baseUrl: 'https://api.example.com',
      channelId: 'ch1',
      apiKey: 'pin_sk_x',
      autoGoLiveOnShowReady: true
    }),
    buildClient: () => ({
      setLive: async (live) => {
        calls.push(live);
        return { is_live: true };
      }
    }),
    getLedgerKey: () => ledger,
    logError: () => {}
  });

  assert.equal(controller.maybeAfterReconcileSuccess().fired, true);
  ledger = 'ledger-2';
  assert.equal(controller.maybeAfterReconcileSuccess().fired, true);
  assert.equal(calls.length, 2);
});
