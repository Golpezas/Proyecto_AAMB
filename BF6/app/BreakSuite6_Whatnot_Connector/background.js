const APP_ORIGIN = 'http://127.0.0.1:8878';
const WHATNOT_QUERY = { url: ['*://*.whatnot.com/*'] };
const recentDeliveries = new Map();
const BOUND_LIVE_TAB_KEY = 'boundLiveTabId';
const ROUND_LEDGER_KEY = 'roundLedgerSavedAt';
const ROUND_BASELINE_COUNT_KEY = 'roundBaselineAssignedCount';
const LAST_ASSIGNED_COUNT_KEY = 'lastObservedAssignedCount';
const ALWAYS_ON_SYNC = true;

if (chrome.sidePanel?.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}

function messageForError(error) {
  return error instanceof Error ? error.message : String(error || 'Unknown error');
}

async function appJson(path, options = {}) {
  const response = await fetch(`${APP_ORIGIN}${path}`, { cache: 'no-store', ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `BreakSuite6 returned ${response.status}.`);
  return payload;
}

function isLiveManagerTab(tab) {
  if (!tab?.url) return false;
  try {
    const url = new URL(tab.url);
    return /(^|\.)whatnot\.com$/i.test(url.hostname)
      && /\/(?:dashboard\/)?live(?:\/|$)/i.test(url.pathname);
  } catch {
    return false;
  }
}

async function getBoundLiveTab() {
  const stored = await chrome.storage.local.get(BOUND_LIVE_TAB_KEY);
  const tabId = Number(stored[BOUND_LIVE_TAB_KEY]);
  if (!tabId) return null;
  try {
    const tab = await chrome.tabs.get(tabId);
    if (isLiveManagerTab(tab)) return tab;
  } catch {
    // The seller may have closed the prior live tab. Clear the stale binding
    // rather than silently moving the scanner to a different Whatnot tab.
  }
  await chrome.storage.local.remove(BOUND_LIVE_TAB_KEY);
  return null;
}

async function getActiveLiveManagerTab() {
  const active = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return active.find(isLiveManagerTab) || null;
}

async function getAvailableLiveManagerTab() {
  const active = await getActiveLiveManagerTab();
  if (active) return active;
  // The seller commonly leaves Whatnot running while researching cards in a
  // different tab. Find the open Live Manager across every browser window so
  // changing the visible tab never disconnects the scanner.
  const tabs = (await chrome.tabs.query(WHATNOT_QUERY)).filter(isLiveManagerTab);
  return tabs.sort((left, right) => Number(right.lastAccessed || 0) - Number(left.lastAccessed || 0))[0] || null;
}

async function bindLiveTab(tab) {
  if (!isLiveManagerTab(tab)) throw new Error('Open the Whatnot Live Manager tab you want to sync, then try again.');
  await chrome.storage.local.set({ [BOUND_LIVE_TAB_KEY]: tab.id });
  return tab;
}

async function getWhatnotTab() {
  // Once live sync begins, the connector is deliberately pinned to a single
  // Whatnot Live Manager tab. Multiple Whatnot tabs can be open safely; a
  // different tab is never selected just because it happens to be first.
  return (await getBoundLiveTab()) || (await getAvailableLiveManagerTab());
}

async function attachToWhatnotTab(tab) {
  if (!tab?.id) throw new Error('Open Whatnot Live Manager in a browser tab.');
  // A newly opened/duplicated Whatnot dashboard may exist before the manifest
  // content script is attached.  Inject our read-only scanner into that active
  // tab on demand so the seller does not have to hunt for a refresh button.
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['assignment-count-gate.js', 'round-assignment-window.js', 'live-row-stability.js', 'assigned-buyer-parser.js', 'whatnot-content.js']
  });
}

async function tabStatus(tab) {
  if (!tab?.id) return { connected: false, reason: 'Open Whatnot Live Manager in a browser tab.' };
  try {
    return await chrome.tabs.sendMessage(tab.id, { type: 'breaksuite:status' });
  } catch {
    try {
      await attachToWhatnotTab(tab);
      return await chrome.tabs.sendMessage(tab.id, { type: 'breaksuite:status' });
    } catch {
      return { connected: false, reason: 'Open the current Whatnot Live Manager tab, then verify again.' };
    }
  }
}

async function getArmed() {
  return Boolean((await chrome.storage.local.get('armed')).armed);
}

async function syncLedgerContext(tab, suppliedHealth = null) {
  if (!tab?.id) return { ledgerSavedAt: '', baselineAssignedCount: null };
  const health = suppliedHealth || await appJson('/api/health');
  const ledgerSavedAt = String(health.connector?.ledgerSavedAt || '');
  const stored = await chrome.storage.local.get([ROUND_LEDGER_KEY, ROUND_BASELINE_COUNT_KEY, LAST_ASSIGNED_COUNT_KEY]);
  let baselineAssignedCount = Number.isInteger(stored[ROUND_BASELINE_COUNT_KEY])
    ? stored[ROUND_BASELINE_COUNT_KEY]
    : null;
  if (stored[ROUND_LEDGER_KEY] !== ledgerSavedAt) {
    const page = await tabStatus(tab);
    const pageCount = Number.isInteger(page.assignedCount) ? page.assignedCount : null;
    const lastObserved = Number.isInteger(stored[LAST_ASSIGNED_COUNT_KEY]) ? stored[LAST_ASSIGNED_COUNT_KEY] : null;
    // Prefer the last count actually processed for the previous ledger. If a
    // new-box sale appeared before the panel reopened, it remains above this
    // boundary and is recoverable by Reconnect + Scan Now.
    baselineAssignedCount = lastObserved !== null && pageCount !== null && lastObserved <= pageCount
      ? lastObserved
      : pageCount;
    await chrome.storage.local.set({
      [ROUND_LEDGER_KEY]: ledgerSavedAt,
      [ROUND_BASELINE_COUNT_KEY]: baselineAssignedCount
    });
  }
  await chrome.tabs.sendMessage(tab.id, {
    type: 'breaksuite:set-ledger',
    ledgerSavedAt,
    baselineAssignedCount
  }).catch(() => null);
  return { ledgerSavedAt, baselineAssignedCount };
}

async function rememberAssignedCount(value) {
  if (Number.isInteger(value) && value >= 0) {
    await chrome.storage.local.set({ [LAST_ASSIGNED_COUNT_KEY]: value });
  }
}

async function finishReconciledScan(tab, assignedCount) {
  await rememberAssignedCount(assignedCount);
  if (Number.isInteger(assignedCount) && tab?.id) {
    await chrome.tabs.sendMessage(tab.id, { type: 'breaksuite:reconcile-complete', assignedCount }).catch(() => null);
  }
}

async function keepLiveSyncConnected({ scan = false } = {}) {
  if (!ALWAYS_ON_SYNC) return { armed: await getArmed(), tabId: (await getWhatnotTab())?.id || null };
  await chrome.storage.local.set({ armed: true });
  let tab = await getBoundLiveTab();
  if (!tab) {
    tab = await getAvailableLiveManagerTab();
    if (tab) await bindLiveTab(tab);
  }
  if (!tab?.id) return { armed: true, tabId: null };
  const page = await tabStatus(tab);
  if (!page.connected) return { armed: true, tabId: tab.id };
  await syncLedgerContext(tab).catch(() => null);
  await chrome.tabs.sendMessage(tab.id, { type: 'breaksuite:set-armed', armed: true }).catch(() => {});
  if (scan) await chrome.tabs.sendMessage(tab.id, { type: 'breaksuite:scan-now' }).catch(() => null);
  return { armed: true, tabId: tab.id };
}

async function setArmed(armed) {
  // Live sync is intentionally always on. The panel action is now a reconnect
  // and full scan instead of a stop toggle.
  const nextArmed = ALWAYS_ON_SYNC ? true : Boolean(armed);
  // Pin one Live Manager and ignore every other Whatnot page. The lock stays
  // active while the seller browses other websites.
  const tab = nextArmed
    ? ((await getBoundLiveTab()) || await bindLiveTab(await getAvailableLiveManagerTab()))
    : await getWhatnotTab();
  await chrome.storage.local.set({ armed: nextArmed });
  let synchronization = { foundCount: 0, deliveredCount: 0, reassignedCount: 0, releasedCount: 0 };
  if (tab?.id) {
    await tabStatus(tab);
    const ledger = await syncLedgerContext(tab);
    await chrome.tabs.sendMessage(tab.id, { type: 'breaksuite:set-armed', armed: nextArmed }).catch(() => {});
    if (nextArmed) {
      // Adopt every row already assigned before arming. The content watcher
      // may also retry those rows; the saved ledger safely deduplicates them.
      const scan = await chrome.tabs.sendMessage(tab.id, { type: 'breaksuite:scan-now' }).catch(() => null);
      if (scan && scan.ok !== false && scan.scanComplete && Array.isArray(scan.allCandidates)) {
        synchronization = await appJson('/api/connector/reconcile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ledgerSavedAt: ledger.ledgerSavedAt, assignments: scan.allCandidates || [] })
        });
        await finishReconciledScan(tab, scan.assignedCount);
      }
    }
  }
  return { armed: nextArmed, synchronization, tabId: tab?.id || null };
}

let showActionInFlight = false;
async function showAction(recover = false) {
  if (showActionInFlight) throw new Error('Show check is already running.');
  showActionInFlight = true;
  try {
    let tab = await getBoundLiveTab();
    if (!tab) {
      const active = await getActiveLiveManagerTab();
      const available = (await chrome.tabs.query(WHATNOT_QUERY)).filter(isLiveManagerTab);
      if (!active && available.length !== 1) throw new Error('Select the Whatnot Live Manager for this show, then Prepare Show.');
      tab = await bindLiveTab(active || available[0]);
    }
    const health = await appJson('/api/health');
    if (!health.connector?.boardReady) throw new Error('Save your Break Board first.');
    if (health.connector.testAssignments) throw new Error('Clear Test Buyer assignments before preparing a real show.');
    const page = await tabStatus(tab);
    if (!page.connected || !page.assignedFound || !Number.isInteger(page.assignedCount)) throw new Error('Open the Assigned list in the selected Whatnot Live Manager.');
    const ledger = await syncLedgerContext(tab, health);
    if (!Number.isInteger(ledger.baselineAssignedCount)) throw new Error('The show starting count is not available yet.');
    if (!recover && !health.connector.activeAssignments && page.assignedCount !== ledger.baselineAssignedCount) {
      throw new Error('Sales already appear above this board’s starting count. Use Recover / Recheck List to resume without skipping them.');
    }
    await chrome.storage.local.set({ armed: true });
    const armed = await chrome.tabs.sendMessage(tab.id, { type: 'breaksuite:set-armed', armed: true });
    if (armed?.ok === false) throw new Error(armed.error || 'Scanner could not start.');
    const scan = await chrome.tabs.sendMessage(tab.id, { type: 'breaksuite:scan-now' });
    if (!scan?.scanComplete || scan.ledgerSavedAt !== ledger.ledgerSavedAt) throw new Error(scan?.error || 'The full list could not be verified.');
    const reconciliation = await appJson('/api/connector/reconcile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ledgerSavedAt: ledger.ledgerSavedAt, assignments: scan.allCandidates })
    });
    await finishReconciledScan(tab, scan.assignedCount);
    const data = await preflight();
    if (data.ready) {
      await chrome.storage.local.set({ preparedShow: { ledgerSavedAt: ledger.ledgerSavedAt, tabId: tab.id } });
      data.prepared = true;
    }
    return { data, reconciliation, scan };
  } finally { showActionInFlight = false; }
}

async function preflight() {
  let health;
  try {
    health = await appJson('/api/health');
  } catch (error) {
    return {
      app: { ok: false, message: `BreakSuite6 is not reachable: ${messageForError(error)}` },
      board: { ok: false, message: 'Saved live ledger cannot be checked.' },
      overlay: { ok: false, message: 'OBS Card View cannot be checked.' },
      whatnot: { ok: false, message: 'Open Whatnot Live Manager.' },
      assigned: { ok: false, message: 'Assigned area is not checked yet.' },
      scanner: { ok: false, message: 'Scanner is not armed.' },
      ready: false
    };
  }
  const connector = health.connector || {};
  await keepLiveSyncConnected();
  const tab = await getWhatnotTab();
  const page = await tabStatus(tab);
  if (tab?.id && page.connected) await syncLedgerContext(tab, health);
  const armed = await getArmed();
  const scanAgeMs = Number(page.lastScanAt) ? Date.now() - Number(page.lastScanAt) : Infinity;
  const scannerCurrent = Boolean(armed && page.connected && page.baselineReady && Number.isInteger(page.roundStartAssignedCount) && scanAgeMs < 15000);
  const checks = {
    app: { ok: Boolean(connector.running), message: connector.running ? `BreakSuite6 connected — ${connector.activeCards || 0} saved blocks` : (connector.error || 'BreakSuite6 connector is offline.') },
    board: { ok: Boolean(connector.boardReady), message: connector.boardReady ? `Saved live ledger ready — ${connector.activeCards || 0} blocks` : 'Open Break Board and press Save Board ✓.' },
    overlay: { ok: Boolean(connector.browserOverlayConnected), message: connector.browserOverlayConnected ? 'OBS Card View connected and receiving updates' : 'Open the OBS Card View, then verify again.' },
    whatnot: { ok: Boolean(tab && page.connected), message: tab && page.connected ? 'Current Whatnot Live Manager tab locked' : (page.reason || 'Open Whatnot Live Manager.') },
    assigned: { ok: Boolean(page.assignedFound), message: page.assignedFound ? `Assigned area found — ${page.candidateCount || 0} possible row${page.candidateCount === 1 ? '' : 's'}` : 'Assigned area is not found yet.' },
    scanner: { ok: scannerCurrent, message: scannerCurrent
      ? `Automatic watcher checked ${Math.max(0, Math.floor(scanAgeMs / 1000))}s ago · Assigned ${page.assignedCount ?? '?'} / synced ${page.baselineAssignedCount ?? '?'}`
      : (page.connected && !page.baselineReady ? 'Assigned baseline is loading.' : 'Automatic watcher has not checked recently. Refresh the Whatnot Live Manager tab.') }
  };
  const prepared = (await chrome.storage.local.get('preparedShow')).preparedShow;
  return { prepared: Boolean(prepared && prepared.ledgerSavedAt === connector.ledgerSavedAt && prepared.tabId === tab?.id), ...checks, ready: Object.values(checks).every(check => check.ok), connector, tabId: tab?.id || null, roundStartAssignedCount: page.roundStartAssignedCount, assignedCount: page.assignedCount, ledgerSavedAt: page.ledgerSavedAt };
}

async function deliverCandidate(candidate) {
  const health = await appJson('/api/health');
  const ledgerKey = health.connector?.ledgerSavedAt || 'unsaved';
  const signature = `${ledgerKey}|${candidate.buyer}|${candidate.number}|${candidate.text}`;
  if (recentDeliveries.has(signature)) return { skipped: true, announced: false, message: 'Already delivered.' };
  const result = await appJson('/api/connector/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ledgerSavedAt: ledgerKey, buyer: candidate.buyer, number: candidate.number, saleAmountCents: candidate.saleAmountCents, source: 'Whatnot Brave/Chrome Connector' })
  });
  // Do not acknowledge the row to the content scanner unless BreakSuite
  // confirms that this exact assignment entered the popup queue. Whatnot can
  // briefly repaint an older row at the top after its Assigned count changes;
  // accepting that repaint would advance the count and silently lose the real
  // next buyer.
  if (result.announced !== true) {
    return { skipped: true, announced: false, result, message: 'Assignment was already present; waiting for the new Assigned row.' };
  }
  recentDeliveries.set(signature, Date.now());
  await rememberAssignedCount(candidate.assignedCount);
  while (recentDeliveries.size > 500) recentDeliveries.delete(recentDeliveries.keys().next().value);
  await chrome.storage.local.set({ lastDelivery: { ...candidate, deliveredAt: new Date().toISOString(), result: result.block } });
  return { skipped: false, announced: true, result };
}

async function reverseCandidate(candidate) {
  const health = await appJson('/api/health');
  const ledgerKey = health.connector?.ledgerSavedAt || 'unsaved';
  const signaturePrefix = `${ledgerKey}|${candidate.buyer}|${candidate.number}|`;
  const result = await appJson('/api/connector/reversal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ledgerSavedAt: ledgerKey, buyer: candidate.buyer, number: candidate.number, source: 'Whatnot Assigned row removed' })
  });
  // A returned spot may later be assigned to the same buyer again. Remove the
  // prior delivery guard only after BreakSuite has confirmed the release.
  if (result.released) {
    for (const key of recentDeliveries.keys()) {
      if (key.startsWith(signaturePrefix)) recentDeliveries.delete(key);
    }
  }
  await chrome.storage.local.set({ lastDelivery: { ...candidate, releasedAt: new Date().toISOString(), result: result.block, action: 'released' } });
  return result;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === 'breaksuite:bind-current-tab') {
      // Never change a running scanner's target simply by visiting a second
      // Whatnot page.
      if (!(await getArmed())) {
        const activeTab = await getActiveLiveManagerTab();
        if (activeTab) await bindLiveTab(activeTab);
      }
      return sendResponse({ ok: true, tabId: (await getWhatnotTab())?.id || null });
    }
    if (message?.type === 'breaksuite:prepare-show' || message?.type === 'breaksuite:recover-show') return sendResponse({ ok: true, ...(await showAction(message.type === 'breaksuite:recover-show')) });
    if (message?.type === 'breaksuite:preflight') return sendResponse({ ok: true, data: await preflight() });
    if (message?.type === 'breaksuite:set-armed') return sendResponse({ ok: true, ...(await setArmed(message.armed)) });
    if (message?.type === 'breaksuite:open-board') {
      await appJson('/api/app/focus', { method: 'POST' });
      return sendResponse({ ok: true });
    }
    if (message?.type === 'breaksuite:open-obs') {
      await chrome.tabs.create({ url: `${APP_ORIGIN}/overlay.html?obs=1` });
      return sendResponse({ ok: true });
    }
    if (message?.type === 'breaksuite:manual-scan') {
      const tab = await getWhatnotTab();
      if (!tab?.id) throw new Error('Open Whatnot Live Manager first.');
      const status = await tabStatus(tab);
      if (!status.connected) throw new Error(status.reason || 'Could not attach the connector to this Whatnot tab.');
      const ledger = await syncLedgerContext(tab);
      const scan = await chrome.tabs.sendMessage(tab.id, { type: 'breaksuite:scan-now' });
      if (scan?.ok === false || !scan?.scanComplete || !Array.isArray(scan?.allCandidates)) throw new Error(scan?.error || 'Whatnot Assigned scan did not complete.');
      const deliveries = [];
      let reconciliation = { foundCount: 0, deliveredCount: 0, reassignedCount: 0, releasedCount: 0, releasedBlocks: [] };
      if (await getArmed()) {
        // Manual Scan treats the complete current Assigned list as the source
        // of truth: it adopts missed rows, changes rerolled buyers, and
        // returns removed rows in one reconciliation pass.
        reconciliation = await appJson('/api/connector/reconcile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ledgerSavedAt: ledger.ledgerSavedAt, assignments: scan.allCandidates || [] })
        });
        await finishReconciledScan(tab, scan.assignedCount);
      }
      return sendResponse({ ok: true, scan, deliveries, reconciliation });
    }
    if (message?.type === 'breaksuite:recover-latest') {
      const count = Number(message.count);
      if (!Number.isInteger(count) || count < 1 || count > 50) throw new Error('Choose between 1 and 50 newest Assigned rows to recover.');
      const tab = await getWhatnotTab();
      if (!tab?.id) throw new Error('Open Whatnot Live Manager first.');
      const status = await tabStatus(tab);
      if (!status.connected) throw new Error(status.reason || 'Could not attach the connector to this Whatnot tab.');
      if (!(await getArmed())) throw new Error('Always-on sync has not connected to the locked live tab yet.');
      const ledger = await syncLedgerContext(tab);
      const scan = await chrome.tabs.sendMessage(tab.id, { type: 'breaksuite:recover-latest', count });
      if (scan?.ok === false) throw new Error(scan.error || 'Whatnot could not read the newest Assigned rows.');
      const assignments = Array.isArray(scan?.allCandidates) ? scan.allCandidates : [];
      if (!assignments.length) throw new Error('No numbered BreakSuite rows were found at the top of Whatnot Assigned.');
      const adoption = await appJson('/api/connector/adopt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ledgerSavedAt: ledger.ledgerSavedAt, assignments })
      });
      await rememberAssignedCount(scan.assignedCount);
      return sendResponse({ ok: true, scan, adoption });
    }
    if (message?.type === 'breaksuite:rebuild-live-sales') {
      const tab = await getWhatnotTab();
      if (!tab?.id) throw new Error('Open Whatnot Live Manager first.');
      const status = await tabStatus(tab);
      if (!status.connected) throw new Error(status.reason || 'Could not attach the connector to this Whatnot tab.');
      if (!(await getArmed())) throw new Error('Always-on sync has not connected to the locked live tab yet.');
      const ledger = await syncLedgerContext(tab);
      // Scan first, then clear amounts. Buyer/card ownership is never reset.
      // The same current Assigned snapshot immediately repopulates only the
      // exact prices that were verified for those rows.
      const scan = await chrome.tabs.sendMessage(tab.id, { type: 'breaksuite:scan-now' });
      if (scan?.ok === false || !scan?.scanComplete || !Array.isArray(scan?.allCandidates)) throw new Error(scan?.error || 'Whatnot Assigned scan did not complete.');
      const cleared = await appJson('/api/connector/clear-sale-amounts', { method: 'POST' });
      const reconciliation = await appJson('/api/connector/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ledgerSavedAt: ledger.ledgerSavedAt, assignments: scan.allCandidates || [] })
      });
      await finishReconciledScan(tab, scan.assignedCount);
      return sendResponse({ ok: true, scan, cleared, reconciliation });
    }
    if (message?.type === 'breaksuite:candidate') {
      const boundTab = await getBoundLiveTab();
      if (!sender.tab?.id || sender.tab.id !== boundTab?.id || !(await getArmed())) {
        return sendResponse({ ok: true, accepted: false, skipped: true });
      }
      const delivery = await deliverCandidate(message.candidate);
      return sendResponse({ ok: true, accepted: delivery.announced === true, ...delivery });
    }
    if (message?.type === 'breaksuite:baseline') {
      const boundTab = await getBoundLiveTab();
      if (!sender.tab?.id || sender.tab.id !== boundTab?.id || !(await getArmed())) {
        return sendResponse({ ok: true, accepted: false, skipped: true });
      }
      const assignments = Array.isArray(message.assignments) ? message.assignments : [];
      const ledger = await syncLedgerContext(boundTab);
      const adoption = await appJson('/api/connector/adopt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ledgerSavedAt: ledger.ledgerSavedAt, assignments })
      });
      await rememberAssignedCount(message.assignedCount);
      return sendResponse({ ok: true, accepted: true, adoption });
    }
    if (message?.type === 'breaksuite:reversal') {
      const boundTab = await getBoundLiveTab();
      if (!sender.tab?.id || sender.tab.id !== boundTab?.id || !(await getArmed())) return sendResponse({ ok: true, skipped: true });
      return sendResponse({ ok: true, ...(await reverseCandidate(message.candidate)) });
    }
    if (message?.type === 'breaksuite:chat-user') {
      const boundTab = await getBoundLiveTab();
      if (!sender.tab?.id || sender.tab.id !== boundTab?.id || !(await getArmed())) return sendResponse({ ok: true, skipped: true });
      const candidate = message.candidate || {};
      const result = await appJson('/api/vip/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyerName: candidate.buyer, chatText: candidate.text, source: 'Whatnot chat activity' })
      });
      return sendResponse({ ok: true, ...result });
    }
    return sendResponse({ ok: false, error: 'Unknown connector request.' });
  })().catch(error => sendResponse({ ok: false, error: messageForError(error) }));
  return true;
});

chrome.tabs.onRemoved.addListener(async tabId => {
  const stored = await chrome.storage.local.get(BOUND_LIVE_TAB_KEY);
  if (Number(stored[BOUND_LIVE_TAB_KEY]) === Number(tabId)) {
    await chrome.storage.local.remove(BOUND_LIVE_TAB_KEY);
    await keepLiveSyncConnected();
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && isLiveManagerTab(tab)) {
    keepLiveSyncConnected().catch(() => {});
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ armed: true }).then(() => keepLiveSyncConnected()).catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  keepLiveSyncConnected().catch(() => {});
});

// Service workers can restart at any time. Reassert the persistent tab lock
// whenever this worker wakes, including while the seller is viewing another
// website.
keepLiveSyncConnected().catch(() => {});

chrome.action.onClicked.addListener(async tab => {
  // If the previous page was closed, the toolbar action can immediately adopt
  // this Live Manager. Otherwise the original live tab remains pinned.
  if (!(await getBoundLiveTab()) && isLiveManagerTab(tab)) await bindLiveTab(tab);
  await keepLiveSyncConnected();
});
