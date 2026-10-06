const crypto = require('node:crypto');
const { openRiftImageUrl } = require('./OpenRiftImageCatalog');

const OPENRIFT_CARD_ROOT = 'https://openrift.app/cards';

const OPENRIFT_RUNE_IMAGE_IDS = Object.freeze({
  'SFD-R01a': '019da0d6-2409-7635-abf1-9c7973565e34',
  'SFD-R02a': '019da0d4-d087-7ab3-b7c7-c940b59cd773',
  'SFD-R03a': '019da0d6-e37e-7676-b490-57a7c9f70955',
  'SFD-R04a': '019da0d7-b65d-764e-8012-4fd2e8f4f20e',
  'SFD-R05a': '019da0d5-8387-7970-830a-772e3e0cf5b5',
  'SFD-R06a': '019da0d3-e02a-78f8-97e7-169b6d70ee19',
  'UNL-R01a': '019f3e8f-ff21-74d4-be79-f24c1e9e1a12',
  'UNL-R02a': '019f3e9b-7a34-7ff3-aedb-75b7d39b18a0',
  'UNL-R03a': '019f3e91-5780-7292-a825-65d2e95d16b0',
  'UNL-R04a': '019f3e90-83ad-7589-a3e0-4fee256f67c7',
  'UNL-R05a': '019f3e9a-ea95-7de7-bf1b-3fb528f31cf9',
  'UNL-R06a': '019f3e91-c935-7634-afce-4f6213bf1e48',
  'UNL-R01b': '019e5b77-7450-72bb-89cf-0c2a47c84297',
  'UNL-R02b': '019e20bd-7705-7264-9453-bf6b8ea11bf5',
  'UNL-R03b': '019eb046-efdd-7367-9266-de4c21cb1c09',
  'UNL-R04b': '019ea5ff-eef3-717d-a871-a5ae40790874',
  'UNL-R05b': '019f6499-a069-757e-9b13-ae2faa1455af',
  'UNL-R06b': '019ed641-6e6d-75c9-94aa-53ad7ae0c80b'
});

// Riot's gallery does not publish Rune records. These six verified English
// OpenRift printings make the Spiritforged Showcase Rune anchors available to
// clean installs as well as older libraries that already synced them.
const SPIRITFORGED_SHOWCASE_RUNES = Object.freeze([
  Object.freeze({ number: 'SFD-R01a', name: 'Fury Rune', domain: 'Fury', artist: 'Fairfoul', rarity: 'Showcase', distribution: 'Spiritforged showcase' }),
  Object.freeze({ number: 'SFD-R02a', name: 'Calm Rune', domain: 'Calm', artist: 'Zhongqi Li', rarity: 'Showcase', distribution: 'Spiritforged showcase' }),
  Object.freeze({ number: 'SFD-R03a', name: 'Mind Rune', domain: 'Mind', artist: 'Fairfoul', rarity: 'Showcase', distribution: 'Spiritforged showcase' }),
  Object.freeze({ number: 'SFD-R04a', name: 'Body Rune', domain: 'Body', artist: 'Fairfoul', rarity: 'Showcase', distribution: 'Spiritforged showcase' }),
  Object.freeze({ number: 'SFD-R05a', name: 'Chaos Rune', domain: 'Chaos', artist: 'Fairfoul', rarity: 'Showcase', distribution: 'Spiritforged showcase' }),
  Object.freeze({ number: 'SFD-R06a', name: 'Order Rune', domain: 'Order', artist: 'Fairfoul', rarity: 'Showcase', distribution: 'Spiritforged showcase' })
]);

// Riot's public Riftbound gallery feed currently omits the Unleashed Rune
// showcase and Nexus Night promo printings. Keep this explicit manifest small
// and additive so each real collector number remains available without
// replacing any Riot row or treating a VEN standard Rune as an UNL promo.
const UNLEASHED_SHOWCASE_RUNES = Object.freeze([
  Object.freeze({ number: 'UNL-R01a', imageNumber: 'UNL-R01a', name: 'Fury Rune', domain: 'Fury', artist: 'Envar Studio', rarity: 'Showcase', distribution: 'Unleashed showcase' }),
  Object.freeze({ number: 'UNL-R02a', imageNumber: 'UNL-R02a', name: 'Calm Rune', domain: 'Calm', artist: 'Envar Studio', rarity: 'Showcase', distribution: 'Unleashed showcase' }),
  Object.freeze({ number: 'UNL-R03a', imageNumber: 'UNL-R03a', name: 'Mind Rune', domain: 'Mind', artist: 'Envar Studio', rarity: 'Showcase', distribution: 'Unleashed showcase' }),
  Object.freeze({ number: 'UNL-R04a', imageNumber: 'UNL-R04a', name: 'Body Rune', domain: 'Body', artist: 'Envar Studio', rarity: 'Showcase', distribution: 'Unleashed showcase' }),
  Object.freeze({ number: 'UNL-R05a', imageNumber: 'UNL-R05a', name: 'Chaos Rune', domain: 'Chaos', artist: 'Envar Studio', rarity: 'Showcase', distribution: 'Unleashed showcase' }),
  Object.freeze({ number: 'UNL-R06a', imageNumber: 'UNL-R06a', name: 'Order Rune', domain: 'Order', artist: 'Envar Studio', rarity: 'Showcase', distribution: 'Unleashed showcase' }),
  Object.freeze({ number: 'UNL-R01b', imageNumber: 'UNL-R01b-p', name: 'Fury Rune', domain: 'Fury', artist: '华锐', rarity: 'Promo', distribution: 'Nexus Night promo' }),
  Object.freeze({ number: 'UNL-R02b', imageNumber: 'UNL-R02b-p', name: 'Calm Rune', domain: 'Calm', artist: '华锐', rarity: 'Promo', distribution: 'Nexus Night promo' }),
  Object.freeze({ number: 'UNL-R03b', imageNumber: 'UNL-R03b-p', name: 'Mind Rune', domain: 'Mind', artist: '华锐', rarity: 'Promo', distribution: 'Nexus Night promo' }),
  Object.freeze({ number: 'UNL-R04b', imageNumber: 'UNL-R04b-p', name: 'Body Rune', domain: 'Body', artist: '华锐', rarity: 'Promo', distribution: 'Nexus Night promo' }),
  Object.freeze({ number: 'UNL-R05b', imageNumber: 'UNL-R05b-p', name: 'Chaos Rune', domain: 'Chaos', artist: '华锐', rarity: 'Promo', distribution: 'Nexus Night promo' }),
  Object.freeze({ number: 'UNL-R06b', imageNumber: 'UNL-R06b-p', name: 'Order Rune', domain: 'Order', artist: '华锐', rarity: 'Promo', distribution: 'Nexus Night promo' })
]);

function stableRuneId(cardNumber) {
  return `riftbound:${crypto.createHash('sha1').update(`verified-rune-supplement:${cardNumber.toUpperCase()}`).digest('hex')}`;
}

function slug(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function riftboundRuneSupplements() {
  return [...SPIRITFORGED_SHOWCASE_RUNES, ...UNLEASHED_SHOWCASE_RUNES].map(rune => {
    const setCode = rune.number.split('-')[0].toUpperCase();
    const setName = setCode === 'SFD' ? 'Spiritforged' : 'Unleashed';
    return {
    official_id: stableRuneId(rune.number),
    game_code: 'RIFTBOUND',
    game_name: 'Riftbound: League of Legends TCG',
    name: rune.name,
    card_number: rune.number,
    set_code: setCode,
    setName,
    product_name: rune.distribution === 'Nexus Night promo'
      ? 'Riftbound: League of Legends TCG — Unleashed Nexus Night Promo'
      : `Riftbound: League of Legends TCG — ${setName} Booster 6-Box Case`,
    rarity: rune.rarity,
    source_rarity: rune.rarity,
    variant: 'Alternate Art',
    variant_source: rune.distribution,
    color: rune.domain,
    card_type: 'Rune',
    image_url: openRiftImageUrl(OPENRIFT_RUNE_IMAGE_IDS[rune.number]),
    detail_url: `${OPENRIFT_CARD_ROOT}/${slug(rune.name)}`,
    artist: rune.artist,
    life: '',
    cost: '',
    attribute: '',
    power: '',
    counter: '',
    block: '',
    traits: 'Rune',
    effect: '',
    raw_details: JSON.stringify({
      supplement: 'Riot public gallery omission matched to an exact OpenRift English printing',
      finish: 'Foil',
      treatment: 'Alternate Art',
      rarity: rune.rarity,
      distribution: rune.distribution,
      artist: rune.artist
    }),
    source: 'OpenRift exact English printing supplement'
    };
  });
}

module.exports = {
  OPENRIFT_CARD_ROOT,
  OPENRIFT_RUNE_IMAGE_IDS,
  SPIRITFORGED_SHOWCASE_RUNES,
  UNLEASHED_SHOWCASE_RUNES,
  riftboundRuneSupplements,
  stableRuneId
};
