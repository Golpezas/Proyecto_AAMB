const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const PlayableMarket = require('./PlayableMarket');

const db = new DatabaseSync(':memory:');
db.exec(`
PRAGMA foreign_keys=ON;
CREATE TABLE cards(
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  card_number TEXT,
  set_code TEXT,
  set_name TEXT,
  rarity TEXT,
  color TEXT,
  card_type TEXT,
  cost TEXT,
  power TEXT,
  variant TEXT NOT NULL DEFAULT '',
  manual_category TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  image_path TEXT,
  detail_url TEXT,
  game_code TEXT NOT NULL DEFAULT 'RIFTBOUND'
);
INSERT INTO cards(id,name,card_number,set_code,set_name,rarity,color,card_type,cost,power,game_code)
VALUES
  (1,'Astral Heron','OGN-101/221','OGN','Origins','Rare','Calm','Unit','3','3','RIFTBOUND'),
  (2,'Viktor, Herald of the Arcane','OGN-019/221','OGN','Origins','Epic','Mind','Unit','5','5','RIFTBOUND'),
  (3,'Other Game Card','OP01-001','OP01','Romance Dawn','Leader','','Leader','','','ONEPIECE');
`);

PlayableMarket.initPlayableMarket(db);

const sets = PlayableMarket.getSets(db);
assert.equal(sets.find(set => set.set_code === 'OGN').card_count, 2);
assert.equal(sets.find(set => set.set_code === 'OGN').tracked_count, 0);

const research = PlayableMarket.prepareResearch(db, 'ogn');
assert.equal(research.set.setName, 'Origins');
assert.deepEqual(research.candidates.map(card => card.id), [2, 1]);

assert.throws(() => PlayableMarket.applyResearch(db, {
  setCode: 'OGN',
  cards: [{ id: 1, currentPriceUsd: 2.5 }]
}), /supporting HTTPS source/);

const imported = PlayableMarket.applyResearch(db, {
  setCode: 'OGN',
  researchedAt: '2026-09-22T12:00:00.000Z',
  replaceSet: true,
  cards: [
    {
      id: 1,
      currentPriceUsd: 4,
      price24hAgoUsd: 5,
      price7dAgoUsd: 5,
      price30dAgoUsd: 3.2,
      price90dAgoUsd: null,
      signal: 'buy dip',
      playabilityTier: 'staple',
      confidence: 'high',
      analysis: 'A format staple currently below its weekly reference.',
      catalyst: 'Top-cut deck adoption.',
      sources: [{ name: 'Example Market', url: 'https://example.com/heron' }],
      buyUrl: 'https://example.com/buy/heron'
    },
    {
      id: 2,
      currentPriceUsd: '$12.50',
      price24hAgoUsd: 10,
      price7dAgoUsd: 8,
      price30dAgoUsd: 6.25,
      price90dAgoUsd: 5,
      signal: 'hot',
      playabilityTier: 'meta',
      confidence: 'medium',
      analysis: 'Momentum follows a new tournament result.',
      sources: [{ name: 'Example Market', url: 'https://example.com/viktor' }]
    },
    {
      id: 999,
      currentPriceUsd: 1,
      sources: [{ name: 'Wrong set', url: 'https://example.com/wrong' }]
    }
  ]
});

assert.equal(imported.importedCards, 2);
assert.equal(imported.skippedCards, 1);
assert.equal(imported.trackedCards, 2);

const dashboard = PlayableMarket.getDashboard(db, { setCode: 'OGN', window: '24h', sort: 'change', direction: 'desc' });
assert.equal(dashboard.cards.length, 2);
assert.equal(dashboard.cards[0].id, 2);
assert.equal(dashboard.cards[0].signal, 'ON_FIRE');
assert.equal(dashboard.cards[0].prices.current, 1250);
assert.equal(dashboard.cards[0].changes['24h'].cents, 250);
assert.equal(dashboard.cards[0].changes['24h'].pct, 25);
assert.equal(dashboard.cards[1].changes['7d'].cents, -100);
assert.equal(dashboard.cards[1].changes['7d'].pct, -20);
assert.equal(dashboard.summary.onFire, 1);
assert.equal(dashboard.summary.buyDips, 1);

const dips = PlayableMarket.getDashboard(db, { signal: 'BUY_DIP', query: 'heron' });
assert.deepEqual(dips.cards.map(card => card.id), [1]);
assert.equal(dips.summary.tracked, 2);

const replaced = PlayableMarket.applyResearch(db, {
  setCode: 'OGN',
  researchedAt: '2026-09-22T13:00:00.000Z',
  replaceSet: true,
  cards: [{
    id: 2,
    currentPriceUsd: 13,
    price24hAgoUsd: 12.5,
    signal: 'rising',
    sources: [{ name: 'Example Market', url: 'https://example.com/viktor-new' }]
  }]
});
assert.equal(replaced.trackedCards, 1);
assert.deepEqual(PlayableMarket.getDashboard(db, {}).cards.map(card => card.id), [2]);
assert.equal(db.prepare('SELECT COUNT(*) AS count FROM playable_market_snapshots WHERE card_id=1').get().count, 1);

assert.equal(PlayableMarket.removeTrackedCard(db, 2).removed, 1);
assert.equal(PlayableMarket.getDashboard(db, {}).summary.tracked, 0);

assert.deepEqual(PlayableMarket._test.change(100, 0), { cents: null, pct: null });
assert.equal(PlayableMarket._test.moneyToCents('1,234.56'), 123456);
assert.equal(PlayableMarket._test.normalizeWindow('1y'), '24h');

console.log('Playable Market model tests passed.');
