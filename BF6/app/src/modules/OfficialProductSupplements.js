const crypto = require('node:crypto');

// Bandai's OP-16 Card List currently omits product-only DON!! printings.
// This small, explicit manifest uses only public English Bandai product pages.
const OP16_PRODUCT_PAGE = 'https://en.onepiece-cardgame.com/products/op16.html';
const DP11_PRODUCT_PAGE = 'https://en.onepiece-cardgame.com/products/dp11.html';
const TCGPLAYER_CARD_IMAGE = id => `https://tcgplayer-cdn.tcgplayer.com/product/${id}_in_1000x1000.jpg`;

const PRODUCT_ONLY_DON_PRINTINGS = Object.freeze([
  {
    key: 'op16-don-alternate-art',
    name: 'DON!! Card (Alternate Art)',
    rarity: 'DON!! CARD',
    setName: 'BOOSTER PACK -THE TIME OF BATTLE- [OP-16]',
    detailUrl: OP16_PRODUCT_PAGE,
    // Bandai publishes this as a product-only printing but does not give the
    // Card List a standalone card image. The collector image is mapped to
    // TCGplayer ID 698313 and is cached locally by BreakSuite6.
    imageUrl: TCGPLAYER_CARD_IMAGE(698313),
    sourceNote: 'Official Bandai product-only OP-16 record. Bandai does not publish standalone Card List art; verified card image reference mapped to collector ID 698313.'
  },
  {
    key: 'op16-don-alternate-art-gold',
    name: 'DON!! Card (Alternate Art) (Gold)',
    rarity: 'GOLD DON',
    setName: 'BOOSTER PACK -THE TIME OF BATTLE- [OP-16]',
    detailUrl: OP16_PRODUCT_PAGE,
    imageUrl: TCGPLAYER_CARD_IMAGE(698314),
    sourceNote: 'Official Bandai product-only OP-16 Gold DON!! record. Bandai does not publish standalone Card List art; verified card image reference mapped to collector ID 698314.'
  },
  {
    key: 'dp11-don-impel-down',
    name: 'DON!! Card (Double Pack Set Vol. 11) (Impel Down)',
    rarity: 'DON!! CARD',
    setName: 'Double Pack Set Vol.11 [DP-11] — includes [OP-16]',
    detailUrl: DP11_PRODUCT_PAGE,
    imageUrl: TCGPLAYER_CARD_IMAGE(698316),
    sourceNote: 'Official Bandai DP-11 product-only record. Verified full-card image reference mapped to collector ID 698316.'
  },
  {
    key: 'dp11-don-luffy-and-ace',
    name: 'DON!! Card (Double Pack Set Vol. 11) (Luffy and Ace)',
    rarity: 'DON!! CARD',
    setName: 'Double Pack Set Vol.11 [DP-11] — includes [OP-16]',
    detailUrl: DP11_PRODUCT_PAGE,
    imageUrl: TCGPLAYER_CARD_IMAGE(698315),
    sourceNote: 'Official Bandai DP-11 product-only record. Verified full-card image reference mapped to collector ID 698315.'
  }
]);

function stableOfficialId(key) {
  return crypto.createHash('sha1').update(`official-bandai-product-only:${key}`).digest('hex');
}

function officialProductSupplements() {
  return PRODUCT_ONLY_DON_PRINTINGS.map(printing => ({
    official_id: stableOfficialId(printing.key),
    name: printing.name,
    // Bandai does not assign these product-only printings a public card number.
    card_number: '',
    set_code: 'OP-16',
    rarity: printing.rarity,
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
    image_url: printing.imageUrl || '',
    detail_url: printing.detailUrl,
    setName: printing.setName,
    raw_details: printing.sourceNote,
    product_only: true
  }));
}

module.exports = {
  DP11_PRODUCT_PAGE,
  OP16_PRODUCT_PAGE,
  PRODUCT_ONLY_DON_PRINTINGS,
  TCGPLAYER_CARD_IMAGE,
  officialProductSupplements
};
