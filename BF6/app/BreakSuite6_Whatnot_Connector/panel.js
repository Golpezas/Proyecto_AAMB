let actionBusy = false;
const elements = {
  recoverShow: document.querySelector('#recover-show'),
  ledger: document.querySelector('#ledger-banner'), readyTitle: document.querySelector('#ready-title'), readyCopy: document.querySelector('#ready-copy'), checks: document.querySelector('#checks'), verify: document.querySelector('#verify'), scan: document.querySelector('#scan'), recoverLatest: document.querySelector('#recover-latest'), rebuildSales: document.querySelector('#rebuild-sales'), arm: document.querySelector('#arm'), board: document.querySelector('#board'), obs: document.querySelector('#obs'), scanNote: document.querySelector('#scan-note'), latest: document.querySelector('#latest')
};

function send(type, extra = {}) {
  return chrome.runtime.sendMessage({ type, ...extra });
}

function check(label, item) {
  return `<div class="check ${item?.ok ? 'ok' : 'fail'}"><i>${item?.ok ? '✓' : '•'}</i><span>${label} — ${item?.message || 'Not checked.'}</span></div>`;
}

function showPreflight(data) {
  const connector = data.connector || {};
  const showReady = Boolean(data.ready && data.prepared);
  elements.readyTitle.textContent = showReady ? 'SHOW READY' : (data.ready ? 'PREPARE SHOW' : 'NEEDS ATTENTION');
  elements.readyTitle.classList.toggle('ready', showReady);
  const failure = ['app', 'board', 'whatnot', 'assigned', 'scanner', 'overlay'].map(key => data[key]).find(item => !item?.ok);
  elements.readyCopy.textContent = showReady
    ? `Locked to this show · starting count ${data.roundStartAssignedCount} · watching numbered Assigned sales.`
    : (failure?.message || 'Press Prepare Show before the first sale.');
  elements.ledger.textContent = connector.boardReady
    ? `${connector.liveRoundName || 'Saved live ledger'} ready · ${connector.activeCards || 0} cards`
    : 'Save your Break Board before going live';
  elements.ledger.classList.toggle('warn', !connector.boardReady);
  elements.checks.innerHTML = [
    check('BreakSuite6', data.app), check('Live ledger', data.board), check('OBS Card View', data.overlay), check('Whatnot tab', data.whatnot), check('Assigned area', data.assigned), check('Scanner', data.scanner)
  ].join('');
  elements.arm.textContent = 'Legacy Reconnect';
}

async function refresh() {
  const response = await send('breaksuite:preflight');
  if (actionBusy) return response?.data;
  if (!response?.ok) throw new Error(response?.error || 'Could not verify live readiness.');
  showPreflight(response.data);
  const stored = await chrome.storage.local.get('lastDelivery');
  if (stored.lastDelivery) elements.latest.textContent = `${stored.lastDelivery.buyer} · Block ${stored.lastDelivery.number} delivered`;
  return response.data;
}

async function runShowAction(recover) {
  if (actionBusy) return;
  actionBusy = true;
  elements.verify.disabled = elements.recoverShow.disabled = true;
  elements.readyTitle.textContent = recover ? 'RECHECKING LIST…' : 'PREPARING SHOW…';
  elements.readyTitle.classList.remove('ready');
  elements.scanNote.textContent = 'Checking the locked show and reading the full Assigned list…';
  try {
    const result = await send(recover ? 'breaksuite:recover-show' : 'breaksuite:prepare-show');
    if (!result?.ok) throw new Error(result?.error || 'Show check failed.');
    showPreflight(result.data);
    const sync = result.reconciliation || {};
    elements.scanNote.textContent = recover
      ? `List rechecked · ${sync.deliveredCount || 0} recovered · ${sync.reassignedCount || 0} exchanged · ${sync.releasedCount || 0} returned. Buyer Bags and OBS use the updated board.`
      : (result.data.ready ? 'Show ready. Start your first numbered spot; new Assigned sales are watched automatically.' : 'Check the status above before starting.');
  } catch (error) {
    elements.readyTitle.textContent = 'NEEDS ATTENTION';
    elements.readyCopy.textContent = error.message;
    elements.scanNote.textContent = error.message;
  } finally {
    actionBusy = false;
    elements.verify.disabled = elements.recoverShow.disabled = false;
  }
}
elements.verify.addEventListener('click', () => runShowAction(false));
elements.recoverShow.addEventListener('click', () => runShowAction(true));
elements.arm.addEventListener('click', async () => {
  try {
    await refresh();
    const result = await send('breaksuite:set-armed', { armed: true });
    if (!result?.ok) throw new Error(result?.error || 'Scanner setting failed.');
    const synchronization = result.synchronization || {};
    const found = Number(synchronization.foundCount || 0);
    const updated = Number(synchronization.deliveredCount || 0) + Number(synchronization.reassignedCount || 0);
    const restored = Number(synchronization.releasedCount || 0);
    elements.scanNote.textContent = `Always-on sync reconnected · found ${found} assigned row${found === 1 ? '' : 's'} · updated ${updated}${restored ? ` · restored ${restored}` : ''}.`;
    await refresh();
  } catch (error) { elements.scanNote.textContent = error.message; }
});
elements.scan.addEventListener('click', async () => {
  elements.scan.disabled = true;
  try {
    const result = await send('breaksuite:manual-scan');
    if (!result?.ok) throw new Error(result?.error || 'Scan failed.');
    const found = result.scan?.candidateCount || 0;
    const delivered = Number(result.reconciliation?.deliveredCount || 0)
      + Number(result.reconciliation?.reassignedCount || 0)
      + (result.deliveries || []).filter(item => item.result?.block).length;
    const returned = Number(result.reconciliation?.releasedCount || 0);
    elements.scanNote.textContent = `Found ${found} assigned row${found === 1 ? '' : 's'} · delivered ${delivered}${returned ? ` · restored ${returned} to board` : ''}.`;
    await refresh();
  } catch (error) { elements.scanNote.textContent = error.message; } finally { elements.scan.disabled = false; }
});
elements.recoverLatest.addEventListener('click', async () => {
  const rawCount = prompt('How many of the newest Whatnot Assigned rows belong to this current box?', '3');
  if (rawCount === null) return;
  const count = Number(rawCount);
  if (!Number.isInteger(count) || count < 1 || count > 50) {
    elements.scanNote.textContent = 'Enter a whole number from 1 to 50.';
    return;
  }
  if (!confirm(`Recover exactly the newest ${count} Assigned row${count === 1 ? '' : 's'} into the current live Buyer Bags? Older rows will be ignored and existing Buyer Bags will not be removed.`)) return;
  elements.recoverLatest.disabled = true;
  elements.scanNote.textContent = `Recovering the newest ${count} Assigned row${count === 1 ? '' : 's'}…`;
  try {
    const result = await send('breaksuite:recover-latest', { count });
    if (!result?.ok) throw new Error(result?.error || 'Missed-spot recovery failed.');
    const found = Number(result.scan?.candidateCount || 0);
    const delivered = Number(result.adoption?.adoptedCount || 0);
    elements.scanNote.textContent = `Recovery found ${found} newest row${found === 1 ? '' : 's'} · delivered ${delivered} to the current Buyer Bags.`;
    await refresh();
  } catch (error) { elements.scanNote.textContent = error.message; } finally { elements.recoverLatest.disabled = false; }
});
elements.rebuildSales.addEventListener('click', async () => {
  if (!confirm('Rebuild Live Sales from the current Whatnot Assigned list? This keeps every card and buyer assignment, but clears and re-reads only the captured sale prices.')) return;
  elements.rebuildSales.disabled = true;
  try {
    const result = await send('breaksuite:rebuild-live-sales');
    if (!result?.ok) throw new Error(result?.error || 'Live Sales rebuild failed.');
    const found = Number(result.scan?.candidateCount || 0);
    const cleared = Number(result.cleared?.clearedPrices || 0);
    elements.scanNote.textContent = `Rebuilt prices from ${found} Assigned rows · cleared ${cleared} old price${cleared === 1 ? '' : 's'}.`;
    await refresh();
  } catch (error) { elements.scanNote.textContent = error.message; } finally { elements.rebuildSales.disabled = false; }
});
elements.board.addEventListener('click', () => send('breaksuite:open-board').catch(() => {}));
elements.obs.addEventListener('click', () => send('breaksuite:open-obs').catch(() => {}));
send('breaksuite:bind-current-tab')
  .catch(() => {})
  .finally(() => refresh().catch(error => { elements.readyTitle.textContent = 'NOT READY YET'; elements.readyCopy.textContent = error.message; }));
setInterval(() => { if (!actionBusy) refresh().catch(() => {}); }, 5000);
