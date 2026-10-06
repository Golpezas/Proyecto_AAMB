(function exposePullHistoryBuyerMessage(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PullHistoryBuyerMessage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function pullHistoryBuyerMessageFactory() {
  const PRIORITY_SPEND_CENTS = 10000;
  const RIFTBOUND_SET_TOTALS = Object.freeze({ OGN: 298, OGS: 24, SFD: 221, UNL: 219, VEN: 166 });
  const RIFTBOUND_SET_NAMES = Object.freeze({ OGN: 'Origins', OGS: 'Origins', SFD: 'Spiritforged', UNL: 'Unleashed', VEN: 'Vendetta' });
  const MESSAGE_CLOSING = 'I truly appreciate your support!\n\n⭐⭐⭐⭐⭐';

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function breakLabel(batch = {}) {
    const savedBoxName = clean(batch.saved_box_name || batch.savedBoxName || batch.break_name || batch.breakName);
    if (savedBoxName) return savedBoxName;
    const setName = clean(batch.set_name || batch.setName).replace(/\s+break$/i, '');
    if (setName) return setName;
    const setCode = clean(batch.set_code || batch.setCode).toUpperCase();
    if (setCode && setCode !== 'MULTI') return setCode;
    const gameCode = clean(batch.game_code || batch.gameCode).toUpperCase();
    if (gameCode === 'RIFTBOUND') return 'Riftbound';
    if (gameCode === 'ONEPIECE' || gameCode === 'ONE PIECE') return 'One Piece';
    return 'Saved box';
  }

  function setLabel(item = {}, batch = {}) {
    const explicit = clean(item.message_set_name || item.messageSetName);
    if (explicit) return explicit;
    const itemSetName = clean(item.set_name || item.setName);
    if (itemSetName) return itemSetName;
    const itemSetCode = clean(item.set_code || item.setCode).toUpperCase();
    if (RIFTBOUND_SET_NAMES[itemSetCode]) return RIFTBOUND_SET_NAMES[itemSetCode];
    const batchSetName = clean(batch.set_name || batch.setName).replace(/\s+break$/i, '');
    if (batchSetName) return batchSetName;
    const batchSetCode = clean(batch.set_code || batch.setCode).toUpperCase();
    return RIFTBOUND_SET_NAMES[batchSetCode] || itemSetCode || batchSetCode;
  }

  function cardReference(item = {}) {
    const setCode = clean(item.set_code || item.setCode).toUpperCase();
    const cardNumber = clean(item.card_number || item.cardNumber);
    if (!cardNumber) return setCode;
    return /^[A-Z0-9]+-/i.test(cardNumber)
      ? cardNumber
      : [setCode, cardNumber].filter(Boolean).join(' ');
  }

  function isRiftboundOvernumbered(item = {}) {
    const setCode = clean(item.set_code || item.setCode).toUpperCase();
    const cardNumber = clean(item.card_number || item.cardNumber).toUpperCase();
    const detectedSet = cardNumber.match(/\b(OGN|OGS|SFD|UNL|VEN)-/)?.[1] || setCode;
    const total = RIFTBOUND_SET_TOTALS[detectedSet];
    const number = cardNumber.replace(/^(?:OGN|OGS|SFD|UNL|VEN)-/, '').match(/^(\d+)(?:[*★☆]|-STAR)?\/(\d+)$/);
    return Boolean(total && number && Number(number[1]) > Number(number[2] || total));
  }

  function hitType(item = {}) {
    const identity = clean([
      item.rarity,
      item.break_rarity || item.breakRarity,
      item.collector_treatment || item.collectorTreatment,
      item.variant_hint || item.variantHint,
      item.variant,
      item.manual_category || item.manualCategory,
      item.source_rarity || item.sourceRarity
    ].filter(Boolean).join(' ')).toUpperCase();
    if (isRiftboundOvernumbered(item) || /\bOVERNUMBERED\b|\bOVER[- ]?NUMBERED\b|\bON\b/.test(identity)) return { icon: '🔥', label: 'ON' };
    if (/\bSIGNATURE\b|\bSIGNED\b|\bAUTOGRAPH\b/.test(identity) || /[*★☆]/.test(clean(item.card_number || item.cardNumber))) return { icon: '💎', label: 'SIG' };
    if (/\bALTERNATE ART\b|\bALT ART\b|(?:^|\s)(?:SEC|SR|R|L)?\s*AA(?:\s|$)/.test(identity)) return { icon: '✨✨', label: 'AA' };
    if (/\bSHOWCASE\b/.test(identity)) return { icon: '✨✨', label: 'Showcase' };
    if (/\bULTIMATE\b/.test(identity)) return { icon: '☠️', label: 'Ultimate' };
    if (/\bSP\b|\bSPECIAL\b/.test(identity) || /(?:^|-)SP\d+(?:\/|$)/.test(clean(item.card_number || item.cardNumber).toUpperCase())) return { icon: '⭐', label: 'SP' };
    if (/\bPROMO\b|\bPROMOTIONAL\b/.test(identity)) return { icon: '⭐', label: 'Promo' };
    if (/\bMANGA\b/.test(identity)) return { icon: '✨', label: 'Manga' };
    if (/\bTREASURE RARE\b/.test(identity)) return { icon: '✨', label: 'TR' };
    if (/GOLD DON/.test(identity)) return { icon: '✨', label: 'Gold DON' };
    return { icon: '✨', label: clean(item.collector_treatment || item.collectorTreatment || item.rarity) || 'Hit' };
  }

  function isPremiumHit(item = {}) {
    const identity = clean([
      item.rarity,
      item.break_rarity || item.breakRarity,
      item.collector_treatment || item.collectorTreatment,
      item.variant_hint || item.variantHint,
      item.variant,
      item.manual_category || item.manualCategory,
      item.source_rarity || item.sourceRarity
    ].filter(Boolean).join(' ')).toUpperCase();
    if (/\b(?:SIGNATURE|SIGNED|AUTOGRAPH|OVERNUMBERED|OVER[- ]?NUMBERED|ULTIMATE|SHOWCASE|ALTERNATE ART|ALT ART|PROMO|PROMOTIONAL|SP|SPECIAL|MANGA|TREASURE RARE)\b|GOLD DON/.test(identity)) return true;
    if (/(?:^|\s)(?:SEC|SR|R|L)?\s*AA(?:\s|$)/.test(identity)) return true;
    const cardNumber = clean(item.card_number || item.cardNumber).toUpperCase();
    if (/(?:^|-)SP\d+(?:\/|$)/.test(cardNumber)) return true;
    if (/[*★☆]|(?:^|-)STAR(?:\/|$)/.test(cardNumber)) return true;
    return isRiftboundOvernumbered(item);
  }

  function cardLine(item = {}, fallbackBatch = {}) {
    const batch = item.message_batch || item.messageBatch || fallbackBatch || {};
    const name = clean(item.card_name || item.cardName) || 'Unnamed card';
    const type = hitType(item);
    const reference = cardReference(item);
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
    // Buyer messages stay compact: card name, hit rarity/treatment, and the
    // set/card number reference only. Break names, full set names, spot
    // numbers, and other source metadata remain in Pool History but are not
    // repeated in the message.
    return `${type.icon} ${name} - ${type.label}${reference ? ` - ${reference}` : ''}${quantity > 1 ? ` - ×${quantity}` : ''}`;
  }

  function buyerHandle(value) {
    const handle = clean(value).replace(/^@+/, '');
    return handle ? `@${handle}` : '';
  }

  function isPriorityBuyer(buyer = {}, items = []) {
    const spentOverOneHundred = Number(buyer.paid_cents ?? buyer.paidCents ?? 0) > PRIORITY_SPEND_CENTS;
    return spentOverOneHundred || (Array.isArray(items) && items.some(isPremiumHit));
  }

  function topHitsOnly(items = []) {
    return (Array.isArray(items) ? items : []).filter(isPremiumHit);
  }

  function hitCount(items = []) {
    return topHitsOnly(items).reduce((total, item) => total + Math.max(1, Math.floor(Number(item.quantity) || 1)), 0);
  }

  function build({ batch = {}, buyer = {}, items = [] } = {}) {
    const pulls = topHitsOnly(items);
    if (!pulls.length) return '';
    const handle = buyerHandle(buyer.buyer_name || buyer.buyerName || pulls[0]?.buyer_name || pulls[0]?.buyerName);
    const count = hitCount(pulls);
    const heading = `${handle || 'Buyer'} - You got ${count} hit${count === 1 ? '' : 's'}!`;
    return `${heading}\n\n${pulls.map(item => cardLine(item, batch)).join('\n')}\n\n${MESSAGE_CLOSING}`;
  }

  return Object.freeze({ PRIORITY_SPEND_CENTS, MESSAGE_CLOSING, breakLabel, build, buyerHandle, cardLine, cardReference, hitCount, hitType, isPremiumHit, isPriorityBuyer, isRiftboundOvernumbered, setLabel, topHitsOnly });
});
