// The Whatnot Live Manager remains armed while this tab is open. The
// background worker accepts events only from its one locked live tab, so other
// Whatnot pages cannot create assignments.
let armed = true;
let observedSignatures = new Set();
let pendingSignatures = new Set();
let scanTimer;
let firstQueuedScanAt = 0;
let lastScanAt = 0;
let observedChatSignatures = new Set();
let baselineReady = false;
let baselinePromise = null;
let baselineAssignedCount = null;
let pendingAssignedTarget = null;
let activeLedgerSavedAt = '';
let roundStartAssignedCount = null;
let stableTopSignature = '';
let stableTopFirstSeenAt = 0;
let acceptedBeforeCountRefresh = 0;
let offscreenProbeInFlight = false;
let fullScanInFlight = false;
let offscreenProbeSignature = '';
let offscreenProbeFirstSeenAt = 0;

// Whatnot mutates the surrounding Live Manager UI continuously (chat, viewer
// count, and metrics). A normal trailing debounce can keep postponing the
// scan while that is happening. Give the Assigned row a short moment to finish
// rendering, but cap the wait so a spot reaches BreakSuite promptly.
const SCAN_SETTLE_MS = 140;
const SCAN_MAX_WAIT_MS = 360;
const SCAN_MIN_INTERVAL_MS = 170;
const FULL_ASSIGNED_SCROLL_WAIT_MS = 160;
const FULL_ASSIGNED_MAX_SCROLL_STEPS = 120;
// Give Whatnot time to expose its official Assigned (n) count and first
// virtualized rows before the connector baselines historical assignments.
const STARTUP_BASELINE_WAIT_MS = 2200;
// Whatnot sometimes renders the newest Assigned buyer while leaving the
// Assigned (n) heading stale until the seller presses Refresh. Confirm that
// the same newest row remains at the top before using it as the live event.
const STALE_COUNT_ROW_CONFIRM_MS = 1100;
const OFFSCREEN_TOP_PROBE_MS = 2000;

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function candidateSignature(candidate = {}) {
  // Assignment identity is buyer + numbered spot. Whatnot frequently repaints
  // the description and price after assignment; including that changing text
  // made the same row look new and could replay it through OBS.
  return `${compact(candidate.buyer).replace(/^@+/, '').toLowerCase()}|${Number(candidate.number) || 0}`;
}

function chatUserCandidatesFromNode(node) {
  const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  if (!element) return [];
  const candidates = [];
  const possible = [element, ...element.querySelectorAll?.('a[href*="/user/"], a[href*="/profile/"]') || []];
  for (const item of possible) {
    const anchor = item.matches?.('a[href*="/user/"], a[href*="/profile/"]') ? item : item.querySelector?.('a[href*="/user/"], a[href*="/profile/"]');
    if (!anchor) continue;
    const chatContainer = anchor.closest?.('[data-testid*="chat" i], [data-test-id*="chat" i], [class*="chat" i]');
    if (!chatContainer) continue;
    const buyer = compact(anchor.textContent || '').replace(/^@+/, '');
    const text = compact(chatContainer.innerText || chatContainer.textContent || '');
    if (!/^[a-z0-9_.-]{2,}$/i.test(buyer) || text.length < 2 || text.length > 700) continue;
    candidates.push({ buyer, text: text.slice(0, 500) });
  }
  return candidates;
}

function queueChatCandidates(mutations) {
  for (const mutation of mutations || []) for (const node of mutation.addedNodes || []) {
    for (const candidate of chatUserCandidatesFromNode(node)) {
      const signature = `${candidate.buyer.toLowerCase()}|${candidate.text}`;
      if (observedChatSignatures.has(signature)) continue;
      observedChatSignatures.add(signature);
      chrome.runtime.sendMessage({ type: 'breaksuite:chat-user', candidate }).catch(() => observedChatSignatures.delete(signature));
    }
  }
  if (observedChatSignatures.size > 700) observedChatSignatures = new Set([...observedChatSignatures].slice(-350));
}

function findBuyer(text, element) {
  const profile = element?.querySelector?.('a[href*="/user/"], a[href*="/profile/"]');
  return globalThis.BreakSuiteAssignedBuyerParser.extract(text, profile?.textContent || '');
}

function findLeadingNumber(text) {
  const labelled = text.match(/(?:spot|listing|number|item)\s*(?:#|no\.?|number)?\s*[:\-]?\s*(0*\d{1,4})(?=\D|$)/i);
  if (labelled) return Number(labelled[1]);
  const first = compact(text).match(/^0*(\d{1,4})(?=\D|$)/);
  return first ? Number(first[1]) : null;
}

function findSaleAmountCents(text) {
  // Whatnot renders the confirmed assigned price as a dollar value inside the
  // Assigned row (for example `$3` or `$3.00`). This is intentionally read
  // only from that row; Pending Payment cards never reach the Assigned parser.
  const source = String(text || '');
  const values = [...source.matchAll(/\$\s*(\d{1,5}(?:\.\d{1,2})?)/g)]
    .map(match => Number(match[1]))
    .filter(value => Number.isFinite(value) && value > 0 && value <= 10000);
  if (values.length) return Math.round(values[0] * 100);

  // In the current Live Manager layout, the dollar sign can be painted by
  // the UI while the accessible row text contains only the value. Example:
  // `60 — Monkey.D.Luffy R 3 You are bidding ...`.  Limit this fallback to
  // the leading spot header and require the normal description/control text
  // immediately after the number, so a card number or "16 booster box" in a
  // listing description can never be mistaken for a sale amount.
  const headerValue = compact(source).match(
    /^(?:spot\s*)?(?:#\s*)?0*\d{1,4}\s*[—–-]\s*[\s\S]{1,220}?\s+(\d{1,5}(?:\.\d{1,2})?)\s+(?=(?:you\s+are\b|sold\s+to\b|pending\b|clear\s+teams\b|randomize\b|assign\s+teams\b))/i
  );
  const amount = Number(headerValue?.[1]);
  return Number.isFinite(amount) && amount > 0 && amount <= 10000
    ? Math.round(amount * 100)
    : 0;
}

function standalonePriceCents(text) {
  const match = compact(text).match(/^\$?\s*(\d{1,5}(?:\.\d{1,2})?)\s*$/);
  const amount = Number(match?.[1]);
  return Number.isFinite(amount) && amount > 0 && amount <= 10000
    ? Math.round(amount * 100)
    : 0;
}

function assignedRowPriceFromDom(number, expectedBuyer = '') {
  if (typeof document === 'undefined') return 0;
  const spotNumber = Number(number);
  if (!spotNumber) return 0;
  const buyerKey = compact(expectedBuyer).replace(/^@+/, '').toLowerCase();

  // The current Whatnot Assigned card has sibling strong elements:
  // `<strong>60 — Monkey.D.Luffy R</strong><strong>$3</strong>`.
  // Read only the immediate sibling price. Do not walk up to a shared list
  // container: a virtualized list can hold neighbouring buyers' prices there.
  for (const title of document.querySelectorAll('strong')) {
    if (findLeadingNumber(compact(title.innerText || title.textContent)) !== spotNumber) continue;
    const parent = title.parentElement;
    if (!parent) continue;
    const rowBuyer = compact(findBuyer(compact(parent.innerText || parent.textContent), parent)).replace(/^@+/, '').toLowerCase();
    if (buyerKey && rowBuyer && rowBuyer !== buyerKey) continue;
    const immediate = standalonePriceCents(title.nextElementSibling?.innerText || title.nextElementSibling?.textContent);
    if (immediate) return immediate;
    // A few Whatnot renders insert a small layout element between the title
    // and its price. Accept another price only when both are direct children
    // of the same compact header, never from a parent further up the tree.
    const directStrongChildren = [...parent.children].filter(element => element.tagName === 'STRONG');
    if (directStrongChildren.length === 2 && directStrongChildren.includes(title)) {
      const other = directStrongChildren.find(element => element !== title);
      const amount = standalonePriceCents(other?.innerText || other?.textContent);
      if (amount) return amount;
    }
  }
  return 0;
}

function selectorCandidates() {
  const selectors = 'tr, [role="row"], li, article, [data-testid], [data-test-id]';
  const rows = [];
  document.querySelectorAll(selectors).forEach(element => {
    if (rows.length >= 300) return;
    const text = compact(element.innerText || element.textContent);
    if (text.length < 5 || text.length > 850 || !/assigned|sold\s+to|(?:buyer|username|winner)\s*[:\-]/i.test(text)) return;
    const number = findLeadingNumber(text);
    const buyer = findBuyer(text, element);
    if (!number || number < 1 || !buyer) return;
    rows.push({ number, buyer, saleAmountCents: assignedRowPriceFromDom(number, buyer), text: text.slice(0, 500) });
  });
  return rows;
}

function assignedSection() {
  // Whatnot's current Live Manager does not put the actual Assigned item in a
  // table row. It is a plain card below an `Assigned (n)` heading, followed by
  // the next `Available (n)` heading. Read only that visible section so chat,
  // sales metrics, and other page text can never become a live assignment.
  const lines = String(document.body?.innerText || '')
    .split(/\r?\n/)
    .map(compact)
    .filter(Boolean);
  // Recent Whatnot layouts append controls such as "Most Recent" to the
  // heading's rendered line: `Assigned (82) Most Recent`.  Match the heading
  // prefix instead of requiring the old line to end immediately after `(82)`.
  const start = lines.findIndex(line => /^assigned\b/i.test(line));
  if (start < 0) return { found: false, lines: [] };
  const end = lines.findIndex((line, index) => index > start && /^(?:available|awaiting\s+assignment)\b/i.test(line));
  return { found: true, lines: lines.slice(start + 1, end > start ? end : Math.min(lines.length, start + 420)) };
}

function assignedCountFromPage() {
  const lines = String(document.body?.innerText || '')
    .split(/\r?\n/)
    .map(compact)
    .filter(Boolean);
  for (const line of lines) {
    const match = line.match(/^assigned\s*\(\s*(\d{1,5})\s*\)/i);
    if (match) return Number(match[1]);
  }
  return null;
}

function bodyListingCandidates() {
  // Fallback for Whatnot's newest card layout, where the Assigned header and
  // its sort control are rendered as one line.  We still require a numbered
  // BreakSuite listing plus an explicit buyer label, so chat text cannot be
  // mistaken for an assignment.
  const lines = String(document.body?.innerText || '')
    .split(/\r?\n/)
    .map(compact)
    .filter(Boolean);
  const candidates = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(?:spot\s*)?(?:#\s*)?0*(\d{1,4})\s*[—–-]\s*(.+)$/i);
    if (!match) continue;
    const nextRow = lines.findIndex((line, nextIndex) => nextIndex > index && /^(?:spot\s*)?(?:#\s*)?0*\d{1,4}\s*[—–-]\s*.+$/i.test(line));
    const itemText = compact(lines.slice(index, nextRow > index ? nextRow : Math.min(lines.length, index + 42)).join(' '));
    const buyer = findBuyer(itemText);
    const number = Number(match[1]);
    if (number >= 1 && buyer) candidates.push({ number, buyer, saleAmountCents: assignedRowPriceFromDom(number, buyer), text: itemText.slice(0, 500) });
  }
  return candidates;
}

function assignedSectionCandidates() {
  const section = assignedSection();
  if (!section.found) return { found: false, candidates: [] };
  const candidates = [];
  const rows = section.lines;
  for (let index = 0; index < rows.length; index += 1) {
    // This is the exact Whatnot spot name copied from BreakSuite: `74 — Marco R`.
    // The connector needs only the leading number, while the remaining title
    // text stays useful as a human-readable duplicate guard.
    const match = rows[index].match(/^(?:spot\s*)?(?:#\s*)?0*(\d{1,4})\s*[—–-]\s*(.+)$/i);
    if (!match) continue;
    const nextRow = rows.findIndex((line, nextIndex) => nextIndex > index && /^(?:spot\s*)?(?:#\s*)?0*\d{1,4}\s*[—–-]\s*.+$/i.test(line));
    const itemLines = rows.slice(index, nextRow > index ? nextRow : Math.min(rows.length, index + 36));
    const text = compact(itemLines.join(' '));
    const buyer = findBuyer(text);
    const number = Number(match[1]);
    if (number >= 1 && buyer) candidates.push({ number, buyer, saleAmountCents: assignedRowPriceFromDom(number, buyer), text: text.slice(0, 500) });
  }
  return { found: true, candidates };
}

function rowCandidates() {
  const section = assignedSectionCandidates();
  // Prefer the explicit Assigned section. The old semantic-row fallback stays
  // available for a different Whatnot layout, but it is used only when the
  // page does not expose an Assigned heading at all.
  const candidates = section.found && section.candidates.length
    ? section.candidates
    : mergeCandidates([
      ...section.candidates,
      ...bodyListingCandidates(),
      ...selectorCandidates()
    ]);
  const unique = new Map();
  candidates.forEach(candidate => {
    const key = `${candidate.buyer}|${candidate.number}`;
    if (!unique.has(key)) unique.set(key, candidate);
  });
  return [...unique.values()];
}

function mergeCandidates(candidates) {
  const unique = new Map();
  candidates.forEach(candidate => {
    const number = Number(candidate?.number);
    const buyer = compact(candidate?.buyer).replace(/^@+/, '');
    if (!number || !buyer) return;
    // A current Assigned entry has one block number.  Prefer the most recent
    // render for a block if Whatnot virtualizes and redraws the list mid-scan,
    // but never replace a captured sale price with an in-between row that has
    // not rendered its dollar amount yet.
    const prior = unique.get(number);
    const saleAmountCents = Math.max(0, Number(candidate?.saleAmountCents || 0));
    unique.set(number, {
      ...candidate,
      number,
      buyer,
      saleAmountCents: saleAmountCents || Number(prior?.saleAmountCents || 0)
    });
  });
  // Preserve Whatnot's visible order (Most Recent first). Sorting by spot
  // number could select an older lazy-rendered row instead of the one new
  // purchase authorized by the Assigned count increase.
  return [...unique.values()];
}

function assignedHeadingElements() {
  const headingPattern = /^assigned\b/i;
  const headings = new Set();
  // Reading innerText on every element in the Live Manager forces repeated
  // layout work while chat and metrics keep changing. Text nodes identify the
  // same heading without measuring the entire page on every live sale.
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = compact(node.nodeValue);
    if (text.length > 96 || !headingPattern.test(text)) continue;
    const element = node.parentElement;
    if (element && compact(element.textContent).length <= 96) headings.add(element);
  }
  return [...headings];
}

function assignedScrollContainers() {
  const containers = new Set();
  assignedHeadingElements().forEach(heading => {
    let parent = heading.parentElement;
    let depth = 0;
    while (parent && parent !== document.body && depth < 14) {
      const style = window.getComputedStyle(parent);
      const scrollable = /(?:auto|scroll)/i.test(style.overflowY || '')
        && parent.scrollHeight > parent.clientHeight + 40
        && parent.clientHeight > 80;
      if (scrollable) containers.add(parent);
      parent = parent.parentElement;
      depth += 1;
    }
  });
  return [...containers];
}

function assignedViewportAtTop() {
  return assignedScrollContainers().every(container => Number(container.scrollTop || 0) <= 8);
}

function resetStableTopCandidate() {
  stableTopSignature = '';
  stableTopFirstSeenAt = 0;
}

function catchUpDelayedAssignedCount(pageCount) {
  if (!acceptedBeforeCountRefresh
      || !Number.isInteger(pageCount)
      || !Number.isInteger(baselineAssignedCount)
      || pageCount <= baselineAssignedCount) return;
  const caughtUp = Math.min(pageCount - baselineAssignedCount, acceptedBeforeCountRefresh);
  baselineAssignedCount += caughtUp;
  acceptedBeforeCountRefresh -= caughtUp;
}

function waitForAssignedRows() {
  return new Promise(resolve => {
    window.requestAnimationFrame(() => window.setTimeout(resolve, FULL_ASSIGNED_SCROLL_WAIT_MS));
  });
}

async function allAssignedCandidates() {
  // Whatnot virtualizes long Assigned lists: only the rows presently inside
  // the scroll viewport exist in document.body.  A normal DOM read therefore
  // sees roughly 20 rows even when every board spot has sold.  On an explicit
  // full scan, carefully visit each virtual viewport, collect its rows, then
  // restore the seller's original scroll position.
  const found = new Map();
  const record = candidate => {
    const key = candidateSignature(candidate);
    const prior = found.get(key);
    if (!prior) {
      found.set(key, candidate);
      return;
    }
    if (!Number(prior.saleAmountCents || 0) && Number(candidate.saleAmountCents || 0)) {
      found.set(key, { ...prior, saleAmountCents: Number(candidate.saleAmountCents || 0) });
    }
  };
  const containers = assignedScrollContainers();
  if (!containers.length) mergeCandidates(rowCandidates()).forEach(record);
  for (const container of containers) {
    const originalTop = container.scrollTop;
    let bottom = Math.max(0, container.scrollHeight - container.clientHeight);
    const step = Math.max(180, Math.floor(container.clientHeight * 0.72));
    let previousTop = -1;
    try {
      container.scrollTop = 0;
      container.dispatchEvent(new Event('scroll', { bubbles: true }));
      await waitForAssignedRows();
      for (let index = 0; index < FULL_ASSIGNED_MAX_SCROLL_STEPS; index += 1) {
        mergeCandidates(rowCandidates()).forEach(record);
        bottom = Math.max(0, container.scrollHeight - container.clientHeight);
        const currentTop = container.scrollTop;
        if (currentTop >= bottom - 1 || currentTop === previousTop) break;
        previousTop = currentTop;
        container.scrollTop = Math.min(bottom, currentTop + step);
        container.dispatchEvent(new Event('scroll', { bubbles: true }));
        await waitForAssignedRows();
      }
      mergeCandidates(rowCandidates()).forEach(record);
    } finally {
      container.scrollTop = originalTop;
      container.dispatchEvent(new Event('scroll', { bubbles: true }));
      await waitForAssignedRows();
    }
  }
  // The initial visible viewport is Whatnot's Most Recent-first order. Keep
  // first sightings in that order so a round scan can take only rows created
  // after the round's saved baseline, even when spot numbers repeat.
  return [...found.values()];
}

async function latestAssignedCandidates(limit) {
  const count = Math.max(1, Math.min(50, Number(limit) || 1));
  const containers = assignedScrollContainers();
  const originalPositions = containers.map(container => ({ container, top: container.scrollTop }));
  try {
    containers.forEach(container => {
      container.scrollTop = 0;
      container.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    await waitForAssignedRows();
    // Whatnot renders Assigned in Most Recent-first order. This recovery path
    // intentionally bypasses the round-start baseline only for the explicit
    // number the seller confirms, so an extension reload after sales can
    // restore missed Buyer Bags without importing an older box.
    return mergeCandidates(rowCandidates()).slice(0, count);
  } finally {
    originalPositions.forEach(({ container, top }) => {
      container.scrollTop = top;
      container.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    await waitForAssignedRows();
  }
}

function candidatesForCurrentRound(candidates = []) {
  const pageCount = assignedCountFromPage();
  return globalThis.BreakSuiteRoundAssignmentWindow.select({
    candidates,
    pageCount,
    roundStartCount: roundStartAssignedCount
  });
}

function status() {
  const section = assignedSection();
  const candidates = rowCandidates();
  return {
    connected: true,
    armed,
    baselineReady,
    lastScanAt,
    baselineAssignedCount,
    assignedFound: section.found || candidates.length > 0,
    assignedCount: assignedCountFromPage(),
    candidateCount: candidates.length,
    ledgerSavedAt: activeLedgerSavedAt,
    roundStartAssignedCount,
    candidates
  };
}

function unobservedCandidates({ includeExisting = false, candidates = rowCandidates() } = {}) {
  const fresh = [];
  for (const candidate of candidates) {
    const signature = candidateSignature(candidate);
    if (!includeExisting && observedSignatures.has(signature)) continue;
    fresh.push(candidate);
  }
  return fresh;
}

function establishAssignedBaseline() {
  if (baselinePromise) return baselinePromise;
  baselineReady = false;
  baselinePromise = new Promise(resolve => setTimeout(resolve, STARTUP_BASELINE_WAIT_MS)).then(() => allAssignedCandidates()).then(async candidates => {
    candidates.forEach(candidate => observedSignatures.add(candidateSignature(candidate)));
    baselineAssignedCount = assignedCountFromPage();
    // Existing rows belong in Buyer Bags but are not live reveal events. The
    // backend adopts them without touching the popup sequence.
    if (activeLedgerSavedAt) {
      await chrome.runtime.sendMessage({
        type: 'breaksuite:baseline',
        assignments: candidatesForCurrentRound(candidates),
        assignedCount: assignedCountFromPage()
      }).catch(() => null);
    }
    baselineReady = true;
    return candidates;
  }).finally(() => {
    baselinePromise = null;
  });
  return baselinePromise;
}

function reportCandidates() {
  scanTimer = null;
  firstQueuedScanAt = 0;
  lastScanAt = Date.now();
  if (!armed || !baselineReady || offscreenProbeInFlight || fullScanInFlight) return;
  const visibleCandidates = rowCandidates();
  const pageCount = assignedCountFromPage();
  // If the stable-row fallback already delivered while Whatnot's heading was
  // stale, consume that delayed count increase before evaluating another row.
  // This prevents a late counter repaint from replaying the next buyer.
  catchUpDelayedAssignedCount(pageCount);
  const freshCandidates = [];
  for (const candidate of visibleCandidates) {
    const signature = candidateSignature(candidate);
    if (observedSignatures.has(signature) || pendingSignatures.has(signature)) continue;
    freshCandidates.push(candidate);
  }
  const viewportAtTop = assignedViewportAtTop();
  // A buyer may purchase the same numbered spot in two sequential boxes.
  // Buyer + spot is then identical, but the official Assigned count still
  // authorizes exactly one newest row for the new round.
  if (!freshCandidates.length
      && Number.isInteger(pageCount)
      && Number.isInteger(baselineAssignedCount)
      && pageCount === baselineAssignedCount + 1
      && viewportAtTop
      && visibleCandidates[0]) {
    freshCandidates.push(visibleCandidates[0]);
  }
  const decision = globalThis.BreakSuiteAssignmentCountGate.decide({
    baselineCount: baselineAssignedCount,
    pageCount,
    freshCount: freshCandidates.length,
    pendingTarget: pendingAssignedTarget
  });

  const fallback = globalThis.BreakSuiteLiveRowStability.decide({
    candidateSignature: freshCandidates[0] ? candidateSignature(freshCandidates[0]) : '',
    visibleTopSignature: visibleCandidates[0] ? candidateSignature(visibleCandidates[0]) : '',
    previousSignature: stableTopSignature,
    firstSeenAt: stableTopFirstSeenAt,
    now: Date.now(),
    baselineCount: baselineAssignedCount,
    pageCount,
    pending: pendingSignatures.size > 0 || pendingAssignedTarget !== null,
    viewportAtTop,
    ledgerReady: Boolean(activeLedgerSavedAt),
    minimumStableMs: STALE_COUNT_ROW_CONFIRM_MS
  });
  stableTopSignature = fallback.signature;
  stableTopFirstSeenAt = fallback.firstSeenAt;

  // Same-count rows are lazy historical paints. Resets and reconnect state
  // are synchronization only; every positive count jump emits that many of
  // the newest current-round rows. A stable top-row fallback owns a temporary
  // missing/stale counter so that Whatnot's delayed heading cannot lose a hit.
  const stableFallbackOwnsSync = decision.action === 'sync' && fallback.action !== 'reset';
  if (decision.action === 'baseline' || (decision.action === 'sync' && !stableFallbackOwnsSync)) {
    freshCandidates.forEach(candidate => observedSignatures.add(candidateSignature(candidate)));
    baselineAssignedCount = decision.nextCount;
    pendingAssignedTarget = null;
    resetStableTopCandidate();
    return;
  }
  if ((decision.action === 'wait' || stableFallbackOwnsSync) && fallback.action !== 'emit') return;
  if (decision.action === 'probe' && !activeLedgerSavedAt) return;

  if (decision.action !== 'emit' && fallback.action === 'emit') {
    const candidate = freshCandidates[0];
    if (!candidate) return;
    candidate.assignedCount = pageCount;
    const signature = candidateSignature(candidate);
    // Most Recent is first. Other newly painted rows are historical virtual
    // list state unless the official count later authorizes them as a batch.
    freshCandidates.slice(1).forEach(item => observedSignatures.add(candidateSignature(item)));
    pendingAssignedTarget = Number.isInteger(baselineAssignedCount) ? baselineAssignedCount : 0;
    pendingSignatures.add(signature);
    chrome.runtime.sendMessage({ type: 'breaksuite:candidate', candidate }).then(response => {
      if (response?.ok && response?.accepted) {
        observedSignatures.add(signature);
        acceptedBeforeCountRefresh += 1;
        resetStableTopCandidate();
      }
    }).catch(() => {}).finally(() => {
      pendingSignatures.delete(signature);
      pendingAssignedTarget = null;
      queueScan();
    });
    return;
  }

  pendingAssignedTarget = decision.nextCount;
  const emitCount = Math.max(1, Number(decision.emitCount || 1));
  // Read the top of Whatnot's Most Recent-first list after its count changes.
  // Deliver oldest-first so rapid buyers receive a full, correctly ordered
  // popup instead of later purchases overwriting the first card.
  const visibleBatch = visibleCandidates.slice(0, emitCount);
  const freshSignatures = new Set(freshCandidates.map(candidateSignature));
  // Most Recent is already visible at the top for ordinary one-spot sales.
  // Avoid a synthetic scroll and animation-frame wait unless rows are still
  // rendering, the seller scrolled away, or a batch needs virtualized rows.
  const newestRows = visibleBatch.length === emitCount
    && visibleBatch.every(candidate => freshSignatures.has(candidateSignature(candidate)))
    && viewportAtTop
    ? Promise.resolve(visibleBatch)
    : latestAssignedCandidates(emitCount);
  newestRows.then(async newestCandidates => {
    const batch = newestCandidates.slice(0, emitCount);
    if (batch.length < emitCount) throw new Error('The newest Assigned rows are still rendering.');
    // A count can repaint before the virtualized top rows change. An older
    // observed row is not evidence of the new sale; retry the top probe.
    if ((decision.action === 'probe' || !viewportAtTop)
        && batch.some(candidate => observedSignatures.has(candidateSignature(candidate)))) return;
    batch.forEach(candidate => pendingSignatures.add(candidateSignature(candidate)));
    let acceptedAll = true;
    for (const candidate of [...batch].reverse()) {
      candidate.assignedCount = decision.nextCount;
      const signature = candidateSignature(candidate);
      const response = await chrome.runtime.sendMessage({ type: 'breaksuite:candidate', candidate }).catch(() => null);
      if (response?.ok && response?.accepted) observedSignatures.add(signature);
      else acceptedAll = false;
    }
    if (acceptedAll) baselineAssignedCount = decision.nextCount;
  }).catch(() => {}).finally(() => {
    pendingSignatures.clear();
    pendingAssignedTarget = null;
    queueScan();
  });
  if (observedSignatures.size > 600) observedSignatures = new Set([...observedSignatures].slice(-300));
}

async function probeOffscreenAssignedTop() {
  if (!armed || !baselineReady || !activeLedgerSavedAt || offscreenProbeInFlight || fullScanInFlight
      || pendingSignatures.size || pendingAssignedTarget !== null) return;
  if (assignedViewportAtTop()) {
    offscreenProbeSignature = '';
    offscreenProbeFirstSeenAt = 0;
    return;
  }
  const pageCount = assignedCountFromPage();
  // The normal count-change scanner owns batches. Peek at the virtualized top
  // only when Whatnot leaves its heading stale and the seller is scrolled away.
  if (Number.isInteger(pageCount) && Number.isInteger(baselineAssignedCount)
      && pageCount !== baselineAssignedCount) return;
  offscreenProbeInFlight = true;
  try {
    const latest = await latestAssignedCandidates(50);
    const unseen = [];
    for (const candidate of latest) {
      const signature = candidateSignature(candidate);
      if (observedSignatures.has(signature)) break;
      unseen.push(candidate);
    }
    const signature = unseen.map(candidateSignature).join('||');
    if (!signature) {
      offscreenProbeSignature = '';
      offscreenProbeFirstSeenAt = 0;
      return;
    }
    const now = Date.now();
    if (signature !== offscreenProbeSignature) {
      offscreenProbeSignature = signature;
      offscreenProbeFirstSeenAt = now;
      return;
    }
    if (now - offscreenProbeFirstSeenAt < STALE_COUNT_ROW_CONFIRM_MS) return;
    // Whatnot showed the same new top rows on separate checks. Deliver them
    // oldest-first, just like a confirmed count jump, and consume the heading
    // increase later without replaying any of these spots.
    for (const candidate of [...unseen].reverse()) {
      candidate.assignedCount = pageCount;
      const response = await chrome.runtime.sendMessage({ type: 'breaksuite:candidate', candidate }).catch(() => null);
      if (!response?.ok || !response?.accepted) break;
      observedSignatures.add(candidateSignature(candidate));
      acceptedBeforeCountRefresh += 1;
    }
    offscreenProbeSignature = '';
    offscreenProbeFirstSeenAt = 0;
  } catch {
    offscreenProbeSignature = '';
    offscreenProbeFirstSeenAt = 0;
  } finally {
    offscreenProbeInFlight = false;
    queueScan();
  }
}

function queueScan() {
  if (!armed) return;
  const now = Date.now();
  if (!firstQueuedScanAt) firstQueuedScanAt = now;
  const elapsed = now - firstQueuedScanAt;
  const sinceLastScan = now - lastScanAt;
  const settleWait = SCAN_SETTLE_MS;
  const maxWait = Math.max(0, SCAN_MAX_WAIT_MS - elapsed);
  const rateWait = Math.max(0, SCAN_MIN_INTERVAL_MS - sinceLastScan);
  clearTimeout(scanTimer);
  scanTimer = setTimeout(reportCandidates, Math.max(Math.min(settleWait, maxWait), rateWait));
}

new MutationObserver(mutations => { queueScan(); queueChatCandidates(mutations); }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
// Safety net for a visual Whatnot update that does not emit an observable DOM
// mutation in the current document. The signature guard prevents duplicates.
setInterval(queueScan, 850);
setInterval(() => { void probeOffscreenAssignedTop(); }, OFFSCREEN_TOP_PROBE_MS);
chrome.runtime.sendMessage({ type: 'breaksuite:preflight' }).catch(() => {});
chrome.storage.local.get('armed').then(stored => {
  armed = true;
  chrome.storage.local.set({ armed: true }).catch(() => {});
  // Rows already present when the connector starts are historical state, not
  // fresh rolls. Baseline them silently; explicit reconciliation can restore
  // them to BreakSuite without firing the OBS reveal for every character.
  if (armed) {
    pendingSignatures.clear();
    establishAssignedBaseline().then(queueScan).catch(() => {
      baselineReady = true;
      queueScan();
    });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'breaksuite:status') return sendResponse(status());
  // Manual Scan is deliberately allowed to re-check rows already present when
  // the extension was reloaded. The local ledger ignores an already-assigned
  // block, so this fixes a missed page load without creating a second hit.
  if (message?.type === 'breaksuite:scan-now') {
    if (fullScanInFlight) { sendResponse({ ok: false, error: 'A list scan is already running.' }); return; }
    fullScanInFlight = true;
    (async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const ledger = activeLedgerSavedAt;
        const beforeCount = assignedCountFromPage();
        const allCandidates = await allAssignedCandidates();
        const afterCount = assignedCountFromPage();
        const expected = globalThis.BreakSuiteRoundAssignmentWindow.count(afterCount, roundStartAssignedCount);
        const roundCandidates = candidatesForCurrentRound(allCandidates);
        const uniquePositions = new Set(roundCandidates.map(candidate => Number(candidate.number)));
        if (ledger === activeLedgerSavedAt && Number.isInteger(beforeCount)
            && beforeCount === afterCount && Number.isInteger(roundStartAssignedCount)
            && afterCount >= roundStartAssignedCount && roundCandidates.length === expected
            && uniquePositions.size === expected) {
          lastScanAt = Date.now();
          roundCandidates.forEach(candidate => observedSignatures.add(candidateSignature(candidate)));
          return { ...status(), ok: true, scanComplete: true, candidateCount: roundCandidates.length,
            allCandidates: roundCandidates, totalAssignedCandidates: allCandidates.length, candidates: [] };
        }
        await waitForAssignedRows();
      }
      throw new Error('Assigned list is changing or incomplete. No recovery was applied; wait for Whatnot to finish updating, then recheck.');
    })().then(sendResponse).catch(error => sendResponse({ ok: false, error: String(error?.message || error) })).finally(() => {
      fullScanInFlight = false;
      queueScan();
    });
    return true;
  }
  if (message?.type === 'breaksuite:recover-latest') {
    fullScanInFlight = true;
    latestAssignedCandidates(message.count).then(allCandidates => {
      allCandidates.forEach(candidate => observedSignatures.add(candidateSignature(candidate)));
      sendResponse({
        ...status(),
        candidateCount: allCandidates.length,
        allCandidates,
        candidates: []
      });
    }).catch(error => sendResponse({ ok: false, error: String(error?.message || error) })).finally(() => {
      fullScanInFlight = false;
      queueScan();
    });
    return true;
  }
  if (message?.type === 'breaksuite:set-ledger') {
    const ledgerSavedAt = String(message.ledgerSavedAt || '');
    const changed = ledgerSavedAt !== activeLedgerSavedAt;
    activeLedgerSavedAt = ledgerSavedAt;
    if (changed || !Number.isInteger(roundStartAssignedCount)) {
      roundStartAssignedCount = Number.isInteger(message.baselineAssignedCount)
        ? message.baselineAssignedCount
        : assignedCountFromPage();
      baselineAssignedCount = roundStartAssignedCount;
      pendingAssignedTarget = null;
      pendingSignatures.clear();
      resetStableTopCandidate();
      acceptedBeforeCountRefresh = 0;
      offscreenProbeSignature = '';
      offscreenProbeFirstSeenAt = 0;
    }
    return sendResponse({
      ok: true,
      ledgerSavedAt: activeLedgerSavedAt,
      roundStartAssignedCount,
      changed
    });
  }
  if (message?.type === 'breaksuite:set-armed') {
    armed = true;
    // Preflight calls this repeatedly. Do not interrupt an in-flight scan or
    // clear its stability state merely because the side panel checked health.
    if (baselineReady) {
      queueScan();
      return sendResponse({ ok: true, armed, baselineReady: true });
    }
    establishAssignedBaseline().then(() => {
      queueScan();
      sendResponse({ ok: true, armed, baselineReady: true });
    }).catch(error => sendResponse({ ok: false, armed, error: String(error?.message || error) }));
    return true;
  }
  if (message?.type === 'breaksuite:reconcile-complete') {
    const assignedCount = Number(message.assignedCount);
    if (!Number.isInteger(assignedCount) || assignedCount < 0) return sendResponse({ ok: false });
    // A successful full scan has already adopted these rows. Advance the live
    // counter so the next sale, rather than the same old row, is announced.
    const previousCount = Number.isInteger(baselineAssignedCount) ? baselineAssignedCount : assignedCount;
    const caughtUp = Math.min(Math.max(0, assignedCount - previousCount), acceptedBeforeCountRefresh);
    acceptedBeforeCountRefresh -= caughtUp;
    baselineAssignedCount = assignedCount;
    pendingAssignedTarget = null;
    pendingSignatures.clear();
    resetStableTopCandidate();
    offscreenProbeSignature = '';
    offscreenProbeFirstSeenAt = 0;
    queueScan();
    return sendResponse({ ok: true, baselineAssignedCount });
  }
});
