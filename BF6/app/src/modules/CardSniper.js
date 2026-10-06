const JUST_ROOT = 'https://api.justtcg.com/v1';

const GAMES = Object.freeze({
  ONEPIECE: Object.freeze({
    code: 'ONEPIECE',
    name: 'One Piece Card Game',
    fallbackId: 'one-piece-card-game',
    match: value => /ONE\s*PIECE/i.test(String(value || '')),
    buySlug: 'one-piece-card-game'
  }),
  RIFTBOUND: Object.freeze({
    code: 'RIFTBOUND',
    name: 'Riftbound: League of Legends Trading Card Game',
    fallbackId: 'riftbound-league-of-legends-trading-card-game',
    match: value => /RIFTBOUND/i.test(String(value || '')),
    buySlug: 'riftbound-tcg'
  })
});

const RIFTBOUND_SETS = Object.freeze([
  Object.freeze({ set_code: 'OGN', set_name: 'Origins', set_order: 1 }),
  Object.freeze({ set_code: 'OGS', set_name: 'Origins - Proving Grounds', set_order: 2 }),
  Object.freeze({ set_code: 'SFD', set_name: 'Spiritforged', set_order: 3 }),
  Object.freeze({ set_code: 'UNL', set_name: 'Unleashed', set_order: 4 }),
  Object.freeze({ set_code: 'VEN', set_name: 'Vendetta', set_order: 5 })
]);

const RIFTBOUND_SET_BY_CODE = new Map(RIFTBOUND_SETS.map(set => [set.set_code, set]));

function norm(value = '') {
  return String(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function num(value) {
  value = Number(value);
  return Number.isFinite(value) ? value : null;
}

function gameCode(value = '') {
  return norm(value).includes('RIFTBOUND') ? 'RIFTBOUND' : 'ONEPIECE';
}

function parseTarget(value = '') {
  const raw = String(value || '').trim();
  const separator = raw.indexOf('::');
  if (separator < 0) {
    return { gameCode: 'ONEPIECE', setCode: raw, selectionKey: raw };
  }
  const selectedGame = gameCode(raw.slice(0, separator));
  const setCode = raw.slice(separator + 2).trim();
  return { gameCode: selectedGame, setCode, selectionKey: `${selectedGame}::${setCode}` };
}

function initCardSniper(db) {
  db.exec(`
CREATE TABLE IF NOT EXISTS card_sniper_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS card_sniper_market_snapshots(id INTEGER PRIMARY KEY AUTOINCREMENT,external_id TEXT NOT NULL,game_code TEXT NOT NULL DEFAULT 'ONEPIECE',set_code TEXT NOT NULL,name TEXT NOT NULL DEFAULT '',card_number TEXT NOT NULL DEFAULT '',rarity TEXT NOT NULL DEFAULT '',variant TEXT NOT NULL DEFAULT '',image_url TEXT NOT NULL DEFAULT '',scanned_at TEXT NOT NULL,market_price REAL,low_price REAL,fair_price REAL,source TEXT NOT NULL DEFAULT '',buy_url TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS idx_sniper_market_key_time ON card_sniper_market_snapshots(external_id,scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_sniper_market_set_time ON card_sniper_market_snapshots(set_code,scanned_at DESC);`);

  try {
    const columns = db.prepare('PRAGMA table_info(card_sniper_market_snapshots)').all();
    if (!columns.some(column => column.name === 'game_code')) {
      db.exec("ALTER TABLE card_sniper_market_snapshots ADD COLUMN game_code TEXT NOT NULL DEFAULT 'ONEPIECE'");
    }
  } catch (error) {
    if (!/duplicate column/i.test(String(error?.message || ''))) throw error;
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_sniper_market_game_set_time ON card_sniper_market_snapshots(game_code,set_code,scanned_at DESC)');
}

function getSetting(db, key) {
  return db.prepare('SELECT value FROM card_sniper_settings WHERE key=?').get(key)?.value || '';
}

function saveSetting(db, key, value) {
  db.prepare(`INSERT INTO card_sniper_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`)
    .run(key, String(value || '').trim(), new Date().toISOString());
}

function setSettings(db, settings = {}) {
  if (Object.hasOwn(settings, 'justTcgKey') && String(settings.justTcgKey || '').trim()) {
    saveSetting(db, 'justtcg_key', settings.justTcgKey);
  }
  return getStatus(db);
}

function mask(value) {
  return value ? `${value.slice(0, 4)}••••${value.slice(-4)}` : '';
}

function getStatus(db) {
  const key = getSetting(db, 'justtcg_key');
  return { configured: Boolean(key), justTcgConfigured: Boolean(key), justTcgKey: mask(key) };
}

async function justGet(db, path, params = {}) {
  const key = getSetting(db, 'justtcg_key');
  if (!key) {
    throw new Error('JustTCG is not connected yet. Open Market Data Setup and add your free API key once.');
  }
  const url = new URL(`${JUST_ROOT}${path}`);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(name, String(value));
  }
  const response = await fetch(url, { headers: { Accept: 'application/json', 'x-api-key': key } });
  let data = null;
  try { data = await response.json(); } catch {}
  if (!response.ok) {
    const message = data?.detail || data?.message || data?.error || `HTTP ${response.status}`;
    throw new Error(`JustTCG search failed: ${message}`);
  }
  return data || {};
}

function list(data) {
  return Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
}

function premium(card, price, printing = '', selectedGame = 'ONEPIECE') {
  const text = `${card.rarity || ''} ${card.details || ''} ${printing || ''} ${card.name || ''}`.toUpperCase();
  if (Number(price || 0) >= 5) return true;
  if (gameCode(selectedGame) === 'RIFTBOUND') {
    return /EPIC|ALTERNATE|ALT.?ART|SHOWCASE|OVERNUMBERED|SIGNATURE|PROMO|SPECIAL|\bSP\b/.test(text);
  }
  return /MANGA|SPECIAL|TREASURE|GOLD|PREMIUM|ALT|PARALLEL|SECRET|LEADER|SUPER.?RARE|FOIL|PROMO|\bSP\b|\bTR\b/.test(text);
}

function pctBelow(current, fair) {
  current = num(current);
  fair = num(fair);
  return current != null && fair && current < fair ? ((fair - current) / fair) * 100 : null;
}

function score(row) {
  const discount = pctBelow(row.market_price, row.fair_price);
  return { discountPct: discount, signal: discount >= 20 ? 'SNIPE' : discount >= 10 ? 'WATCH' : 'PASS' };
}

function whatnotSearchUrl(card = {}) {
  const selectedGame = gameCode(card.game_code || card.gameCode || 'ONEPIECE');
  const gameName = selectedGame === 'RIFTBOUND' ? 'Riftbound' : 'One Piece';
  const query = [
    card.name,
    card.set_code || card.setCode,
    card.card_number || card.cardNumber,
    card.rarity,
    card.variant,
    gameName
  ].map(value => String(value || '').trim()).filter(Boolean).join(' ');
  return query ? `https://www.whatnot.com/search?q=${encodeURIComponent(query)}` : 'https://www.whatnot.com/';
}

function getSets(db) {
  const imported = db.prepare(`
SELECT UPPER(TRIM(COALESCE(NULLIF(game_code,''),'ONEPIECE'))) game_code,
       set_code,
       MAX(COALESCE(NULLIF(set_name,''),product_name,set_code)) set_name,
       COUNT(*) card_count
FROM cards
WHERE UPPER(TRIM(COALESCE(NULLIF(game_code,''),'ONEPIECE'))) IN ('ONEPIECE','RIFTBOUND')
  AND TRIM(COALESCE(set_code,''))!=''
GROUP BY UPPER(TRIM(COALESCE(NULLIF(game_code,''),'ONEPIECE'))),set_code`).all();

  const rows = new Map();
  for (const set of RIFTBOUND_SETS) {
    rows.set(`RIFTBOUND::${set.set_code}`, {
      game_code: 'RIFTBOUND',
      game_name: GAMES.RIFTBOUND.name,
      set_code: set.set_code,
      set_name: set.set_name,
      card_count: 0,
      set_order: set.set_order
    });
  }
  for (const row of imported) {
    const selectedGame = gameCode(row.game_code);
    const importedCode = String(row.set_code || '').trim();
    const code = selectedGame === 'RIFTBOUND' ? importedCode.toUpperCase() : importedCode;
    if (!code) continue;
    const key = `${selectedGame}::${code}`;
    const known = selectedGame === 'RIFTBOUND' ? RIFTBOUND_SET_BY_CODE.get(code.toUpperCase()) : null;
    rows.set(key, {
      ...rows.get(key),
      ...row,
      game_code: selectedGame,
      game_name: GAMES[selectedGame].name,
      set_code: code,
      set_name: row.set_name || known?.set_name || code,
      card_count: Number(row.card_count || 0),
      set_order: known?.set_order || 999
    });
  }

  return [...rows.values()].map(row => ({
    ...row,
    selection_key: `${row.game_code}::${row.set_code}`
  })).sort((a, b) => {
    if (a.game_code !== b.game_code) return a.game_code === 'ONEPIECE' ? -1 : 1;
    if (a.game_code === 'RIFTBOUND') return b.set_order - a.set_order;
    return String(b.set_code).localeCompare(String(a.set_code), undefined, { numeric: true });
  });
}

function latestRows(db, targetValue) {
  const target = parseTarget(targetValue);
  const code = norm(target.setCode);
  return db.prepare(`
SELECT * FROM card_sniper_market_snapshots
WHERE UPPER(TRIM(COALESCE(NULLIF(game_code,''),'ONEPIECE')))=?
  AND REPLACE(REPLACE(UPPER(set_code),'-',''),' ','')=?
  AND id IN(
    SELECT MAX(id) FROM card_sniper_market_snapshots
    WHERE UPPER(TRIM(COALESCE(NULLIF(game_code,''),'ONEPIECE')))=?
      AND REPLACE(REPLACE(UPPER(set_code),'-',''),' ','')=?
    GROUP BY external_id
  )
ORDER BY market_price DESC`).all(target.gameCode, code, target.gameCode, code);
}

function getLatest(db, targetValue) {
  return latestRows(db, targetValue).map(row => ({
    ...row,
    whatnot_url: whatnotSearchUrl(row),
    change24h: null,
    change7d: null,
    change30d: null,
    ...score(row)
  }));
}

function localImage(db, target, number, name) {
  try {
    const game = target.gameCode;
    const setCode = target.setCode;
    let row = null;
    const rawNumber = String(number || '').trim();
    const candidates = [rawNumber];
    if (game === 'RIFTBOUND' && rawNumber && !new RegExp(`^${setCode}-`, 'i').test(rawNumber)) {
      candidates.push(`${setCode}-${rawNumber}`);
    }
    for (const candidate of [...new Set(candidates.filter(Boolean))]) {
      row = db.prepare(`
SELECT image_url FROM cards
WHERE UPPER(TRIM(COALESCE(NULLIF(game_code,''),'ONEPIECE')))=?
  AND REPLACE(REPLACE(UPPER(set_code),'-',''),' ','')=?
  AND UPPER(card_number)=UPPER(?)
  AND TRIM(COALESCE(image_url,''))!=''
ORDER BY CASE WHEN UPPER(COALESCE(rarity,'')) LIKE '%ALT%' THEN 0 ELSE 1 END,id DESC LIMIT 1`)
        .get(game, norm(setCode), candidate);
      if (row) break;
    }
    if (!row && game === 'RIFTBOUND' && rawNumber) {
      const shortNumber = rawNumber.replace(new RegExp(`^${setCode}-`, 'i'), '').replace(/\/.*$/, '');
      row = db.prepare(`
SELECT image_url FROM cards
WHERE UPPER(TRIM(COALESCE(NULLIF(game_code,''),'ONEPIECE')))=?
  AND REPLACE(REPLACE(UPPER(set_code),'-',''),' ','')=?
  AND UPPER(card_number) LIKE UPPER(?)
  AND TRIM(COALESCE(image_url,''))!=''
ORDER BY id DESC LIMIT 1`).get(game, norm(setCode), `${setCode}-${shortNumber}%`);
    }
    if (!row && name) {
      row = db.prepare(`
SELECT image_url FROM cards
WHERE UPPER(TRIM(COALESCE(NULLIF(game_code,''),'ONEPIECE')))=?
  AND REPLACE(REPLACE(UPPER(set_code),'-',''),' ','')=?
  AND UPPER(name)=UPPER(?)
  AND TRIM(COALESCE(image_url,''))!=''
ORDER BY id DESC LIMIT 1`).get(game, norm(setCode), String(name));
    }
    return row?.image_url || '';
  } catch {
    return '';
  }
}

async function marketGame(db, selectedGame) {
  const config = GAMES[gameCode(selectedGame)];
  try {
    const games = list(await justGet(db, '/games'));
    const match = games.find(game => config.match(game.name) || config.match(game.id));
    if (match) return match;
  } catch {}
  return { id: config.fallbackId, name: config.name };
}

function setScore(candidate, wanted, localNorm = '', knownNorm = '') {
  const id = norm(candidate?.id);
  const name = norm(candidate?.name);
  let value = 0;
  if (id === wanted || name === wanted) value += 1000;
  if (wanted.length >= 3 && (id.includes(wanted) || name.includes(wanted))) value += 700;
  for (const expected of [localNorm, knownNorm]) {
    if (!expected || expected.length < 5) continue;
    if (name === expected || id === expected) value += 1000;
    if (name.includes(expected) || expected.includes(name) || id.includes(expected)) value += 300;
  }
  return value;
}

async function findSet(db, target) {
  const wanted = norm(target.setCode);
  const game = await marketGame(db, target.gameCode);
  const knownName = target.gameCode === 'RIFTBOUND'
    ? RIFTBOUND_SET_BY_CODE.get(String(target.setCode).toUpperCase())?.set_name || ''
    : '';
  let localName = '';
  let sample = null;
  try {
    localName = db.prepare(`
SELECT MAX(COALESCE(NULLIF(set_name,''),product_name,'')) name FROM cards
WHERE UPPER(TRIM(COALESCE(NULLIF(game_code,''),'ONEPIECE')))=?
  AND REPLACE(REPLACE(UPPER(set_code),'-',''),' ','')=?`).get(target.gameCode, wanted)?.name || '';
    sample = db.prepare(`
SELECT name,card_number FROM cards
WHERE UPPER(TRIM(COALESCE(NULLIF(game_code,''),'ONEPIECE')))=?
  AND REPLACE(REPLACE(UPPER(set_code),'-',''),' ','')=?
  AND TRIM(COALESCE(card_number,''))!=''
ORDER BY id LIMIT 1`).get(target.gameCode, wanted) || null;
  } catch {}

  const localNorm = norm(localName);
  const knownNorm = norm(knownName);
  const queries = [knownName, localName, target.setCode, String(target.setCode).replace(/-/g, '')]
    .map(value => String(value || '').trim())
    .filter((value, index, values) => value && values.indexOf(value) === index);
  const candidates = [];
  for (const query of queries) {
    try { candidates.push(...list(await justGet(db, '/sets', { game: game.id, q: query }))); } catch {}
    const ranked = candidates.map(candidate => [setScore(candidate, wanted, localNorm, knownNorm), candidate])
      .sort((a, b) => b[0] - a[0]);
    if (ranked[0]?.[0] >= 700) return ranked[0][1];
  }

  const probeNumbers = [];
  if (sample?.card_number) probeNumbers.push(String(sample.card_number));
  const onePieceMatch = String(target.setCode).toUpperCase().match(/^(OP|EB|PRB|ST)[- ]?(\d{1,2})/);
  if (onePieceMatch) probeNumbers.push(`${onePieceMatch[1]}${String(onePieceMatch[2]).padStart(2, '0')}-001`);
  for (const number of [...new Set(probeNumbers)]) {
    for (const params of [
      { game: game.name || game.id, number, limit: 20, include_price_history: 'false' },
      { game: game.id, number, limit: 20, include_price_history: 'false' },
      sample?.name ? { game: game.name || game.id, query: sample.name, limit: 20, include_price_history: 'false' } : null
    ].filter(Boolean)) {
      try {
        const probe = list(await justGet(db, '/cards', params));
        const exact = probe.find(card => norm(card.number) === norm(number))
          || probe.find(card => norm(card.number).includes(wanted));
        const picked = exact || probe[0];
        if (picked?.set) {
          const known = candidates.find(candidate => String(candidate.id) === String(picked.set));
          if (known) return known;
          return { id: picked.set, name: picked.set_name || localName || knownName || target.setCode };
        }
      } catch {}
    }
  }

  try { candidates.push(...list(await justGet(db, '/sets', { game: game.id }))); } catch {}
  const ranked = candidates.map(candidate => [setScore(candidate, wanted, localNorm, knownNorm), candidate])
    .sort((a, b) => b[0] - a[0]);
  if (ranked[0]?.[0] > 0) return ranked[0][1];
  throw new Error(`JustTCG could not match ${target.setCode}. The API key is connected; this set needs a catalog-name match.`);
}

function bestVariant(card) {
  const variants = (card.variants || [])
    .filter(variant => {
      const condition = String(variant.condition || '').toUpperCase();
      return !condition || condition === 'NEAR MINT' || condition === 'NM';
    })
    .filter(variant => num(variant.price) != null);
  if (!variants.length) return null;
  const preferred = variants.filter(variant => /FOIL|HOLO|NORMAL|PARALLEL|ALT/i.test(String(variant.printing || '')));
  return (preferred.length ? preferred : variants).sort((a, b) => (num(b.price) || 0) - (num(a.price) || 0))[0];
}

async function scanSet(db, targetValue) {
  const target = parseTarget(targetValue);
  if (!target.setCode) throw new Error('Choose a set first.');
  const set = await findSet(db, target);
  const game = await marketGame(db, target.gameCode);
  const gameId = game?.id || GAMES[target.gameCode].fallbackId;
  const raw = [];
  for (let offset = 0; offset < 40; offset += 20) {
    const data = await justGet(db, '/cards', {
      game: gameId,
      set: set.id,
      limit: 20,
      offset,
      condition: 'NM',
      priceHistoryDuration: '30d'
    });
    const batch = list(data);
    raw.push(...batch);
    if (!(data?.pagination?.hasMore ?? data?.meta?.hasMore) || batch.length < 20) break;
  }
  if (!raw.length) throw new Error(`JustTCG returned no priced cards for ${target.setCode}.`);

  const now = new Date().toISOString();
  const prepared = [];
  for (const card of raw) {
    const variant = bestVariant(card);
    if (!variant) continue;
    const current = num(variant.price);
    const fair = num(variant.avgPrice30d) || num(variant.avgPrice) || null;
    if (!premium(card, current, variant.printing, target.gameCode)) continue;
    const external = String(variant.uuid || variant.id || card.uuid || card.id || card.tcgplayerId || `${target.gameCode}:${target.setCode}:${card.number}:${card.name}`);
    const image = localImage(db, target, card.number, card.name);
    const config = GAMES[target.gameCode];
    const buyUrl = card.tcgplayerId
      ? `https://www.tcgplayer.com/product/${card.tcgplayerId}`
      : `https://www.tcgplayer.com/search/${config.buySlug}/product?q=${encodeURIComponent(`${card.name || ''} ${card.number || ''}`)}`;
    const row = {
      external_id: external,
      game_code: target.gameCode,
      set_code: target.setCode,
      name: card.name || 'Unknown card',
      card_number: card.number || '',
      rarity: card.rarity || '',
      variant: variant.printing || '',
      image_url: image,
      scanned_at: now,
      market_price: current,
      low_price: null,
      fair_price: fair,
      source: 'JustTCG',
      buy_url: buyUrl,
      change24h: num(variant.priceChange24hr),
      change7d: num(variant.priceChange7d),
      change30d: num(variant.priceChange30d)
    };
    row.whatnot_url = whatnotSearchUrl(row);
    prepared.push(row);
  }

  const rows = prepared.slice(0, 40);
  const insert = db.prepare(`
INSERT INTO card_sniper_market_snapshots(external_id,game_code,set_code,name,card_number,rarity,variant,image_url,scanned_at,market_price,low_price,fair_price,source,buy_url)
VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const row of rows) {
      insert.run(row.external_id, row.game_code, row.set_code, row.name, row.card_number, row.rarity, row.variant, row.image_url, row.scanned_at, row.market_price, row.low_price, row.fair_price, row.source, row.buy_url);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const cards = rows.map(row => ({ ...row, ...score(row) }))
    .sort((a, b) => (b.discountPct ?? -999) - (a.discountPct ?? -999) || (b.market_price || 0) - (a.market_price || 0));
  return {
    gameCode: target.gameCode,
    setCode: target.setCode,
    groupName: `${GAMES[target.gameCode].name} · ${target.setCode} · ${set.name || target.setCode}`,
    scannedAt: now,
    matchedCards: cards.length,
    eligibleCards: raw.length,
    cards
  };
}

module.exports = {
  initCardSniper,
  getStatus,
  setSettings,
  getSets,
  getLatest,
  scanSet,
  _test: { parseTarget, premium, setScore, gameCode, whatnotSearchUrl }
};
