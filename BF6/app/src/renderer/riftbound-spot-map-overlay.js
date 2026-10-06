'use strict';

// VISUAL-ONLY renderer. It reads the saved board's public visual families.
// It never writes to the connector, break ledger, buyer ownership, library,
// Pull History, or Order History.
const GRID_SPOTS = 4;
const SINGLES_GRID_SPOTS = 5;
const LANE_PAGE_INTERVAL_MS = 6000;
const REFRESH_INTERVAL_MS = 2000;
const SLIDE_DURATION_MS = 1100;

const elements = {
  spotsLeft: document.querySelector('#spots-left'),
  laneTrack: document.querySelector('#lane-track')
};

const state = { enabled: false, entries: [], pages: [], lanePage: 0, signature: '', sliding: false };

function text(value) { return String(value ?? ''); }
function cardKey(card = {}) {
  return Number(card.id) || [card.name, card.card_number, card.collector_treatment, card.rarity].map(text).join('|').toLowerCase();
}
// Viewer-only identity. Database ids can differ for duplicate catalog rows, so the
// overlay dedupes by the visible printing identity instead of by row id. This does
// not change the library, ledger, ownership, or connector in any way.
function visualCardKey(card = {}) {
  const set = text(card.set_code || card.setCode).trim().toUpperCase();
  const number = text(card.card_number).trim().toUpperCase();
  const treatment = text(card.collector_treatment || card.variant || card.manual_category).trim().toUpperCase();
  const rarity = text(card.rarity || card.source_rarity).trim().toUpperCase();
  const name = text(card.name).trim().toLowerCase();
  if (set || number) return [set, number, treatment, name].join('|');
  return [name, treatment, rarity, text(card.image_url)].join('|');
}

function spotName(entry = {}) {
  if (entry.spotType === 'DIRECT') return entry.spotLabel || entry.spotCard?.name || 'Named Chase';
  if (entry.spotLabel) return entry.spotLabel;
  if (entry.poro) return `${entry.poro} Bundle`;
  if (entry.baron) return 'Baron Nashor';
  if (entry.champion) return `${entry.champion} Family`;
  return entry.spotCard?.name || 'Riftbound Spot';
}
function uniqueCards(cards = []) {
  const seen = new Set();
  return cards.filter(card => {
    const key = visualCardKey(card);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function takeUnseenCards(cards = [], consumed = new Set()) {
  const result = [];
  uniqueCards(cards).forEach(card => {
    const key = visualCardKey(card);
    if (consumed.has(key)) return;
    consumed.add(key);
    result.push(card);
  });
  return result;
}
function heroCardsFor(entry = {}) {
  const heroes = uniqueCards(Array.isArray(entry.heroCards) ? entry.heroCards : []);
  // Boards 6 and 7 are one straight vertical lane. Keep this renderer-side
  // guard even if an older saved snapshot sends two former hero cards: only
  // the first stays on top and the second falls back into the family below.
  const limit = entry.linearOverlay ? 1 : 2;
  return heroes.length ? heroes.slice(0, limit) : [entry.spotCard || {}].filter(Boolean);
}
function pairedPrimaryGroups(entry = {}) {
  const primaryRoles = new Set(['champion', 'baron', 'poro', 'sp']);
  return groupsFor(entry).filter(group => primaryRoles.has(group.role)).slice(0, 2);
}
function isPairedCombo(entry = {}) {
  return entry.spotType === 'COMBO_VISUAL'
    && entry.bundleKind === 'unl-ven-combo-visual'
    && heroCardsFor(entry).length === 2
    && pairedPrimaryGroups(entry).length === 2;
}
function laneSpan() { return 1; }
function familyFor(entry = {}) {
  const heroKeys = new Set(heroCardsFor(entry).map(visualCardKey));
  return uniqueCards(Array.isArray(entry.family) ? entry.family : []).filter(card => !heroKeys.has(visualCardKey(card)));
}
function groupsFor(entry = {}) {
  return (Array.isArray(entry.bundleGroups) ? entry.bundleGroups : []).map(group => ({
    ...group,
    cards: uniqueCards(Array.isArray(group.cards) ? group.cards : [])
  }));
}
function isSinglesBoard(entries = []) {
  return entries.length > 0 && entries.every(entry => entry?.spotType === 'RIFTBOUND_SINGLE');
}
function gridSpotsFor(entries = []) {
  return isSinglesBoard(entries) ? SINGLES_GRID_SPOTS : GRID_SPOTS;
}
function pagesFor(entries = []) {
  const pages = [];
  const gridSpots = gridSpotsFor(entries);
  for (let index = 0; index < entries.length; index += gridSpots) {
    const page = entries.slice(index, index + gridSpots);
    // Never leave a stretched one/two/three-spot remainder when the board has other
    // spots available. Wrap from the beginning so every rolling page stays at
    // the same four-lane mapped or five-lane Singles visual width.
    if (page.length < gridSpots && entries.length > page.length) {
      let wrapIndex = 0;
      while (page.length < gridSpots && wrapIndex < entries.length) {
        const candidate = entries[wrapIndex++];
        if (!page.includes(candidate)) page.push(candidate);
      }
    }
    pages.push(page);
  }
  return pages;
}
const imageWarmCache = new Map();
function warmImageUrl(url) {
  const src = text(url).trim();
  if (!src) return Promise.resolve(false);
  if (imageWarmCache.has(src)) return imageWarmCache.get(src);
  const promise = new Promise(resolve => {
    const image = new Image();
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    image.onload = () => finish(true);
    image.onerror = () => finish(false);
    image.decoding = 'sync';
    image.src = src;
    if (image.complete) finish(image.naturalWidth > 0);
    window.setTimeout(() => finish(false), 2200);
  });
  imageWarmCache.set(src, promise);
  return promise;
}
function warmCardImage(card = {}) {
  const primary = text(card.image_url).trim();
  const fallback = text(card.image_fallback_url).trim();
  if (!primary && !fallback) return Promise.resolve(false);
  return warmImageUrl(primary).then(ok => ok || !fallback || fallback === primary ? ok : warmImageUrl(fallback));
}
function preload(cards = []) {
  return Promise.allSettled(cards.filter(Boolean).map(warmCardImage));
}
function viewerCardsForEntry(entry = {}) {
  const heroes = heroCardsFor(entry);
  if (!isPairedCombo(entry)) return [...heroes, ...familyFor(entry)];
  const groups = groupsFor(entry);
  const primaryGroups = pairedPrimaryGroups(entry);
  const sharedGroups = groups.filter(group => !primaryGroups.includes(group));
  const consumed = new Set(heroes.map(card => visualCardKey(card)));
  const leftCards = takeUnseenCards(primaryGroups[0]?.cards || [], consumed);
  const rightCards = takeUnseenCards(primaryGroups[1]?.cards || [], consumed);
  const sharedPool = [];
  sharedGroups.forEach(group => sharedPool.push(...(group.cards || [])));
  sharedPool.push(...(Array.isArray(entry.family) ? entry.family : []));
  const sharedCards = takeUnseenCards(sharedPool, consumed);
  return [...heroes, ...leftCards, ...rightCards, ...sharedCards].filter(Boolean);
}
async function warmPage(pageIndex, waitForImages = false) {
  const entries = state.pages[pageIndex] || [];
  const warming = preload(entries.flatMap(viewerCardsForEntry));
  if (!waitForImages) return warming;
  await Promise.race([
    warming,
    new Promise(resolve => window.setTimeout(resolve, 1600))
  ]);
  return warming;
}
function fillCard(article, card, isMain = false) {
  article.replaceChildren();
  if (card?.image_url || card?.image_fallback_url) {
    const image = document.createElement('img');
    const primary = text(card.image_url).trim();
    const fallback = text(card.image_fallback_url).trim();
    image.alt = card.name || 'Riftbound card';
    image.decoding = 'sync';
    // Attach error recovery before assigning src. A loopback 404 can resolve
    // immediately in OBS Chromium and used to beat the old listener.
    const forcePaint = () => {
      article.classList.add('image-ready');
      // Electron/OBS Chromium occasionally decoded an image without repainting
      // the card until the browser source was resized. Force one compositor
      // invalidation when the artwork becomes ready.
      image.style.transform = 'translateZ(0)';
      void image.offsetWidth;
      window.requestAnimationFrame(() => { image.style.transform = ''; });
    };
    image.addEventListener('load', forcePaint);
    image.addEventListener('error', () => {
      if (image.dataset.fallbackUsed === '1' || !fallback) return;
      image.dataset.fallbackUsed = '1';
      image.src = fallback;
    });
    image.src = primary || fallback;
    if (image.complete && image.naturalWidth > 0) forcePaint();
    article.append(image);
  } else {
    const fallback = document.createElement('span');
    fallback.className = 'card-fallback';
    fallback.textContent = '◈';
    article.append(fallback);
  }
}
function makeCard(card, className, isMain = false) {
  const article = document.createElement('article');
  article.className = className;
  fillCard(article, card, isMain);
  return article;
}
function makeHeader(entry) {
  const header = document.createElement('header');
  header.className = 'lane-heading';
  const position = document.createElement('b');
  position.textContent = `SPOT ${String(entry.position).padStart(2, '0')}`;
  const name = document.createElement('span');
  name.textContent = spotName(entry);
  header.append(position, name);
  return header;
}
function makeMappedList(cards = []) {
  const mappedList = document.createElement('div');
  mappedList.className = 'mapped-list';
  cards.forEach(card => mappedList.append(makeCard(card, 'mapped-card')));
  return mappedList;
}
function renderStandardLane(entry) {
  const lane = document.createElement('article');
  lane.className = 'spot-lane';
  const related = familyFor(entry);
  const heroes = heroCardsFor(entry);
  preload([...heroes, ...related]);

  const main = document.createElement('div');
  main.className = heroes.length === 2 ? 'hero-pair' : 'hero-single';
  if (heroes.length === 2) {
    main.append(makeCard(heroes[0], 'main-card', true));
    const plus = document.createElement('span');
    plus.className = 'hero-plus';
    plus.textContent = '+';
    main.append(plus, makeCard(heroes[1], 'main-card', true));
  } else {
    main.append(makeCard(heroes[0] || entry.spotCard || {}, 'main-card', true));
  }

  lane.append(makeHeader(entry), main, makeMappedList(related));
  return lane;
}
function comboGroupCards(group, hero) {
  const heroKey = visualCardKey(hero || {});
  return uniqueCards(group?.cards || []).filter(card => visualCardKey(card) !== heroKey);
}
function makeComboSide(group, hero) {
  const side = document.createElement('section');
  side.className = 'combo-primary-side';
  const heroWrap = document.createElement('div');
  heroWrap.className = 'combo-hero';
  heroWrap.append(makeCard(hero || {}, 'main-card', true));
  side.append(heroWrap);
  return side;
}
function renderPairedComboLane(entry) {
  const lane = document.createElement('article');
  lane.className = 'spot-lane combo-lane';
  const heroes = heroCardsFor(entry);
  const groups = groupsFor(entry);
  const primaryGroups = pairedPrimaryGroups(entry);
  const sharedGroups = groups.filter(group => !primaryGroups.includes(group));

  // One purchased spot should show each visual printing exactly once. Claim cards
  // in display order: heroes first, then left family, right family, shared groups,
  // and finally any mapped remainder that was not represented by a bundle group.
  const consumed = new Set(heroes.map(card => visualCardKey(card)));
  const leftCards = takeUnseenCards(primaryGroups[0]?.cards || [], consumed);
  const rightCards = takeUnseenCards(primaryGroups[1]?.cards || [], consumed);
  preload([...heroes, ...leftCards, ...rightCards].filter(Boolean));


  const heroRow = document.createElement('div');
  heroRow.className = 'combo-hero-row';
  heroRow.append(makeComboSide(primaryGroups[0], heroes[0]));
  const plus = document.createElement('div');
  plus.className = 'combo-hero-plus';
  plus.setAttribute('aria-hidden', 'true');
  plus.textContent = '+';
  heroRow.append(plus, makeComboSide(primaryGroups[1], heroes[1]));

  const follow = document.createElement('div');
  follow.className = 'combo-follow-grid';
  const leftList = document.createElement('div');
  leftList.classList.add('mapped-list', 'combo-follow-list', 'combo-follow-left');
  leftCards.forEach(card => leftList.append(makeCard(card, 'mapped-card')));
  const rightList = document.createElement('div');
  rightList.classList.add('mapped-list', 'combo-follow-list', 'combo-follow-right');
  rightCards.forEach(card => rightList.append(makeCard(card, 'mapped-card')));
  // The + belongs only between the two hero cards. Follow-up family cards use
  // two full-width columns directly beneath their matching hero so they can
  // never collapse into the old narrow center gutter.
  follow.append(leftList, rightList);

  let attached = leftCards.length + rightCards.length;
  const shared = document.createElement('section');
  shared.className = 'combo-shared';

  // Public viewer must mirror the complete purchased spot. Preserve every exact
  // card printing (SIG / ON / AA / Epic / Rare) and only remove literal duplicate
  // catalog rows. Same-name variants are intentionally kept visible.
  const sharedPool = [];
  sharedGroups.forEach(group => sharedPool.push(...(group.cards || [])));
  sharedPool.push(...(Array.isArray(entry.family) ? entry.family : []));
  const sharedCards = takeUnseenCards(sharedPool, consumed);
  if (sharedCards.length) {
    attached += sharedCards.length;
    preload(sharedCards);
    const plus = document.createElement('span');
    plus.className = 'combo-shared-plus';
    plus.setAttribute('aria-hidden', 'true');
    plus.textContent = '+';
    const list = document.createElement('div');
    list.className = 'combo-shared-list';
    sharedCards.forEach(card => list.append(makeCard(card, 'mapped-card')));
    shared.append(plus, list);
  }

  lane.append(makeHeader(entry), heroRow, follow);
  if (shared.childElementCount) lane.append(shared);
  return lane;
}
function renderLane(entry) {
  return isPairedCombo(entry) ? renderPairedComboLane(entry) : renderStandardLane(entry);
}
function buildLanePage(pageIndex) {
  const page = document.createElement('div');
  page.className = 'lane-page';
  const entries = state.pages[pageIndex] || [];
  const gridSpots = gridSpotsFor(entries);
  const singlesPage = gridSpots === SINGLES_GRID_SPOTS;
  page.classList.toggle('singles-page', singlesPage);
  // Mapped family boards retain four equal columns; exact Singles use five
  // compact columns so more purchased positions remain visible at once.
  page.style.gridTemplateColumns = `repeat(${gridSpots}, minmax(0, 1fr))`;
  page.dataset.visibleSpots = String(entries.length);
  const lanes = entries.map(renderLane);
  if (lanes.length === 1) lanes[0].style.gridColumn = singlesPage ? '3' : '2';
  if (lanes.length === 2 && singlesPage) {
    lanes[0].style.gridColumn = '2';
    lanes[1].style.gridColumn = '4';
  } else if (lanes.length === 2) {
    lanes[0].style.gridColumn = '2';
    lanes[1].style.gridColumn = '3';
  }
  if (lanes.length === 3 && singlesPage) {
    lanes[0].style.gridColumn = '2';
    lanes[1].style.gridColumn = '3';
    lanes[2].style.gridColumn = '4';
  }
  lanes.forEach(lane => page.append(lane));
  return page;
}
function updateChrome() {
  if (!state.enabled) {
    elements.spotsLeft.textContent = 'SPOT MAP IDLE';
    return;
  }
  const entries = state.entries;
  elements.spotsLeft.textContent = entries.length
    ? `${entries.length} SPOT${entries.length === 1 ? '' : 'S'} LEFT!`
    : 'RIFTBOUND SPOT MAP';
}
function render() {
  if (!state.enabled) {
    const idle = document.createElement('div');
    idle.className = 'empty-map';
    idle.textContent = 'OBS Spot Map is idle. Enable it from Riftbound Breaker Center when needed.';
    elements.laneTrack.classList.remove('sliding');
    elements.laneTrack.style.transform = 'translateX(0)';
    elements.laneTrack.replaceChildren(idle);
    updateChrome();
    return;
  }
  if (!state.entries.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-map';
    empty.textContent = 'No available Riftbound spots are currently on the saved live board.';
    elements.laneTrack.replaceChildren(empty);
    updateChrome();
    return;
  }
  state.pages = pagesFor(state.entries);
  const pageCount = Math.max(1, state.pages.length);
  state.lanePage %= pageCount;
  elements.laneTrack.classList.remove('sliding');
  elements.laneTrack.style.transform = 'translateX(0)';
  elements.laneTrack.replaceChildren(buildLanePage(state.lanePage));
  updateChrome();
}
let refreshInFlight = false;
async function refresh() {
  if (refreshInFlight) return;
  refreshInFlight = true;
  try {
    const response = await fetch('/api/riftbound-spot-map', { cache: 'no-store' });
    if (!response.ok) throw new Error('Spot map unavailable');
    const payload = await response.json();
    const enabled = Boolean(payload.enabled);
    if (!enabled) {
      if (state.enabled || state.entries.length || state.signature !== 'idle') {
        state.enabled = false;
        state.entries = [];
        state.pages = [];
        state.lanePage = 0;
        state.signature = 'idle';
        state.sliding = false;
        imageWarmCache.clear();
        render();
      }
      return;
    }
    state.enabled = true;
    const entries = Array.isArray(payload.entries) ? payload.entries : [];
    const signature = JSON.stringify(entries.map(entry => [
      entry.position,
      entry.spotCard?.id,
      entry.spotLabel,
      entry.heroCards?.map(cardKey),
      entry.family?.map(cardKey),
      entry.bundleGroups?.map(group => [group.key, group.cards?.map(cardKey)])
    ]));
    if (signature !== state.signature) {
      state.entries = entries;
      state.signature = signature;
      state.pages = pagesFor(entries);
      const pageCount = Math.max(1, state.pages.length);
      state.lanePage %= pageCount;
      // Do not ask OBS Chromium to decode the entire 300+ card map at once.
      // Warm only the page about to be shown, then quietly warm the next page.
      await warmPage(state.lanePage, true);
      if (!state.sliding) render();
      if (pageCount > 1) void warmPage((state.lanePage + 1) % pageCount, false);
    }
  } catch {
    // Keep the viewer visually quiet; the existing cards remain on screen.
  } finally {
    refreshInFlight = false;
  }
}
async function advanceLanePage() {
  if (!state.enabled || document.hidden) return;
  const pageCount = state.pages.length;
  if (pageCount <= 1 || state.sliding) return;
  state.sliding = true;
  const nextPageIndex = (state.lanePage + 1) % pageCount;
  const slideSignature = state.signature;
  await warmPage(nextPageIndex, true);
  if (!state.enabled || state.signature !== slideSignature) {
    state.sliding = false;
    render();
    return;
  }
  const nextPage = buildLanePage(nextPageIndex);
  elements.laneTrack.append(nextPage);
  // Commit the initial position before starting the transition.
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
    if (!state.enabled || state.signature !== slideSignature) {
      state.sliding = false;
      render();
      return;
    }
    elements.laneTrack.classList.add('sliding');
    elements.laneTrack.style.transform = 'translateX(-50%)';
    window.setTimeout(finishSlide, SLIDE_DURATION_MS + 30);
  }));
  function finishSlide() {
    if (!state.enabled || state.signature !== slideSignature) {
      state.sliding = false;
      render();
      return;
    }
    state.lanePage = nextPageIndex;
    elements.laneTrack.classList.remove('sliding');
    elements.laneTrack.style.transform = 'translateX(0)';
    elements.laneTrack.replaceChildren(nextPage);
    state.sliding = false;
    updateChrome();
    if (pageCount > 1) void warmPage((state.lanePage + 1) % pageCount, false);
  }
}

function scheduleRefresh() {
  window.setTimeout(async () => {
    await refresh();
    scheduleRefresh();
  }, state.enabled ? REFRESH_INTERVAL_MS : 10000);
}

refresh().finally(scheduleRefresh);
window.setInterval(advanceLanePage, LANE_PAGE_INTERVAL_MS);
