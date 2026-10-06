const assert = require('node:assert/strict');
const filter = require('./viewer-card-filter');

assert.equal(filter.isViewerCard({ game_code: 'ONE_PIECE', rarity: 'Manga' }), true);
assert.equal(filter.effectClass({ game_code: 'ONE_PIECE', rarity: 'Manga' }), 'chase-manga');
assert.equal(filter.isViewerCard({ game_code: 'ONE_PIECE', break_rarity: 'SEC AA' }), true);
assert.equal(filter.isViewerCard({ game_code: 'ONE_PIECE', rarity: 'Common' }), false);

assert.equal(filter.isViewerCard({ game_code: 'RIFTBOUND', collector_treatment: 'Signature', rarity: 'Epic' }), true);
assert.equal(filter.effectClass({ game_code: 'RIFTBOUND', collector_treatment: 'Signature' }), 'chase-diamond');
assert.equal(filter.isViewerCard({ game_code: 'RIFTBOUND', collector_treatment: 'Overnumbered', rarity: 'Rare' }), true);
assert.equal(filter.effectClass({ game_code: 'RIFTBOUND', collector_treatment: 'Overnumbered' }), 'chase-fire');
assert.equal(filter.isViewerCard({ game_code: 'RIFTBOUND', collector_treatment: 'Alternate Art', rarity: 'Common' }), true);
assert.equal(filter.effectClass({ game_code: 'RIFTBOUND', collector_treatment: 'Alternate Art' }), 'chase-bomb');
assert.equal(filter.isViewerCard({ game_code: 'RIFTBOUND', rarity: 'Showcase' }), true);
assert.equal(filter.effectClass({ game_code: 'RIFTBOUND', rarity: 'Showcase' }), 'chase-bomb');
assert.equal(filter.effectClass({
  game_code: 'RIFTBOUND',
  collector_treatment: '',
  spot_bundle: {
    label: '🔥 VI 🔥 ON + HOTHEADED AA (030A)',
    cards: [{ game_code: 'RIFTBOUND', collector_treatment: 'Overnumbered', name: 'Vi' }]
  }
}), 'chase-fire', 'A mapped ON lead card must control the popup theme instead of the underlying board anchor');
assert.equal(filter.effectClass({
  game_code: 'RIFTBOUND',
  collector_treatment: 'Overnumbered',
  spot_bundle: {
    label: '💎 VI SIGNATURE',
    cards: [{ game_code: 'RIFTBOUND', collector_treatment: 'Signature', name: 'Vi' }]
  }
}), 'chase-diamond', 'The first mapped card must win when its treatment differs from the board anchor');
assert.equal(filter.effectClass({
  game_code: 'RIFTBOUND',
  collector_treatment: '',
  spot_bundle: {
    effect_group: 'OVERNUMBERED',
    cards: [{ game_code: 'RIFTBOUND', name: 'Vi Overnumbered' }]
  }
}), 'chase-fire', 'A mapped spot effect declaration must survive incomplete imported treatment metadata');
assert.equal(filter.effectClass({
  game_code: 'RIFTBOUND',
  rarity: 'Epic',
  spot_bundle: {
    effect_group: 'EPIC_HEART',
    cards: [{ game_code: 'RIFTBOUND', rarity: 'Epic', name: 'Astral Heron' }]
  }
}), 'chase-heart', 'Board 10 Epic singles must use the Heart statue');
assert.equal(filter.effectClass({
  game_code: 'RIFTBOUND',
  rarity: 'Rare',
  spot_bundle: {
    effect_group: 'RARE_CONSTRUCTION',
    cards: [{ game_code: 'RIFTBOUND', rarity: 'Rare', name: 'Rare card' }]
  }
}), 'chase-construction', 'Board 10 Rare singles must use the Construction statue');
assert.equal(filter.effectClass({
  game_code: 'RIFTBOUND',
  rarity: 'Showcase',
  spot_bundle: {
    effect_group: 'SP_ROSE',
    cards: [{ game_code: 'RIFTBOUND', rarity: 'Showcase', name: 'SP6 card' }]
  }
}), 'chase-rose', 'Board 10 SP singles must override Showcase and use the Rose statue');
assert.equal(filter.isViewerCard({ game_code: 'RIFTBOUND', rarity: 'Ultimate' }), true);
assert.equal(filter.isViewerCard({ game_code: 'RIFTBOUND', rarity: 'Epic' }), true);
assert.equal(filter.isViewerCard({ game_code: 'RIFTBOUND', rarity: 'Rare' }), false);
assert.equal(filter.isViewerCard({ game_code: 'RIFTBOUND', rarity: 'Common' }), false);

assert.equal(filter.popupEffectClass({ game_code: 'RIFTBOUND', collector_treatment: 'Signature' }), 'chase-diamond');
assert.equal(filter.popupEffectClass({ game_code: 'RIFTBOUND', collector_treatment: 'Overnumbered' }), 'chase-fire');
assert.equal(filter.popupEffectClass({ game_code: 'RIFTBOUND', collector_treatment: 'Alternate Art' }), 'chase-bomb');
assert.equal(filter.popupEffectClass({ game_code: 'RIFTBOUND', collector_treatment: 'Ultimate', rarity: 'Showcase' }), 'chase-ultimate');
assert.equal(filter.popupEffectClass({
  game_code: 'RIFTBOUND',
  set_code: 'UNL',
  card_number: 'UNL-238/219',
  collector_treatment: 'Overnumbered',
  rarity: 'Ultimate',
  riftbound_art_variant: 'Ultimate'
}), 'chase-ultimate', 'An exact Ultimate printing must beat its legacy Overnumbered treatment');
assert.equal(filter.popupEffectClass({
  game_code: 'RIFTBOUND',
  set_code: 'UNL',
  card_number: 'UNL-229/219',
  collector_treatment: 'Overnumbered',
  rarity: 'Ultimate',
  riftbound_art_variant: 'Overnumbered'
}), 'chase-fire', 'A normal Overnumbered printing must keep the fire platform');
assert.equal(filter.popupEffectClass({ game_code: 'RIFTBOUND', rarity: 'Epic' }), 'chase-heart');
assert.equal(filter.popupEffectClass({ game_code: 'RIFTBOUND', rarity: 'Rare' }), 'chase-construction');
assert.equal(filter.popupEffectClass({ game_code: 'RIFTBOUND', rarity: 'Showcase', card_number: 'VEN-SP2/006' }), 'chase-rose');
assert.equal(filter.popupEffectClass({ game_code: 'RIFTBOUND', rarity: 'Epic', card_number: 'UNL-SP1/012' }), 'chase-rose');
assert.equal(filter.popupEffectClass({
  game_code: 'RIFTBOUND',
  collector_treatment: 'Signature',
  spot_bundle: {
    effect_group: 'SIGNATURE',
    cards: [
      { game_code: 'RIFTBOUND', rarity: 'Epic', name: 'Front Epic' },
      { game_code: 'RIFTBOUND', collector_treatment: 'Signature', name: 'Rear Signature' }
    ]
  }
}), 'chase-heart', 'Only the first/front mapped card may select the public popup platform');
assert.equal(filter.popupEffectClass({
  game_code: 'RIFTBOUND',
  collector_treatment: 'Overnumbered',
  spot_bundle: {
    effect_group: 'ULTIMATE',
    cards: [{
      game_code: 'RIFTBOUND',
      collector_treatment: 'Overnumbered',
      rarity: 'Ultimate',
      riftbound_art_variant: 'Ultimate',
      name: 'Baron Nashor'
    }]
  }
}), 'chase-ultimate', 'Board 5 Baron must use the gold Ultimate platform');
assert.equal(filter.isViewerCard({ game_code: 'RIFTBOUND', rarity: 'Rare' }), false, 'Popup-only Rare styling must not add Rares to the static chase board');

const riftboundPopupCard = {
  id: 51,
  game_code: 'RIFTBOUND',
  rarity: 'Rare',
  block_status: 'assigned',
  called_at: '2026-08-09T18:00:00.000Z',
  buyer_name: 'viewer'
};
assert.equal(filter.newestClaim([
  { id: 50, game_code: 'RIFTBOUND', block_status: 'ready', called_at: '' },
  riftboundPopupCard
]), riftboundPopupCard, 'Pop must reveal an assigned Riftbound card even when it is not a board-filter rarity');

console.log('Viewer card filter tests passed.');
