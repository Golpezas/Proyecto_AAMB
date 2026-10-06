const assert = require('node:assert/strict');
const { discoverPageCount, donCardFromDetail, extractDonDetailIds, normaliseSetCode, stableDonId } = require('./DonCatalogSupplements');

const indexHtml = `
  <a href="/analytics/don/11">Details</a>
  <a href="/analytics/don/3">Details</a>
  <a href="/analytics/don/?page=6">6</a>
`;
assert.deepEqual(extractDonDetailIds(indexHtml), [3, 11]);
assert.equal(discoverPageCount(indexHtml), 6);
assert.equal(normaliseSetCode('The Time of Battle (OP16)'), 'OP-16');
assert.equal(normaliseSetCode('Double Pack Set Vol. 11 [DP-11]'), 'DP-11');
assert.equal(normaliseSetCode('One Piece Promotion Cards (OP-PR)'), 'OP-PR');

const detailHtml = `
  <main>
    <img src="/media/static/Card_Images/DON_Card_Egghead_-_The_Azure_Seas_Seven_OP14_img.jpg" alt="DON!! Card (Egghead)" />
    <h2>DON!! Card (Egghead)</h2>
    <p>Inventory Price: $0.38</p>
    <p>OPTCG Don Name: DON!! Card (Egghead) - The Azure Sea's Seven (OP14)</p>
    <p>Image ID: don_1</p>
  </main>
`;
const card = donCardFromDetail(detailHtml, 'https://www.optcgapi.com/analytics/don/1', 1);
assert.equal(card.name, 'DON!! Card (Egghead)');
assert.equal(card.set_code, 'OP-14');
assert.equal(card.rarity, 'DON!! CARD');
assert.equal(card.official_id, stableDonId(1));
assert.equal(card.image_url, 'https://optcg-api.arjunbansal-ai.workers.dev/images/DON-001?v=5');
assert.equal(card.source, 'Bandai DON supplement');
console.log('DON catalog supplements test passed.');
