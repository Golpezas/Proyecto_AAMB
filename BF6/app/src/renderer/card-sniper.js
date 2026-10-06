(() => {
  const $ = selector => document.querySelector(selector);
  const game = $('#sniper-game');
  const set = $('#sniper-set');
  const scan = $('#sniper-scan');
  const status = $('#sniper-status');
  const body = $('#sniper-body');
  const count = $('#sniper-count');
  const snipes = $('#sniper-snipe-count');
  const best = $('#sniper-best');
  const last = $('#sniper-last');
  const form = $('#sniper-market-form');
  const key = $('#sniper-justtcg-key');
  const buyerPriceSource = $('#sniper-buyer-price-source');
  const ebayClientId = $('#sniper-ebay-client-id');
  const ebayClientSecret = $('#sniper-ebay-client-secret');
  const badge = $('#sniper-market-badge');
  const eyebrow = $('#sniper-eyebrow');
  const description = $('#sniper-description');
  let loaded = false;
  let allSets = [];

  function cash(value) {
    return Number.isFinite(Number(value)) ? `$${Number(value).toFixed(2)}` : '—';
  }

  function change(value) {
    if (!Number.isFinite(Number(value))) return '<span class="sniper-flat">—</span>';
    value = Number(value);
    return `<span class="${value > 0 ? 'sniper-up' : value < 0 ? 'sniper-down' : 'sniper-flat'}">${value > 0 ? '+' : ''}${value.toFixed(1)}%</span>`;
  }

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function selectedGameName() {
    return game.value === 'RIFTBOUND' ? 'Riftbound' : 'One Piece';
  }

  function selectedSet() {
    return allSets.find(row => row.selection_key === set.value) || null;
  }

  function updateHero() {
    const name = selectedGameName();
    eyebrow.textContent = `${name.toUpperCase()} MARKET HUNTER`;
    description.textContent = `Choose a ${name} set and search live market data.`;
  }

  function render(cards = [], scannedAt = '') {
    count.textContent = cards.length;
    const snipeCards = cards.filter(card => card.signal === 'SNIPE');
    snipes.textContent = snipeCards.length;
    const bestDiscount = cards.reduce((maximum, card) => Math.max(maximum, Number(card.discountPct || 0)), 0);
    best.textContent = bestDiscount ? `${bestDiscount.toFixed(1)}%` : '—';
    last.textContent = scannedAt
      ? new Date(scannedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : '—';
    if (!cards.length) {
      body.innerHTML = '<tr><td colspan="11" class="sniper-empty">No saved market scan for this set yet. Press Search Set Now.</td></tr>';
      return;
    }
    body.innerHTML = cards.map(card => `<tr><td><div class="sniper-card">${card.image_url ? `<img src="${escapeHtml(card.image_url)}" alt="">` : ''}<div><b>${escapeHtml(card.name || 'Unknown')}</b><small>${escapeHtml(card.set_code || '')} · ${escapeHtml(card.card_number || '')}</small></div></div></td><td>${escapeHtml([card.rarity, card.variant].filter(Boolean).join(' · ') || '—')}</td><td>${cash(card.market_price)}</td><td>${cash(card.fair_price)}</td><td>${Number.isFinite(Number(card.discountPct)) ? `${Number(card.discountPct).toFixed(1)}%` : '—'}</td><td>${change(card.change24h)}</td><td>${change(card.change7d)}</td><td>${change(card.change30d)}</td><td><span class="sniper-signal ${card.signal || 'PASS'}">${card.signal === 'SNIPE' ? '🔥 SNIPE' : card.signal === 'WATCH' ? 'WATCH' : 'PASS'}</span></td><td>${card.whatnot_url ? `<button class="ghost-button sniper-link sniper-whatnot-link" data-url="${escapeHtml(card.whatnot_url)}" title="Search live Whatnot listings for this exact printing">Search ↗</button>` : '—'}</td><td>${card.buy_url ? `<button class="ghost-button sniper-link" data-url="${escapeHtml(card.buy_url)}">TCGplayer ↗</button>` : '—'}</td></tr>`).join('');
    body.querySelectorAll('[data-url]').forEach(button => {
      button.onclick = () => window.breakSuite.openExternal(button.dataset.url);
    });
  }

  function pricingStatusText(pricing = {}) {
    if (pricing.selectedSource === 'justtcg') return pricing.justTcgConfigured
      ? 'The entire Riftbound board, Buyer Bags, and Pull History can use JustTCG automatically. Only this selected source runs.'
      : 'Riftbound pricing is set to JustTCG. Paste a JustTCG key before running a price refresh.';
    if (pricing.selectedSource === 'ebay') return pricing.ebayConfigured
      ? 'Riftbound pricing uses the median of matching active eBay item + shipping prices. These are asking-price estimates, not sold comps.'
      : 'Riftbound pricing is set to eBay Estimate. Add free Production Client ID and Client Secret credentials first.';
    if (pricing.selectedSource === 'chatgpt') return 'ChatGPT Batch Import puts every displayed card from the entire board or selected bag into one request. No separate OpenAI API bill.';
    return 'Manual Price opens every displayed card together for batch entry. No API account is needed.';
  }

  async function loadStatus() {
    const [current, pricing] = await Promise.all([
      window.breakSuite.getCardSniperStatus(),
      window.breakSuite.getPricingSettings()
    ]);
    badge.textContent = current.justTcgConfigured
      ? `JustTCG connected · ${current.justTcgKey}`
      : 'JustTCG not connected';
    badge.classList.toggle('sniper-up', current.justTcgConfigured);
    if (buyerPriceSource) buyerPriceSource.value = pricing.selectedSource || 'justtcg';
    if (ebayClientId) ebayClientId.placeholder = pricing.ebayConfigured
      ? `Saved ${pricing.ebayClientId} — leave blank to keep it`
      : 'Paste Production Client ID';
    if (ebayClientSecret) ebayClientSecret.placeholder = pricing.ebayConfigured
      ? 'Saved locally — leave blank to keep it'
      : 'Paste Production Client Secret';
    $('#sniper-pc-state').textContent = pricingStatusText(pricing);
    window.dispatchEvent(new CustomEvent('breaksuite:pricing-settings-changed', { detail: pricing }));
    return pricing;
  }

  function renderSetOptions(preserveSelection = true) {
    const prior = preserveSelection ? set.value : '';
    const rows = allSets.filter(row => row.game_code === game.value);
    set.innerHTML = '<option value="">Choose a set</option>' + rows.map(row => {
      const countLabel = Number(row.card_count || 0) > 0 ? ` · ${Number(row.card_count).toLocaleString()} cards` : '';
      return `<option value="${escapeHtml(row.selection_key)}">${escapeHtml(row.set_code)}${row.set_name && row.set_name !== row.set_code ? ` — ${escapeHtml(row.set_name)}` : ''}${countLabel}</option>`;
    }).join('');
    if (rows.some(row => row.selection_key === prior)) set.value = prior;
    updateHero();
  }

  async function loadSets() {
    allSets = await window.breakSuite.getCardSniperSets();
    renderSetOptions();
  }

  async function loadLatest() {
    if (!set.value) {
      render([]);
      status.textContent = `Choose a ${selectedGameName()} set to begin.`;
      return;
    }
    const metadata = selectedSet();
    const cards = await window.breakSuite.getCardSniperLatest(set.value);
    render(cards, cards[0]?.scanned_at || '');
    const label = metadata?.set_name || metadata?.set_code || 'selected set';
    status.textContent = cards.length
      ? `Showing the latest saved ${label} market scan. Press Search Set Now to refresh.`
      : `${label} is ready for its first JustTCG market search.`;
  }

  async function activate() {
    if (!loaded) {
      await Promise.all([loadSets(), loadStatus()]);
      loaded = true;
    }
    await loadLatest();
  }

  scan?.addEventListener('click', async () => {
    if (!set.value) {
      status.textContent = `Choose a ${selectedGameName()} set first.`;
      return;
    }
    const metadata = selectedSet();
    const label = metadata?.set_name || metadata?.set_code || set.value;
    scan.disabled = true;
    scan.textContent = 'Searching…';
    status.textContent = `Searching JustTCG for ${selectedGameName()} · ${label}…`;
    try {
      const result = await window.breakSuite.scanCardSniperSet(set.value);
      render(result.cards, result.scannedAt);
      status.textContent = `✓ Search complete · ${result.matchedCards} value cards ranked · ${result.groupName}`;
    } catch (error) {
      status.textContent = error.message || 'The market search failed.';
    } finally {
      scan.disabled = false;
      scan.textContent = '⌕ Search Set Now';
    }
  });

  game?.addEventListener('change', async () => {
    renderSetOptions(false);
    await loadLatest();
  });
  set?.addEventListener('change', loadLatest);

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const result = await window.breakSuite.saveCardSniperSettings({ justTcgKey: key.value });
      const pricing = await window.breakSuite.savePricingSettings({
        selectedSource: buyerPriceSource?.value || 'justtcg',
        ebayClientId: ebayClientId?.value || '',
        ebayClientSecret: ebayClientSecret?.value || ''
      });
      key.value = '';
      if (ebayClientId) ebayClientId.value = '';
      if (ebayClientSecret) ebayClientSecret.value = '';
      await loadStatus();
      status.textContent = `✓ ${pricing.selectedLabel} selected for Riftbound Board, Buyer Bags, and Pull History.${result.justTcgConfigured ? ' Card Sniper is ready with JustTCG.' : ' Card Sniper still needs a JustTCG key.'}`;
    } catch (error) {
      status.textContent = error.message || 'Could not save market data settings.';
    }
  });

  $('#sniper-get-key')?.addEventListener('click', () => window.breakSuite.openExternal('https://justtcg.com/'));
  $('#sniper-get-ebay-key')?.addEventListener('click', () => window.breakSuite.openExternal('https://developer.ebay.com/my/keys'));
  document.querySelector('[data-view="sniper"]')?.addEventListener('click', () => {
    setTimeout(() => activate().catch(error => { status.textContent = error.message; }), 0);
  });
  window.refreshCardSniper = activate;
})();
