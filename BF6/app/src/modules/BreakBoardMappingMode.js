'use strict';

const BREAK_BOARD_MAPPING_MODES = Object.freeze({
  MAPPED: 'MAPPED',
  SINGLES: 'SINGLES'
});

function isBreakBoardMappingMode(value) {
  return Object.values(BREAK_BOARD_MAPPING_MODES).includes(String(value || '').trim().toUpperCase());
}

function normalizeBreakBoardMappingMode(value, fallback = BREAK_BOARD_MAPPING_MODES.MAPPED) {
  const normalized = String(value || '').trim().toUpperCase();
  if (isBreakBoardMappingMode(normalized)) return normalized;
  return isBreakBoardMappingMode(fallback) ? String(fallback).trim().toUpperCase() : BREAK_BOARD_MAPPING_MODES.MAPPED;
}

function exactRiftboundSingleLabel(card = {}) {
  const name = String(card.name || 'Riftbound card').trim();
  const cardNumber = String(card.card_number || '').trim();
  const treatment = [card.collector_treatment, card.manual_category, card.variant]
    .map(value => String(value || '').trim())
    .find(value => value && value.toLowerCase() !== 'standard') || '';
  const normalizedName = name.toLowerCase();
  const parts = [name, cardNumber];
  if (treatment && !normalizedName.includes(treatment.toLowerCase())) parts.push(treatment);
  return parts.filter(Boolean).join(' · ');
}

function decorateRiftboundSinglesBoard(boardRows = []) {
  return (Array.isArray(boardRows) ? boardRows : []).map(card => {
    if (String(card.game_code || '').trim().toUpperCase() !== 'RIFTBOUND') return card;
    return {
      ...card,
      break_spot_label: exactRiftboundSingleLabel(card),
      break_spot_key: `RIFTBOUND_SINGLE_${Number(card.position || 0) || Number(card.id || 0)}`,
      riftbound_single: true
    };
  });
}

function buildRiftboundSingleSpot(boardAnchor = {}) {
  const exactCard = { ...boardAnchor };
  const label = exactRiftboundSingleLabel(exactCard);
  const cardNumber = String(exactCard.card_number || '').trim();
  return {
    profileId: 'RIFTBOUND_EXACT_SINGLE_V1',
    position: Number(exactCard.position || 0),
    key: `RIFTBOUND_SINGLE_${Number(exactCard.position || 0) || Number(exactCard.id || 0)}`,
    displayLabel: label,
    listingNote: label,
    color: '',
    domain: '',
    anchor: String(exactCard.name || ''),
    champions: [],
    poro: '',
    baron: false,
    family: [exactCard],
    heroCards: [exactCard],
    bundleGroups: [{
      key: `single-${Number(exactCard.id || 0)}`,
      label: String(exactCard.name || 'Exact single'),
      caption: cardNumber ? `Purchased position · exact printing ${cardNumber}` : 'Purchased position · exact card only',
      role: 'direct',
      cards: [exactCard]
    }]
  };
}

module.exports = {
  BREAK_BOARD_MAPPING_MODES,
  buildRiftboundSingleSpot,
  decorateRiftboundSinglesBoard,
  exactRiftboundSingleLabel,
  isBreakBoardMappingMode,
  normalizeBreakBoardMappingMode
};
