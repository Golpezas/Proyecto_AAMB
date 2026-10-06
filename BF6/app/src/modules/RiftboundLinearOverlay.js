'use strict';

const { isSpiritforgedExpandedBreakBoard } = require('./RiftboundSpiritforgedExpandedBreak');
const { isUnleashedBoardThreeBreakBoard } = require('./RiftboundUnleashedBoardThree');
const { isUnleashedExpandedBreakBoard } = require('./RiftboundUnleashedExpandedBreak');
const { isUnleashedFullCaseBreakBoard } = require('./RiftboundUnleashedFullCase');
const { isVendettaSplitCustomMapping } = require('./RiftboundVendettaSplitBreak');
const { isVendettaBoardOne } = require('./RiftboundVendettaBoardOne');

const RIFTBOUND_LINEAR_OVERLAY_PROFILES = Object.freeze({
  BOARD_1: Object.freeze({
    id: 'vendetta-board-1-33-linear',
    bundleKind: 'vendetta-board-1-single-anchor',
    previewTitle: 'VENDETTA 33 SPOTS · BOARD 1'
  }),
  BOARD_2: Object.freeze({
    id: 'origins-spiritforged-board-2-linear',
    bundleKind: 'origins-spiritforged-board-2-single-anchor',
    previewTitle: 'ORIGINS + SPIRITFORGED · BOARD 2'
  }),
  BOARD_8: Object.freeze({
    id: 'origins-board-8-linear',
    bundleKind: 'origins-board-8-single-anchor',
    previewTitle: 'ORIGINS 24 SPOTS · BOARD 8'
  }),
  BOARD_3: Object.freeze({
    id: 'riftbound-board-3-linear',
    bundleKind: 'riftbound-board-3-single-anchor',
    previewTitle: 'RIFTBOUND BOARD 3'
  }),
  BOARD_4: Object.freeze({
    id: 'spiritforged-board-4-linear',
    bundleKind: 'spiritforged-board-4-single-anchor',
    previewTitle: 'SPIRITFORGED · BOARD 4'
  }),
  BOARD_5: Object.freeze({
    id: 'unleashed-board-5-board-3-style-linear',
    bundleKind: 'unleashed-board-5-single-anchor',
    previewTitle: 'UNLEASHED · BOARD 5'
  }),
  BOARD_6: Object.freeze({
    id: 'spiritforged-board-6-linear',
    bundleKind: 'spiritforged-expanded-linear',
    previewTitle: 'SPIRITFORGED 50-SPOT · BOARD 6'
  }),
  BOARD_7: Object.freeze({
    id: 'unleashed-board-7-linear',
    bundleKind: 'unleashed-expanded-linear',
    previewTitle: 'UNLEASHED 39-SPOT · BOARD 7'
  }),
  BOARD_9: Object.freeze({
    id: 'spiritforged-board-9-exact-singles-linear',
    bundleKind: 'spiritforged-board-9-exact-single',
    previewTitle: 'SPIRITFORGED 110 EXACT SINGLES · BOARD 9'
  }),
  BOARD_10: Object.freeze({
    id: 'vendetta-board-10-exact-singles-linear',
    bundleKind: 'vendetta-board-10-exact-single',
    previewTitle: 'VENDETTA EXACT SINGLES · BOARD 10'
  }),
  BOARD_10_SPIRITFORGED_LEGACY: Object.freeze({
    id: 'spiritforged-board-10-balanced-color-linear',
    bundleKind: 'spiritforged-board-10-balanced-color',
    previewTitle: 'SPIRITFORGED BALANCED COLOR · BOARD 10'
  })
});

function customMappingAnchorRows(mapping = null) {
  if (!mapping?.spots?.length) return [];
  return mapping.spots.map(spot => {
    const cards = Array.isArray(spot.cards) ? spot.cards : [];
    const anchor = cards.find(card => String(card.mappingAdditionType || card.additionType || '').trim().toUpperCase() === 'ANCHOR')
      || cards[0];
    return anchor ? { ...anchor, position: Number(spot.position) } : null;
  }).filter(Boolean);
}

function linearOverlayProfileForCustomMapping(mapping = null) {
  if (!mapping?.spots?.length) return null;
  if (isVendettaSplitCustomMapping(mapping)) return RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_9;
  const anchors = customMappingAnchorRows(mapping);
  if ([24, 25].includes(anchors.length) && anchors.every(card => String(card.set_code || '').toUpperCase() === 'OGN')) return RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_8;
  if ([24, 25].includes(anchors.filter(card => String(card.set_code || '').toUpperCase() === 'OGN').length) && mapping.spots.every(spot => /^\[(OGN|SFD)\] /.test(String(spot.label || ''))) && anchors.every(card => ['OGN', 'SFD'].includes(String(card.set_code || '').toUpperCase())) && anchors.some(card => card.set_code === 'OGN') && anchors.some(card => card.set_code === 'SFD')) return RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_2;
  if (isVendettaBoardOne(anchors)) return RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_1;
  if (isUnleashedBoardThreeBreakBoard(anchors)) return RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_3;
  if (isUnleashedFullCaseBreakBoard(anchors)) return RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_5;
  if (isSpiritforgedExpandedBreakBoard(anchors)) return RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_6;
  if (isUnleashedExpandedBreakBoard(anchors)) return RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_7;
  return null;
}

function linearOverlayProfileForPresetSlot(value) {
  const slot = Number(value) || 0;
  if (slot === 1) return RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_1;
  if (slot === 2) return RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_2;
  if (slot === 8) return RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_8;
  if (slot === 3) return RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_3;
  if (slot === 4) return RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_4;
  if (slot === 5) return RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_5;
  if (slot === 6) return RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_6;
  if (slot === 7) return RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_7;
  if (slot === 9) return RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_9;
  if (slot === 10) return RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_10;
  return null;
}

function linearOverlayProfileForEntry(entry = {}) {
  const profileId = String(entry.linearOverlayProfile || '');
  const known = Object.values(RIFTBOUND_LINEAR_OVERLAY_PROFILES).find(profile => profile.id === profileId);
  if (known) return known;
  if (entry.spotType === 'SPIRITFORGED_EXPANDED') return RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_6;
  if (entry.spotType === 'UNLEASHED_EXPANDED') return RIFTBOUND_LINEAR_OVERLAY_PROFILES.BOARD_7;
  return null;
}

function overlayPreviewCards(cards = [], profile = null) {
  const list = Array.isArray(cards) ? cards.filter(Boolean) : [];
  return list.slice(0, profile ? 1 : 2);
}

function applyLinearOverlayProfileToCard(card = null, profile = null) {
  const bundle = card?.spot_bundle;
  if (!profile || !bundle || !Array.isArray(bundle.cards) || !bundle.cards.length) return card;
  const lead = overlayPreviewCards(bundle.cards, profile)[0];
  if (!lead) return card;
  return {
    ...card,
    spot_bundle: {
      ...bundle,
      kind: profile.bundleKind || bundle.kind,
      preview_title: profile.previewTitle || bundle.preview_title,
      cards: [{ ...lead, bundle_role: 'primary' }]
    }
  };
}

module.exports = {
  RIFTBOUND_LINEAR_OVERLAY_PROFILES,
  applyLinearOverlayProfileToCard,
  customMappingAnchorRows,
  linearOverlayProfileForCustomMapping,
  linearOverlayProfileForEntry,
  linearOverlayProfileForPresetSlot,
  overlayPreviewCards
};
