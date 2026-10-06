const grid = document.querySelector('#overlay-grid');
const count = document.querySelector('#overlay-count');
const lastCall = document.querySelector('#overlay-last-call');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function render(cards) {
  const remainingCards = cards.filter(card => card.block_status === 'ready');
  count.textContent = `${remainingCards.length.toLocaleString()} remaining`;
  const calledCards = cards.filter(card => card.block_status !== 'ready' && card.called_at);
  const newestCall = calledCards.sort((left, right) => String(right.called_at).localeCompare(String(left.called_at)))[0];
  lastCall.textContent = newestCall ? `BLOCK ${String(newestCall.position).padStart(2, '0')} CALLED` : 'Waiting for a block';
  lastCall.classList.toggle('called', Boolean(newestCall));
  if (!cards.length) {
    grid.innerHTML = '<div class="overlay-empty"><b>No saved live ledger</b><span>Save the Break Board in BreakSuite6 before opening this display.</span></div>';
    return;
  }
  if (!remainingCards.length) {
    grid.innerHTML = '<div class="overlay-empty"><b>All cards have been assigned</b><span>Reset Test Assignments to restore simulated cards before going live.</span></div>';
    return;
  }
  grid.innerHTML = remainingCards.map(card => `
    <article class="overlay-card">
      <div class="overlay-art">${card.image_url ? `<img src="${escapeHtml(card.image_url)}" alt="${escapeHtml(card.name)}" />` : '<span>♧</span>'}</div>
      <div class="overlay-copy"><b>${String(card.position).padStart(2, '0')}</b><span>${escapeHtml([card.set_code, card.card_number, card.break_rarity || card.rarity].filter(Boolean).join(' · '))}</span></div>
    </article>`).join('');
}

window.breakSuite.onBreakBoardChanged(render);
window.breakSuite.getActiveBreakBoard().then(render).catch(() => render([]));
