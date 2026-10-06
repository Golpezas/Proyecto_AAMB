const elements = {
  hitStats: document.querySelector('#tracker-hit-stats'),
  title: document.querySelector('#case-standing-title'),
  kicker: document.querySelector('#case-standing-kicker')
};

const overlayPart = new URLSearchParams(window.location.search).get('part');
if (overlayPart === 'title' || overlayPart === 'hits') document.body.classList.add(`part-${overlayPart}`);

const ONE_PIECE_HIT_FIELDS = [
  ['manga_count', 'Manga'], ['sp_count', 'SP'], ['sec_count', 'Secret Rare'],
  ['sec_aa_count', 'SEC Alt Art'], ['leader_aa_count', 'Leader Alt Art'], ['sr_aa_count', 'SR Alt Art'], ['r_aa_count', 'Rare Alt Art'],
  ['tr_count', 'Treasure Rare'], ['gold_don_count', 'Gold DON!!']
];
const RIFTBOUND_HIT_FIELDS = [
  ['epic_count', 'Epic'], ['sp_count', 'SP'], ['alt_art_count', 'Alternate Art'],
  ['overnumbered_count', 'Overnumbered'], ['signature_count', 'Signature']
];

function trackerHitFields(tracker) {
  if (Array.isArray(tracker?.hit_fields) && tracker.hit_fields.length) {
    return tracker.hit_fields.map(field => [field.key, field.label]);
  }
  return String(tracker?.game_code || '').toUpperCase() === 'RIFTBOUND'
    ? RIFTBOUND_HIT_FIELDS
    : ONE_PIECE_HIT_FIELDS;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function hitStat(label, count, isCurrent = false) {
  const currentClass = isCurrent ? ' is-current' : '';
  return `<div class="tracker-hit-stat${currentClass}" aria-label="${escapeHtml(label)}: ${Number(count || 0).toLocaleString()}"><b>${Number(count || 0).toLocaleString()}</b><span>${escapeHtml(label)}</span></div>`;
}

function hitTotals(tracker, fields = trackerHitFields(tracker)) {
  const saved = tracker?.hit_counts;
  if (saved && typeof saved === 'object') return saved;
  return (tracker?.boxes || []).reduce((totals, box) => {
    fields.forEach(([key]) => { totals[key] += Number(box?.[key] || 0); });
    return totals;
  }, Object.fromEntries(fields.map(([key]) => [key, 0])));
}

let currentTracker = null;
let currentTrackerKey = '';
let railIndex = 0;
let rotating = false;
let currentHitFields = ONE_PIECE_HIT_FIELDS;

function railField(offset) {
  return currentHitFields[(railIndex + offset + currentHitFields.length) % currentHitFields.length];
}

function renderRail(animate = false) {
  const hits = currentTracker ? hitTotals(currentTracker, currentHitFields) : Object.fromEntries(currentHitFields.map(([key]) => [key, 0]));
  if (currentHitFields.length <= 5) {
    elements.hitStats.className = `tracker-hit-stats field-count-${currentHitFields.length}`;
    elements.hitStats.innerHTML = currentHitFields.map(([key, label]) => hitStat(label, hits[key])).join('');
    return;
  }
  const offsets = animate ? [-2, -1, 0, 1, 2, 3] : [-2, -1, 0, 1, 2];
  elements.hitStats.className = `tracker-hit-stats field-count-${currentHitFields.length}`;
  elements.hitStats.classList.toggle('is-rotating', animate);
  elements.hitStats.innerHTML = offsets.map((offset, index) => {
    const [key, label] = railField(offset);
    return hitStat(label, hits[key], index === 2);
  }).join('');
}

function render(tracker) {
  currentTracker = tracker;
  currentHitFields = trackerHitFields(tracker);
  if (railIndex >= currentHitFields.length) railIndex = 0;
  elements.title.textContent = tracker?.overlay_title || tracker?.tracker_name || 'Box Tracker';
  const game = tracker?.game_name || (String(tracker?.game_code || '').toUpperCase() === 'RIFTBOUND' ? 'Riftbound' : 'One Piece');
  const identity = [game, tracker?.set_name || tracker?.set_code, tracker?.record_type_label].filter(Boolean).join(' · ');
  elements.kicker.textContent = identity || 'Saved break totals';
  document.body.dataset.game = String(tracker?.game_code || '').toLowerCase();
  if (!rotating) renderRail(false);
}

function rotateRail() {
  if (document.hidden || rotating || currentHitFields.length <= 5) return;
  rotating = true;
  renderRail(true);
  window.setTimeout(() => {
    railIndex = (railIndex + 1) % currentHitFields.length;
    rotating = false;
    renderRail(false);
  }, 720);
}

let waiting = false;
async function refresh() {
  if (waiting) return;
  waiting = true;
  try {
    const response = await fetch('/api/box-tracker', { cache: 'no-store' });
    if (!response.ok) throw new Error('Tracker service unavailable');
    const payload = await response.json();
    const active = payload?.active || null;
    const key = JSON.stringify(active);
    if (key !== currentTrackerKey) {
      currentTrackerKey = key;
      render(active);
    }
  } catch (_) {
    if (currentTrackerKey !== 'null') {
      currentTrackerKey = 'null';
      render(null);
    }
  } finally {
    waiting = false;
  }
}

refresh();
window.setInterval(refresh, 2500);
window.setInterval(rotateRail, 3400);
