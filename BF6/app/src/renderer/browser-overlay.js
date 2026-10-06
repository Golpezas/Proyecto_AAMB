const grid = document.querySelector('#overlay-grid');
const claimReveal = document.querySelector('#claim-reveal');
const stage = document.querySelector('#overlay-stage');
const boardFrame = document.querySelector('#board-frame');
const revealOnly = window.location.pathname === '/popup.html' || new URLSearchParams(window.location.search).get('view') === 'reveal';
const overlayEndpoint = revealOnly ? '/api/overlay?view=reveal' : '/api/overlay';
const BOARD_NINE_STATIC_OVERLAY_PROFILE = 'spiritforged-board-9-priority-four';
const BOARD_TEN_STATIC_OVERLAY_PROFILE = 'vendetta-board-10-dense-five';
let hasRendered = false;
// null means this browser source has not established its baseline yet. A
// restarted OBS source must not replay an assignment that happened earlier.
let latestClaimKey = null;
let claimHideTimer;
let claimExitTimer;
let lastBoardSignature = '';
let lastViewerStyleSignature = '';
let viewerStyle = {};
let refreshInFlight = false;
let refreshTimer = null;
let heartbeatTimer = null;
let overlayEnabled = false;
let boardRevealActive = false;

function bounded(value, fallback, minimum, maximum) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(minimum, Math.min(maximum, numeric)) : fallback;
}

function applyViewerStyle(style = {}) {
  const nextStyle = {
    frameStyle: ['color-sync', 'haki-crack', 'holo-reactor', 'boss-awakening'].includes(style.frameStyle) ? style.frameStyle : 'color-sync',
    primaryColor: /^#[0-9a-f]{6}$/i.test(style.primaryColor || '') ? style.primaryColor : '#55dcff',
    secondaryColor: /^#[0-9a-f]{6}$/i.test(style.secondaryColor || '') ? style.secondaryColor : '#9b7dff',
    glowIntensity: bounded(style.glowIntensity, 78, 20, 100),
    frameThickness: bounded(style.frameThickness, 3, 1, 8),
    pulseSpeed: bounded(style.pulseSpeed, 55, 15, 100),
    particles: style.particles !== false,
    cornerShape: ['rounded', 'bevel', 'square'].includes(style.cornerShape) ? style.cornerShape : 'rounded',
    boardX: bounded(style.boardX, 50, 8, 92),
    boardY: bounded(style.boardY, 50, 8, 92),
    boardScale: bounded(style.boardScale, 100, 68, 122),
    popupX: bounded(style.popupX, 50, 8, 92),
    popupY: bounded(style.popupY, 50, 8, 92),
    popupScale: bounded(style.popupScale, 100, 65, 135),
    popupStatueScale: bounded(style.popupStatueScale, 92, 60, 130),
    popupCardScale: bounded(style.popupCardScale, 90, 60, 130),
    popupDuration: bounded(style.popupDuration, 8, 2, 15)
  };
  const signature = JSON.stringify(nextStyle);
  if (signature === lastViewerStyleSignature) return false;
  viewerStyle = nextStyle;
  lastViewerStyleSignature = signature;
  const speed = viewerStyle.pulseSpeed;
  stage.dataset.frameStyle = viewerStyle.frameStyle;
  stage.dataset.cornerShape = viewerStyle.cornerShape;
  stage.dataset.particles = String(viewerStyle.particles);
  claimReveal.dataset.frameStyle = viewerStyle.frameStyle;
  claimReveal.dataset.cornerShape = viewerStyle.cornerShape;
  stage.style.setProperty('--frame-primary', viewerStyle.primaryColor);
  stage.style.setProperty('--frame-secondary', viewerStyle.secondaryColor);
  stage.style.setProperty('--frame-glow', String(.22 + viewerStyle.glowIntensity * .0078));
  stage.style.setProperty('--frame-glow-strong', `${Math.round(20 + viewerStyle.glowIntensity * .75)}%`);
  stage.style.setProperty('--frame-glow-soft', `${Math.round(10 + viewerStyle.glowIntensity * .5)}%`);
  stage.style.setProperty('--frame-thickness', `${viewerStyle.frameThickness}px`);
  stage.style.setProperty('--frame-run-duration', `${Math.max(6, 19 - speed * .13)}s`);
  stage.style.setProperty('--card-led-duration', `${Math.max(8, 22 - speed * .14)}s`);
  stage.style.setProperty('--frame-breathe-duration', `${Math.max(4, 12 - speed * .08)}s`);
  stage.style.setProperty('--board-shift-x', `${(viewerStyle.boardX - 50) * 1.05}vw`);
  stage.style.setProperty('--board-shift-y', `${(viewerStyle.boardY - 50) * 1.05}vh`);
  stage.style.setProperty('--board-scale', String(viewerStyle.boardScale / 100));
  stage.style.setProperty('--popup-width', `${420 * viewerStyle.popupScale / 100}px`);
  stage.style.setProperty('--popup-height', `${600 * viewerStyle.popupScale / 100}px`);
  stage.style.setProperty('--popup-pair-width', `${764 * viewerStyle.popupScale / 100}px`);
  stage.style.setProperty('--popup-pair-height', `${564 * viewerStyle.popupScale / 100}px`);
  stage.style.setProperty('--popup-statue-size', `${viewerStyle.popupStatueScale}%`);
  stage.style.setProperty('--popup-card-width', `${60 * viewerStyle.popupCardScale / 100}%`);
  stage.style.setProperty('--popup-card-max-height', `${70 * viewerStyle.popupCardScale / 100}%`);
  claimReveal.style.left = `${viewerStyle.popupX}%`;
  claimReveal.style.top = `${viewerStyle.popupY}%`;
  return true;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

const viewerCardFilter = window.BreakSuiteViewerCardFilter;
const riftboundPopupName = window.BreakSuiteRiftboundPopupName;

function rarityFor(card) {
  return viewerCardFilter.rarityFor(card);
}

function isViewerChaseCard(card) {
  return viewerCardFilter.isViewerCard(card);
}

function usesBoardNineStaticLayout(cards = []) {
  return cards.some(card => String(card.static_overlay_profile || '') === BOARD_NINE_STATIC_OVERLAY_PROFILE);
}

function usesBoardTenStaticLayout(cards = []) {
  return cards.some(card => String(card.static_overlay_profile || '') === BOARD_TEN_STATIC_OVERLAY_PROFILE);
}

function boardNinePriority(card) {
  const effect = chaseEffectClass(card);
  if (effect === 'chase-diamond') return 0; // Signature
  if (effect === 'chase-fire') return 1;    // Overnumbered
  if (effect === 'chase-bomb') return 2;    // Alternate Art / Showcase
  if (effect === 'chase-heart') return 3;   // Epic
  return 4;
}

function priorityOrderBoardNine(cards = []) {
  return [...cards].sort((left, right) =>
    boardNinePriority(left) - boardNinePriority(right)
    || Number(left.position || 0) - Number(right.position || 0)
    || Number(left.id || 0) - Number(right.id || 0));
}

function layoutColumns(cards = []) {
  if (usesBoardNineStaticLayout(cards)) return 4;
  if (usesBoardTenStaticLayout(cards)) return 5;
  if (cards.some(card => card.spot_bundle?.cards?.length)) return 3;
  // The public board always keeps six lanes.  Remaining cards fill from the
  // upper-left, so a short final row stays compact instead of stretching out.
  return 6;
}

function chaseEffectClasses(cards) {
  return new Map(cards.map(card => {
    return [String(card.id), chaseEffectClass(card)];
  }));
}

function chaseEffectClass(card) {
  return viewerCardFilter.effectClass(card);
}

function createCardElement(card) {
  const element = document.createElement('article');
  element.dataset.cardId = String(card.id);
  element.className = 'card';
  element.innerHTML = cardMarkup(card);
  return element;
}

function imageMarkup(card) {
  return card?.image_url
    ? `<img src="${escapeHtml(card.image_url)}" alt="${escapeHtml(card.name)}" decoding="async" />`
    : '<div class="card-fallback">♧</div>';
}

const CLAIM_STATUE_BY_EFFECT = Object.freeze({
  'chase-diamond': 'signature',
  'chase-fire': 'fire',
  'chase-bomb': 'bomb',
  'chase-ultimate': 'ultimate',
  'chase-heart': 'heart',
  'chase-construction': 'construction',
  'chase-rose': 'rose'
});

const CLAIM_PLAQUE_BY_EFFECT = Object.freeze({
  'chase-diamond': 'SIG',
  'chase-fire': 'OVERNUMBERED',
  'chase-bomb': 'ALTERNATE ART',
  'chase-ultimate': 'ULTIMATE',
  'chase-heart': 'EPIC',
  'chase-construction': 'RARE',
  'chase-rose': 'SP'
});

function claimSceneMarkup(effectClass, useLabeledStatue = false) {
  const statue = CLAIM_STATUE_BY_EFFECT[effectClass];
  const statueAsset = statue && useLabeledStatue ? `${statue}-board10` : statue;
  const statueMarkup = statue
    ? `<div class="claim-statue-wrap"><img class="claim-statue" src="/assets/popup-statue-${statueAsset}.png?v=357" alt="" decoding="async" /></div>`
    : '';
  return `<div class="claim-scene" aria-hidden="true">${statueMarkup}<i class="claim-scene-portal"></i><i class="claim-scene-pillar left"></i><i class="claim-scene-pillar right"></i><i class="claim-scene-platform"></i><i class="claim-scene-particles"></i></div>`;
}

function cardMarkup(card) {
  const bundleCards = Array.isArray(card.spot_bundle?.cards) ? card.spot_bundle.cards.slice(0, 2) : [];
  // Linear boards expose one mapped lead card. Show that exact card rather
  // than the hidden database row used to anchor the buyer position.
  if (bundleCards.length < 2) return `<div class="card-shell">${imageMarkup(bundleCards[0] || card)}</div>`;
  return `<div class="spot-pair" data-pair-kind="${escapeHtml(card.spot_bundle.kind || '')}">
    <div class="spot-pair-cards">
      <div class="spot-pair-card spot-pair-first"><div class="card-shell">${imageMarkup(bundleCards[0])}</div><b>${escapeHtml(bundleCards[0].bundle_caption || bundleCards[0].name)}</b></div>
      <span class="spot-pair-plus" aria-hidden="true">+</span>
      <div class="spot-pair-card"><div class="card-shell">${imageMarkup(bundleCards[1])}</div><b>${escapeHtml(bundleCards[1].bundle_caption || bundleCards[1].name)}</b></div>
    </div>
    <strong class="spot-pair-label">${escapeHtml(card.spot_bundle.label || card.name)}</strong>
  </div>`;
}

function cardVisualSignature(card) {
  const bundle = card.spot_bundle;
  if (!bundle?.cards?.length) return String(card.image_url || '');
  return `${bundle.label}|${bundle.cards.map(item => `${item.id}:${item.image_url || ''}`).join('|')}`;
}

function updateCardImage(element, card) {
  const expectedVisual = cardVisualSignature(card);
  if (element.dataset.visualSignature !== expectedVisual) {
    element.innerHTML = cardMarkup(card);
    element.dataset.visualSignature = expectedVisual;
    return;
  }
  if (card.spot_bundle?.cards?.length) return;
  const shell = element.querySelector('.card-shell');
  if (!shell) return;
  const expected = String(card.image_url || '');
  const image = shell.querySelector('img');
  if (expected) {
    if (!image) {
      shell.innerHTML = `<img src="${escapeHtml(expected)}" alt="${escapeHtml(card.name)}" />`;
      return;
    }
    if (image.getAttribute('src') !== expected) image.setAttribute('src', expected);
    image.setAttribute('alt', String(card.name || ''));
    return;
  }
  if (image || !shell.querySelector('.card-fallback')) shell.innerHTML = '<div class="card-fallback">♧</div>';
}

function updateCardLayout(element, card, index, columns, chaseClass) {
  element.className = `card${card.spot_bundle?.cards?.length ? ' paired-spot' : ''}${chaseClass ? ` ${chaseClass}` : ''}`;
  element.title = card.name || '';
  updateCardImage(element, card);
  // Keep the board flat and stable.  The old curved Y/pitch arrangement made
  // cards appear to roll sideways whenever the board reflowed.
  element.style.removeProperty('--lift');
  element.style.removeProperty('--yaw');
  element.style.removeProperty('--pitch');
  element.style.removeProperty('--scale');
  // Stagger the slow LED trace so the whole board never flashes in unison.
  element.style.setProperty('--frame-delay', `${-(index % 9) * 1.15}s`);
  // Dense Riftbound boards must remain a true flat grid. Giving each later
  // card a higher layer caused lower rows to paint over the row above them.
  // One Piece keeps its established layering unchanged.
  element.style.zIndex = viewerCardFilter.gameFor(card) === 'RIFTBOUND' ? '2' : String(100 + index);
}

const CLAIM_EXIT_DURATION_MS = 220;

function finishClaimReveal() {
  claimReveal.classList.remove('is-visible');
  claimReveal.classList.add('is-exiting');
  clearTimeout(claimExitTimer);
  claimExitTimer = setTimeout(() => {
    claimReveal.classList.remove('is-exiting');
    claimReveal.replaceChildren();
  }, CLAIM_EXIT_DURATION_MS);
}

function playClaimReveal() {
  clearTimeout(claimHideTimer);
  clearTimeout(claimExitTimer);
  claimReveal.classList.remove('is-visible', 'is-exiting');
  claimReveal.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
  void claimReveal.offsetWidth;
  requestAnimationFrame(() => claimReveal.classList.add('is-visible'));

  // Treat the configured popup duration as the complete on-screen time,
  // including the deliberate exit instead of cutting the card off abruptly.
  const totalDurationMs = Math.max(1600, Number(viewerStyle.popupDuration || 8) * 1000);
  claimHideTimer = setTimeout(finishClaimReveal, totalDurationMs - CLAIM_EXIT_DURATION_MS);
}

function showClaim(card) {
  // The card remains the focus. Riftbound Unleashed champion reveals also get
  // a short, readable champion nameplate; internal numbers and rarity stay
  // private in Breaker Center.
  const buyer = String(card.buyer_name || '').trim().replace(/^@+/, '');
  const championName = riftboundPopupName?.championName(card) || '';
  const mappedSpotName = riftboundPopupName?.mappedSpotName(card) || '';
  const bundleCards = Array.isArray(card.spot_bundle?.cards) ? card.spot_bundle.cards : [];
  const displayCard = bundleCards[0] || card;
  const effectClass = viewerCardFilter.popupEffectClass(card);
  const statueClass = CLAIM_STATUE_BY_EFFECT[effectClass] ? ' has-statue' : '';
  const top80Label = card.spot_bundle?.kind === 'unleashed-top80' ? String(card.spot_bundle.label || card.name || '') : '';
  const singleLabel = card.spot_bundle?.kind === 'riftbound-single' ? String(card.spot_bundle.label || card.name || '') : '';
  const concisePopupLabel = String(card.spot_bundle?.popup_label || '').trim();
  // Every Riftbound board now follows the same clean rule as Board 10: the
  // first/front mapped card alone selects a statue whose rarity is physically
  // baked into the plate. Saved rear cards still exist for Buyer Bags and
  // audits; they are intentionally absent from the public reveal.
  const statuePlaqueLabel = viewerCardFilter.gameFor(displayCard) === 'RIFTBOUND'
    ? String(CLAIM_PLAQUE_BY_EFFECT[effectClass] || '')
    : '';
  const sceneMarkup = claimSceneMarkup(effectClass, Boolean(statuePlaqueLabel));
  const exactLabel = concisePopupLabel || singleLabel || top80Label || mappedSpotName;
  const bundleCaption = riftboundPopupName?.bundleCaption(card.spot_bundle) || 'SIGNATURE + CHAMPION';
  const exactCaption = concisePopupLabel
    ? 'RIFTBOUND · RARITY'
    : singleLabel
      ? 'RIFTBOUND SINGLE · EXACT CARD'
    : top80Label
      ? 'UNLEASHED TOP 80 · EXACT CARD'
      : bundleCaption;
  // Preserve the regular popup copy in the DOM so no claim/buyer context is
  // discarded. The statue-label-only class hides it visually while the same
  // rarity remains visible in the baked statue plaque.
  const claimTakenMarkup = `<div class="claim-taken"><span>SPOT TAKEN</span>${buyer ? `<strong>@${escapeHtml(buyer)}</strong>` : ''}</div>`;
  const externalNameplateMarkup = exactLabel
    ? `<div class="claim-champion-name"><small>${escapeHtml(exactCaption)}</small><strong>${escapeHtml(exactLabel)}</strong></div>`
    : championName
      ? `<div class="claim-champion-name"><small>CHAMPION SPOT</small><strong>${escapeHtml(championName)}</strong></div>`
      : '';
  claimReveal.innerHTML = `${sceneMarkup}${claimTakenMarkup}<div class="claim-art">${displayCard.image_url ? `<img src="${escapeHtml(displayCard.image_url)}" alt="${escapeHtml(displayCard.name)}" />` : '<div class="card-fallback">♧</div>'}</div>${externalNameplateMarkup}`;
  claimReveal.className = `claim-reveal ${effectClass}${statueClass}${statuePlaqueLabel ? ' statue-label-only' : ''}${!statuePlaqueLabel && (exactLabel || championName) ? ' has-champion-name' : ''}`;
  playClaimReveal();
}

function processClaim(claim) {
  const claimKey = claim ? `${claim.reveal_sequence}:${claim.position}:${claim.called_at}` : '';
  // The backend queue contains only short-lived live assignment events, never
  // restored ledger history. If OBS reloads this browser source while a claim
  // is active, that first claim must still be shown instead of being swallowed
  // as a baseline.
  if (latestClaimKey === null) {
    latestClaimKey = claimKey;
    if (claimKey) showClaim(claim);
    return;
  }
  if (claimKey && claimKey !== latestClaimKey) showClaim(claim);
  latestClaimKey = claimKey;
}

function boardSignature(cards) {
  return cards.map(card => `${card.id}:${card.position}:${cardVisualSignature(card)}`).join('|');
}

function hideBoardFrame() {
  boardFrame?.classList.remove('is-visible');
}

function syncBoardFrame(cards) {
  if (!boardFrame || !stage || !cards.length) {
    hideBoardFrame();
    return;
  }
  const stageRect = stage.getBoundingClientRect();
  const cardRects = cards.map(card => card.getBoundingClientRect()).filter(rect => rect.width && rect.height);
  if (!cardRects.length || !stageRect.width || !stageRect.height) {
    hideBoardFrame();
    return;
  }
  const pad = Math.max(10, Math.min(24, stageRect.width * .013));
  const left = Math.max(0, Math.min(...cardRects.map(rect => rect.left - stageRect.left)) - pad);
  const top = Math.max(0, Math.min(...cardRects.map(rect => rect.top - stageRect.top)) - pad);
  const right = Math.min(stageRect.width, Math.max(...cardRects.map(rect => rect.right - stageRect.left)) + pad);
  const bottom = Math.min(stageRect.height, Math.max(...cardRects.map(rect => rect.bottom - stageRect.top)) + pad);
  boardFrame.style.left = `${left}px`;
  boardFrame.style.top = `${top}px`;
  boardFrame.style.width = `${Math.max(72, right - left)}px`;
  boardFrame.style.height = `${Math.max(92, bottom - top)}px`;
  boardFrame.classList.add('is-visible');
}

function makeDepartureCard(source, rect, crashIntoGap = false) {
  if (!source || !rect || !stage) return;
  const stageRect = stage.getBoundingClientRect();
  const departure = source.cloneNode(true);
  departure.classList.add('card-departure');
  departure.removeAttribute('data-card-id');
  departure.style.left = `${rect.left - stageRect.left}px`;
  departure.style.top = `${rect.top - stageRect.top}px`;
  departure.style.width = `${rect.width}px`;
  departure.style.height = `${rect.height}px`;
  stage.append(departure);
  const animation = departure.animate(crashIntoGap ? [
    { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
    { transform: 'translate3d(0, 5px, 0) scale(1.025, .94) rotate(-.5deg)', opacity: 1, offset: .3 },
    { transform: 'translate3d(0, 32px, 0) scale(.84) rotate(2deg)', opacity: 0 }
  ] : [
    { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
    { transform: 'translate3d(0, -14px, 0) scale(.94)', opacity: 0 }
  ], crashIntoGap
    ? { duration: 280, easing: 'cubic-bezier(.36,.04,.3,1)', fill: 'forwards' }
    : { duration: 380, easing: 'cubic-bezier(.32,.02,.2,1)', fill: 'forwards' });
  animation.finished.catch(() => {}).finally(() => departure.remove());
}

function settleFromBelow(card) {
  // A small vertical scale settle makes the board feel like it drops neatly
  // into place, without a left/right carousel motion or an opacity flash.
  card.getAnimations().forEach(animation => animation.cancel());
  card.animate([
    { transform: 'translate3d(0, 20px, 0) scale(.985)', opacity: 1 },
    { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 }
  ], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' });
}

const BOARD_TEN_CASCADE_CARD_LIMIT = 20;

function settleBoardTenCascade(card, oldRect, oldIndex, nextIndex, columns, cascadeOrder) {
  if (!card || !oldRect || oldIndex === nextIndex || cascadeOrder >= BOARD_TEN_CASCADE_CARD_LIMIT) return;
  const nextRect = card.getBoundingClientRect();
  if (nextRect.bottom < 0 || nextRect.top > window.innerHeight) return;
  const stayedOnRow = Math.floor(oldIndex / columns) === Math.floor(nextIndex / columns);
  const measuredX = oldRect.left - nextRect.left;
  const maximumStep = nextRect.width * 1.3;
  const startX = stayedOnRow
    ? Math.max(-maximumStep, Math.min(maximumStep, measuredX))
    : 0;
  // Cards move into the sold spot one at a time. Row-wrap cards settle down
  // into their new cell instead of flying diagonally across the whole board.
  const startY = stayedOnRow ? 0 : Math.max(8, Math.min(18, nextRect.height * .16));
  const delay = Math.min(cascadeOrder, 14) * 14;
  card.getAnimations({ subtree: false }).forEach(animation => animation.cancel());
  card.animate([
    { transform: `translate3d(${startX}px, ${startY}px, 0) scale(.99)` },
    { transform: 'translate3d(0, 1px, 0) scale(1.003)', offset: .82 },
    { transform: 'translate3d(0, 0, 0) scale(1)' }
  ], { duration: 220, delay, easing: 'cubic-bezier(.2,.72,.22,1)', fill: 'backwards' });
}

function render(cards, style) {
  const styleChanged = applyViewerStyle(style);
  if (revealOnly) {
    grid.style.display = 'none';
    boardFrame?.classList.remove('is-visible');
    return;
  }
  const viewerCards = cards.filter(card => card.spot_bundle?.cards?.length || isViewerChaseCard(card));
  const boardNineStaticLayout = usesBoardNineStaticLayout(viewerCards);
  const boardTenStaticLayout = usesBoardTenStaticLayout(viewerCards);
  // Board 9 is a chase-first public presentation. Spot numbers and the live
  // assignment ledger are untouched; only the steady OBS display order changes.
  const displayCards = boardNineStaticLayout ? priorityOrderBoardNine(viewerCards) : viewerCards;
  const remainingCards = displayCards.filter(card => card.block_status === 'ready');
  stage.dataset.game = displayCards.some(card => viewerCardFilter.gameFor(card) === 'RIFTBOUND') ? 'RIFTBOUND' : 'ONEPIECE';
  stage.dataset.bundled = String(displayCards.some(card => card.spot_bundle?.cards?.length));
  stage.dataset.layout = boardNineStaticLayout
    ? BOARD_NINE_STATIC_OVERLAY_PROFILE
    : boardTenStaticLayout ? BOARD_TEN_STATIC_OVERLAY_PROFILE : 'default';
  if (!cards.length) {
    grid.replaceChildren(Object.assign(document.createElement('div'), { className: 'empty', textContent: 'Save a Break Board to start the OBS card view.' }));
    hideBoardFrame();
    hasRendered = true;
    return;
  }
  if (!remainingCards.length) {
    grid.replaceChildren(Object.assign(document.createElement('div'), { className: 'empty', textContent: 'No featured cards remain on the viewer board.' }));
    hideBoardFrame();
    hasRendered = true;
    return;
  }

  const signature = `${stage.dataset.layout}|${boardSignature(remainingCards)}`;
  // Polling happens frequently for connector health.  Do not touch the DOM
  // when the actual board did not change; rebuilding it was the flash seen in
  // OBS every refresh.
  if (signature === lastBoardSignature) {
    // A Frame Studio placement or scale change can move existing DOM cards
    // without changing the live-card list.  Re-measure the LED frame instead
    // of rebuilding cards and causing another OBS flash.
    if (styleChanged) requestAnimationFrame(() => syncBoardFrame([...grid.querySelectorAll('.card')]));
    hasRendered = true;
    return;
  }

  const columns = layoutColumns(displayCards);
  // Keep the original board footprint after claims. Cards stay the same size
  // and pack tightly from the upper-left rather than spreading apart.
  const rows = Math.max(1, Math.ceil(displayCards.length / columns));
  grid.style.setProperty('--columns', String(columns));
  grid.style.setProperty('--rows', String(rows));
  const oldCards = new Map([...grid.querySelectorAll('.card')].map(card => [card.dataset.cardId, card]));
  const oldIndexes = new Map([...oldCards.keys()].map((id, index) => [id, index]));
  const oldRects = new Map([...oldCards.entries()].map(([id, card]) => [id, card.getBoundingClientRect()]));
  const remainingIds = new Set(remainingCards.map(card => String(card.id)));
  oldCards.forEach((card, id) => {
    if (!remainingIds.has(id)) {
      makeDepartureCard(card, oldRects.get(id), boardNineStaticLayout || boardTenStaticLayout);
      card.remove();
    }
  });
  const chaseClasses = chaseEffectClasses(remainingCards);
  const nextCards = remainingCards.map((card, index) => {
    const existing = oldCards.get(String(card.id));
    const element = existing || createCardElement(card);
    updateCardLayout(element, card, index, columns, chaseClasses.get(String(card.id)));
    element.style.gridColumnStart = '';
    return element;
  });
  // Keep every surviving card mounted in the same DOM node. Replacing all
  // children restarts their CSS animations in OBS, which made the whole board
  // appear to pop again whenever one buyer received a spot.
  nextCards.forEach((element, index) => {
    const current = grid.children[index] || null;
    if (current !== element) grid.insertBefore(element, current);
  });
  requestAnimationFrame(() => syncBoardFrame(nextCards));
  if (hasRendered) {
    requestAnimationFrame(() => {
      let cascadeOrder = 0;
      nextCards.forEach((card, nextIndex) => {
        const oldRect = oldRects.get(card.dataset.cardId);
        const oldIndex = oldIndexes.get(card.dataset.cardId);
        if (boardTenStaticLayout && oldRect && oldIndex !== nextIndex) {
          settleBoardTenCascade(card, oldRect, oldIndex, nextIndex, columns, cascadeOrder);
          cascadeOrder += 1;
        }
        else if (!oldRect && !boardNineStaticLayout) settleFromBelow(card);
      });
    });
  }
  lastBoardSignature = signature;
  hasRendered = true;
}

let lastRefreshSuccessAt = Date.now();
let recoveryReloadAt = 0;

async function fetchWithTimeout(url, options = {}, timeoutMs = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function refresh() {
  if (refreshInFlight) return;
  refreshInFlight = true;
  try {
    const joiner = overlayEndpoint.includes('?') ? '&' : '?';
    const response = await fetchWithTimeout(`${overlayEndpoint}${joiner}_=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    }, revealOnly ? 2500 : 4000);
    if (!response.ok) throw new Error(`Overlay HTTP ${response.status}`);
    const payload = await response.json();
    lastRefreshSuccessAt = Date.now();
    stage.dataset.build = String(payload.build || '');
    // The popup-only source still needs its saved size, position, colors, and
    // duration even when the optional static card board is disabled.
    applyViewerStyle(payload.style || {});
    // A sale reveal is independent from the optional steady card board. Both
    // OBS Card View URLs must process it before the board-enabled decision.
    // A legacy board-only OBS scene can still reveal the sale. Once a dedicated
    // popup source starts polling, it takes over without duplicate reveals.
    const nextBoardRevealActive = !revealOnly && payload.boardReveal === true;
    const revealModeChanged = boardRevealActive !== nextBoardRevealActive;
    boardRevealActive = nextBoardRevealActive;
    if (revealOnly || boardRevealActive) processClaim(payload.claim || null);
    else if (revealModeChanged) {
      clearTimeout(claimHideTimer);
      clearTimeout(claimExitTimer);
      claimReveal.classList.remove('is-visible', 'is-exiting');
      claimReveal.replaceChildren();
    }
    const enabled = payload.enabled === true;
    const enabledChanged = enabled !== overlayEnabled;
    overlayEnabled = enabled;
    if (!enabled) {
      grid.replaceChildren();
      hideBoardFrame();
      lastBoardSignature = '';
      hasRendered = false;
      if ((enabledChanged || revealModeChanged) && refreshTimer !== null) schedulePolling();
      return;
    }
    render(payload.cards || [], payload.style || {});
    if ((enabledChanged || revealModeChanged) && refreshTimer !== null) schedulePolling();
  } catch {
    if (!hasRendered) grid.replaceChildren(Object.assign(document.createElement('div'), { className: 'empty', textContent: 'Waiting for BreakSuite6…' }));
    // A browser/OBS fetch can occasionally stall or lose its localhost socket.
    // The timeout above releases refreshInFlight; this watchdog reloads only
    // after a sustained outage so the reveal source self-recovers without the
    // operator having to refresh OBS while live.
    const now = Date.now();
    if (now - lastRefreshSuccessAt > 20000 && now - recoveryReloadAt > 30000) {
      recoveryReloadAt = now;
      setTimeout(() => window.location.reload(), 250);
    }
  } finally {
    refreshInFlight = false;
  }
}

async function heartbeat() {
  try {
    await fetchWithTimeout(`/api/overlay/heartbeat?_=${Date.now()}`, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    }, 2500);
  } catch {
    // refresh() owns recovery; heartbeat must never block or stop polling.
  }
}

function schedulePolling() {
  clearInterval(refreshTimer);
  clearInterval(heartbeatTimer);
  // OBS can report a composited browser source as hidden. Keep enabled card
  // boards responsive to sales regardless of document.visibilityState. Only
  // an intentionally idle board backs off.
  const refreshMs = revealOnly ? 500 : (overlayEnabled || boardRevealActive ? 750 : 2000);
  const heartbeatMs = revealOnly || overlayEnabled ? 5000 : 15000;
  refreshTimer = setInterval(refresh, refreshMs);
  heartbeatTimer = setInterval(heartbeat, heartbeatMs);
}

refresh();
heartbeat();
schedulePolling();
document.addEventListener('visibilitychange', () => {
  schedulePolling();
  if (!document.hidden) refresh();
});
window.addEventListener('online', () => refresh());
window.addEventListener('focus', () => refresh());
let resizeFrame = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => syncBoardFrame([...grid.querySelectorAll('.card')]));
});
