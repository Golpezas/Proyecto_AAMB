const assert = require('node:assert/strict');
const { RIFTBOUND_SETS, normalizeRiftboundCollectorNumber, normalizeRiftboundPayload } = require('./RiftboundCatalog');

assert.deepEqual(RIFTBOUND_SETS.map(set => set.setCode), ['OGN', 'OGS', 'SFD', 'UNL', 'VEN']);
assert.deepEqual(RIFTBOUND_SETS.map(set => set.setNumber), [1, 2, 3, 4, 5]);

const normalized = normalizeRiftboundPayload({ cards: [
  { id: 'one', name: 'Example Origin', collectorNumber: '001/298', setCode: 'OGN', rarity: 'Common', type: 'Unit', imageUrl: 'https://example.invalid/one.png' },
  { id: 'two', name: 'Example Spirit', cardNumber: 'SFD-110/221', rarityName: 'Rare', cardType: 'Champion Unit', treatment: 'Alternate Art' },
  { id: 'three', name: 'Example Unleashed', number: '219/219', setName: 'Unleashed', rarity: 'Epic' },
  { id: 'bad', name: 'Unsupported', number: '001', setCode: 'OTHER' }
] });

assert.equal(normalized.cards.length, 3);
assert.equal(normalized.ignored, 1);
assert.equal(normalized.cards[0].card_number, 'OGN-001/298');
assert.equal(normalized.cards[1].variant, 'Alternate Art');
assert.equal(normalized.cards[2].set_code, 'UNL');
assert.equal(normalized.cards[2].game_code, 'RIFTBOUND');

const officialApiShape = normalizeRiftboundPayload({
  game: 'Riftbound',
  version: '1',
  sets: [{
    id: 'OGN',
    name: 'Origins',
    cards: [{
      id: 'OGN-001',
      name: 'Official API Example',
      collectorNumber: 1,
      rarity: 'Common',
      type: 'Unit',
      description: 'Official English rules text.',
      stats: { cost: 2, might: 3 },
      art: { fullURL: 'https://static.rgpub.io/riftbound/OGN-001.png', artist: 'Riot Artist' }
    }]
  }]
});
assert.equal(officialApiShape.cards.length, 1);
assert.equal(officialApiShape.cards[0].card_number, 'OGN-1');
assert.equal(officialApiShape.cards[0].image_url, 'https://static.rgpub.io/riftbound/OGN-001.png');
assert.equal(officialApiShape.cards[0].cost, '2');
assert.equal(officialApiShape.cards[0].power, '3');

const galleryShape = normalizeRiftboundPayload({ items: [{
  id: 'ven-001-166',
  collectorNumber: 1,
  name: 'Gallery Example',
  publicCode: 'VEN-001/166',
  set: { type: 'link', value: { id: 'VEN', label: 'Vendetta' } },
  rarity: { type: 'list', value: { id: 'common', label: 'Common' } },
  domain: { values: [{ id: 'fury', label: 'Fury' }] },
  cardType: { type: [{ id: 'unit', label: 'Unit' }], superType: [{ id: 'champion', label: 'Champion' }] },
  cardImage: { url: 'https://cmsassets.rgpub.io/sanity/images/card.png' },
  illustrator: { values: [{ id: 'artist', label: 'Riot Artist' }] },
  text: { richText: { body: '<p>Official <strong>rules</strong> text.</p>' } },
  energy: { value: { label: '4' } },
  power: { value: { label: '5' } },
  tags: { values: [{ id: 'yordle', label: 'Yordle' }] }
}] });
assert.equal(galleryShape.cards.length, 1);
assert.equal(galleryShape.cards[0].set_code, 'VEN');
assert.equal(galleryShape.cards[0].card_number, 'VEN-001/166');
assert.equal(galleryShape.cards[0].rarity, 'Common');
assert.equal(galleryShape.cards[0].color, 'Fury');
assert.equal(galleryShape.cards[0].card_type, 'Champion Unit');
assert.equal(galleryShape.cards[0].artist, 'Riot Artist');
assert.equal(galleryShape.cards[0].traits, 'Yordle');
assert.equal(galleryShape.cards[0].effect, 'Official rules text.');
assert.equal(galleryShape.cards[0].source, 'Official Riot Riftbound Card Gallery');

const namedLegend = normalizeRiftboundPayload({ items: [{
  id: 'ven-139-166',
  name: 'Rogue Assassin',
  publicCode: 'VEN-139/166',
  set: { value: { id: 'VEN', label: 'Vendetta' } },
  rarity: { value: { id: 'rare', label: 'Rare' } },
  cardType: { type: [{ id: 'legend', label: 'Legend' }] },
  tags: { tags: ['Akali'] }
}] }).cards[0];
assert.equal(namedLegend.name, 'Akali, Rogue Assassin');
assert.equal(namedLegend.card_type, 'Legend');

const namedChampionUnit = normalizeRiftboundPayload({ items: [{
  id: 'ven-001-166',
  name: 'Akali, Deadly Weapon',
  publicCode: 'VEN-001/166',
  setCode: 'VEN',
  rarity: 'Epic',
  cardType: { superType: [{ label: 'Champion' }], type: [{ label: 'Unit' }] },
  tags: { tags: ['Akali', 'Ionia'] }
}] }).cards[0];
assert.equal(namedChampionUnit.name, 'Akali, Deadly Weapon');
assert.equal(namedChampionUnit.card_type, 'Champion Unit');

const treatments = normalizeRiftboundPayload({ cards: [
  { id: 'alt', name: 'Alt', cardNumber: 'OGN-027A/298', setCode: 'OGN', rarity: 'Epic' },
  { id: 'over', name: 'Over', cardNumber: 'SFD-227/221', setCode: 'SFD', rarity: 'Rare' },
  { id: 'sig', name: 'Signature', cardNumber: 'UNL-230*/219', setCode: 'UNL', rarity: 'Rare' }
] }).cards;
assert.deepEqual(treatments.map(card => card.variant), ['Alternate Art', 'Overnumbered', 'Signature']);

const signedCatalogCards = normalizeRiftboundPayload({ cards: [
  { id: 'vi-signed', name: 'Vi, Piltover Enforcer', publicCode: 'UNL-229-STAR', setCode: 'UNL', rarity: 'Rare' },
  { id: 'leblanc-signed', name: 'LeBlanc, Deceiver', publicCode: 'UNL-235-STAR', setCode: 'UNL', rarity: 'Rare' },
  { id: 'vi-over', name: 'Vi, Piltover Enforcer', publicCode: 'UNL-229', setCode: 'UNL', rarity: 'Rare', treatment: 'Signature' }
] }).cards;
assert.deepEqual(signedCatalogCards.map(card => card.card_number), ['UNL-229*/219', 'UNL-235*/219', 'UNL-229']);
assert.deepEqual(signedCatalogCards.map(card => card.variant), ['Signature', 'Signature', 'Overnumbered']);
assert.equal(normalizeRiftboundCollectorNumber('UNL-229-STAR'), 'UNL-229*/219');

console.log('RiftboundCatalog tests passed.');
