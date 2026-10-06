const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs/promises');
const { load } = require('cheerio');

const OFFICIAL_CARD_LIST = 'https://en.onepiece-cardgame.com/cardlist/';
const OFFICIAL_HOST = 'en.onepiece-cardgame.com';
const CARD_NUMBER_PATTERN = '(?:[A-Z]{1,6}\\d{0,3}-\\d{3}|DON!!(?:\\s*CARD)?(?:\\s*[-#]?\\d{1,3})?)';
// Standard cards have three parts: number | rarity | type.  Bandai's DON!!
// entries are not consistent: some use that layout and some use only
// "DON!! CARD | DON!! CARD".  The middle (rarity) part is deliberately
// optional so neither format is silently discarded.
const HEADER_PATTERN = new RegExp(`(${CARD_NUMBER_PATTERN})\\s*\\|\\s*(?:([^|]{1,24}?)\\s*\\|\\s*)?(LEADER|CHARACTER|EVENT|STAGE|DON!!(?:\\s*CARD)?)`, 'i');
const LABELS = ['Life', 'Cost', 'Attribute', 'Power', 'Counter', 'Color', 'Block icon', 'Block', 'Type', 'Effect', 'Card Set(s)'];

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function cleanCardName(value) {
  return clean(value).replace(/\b(?:TEXT VIEW|CARD VIEW)\b/gi, '').replace(/\s+/g, ' ').trim();
}

function normalizedRarity(rarity, cardType, name, imageUrl, text) {
  const source = `${name || ''} ${imageUrl || ''} ${text || ''}`;
  if (/DON!!/i.test(cardType) && /\bgold\b/i.test(source)) return 'GOLD DON';
  if (/DON!!/i.test(cardType)) return 'DON!! CARD';
  return clean(rarity);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fieldFromText(text, label) {
  const nextLabels = LABELS.filter(item => item !== label).map(escapeRegExp).join('|');
  const expression = new RegExp(`${escapeRegExp(label)}\\s*([\\s\\S]*?)(?=\\s+(?:${nextLabels})(?=\\s|\\d|-|\\[|$)|$)`);
  const found = text.match(expression);
  return found ? clean(found[1]) : '';
}

function isOfficialUrl(url) {
  try {
    return new URL(url).hostname === OFFICIAL_HOST;
  } catch {
    return false;
  }
}

function imageExtension(url, contentType = '') {
  const fromPath = path.extname(new URL(url).pathname).toLowerCase();
  if (/^\.(png|jpe?g|webp)$/i.test(fromPath)) return fromPath === '.jpeg' ? '.jpg' : fromPath;
  if (/png/i.test(contentType)) return '.png';
  if (/webp/i.test(contentType)) return '.webp';
  return '.jpg';
}

function findCardImage($, element, name, pageUrl) {
  const images = $(element).find('img').toArray().map(image => {
    const node = $(image);
    const candidates = [
      node.attr('data-src'),
      node.attr('data-original'),
      node.attr('data-lazy-src'),
      node.attr('data-image'),
      node.closest('a').attr('href'),
      node.attr('src')
    ].map(value => String(value || '').trim()).filter(Boolean);
    const officialCardFile = candidates.find(value => /\/images\/cardlist\/card\//i.test(value));
    const nonPlaceholder = candidates.find(value => !/^(data:|#)|(?:blank|placeholder|loading|transparent|no[_-]?image)/i.test(value));
    return {
      src: officialCardFile || nonPlaceholder || '',
      alt: clean(node.attr('alt'))
    };
  }).filter(image => image.src);
  const normalizedName = cleanCardName(name).toLowerCase();
  const matchingName = images.find(image => cleanCardName(image.alt).toLowerCase() === normalizedName);
  const likelyCard = images.find(image => /card|cardlist/i.test(image.src));
  const selected = matchingName || likelyCard || images[0];
  if (!selected) return '';
  try {
    const url = new URL(selected.src, pageUrl).href;
    return isOfficialUrl(url) ? url : '';
  } catch {
    return '';
  }
}

function cardFromElement($, element, pageUrl) {
  const text = clean($(element).text());
  const header = text.match(HEADER_PATTERN);
  if (!header) return null;
  const cardType = clean(header[3]);
  const isDonCard = /DON!!/i.test(cardType);
  // Unlike normal cards, official DON!! entries can be image-only records
  // without the normal detail fields or a Card Set(s) line.
  if (!isDonCard && !/Card Set\(s\)/.test(text)) return null;
  const afterHeader = text.slice((header.index || 0) + header[0].length);
  let name = cleanCardName(afterHeader.split(/\s+(?:Life|Cost|Attribute|Power|Counter|Color|Block(?: icon)?|Type|Effect|Card Set\(s\))(?=\s|\d|-|\[|$)/)[0]);
  const imageUrl = findCardImage($, element, name, pageUrl);
  if (!name && isDonCard) {
    const image = $(element).find('img').first();
    name = cleanCardName(image.attr('alt')) || 'DON!! Card';
  }
  if (!name || name.length > 160) return null;

  const number = clean(header[1]);
  const sourceRarity = clean(header[2]) || (isDonCard ? 'DON!! CARD' : '');
  const rarity = normalizedRarity(sourceRarity, cardType, name, imageUrl, text);
  const fields = {
    life: fieldFromText(text, 'Life'),
    cost: fieldFromText(text, 'Cost'),
    attribute: fieldFromText(text, 'Attribute'),
    power: fieldFromText(text, 'Power'),
    counter: fieldFromText(text, 'Counter'),
    color: fieldFromText(text, 'Color'),
    block: fieldFromText(text, 'Block icon') || fieldFromText(text, 'Block'),
    traits: fieldFromText(text, 'Type'),
    effect: fieldFromText(text, 'Effect'),
    setName: fieldFromText(text, 'Card Set(s)')
  };
  const identitySource = [number, rarity, cardType, name, imageUrl || text].join('|');
  const officialId = crypto.createHash('sha1').update(identitySource).digest('hex');
  return {
    official_id: officialId,
    name,
    card_number: number,
    rarity,
    card_type: cardType,
    image_url: imageUrl,
    detail_url: pageUrl,
    ...fields,
    raw_details: text,
    score: (imageUrl ? 10 : 0) + LABELS.filter(label => text.includes(label)).length
  };
}

function extractCards(html, pageUrl) {
  const $ = load(html);
  const bestById = new Map();
  $('body *').each((_index, element) => {
    const text = clean($(element).text());
    const hasDonHeader = /DON!!(?:\s*CARD)?\s*\|/i.test(text);
    if ((text.length < 50 && !hasDonHeader) || text.length > 4500 || !HEADER_PATTERN.test(text)) return;
    const headers = text.match(new RegExp(HEADER_PATTERN.source, 'gi')) || [];
    if (headers.length !== 1) return;
    const card = cardFromElement($, element, pageUrl);
    if (!card) return;
    const existing = bestById.get(card.official_id);
    if (!existing || card.score > existing.score) bestById.set(card.official_id, card);
  });
  return [...bestById.values()].map(({ score, ...card }) => card);
}

function discoverSeriesIds(html, finalUrl) {
  const $ = load(html);
  const ids = new Set();
  const capture = (value, allowBareId = false) => {
    const raw = String(value || '').trim();
    const match = raw.match(/[?&]series=(\d+)/i);
    if (match) ids.add(match[1]);
    if (allowBareId && /^\d{4,}$/.test(raw)) ids.add(raw);
  };
  $('option, a, input, button').each((_index, element) => {
    capture($(element).attr('value'), element.tagName === 'option');
    capture($(element).attr('href'));
    capture($(element).attr('data-url'));
    capture($(element).attr('data-value'));
  });
  for (const match of html.matchAll(/[?&]series=(\d+)/gi)) ids.add(match[1]);
  capture(finalUrl);
  return [...ids].sort((left, right) => Number(left) - Number(right));
}

async function fetchOfficial(url, signal) {
  if (!isOfficialUrl(url)) throw new Error('The importer only accepts the official Bandai card-list website.');
  const response = await fetch(url, {
    signal,
    headers: {
      'User-Agent': 'BreakSuite6 Official Card Library/0.2',
      Accept: 'text/html,application/xhtml+xml'
    }
  });
  if (!response.ok) throw new Error(`Bandai returned ${response.status} while loading the card list.`);
  return { html: await response.text(), url: response.url };
}

async function eachWithConcurrency(items, concurrency, task) {
  let index = 0;
  const worker = async () => {
    while (index < items.length) {
      const current = items[index++];
      await task(current);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}

class BandaiImporter {
  constructor({ imageDirectory, saveCards, onProgress }) {
    this.imageDirectory = imageDirectory;
    this.saveCards = saveCards;
    this.onProgress = onProgress || (() => {});
  }

  progress(update) {
    this.onProgress({ source: 'Official Bandai One Piece Card Game', ...update });
  }

  async cacheImage(card, signal) {
    if (!card.image_url || !isOfficialUrl(card.image_url)) return '';
    await fs.mkdir(this.imageDirectory, { recursive: true });
    const response = await fetch(card.image_url, {
      signal,
      headers: { 'User-Agent': 'BreakSuite6 Official Card Library/0.2', Accept: 'image/*' }
    });
    if (!response.ok) return '';
    const extension = imageExtension(card.image_url, response.headers.get('content-type') || '');
    const filename = `${crypto.createHash('sha1').update(card.image_url).digest('hex')}${extension}`;
    const destination = path.join(this.imageDirectory, filename);
    try {
      await fs.access(destination);
      return destination;
    } catch { /* First time downloading this image. */ }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) return '';
    const temporary = `${destination}.part`;
    await fs.writeFile(temporary, bytes);
    await fs.rename(temporary, destination);
    return destination;
  }

  async importEverything() {
    const controller = new AbortController();
    const startedAt = new Date().toISOString();
    this.progress({ phase: 'discovering', message: 'Finding official Bandai card sets…', importedCards: 0, cachedImages: 0 });
    const firstPage = await fetchOfficial(OFFICIAL_CARD_LIST, controller.signal);
    const seriesIds = discoverSeriesIds(firstPage.html, firstPage.url);
    if (!seriesIds.length) throw new Error('Bandai did not provide a card-set list to import. Please try Refresh again later.');

    let totalCards = 0;
    let cachedImages = 0;
    for (let current = 0; current < seriesIds.length; current += 1) {
      const seriesId = seriesIds[current];
      const pageUrl = `${OFFICIAL_CARD_LIST}?series=${encodeURIComponent(seriesId)}`;
      this.progress({ phase: 'downloading', message: `Downloading official set ${current + 1} of ${seriesIds.length}…`, currentSet: current + 1, totalSets: seriesIds.length, importedCards: totalCards, cachedImages });
      const page = current === 0 && firstPage.url.includes(`series=${seriesId}`) ? firstPage : await fetchOfficial(pageUrl, controller.signal);
      const cards = extractCards(page.html, page.url);
      if (!cards.length) continue;

      const saved = this.saveCards(cards, startedAt);
      totalCards += saved;
      this.progress({ phase: 'saving', message: `Saved ${totalCards.toLocaleString()} official card records…`, currentSet: current + 1, totalSets: seriesIds.length, importedCards: totalCards, cachedImages });

      await eachWithConcurrency(cards, 4, async card => {
        try {
          const imagePath = await this.cacheImage(card, controller.signal);
          if (imagePath) {
            this.saveCards([{ ...card, image_path: imagePath }], startedAt);
            cachedImages += 1;
          }
        } catch {
          // A missing image never prevents its official text record from being saved.
        }
      });
      this.progress({ phase: 'caching-images', message: `Cached ${cachedImages.toLocaleString()} official card images…`, currentSet: current + 1, totalSets: seriesIds.length, importedCards: totalCards, cachedImages });
    }
    this.progress({ phase: 'complete', message: `Import complete — ${totalCards.toLocaleString()} official cards saved.`, currentSet: seriesIds.length, totalSets: seriesIds.length, importedCards: totalCards, cachedImages, completedAt: new Date().toISOString() });
    return { importedCards: totalCards, cachedImages, sets: seriesIds.length, startedAt };
  }
}

module.exports = { BandaiImporter, extractCards, discoverSeriesIds, OFFICIAL_CARD_LIST };
