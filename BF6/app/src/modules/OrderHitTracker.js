const { lookupOpenRiftPrinting } = require('./OpenRiftPrintingIndex');

const RIFTBOUND_SET_NAMES = Object.freeze({
  OGN: 'Origins',
  OGS: 'Origins - Proving Grounds',
  SFD: 'Spiritforged',
  UNL: 'Unleashed',
  VEN: 'Vendetta'
});

const RIFTBOUND_BASE_CARD_COUNTS = Object.freeze({
  OGN: 298,
  OGS: 24,
  SFD: 221,
  UNL: 219,
  VEN: 166
});

const ONE_PIECE_CATEGORIES = Object.freeze([
  Object.freeze({ key: 'MANGA', label: 'Manga' }),
  Object.freeze({ key: 'SP_GOLD', label: 'SP Gold' }),
  Object.freeze({ key: 'SP', label: 'SP' }),
  Object.freeze({ key: 'SEC_AA', label: 'SEC AA' }),
  Object.freeze({ key: 'L_AA', label: 'L AA' }),
  Object.freeze({ key: 'SR_AA', label: 'SR AA' }),
  Object.freeze({ key: 'R_AA', label: 'R AA' }),
  Object.freeze({ key: 'AA', label: 'Alternate Art' }),
  Object.freeze({ key: 'TR', label: 'Treasure Rare' }),
  Object.freeze({ key: 'GOLD_DON', label: 'Gold DON!!' }),
  Object.freeze({ key: 'SEC', label: 'Secret Rare' })
]);

const RIFTBOUND_CATEGORIES = Object.freeze([
  Object.freeze({ key: 'SIGNATURE', label: 'Signature' }),
  Object.freeze({ key: 'OVERNUMBERED', label: 'Overnumbered' }),
  Object.freeze({ key: 'SP', label: 'SP / Special' }),
  Object.freeze({ key: 'ALT_ART', label: 'Alt Art / Showcase' }),
  Object.freeze({ key: 'ULTIMATE', label: 'Ultimate' }),
  Object.freeze({ key: 'EPIC', label: 'Epic' })
]);

// The visual Top Hits overlay is intentionally narrower than the general
// classifier. It shows only the treatments requested for the live showcase;
// plain Epics, Ultimates, Mangas, Treasure Rares, Secrets, and DON!! cards stay
// out of this presentation even if another report considers them noteworthy.
const VISUAL_TOP_HIT_CATEGORY_KEYS = Object.freeze({
  RIFTBOUND: Object.freeze(['SIGNATURE', 'OVERNUMBERED', 'SP', 'ALT_ART']),
  ONEPIECE: Object.freeze(['SP_GOLD', 'SP', 'SEC_AA', 'L_AA', 'SR_AA', 'R_AA', 'AA'])
});

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function upper(value) {
  return clean(value).toUpperCase();
}

function gameCodeForCard(card = {}) {
  const number = upper(card.card_number || card.cardNumber || card.code);
  if (/\b(?:OGN|OGS|SFD|UNL|VEN)(?:[-\s]|$)/.test(number)) return 'RIFTBOUND';
  const explicit = upper(card.game_code || card.gameCode);
  if (explicit === 'RIFTBOUND') return 'RIFTBOUND';
  if (explicit === 'ONEPIECE' || explicit === 'ONE PIECE') return 'ONEPIECE';
  const identity = upper(`${card.set_code || card.setCode || ''} ${number}`);
  if (/\b(?:OGN|OGS|SFD|UNL|VEN)(?:[-\s]|$)/.test(identity)) return 'RIFTBOUND';
  return 'ONEPIECE';
}

function canonicalOnePieceSetCode(value) {
  const raw = upper(value).replace(/\s+/g, '');
  const match = raw.match(/^(OP|ST|EB|PRB|EX|P)-?(\d{1,3})$/);
  if (!match) return raw;
  return `${match[1]}-${match[2].padStart(2, '0')}`;
}

function setCodeForCard(card = {}, gameCode = gameCodeForCard(card)) {
  const explicit = upper(card.set_code || card.setCode);
  const number = upper(card.card_number || card.cardNumber || card.code);
  if (gameCode === 'RIFTBOUND') {
    const numberSetCode = number.match(/\b(OGN|OGS|SFD|UNL|VEN)(?:-|\s)/)?.[1];
    if (numberSetCode) return numberSetCode;
    if (RIFTBOUND_SET_NAMES[explicit]) return explicit;
    return explicit || 'RIFTBOUND';
  }
  const fromExplicit = canonicalOnePieceSetCode(explicit);
  if (fromExplicit) return fromExplicit;
  const match = number.match(/\b(OP|ST|EB|PRB|EX)(\d{1,3})-/);
  return match ? `${match[1]}-${match[2].padStart(2, '0')}` : 'ONE PIECE';
}

function setNameForCard(card = {}, gameCode = gameCodeForCard(card), setCode = setCodeForCard(card, gameCode)) {
  const explicit = clean(card.set_name || card.setName || card.product_name || card.productName);
  if (gameCode === 'RIFTBOUND') return RIFTBOUND_SET_NAMES[setCode] || explicit || setCode;
  return explicit || setCode;
}

function categoryDefinitions(gameCode) {
  return gameCode === 'RIFTBOUND' ? RIFTBOUND_CATEGORIES : ONE_PIECE_CATEGORIES;
}

function categoryResult(gameCode, key) {
  const definition = categoryDefinitions(gameCode).find(item => item.key === key);
  return definition ? { categoryKey: definition.key, categoryLabel: definition.label } : null;
}

function isRiftboundSpecialCollectorNumber(value) {
  const number = upper(value).replace(/[·\s]+/g, '-');
  return /(?:^|-)SP\d+(?:\/\d+)?(?:-|$)/.test(number);
}

function riftboundCollectorNumberInfo(value, fallbackSetCode = '') {
  const raw = upper(value).replace(/\s+/g, '-');
  const setCode = raw.match(/^(OGN|OGS|SFD|UNL|VEN)-/)?.[1]
    || upper(fallbackSetCode);
  const body = raw.replace(/^(?:OGN|OGS|SFD|UNL|VEN)-/, '');
  const signature = body.match(/^(\d+)(?:\*|★|☆|-STAR)(?:\/(\d+))?$/);
  const standard = body.match(/^(\d+)([A-Z]?)(?:\/(\d+))?$/);
  const match = signature || standard;
  if (!match) return null;
  const numerator = Number(match[1]);
  const denominator = Number(match[signature ? 2 : 3] || RIFTBOUND_BASE_CARD_COUNTS[setCode] || 0);
  if (!numerator || !denominator) return null;
  const hasSignatureStar = Boolean(signature);
  const isAboveSetTotal = numerator > denominator;
  return {
    raw,
    setCode,
    numerator,
    denominator,
    hasSignatureStar,
    isSignature: hasSignatureStar && isAboveSetTotal,
    isOvernumbered: !hasSignatureStar && isAboveSetTotal
  };
}

function riftboundCategory(card = {}) {
  const number = upper(card.card_number || card.cardNumber || card.code);
  const specialNumber = isRiftboundSpecialCollectorNumber(number);
  const printing = lookupOpenRiftPrinting(number, card.set_code || card.setCode);
  if (printing) {
    const details = {
      rarityLabel: printing.rarity,
      collectorTreatment: printing.collectorTreatment,
      collectorTreatmentLabel: printing.collectorTreatments.join(' · '),
      raritySource: printing.source
    };
    if (specialNumber) return { ...categoryResult('RIFTBOUND', 'SP'), ...details };
    if (printing.signed) return { ...categoryResult('RIFTBOUND', 'SIGNATURE'), ...details };
    if (printing.artVariant === 'Overnumbered') return { ...categoryResult('RIFTBOUND', 'OVERNUMBERED'), ...details };
    if (printing.artVariant === 'Ultimate') return { ...categoryResult('RIFTBOUND', 'ULTIMATE'), ...details };
    if (printing.artVariant === 'Alternate Art' || printing.rarity === 'Showcase') return { ...categoryResult('RIFTBOUND', 'ALT_ART'), ...details };
    if (printing.rarity === 'Epic') return { ...categoryResult('RIFTBOUND', 'EPIC'), ...details };
    return null;
  }

  // Future SP-numbered Riftbound cards must still reach Buyer Bag, Pull
  // History, and Box Tracker before the bundled printing index is refreshed.
  // The explicit SP collector-number namespace is sufficient identification;
  // ordinary archived rarity words remain intentionally ignored.
  if (specialNumber) return {
    ...categoryResult('RIFTBOUND', 'SP'),
    rarityLabel: clean(card.rarity) || 'Showcase',
    collectorTreatment: 'SP',
    collectorTreatmentLabel: 'SP',
    raritySource: 'Riftbound SP collector number'
  };

  // A missing lookup is not guessed from archived rarity/treatment labels.
  // The exact collector number must exist in the bundled OpenRift index.
  return null;
}

function onePieceCategory(card = {}) {
  const identity = upper([
    card.break_rarity,
    card.rarity,
    card.variant,
    card.manual_category,
    card.source_rarity
  ].filter(Boolean).join(' '));
  if (/\bMANGA\b/.test(identity)) return categoryResult('ONEPIECE', 'MANGA');
  if (/\bSP\s*GOLD\b|\bGOLD\s*SP\b/.test(identity)) return categoryResult('ONEPIECE', 'SP_GOLD');
  if (/\bSEC\s*AA\b|SECRET RARE ALTERNATE ART/.test(identity)) return categoryResult('ONEPIECE', 'SEC_AA');
  if (/\bL\s*AA\b|LEADER ALTERNATE ART/.test(identity)) return categoryResult('ONEPIECE', 'L_AA');
  if (/\bSR\s*AA\b|SUPER RARE ALTERNATE ART/.test(identity)) return categoryResult('ONEPIECE', 'SR_AA');
  if (/\bR\s*AA\b|RARE ALTERNATE ART/.test(identity)) return categoryResult('ONEPIECE', 'R_AA');
  if (/\bALTERNATE ART\b|\bALT ART\b|(?:^|\s)AA(?:\s|$)/.test(identity)) return categoryResult('ONEPIECE', 'AA');
  if (/\bSP\b|\bSPECIAL\b/.test(identity)) return categoryResult('ONEPIECE', 'SP');
  if (/\bTR\b|TREASURE RARE/.test(identity)) return categoryResult('ONEPIECE', 'TR');
  if (/GOLD DON/.test(identity)) return categoryResult('ONEPIECE', 'GOLD_DON');
  if (/\bSEC\b|SECRET RARE/.test(identity)) return categoryResult('ONEPIECE', 'SEC');
  return null;
}

function classifyMajorHit(card = {}) {
  const gameCode = gameCodeForCard(card);
  const category = gameCode === 'RIFTBOUND' ? riftboundCategory(card) : onePieceCategory(card);
  if (!category) return null;
  const setCode = setCodeForCard(card, gameCode);
  return {
    gameCode,
    gameName: gameCode === 'RIFTBOUND' ? 'Riftbound' : 'One Piece Card Game',
    setCode,
    setName: setNameForCard(card, gameCode, setCode),
    ...category
  };
}

function isVisualTopHitClassification(classification = {}) {
  const gameCode = upper(classification.gameCode || classification.game_code);
  const categoryKey = upper(classification.categoryKey || classification.hit_category);
  return Boolean(categoryKey && (VISUAL_TOP_HIT_CATEGORY_KEYS[gameCode] || []).includes(categoryKey));
}

function combinedVisualRecentHits(rows = [], gameCode = 'RIFTBOUND') {
  const wantedGame = upper(gameCode) || 'RIFTBOUND';
  return (Array.isArray(rows) ? rows : []).filter(row => (
    upper(row.gameCode || row.game_code) === wantedGame
    && isVisualTopHitClassification(row)
  ));
}

function setKey(gameCode, setCode) {
  return `${upper(gameCode) || 'ONEPIECE'}:${upper(setCode) || 'UNKNOWN'}`;
}

function setHintFromHistoryTitle(value) {
  const title = upper(value);
  const onePiece = title.match(/\bOP[\s-]?(\d{1,3})\b/);
  if (onePiece) return { gameCode: 'ONEPIECE', setCode: `OP-${onePiece[1].padStart(2, '0')}` };
  if (/\bUNLEASH(?:ED)?\b|\bUNL\b/.test(title)) return { gameCode: 'RIFTBOUND', setCode: 'UNL' };
  if (/\bVENDETTA\b|\bVEN\b/.test(title)) return { gameCode: 'RIFTBOUND', setCode: 'VEN' };
  if (/\bSPIRIT\s*FORGED\b|\bSFD\b/.test(title)) return { gameCode: 'RIFTBOUND', setCode: 'SFD' };
  if (/\bPROVING\s*GROUNDS\b|\bOGS\b/.test(title)) return { gameCode: 'RIFTBOUND', setCode: 'OGS' };
  if (/\bORIGINS?\b|\bOGN\b/.test(title)) return { gameCode: 'RIFTBOUND', setCode: 'OGN' };
  return null;
}

module.exports = {
  ONE_PIECE_CATEGORIES,
  RIFTBOUND_CATEGORIES,
  RIFTBOUND_BASE_CARD_COUNTS,
  RIFTBOUND_SET_NAMES,
  VISUAL_TOP_HIT_CATEGORY_KEYS,
  categoryDefinitions,
  classifyMajorHit,
  combinedVisualRecentHits,
  gameCodeForCard,
  isRiftboundSpecialCollectorNumber,
  isVisualTopHitClassification,
  riftboundCollectorNumberInfo,
  setCodeForCard,
  setHintFromHistoryTitle,
  setKey,
  setNameForCard
};
