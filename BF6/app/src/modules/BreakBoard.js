const {
  poroMapping,
  originsChampionForCard,
  originsSpotLabel,
  originsSpotMapping,
  spiritforgedSpotLabel,
  spiritforgedSpotMapping,
  vendettaSpotLabel,
  vendettaSpotMapping
} = require('./RiftboundChampionAudit');
const { lookupOpenRiftPrinting } = require('./OpenRiftPrintingIndex');

const WHATNOT_BREAK_DESCRIPTION = 'You are bidding for this character spot. You will receive this card if it is pulled from the OP-16 booster box during the live stream. Your spot does not guarantee this card; it must be pulled from the box live. If this card is not pulled from the box during the live stream, you will receive a random R, UC, or C card. Each break is for one booster box only. This spot does not carry over to future booster box breaks.';
const RIFTBOUND_BREAK_DESCRIPTION = 'You are bidding on the displayed Riftbound spot for this break only. Exact-card spots receive only the exact collector number and finish shown. Champion spots receive all matching mapped champion cards pulled. Mapped color/domain bundles receive the cards stated in their spot name. If no matching card is pulled, the buyer receives a random fallback card from the same box. Every purchase receives at least one card. No specific rarity or value is guaranteed.';
const MAX_BREAK_DESCRIPTION_LENGTH = 2000;
const RIFTBOUND_LISTING_SYMBOLS = new Set(['💎', '🔥', '💣', '⭐', '⚡', '🌹', '💀', '💗', '🚧']);

function normalizeBreakDescription(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, MAX_BREAK_DESCRIPTION_LENGTH);
}

function vendettaListingSpotName(card = {}) {
  if (String(card.set_code || '').trim().toUpperCase() !== 'VEN') return '';
  // Saved exact-card maps (including the 33-spot Board 1) own their public
  // titles. The legacy 16-spot Vendetta pairs are only for unmapped boards.
  if (card.custom_break_mapping) return '';
  // Exact-card Singles (including Vendetta Board 10) must keep their precise
  // collector number instead of inheriting a mapped champion-family title.
  if (card.riftbound_single) return '';
  const publicName = String(card.name || '').split(',')[0].trim();
  const mapping = vendettaSpotMapping(publicName, 'VEN');
  if (!mapping) return '';
  return mapping.kind === 'named'
    ? vendettaSpotLabel(mapping)
    : [...mapping.champions, ...(mapping.rune ? [mapping.rune] : [])].join(' + ');
}

function decorateBreakBoardListingNames(cards = []) {
  return (Array.isArray(cards) ? cards : []).map(card => {
    const listingName = vendettaListingSpotName(card);
    return listingName ? { ...card, break_spot_label: listingName } : card;
  });
}

function riftboundSpotName(card = {}) {
  // Vendetta Whatnot listing names advertise the champions plus the owned
  // Showcase Rune. Buyer Bags retain the complete chase/domain visualization.
  const vendettaListingName = vendettaListingSpotName(card);
  if (vendettaListingName) return vendettaListingName;
  // Custom profiles provide their complete public label first. Other
  // Riftbound boards continue to use champion/chase names: `Jhin, Virtuoso`
  // becomes `Jhin`, while mapped Poro spots describe the complete bundle.
  const mappedBoardLabel = String(card.break_spot_label || '').trim();
  if (mappedBoardLabel) return mappedBoardLabel;
  const publicName = String(card.name || 'Untitled card').split(',')[0].trim() || 'Untitled card';
  if (String(card.set_code || '').trim().toUpperCase() === 'OGN') {
    const originsChampion = originsChampionForCard(card);
    if (originsChampion) return originsChampion;
    const originsSpot = originsSpotMapping(String(card.name || '').trim(), 'OGN') || originsSpotMapping(publicName, 'OGN');
    if (originsSpot) return originsSpotLabel(originsSpot);
  }
  const pair = poroMapping(publicName, card.set_code);
  if (pair) return `${pair.poro} + ${pair.mappedCard} + ${pair.rune}`;
  const vendettaSpot = String(card.set_code || '').trim().toUpperCase() === 'VEN'
    ? vendettaSpotMapping(publicName, 'VEN')
    : null;
  if (vendettaSpot) return vendettaSpotLabel(vendettaSpot);
  const spiritforgedSpot = String(card.set_code || '').trim().toUpperCase() === 'SFD'
    ? (spiritforgedSpotMapping(String(card.name || '').trim(), 'SFD') || spiritforgedSpotMapping(publicName, 'SFD'))
    : null;
  return spiritforgedSpot ? spiritforgedSpotLabel(spiritforgedSpot) : publicName;
}

function riftboundFirstCardListingSymbol(card = {}) {
  if (card.break_listing_symbol_suppressed) return '';
  const explicit = String(card.break_listing_symbol || '').trim();
  if (RIFTBOUND_LISTING_SYMBOLS.has(explicit)) return explicit;
  const treatment = String(card.collector_treatment || card.variant || card.manual_category || '').trim().toUpperCase();
  if (treatment === 'SIGNATURE') return '💎';
  const artVariant = String(card.riftbound_art_variant || card.art_variant || card.artVariant || '').trim().toUpperCase();
  const printing = lookupOpenRiftPrinting(card.card_number || card.cardNumber, card.set_code || card.setCode);
  const rarity = String(card.break_rarity || card.rarity || card.source_rarity || '').trim().toUpperCase();
  const ultimate = artVariant === 'ULTIMATE'
    || String(printing?.artVariant || '').toUpperCase() === 'ULTIMATE'
    || treatment === 'ULTIMATE'
    || (rarity === 'ULTIMATE' && treatment !== 'OVERNUMBERED');
  if (ultimate) return '💀';
  if (treatment === 'OVERNUMBERED') return '🔥';
  if (['ALTERNATE ART', 'ALT ART', 'SHOWCASE'].includes(treatment)) return '💣';
  if (rarity === 'EPIC') return '⭐';
  if (rarity === 'RARE') return '⚡';
  return rarity === 'SHOWCASE' ? '💣' : '';
}

function decorateRiftboundListingTitle(card = {}, title = '') {
  // A saved bundle label can contain symbols inherited from included cards.
  // Copy Listing deliberately ignores those cards: only the first/anchor card
  // chooses one matching symbol, placed once at each edge of the title.
  const normalizedTitle = String(title || 'Untitled card')
    .replace(/💗/gu, '⭐')
    .replace(/🚧/gu, '⚡')
    .replace(/\s+/g, ' ')
    .trim() || 'Untitled card';
  // Saved mapped combo labels intentionally carry per-name icons. Preserve
  // those exact icons so mixed-rarity Copy Listing titles stay readable.
  if (card.custom_break_mapping && /[💎🔥💣⭐⚡🌹💀]/u.test(normalizedTitle)) return normalizedTitle;
  const cleanTitle = normalizedTitle.replace(/[💎🔥💣⭐⚡🌹💀]/gu, ' ').replace(/\s+/g, ' ').trim() || 'Untitled card';
  const symbol = riftboundFirstCardListingSymbol(card);
  return symbol ? `${symbol} ${cleanTitle} ${symbol}` : cleanTitle;
}

function listingLine(card, fallbackPosition) {
  // A Whatnot listing must always be continuous. The database also compacts
  // the working board before Copy Listing/Save Board, but this protects copied
  // text if a legacy board with an old position gap is ever encountered.
  const position = fallbackPosition;
  if (String(card.game_code || '').toUpperCase() === 'RIFTBOUND') {
    return `${position} — ${decorateRiftboundListingTitle(card, riftboundSpotName(card))}`;
  }
  const rarity = card.break_rarity || card.rarity;
  const treatment = String(card.collector_treatment || '').trim();
  return `${position} — ${String(card.name || 'Untitled card')}${rarity ? ` ${rarity}` : ''}${treatment ? ` ${treatment.toUpperCase()}` : ''}`;
}

function formatBreakBoardListing(cards, descriptions = {}) {
  const ordered = [...(Array.isArray(cards) ? cards : [])]
    .sort((left, right) => Number(left.position || 0) - Number(right.position || 0));
  if (!ordered.length) return '';
  return ordered.map((card, index) => {
    const gameCode = String(card.game_code || '').toUpperCase() === 'RIFTBOUND' ? 'RIFTBOUND' : 'ONEPIECE';
    const defaultDescription = gameCode === 'RIFTBOUND' ? RIFTBOUND_BREAK_DESCRIPTION : WHATNOT_BREAK_DESCRIPTION;
    const boardDescription = normalizeBreakDescription(card.break_listing_description);
    let description = boardDescription || normalizeBreakDescription(descriptions[gameCode]) || defaultDescription;
    const title = listingLine(card, index + 1);
    if (gameCode === 'RIFTBOUND' && /Seal of /i.test(title) && /Non-Champion/i.test(title)) {
      description += ' Includes the listed seal, its matching rune alternate art, and assigned Rare/Epic domain cards. Cards assigned to champion spots or other named spots are excluded.';
    }
    return `${listingLine(card, index + 1)}\t${description}`;
  }).join('\n');
}

module.exports = {
  MAX_BREAK_DESCRIPTION_LENGTH,
  RIFTBOUND_BREAK_DESCRIPTION,
  WHATNOT_BREAK_DESCRIPTION,
  decorateBreakBoardListingNames,
  decorateRiftboundListingTitle,
  formatBreakBoardListing,
  listingLine,
  normalizeBreakDescription,
  riftboundFirstCardListingSymbol,
  riftboundSpotName,
  vendettaListingSpotName
};
