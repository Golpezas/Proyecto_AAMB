const assert = require('node:assert/strict');
const {
  buildOpenRiftImageIndex,
  isOpenRiftCardImageUrl,
  lookupOpenRiftImage,
  openRiftImageUrl
} = require('./OpenRiftImageCatalog');

const setId = '019d02cd-ab20-7582-8213-048b8d81d415';
const payload = {
  sets: [
    { id: setId, slug: 'VEN' },
    { id: 'unsupported', slug: 'RAD' }
  ],
  printings: {
    normalLater: {
      setId,
      language: 'EN',
      publicCode: 'VEN-023/166-EN',
      canonicalRank: 20,
      finish: 'foil',
      images: [{ face: 'front', imageId: '019f4c2e-e9b8-7d70-a32e-5ec317ab75d8' }]
    },
    normalPreferred: {
      setId,
      language: 'EN',
      publicCode: 'VEN-023/166-EN',
      canonicalRank: 10,
      finish: 'normal',
      images: [{ face: 'front', imageId: '019f4c2e-dd95-77c9-bd91-0207142a4b3c' }]
    },
    signature: {
      setId,
      language: 'EN',
      publicCode: 'VEN-191*/166-EN',
      canonicalRank: 30,
      finish: 'foil',
      isSigned: true,
      images: [{ face: 'front', imageId: '019ffa5d-8d8a-7e2a-9a91-5393faa3d4b4' }]
    },
    ignoredLanguage: {
      setId,
      language: 'FR',
      publicCode: 'VEN-191*/166-FR',
      images: [{ face: 'front', imageId: '019ffa5d-8d8a-7e2a-9a91-5393faa3d4b5' }]
    },
    ignoredMissingImage: { setId, language: 'EN', publicCode: 'VEN-190*/166-EN', images: [] },
    ignoredSet: {
      setId: 'unsupported',
      language: 'EN',
      publicCode: 'RAD-001/001',
      images: [{ face: 'front', imageId: '019ffa5d-8d8a-7e2a-9a91-5393faa3d4b6' }]
    }
  }
};

const index = buildOpenRiftImageIndex(payload);
assert.equal(index.size, 2);
assert.equal(lookupOpenRiftImage(index, 'VEN-023/166').printingId, 'normalPreferred');
assert.equal(lookupOpenRiftImage(index, '191*/166', 'VEN').printingId, 'signature');
assert.equal(lookupOpenRiftImage(index, 'VEN-191-STAR').collectorKey, 'VEN-191*');
assert.equal(lookupOpenRiftImage(index, 'VEN-190*/166'), null);
assert.equal(
  openRiftImageUrl('019ffa5d-8d8a-7e2a-9a91-5393faa3d4b4'),
  'https://openrift.app/media/cards/b4/019ffa5d-8d8a-7e2a-9a91-5393faa3d4b4-full.webp'
);
assert.equal(openRiftImageUrl('not-an-image-id'), '');
assert.equal(isOpenRiftCardImageUrl(lookupOpenRiftImage(index, 'VEN-191*/166').imageUrl), true);
assert.equal(isOpenRiftCardImageUrl('https://riftcompare.com/zed.avif'), false);

console.log('OpenRift image catalog checks passed.');
