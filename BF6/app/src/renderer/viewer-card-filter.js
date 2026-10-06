(function exposeViewerCardFilter(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BreakSuiteViewerCardFilter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildViewerCardFilter() {
  const onePieceViewerRarities = new Set([
    'MANGA', 'SP', 'SEC', 'SEC AA', 'SR', 'SR AA', 'R AA', 'L AA', 'GOLD DON!!', 'TR'
  ]);
  const riftboundViewerGroups = new Set([
    'SIGNATURE', 'OVERNUMBERED', 'ALT_ART', 'ULTIMATE', 'EPIC',
    'EPIC_HEART', 'RARE_CONSTRUCTION', 'SP_ROSE'
  ]);
  const explicitPopupGroups = new Set(['EPIC_HEART', 'RARE_CONSTRUCTION', 'SP_ROSE']);
  const riftboundPopupGroups = new Set([
    'SIGNATURE', 'OVERNUMBERED', 'ALT_ART', 'ULTIMATE',
    'EPIC_HEART', 'RARE_CONSTRUCTION', 'SP_ROSE'
  ]);

  function normalized(value) {
    return String(value || '').trim().toUpperCase();
  }

  function gameFor(card = {}) {
    return normalized(card.game_code || card.game || card.catalog_game);
  }

  function rarityFor(card = {}) {
    return normalized(card.break_rarity || card.rarity);
  }

  function isUltimatePrinting(card = {}) {
    const treatment = normalized(card.collector_treatment || card.variant || card.manual_category);
    const artVariant = normalized(card.riftbound_art_variant || card.art_variant || card.artVariant);
    const rarity = rarityFor(card);
    return artVariant === 'ULTIMATE'
      || treatment === 'ULTIMATE'
      || (rarity === 'ULTIMATE' && !['SIGNATURE', 'OVERNUMBERED'].includes(treatment));
  }

  function riftboundGroup(card = {}) {
    const treatment = normalized(card.collector_treatment || card.variant || card.manual_category);
    if (treatment === 'SIGNATURE') return 'SIGNATURE';
    if (isUltimatePrinting(card)) return 'ULTIMATE';
    if (treatment === 'OVERNUMBERED') return 'OVERNUMBERED';
    if (['ALTERNATE ART', 'ALT ART', 'SHOWCASE'].includes(treatment)) return 'ALT_ART';
    const rarity = rarityFor(card);
    if (rarity === 'SHOWCASE') return 'ALT_ART';
    if (['ULTIMATE', 'EPIC'].includes(rarity)) return rarity;
    return '';
  }

  function visualCardFor(card = {}) {
    const mappedLead = Array.isArray(card?.spot_bundle?.cards) ? card.spot_bundle.cards[0] : null;
    if (!mappedLead) return card;
    // Inherit only the catalog identity needed to recognize the game. Rarity
    // and treatment must come from the front card itself; inheriting those
    // fields from the hidden board anchor would defeat the first-card rule.
    return {
      ...mappedLead,
      game_code: mappedLead.game_code || card.game_code,
      game: mappedLead.game || card.game,
      catalog_game: mappedLead.catalog_game || card.catalog_game,
      spot_bundle: undefined
    };
  }

  function isSpecialCollectorNumber(card = {}) {
    return /(?:^|-)SP\d+(?:\/|$)/.test(normalized(card.card_number || card.number).replace(/\s+/g, ''));
  }

  function riftboundPopupGroup(card = {}) {
    const treatment = normalized(card.collector_treatment || card.variant || card.manual_category);
    const rarity = rarityFor(card);
    if (isSpecialCollectorNumber(card) || ['SP', 'SPECIAL', 'SPECIAL COLLECTOR'].includes(treatment) || rarity === 'SP') return 'SP_ROSE';
    if (treatment === 'SIGNATURE' || /\*/.test(String(card.card_number || card.number || ''))) return 'SIGNATURE';
    if (isUltimatePrinting(card)) return 'ULTIMATE';
    if (treatment === 'OVERNUMBERED') return 'OVERNUMBERED';
    if (['ALTERNATE ART', 'ALT ART', 'AA', 'SHOWCASE'].includes(treatment)) return 'ALT_ART';
    if (rarity === 'EPIC') return 'EPIC_HEART';
    if (rarity === 'RARE') return 'RARE_CONSTRUCTION';
    if (rarity === 'SHOWCASE') return 'ALT_ART';
    return '';
  }

  function declaredPopupGroup(card = {}) {
    const group = normalized(card?.spot_bundle?.effect_group);
    if (riftboundPopupGroups.has(group)) return group;
    if (group === 'EPIC') return 'EPIC_HEART';
    if (group === 'RARE') return 'RARE_CONSTRUCTION';
    if (group === 'SP') return 'SP_ROSE';
    return '';
  }

  function popupGroup(card = {}) {
    const visualCard = visualCardFor(card);
    if (gameFor(visualCard) !== 'RIFTBOUND') return '';
    // The front/first mapped card is the only display authority. The saved
    // pair remains in the Buyer Bag, but a rear card can never change the
    // public popup platform.
    return riftboundPopupGroup(visualCard) || declaredPopupGroup(card);
  }

  function effectClassForRiftboundGroup(group) {
    if (group === 'SIGNATURE') return 'chase-diamond';
    if (group === 'OVERNUMBERED') return 'chase-fire';
    if (group === 'ALT_ART') return 'chase-bomb';
    if (group === 'ULTIMATE') return 'chase-ultimate';
    if (group === 'EPIC_HEART') return 'chase-heart';
    if (group === 'RARE_CONSTRUCTION') return 'chase-construction';
    if (group === 'SP_ROSE') return 'chase-rose';
    return 'claim-neutral';
  }

  function isViewerCard(card = {}) {
    if (gameFor(card) === 'RIFTBOUND') return riftboundViewerGroups.has(riftboundGroup(card));
    return onePieceViewerRarities.has(rarityFor(card));
  }

  function effectClass(card = {}) {
    // Saved mapped boards can use a different database row as the live board
    // anchor. The card the viewer actually sees is the first mapped card, so
    // its treatment must control the popup effect as well as its artwork.
    const visualCard = visualCardFor(card);
    if (gameFor(visualCard) === 'RIFTBOUND') {
      const declaredBundleGroup = normalized(card?.spot_bundle?.effect_group);
      // Board 10's exact singles deliberately override the catalog rarity:
      // SP cards are often stored as Showcase, which would otherwise reuse
      // the Alternate Art bomb instead of their dedicated Rose statue.
      const group = (explicitPopupGroups.has(declaredBundleGroup) ? declaredBundleGroup : '')
        || riftboundGroup(visualCard)
        || (['SIGNATURE', 'OVERNUMBERED', 'ALT_ART'].includes(declaredBundleGroup) ? declaredBundleGroup : '');
      if (!riftboundViewerGroups.has(group)) return 'claim-neutral';
      if (group === 'SIGNATURE') return 'chase-diamond';
      if (group === 'OVERNUMBERED') return 'chase-fire';
      if (group === 'ALT_ART') return 'chase-bomb';
      if (group === 'ULTIMATE') return 'chase-ultimate';
      if (group === 'EPIC_HEART') return 'chase-heart';
      if (group === 'RARE_CONSTRUCTION') return 'chase-construction';
      if (group === 'SP_ROSE') return 'chase-rose';
      return 'chase-uniform';
    }
    if (!isViewerCard(visualCard)) return 'claim-neutral';
    return rarityFor(visualCard) === 'MANGA' ? 'chase-manga' : 'chase-uniform';
  }

  function popupEffectClass(card = {}) {
    const visualCard = visualCardFor(card);
    if (gameFor(visualCard) !== 'RIFTBOUND') return effectClass(card);
    return effectClassForRiftboundGroup(popupGroup(card));
  }

  function newestClaim(cards = []) {
    return [...cards]
      .filter(card => card.block_status !== 'ready' && card.called_at)
      .sort((left, right) => String(right.called_at).localeCompare(String(left.called_at)) || Number(right.position) - Number(left.position))[0] || null;
  }

  return Object.freeze({
    gameFor,
    rarityFor,
    riftboundGroup,
    riftboundPopupGroup,
    popupGroup,
    isViewerCard,
    effectClass,
    popupEffectClass,
    newestClaim
  });
});
