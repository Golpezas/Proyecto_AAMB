const crypto = require('node:crypto');

const RIFTBOUND_GAME_CODE = 'RIFTBOUND';
const RIFTBOUND_GAME_NAME = 'Riftbound: League of Legends TCG';

const RIFTBOUND_SETS = Object.freeze([
  Object.freeze({
    setNumber: 1,
    setCode: 'OGN',
    setName: 'Origins',
    productName: 'Riftbound: League of Legends TCG — Origins Booster 6-Box Case',
    baseCardCount: 298
  }),
  Object.freeze({
    setNumber: 2,
    setCode: 'OGS',
    setName: 'Origins - Proving Grounds',
    productName: 'Riftbound: League of Legends TCG — Origins - Proving Grounds',
    baseCardCount: 24
  }),
  Object.freeze({
    setNumber: 3,
    setCode: 'SFD',
    setName: 'Spiritforged',
    productName: 'Riftbound: League of Legends TCG — Spiritforged Booster 6-Box Case',
    baseCardCount: 221
  }),
  Object.freeze({
    setNumber: 4,
    setCode: 'UNL',
    setName: 'Unleashed',
    productName: 'Riftbound: League of Legends TCG — Unleashed Booster 6-Box Case',
    baseCardCount: 219
  }),
  Object.freeze({
    setNumber: 5,
    setCode: 'VEN',
    setName: 'Vendetta',
    productName: 'Riftbound: League of Legends TCG — Vendetta Booster 6-Box Case',
    baseCardCount: 166
  })
]);

const SET_BY_CODE = new Map(RIFTBOUND_SETS.map(set => [set.setCode, set]));
const RIFTBOUND_TREATMENTS = Object.freeze(['Alternate Art', 'Overnumbered', 'Signature']);

function text(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(', ');
  if (value && typeof value === 'object') {
    return text(value.name || value.label || value.value || value.text || '');
  }
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function first(source, names) {
  for (const name of names) {
    const value = source?.[name];
    const populatedObject = value && typeof value === 'object' && Object.keys(value).length > 0;
    if (value !== undefined && value !== null && (populatedObject || text(value))) return value;
  }
  return '';
}

function galleryValues(value) {
  if (!value || typeof value !== 'object') return text(value);
  const candidates = value.values || (Array.isArray(value.type) ? value.type : null) || value.superType || value.value || value.tags;
  return text(candidates);
}

function galleryValueList(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  if (!value || typeof value !== 'object') return text(value) ? [text(value)] : [];
  const candidates = value.values || value.tags || value.type || value.superType || value.value;
  if (Array.isArray(candidates)) return candidates.map(text).filter(Boolean);
  const populated = text(candidates);
  return populated ? [populated] : [];
}

function riftboundCardType(source) {
  const value = first(source, ['cardType', 'card_type', 'type']);
  if (!value || typeof value !== 'object') return galleryValues(value);
  const labels = [
    ...galleryValueList(value.superType),
    ...galleryValueList(value.type || value.values || value.value)
  ];
  return [...new Set(labels.map(label => text(label)).filter(Boolean))].join(' ');
}

function riftboundDisplayName(source, cardType = riftboundCardType(source)) {
  const explicit = text(first(source, ['fullName', 'full_name', 'displayName', 'display_name']));
  const title = explicit || text(first(source, ['name', 'cardName', 'card_name', 'title']));
  // Riot's Champion Unit names are already complete (for example
  // "Akali, Deadly Weapon"). Legend records are the exception: the gallery
  // stores only "Rogue Assassin" in name and keeps "Akali" in tags.
  if (!title || explicit || !/\blegend\b/i.test(cardType)) return title;
  const champion = galleryValueList(source?.tags)[0] || text(first(source, ['champion', 'championName', 'champion_name']));
  const escapedChampion = champion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!champion || new RegExp(`^${escapedChampion}\\b`, 'i').test(title)) return title;
  return `${champion}, ${title}`;
}

function rulesText(value) {
  if (typeof value === 'string') return text(value.replace(/<[^>]+>/g, ' '));
  if (!value || typeof value !== 'object') return text(value);
  const html = value.richText?.body || value.body || value.html || value.text || '';
  return text(String(html).replace(/<[^>]+>/g, ' '));
}

function imageValue(source) {
  const art = source?.art;
  if (art && typeof art === 'object') {
    const candidate = text(art.fullURL || art.fullUrl || art.thumbnailURL || art.thumbnailUrl);
    if (candidate) return candidate;
  }
  const direct = first(source, ['image_url', 'imageUrl', 'cardImage', 'card_image', 'image', 'assetUrl', 'asset_url']);
  if (typeof direct === 'string') return direct;
  if (direct && typeof direct === 'object') {
    return text(direct.full || direct.large || direct.url || direct.src || direct.uri);
  }
  const assets = source?.assets;
  if (Array.isArray(assets)) {
    for (const asset of assets) {
      const candidate = text(asset?.full || asset?.large || asset?.url || asset?.src || asset?.uri);
      if (candidate) return candidate;
    }
  }
  const media = source?.media;
  if (Array.isArray(media)) {
    const preferred = media.find(item => /card|full|front/i.test(text(item?.type) + ' ' + text(item?.name))) || media[0];
    const candidate = text(preferred?.url || preferred?.src || preferred?.uri);
    if (candidate) return candidate;
  }
  return '';
}

function officialRiotUrl(value) {
  try {
    const url = new URL(text(value));
    const host = url.hostname.toLowerCase();
    const allowed = ['riotgames.com', 'rgpub.io', 'riotcdn.net', 'pvp.net'];
    return url.protocol === 'https:' && allowed.some(domain => host === domain || host.endsWith(`.${domain}`)) ? url.href : '';
  } catch {
    return '';
  }
}

function setCodeFrom(source) {
  const explicit = text(first(source, ['set_code', 'setCode', 'setAbbreviation', 'set_abbreviation', '_parentSetId'])).toUpperCase();
  if (SET_BY_CODE.has(explicit)) return explicit;
  const cardSet = text(source?.set).toUpperCase();
  if (SET_BY_CODE.has(cardSet)) return cardSet;
  const number = text(first(source, ['publicCode', 'card_number', 'cardNumber', 'collectorNumber', 'collector_number', 'number']));
  const prefix = number.match(/\b(OGN|OGS|SFD|UNL|VEN)\b/i)?.[1]?.toUpperCase();
  if (prefix) return prefix;
  const setName = text(first(source, ['set_name', 'setName', 'set', '_parentSetName'])).toLowerCase();
  return RIFTBOUND_SETS.find(set => set.setName.toLowerCase() === setName)?.setCode || '';
}

function normalizeRiftboundCollectorNumber(value, fallbackSetCode = '') {
  const raw = text(value).toUpperCase().replace(/\s+/g, '-');
  if (!raw) return '';
  const explicitSetCode = raw.match(/^(OGN|OGS|SFD|UNL|VEN)-/)?.[1] || '';
  const setCode = explicitSetCode || text(fallbackSetCode).toUpperCase();
  const body = explicitSetCode ? raw.slice(explicitSetCode.length + 1) : raw;
  const signature = body.match(/^(\d+)(?:\*|★|☆|-STAR)(?:\/(\d+))?$/);
  if (!signature || !setCode) return explicitSetCode ? raw : (setCode ? `${setCode}-${raw}` : raw);
  const set = SET_BY_CODE.get(setCode);
  const denominator = Number(signature[2] || set?.baseCardCount || 0);
  return `${setCode}-${signature[1]}*${denominator ? `/${denominator}` : ''}`;
}

function collectorNumberInfo(value, fallbackSetCode = '') {
  const number = normalizeRiftboundCollectorNumber(value, fallbackSetCode);
  const setCode = number.match(/^(OGN|OGS|SFD|UNL|VEN)-/)?.[1] || text(fallbackSetCode).toUpperCase();
  const body = number.replace(/^(?:OGN|OGS|SFD|UNL|VEN)-/, '');
  const signature = body.match(/^(\d+)\*(?:\/(\d+))?$/);
  const standard = body.match(/^(\d+)([A-Z]?)(?:\/(\d+))?$/);
  const match = signature || standard;
  if (!match) return null;
  const numerator = Number(match[1]);
  const denominator = Number(match[signature ? 2 : 3] || SET_BY_CODE.get(setCode)?.baseCardCount || 0);
  return {
    number,
    numerator,
    denominator,
    suffix: signature ? '*' : (standard?.[2] || ''),
    hasSignatureStar: Boolean(signature)
  };
}

function cardNumberFrom(source, setCode) {
  const raw = text(first(source, ['publicCode', 'card_number', 'cardNumber', 'collectorNumber', 'collector_number', 'number', 'code']));
  if (!raw) return '';
  if (/^(?:OGN|OGS|SFD|UNL|VEN)[-\s]/i.test(raw)) return normalizeRiftboundCollectorNumber(raw, setCode);
  return /^\d+(?:[a-z*★☆])?(?:-STAR)?(?:\/\d+)?$/i.test(raw) && setCode
    ? normalizeRiftboundCollectorNumber(raw, setCode)
    : raw;
}

function normalizeRiftboundTreatment(value) {
  const normalized = text(value).toLowerCase().replace(/[_-]+/g, ' ');
  if (/signature|signed/.test(normalized)) return 'Signature';
  if (/overnumber/.test(normalized)) return 'Overnumbered';
  if (/alternate|alt art|showcase/.test(normalized)) return 'Alternate Art';
  return '';
}

function riftboundCollectorTreatment(source, cardNumber, setCode) {
  const explicit = normalizeRiftboundTreatment(first(source, ['variant', 'treatment', 'finish', 'printing', 'style']));
  const number = collectorNumberInfo(cardNumber, setCode);
  if (number?.hasSignatureStar && number.numerator > number.denominator) return 'Signature';
  if (number?.numerator > number?.denominator) return 'Overnumbered';
  if (number?.suffix === 'A' || explicit === 'Alternate Art') return 'Alternate Art';
  // Signature and Overnumbered labels are not sufficient by themselves: the
  // printed collector number is the source of truth for those treatments.
  return '';
}

function normalizeRiftboundCard(source) {
  if (!source || typeof source !== 'object') return null;
  const setCode = setCodeFrom(source);
  const set = SET_BY_CODE.get(setCode);
  if (!set) return null;
  const cardType = riftboundCardType(source);
  const name = riftboundDisplayName(source, cardType);
  const cardNumber = cardNumberFrom(source, setCode);
  if (!name || !cardNumber) return null;
  const rarity = galleryValues(first(source, ['rarity', 'rarityName', 'rarity_name']));
  const variant = riftboundCollectorTreatment(source, cardNumber, setCode);
  const imageUrl = officialRiotUrl(imageValue(source));
  const officialKey = text(first(source, ['id', 'cardId', 'card_id', 'uuid', 'contentId', 'content_id'])) || [setCode, cardNumber, name, rarity, variant, imageUrl].join('|');
  const officialId = `riftbound:${crypto.createHash('sha1').update(officialKey).digest('hex')}`;
  const effect = rulesText(first(source, ['effect', 'rulesText', 'rules_text', 'text', 'description']));
  const stats = source.stats && typeof source.stats === 'object' ? source.stats : {};
  return {
    official_id: officialId,
    game_code: RIFTBOUND_GAME_CODE,
    game_name: RIFTBOUND_GAME_NAME,
    name,
    card_number: cardNumber,
    set_code: setCode,
    setName: set.setName,
    product_name: set.productName,
    rarity,
    source_rarity: rarity,
    variant,
    variant_source: variant ? 'Official Riot data' : '',
    color: galleryValues(first(source, ['domains', 'domain', 'colors', 'color'])),
    card_type: cardType,
    image_url: imageUrl,
    detail_url: text(first(source, ['detailUrl', 'detail_url', 'url'])),
    artist: galleryValues(first(source, ['artist', 'illustrator'])) || text(source?.art?.artist),
    cost: galleryValues(first(source, ['energyCost', 'energy_cost', 'energy', 'cost'])) || text(stats.cost || stats.energy),
    power: galleryValues(first(source, ['might', 'power'])) || text(stats.might || stats.power),
    traits: galleryValues(first(source, ['tags', 'tag', 'traits', 'subtypes', 'subtype'])),
    effect,
    raw_details: JSON.stringify(source),
    source: source?.publicCode ? 'Official Riot Riftbound Card Gallery' : 'Official Riot Riftbound API'
  };
}

function cardArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.sets)) {
    return payload.sets.flatMap(set => Array.isArray(set?.cards)
      ? set.cards.map(card => ({ ...card, _parentSetId: set.id, _parentSetName: set.name }))
      : []);
  }
  for (const key of ['cards', 'items', 'results', 'data', 'content']) {
    if (Array.isArray(payload?.[key])) return payload[key];
    if (Array.isArray(payload?.[key]?.cards)) return payload[key].cards;
    if (Array.isArray(payload?.[key]?.items)) return payload[key].items;
  }
  return [];
}

function normalizeRiftboundPayload(payload) {
  const cards = cardArray(payload).map(normalizeRiftboundCard).filter(Boolean);
  const ignored = cardArray(payload).length - cards.length;
  return { cards, ignored };
}

module.exports = {
  RIFTBOUND_GAME_CODE,
  RIFTBOUND_GAME_NAME,
  RIFTBOUND_SETS,
  RIFTBOUND_TREATMENTS,
  normalizeRiftboundCard,
  normalizeRiftboundCollectorNumber,
  normalizeRiftboundPayload,
  riftboundCardType,
  riftboundDisplayName,
  riftboundCollectorTreatment
};
