const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { ensurePullHistorySchema, replacePullHistorySnapshot } = require('./PullHistory');
const {
  applyCatalogCardPriceInputs,
  applyPullHistoryPriceInputs,
  chooseMarketCard,
  chooseMarketVariant,
  collectorNumberCandidates,
  createPacedFetch,
  displayedAuditCards,
  displayedCatalogCardIds,
  ebayListingMatches,
  ebayListingTotalCents,
  getPricingSettings,
  inputPriceCents,
  justRequest,
  marketCardSlug,
  marketSlug,
  medianCents,
  normalizePriceSource,
  numberCore,
  refreshCatalogCardPrices,
  refreshPullHistoryPrices,
  requestsPerMinute,
  retryDelayMs,
  savePricingSettings
} = require('./PullHistoryPricing');

assert.equal(numberCore('UNL-229*/219'), '229*/219');
assert.deepEqual(collectorNumberCandidates('UNL-229*/219'), ['UNL-229*/219', '229*/219', '229*']);
assert.equal(numberCore('VEN-038/160'), '038/160');
assert.deepEqual(collectorNumberCandidates('VEN-038/160'), ['VEN-038/160', '038/160', '038']);
assert.equal(requestsPerMinute({ _metadata: { apiPlan: 'Free' } }), 10);
assert.equal(requestsPerMinute({ _metadata: { apiRateLimit: 37, apiPlan: 'Free' } }), 37);
assert.equal(retryDelayMs('45', 0, 0, () => 0), 45250);
assert.equal(retryDelayMs('', 3, 0, () => 0), 8000);
assert.equal(marketSlug("Kha'Zix, Voidreaver"), 'kha-zix-voidreaver');
assert.equal(marketSlug('Daisy!'), 'daisy-exclamation');
assert.equal(normalizePriceSource('eBay Active Estimate'), 'ebay');
assert.equal(normalizePriceSource('ChatGPT Import'), 'chatgpt');
assert.equal(inputPriceCents({ priceUsd: '$12.34' }), 1234);
assert.equal(inputPriceCents({ priceCents: 987 }), 987);
assert.equal(medianCents([100, 500, 300, 200]), 250);
const displayedAudit = [{
  position: 2,
  family: [{ id: 20 }, { id: 99 }],
  bundleGroups: [{ cards: [{ id: 20 }, { id: 21 }, { id: 20 }] }]
}];
assert.deepEqual(displayedAuditCards(displayedAudit[0]).map(card => card.id), [20, 21, 20]);
assert.deepEqual(displayedCatalogCardIds([
  { id: 1, position: 1, block_status: 'ready' },
  { id: 2, position: 2, block_status: 'called' },
  { id: 3, position: 3, block_status: 'called' }
], displayedAudit), [20, 21, 1, 3]);
assert.equal(ebayListingTotalCents({
  price: { value: '12.50', currency: 'USD' },
  shippingOptions: [{ shippingCost: { value: '4.25', currency: 'USD' } }]
}), 1675);
assert.equal(marketCardSlug('riftbound-league-of-legends-trading-card-game', {
  set_name: 'Vendetta',
  card_name: 'Akali, Silent',
  rarity: 'Rare'
}), 'riftbound-league-of-legends-trading-card-game-vendetta-akali-silent-rare');

const signatureItem = {
  card_name: 'Vi, Piltover Enforcer',
  card_number: 'UNL-229*/219',
  set_code: 'UNL',
  set_name: 'Unleashed',
  rarity: 'Showcase',
  collector_treatment: 'Overnumbered · Signature'
};
const unsignedCard = { id: 'riftbound-unleashed-vi', name: 'Vi, Piltover Enforcer', number: '229/219', set_name: 'Unleashed', rarity: 'Showcase', variants: [] };
const signedCard = { id: 'riftbound-unleashed-vi-signature', name: 'Vi, Piltover Enforcer', number: '229*/219', set_name: 'Unleashed', rarity: 'Showcase', details: 'Signature', variants: [] };
assert.equal(ebayListingMatches(signatureItem, { title: 'Riftbound Unleashed Vi Piltover Enforcer UNL-229*/219 Signature Raw NM' }), true);
assert.equal(ebayListingMatches(signatureItem, { title: 'PSA 10 Riftbound Vi UNL-229*/219 Signature' }), false);
assert.equal(ebayListingMatches(signatureItem, { title: 'Riftbound Vi UNL-229*/219 lot of 4 cards' }), false);
assert.equal(chooseMarketCard(signatureItem, [unsignedCard, signedCard]), signedCard);
assert.equal(chooseMarketCard(signatureItem, [unsignedCard, { ...signedCard, number: '229/219' }]).details, 'Signature');
assert.equal(chooseMarketCard({ ...signatureItem, card_number: 'UNL-229/219', collector_treatment: 'Overnumbered' }, [signedCard, unsignedCard]), unsignedCard);

const foil = { condition: 'Near Mint', printing: 'Foil', language: 'English', price: 80 };
const normal = { condition: 'Near Mint', printing: 'Normal', language: 'English', price: 5 };
assert.equal(chooseMarketVariant(signatureItem, { variants: [normal, foil] }), foil);
assert.equal(chooseMarketVariant({ rarity: 'Rare', collector_treatment: '', variant_hint: '' }, { variants: [foil, normal] }), normal);

(async () => {
let pacedNow = 1000;
const pacedWaits = [];
const pacedCalls = [];
const pacedFetch = createPacedFetch(async value => {
  pacedCalls.push(value);
  return value;
}, 10, {
  now: () => pacedNow,
  sleep: async milliseconds => {
    pacedWaits.push(milliseconds);
    pacedNow += milliseconds;
  }
});
assert.equal(await pacedFetch('first'), 'first');
assert.equal(await pacedFetch('second'), 'second');
assert.deepEqual(pacedCalls, ['first', 'second']);
assert.deepEqual(pacedWaits, [6150, 6150]);

let retryCalls = 0;
const retryWaits = [];
const retried = await justRequest('tcg_test', 'GET', '/cards', undefined, async () => {
  retryCalls += 1;
  if (retryCalls === 1) return {
    ok: false,
    status: 429,
    headers: { get: name => String(name).toLowerCase() === 'retry-after' ? '2' : null },
    json: async () => ({ message: 'Rate limit exceeded' })
  };
  return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ data: [{ id: 'retried-card' }] }) };
}, {}, { sleep: async milliseconds => retryWaits.push(milliseconds), random: () => 0 });
assert.equal(retryCalls, 2);
assert.deepEqual(retryWaits, [2250]);
assert.equal(retried.data[0].id, 'retried-card');

const database = new DatabaseSync(':memory:');
database.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE card_sniper_settings(key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL);
  INSERT INTO card_sniper_settings(key, value, updated_at) VALUES('justtcg_key', 'tcg_test', '2026-08-18T00:00:00.000Z');
`);
ensurePullHistorySchema(database);
const saved = replacePullHistorySnapshot(database, {
  ledgerSavedAt: '2026-08-18T01:00:00.000Z',
  gameCode: 'RIFTBOUND',
  setName: 'Unleashed',
  spots: [{ buyerName: 'buyer', position: 4, paidCents: 2000 }],
  items: [{ ...signatureItem, buyerName: 'buyer', position: 4, cardName: signatureItem.card_name, cardNumber: signatureItem.card_number, setCode: 'UNL', collectorTreatment: signatureItem.collector_treatment, quantity: 2 }]
});
let calls = 0;
const fakeFetch = async (url, options = {}) => {
  calls += 1;
  if (String(url).endsWith('/games')) return { ok: true, json: async () => ({ data: [{ id: 'riftbound-league-of-legends-trading-card-game', name: 'Riftbound: League of Legends Trading Card Game' }] }) };
  if (options.method === 'POST') {
    const lookups = JSON.parse(options.body);
    assert.deepEqual(lookups, [{
      cardId: 'riftbound-league-of-legends-trading-card-game-unleashed-vi-piltover-enforcer-showcase',
      condition: 'NM',
      language: 'English'
    }]);
    return { ok: true, json: async () => ({ data: [] }) };
  }
  assert.equal(options.method, 'GET');
  const requestUrl = new URL(String(url));
  assert.equal(requestUrl.searchParams.get('number'), '229*/219');
  assert.equal(requestUrl.searchParams.get('include_price_history'), 'false');
  assert.equal(requestUrl.searchParams.has('include_statistics'), false);
  return { ok: true, json: async () => ({ data: [{ ...signedCard, variants: [foil] }] }) };
};
const priced = await refreshPullHistoryPrices(database, saved.id, fakeFetch);
assert.equal(calls, 3);
assert.equal(priced.matchedCards, 2);
assert.equal(priced.marketValueCents, 16000);
assert.equal(database.prepare('SELECT market_price_cents FROM pull_history_items').get().market_price_cents, 8000);

database.exec(`
  CREATE TABLE cards (
    id INTEGER PRIMARY KEY,
    game_code TEXT NOT NULL,
    name TEXT NOT NULL,
    card_number TEXT,
    set_code TEXT,
    set_name TEXT,
    rarity TEXT,
    variant TEXT NOT NULL DEFAULT '',
    manual_category TEXT NOT NULL DEFAULT '',
    market_price_cents INTEGER,
    market_price_source TEXT NOT NULL DEFAULT '',
    market_price_variant TEXT NOT NULL DEFAULT '',
    market_price_external_id TEXT NOT NULL DEFAULT '',
    market_price_updated_at TEXT,
    market_price_match_status TEXT NOT NULL DEFAULT ''
  );
  INSERT INTO cards (id, game_code, name, card_number, set_code, set_name, rarity, variant, manual_category)
  VALUES (7, 'RIFTBOUND', 'Vi, Piltover Enforcer', 'UNL-229*/219', 'UNL', 'Unleashed', 'Showcase', 'Signature', 'Signature');
`);
calls = 0;
const catalogPriced = await refreshCatalogCardPrices(database, [7], fakeFetch);
assert.equal(calls, 3);
assert.equal(catalogPriced.matchedCards, 1);
assert.equal(catalogPriced.unmatchedCards, 0);
assert.equal(catalogPriced.prices[0].market_price_cents, 8000);
assert.deepEqual({ ...database.prepare(`
  SELECT market_price_cents, market_price_source, market_price_match_status
FROM cards WHERE id = 7
`).get() }, { market_price_cents: 8000, market_price_source: 'JustTCG', market_price_match_status: 'matched' });

let pricingSettings = savePricingSettings(database, { selectedSource: 'manual' });
assert.equal(pricingSettings.selectedSource, 'manual');
const manualCatalog = applyCatalogCardPriceInputs(
  database,
  [7],
  [{ id: 7, priceUsd: '42.50', note: 'Local raw NM comp' }],
  'manual'
);
assert.equal(manualCatalog.marketValueCents, 4250);
assert.deepEqual({ ...database.prepare(`
  SELECT market_price_cents, market_price_source, market_price_variant
  FROM cards WHERE id = 7
`).get() }, { market_price_cents: 4250, market_price_source: 'Manual', market_price_variant: 'Local raw NM comp' });

const importedPull = applyPullHistoryPriceInputs(
  database,
  saved.id,
  [{ id: 1, priceUsd: 79.25, sourceUrl: 'https://example.com/vi' }],
  'chatgpt'
);
assert.equal(importedPull.marketValueCents, 15850);
assert.deepEqual({ ...database.prepare(`
  SELECT market_price_cents, market_source, market_external_id
  FROM pull_history_items WHERE id = 1
`).get() }, { market_price_cents: 7925, market_source: 'ChatGPT Import', market_external_id: 'https://example.com/vi' });

pricingSettings = savePricingSettings(database, {
  selectedSource: 'ebay',
  ebayClientId: 'production-client-id',
  ebayClientSecret: 'production-client-secret'
});
assert.equal(pricingSettings.selectedSource, 'ebay');
assert.equal(pricingSettings.ebayConfigured, true);
let ebayCalls = 0;
const fakeEbayFetch = async (url, options = {}) => {
  ebayCalls += 1;
  if (String(url).includes('/identity/v1/oauth2/token')) {
    assert.equal(options.method, 'POST');
    assert.match(options.headers.Authorization, /^Basic /);
    return { ok: true, status: 200, json: async () => ({ access_token: 'ebay-test-token', expires_in: 7200 }) };
  }
  const requestUrl = new URL(String(url));
  assert.equal(requestUrl.pathname, '/buy/browse/v1/item_summary/search');
  assert.match(requestUrl.searchParams.get('q'), /Vi, Piltover Enforcer/);
  assert.match(requestUrl.searchParams.get('filter'), /FIXED_PRICE/);
  assert.equal(options.headers.Authorization, 'Bearer ebay-test-token');
  return {
    ok: true,
    status: 200,
    json: async () => ({
      itemSummaries: [
        { itemId: 'one', title: 'Riftbound Unleashed Vi Piltover Enforcer UNL-229*/219 Signature Raw NM', price: { value: '75.00', currency: 'USD' }, shippingOptions: [{ shippingCost: { value: '5.00', currency: 'USD' } }] },
        { itemId: 'two', title: 'Vi Piltover Enforcer Signature UNL-229*/219 Riftbound Unleashed NM', price: { value: '85.00', currency: 'USD' }, shippingOptions: [{ shippingCost: { value: '0.00', currency: 'USD' } }] },
        { itemId: 'graded', title: 'PSA 10 Vi Piltover Enforcer Signature UNL-229*/219 Riftbound', price: { value: '300.00', currency: 'USD' } }
      ]
    })
  };
};
const ebayCatalog = await refreshCatalogCardPrices(database, [7], fakeEbayFetch);
assert.equal(ebayCalls, 2);
assert.equal(ebayCatalog.prices[0].market_price_cents, 8250);
assert.equal(ebayCatalog.prices[0].market_price_source, 'eBay Active Estimate');
assert.match(ebayCatalog.prices[0].market_price_variant, /median of 2/i);
assert.equal(getPricingSettings(database).selectedLabel, 'eBay Active Estimate');
database.close();

console.log('Pull History pricing checks passed.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
