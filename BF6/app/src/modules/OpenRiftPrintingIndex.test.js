const assert = require('node:assert/strict');
const {
  OPENRIFT_PRINTING_COUNT,
  lookupOpenRiftPrinting,
  openRiftPrintingKey
} = require('./OpenRiftPrintingIndex');

assert.equal(OPENRIFT_PRINTING_COUNT, 1275);
assert.equal(openRiftPrintingKey('UNL-229*/219'), 'UNL-229*');
assert.equal(openRiftPrintingKey('UNL-229-STAR'), 'UNL-229*');
assert.equal(openRiftPrintingKey('229*/219', 'UNL'), 'UNL-229*');
assert.equal(openRiftPrintingKey('VEN-SP6/006-EN'), 'VEN-SP6');
assert.equal(openRiftPrintingKey('UNL-229/999'), '');

assert.deepEqual(
  lookupOpenRiftPrinting('UNL-229/219'),
  {
    key: 'UNL-229',
    rarity: 'Showcase',
    artVariant: 'Overnumbered',
    signed: false,
    collectorTreatment: 'Overnumbered',
    collectorTreatments: ['Overnumbered'],
    source: 'OpenRift exact collector-number catalog',
    sourceUrl: 'https://openrift.app/api/v1/catalog',
    snapshotDate: '2026-08-17'
  }
);
assert.deepEqual(lookupOpenRiftPrinting('UNL-229*/219').collectorTreatments, ['Overnumbered', 'Signature']);
assert.equal(lookupOpenRiftPrinting('UNL-229*/219').rarity, 'Showcase');
assert.equal(lookupOpenRiftPrinting('UNL-235*/219').signed, true);
assert.equal(lookupOpenRiftPrinting('SFD-118a/221').rarity, 'Epic');
assert.equal(lookupOpenRiftPrinting('SFD-118a/221').artVariant, 'Alternate Art');
assert.equal(lookupOpenRiftPrinting('VEN-191/166-EN').rarity, 'Rare');
assert.equal(lookupOpenRiftPrinting('VEN-197*/166').rarity, 'Rare');
assert.equal(lookupOpenRiftPrinting('UNL-238/219').artVariant, 'Ultimate');
assert.equal(lookupOpenRiftPrinting('VEN-SP1/006-EN').rarity, 'Epic');
assert.equal(lookupOpenRiftPrinting('VEN-SP6/006-EN').rarity, 'Showcase');
assert.equal(lookupOpenRiftPrinting('UNL-999/219'), null);
assert.equal(lookupOpenRiftPrinting('UNL-229/999'), null);

console.log('OpenRift printing index checks passed.');
