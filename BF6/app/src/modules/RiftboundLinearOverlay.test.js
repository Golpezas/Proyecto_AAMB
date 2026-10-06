'use strict';

const assert = require('node:assert/strict');
const {
  RIFTBOUND_LINEAR_OVERLAY_PROFILES,
  applyLinearOverlayProfileToCard,
  linearOverlayProfileForCustomMapping,
  linearOverlayProfileForEntry,
  linearOverlayProfileForPresetSlot,
  overlayPreviewCards
} = require('./RiftboundLinearOverlay');
const { SPIRITFORGED_EXPANDED_SPOTS } = require('./RiftboundSpiritforgedExpandedBreak');
const { UNLEASHED_BOARD_THREE_SPOTS } = require('./RiftboundUnleashedBoardThree');
const { UNLEASHED_EXPANDED_SPOTS } = require('./RiftboundUnleashedExpandedBreak');
const { UNLEASHED_FULL_CASE_SPOTS } = require('./RiftboundUnleashedFullCase');
const { VENDETTA_SPLIT_SPOTS } = require('./RiftboundVendettaSplitBreak');

function mappingFor(spots, setCode) {
  return {
    spots: spots.map((spot, index) => ({
      position: spot.position,
      label: spot.label || spot.anchor,
      cards: [{
        id: index + 1,
        game_code: 'RIFTBOUND',
        set_code: setCode,
        name: spot.anchor,
        card_number: spot.anchorNumber,
        mappingAdditionType: 'ANCHOR'
      }, {
        id: index + 1000,
        game_code: 'RIFTBOUND',
        set_code: setCode,
        name: `Sequence ${index + 1}`,
        card_number: `SEQ-${index + 1}`,
        mappingAdditionType: 'SEQUENCE'
      }]
    }))
  };
}

const boardSix = mappingFor(SPIRITFORGED_EXPANDED_SPOTS, 'SFD');
const boardThree = mappingFor(UNLEASHED_BOARD_THREE_SPOTS, 'UNL');
const boardSeven = mappingFor(UNLEASHED_EXPANDED_SPOTS, 'UNL');
const boardFive = mappingFor(UNLEASHED_FULL_CASE_SPOTS, 'UNL');
const boardNine = mappingFor(VENDETTA_SPLIT_SPOTS, 'VEN');

assert.equal(linearOverlayProfileForCustomMapping(boardSix), RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_6);
assert.equal(linearOverlayProfileForCustomMapping(boardThree), RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_3);
assert.equal(linearOverlayProfileForCustomMapping(boardSeven), RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_7);
assert.equal(linearOverlayProfileForCustomMapping(boardFive), RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_5);
assert.equal(linearOverlayProfileForCustomMapping(boardNine), RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_9);
assert.equal(linearOverlayProfileForCustomMapping({ spots: boardSix.spots.slice(0, 2) }), null);

assert.equal(linearOverlayProfileForPresetSlot(3), RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_3);
assert.equal(linearOverlayProfileForPresetSlot(4), RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_4);
assert.equal(linearOverlayProfileForPresetSlot(5), RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_5);
assert.equal(linearOverlayProfileForPresetSlot(6), RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_6);
assert.equal(linearOverlayProfileForPresetSlot(7), RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_7);
assert.equal(linearOverlayProfileForPresetSlot(9), RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_9);
assert.equal(linearOverlayProfileForPresetSlot(10), RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_10);

assert.equal(linearOverlayProfileForEntry({ spotType: 'SPIRITFORGED_EXPANDED' }), RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_6);
assert.equal(linearOverlayProfileForEntry({ spotType: 'UNLEASHED_EXPANDED' }), RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_7);
assert.equal(linearOverlayProfileForEntry({ spotType: 'CUSTOM_MAPPING', linearOverlayProfile: RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_9.id }), RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_9);
assert.equal(linearOverlayProfileForEntry({ spotType: 'CUSTOM_MAPPING', linearOverlayProfile: RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_10_SPIRITFORGED_LEGACY.id }), RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_10_SPIRITFORGED_LEGACY);
assert.equal(linearOverlayProfileForEntry({ spotType: 'CUSTOM_MAPPING' }), null);

const previewPool = [{ id: 1 }, { id: 2 }, { id: 3 }];
assert.deepEqual(overlayPreviewCards(previewPool, RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_3), [{ id: 1 }]);
assert.deepEqual(overlayPreviewCards(previewPool, RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_4), [{ id: 1 }]);
assert.deepEqual(overlayPreviewCards(previewPool, RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_5), [{ id: 1 }]);
assert.deepEqual(overlayPreviewCards(previewPool, RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_6), [{ id: 1 }]);
assert.deepEqual(overlayPreviewCards(previewPool, RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_7), [{ id: 1 }]);
assert.deepEqual(overlayPreviewCards(previewPool, RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_9), [{ id: 1 }]);
assert.deepEqual(overlayPreviewCards(previewPool, RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_10), [{ id: 1 }]);
assert.deepEqual(overlayPreviewCards(previewPool, null), [{ id: 1 }, { id: 2 }]);

// Board 4 can use the normal Spiritforged mapping rather than a Frame Studio
// custom map. That path starts with a two-card Signature + Champion bundle,
// so the final public payload must enforce the one-card rule after every
// mapping builder has finished.
const normalBoardFourBundle = {
  id: 77,
  spot_bundle: {
    kind: 'champion',
    label: 'Lee Sin + Diana',
    cards: [{ id: 101, bundle_role: 'signature' }, { id: 102, bundle_role: 'champion' }]
  }
};
const boardFourPublicCard = applyLinearOverlayProfileToCard(
  normalBoardFourBundle,
  RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_4
);
assert.equal(boardFourPublicCard.spot_bundle.kind, 'spiritforged-board-4-single-anchor');
assert.equal(boardFourPublicCard.spot_bundle.label, 'Lee Sin + Diana');
assert.equal(boardFourPublicCard.spot_bundle.preview_title, 'SPIRITFORGED · BOARD 4');
assert.deepEqual(boardFourPublicCard.spot_bundle.cards, [{ id: 101, bundle_role: 'primary' }]);
assert.equal(normalBoardFourBundle.spot_bundle.cards.length, 2, 'The saved Buyer Bag bundle must remain unchanged.');

console.log('Board 3, Board 4, Board 5, Board 6, Board 7, Board 9, and Board 10 single-anchor linear overlay policy checks passed.');

for (const slot of [2, 8]) {
  const profile = linearOverlayProfileForPresetSlot(slot);
  assert.ok(profile);
  assert.equal(overlayPreviewCards(previewPool, profile).length, 1);
  assert.equal(applyLinearOverlayProfileToCard(normalBoardFourBundle, profile).spot_bundle.cards.length, 1);
}
const origins = mappingFor(Array.from({length: 25}, (_, i) => ({position: i + 1, anchor: `Origin ${i}`})), 'OGN');
assert.equal(linearOverlayProfileForCustomMapping(origins), RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_8);
