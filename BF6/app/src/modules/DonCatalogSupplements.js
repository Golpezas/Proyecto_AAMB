const crypto = require('node:crypto');
const { load } = require('cheerio');

// Bandai's Card List is the primary catalog source. Some DON!! printings are
// published only with their product or promotional release, however, so they
// have no individual Bandai Card List entry to import. This public card index
// is used strictly for those missing DON!! names, set labels, and card art.
// It is never used for pricing, inventory, or the normal card catalog.
const DON_CATALOG_INDEX = 'https://www.optcgapi.com/analytics/don/';
const DON_CATALOG_HOST = 'www.optcgapi.com';
// The public image route is more durable than the website's individual media
// filenames: it serves a curated scan first and then the matching full-card
// collector image. Some older static media paths (including a few EB-03
// DON!! cards) no longer resolve even though the card record still exists.
const DON_IMAGE_PROXY_BASE = 'https://optcg-api.arjunbansal-ai.workers.dev/images/';

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function stableDonId(indexId) {
  return crypto.createHash('sha1').update(`breaksuite6:don-catalog:${indexId}`).digest('hex');
}

function donImageProxyUrl(indexId) {
  return `${DON_IMAGE_PROXY_BASE}DON-${String(Number(indexId)).padStart(3, '0')}?v=5`;
}

function normaliseSetCode(value) {
  const source = clean(value).toUpperCase();
  if (/\bOP\s*-?\s*PR\b/.test(source)) return 'OP-PR';
  if (/\bOPDD\b/.test(source)) return 'OPDD';
  const found = source.match(/\b(OP|ST|EB|PRB|PB|DP|P)\s*-?\s*(\d{1,3})\b/);
  if (!found) return '';
  const prefix = found[1];
  const number = String(Number(found[2])).padStart(2, '0');
  return `${prefix}-${number}`;
}

function extractDonDetailIds(html) {
  const $ = load(html);
  const ids = new Set();
  $('a[href]').each((_index, element) => {
    const href = String($(element).attr('href') || '');
    const match = href.match(/\/analytics\/don\/(\d+)(?:[/?#]|$)/i);
    if (match) ids.add(Number(match[1]));
  });
  return [...ids].sort((left, right) => left - right);
}

function discoverPageCount(html) {
  const $ = load(html);
  let highest = 1;
  $('a[href]').each((_index, element) => {
    const href = String($(element).attr('href') || '');
    const match = href.match(/[?&]page=(\d+)/i);
    if (match) highest = Math.max(highest, Number(match[1]));
  });
  return highest;
}

function firstCardArtUrl($, pageUrl) {
  const candidates = $('img').toArray().map(element => {
    const image = $(element);
    return image.attr('data-src') || image.attr('data-original') || image.attr('src') || '';
  }).map(value => String(value || '').trim()).filter(Boolean);
  const candidate = candidates.find(value => /\/media\/static\/Card_Images\//i.test(value));
  if (!candidate) return '';
  try {
    const imageUrl = new URL(candidate, pageUrl).href;
    return new URL(imageUrl).hostname === DON_CATALOG_HOST ? imageUrl : '';
  } catch {
    return '';
  }
}

function detailLabelFromPage($, bodyText) {
  const matched = bodyText.match(/OPTCG\s+Don\s+Name:\s*([\s\S]*?)(?=\s+(?:Yesterday's|Image ID|Get JSON|Close)\b|$)/i);
  if (matched) return clean(matched[1]);
  const headings = $('h1, h2, h3, h4').toArray().map(element => clean($(element).text()));
  return headings.find(value => /DON!!/i.test(value)) || '';
}

function nameFromPage($, label) {
  const headings = $('h1, h2, h3, h4').toArray().map(element => clean($(element).text()));
  const heading = headings.find(value => /^DON!!\s*Card/i.test(value));
  if (heading) return heading;
  const fromLabel = clean(label).match(/^(DON!!\s*Card(?:\s*\([^)]*\))*)/i);
  return fromLabel ? fromLabel[1] : 'DON!! Card';
}

function donCardFromDetail(html, pageUrl, indexId) {
  const $ = load(html);
  const bodyText = clean($('body').text());
  const label = detailLabelFromPage($, bodyText);
  const name = nameFromPage($, label);
  const setCode = normaliseSetCode(label);
  const originalImageUrl = firstCardArtUrl($, pageUrl);
  if (!label || !/DON!!/i.test(name) || !originalImageUrl) return null;
  const imageUrl = donImageProxyUrl(indexId);
  return {
    official_id: stableDonId(indexId),
    name,
    card_number: '',
    set_code: setCode,
    rarity: /\bgold\b/i.test(`${name} ${label}`) ? 'GOLD DON' : 'DON!! CARD',
    color: '',
    card_type: 'DON!! CARD',
    life: '',
    cost: '',
    attribute: '',
    power: '',
    counter: '',
    block: '',
    traits: '',
    effect: '',
    image_url: imageUrl,
    detail_url: pageUrl,
    setName: label,
    raw_details: `Supplemental DON!! catalog record: ${label}. No price or inventory data is imported. Source media: ${originalImageUrl}`,
    source: 'Bandai DON supplement',
    product_only: true
  };
}

function pageUrl(page) {
  return page === 1 ? DON_CATALOG_INDEX : `${DON_CATALOG_INDEX}?page=${page}`;
}

async function fetchPublicPage(url, signal) {
  const parsed = new URL(url);
  if (parsed.hostname !== DON_CATALOG_HOST) throw new Error('The DON!! supplement only accepts its documented public card index.');
  const response = await fetch(url, {
    signal,
    headers: {
      'User-Agent': 'BreakSuite6 DON!! library supplement/0.3.10',
      Accept: 'text/html,application/xhtml+xml'
    }
  });
  if (!response.ok) throw new Error(`The DON!! catalog returned ${response.status}.`);
  return { html: await response.text(), url: response.url };
}

async function mapWithConcurrency(items, concurrency, task) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      await task(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, worker));
}

async function fetchDonCatalog({ signal, onProgress = () => {} } = {}) {
  const firstPage = await fetchPublicPage(pageUrl(1), signal);
  const pages = discoverPageCount(firstPage.html);
  const ids = new Set(extractDonDetailIds(firstPage.html));
  for (let page = 2; page <= pages; page += 1) {
    const result = await fetchPublicPage(pageUrl(page), signal);
    for (const id of extractDonDetailIds(result.html)) ids.add(id);
  }
  const detailIds = [...ids].sort((left, right) => left - right);
  if (!detailIds.length) throw new Error('The DON!! catalog did not provide any card records.');

  const cards = [];
  await mapWithConcurrency(detailIds, 5, async (id, index) => {
    try {
      const detailUrl = `${DON_CATALOG_INDEX}${id}`;
      const detail = await fetchPublicPage(detailUrl, signal);
      const card = donCardFromDetail(detail.html, detail.url, id);
      if (card) cards.push(card);
    } catch {
      // One changed or unavailable detail page must not make the rest of the
      // local DON!! catalog unusable.
    } finally {
      onProgress({ complete: cards.length, total: detailIds.length, currentId: id, index });
    }
  });
  if (!cards.length) throw new Error('The DON!! catalog did not provide usable card artwork.');
  return cards.sort((left, right) => left.official_id.localeCompare(right.official_id));
}

module.exports = {
  DON_CATALOG_INDEX,
  DON_CATALOG_HOST,
  DON_IMAGE_PROXY_BASE,
  discoverPageCount,
  donCardFromDetail,
  donImageProxyUrl,
  extractDonDetailIds,
  fetchDonCatalog,
  normaliseSetCode,
  stableDonId
};
