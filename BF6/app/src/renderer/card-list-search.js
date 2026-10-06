(function exposeCardListSearch(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BreakSuiteCardListSearch = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildCardListSearch() {
  function text(value) {
    return String(value ?? '').replace(/[★☆]/g, '*').trim();
  }

  function normalizeReference(value) {
    let normalized = text(value).toUpperCase()
      .replace(/[“”"'`]/g, '')
      .replace(/\s+/g, '')
      .replace(/^[|:;,.]+|[|:;,.]+$/g, '');
    normalized = normalized.replace(/^([A-Z]{2,10}[A-Z0-9-]*)-(?=(?:SP|R)?\d)/, '');
    normalized = normalized.split('/')[0].replace(/[^A-Z0-9*]/g, '');
    const match = normalized.match(/^(SP|R)?(\d+)([A-Z*]*)$/);
    if (!match) return normalized;
    const prefix = match[1] || '';
    const number = String(Math.max(0, Number(match[2]) || 0));
    return `${prefix}${number}${match[3] || ''}`;
  }

  function addUnique(target, seen, value) {
    const raw = text(value).replace(/^[|:;,.]+|[|:;,.]+$/g, '');
    const key = normalizeReference(raw);
    if (!key || seen.has(key)) return;
    seen.add(key);
    target.push({ raw, key });
  }

  function parseCardReferences(value) {
    const input = String(value ?? '');
    const references = [];
    const seen = new Set();
    const lines = input.split(/\r?\n|[,;]+/);
    const prefixedPattern = /\b[A-Z]{2,10}[A-Z0-9-]*-(?:SP|R)?\d{1,4}[A-Z*]?(?:\/\d{1,4})?(?=$|[^A-Z0-9*])/gi;
    const barePattern = /\b(?:SP|R)?\d{1,4}[A-Z*]?(?:\/\d{1,4})?(?=$|[^A-Z0-9*])/gi;

    for (const sourceLine of lines) {
      const line = sourceLine.trim();
      if (!line) continue;
      const prefixed = line.match(prefixedPattern) || [];
      if (prefixed.length) {
        prefixed.forEach(match => addUnique(references, seen, match));
        continue;
      }

      const cells = line.includes('|') ? line.split('|').map(cell => cell.trim()).filter(Boolean) : [line];
      for (let cell of cells) {
        if (!cell || /[$%]/.test(cell)) continue;
        cell = cell.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '');
        const matches = cell.match(barePattern) || [];
        const meaningful = matches.filter(match => {
          const numerator = match.split('/')[0];
          return /[A-Z*]/i.test(numerator) || /\//.test(match) || /^\d{3,4}$/.test(numerator) || matches.length > 1 || cells.length === 1;
        });
        meaningful.forEach(match => addUnique(references, seen, match));
      }
    }
    return references;
  }

  function cardReferenceKey(card = {}) {
    return normalizeReference(card.card_number || card.cardNumber || card.number || '');
  }

  function matchCardReferences(references = [], cards = []) {
    const byKey = new Map();
    for (const card of Array.isArray(cards) ? cards : []) {
      const key = cardReferenceKey(card);
      if (!key) continue;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(card);
    }
    for (const values of byKey.values()) {
      values.sort((left, right) => Number(Boolean(right.image_url || right.imageUrl)) - Number(Boolean(left.image_url || left.imageUrl))
        || Number(right.id || 0) - Number(left.id || 0));
    }

    const matches = [];
    const unmatched = [];
    const selectedIds = new Set();
    for (const reference of Array.isArray(references) ? references : []) {
      const candidates = byKey.get(reference.key) || [];
      const card = candidates.find(candidate => !selectedIds.has(Number(candidate.id))) || candidates[0];
      if (!card) {
        unmatched.push(reference.raw);
        continue;
      }
      const id = Number(card.id);
      if (id && selectedIds.has(id)) continue;
      if (id) selectedIds.add(id);
      matches.push(card);
    }
    return { matches, unmatched };
  }

  return Object.freeze({ normalizeReference, parseCardReferences, cardReferenceKey, matchCardReferences });
});
