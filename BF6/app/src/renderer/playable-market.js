(() => {
  const $ = selector => document.querySelector(selector);
  const elements = {
    set: $('#pm-set'),
    research: $('#pm-research'),
    status: $('#pm-status'),
    tracked: $('#pm-tracked'),
    trackedNote: $('#pm-tracked-note'),
    hot: $('#pm-hot'),
    dips: $('#pm-dips'),
    moverLabel: $('#pm-mover-label'),
    mover: $('#pm-mover'),
    lastResearch: $('#pm-last-research'),
    search: $('#pm-search'),
    signal: $('#pm-signal'),
    sort: $('#pm-sort'),
    direction: $('#pm-direction'),
    tabs: $('#pm-window-tabs'),
    rankingTitle: $('#pm-ranking-title'),
    body: $('#pm-body'),
    researchModal: $('#pm-research-modal'),
    researchForm: $('#pm-research-form'),
    researchTitle: $('#pm-research-title'),
    researchDescription: $('#pm-research-description'),
    researchStatus: $('#pm-research-status'),
    copyRequest: $('#pm-copy-request'),
    json: $('#pm-json'),
    replaceSet: $('#pm-replace-set'),
    import: $('#pm-import'),
    detailModal: $('#pm-detail-modal'),
    detailContent: $('#pm-detail-content')
  };

  if (!elements.set || !window.breakSuite?.getPlayableMarketDashboard) return;

  const state = {
    loaded: false,
    sets: [],
    cards: [],
    window: '24h',
    sort: 'change',
    direction: 'desc',
    query: '',
    signal: 'ALL',
    preparedResearch: null,
    selectedCardId: null
  };

  const WINDOW_LABELS = { '24h': '24H', '7d': '7D', '30d': '30D', '90d': '90D' };
  const SIGNAL_LABELS = {
    ON_FIRE: '🔥 On fire',
    RISING: '↗ Rising',
    BUY_DIP: '◎ Buy dip',
    TAKE_PROFIT: '◈ Take profit',
    WATCH: 'Watch',
    STABLE: 'Stable'
  };

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function cash(cents) {
    return Number.isInteger(cents) ? `$${(cents / 100).toFixed(2)}` : '—';
  }

  function signedCash(cents) {
    if (!Number.isInteger(cents)) return '—';
    const prefix = cents > 0 ? '+' : cents < 0 ? '−' : '';
    return `${prefix}$${(Math.abs(cents) / 100).toFixed(2)}`;
  }

  function signedPercent(value) {
    if (!Number.isFinite(Number(value))) return '—';
    const number = Number(value);
    const prefix = number > 0 ? '+' : number < 0 ? '−' : '';
    return `${prefix}${Math.abs(number).toFixed(1)}%`;
  }

  function dateTime(value) {
    if (!value) return 'No research saved yet';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Research date unavailable';
    return `Researched ${date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} · ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }

  function selectedSet() {
    return state.sets.find(set => set.set_code === elements.set.value) || null;
  }

  function setStatus(message, type = '') {
    elements.status.textContent = message;
    elements.status.className = `pm-status ${type}`.trim();
  }

  function setResearchStatus(message, type = '') {
    elements.researchStatus.textContent = message;
    elements.researchStatus.className = `pm-status ${type}`.trim();
  }

  function changeClass(change) {
    if (!Number.isInteger(change?.cents)) return 'unknown';
    return change.cents > 0 ? 'up' : change.cents < 0 ? 'down' : 'flat';
  }

  function changeMarkup(card, window) {
    const movement = card.changes?.[window] || {};
    const prior = card.prices?.[window];
    const className = changeClass(movement);
    const title = Number.isInteger(prior) && Number.isInteger(card.prices?.current)
      ? `${cash(prior)} then → ${cash(card.prices.current)} now`
      : `No verified ${WINDOW_LABELS[window]} reference price`;
    return `<div class="pm-change ${className}" title="${escapeHtml(title)}"><strong>${signedCash(movement.cents)}</strong><span>${signedPercent(movement.pct)}</span></div>`;
  }

  function sparkline(card) {
    const values = ['90d', '30d', '7d', '24h'].map(window => card.prices?.[window]).concat(card.prices?.current);
    const points = values.map((value, index) => Number.isInteger(value) ? { value, index } : null).filter(Boolean);
    if (points.length < 2) return '';
    const minimum = Math.min(...points.map(point => point.value));
    const maximum = Math.max(...points.map(point => point.value));
    const range = Math.max(1, maximum - minimum);
    const polyline = points.map(point => {
      const x = 2 + (point.index / 4) * 70;
      const y = 18 - ((point.value - minimum) / range) * 15;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const active = card.changes?.[state.window];
    const color = active?.cents > 0 ? '#65dfbf' : active?.cents < 0 ? '#f47f96' : '#7187a7';
    return `<svg class="pm-sparkline" viewBox="0 0 74 21" aria-hidden="true"><polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><line x1="2" y1="19.5" x2="72" y2="19.5" stroke="rgba(171,190,231,.10)"/></svg>`;
  }

  function activeWindowClasses(window) {
    return window === state.window ? ' class="active-window"' : '';
  }

  function renderTable() {
    document.querySelectorAll('[data-window-heading]').forEach(heading => {
      heading.classList.toggle('active-window', heading.dataset.windowHeading === state.window);
    });
    if (!state.cards.length) {
      const set = selectedSet();
      const message = elements.set.value === 'ALL'
        ? '<b>No playable research is saved yet.</b>Choose a set, then use Research with ChatGPT to build the first market list.'
        : `<b>No tracked playables for ${escapeHtml(set?.set_name || elements.set.value)} yet.</b>Use Research with ChatGPT to identify the competitive cards and import current market evidence.`;
      elements.body.innerHTML = `<tr><td colspan="9" class="pm-empty">${message}</td></tr>`;
      return;
    }
    elements.body.innerHTML = state.cards.map(card => {
      const sources = Array.isArray(card.sources) ? card.sources : [];
      const sourceUrl = sources.find(source => source?.url)?.url || '';
      const marketButtons = [
        sourceUrl ? `<button type="button" data-pm-url="${escapeHtml(sourceUrl)}" title="Open supporting market evidence">Source ↗</button>` : '',
        card.buy_url ? `<button type="button" data-pm-url="${escapeHtml(card.buy_url)}" title="Open the researched buy page">Buy ↗</button>` : ''
      ].filter(Boolean).join('');
      return `<tr>
        <td><div class="pm-card-cell"><div class="pm-card-art">${card.image_url ? `<img src="${escapeHtml(card.image_url)}" alt="" loading="lazy">` : '◇'}</div><div class="pm-card-copy"><button type="button" data-pm-detail="${Number(card.id)}">${escapeHtml(card.name || 'Unnamed card')}</button><span>${escapeHtml([card.set_code, card.card_number, card.rarity].filter(Boolean).join(' · '))}</span><small>${escapeHtml(card.catalyst || card.analysis || 'Open for the saved market thesis.')}</small></div></div></td>
        <td><span class="pm-tier ${escapeHtml(card.playability_tier)}">${escapeHtml(card.playability_tier)}</span></td>
        <td><div class="pm-current"><strong>${cash(card.prices?.current)}</strong><small>RAW NM · USD</small>${sparkline(card)}</div></td>
        <td${activeWindowClasses('24h')}>${changeMarkup(card, '24h')}</td>
        <td${activeWindowClasses('7d')}>${changeMarkup(card, '7d')}</td>
        <td${activeWindowClasses('30d')}>${changeMarkup(card, '30d')}</td>
        <td${activeWindowClasses('90d')}>${changeMarkup(card, '90d')}</td>
        <td><span class="pm-signal ${escapeHtml(card.signal)}">${escapeHtml(SIGNAL_LABELS[card.signal] || card.signal)}</span></td>
        <td><div class="pm-market-actions">${marketButtons || '<span>—</span>'}</div></td>
      </tr>`;
    }).join('');
  }

  function renderSummary(summary = {}) {
    elements.tracked.textContent = Number(summary.tracked || 0).toLocaleString();
    elements.hot.textContent = Number(summary.onFire || 0).toLocaleString();
    elements.dips.textContent = Number(summary.buyDips || 0).toLocaleString();
    const set = selectedSet();
    elements.trackedNote.textContent = elements.set.value === 'ALL' ? 'across all tracked sets' : `in ${set?.set_name || elements.set.value}`;
    const mover = summary.biggestMover;
    elements.moverLabel.textContent = mover ? `Biggest ${WINDOW_LABELS[state.window]} · ${mover.name}` : `Biggest ${WINDOW_LABELS[state.window]} move`;
    elements.mover.textContent = mover ? signedPercent(mover.pct) : '—';
    elements.lastResearch.textContent = dateTime(summary.lastResearchAt);
  }

  function renderWindow() {
    elements.tabs.querySelectorAll('[data-pm-window]').forEach(button => button.classList.toggle('active', button.dataset.pmWindow === state.window));
    elements.rankingTitle.textContent = `${WINDOW_LABELS[state.window]} momentum ranking`;
    renderTable();
  }

  async function loadDashboard({ quiet = false } = {}) {
    if (!quiet) setStatus('Loading saved playable market research…');
    const result = await window.breakSuite.getPlayableMarketDashboard({
      setCode: elements.set.value,
      query: state.query,
      signal: state.signal,
      window: state.window,
      sort: state.sort,
      direction: state.direction
    });
    state.cards = Array.isArray(result.cards) ? result.cards : [];
    renderSummary(result.summary);
    renderWindow();
    if (state.cards.length) {
      setStatus(`Showing ${state.cards.length.toLocaleString()} researched playable${state.cards.length === 1 ? '' : 's'} · ranked by ${WINDOW_LABELS[state.window]} ${state.sort === 'change' ? 'movement' : state.sort}.`, 'success');
    } else if (elements.set.value === 'ALL') {
      setStatus('Choose a specific set and run the first assistant research batch. No pricing API is required.');
    } else {
      setStatus(`${selectedSet()?.set_name || elements.set.value} is ready for its first playable-card research batch.`);
    }
  }

  function renderSets() {
    const previous = elements.set.value || 'ALL';
    elements.set.innerHTML = '<option value="ALL">All tracked sets</option>' + state.sets.map(set => {
      const catalog = Number(set.card_count || 0).toLocaleString();
      const tracked = Number(set.tracked_count || 0).toLocaleString();
      return `<option value="${escapeHtml(set.set_code)}">${escapeHtml(set.set_code)} — ${escapeHtml(set.set_name)} · ${tracked} tracked / ${catalog} cards</option>`;
    }).join('');
    if ([...elements.set.options].some(option => option.value === previous)) elements.set.value = previous;
    const totalTracked = state.sets.reduce((total, set) => total + Number(set.tracked_count || 0), 0);
    if (!totalTracked && elements.set.value === 'ALL') {
      const firstReady = state.sets.find(set => Number(set.card_count || 0) > 0);
      if (firstReady) elements.set.value = firstReady.set_code;
    }
    updateResearchButton();
  }

  function updateResearchButton() {
    const set = selectedSet();
    const ready = Boolean(set && Number(set.card_count || 0) > 0);
    elements.research.disabled = !ready;
    elements.research.title = elements.set.value === 'ALL'
      ? 'Choose one set to create an exact catalog request.'
      : ready ? `Research ${set.set_name} playables in this ChatGPT conversation.` : 'Import this set into the Riftbound Library first.';
  }

  async function activate() {
    if (!state.loaded) {
      state.sets = await window.breakSuite.getPlayableMarketSets();
      renderSets();
      state.loaded = true;
    }
    await loadDashboard();
  }

  function researchPrompt(data) {
    const set = data.set;
    const shape = {
      setCode: set.setCode,
      researchedAt: 'ISO-8601 timestamp',
      cards: [{
        id: 123,
        currentPriceUsd: 12.34,
        price24hAgoUsd: 11.9,
        price7dAgoUsd: 10.5,
        price30dAgoUsd: 8.25,
        price90dAgoUsd: null,
        signal: 'ON_FIRE | RISING | BUY_DIP | TAKE_PROFIT | WATCH | STABLE',
        playabilityTier: 'STAPLE | META | NICHE | SPECULATIVE',
        confidence: 'HIGH | MEDIUM | LOW',
        catalyst: 'short current tournament, metagame, ban-list, release, or news reason',
        analysis: 'concise buy/hold/sell thesis grounded in playability and price movement',
        sources: [{ name: 'source name', url: 'https://supporting-page', note: 'what this source supports' }],
        buyUrl: 'https://exact or useful buying page',
        sellUrl: 'https://useful selling or listing page'
      }]
    };
    return `Research the current competitive Riftbound market for ${set.setName} (${set.setCode}) inside this ChatGPT conversation. Do the web research yourself; do not tell me to connect a pricing API. This is a short-term resale tracker for playable cards, not a collector or chase-card list.

Requirements:
1. Identify the cards from this set that are genuinely seeing competitive play or have credible near-term metagame potential. Return only those playables.
2. For each functional card, select the regular, standard, lowest-cost raw Near Mint English printing from the supplied catalog. Exclude signatures, showcases, alternate art, overnumbered cards, promos, and other collector premiums unless no standard printing is supplied.
3. Keep each catalog id exactly as supplied. Never invent an id or match by name alone.
4. Research the current fair unit price and reference prices from about 24 hours, 7 days, 30 days, and 90 days ago. Use reliable public market pages, sold-comparable evidence, price histories, tournament results, official announcements, and reputable competitive coverage. If a historical reference cannot be verified, use null—never guess. Omit a card entirely if its current price has no credible supporting URL.
5. Prices are USD for one exact raw NM English copy. Do not use graded, sealed, lot, playset, or another printing's price.
6. Use multiple sources when they materially improve confidence. Every returned card must have at least one direct HTTPS supporting source. Provide a practical buy URL; provide a sell/list URL when useful.
7. Signals: ON_FIRE = strong current momentum; RISING = positive but not overheated; BUY_DIP = price is down while playability/catalyst remains credible; TAKE_PROFIT = a sharp move makes selling attractive; WATCH = thesis needs confirmation; STABLE = little movement.
8. Keep catalyst and analysis concise and factual. Confidence describes the strength of both playability and price evidence.
9. Return JSON only, with no Markdown or commentary, in exactly this structure:
${JSON.stringify(shape, null, 2)}

Exact ${set.setName} catalog candidates:
${JSON.stringify(data.candidates, null, 2)}`;
  }

  async function openResearch() {
    const set = selectedSet();
    if (!set) {
      setStatus('Choose one Riftbound set before starting research.', 'error');
      return;
    }
    elements.research.disabled = true;
    elements.research.textContent = 'Preparing…';
    try {
      state.preparedResearch = await window.breakSuite.preparePlayableMarketResearch(set.set_code);
      elements.researchTitle.textContent = `Research ${set.set_name} playables`;
      elements.researchDescription.textContent = `${Number(state.preparedResearch.candidates?.length || 0).toLocaleString()} exact catalog candidates are included. ChatGPT returns only competitive standard printings with verified market evidence.`;
      elements.json.value = '';
      elements.replaceSet.checked = true;
      setResearchStatus('Step 1: copy the request and paste it into this ChatGPT conversation.');
      elements.researchModal.classList.remove('hidden');
      window.setTimeout(() => elements.copyRequest.focus(), 0);
    } catch (error) {
      setStatus(error.message || 'The research request could not be prepared.', 'error');
    } finally {
      elements.research.disabled = false;
      elements.research.textContent = '✦ Research with ChatGPT';
      updateResearchButton();
    }
  }

  function closeResearch() {
    elements.researchModal.classList.add('hidden');
    state.preparedResearch = null;
    setResearchStatus('');
  }

  async function copyResearchRequest() {
    if (!state.preparedResearch) throw new Error('Prepare a set research request first.');
    await navigator.clipboard.writeText(researchPrompt(state.preparedResearch));
    elements.copyRequest.textContent = 'Copied ✓';
    setResearchStatus('✓ Complete set request copied. Paste it here in ChatGPT, then paste the JSON response into Step 2.', 'success');
    window.setTimeout(() => { if (state.preparedResearch) elements.copyRequest.textContent = 'Copy Research Request'; }, 1800);
  }

  function parsedResearch() {
    let raw = String(elements.json.value || '').trim();
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    if (!raw) throw new Error('Paste the JSON research response first.');
    let parsed;
    try { parsed = JSON.parse(raw); } catch { throw new Error('That response is not valid JSON. Ask ChatGPT for JSON only, then paste it again.'); }
    const cards = Array.isArray(parsed) ? parsed : (parsed?.cards || parsed?.playables);
    if (!Array.isArray(cards) || !cards.length) throw new Error('The JSON needs a non-empty cards array.');
    return { parsed, cards };
  }

  async function importResearch(event) {
    event.preventDefault();
    const { parsed, cards } = parsedResearch();
    const set = selectedSet();
    if (!set) throw new Error('The selected set changed. Close this window and prepare the request again.');
    elements.import.disabled = true;
    elements.import.textContent = 'Validating & saving…';
    try {
      const result = await window.breakSuite.applyPlayableMarketResearch({
        setCode: set.set_code,
        researchedAt: parsed.researchedAt || parsed.asOf,
        replaceSet: elements.replaceSet.checked,
        cards
      });
      state.sets = await window.breakSuite.getPlayableMarketSets();
      const selectedCode = set.set_code;
      renderSets();
      elements.set.value = selectedCode;
      updateResearchButton();
      closeResearch();
      await loadDashboard({ quiet: true });
      const skipped = Number(result.skippedCards || 0);
      setStatus(`✓ Saved ${Number(result.importedCards || 0).toLocaleString()} ${set.set_name} playable${Number(result.importedCards) === 1 ? '' : 's'}${skipped ? ` · skipped ${skipped} invalid row${skipped === 1 ? '' : 's'}` : ''}.`, 'success');
    } catch (error) {
      setResearchStatus(error.message || 'The market research could not be saved.', 'error');
    } finally {
      elements.import.disabled = false;
      elements.import.textContent = 'Import Market Research';
    }
  }

  function detailWindow(card, window) {
    const movement = card.changes?.[window] || {};
    return `<article class="${changeClass(movement)}"><span>${WINDOW_LABELS[window]}</span><b>${signedCash(movement.cents)}</b><small>${signedPercent(movement.pct)} · was ${cash(card.prices?.[window])}</small></article>`;
  }

  function deepAnalysisPrompt(card) {
    return `Re-research this exact Riftbound playable card and give me a current buy/hold/sell analysis. Browse recent competitive deck results, metagame shifts, official announcements, product releases, and current market evidence. Focus on the next 7 to 90 days, distinguish real playability demand from collector speculation, and verify the exact regular raw Near Mint English printing. Do the analysis here in ChatGPT; do not ask me to connect an API.\n\nCard: ${card.name}\nCatalog id: ${card.id}\nSet / number: ${card.set_code} · ${card.card_number}\nSaved current price: ${cash(card.prices?.current)}\nSaved signal: ${card.signal}\nSaved catalyst: ${card.catalyst || 'None'}\nSaved sources: ${JSON.stringify(card.sources || [])}\n\nTell me: what changed, evidence for the move, downside risk, reasonable entry range, take-profit range, and which news or tournament result would invalidate the thesis. Include direct source links and state the research date.`;
  }

  function openDetail(cardId) {
    const card = state.cards.find(item => Number(item.id) === Number(cardId));
    if (!card) return;
    state.selectedCardId = Number(card.id);
    const sources = Array.isArray(card.sources) ? card.sources.filter(source => source?.url) : [];
    elements.detailContent.innerHTML = `<div class="pm-detail-grid">
      <div class="pm-detail-art">${card.image_url ? `<img src="${escapeHtml(card.image_url)}" alt="${escapeHtml(card.name)}">` : '<span>◇</span>'}</div>
      <div>
        <div class="pm-detail-head"><p class="eyebrow">PLAYABLE MARKET THESIS</p><h2 id="pm-detail-title">${escapeHtml(card.name)}</h2><span>${escapeHtml([card.set_code, card.card_number, card.rarity, card.card_type].filter(Boolean).join(' · '))}</span><div class="pm-detail-badges"><span class="pm-tier ${escapeHtml(card.playability_tier)}">${escapeHtml(card.playability_tier)}</span><span class="pm-signal ${escapeHtml(card.signal)}">${escapeHtml(SIGNAL_LABELS[card.signal] || card.signal)}</span><span class="pm-tier">${escapeHtml(card.confidence)} CONFIDENCE</span></div></div>
        <div class="pm-detail-price"><div><span>CURRENT RAW NM PRICE</span><strong>${cash(card.prices?.current)}</strong><small>USD · exact catalog printing</small></div><time>${escapeHtml(dateTime(card.captured_at))}</time></div>
        <div class="pm-detail-windows">${['24h', '7d', '30d', '90d'].map(window => detailWindow(card, window)).join('')}</div>
        <div class="pm-thesis"><section><span>WHY IT IS MOVING</span><p>${escapeHtml(card.catalyst || 'No specific catalyst was saved.')}</p></section><section><span>ASSISTANT THESIS</span><p>${escapeHtml(card.analysis || 'No analysis was saved.')}</p></section></div>
        <div class="pm-detail-sources"><span>EVIDENCE</span>${sources.length ? sources.map((source, index) => `<button type="button" data-pm-url="${escapeHtml(source.url)}" title="${escapeHtml(source.note || '')}">${escapeHtml(source.name || `Source ${index + 1}`)} ↗</button>`).join('') : '<small>No source links saved.</small>'}</div>
        <div class="pm-detail-actions">${card.buy_url ? `<button class="primary-button" type="button" data-pm-url="${escapeHtml(card.buy_url)}">Open Buy Page ↗</button>` : ''}${card.sell_url ? `<button class="secondary-button" type="button" data-pm-url="${escapeHtml(card.sell_url)}">Open Sell / List Page ↗</button>` : ''}<button class="secondary-button" type="button" data-pm-deep-analysis="${Number(card.id)}">Copy Deeper Analysis Request</button><button class="secondary-button pm-remove" type="button" data-pm-remove="${Number(card.id)}">Remove from Tracker</button></div>
      </div>
    </div>`;
    elements.detailModal.classList.remove('hidden');
    window.setTimeout(() => $('#pm-detail-close')?.focus(), 0);
  }

  function closeDetail() {
    elements.detailModal.classList.add('hidden');
    state.selectedCardId = null;
  }

  async function removeCard(cardId) {
    const card = state.cards.find(item => Number(item.id) === Number(cardId));
    if (!card) return;
    if (!window.confirm(`Remove ${card.name} from the active playable tracker? Its saved price history will be kept.`)) return;
    await window.breakSuite.removePlayableMarketCard(card.id);
    closeDetail();
    state.sets = await window.breakSuite.getPlayableMarketSets();
    const selected = elements.set.value;
    renderSets();
    elements.set.value = selected;
    updateResearchButton();
    await loadDashboard({ quiet: true });
    setStatus(`Removed ${card.name} from the active tracker. Saved research history was kept.`, 'success');
  }

  async function copyDeepAnalysis(cardId, button) {
    const card = state.cards.find(item => Number(item.id) === Number(cardId));
    if (!card) return;
    await navigator.clipboard.writeText(deepAnalysisPrompt(card));
    button.textContent = 'Copied ✓';
    window.setTimeout(() => { if (button.isConnected) button.textContent = 'Copy Deeper Analysis Request'; }, 1800);
  }

  elements.set.addEventListener('change', () => {
    updateResearchButton();
    loadDashboard().catch(error => setStatus(error.message, 'error'));
  });
  elements.research.addEventListener('click', openResearch);
  elements.copyRequest.addEventListener('click', () => copyResearchRequest().catch(error => setResearchStatus(error.message, 'error')));
  elements.researchForm.addEventListener('submit', event => importResearch(event).catch(error => setResearchStatus(error.message, 'error')));
  $('#pm-research-close')?.addEventListener('click', closeResearch);
  $('#pm-research-cancel')?.addEventListener('click', closeResearch);
  $('#pm-detail-close')?.addEventListener('click', closeDetail);
  elements.researchModal.addEventListener('click', event => { if (event.target === elements.researchModal) closeResearch(); });
  elements.detailModal.addEventListener('click', event => { if (event.target === elements.detailModal) closeDetail(); });

  let searchTimer;
  elements.search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      state.query = elements.search.value;
      loadDashboard({ quiet: true }).catch(error => setStatus(error.message, 'error'));
    }, 180);
  });
  elements.signal.addEventListener('change', () => {
    state.signal = elements.signal.value;
    loadDashboard({ quiet: true }).catch(error => setStatus(error.message, 'error'));
  });
  elements.sort.addEventListener('change', () => {
    state.sort = elements.sort.value;
    loadDashboard({ quiet: true }).catch(error => setStatus(error.message, 'error'));
  });
  elements.direction.addEventListener('click', () => {
    state.direction = state.direction === 'desc' ? 'asc' : 'desc';
    elements.direction.dataset.direction = state.direction;
    elements.direction.textContent = state.direction === 'desc' ? '↓ Highest first' : '↑ Lowest first';
    loadDashboard({ quiet: true }).catch(error => setStatus(error.message, 'error'));
  });
  elements.tabs.addEventListener('click', event => {
    const button = event.target.closest('[data-pm-window]');
    if (!button) return;
    state.window = button.dataset.pmWindow;
    loadDashboard({ quiet: true }).catch(error => setStatus(error.message, 'error'));
  });

  elements.body.addEventListener('click', event => {
    const details = event.target.closest('[data-pm-detail]');
    if (details) return openDetail(details.dataset.pmDetail);
    const link = event.target.closest('[data-pm-url]');
    if (link) window.breakSuite.openExternal(link.dataset.pmUrl);
  });
  elements.detailContent.addEventListener('click', event => {
    const link = event.target.closest('[data-pm-url]');
    if (link) return window.breakSuite.openExternal(link.dataset.pmUrl);
    const remove = event.target.closest('[data-pm-remove]');
    if (remove) return removeCard(remove.dataset.pmRemove).catch(error => setStatus(error.message, 'error'));
    const deeper = event.target.closest('[data-pm-deep-analysis]');
    if (deeper) copyDeepAnalysis(deeper.dataset.pmDeepAnalysis, deeper).catch(error => { deeper.textContent = error.message || 'Could not copy'; });
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!elements.detailModal.classList.contains('hidden')) closeDetail();
    else if (!elements.researchModal.classList.contains('hidden')) closeResearch();
  });

  document.querySelector('[data-view="playable-market"]')?.addEventListener('click', () => {
    window.setTimeout(() => activate().catch(error => setStatus(error.message || 'The playable market could not be loaded.', 'error')), 0);
  });
  window.refreshPlayableMarket = activate;
})();
