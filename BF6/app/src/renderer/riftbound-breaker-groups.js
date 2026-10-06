(function exposeRiftboundBreakerGroups(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RiftboundBreakerGroups = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildRiftboundBreakerGroups() {
  const priorityGroups = Object.freeze([
    Object.freeze({ key: 'SIGNATURE', label: 'Signature' }),
    Object.freeze({ key: 'OVERNUMBERED', label: 'Overnumbered' }),
    Object.freeze({ key: 'ALT_ART', label: 'Showcase / Alternate Art' }),
    Object.freeze({ key: 'ULTIMATE', label: 'Ultimate' }),
    Object.freeze({ key: 'EPIC', label: 'Epic' }),
    Object.freeze({ key: 'RARE', label: 'Rare / Legend' }),
    Object.freeze({ key: 'UNCOMMON', label: 'Uncommon' }),
    Object.freeze({ key: 'COMMON', label: 'Common' }),
    Object.freeze({ key: 'LEFTOVERS', label: 'Other Riftbound Cards' })
  ]);

  const topOddsGroups = Object.freeze([
    Object.freeze({ key: 'SIGNATURE', label: 'Signature', accent: 'manga' }),
    Object.freeze({ key: 'OVERNUMBERED', label: 'Overnumbered', accent: 'sp' }),
    Object.freeze({ key: 'ALT_ART', label: 'Showcase / Alternate Art', accent: 'sec-aa' }),
    Object.freeze({ key: 'ULTIMATE', label: 'Ultimate', accent: 'l-aa' }),
    Object.freeze({ key: 'EPIC', label: 'Epic', accent: 'sr-aa' })
  ]);

  function groupKey(card = {}) {
    const treatment = String(card.collector_treatment || card.variant || '').trim().toUpperCase();
    if (treatment === 'SIGNATURE') return 'SIGNATURE';
    const artVariant = String(card.riftbound_art_variant || card.art_variant || card.artVariant || '').trim().toUpperCase();
    const rarity = String(card.rarity || card.break_rarity || '').trim().toUpperCase();
    if (artVariant === 'ULTIMATE' || treatment === 'ULTIMATE' || (rarity === 'ULTIMATE' && treatment !== 'OVERNUMBERED')) return 'ULTIMATE';
    if (treatment === 'OVERNUMBERED') return 'OVERNUMBERED';
    if (treatment === 'ALTERNATE ART') return 'ALT_ART';
    if (rarity === 'SHOWCASE') return 'ALT_ART';
    if (['ULTIMATE', 'EPIC', 'RARE', 'UNCOMMON', 'COMMON'].includes(rarity)) return rarity;
    return 'LEFTOVERS';
  }

  return Object.freeze({ priorityGroups, topOddsGroups, groupKey });
});
