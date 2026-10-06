const feed = document.querySelector('#feed');
let lastId = '';
let lastFeedKey = null;
let refreshInFlight = false;

function timeLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function render(alerts = []) {
  if (!alerts.length) {
    feed.innerHTML = '<div class="empty">Waiting for returning buyers to chat…</div>';
    return;
  }
  feed.innerHTML = alerts.map((alert) => {
    const name = String(alert.buyerName || '').replace(/^@+/, '');
    return `<article class="message ${alert.id === lastId ? 'new' : ''}"><div class="avatar">${name.slice(0, 1).toUpperCase() || 'B'}</div><div><b>@${name}</b><p>Previous buyer joined your Whatnot · Welcome back!</p><time>${timeLabel(alert.detectedAt)}</time></div></article>`;
  }).join('');
  if (alerts[0]?.id && alerts[0].id !== lastId) {
    lastId = alerts[0].id;
    const newest = feed.querySelector('.message');
    newest?.classList.add('flash');
  }
}

async function refresh() {
  if (refreshInFlight) return;
  refreshInFlight = true;
  const response = await fetch('/api/vip-alert', { cache: 'no-store' });
  const payload = await response.json();
  const alerts = Array.isArray(payload.alerts) ? payload.alerts : [];
  const key = alerts.map(alert => `${alert.id}:${alert.buyerName}:${alert.detectedAt}`).join('|');
  if (key !== lastFeedKey) {
    lastFeedKey = key;
    render(alerts);
  }
  refreshInFlight = false;
}

document.querySelector('#close').addEventListener('click', () => window.close());
refresh().catch(() => { refreshInFlight = false; });
setInterval(() => refresh().catch(() => { refreshInFlight = false; }), 2500);
