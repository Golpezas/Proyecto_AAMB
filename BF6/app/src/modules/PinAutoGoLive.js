'use strict';

// Decides whether a successful connector reconcile should fire PIN go-live.
// One shot per live-ledger key so ongoing Assigned sync does not spam the API.

function shouldTriggerAutoGoLive({
  enabled,
  hasClient,
  ledgerKey,
  lastFiredLedgerKey
}) {
  if (!enabled) return false;
  if (!hasClient) return false;
  if (!ledgerKey) return false;
  if (ledgerKey === lastFiredLedgerKey) return false;
  return true;
}

function createPinAutoGoLiveController({ getSettings, buildClient, getLedgerKey, logError = console.error }) {
  let lastFiredLedgerKey = '';

  function maybeAfterReconcileSuccess() {
    try {
      const settings = getSettings();
      const ledgerKey = String(getLedgerKey() || '').trim();
      const hasClient = Boolean(settings?.baseUrl && settings?.channelId && settings?.apiKey);
      if (!shouldTriggerAutoGoLive({
        enabled: settings?.autoGoLiveOnShowReady === true,
        hasClient,
        ledgerKey,
        lastFiredLedgerKey
      })) {
        return { fired: false };
      }
      const client = buildClient(settings);
      if (!client) return { fired: false };
      // Claim this ledger before the network call so a down API cannot
      // re-fire on every subsequent reconcile during the same show.
      lastFiredLedgerKey = ledgerKey;
      // Start the request now; do not await it (connector response must not wait).
      client.setLive(true).catch(error => {
        logError('PIN auto go-live failed:', error?.message || error);
      });
      return { fired: true, ledgerKey };
    } catch (error) {
      logError('PIN auto go-live failed:', error?.message || error);
      return { fired: false, error };
    }
  }

  function resetForTests() {
    lastFiredLedgerKey = '';
  }

  return {
    maybeAfterReconcileSuccess,
    resetForTests,
    get lastFiredLedgerKey() {
      return lastFiredLedgerKey;
    }
  };
}

module.exports = {
  shouldTriggerAutoGoLive,
  createPinAutoGoLiveController
};
