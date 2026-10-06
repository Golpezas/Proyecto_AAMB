const JUST_ROOT = 'https://api.justtcg.com/v1';
const EBAY_TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const EBAY_BROWSE_ROOT = 'https://api.ebay.com/buy/browse/v1';
const EBAY_SCOPE = 'https://api.ebay.com/oauth/api_scope';
const PRICE_SOURCE_IDS = Object.freeze({
  JUSTTCG: 'justtcg',
  CHATGPT: 'chatgpt',
  EBAY: 'ebay',
  MANUAL: 'manual'
});
const PRICE_SOURCE_LABELS = Object.freeze({
  [PRICE_SOURCE_IDS.JUSTTCG]: 'JustTCG',
  [PRICE_SOURCE_IDS.CHATGPT]: 'ChatGPT Import',
  [PRICE_SOURCE_IDS.EBAY]: 'eBay Active Estimate',
  [PRICE_SOURCE_IDS.MANUAL]: 'Manual'
});
const PRICE_SOURCE_OPTIONS = Object.freeze([
  Object.freeze({ id: PRICE_SOURCE_IDS.JUSTTCG, label: PRICE_SOURCE_LABELS.justtcg, kind: 'automatic', requires: 'JustTCG API key' }),
  Object.freeze({ id: PRICE_SOURCE_IDS.CHATGPT, label: PRICE_SOURCE_LABELS.chatgpt, kind: 'import', requires: 'No extra API key' }),
  Object.freeze({ id: PRICE_SOURCE_IDS.EBAY, label: PRICE_SOURCE_LABELS.ebay, kind: 'automatic', requires: 'eBay Developer credentials' }),
  Object.freeze({ id: PRICE_SOURCE_IDS.MANUAL, label: PRICE_SOURCE_LABELS.manual, kind: 'entry', requires: 'No API key' })
]);
const PLAN_REQUESTS_PER_MINUTE = Object.freeze({
  FREE: 10,
  STARTER: 50,
  PROFESSIONAL: 100,
  PRO: 100,
  ENTERPRISE: 500
});
const MAX_RATE_LIMIT_RETRIES = 8;
const SET_ALIASES = Object.freeze({
  OGN: 'ORIGINS',
  OGS: 'ORIGINS PROVING GROUNDS',
  SFD: 'SPIRITFORGED',
  UNL: 'UNLEASHED',
  VEN: 'VENDETTA'
});
let ebayTokenCache = null;

function text(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizePriceSource(value) {
  const normalized = text(value).toLowerCase().replace(/[^a-z]/g, '');
  if (normalized === 'chatgpt' || normalized === 'chatgptimport') return PRICE_SOURCE_IDS.CHATGPT;
  if (normalized === 'ebay' || normalized === 'ebayactiveestimate') return PRICE_SOURCE_IDS.EBAY;
  if (normalized === 'manual') return PRICE_SOURCE_IDS.MANUAL;
  return PRICE_SOURCE_IDS.JUSTTCG;
}

function priceSourceLabel(value) {
  return PRICE_SOURCE_LABELS[normalizePriceSource(value)];
}

function displayedAuditCards(entry = {}) {
  const groups = Array.isArray(entry.bundleGroups) ? entry.bundleGroups : [];
  const groupedCards = groups.flatMap(group => Array.isArray(group?.cards) ? group.cards : []);
  return groupedCards.length ? groupedCards : (Array.isArray(entry.family) ? entry.family : []);
}

function displayedCatalogCardIds(boardCards = [], auditEntries = []) {
  const audit = Array.isArray(auditEntries) ? auditEntries : [];
  const auditedPositions = new Set(audit.map(entry => Number(entry?.position)).filter(Number.isFinite));
  const ids = [];
  const seen = new Set();
  const add = card => {
    const id = Math.max(0, Math.floor(Number(card?.id ?? card?.cardId) || 0));
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };
  audit.forEach(entry => displayedAuditCards(entry).forEach(add));
  (Array.isArray(boardCards) ? boardCards : []).forEach(card => {
    const status = text(card?.block_status || card?.status).toLowerCase();
    if (status === 'ready' || !auditedPositions.has(Number(card?.position))) add(card);
  });
  return ids.slice(0, 500);
}

function readSetting(database, key) {
  return text(database.prepare('SELECT value FROM card_sniper_settings WHERE key = ?').get(key)?.value);
}

function writeSetting(database, key, value) {
  database.prepare(`
    INSERT INTO card_sniper_settings(key, value, updated_at) VALUES(?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, text(value), new Date().toISOString());
}

function maskedCredential(value) {
  const secret = text(value);
  if (!secret) return '';
  if (secret.length <= 8) return `${secret.slice(0, 2)}••••${secret.slice(-2)}`;
  return `${secret.slice(0, 4)}••••${secret.slice(-4)}`;
}

function getPricingSettings(database) {
  const selectedSource = normalizePriceSource(readSetting(database, 'buyer_price_source'));
  const justTcgKey = readSetting(database, 'justtcg_key');
  const ebayClientId = readSetting(database, 'ebay_client_id');
  const ebayClientSecret = readSetting(database, 'ebay_client_secret');
  return {
    selectedSource,
    selectedLabel: priceSourceLabel(selectedSource),
    justTcgConfigured: Boolean(justTcgKey),
    ebayConfigured: Boolean(ebayClientId && ebayClientSecret),
    ebayClientId: maskedCredential(ebayClientId),
    sources: PRICE_SOURCE_OPTIONS.map(option => ({
      ...option,
      configured: option.id === PRICE_SOURCE_IDS.JUSTTCG
        ? Boolean(justTcgKey)
        : option.id === PRICE_SOURCE_IDS.EBAY
          ? Boolean(ebayClientId && ebayClientSecret)
          : true
    }))
  };
}

function savePricingSettings(database, settings = {}) {
  const suppliedEbayId = text(settings.ebayClientId);
  const suppliedEbaySecret = text(settings.ebayClientSecret);
  if (suppliedEbayId || suppliedEbaySecret) {
    const nextId = suppliedEbayId || readSetting(database, 'ebay_client_id');
    const nextSecret = suppliedEbaySecret || readSetting(database, 'ebay_client_secret');
    if (!nextId || !nextSecret) throw new Error('Add both the eBay Client ID and Client Secret before saving eBay access.');
  }
  if (Object.hasOwn(settings, 'selectedSource')) {
    writeSetting(database, 'buyer_price_source', normalizePriceSource(settings.selectedSource));
  }
  if (suppliedEbayId || suppliedEbaySecret) {
    if (suppliedEbayId) writeSetting(database, 'ebay_client_id', suppliedEbayId);
    if (suppliedEbaySecret) writeSetting(database, 'ebay_client_secret', suppliedEbaySecret);
    ebayTokenCache = null;
  }
  return getPricingSettings(database);
}

function compact(value) {
  return text(value).toUpperCase().replace(/[^A-Z0-9*]/g, '');
}

function numberCore(value) {
  let normalized = text(value).toUpperCase()
    .replace(/[★☆]/g, '*')
    .replace(/\bSTAR\b/g, '*')
    .replace(/[•·\s]/g, '');
  normalized = normalized.replace(/^[A-Z]{2,5}-/, '');
  return normalized.replace(/[^A-Z0-9*/]/g, '');
}

function collectorNumberCandidates(value) {
  const raw = text(value).toUpperCase().replace(/[★☆]/g, '*').replace(/\bSTAR\b/g, '*');
  const core = numberCore(raw);
  const numerator = core.split('/')[0];
  return [...new Set([raw, core, numerator].filter(Boolean))];
}

function signatureMarked(value) {
  return /\*|\bSIGNATURE\b|\bSIGNED\b|AUTOGRAPH/i.test(text(value));
}

function marketSlug(value) {
  return text(value)
    .replace(/\?/g, ' question')
    .replace(/!/g, ' exclamation')
    .replace(/\+/g, ' plus')
    .replace(/\*/g, ' star')
    .toLowerCase()
    .replace(/['’]/g, '-')
    .replace(/[.,?:;()]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function marketCardSlug(gameId, item = {}) {
  const segments = [gameId, item.set_name, item.card_name, item.rarity].map(marketSlug).filter(Boolean);
  return segments.length === 4 ? segments.join('-') : '';
}

function numberMatchScore(localNumber, marketNumber) {
  const localCore = numberCore(localNumber);
  const marketCore = numberCore(marketNumber);
  if (!localCore || !marketCore) return 0;
  if (localCore === marketCore) return 1200;
  const localNumerator = localCore.split('/')[0];
  const marketNumerator = marketCore.split('/')[0];
  if (localNumerator === marketNumerator) return 850;
  if (localNumerator.replace(/\*/g, '') === marketNumerator.replace(/\*/g, '')) return 825;
  if (compact(localNumber) === compact(marketNumber)) return 800;
  return 0;
}

function setMatchScore(item, card) {
  const wanted = compact(item.set_code);
  if (!wanted) return 0;
  const market = compact(`${card.set || ''} ${card.set_name || ''}`);
  if (market.includes(wanted)) return 250;
  const alias = compact(SET_ALIASES[wanted] || item.set_name || '');
  return alias && market.includes(alias) ? 250 : 0;
}

function marketCardScore(item, card) {
  const numberScore = numberMatchScore(item.card_number, card.number);
  if (numberScore <= 0) return numberScore;
  const localSignature = signatureMarked(`${item.card_number} ${item.collector_treatment}`);
  const marketSignature = signatureMarked(`${card.number} ${card.rarity} ${card.details} ${card.name} ${card.id}`);
  if (localSignature !== marketSignature) return -10000;
  const localName = compact(item.card_name);
  const marketName = compact(card.name);
  let score = numberScore + setMatchScore(item, card);
  if (localName && marketName === localName) score += 400;
  else if (localName && (marketName.includes(localName) || localName.includes(marketName))) score += 220;
  const hint = compact(`${item.rarity} ${item.collector_treatment} ${item.variant_hint}`);
  const marketHint = compact(`${card.rarity} ${card.details}`);
  if (hint && marketHint && (hint.includes(marketHint) || marketHint.includes(hint))) score += 120;
  return score;
}

function chooseMarketCard(item, cards = []) {
  const ranked = cards
    .map(card => ({ card, score: marketCardScore(item, card) }))
    .filter(result => result.score >= 850)
    .sort((left, right) => right.score - left.score);
  return ranked[0]?.card || null;
}

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function chooseMarketVariant(item, card = {}) {
  const desired = text(`${item.rarity} ${item.collector_treatment} ${item.variant_hint}`).toUpperCase();
  const wantsFoil = /FOIL|HOLO|SIGNATURE|OVERNUMBERED|SHOWCASE|ALTERNATE|\bALT\b|MANGA|PARALLEL|SPECIAL|\bSP\b|\bAA\b|GOLD|TREASURE/.test(desired);
  const variants = (Array.isArray(card.variants) ? card.variants : [])
    .filter(variant => money(variant.price) !== null)
    .filter(variant => !text(variant.condition) || /^(?:NM|NEAR MINT)$/i.test(text(variant.condition)))
    .filter(variant => !text(variant.language) || /^EN(?:GLISH)?$/i.test(text(variant.language)))
    .map(variant => {
      const printing = text(variant.printing).toUpperCase();
      const isFoil = /FOIL|HOLO|PARALLEL/.test(printing);
      let score = 0;
      if (wantsFoil === isFoil) score += 300;
      if (/^(?:NM|NEAR MINT)$/i.test(text(variant.condition))) score += 50;
      if (/^EN(?:GLISH)?$/i.test(text(variant.language))) score += 25;
      if (desired && printing && (desired.includes(compact(printing)) || compact(printing).includes(compact(desired)))) score += 80;
      return { variant, score };
    })
    .sort((left, right) => right.score - left.score || money(right.variant.price) - money(left.variant.price));
  return variants[0]?.variant || null;
}

function listResponse(data) {
  return Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function retryDelayMs(retryAfter, attempt = 0, now = Date.now(), random = Math.random) {
  const raw = text(retryAfter);
  if (raw) {
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.max(250, Math.ceil(seconds * 1000) + 250);
    const date = Date.parse(raw);
    if (Number.isFinite(date)) return Math.max(250, date - now + 250);
  }
  const exponential = Math.min(30000, 1000 * (2 ** Math.max(0, Number(attempt) || 0)));
  return exponential + Math.floor(Math.max(0, Number(random()) || 0) * 500);
}

function requestsPerMinute(data) {
  const metadata = data?._metadata || data?.metadata || {};
  const explicit = Number(metadata.apiRateLimit || metadata.api_rate_limit || metadata.rateLimit || metadata.rate_limit);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return PLAN_REQUESTS_PER_MINUTE[compact(metadata.apiPlan || metadata.api_plan)] || 0;
}

function createPacedFetch(fetchImpl, perMinute, { now = Date.now, sleep = wait } = {}) {
  const rate = Number(perMinute);
  if (!Number.isFinite(rate) || rate <= 0) return fetchImpl;
  const interval = Math.ceil(60000 / rate) + 150;
  let nextRequestAt = Number(now()) + interval;
  return async (...args) => {
    const delay = Math.max(0, nextRequestAt - Number(now()));
    if (delay) await sleep(delay);
    const startedAt = Number(now());
    nextRequestAt = Math.max(nextRequestAt, startedAt) + interval;
    return fetchImpl(...args);
  };
}

async function justRequest(apiKey, method, path, body, fetchImpl = fetch, query = {}, retry = {}) {
  const url = new URL(`${JUST_ROOT}${path}`);
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  const response = await fetchImpl(url.toString(), {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  let data = null;
  try { data = await response.json(); } catch {}
  const attempt = Math.max(0, Number(retry.attempt) || 0);
  if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
    const delay = retryDelayMs(
      response.headers?.get?.('retry-after'),
      attempt,
      typeof retry.now === 'function' ? retry.now() : Date.now(),
      typeof retry.random === 'function' ? retry.random : Math.random
    );
    await (typeof retry.sleep === 'function' ? retry.sleep(delay) : wait(delay));
    return justRequest(apiKey, method, path, body, fetchImpl, query, { ...retry, attempt: attempt + 1 });
  }
  if (!response.ok) {
    const message = data?.detail || data?.message || data?.error || `HTTP ${response.status}`;
    throw new Error(`JustTCG price refresh failed: ${message}`);
  }
  return data || {};
}

async function ebayAccessToken(clientId, clientSecret, fetchImpl = fetch, now = Date.now) {
  const credentialKey = `${clientId}\u0000${clientSecret}`;
  const currentTime = Number(now());
  if (ebayTokenCache?.credentialKey === credentialKey && ebayTokenCache.expiresAt > currentTime + 60000) {
    return ebayTokenCache.token;
  }
  const response = await fetchImpl(EBAY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: EBAY_SCOPE }).toString()
  });
  let data = null;
  try { data = await response.json(); } catch {}
  if (!response.ok || !text(data?.access_token)) {
    const message = data?.error_description || data?.message || data?.error || `HTTP ${response.status}`;
    throw new Error(`eBay access failed: ${message}`);
  }
  const expiresIn = Math.max(60, Number(data.expires_in) || 7200);
  ebayTokenCache = {
    credentialKey,
    token: text(data.access_token),
    expiresAt: currentTime + (expiresIn * 1000)
  };
  return ebayTokenCache.token;
}

function ebaySearchQuery(item = {}, gameCode = '') {
  const gameName = text(gameCode).toUpperCase() === 'RIFTBOUND' ? 'Riftbound' : 'One Piece Card Game';
  return [item.card_name, item.card_number, item.set_code, item.collector_treatment, gameName]
    .map(text).filter(Boolean).join(' ');
}

function ebayTitleTokens(value) {
  const ignored = new Set(['THE', 'AND', 'CARD', 'GAME', 'TCG', 'ENGLISH', 'NEAR', 'MINT']);
  return text(value).toUpperCase().replace(/[^A-Z0-9*]+/g, ' ').split(' ')
    .filter(token => token.length >= 2 && !ignored.has(token));
}

function ebayListingMatches(item = {}, listing = {}) {
  const title = text(listing.title);
  const normalizedTitle = compact(title);
  if (!title || /\b(?:PSA|BGS|CGC|SGC|GRADED|SLAB|PROXY|CUSTOM|DIGITAL|ORICA|REPACK|BOOSTER|DISPLAY|BOX|CASE|PACK|PLAYSET|LOT)\b/i.test(title)) return false;
  if (/\b(?:2X|3X|4X|5X|6X|7X|8X|9X|10X|SET OF|BUNDLE OF)\b/i.test(title)) return false;
  const nameTokens = [...new Set(ebayTitleTokens(item.card_name))];
  const matchedNameTokens = nameTokens.filter(token => normalizedTitle.includes(compact(token))).length;
  if (nameTokens.length && matchedNameTokens < Math.max(1, Math.ceil(nameTokens.length * 0.6))) return false;

  const rawNumber = text(item.card_number).toUpperCase();
  const numberValues = collectorNumberCandidates(rawNumber).map(compact).filter(value => value.length >= 3);
  const numberMatched = numberValues.some(value => normalizedTitle.includes(value));
  const numerator = compact(numberCore(rawNumber).split('/')[0]).replace(/\*/g, '');
  const setCode = compact(item.set_code);
  const setAndNumberMatched = Boolean(setCode && numerator && normalizedTitle.includes(setCode) && normalizedTitle.includes(numerator));
  if (numberValues.length && !numberMatched && !setAndNumberMatched) return false;

  const wantsSignature = signatureMarked(`${item.card_number} ${item.collector_treatment} ${item.variant_hint}`);
  const listingSignature = signatureMarked(title) || (rawNumber.includes('*') && title.includes('*'));
  if (wantsSignature !== listingSignature) return false;
  const wantsFoil = /FOIL|HOLO/i.test(text(`${item.collector_treatment} ${item.variant_hint}`));
  if (wantsFoil && !/FOIL|HOLO/i.test(title)) return false;
  return true;
}

function ebayListingTotalCents(listing = {}) {
  const price = listing.price || listing.currentBidPrice || {};
  if (text(price.currency).toUpperCase() !== 'USD') return null;
  const priceValue = money(price.value);
  if (priceValue === null || priceValue <= 0) return null;
  const shipping = (Array.isArray(listing.shippingOptions) ? listing.shippingOptions : [])
    .map(option => option?.shippingCost)
    .filter(cost => !text(cost?.currency) || text(cost.currency).toUpperCase() === 'USD')
    .map(cost => money(cost?.value))
    .filter(value => value !== null)
    .sort((left, right) => left - right)[0] || 0;
  return Math.round((priceValue + shipping) * 100);
}

function medianCents(values = []) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? Math.round(sorted[middle]) : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

async function ebaySearch(token, item, gameCode, fetchImpl = fetch) {
  const url = new URL(`${EBAY_BROWSE_ROOT}/item_summary/search`);
  url.searchParams.set('q', ebaySearchQuery(item, gameCode));
  url.searchParams.set('limit', '50');
  url.searchParams.set('filter', 'buyingOptions:{FIXED_PRICE},deliveryCountry:US,priceCurrency:USD');
  const response = await fetchImpl(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
    }
  });
  let data = null;
  try { data = await response.json(); } catch {}
  if (!response.ok) {
    const issue = data?.errors?.[0] || {};
    const message = issue.longMessage || issue.message || data?.message || `HTTP ${response.status}`;
    throw new Error(`eBay active-price search failed: ${message}`);
  }
  return Array.isArray(data?.itemSummaries) ? data.itemSummaries : [];
}

async function resolveEbayMarketPrices(database, gameCode, items, fetchImpl = fetch) {
  const clientId = readSetting(database, 'ebay_client_id');
  const clientSecret = readSetting(database, 'ebay_client_secret');
  if (!clientId || !clientSecret) throw new Error('Add your free eBay Developer Client ID and Client Secret in Price Source Setup first.');
  const token = await ebayAccessToken(clientId, clientSecret, fetchImpl);
  const groups = uniquePricingItems(items);
  const refreshedAt = new Date().toISOString();
  const results = [];
  for (const group of groups) {
    const listings = (await ebaySearch(token, group.item, gameCode, fetchImpl))
      .filter(listing => ebayListingMatches(group.item, listing))
      .map(listing => ({ listing, totalCents: ebayListingTotalCents(listing) }))
      .filter(value => Number.isInteger(value.totalCents) && value.totalCents > 0)
      .sort((left, right) => left.totalCents - right.totalCents);
    const priceCents = medianCents(listings.map(value => value.totalCents));
    const representative = priceCents === null
      ? null
      : listings.reduce((best, value) => !best || Math.abs(value.totalCents - priceCents) < Math.abs(best.totalCents - priceCents) ? value : best, null);
    results.push({
      ids: group.ids,
      priceCents,
      variantLabel: priceCents === null ? '' : `Active raw listings · median of ${listings.length} · item + shipping`,
      externalId: text(representative?.listing?.itemWebUrl || representative?.listing?.itemId),
      sampleCount: listings.length
    });
  }
  return { refreshedAt, results, source: PRICE_SOURCE_LABELS.ebay };
}

function gameForBatch(games, gameCode) {
  const isRiftbound = text(gameCode).toUpperCase() === 'RIFTBOUND';
  return games.find(game => isRiftbound
    ? /RIFTBOUND/i.test(text(game.name)) || compact(game.id).includes('RIFTBOUND')
    : /ONE\s*PIECE/i.test(text(game.name)) || compact(game.id).includes('ONEPIECE')) || null;
}

function chunks(values, size = 20) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function uniquePricingItems(items) {
  const values = new Map();
  for (const item of items) {
    const key = [item.set_code, item.card_number, item.card_name, item.rarity, item.collector_treatment, item.variant_hint]
      .map(compact).join('|');
    if (!values.has(key)) values.set(key, { key, item, ids: [], externalIds: new Set() });
    values.get(key).ids.push(Number(item.id));
    if (text(item.market_external_id)) values.get(key).externalIds.add(text(item.market_external_id));
  }
  return [...values.values()].map(value => ({ ...value, externalIds: [...value.externalIds] }));
}

async function requestCandidates(apiKey, gameId, groups, fetchImpl) {
  const candidates = [];
  for (const { item } of groups) {
    const numberCandidates = collectorNumberCandidates(item.card_number);
    const requestedNumber = compact(gameId).includes('ONEPIECE')
      ? numberCandidates[0]
      : (numberCandidates[1] || numberCandidates[0]);
    candidates.push(...listResponse(await justRequest(apiKey, 'GET', '/cards', undefined, fetchImpl, {
      game: gameId,
      number: requestedNumber,
      condition: 'NM',
      language: 'English',
      include_price_history: false,
      limit: 20
    })));
  }
  return candidates;
}

async function requestSlugCandidates(apiKey, gameId, groups, fetchImpl) {
  const candidates = [];
  const lookups = groups
    .map(value => ({ value, cardId: marketCardSlug(gameId, value.item) }))
    .filter(value => value.cardId);
  for (const group of chunks(lookups, 20)) {
    candidates.push(...listResponse(await justRequest(apiKey, 'POST', '/cards', group.map(value => ({
      cardId: value.cardId,
      condition: 'NM',
      language: 'English'
    })), fetchImpl)));
  }
  return candidates;
}

async function requestFallbackCandidates(apiKey, gameId, groups, fetchImpl) {
  const candidates = [];
  for (const { item } of groups) {
    candidates.push(...listResponse(await justRequest(apiKey, 'GET', '/cards', undefined, fetchImpl, {
      game: gameId,
      q: `${item.card_name} ${collectorNumberCandidates(item.card_number).at(-1) || ''}`.trim(),
      condition: 'NM',
      language: 'English',
      include_price_history: false,
      limit: 20
    })));
  }
  return candidates;
}

async function requestKnownCandidates(apiKey, groups, fetchImpl) {
  const candidates = [];
  for (const group of chunks(groups, 20)) {
    const lookups = group.map(value => ({
      variantId: value.externalIds[0],
      condition: 'NM',
      language: 'English'
    }));
    candidates.push(...listResponse(await justRequest(apiKey, 'POST', '/cards', lookups, fetchImpl)));
  }
  return candidates;
}

async function resolveMarketPrices(apiKey, gameCode, items, fetchImpl = fetch) {
  const gamesResponse = await justRequest(apiKey, 'GET', '/games', undefined, fetchImpl);
  const games = listResponse(gamesResponse);
  const game = gameForBatch(games, gameCode);
  if (!game) throw new Error(`JustTCG could not find ${text(gameCode).toUpperCase() === 'RIFTBOUND' ? 'Riftbound' : 'One Piece'} in its supported games.`);
  const pacedFetch = createPacedFetch(fetchImpl, requestsPerMinute(gamesResponse));
  const groups = uniquePricingItems(items);
  const knownGroups = groups.filter(group => group.externalIds.length);
  const discoveryGroups = groups.filter(group => !group.externalIds.length);
  let candidates = [
    ...await requestKnownCandidates(apiKey, knownGroups, pacedFetch),
    ...await requestSlugCandidates(apiKey, game.id, discoveryGroups, pacedFetch)
  ];
  const exactNumberGroups = discoveryGroups.filter(group => !chooseMarketCard(group.item, candidates));
  if (exactNumberGroups.length) {
    candidates = [...candidates, ...await requestCandidates(apiKey, game.id, exactNumberGroups, pacedFetch)];
  }
  const unmatchedGroups = groups.filter(group => !chooseMarketCard(group.item, candidates));
  if (unmatchedGroups.length) {
    candidates = [...candidates, ...await requestFallbackCandidates(apiKey, game.id, unmatchedGroups, pacedFetch)];
  }

  const refreshedAt = new Date().toISOString();
  const results = groups.map(group => {
    const card = chooseMarketCard(group.item, candidates);
    const variant = card ? chooseMarketVariant(group.item, card) : null;
    const price = variant ? money(variant.price) : null;
    return {
      ids: group.ids,
      card,
      variant,
      priceCents: price === null ? null : Math.round(price * 100)
    };
  });
  return { refreshedAt, results, source: 'JustTCG' };
}

async function resolveConfiguredMarketPrices(database, gameCode, items, fetchImpl = fetch, sourceValue = '') {
  const source = normalizePriceSource(sourceValue || readSetting(database, 'buyer_price_source'));
  if (source === PRICE_SOURCE_IDS.EBAY) return resolveEbayMarketPrices(database, gameCode, items, fetchImpl);
  if (source === PRICE_SOURCE_IDS.CHATGPT) {
    throw new Error('ChatGPT Import is selected. Use the Price Check button to copy the exact card list, then paste ChatGPT’s JSON prices back into BreakSuite.');
  }
  if (source === PRICE_SOURCE_IDS.MANUAL) {
    throw new Error('Manual Price is selected. Use the Price Check button to enter the unit prices for these exact cards.');
  }
  const apiKey = readSetting(database, 'justtcg_key');
  if (!apiKey) throw new Error('Connect JustTCG in Price Source Setup first.');
  return resolveMarketPrices(apiKey, gameCode, items, fetchImpl);
}

async function refreshCatalogCardPrices(database, cardIds, fetchImpl = fetch) {
  const ids = [...new Set((Array.isArray(cardIds) ? cardIds : [])
    .map(value => Math.floor(Number(value) || 0))
    .filter(value => value > 0))].slice(0, 500);
  if (!ids.length) throw new Error('Record at least one actual pulled card in this Buyer Bag first.');
  const placeholders = ids.map(() => '?').join(',');
  const rows = database.prepare(`
    SELECT id, game_code, name AS card_name, card_number, set_code, set_name,
      rarity, variant, manual_category, market_price_external_id AS market_external_id
    FROM cards
    WHERE id IN (${placeholders})
    ORDER BY id ASC
  `).all(...ids);
  if (rows.length !== ids.length) throw new Error('One or more selected Buyer Bag cards are no longer in the card library.');
  const gameCodes = [...new Set(rows.map(row => text(row.game_code).toUpperCase()).filter(Boolean))];
  if (gameCodes.length !== 1) throw new Error('Price one card game at a time.');
  const items = rows.map(row => {
    const manual = /^STANDARD$/i.test(text(row.manual_category)) ? '' : text(row.manual_category);
    return {
      ...row,
      collector_treatment: manual || text(row.variant),
      variant_hint: [text(row.variant), manual].filter(Boolean).join(' · ')
    };
  });
  const resolved = await resolveConfiguredMarketPrices(database, gameCodes[0], items, fetchImpl);
  const updateMatched = database.prepare(`
    UPDATE cards
    SET market_price_cents = ?, market_price_source = ?, market_price_variant = ?,
      market_price_external_id = ?, market_price_updated_at = ?, market_price_match_status = 'matched'
    WHERE id = ?
  `);
  const updateUnmatched = database.prepare(`
    UPDATE cards
    SET market_price_cents = NULL, market_price_source = ?, market_price_variant = '',
      market_price_external_id = '', market_price_updated_at = ?, market_price_match_status = 'unmatched'
    WHERE id = ?
  `);
  database.exec('BEGIN IMMEDIATE');
  try {
    for (const result of resolved.results) {
      for (const cardId of result.ids) {
        if (result.priceCents === null) {
          updateUnmatched.run(resolved.source, resolved.refreshedAt, cardId);
        } else {
          const variantLabel = result.variantLabel || [result.variant?.printing, result.variant?.condition, result.variant?.language].filter(Boolean).join(' · ');
          const externalId = text(result.externalId || result.variant?.uuid || result.variant?.id || result.card?.uuid || result.card?.id);
          updateMatched.run(result.priceCents, resolved.source, variantLabel, externalId, resolved.refreshedAt, cardId);
        }
      }
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  const prices = database.prepare(`
    SELECT id AS card_id, market_price_cents, market_price_source,
      market_price_variant, market_price_external_id, market_price_updated_at,
      market_price_match_status
    FROM cards
    WHERE id IN (${placeholders})
    ORDER BY id ASC
  `).all(...ids);
  return {
    refreshedAt: resolved.refreshedAt,
    matchedCards: prices.filter(row => Number.isInteger(row.market_price_cents)).length,
    unmatchedCards: prices.filter(row => !Number.isInteger(row.market_price_cents)).length,
    source: resolved.source,
    prices
  };
}

async function refreshPullHistoryPrices(database, batchId, fetchImpl = fetch) {
  const id = Math.max(1, Math.floor(Number(batchId) || 0));
  const batch = database.prepare(`
    SELECT id, game_code, set_code, set_name
    FROM pull_history_batches
    WHERE id = ?
  `).get(id);
  if (!batch) throw new Error('That Pull History record no longer exists.');
  const items = database.prepare(`
    SELECT id, card_name, card_number, set_code, rarity, collector_treatment,
      variant_hint, quantity, market_external_id
    FROM pull_history_items
    WHERE batch_id = ?
    ORDER BY id ASC
  `).all(id);
  if (!items.length) throw new Error('This Pull History record has no cards to price.');

  const resolved = await resolveConfiguredMarketPrices(
    database,
    batch.game_code,
    items.map(item => ({ ...item, set_name: batch.set_name })),
    fetchImpl
  );
  const now = resolved.refreshedAt;
  const results = resolved.results;

  const updateMatched = database.prepare(`
    UPDATE pull_history_items
    SET market_price_cents = ?, market_source = ?, market_variant = ?,
      market_external_id = ?, market_updated_at = ?, market_match_status = 'matched'
    WHERE id = ? AND batch_id = ?
  `);
  const updateUnmatched = database.prepare(`
    UPDATE pull_history_items
    SET market_price_cents = NULL, market_source = ?, market_variant = '',
      market_external_id = '', market_updated_at = ?, market_match_status = 'unmatched'
    WHERE id = ? AND batch_id = ?
  `);
  database.exec('BEGIN IMMEDIATE');
  try {
    for (const result of results) {
      for (const itemId of result.ids) {
        if (result.priceCents === null) {
          updateUnmatched.run(resolved.source, now, itemId, id);
        } else {
          const variantLabel = result.variantLabel || [result.variant?.printing, result.variant?.condition, result.variant?.language].filter(Boolean).join(' · ');
          const externalId = text(result.externalId || result.variant?.uuid || result.variant?.id || result.card?.uuid || result.card?.id);
          updateMatched.run(result.priceCents, resolved.source, variantLabel, externalId, now, itemId, id);
        }
      }
    }
    database.prepare('UPDATE pull_history_batches SET price_refreshed_at = ? WHERE id = ?').run(now, id);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }

  const pricedRows = database.prepare(`
    SELECT quantity, market_price_cents
    FROM pull_history_items
    WHERE batch_id = ?
  `).all(id);
  return {
    batchId: id,
    refreshedAt: now,
    matchedCards: pricedRows.filter(row => Number.isInteger(row.market_price_cents)).reduce((total, row) => total + Math.max(1, Number(row.quantity || 1)), 0),
    unmatchedCards: pricedRows.filter(row => !Number.isInteger(row.market_price_cents)).reduce((total, row) => total + Math.max(1, Number(row.quantity || 1)), 0),
    marketValueCents: pricedRows.reduce((total, row) => total + (Number.isInteger(row.market_price_cents) ? row.market_price_cents * Math.max(1, Number(row.quantity || 1)) : 0), 0),
    source: resolved.source
  };
}

function inputPriceCents(entry = {}) {
  const usesCents = Object.hasOwn(entry, 'priceCents');
  const raw = usesCents
    ? entry.priceCents
    : (entry.priceUsd ?? entry.marketPriceUsd ?? entry.price ?? null);
  if (raw === null || raw === undefined || text(raw) === '') return null;
  const normalized = typeof raw === 'string' ? raw.replace(/[$,\s]/g, '') : raw;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) throw new Error(`Price ${text(raw) || 'value'} is not a valid non-negative dollar amount.`);
  const cents = usesCents ? Math.round(value) : Math.round(value * 100);
  if (cents > 100000000) throw new Error('A unit price cannot exceed $1,000,000.00.');
  return cents;
}

function priceInputSource(sourceValue) {
  const source = normalizePriceSource(sourceValue);
  if (![PRICE_SOURCE_IDS.CHATGPT, PRICE_SOURCE_IDS.MANUAL].includes(source)) {
    throw new Error('Imported prices must use ChatGPT Import or Manual Price.');
  }
  return { id: source, label: PRICE_SOURCE_LABELS[source] };
}

function priceInputEntries(entries, allowedIds) {
  if (!Array.isArray(entries)) throw new Error('Price data must be a JSON array of card rows.');
  const allowed = new Set(allowedIds);
  const values = new Map();
  for (const entry of entries) {
    const id = Math.floor(Number(entry?.id) || 0);
    if (!allowed.has(id)) throw new Error(`Price row ${id || 'without an id'} does not belong to this card list.`);
    values.set(id, {
      priceCents: inputPriceCents(entry),
      note: text(entry.note || entry.basis || entry.condition).slice(0, 180),
      externalId: /^https:\/\//i.test(text(entry.sourceUrl || entry.url))
        ? text(entry.sourceUrl || entry.url).slice(0, 1000)
        : ''
    });
  }
  return values;
}

function catalogPriceInputRows(database, cardIds) {
  const ids = [...new Set((Array.isArray(cardIds) ? cardIds : [])
    .map(value => Math.floor(Number(value) || 0)).filter(value => value > 0))].slice(0, 500);
  if (!ids.length) throw new Error('Record at least one actual pulled card in this Buyer Bag first.');
  const placeholders = ids.map(() => '?').join(',');
  const rows = database.prepare(`
    SELECT id, game_code, name AS card_name, card_number, set_code, set_name,
      rarity, variant, manual_category, market_price_cents, market_price_source,
      market_price_variant, market_price_updated_at
    FROM cards
    WHERE id IN (${placeholders})
    ORDER BY set_code ASC, card_number ASC, name ASC, id ASC
  `).all(...ids);
  if (rows.length !== ids.length) throw new Error('One or more selected Buyer Bag cards are no longer in the card library.');
  return rows.map(row => ({
    id: Number(row.id),
    gameCode: text(row.game_code).toUpperCase(),
    cardName: text(row.card_name),
    cardNumber: text(row.card_number),
    setCode: text(row.set_code),
    setName: text(row.set_name),
    rarity: text(row.rarity),
    treatment: [text(row.variant), /^STANDARD$/i.test(text(row.manual_category)) ? '' : text(row.manual_category)].filter(Boolean).join(' · '),
    currentPriceCents: Number.isInteger(row.market_price_cents) ? Number(row.market_price_cents) : null,
    currentSource: text(row.market_price_source),
    currentNote: text(row.market_price_variant),
    currentUpdatedAt: row.market_price_updated_at || null
  }));
}

function pullHistoryPriceInputRows(database, batchId) {
  const id = Math.max(1, Math.floor(Number(batchId) || 0));
  const batch = database.prepare(`
    SELECT id, game_code, set_code, set_name, recorded_at
    FROM pull_history_batches
    WHERE id = ?
  `).get(id);
  if (!batch) throw new Error('That Pull History record no longer exists.');
  const rows = database.prepare(`
    SELECT id, buyer_name, position, card_name, card_number, set_code, rarity,
      collector_treatment, variant_hint, quantity, market_price_cents,
      market_source, market_variant, market_updated_at
    FROM pull_history_items
    WHERE batch_id = ?
    ORDER BY position ASC, card_number ASC, card_name ASC, id ASC
  `).all(id);
  if (!rows.length) throw new Error('This Pull History record has no cards to price.');
  return {
    batchId: id,
    gameCode: text(batch.game_code).toUpperCase(),
    setCode: text(batch.set_code),
    setName: text(batch.set_name),
    recordedAt: batch.recorded_at || null,
    rows: rows.map(row => ({
      id: Number(row.id),
      buyer: text(row.buyer_name),
      position: Number(row.position),
      cardName: text(row.card_name),
      cardNumber: text(row.card_number),
      setCode: text(row.set_code),
      setName: text(batch.set_name),
      rarity: text(row.rarity),
      treatment: [text(row.collector_treatment), text(row.variant_hint)].filter(Boolean).join(' · '),
      quantity: Math.max(1, Number(row.quantity || 1)),
      currentPriceCents: Number.isInteger(row.market_price_cents) ? Number(row.market_price_cents) : null,
      currentSource: text(row.market_source),
      currentNote: text(row.market_variant),
      currentUpdatedAt: row.market_updated_at || null
    }))
  };
}

function applyCatalogCardPriceInputs(database, cardIds, entries, sourceValue) {
  const source = priceInputSource(sourceValue);
  const rows = catalogPriceInputRows(database, cardIds);
  const ids = rows.map(row => row.id);
  const values = priceInputEntries(entries, ids);
  const now = new Date().toISOString();
  const matched = database.prepare(`
    UPDATE cards
    SET market_price_cents = ?, market_price_source = ?, market_price_variant = ?,
      market_price_external_id = ?, market_price_updated_at = ?, market_price_match_status = 'matched'
    WHERE id = ?
  `);
  const unmatched = database.prepare(`
    UPDATE cards
    SET market_price_cents = NULL, market_price_source = ?, market_price_variant = '',
      market_price_external_id = '', market_price_updated_at = ?, market_price_match_status = 'unmatched'
    WHERE id = ?
  `);
  database.exec('BEGIN IMMEDIATE');
  try {
    for (const row of rows) {
      const value = values.get(row.id);
      if (!value || value.priceCents === null) {
        unmatched.run(source.label, now, row.id);
      } else {
        const defaultNote = source.id === PRICE_SOURCE_IDS.CHATGPT
          ? 'Raw NM English · researched with ChatGPT'
          : 'Manual unit price';
        matched.run(value.priceCents, source.label, value.note || defaultNote, value.externalId, now, row.id);
      }
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  const prices = catalogPriceInputRows(database, ids);
  return {
    refreshedAt: now,
    matchedCards: prices.filter(row => Number.isInteger(row.currentPriceCents)).length,
    unmatchedCards: prices.filter(row => !Number.isInteger(row.currentPriceCents)).length,
    marketValueCents: prices.reduce((total, row) => total + (Number.isInteger(row.currentPriceCents) ? row.currentPriceCents : 0), 0),
    source: source.label,
    prices
  };
}

function applyPullHistoryPriceInputs(database, batchId, entries, sourceValue) {
  const source = priceInputSource(sourceValue);
  const batch = pullHistoryPriceInputRows(database, batchId);
  const ids = batch.rows.map(row => row.id);
  const values = priceInputEntries(entries, ids);
  const now = new Date().toISOString();
  const matched = database.prepare(`
    UPDATE pull_history_items
    SET market_price_cents = ?, market_source = ?, market_variant = ?,
      market_external_id = ?, market_updated_at = ?, market_match_status = 'matched'
    WHERE id = ? AND batch_id = ?
  `);
  const unmatched = database.prepare(`
    UPDATE pull_history_items
    SET market_price_cents = NULL, market_source = ?, market_variant = '',
      market_external_id = '', market_updated_at = ?, market_match_status = 'unmatched'
    WHERE id = ? AND batch_id = ?
  `);
  database.exec('BEGIN IMMEDIATE');
  try {
    for (const row of batch.rows) {
      const value = values.get(row.id);
      if (!value || value.priceCents === null) {
        unmatched.run(source.label, now, row.id, batch.batchId);
      } else {
        const defaultNote = source.id === PRICE_SOURCE_IDS.CHATGPT
          ? 'Raw NM English · researched with ChatGPT'
          : 'Manual unit price';
        matched.run(value.priceCents, source.label, value.note || defaultNote, value.externalId, now, row.id, batch.batchId);
      }
    }
    database.prepare('UPDATE pull_history_batches SET price_refreshed_at = ? WHERE id = ?').run(now, batch.batchId);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  const pricedRows = database.prepare(`
    SELECT quantity, market_price_cents
    FROM pull_history_items
    WHERE batch_id = ?
  `).all(batch.batchId);
  return {
    batchId: batch.batchId,
    refreshedAt: now,
    matchedCards: pricedRows.filter(row => Number.isInteger(row.market_price_cents)).reduce((total, row) => total + Math.max(1, Number(row.quantity || 1)), 0),
    unmatchedCards: pricedRows.filter(row => !Number.isInteger(row.market_price_cents)).reduce((total, row) => total + Math.max(1, Number(row.quantity || 1)), 0),
    marketValueCents: pricedRows.reduce((total, row) => total + (Number.isInteger(row.market_price_cents) ? row.market_price_cents * Math.max(1, Number(row.quantity || 1)) : 0), 0),
    source: source.label
  };
}

module.exports = {
  PRICE_SOURCE_IDS,
  PRICE_SOURCE_LABELS,
  PRICE_SOURCE_OPTIONS,
  applyCatalogCardPriceInputs,
  applyPullHistoryPriceInputs,
  catalogPriceInputRows,
  chooseMarketCard,
  chooseMarketVariant,
  collectorNumberCandidates,
  createPacedFetch,
  displayedAuditCards,
  displayedCatalogCardIds,
  ebayAccessToken,
  ebayListingMatches,
  ebayListingTotalCents,
  ebaySearchQuery,
  gameForBatch,
  getPricingSettings,
  inputPriceCents,
  justRequest,
  marketCardSlug,
  marketCardScore,
  marketSlug,
  medianCents,
  numberCore,
  normalizePriceSource,
  priceSourceLabel,
  pullHistoryPriceInputRows,
  refreshCatalogCardPrices,
  refreshPullHistoryPrices,
  resolveConfiguredMarketPrices,
  resolveEbayMarketPrices,
  resolveMarketPrices,
  requestsPerMinute,
  retryDelayMs,
  savePricingSettings,
  signatureMarked,
  uniquePricingItems
};
