'use strict';

const { OPENRIFT_CATALOG_URL, openRiftPrintingKey } = require('./OpenRiftPrintingIndex');

const OPENRIFT_ORIGIN = 'https://openrift.app';
const SUPPORTED_SET_CODES = Object.freeze(['OGN', 'OGS', 'SFD', 'UNL', 'VEN']);
const SUPPORTED_SET_CODE_SET = new Set(SUPPORTED_SET_CODES);

function clean(value) {
  return String(value ?? '').trim();
}

function openRiftImageUrl(imageId, size = 'full') {
  const id = clean(imageId).toLowerCase();
  const normalizedSize = size === '120w' || size === '400w' ? size : 'full';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) return '';
  return `${OPENRIFT_ORIGIN}/media/cards/${id.slice(-2)}/${id}-${normalizedSize}.webp`;
}

function frontImageId(printing) {
  const images = Array.isArray(printing?.images) ? printing.images : [];
  return clean(images.find(image => clean(image?.face).toLowerCase() === 'front')?.imageId || images[0]?.imageId);
}

function candidateRank(printing) {
  const rank = Number(printing?.canonicalRank);
  const normalFinish = clean(printing?.finish).toLowerCase() === 'normal' ? 0 : 1;
  return [Number.isFinite(rank) ? rank : Number.MAX_SAFE_INTEGER, normalFinish];
}

function isPreferredCandidate(next, current) {
  if (!current) return true;
  const nextRank = candidateRank(next.printing);
  const currentRank = candidateRank(current.printing);
  return nextRank[0] < currentRank[0]
    || (nextRank[0] === currentRank[0] && nextRank[1] < currentRank[1]);
}

function buildOpenRiftImageIndex(payload) {
  const setById = new Map((Array.isArray(payload?.sets) ? payload.sets : [])
    .map(set => [clean(set?.id), clean(set?.slug).toUpperCase()])
    .filter(([id, code]) => id && SUPPORTED_SET_CODE_SET.has(code)));
  const printings = payload?.printings && typeof payload.printings === 'object' ? payload.printings : {};
  const index = new Map();

  for (const [printingId, printing] of Object.entries(printings)) {
    const setCode = setById.get(clean(printing?.setId));
    if (!setCode || clean(printing?.language).toUpperCase() !== 'EN') continue;
    const collectorKey = openRiftPrintingKey(printing?.publicCode || printing?.shortCode, setCode);
    if (!collectorKey || !collectorKey.startsWith(`${setCode}-`)) continue;
    const imageId = frontImageId(printing);
    const imageUrl = openRiftImageUrl(imageId);
    if (!imageUrl) continue;
    const candidate = {
      collectorKey,
      setCode,
      printingId,
      publicCode: clean(printing?.publicCode),
      printedName: clean(printing?.printedName),
      imageId,
      imageUrl,
      sourceUrl: OPENRIFT_CATALOG_URL,
      printing
    };
    if (isPreferredCandidate(candidate, index.get(collectorKey))) index.set(collectorKey, candidate);
  }
  return index;
}

function lookupOpenRiftImage(index, collectorNumber, fallbackSetCode = '') {
  if (!(index instanceof Map)) return null;
  const key = openRiftPrintingKey(collectorNumber, fallbackSetCode);
  return key ? (index.get(key) || null) : null;
}

function isOpenRiftCardImageUrl(value) {
  try {
    const url = new URL(clean(value));
    return url.protocol === 'https:'
      && url.hostname.toLowerCase() === 'openrift.app'
      && /^\/media\/cards\/[0-9a-f]{2}\/[0-9a-f-]+-(?:full|400w|120w)\.webp$/i.test(url.pathname);
  } catch {
    return false;
  }
}

module.exports = {
  OPENRIFT_ORIGIN,
  SUPPORTED_SET_CODES,
  buildOpenRiftImageIndex,
  isOpenRiftCardImageUrl,
  lookupOpenRiftImage,
  openRiftImageUrl
};
