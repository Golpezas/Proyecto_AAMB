const elements = {
  shell: document.querySelector('#active-case-shell'),
  set: document.querySelector('#active-case-set'),
  name: document.querySelector('#active-case-name'),
  opened: document.querySelector('#active-case-opened'),
  total: document.querySelector('#active-case-total'),
  next: document.querySelector('#active-case-next'),
  remaining: document.querySelector('#active-case-remaining'),
  hits: document.querySelector('#active-case-hits'),
  progress: document.querySelector('#active-case-progress-bar')
};

function trackedHitTotal(activeCase) {
  return Object.values(activeCase?.hit_counts || {}).reduce((total, value) => total + Math.max(0, Number(value || 0)), 0);
}

function render(activeCase) {
  const visible = Boolean(activeCase);
  document.body.classList.toggle('no-active-case', !visible);
  elements.shell.hidden = !visible;
  if (!visible) return;
  const game = activeCase.game_name || (String(activeCase.game_code || '').toUpperCase() === 'RIFTBOUND' ? 'Riftbound' : 'One Piece');
  const set = activeCase.set_name || activeCase.set_code || 'Open case';
  const opened = Math.max(0, Number(activeCase.opened_count || 0));
  const total = Math.max(1, Number(activeCase.total_boxes || 1));
  const remaining = Math.max(0, Number(activeCase.remaining_count ?? (total - opened)));
  const next = Number(activeCase.next_box_number || 0);
  elements.set.textContent = [game, set].filter(Boolean).join(' · ');
  elements.name.textContent = activeCase.tracker_name || 'Active Case';
  elements.opened.textContent = opened.toLocaleString();
  elements.total.textContent = total.toLocaleString();
  elements.remaining.textContent = remaining.toLocaleString();
  elements.next.textContent = next ? `Box ${String(next).padStart(2, '0')}` : 'Ready to finalize';
  elements.hits.textContent = trackedHitTotal(activeCase).toLocaleString();
  elements.progress.style.width = `${Math.max(0, Math.min(100, Number(activeCase.progress_percent || 0)))}%`;
  document.body.dataset.game = String(activeCase.game_code || '').toLowerCase();
}

let currentKey = '';
let waiting = false;
async function refresh() {
  if (waiting) return;
  waiting = true;
  try {
    const response = await fetch('/api/active-case', { cache: 'no-store' });
    if (!response.ok) throw new Error('Active case unavailable');
    const payload = await response.json();
    const activeCase = payload?.activeCase || null;
    const key = JSON.stringify(activeCase);
    if (key !== currentKey) {
      currentKey = key;
      render(activeCase);
    }
  } catch (_) {
    if (currentKey !== 'null') {
      currentKey = 'null';
      render(null);
    }
  } finally {
    waiting = false;
  }
}

refresh();
window.setInterval(refresh, 2500);
