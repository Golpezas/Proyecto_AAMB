'use strict';

// Visual-only profile for the combined Unleashed + Vendetta break.
// IMPORTANT: this module does not write to the break ledger, card catalog,
// buyer assignments, pull history, or order history. It only describes what
// cards should be DISPLAYED together for a custom mixed-set board.

const {
  cardBelongsToBaron,
  cardBelongsToChampion,
  isShowcaseRune,
  isUnleashedRareColorCard,
  isVendettaRareColorCard,
  sortChampionFamily,
  vendettaSpotMapping
} = require('./RiftboundChampionAudit');

function norm(value) {
  return String(value || '').trim().toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']+/g, ' ');
}

function prefixName(card = {}) {
  return String(card.name || '').split(',')[0].trim();
}

function setCode(card = {}) {
  return String(card.set_code || '').trim().toUpperCase();
}

function treatment(card = {}) {
  return String(card.collector_treatment || card.variant || card.manual_category || '').trim().toUpperCase();
}

const COMBO_VISUAL_PROFILE_ID = 'UNL_VEN_COMBO_17_V3';

// First entry is the actual board anchor. Everything else is visual-only.
const COMBO_CHAMPION_SPOTS = Object.freeze([
  Object.freeze({ anchor: 'Akali', anchorSet: 'VEN', displayLabel: 'Akali + Ivern', champions: Object.freeze([{ name: 'Akali', setCode: 'VEN' }, { name: 'Ivern', setCode: 'UNL' }]), extraOnChampions: Object.freeze(['Irelia']) }),
  Object.freeze({ anchor: 'Diana', anchorSet: 'UNL', displayLabel: 'Diana + Kennen', champions: Object.freeze([{ name: 'Diana', setCode: 'UNL' }, { name: 'Kennen', setCode: 'VEN' }]), extraOnChampions: Object.freeze(['Leona']) }),
  Object.freeze({ anchor: 'Zed', anchorSet: 'VEN', displayLabel: "Zed + Kha'Zix", champions: Object.freeze([{ name: 'Zed', setCode: 'VEN' }, { name: "Kha'Zix", setCode: 'UNL' }]), extraOnChampions: Object.freeze(['Riven']) }),
  Object.freeze({ anchor: 'Jayce', anchorSet: 'VEN', displayLabel: 'Jayce + Poppy', champions: Object.freeze([{ name: 'Jayce', setCode: 'VEN' }, { name: 'Poppy', setCode: 'UNL' }]), extraOnChampions: Object.freeze(['Viktor']) }),
  Object.freeze({ anchor: 'Mel', anchorSet: 'VEN', displayLabel: 'Mel + Master Yi', champions: Object.freeze([{ name: 'Mel', setCode: 'VEN' }, { name: 'Master Yi', setCode: 'UNL' }]), extraOnChampions: Object.freeze(['Kayle']) }),
  Object.freeze({ anchor: 'LeBlanc', anchorSet: 'UNL', displayLabel: 'LeBlanc + Lillia', champions: Object.freeze([{ name: 'LeBlanc', setCode: 'UNL' }, { name: 'Lillia', setCode: 'UNL' }]), extraOnChampions: Object.freeze(['Morgana']) }),
  Object.freeze({ anchor: 'Nasus', anchorSet: 'VEN', displayLabel: 'Nasus + Rengar', champions: Object.freeze([{ name: 'Nasus', setCode: 'VEN' }, { name: 'Rengar', setCode: 'UNL' }]), extraOnChampions: Object.freeze(['Illaoi']) }),
  Object.freeze({ anchor: 'Vex', anchorSet: 'UNL', displayLabel: 'Vex + Shen', champions: Object.freeze([{ name: 'Vex', setCode: 'UNL' }, { name: 'Shen', setCode: 'VEN' }]), extraOnChampions: Object.freeze(['Swain']) }),
  Object.freeze({ anchor: 'Vi', anchorSet: 'UNL', displayLabel: 'Vi + Ambessa', champions: Object.freeze([{ name: 'Vi', setCode: 'UNL' }, { name: 'Ambessa', setCode: 'VEN' }]), extraOnChampions: Object.freeze(['Jinx']) }),
  Object.freeze({ anchor: 'Pyke', anchorSet: 'UNL', displayLabel: 'Pyke + Jhin', champions: Object.freeze([{ name: 'Pyke', setCode: 'UNL' }, { name: 'Jhin', setCode: 'UNL' }]), extraOnChampions: Object.freeze(['Draven']) }),
  Object.freeze({ anchor: 'Baron Nashor', anchorSet: 'UNL', displayLabel: 'Baron + Renekton', champions: Object.freeze([{ name: 'Renekton', setCode: 'VEN' }]), extraOnChampions: Object.freeze(['Gangplank']), baron: true })
]);

const COMBO_CRYSTAL_ROSE_SPOTS = Object.freeze([
  Object.freeze({ anchor: "Kai'Sa", anchorSet: 'VEN', displayLabel: "Kai'Sa Crystal Rose SP + Red/Fury", spNumber: 'VEN-SP1/006', vendettaColorSpot: "Kai'Sa" }),
  Object.freeze({ anchor: 'Sona', anchorSet: 'VEN', displayLabel: 'Sona Crystal Rose SP + Green/Calm', spNumber: 'VEN-SP2/006', vendettaColorSpot: 'Sona' }),
  Object.freeze({ anchor: 'Ahri', anchorSet: 'VEN', displayLabel: 'Ahri Crystal Rose SP + Blue/Mind', spNumber: 'VEN-SP3/006', vendettaColorSpot: 'Ahri' }),
  Object.freeze({ anchor: 'Sett', anchorSet: 'VEN', displayLabel: 'Sett Crystal Rose SP + Orange/Body', spNumber: 'VEN-SP4/006', vendettaColorSpot: 'Sett' }),
  Object.freeze({ anchor: 'Ezreal', anchorSet: 'VEN', displayLabel: 'Ezreal Crystal Rose SP + Purple/Chaos', spNumber: 'VEN-SP5/006', vendettaColorSpot: 'Ezreal' }),
  Object.freeze({ anchor: 'Lux', anchorSet: 'VEN', displayLabel: 'Lux Crystal Rose SP + Yellow/Order', spNumber: 'VEN-SP6/006', vendettaColorSpot: 'Lux' })
]);

// Visual-only Poro/SP pairing for the custom UNL + VEN combo board.
// These color families intentionally live only in this display profile; the
// underlying single-set Poro mapping, connector, and ledger remain unchanged.
const PORO_SP_PAIR_DEFS = Object.freeze([
  Object.freeze({ poro: 'Pouty Poro', spAnchor: "Kai'Sa", spNumber: 'VEN-SP1/006', vendettaColorSpot: "Kai'Sa", visualColor: 'Red', visualDomain: 'Fury', visualRune: 'Fury Rune', displayLabel: "Pouty Poro + Kai'Sa SP" }),
  Object.freeze({ poro: 'Lonely Poro', spAnchor: 'Sona', spNumber: 'VEN-SP2/006', vendettaColorSpot: 'Sona', visualColor: 'Green', visualDomain: 'Calm', visualRune: 'Calm Rune', displayLabel: 'Lonely Poro + Sona SP' }),
  Object.freeze({ poro: 'Plundering Poro', spAnchor: 'Ahri', spNumber: 'VEN-SP3/006', vendettaColorSpot: 'Ahri', visualColor: 'Blue', visualDomain: 'Mind', visualRune: 'Mind Rune', displayLabel: 'Plundering Poro + Ahri SP' }),
  Object.freeze({ poro: 'Veteran Poro', spAnchor: 'Sett', spNumber: 'VEN-SP4/006', vendettaColorSpot: 'Sett', visualColor: 'Orange', visualDomain: 'Body', visualRune: 'Body Rune', displayLabel: 'Veteran Poro + Sett SP' }),
  Object.freeze({ poro: 'Mystic Poro', spAnchor: 'Ezreal', spNumber: 'VEN-SP5/006', vendettaColorSpot: 'Ezreal', visualColor: 'Purple', visualDomain: 'Chaos', visualRune: 'Chaos Rune', displayLabel: 'Mystic Poro + Ezreal SP' }),
  Object.freeze({ poro: 'Daring Poro', spAnchor: 'Lux', spNumber: 'VEN-SP6/006', vendettaColorSpot: 'Lux', visualColor: 'Yellow', visualDomain: 'Order', visualRune: 'Order Rune', displayLabel: 'Daring Poro + Lux SP' })
]);

// Named UNL chase cards are color-locked here for THIS combo display only.
// This corrects the Buyer Bag visualization without rewriting the reusable
// single-set audit mapping. Rift Herald is intentionally shown in Yellow/Order,
// and Irresistible Faefolk is intentionally shown in Orange/Body.
const COMBO_NAMED_CHASE_DOMAIN = Object.freeze({
  [norm('Vilemaw')]: 'Calm',
  [norm('Blue Sentinel')]: 'Mind',
  [norm('Irresistible Faefolk')]: 'Body',
  [norm('Elder Dragon')]: 'Body',
  [norm('Rift Herald')]: 'Order',
  [norm('The Ruination')]: 'Order'
});

const COMBO_PORO_SPOTS = Object.freeze(PORO_SP_PAIR_DEFS.map(def => Object.freeze({
  anchor: def.poro,
  anchorSet: 'UNL',
  displayLabel: def.displayLabel,
  poro: def.poro,
  pairedSpNumber: def.spNumber,
  vendettaColorSpot: def.vendettaColorSpot,
  spAnchor: def.spAnchor,
  visualColor: def.visualColor,
  visualDomain: def.visualDomain,
  visualRune: def.visualRune
})));

// Kept as a compatibility export only. Baron is now visually paired with Renekton
// and anchored by the existing Baron spot so the connector/ledger remain unchanged.
const COMBO_BARON_SPOT = COMBO_CHAMPION_SPOTS.find(spot => spot.anchor === 'Baron Nashor');

const COMBO_VISUAL_SPOTS = Object.freeze([
  ...COMBO_CHAMPION_SPOTS,
  ...COMBO_PORO_SPOTS
]);

function matchesAnchor(card = {}, spot = {}) {
  if (setCode(card) !== spot.anchorSet) return false;
  return norm(prefixName(card)) === norm(spot.anchor);
}

function findVisualSpotForAnchor(card = {}) {
  // Final 17-spot combo board: Crystal Rose SPs are no longer standalone anchors.
  // They are visually folded into the six Poro/color-family spots. If an old board
  // still contains an SP anchor, do not reinterpret it as a new ledger spot.
  const cardNumber = String(card.card_number || '').trim().toUpperCase();
  if (cardNumber.startsWith('VEN-SP')) return null;
  return COMBO_VISUAL_SPOTS.find(spot => matchesAnchor(card, spot)) || null;
}

function uniqueCards(cards = []) {
  const seen = new Set();
  return cards.filter(card => {
    const key = Number(card.id) || `${setCode(card)}|${String(card.card_number || '').toUpperCase()}|${norm(card.name)}|${treatment(card)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cardsForChampionSpot(catalog = [], spot = {}) {
  const championCards = (spot.champions || []).flatMap(member => catalog.filter(card => cardBelongsToChampion(card, member.name, member.setCode)));

  // Buyer-facing rule: if a champion exists in this combo lane, any Vendetta ON
  // with that same champion name stays in this lane even when the main family is
  // coming from Unleashed (Diana, Vi, Rengar, Kha'Zix, etc.). This avoids visual
  // confusion without changing the real catalog/ledger mapping.
  const designatedNames = new Set((spot.champions || []).map(member => norm(member.name)));
  const designatedVendettaOns = catalog.filter(card =>
    setCode(card) === 'VEN' &&
    treatment(card) === 'OVERNUMBERED' &&
    designatedNames.has(norm(prefixName(card)))
  );

  const extraNames = new Set((spot.extraOnChampions || []).map(norm));
  const extraOnCards = catalog.filter(card =>
    setCode(card) === 'VEN' &&
    treatment(card) === 'OVERNUMBERED' &&
    extraNames.has(norm(prefixName(card)))
  );

  // Each standalone rival ON advertised in this combo lane also carries that
  // same champion's regular Vendetta Epic. Previously only the overnumbered
  // printing was gathered, which made the Epic look missing in Buyer Bags and
  // the public map. Keep this visual-only and exclude special treatments here.
  const extraEpicCards = catalog.filter(card => {
    const cardTreatment = treatment(card);
    return setCode(card) === 'VEN'
      && String(card.rarity || '').trim().toUpperCase() === 'EPIC'
      && !['OVERNUMBERED', 'ALTERNATE ART', 'SIGNATURE'].includes(cardTreatment)
      && extraNames.has(norm(prefixName(card)));
  });

  const baronCards = spot.baron ? cardsForBaronSpot(catalog) : [];
  return uniqueCards([...championCards, ...designatedVendettaOns, ...extraOnCards, ...extraEpicCards, ...baronCards]).sort(sortChampionFamily);
}

function cardsForPoroSpot(catalog = [], spot = {}) {
  // Visual-only combo family. Keep the actual Poro card with its board anchor,
  // then gather support cards by the color/domain assigned to THIS combo spot.
  // Do not reuse the underlying single-set Poro chase assignment here because
  // the combo board intentionally pairs Plundering->Ahri, Veteran->Sett, etc.
  const poroCards = catalog.filter(card =>
    setCode(card) === 'UNL' && norm(prefixName(card)) === norm(spot.poro)
  );
  if (!spot.pairedSpNumber) return uniqueCards(poroCards).sort(sortChampionFamily);

  const visualDomain = String(spot.visualDomain || '').trim();
  const visualRune = String(spot.visualRune || '').trim();
  const syntheticMapping = {
    poro: spot.poro,
    color: spot.visualColor || '',
    domain: visualDomain,
    mappedCard: '',
    rune: visualRune
  };
  const unlSupportCards = catalog.filter(card => {
    if (setCode(card) !== 'UNL') return false;
    const cardName = norm(prefixName(card));
    if (cardName === norm(spot.poro)) return false;
    if (cardName === norm(visualRune)) return true;
    const namedDomain = COMBO_NAMED_CHASE_DOMAIN[cardName];
    if (namedDomain) return norm(namedDomain) === norm(visualDomain);
    return isUnleashedRareColorCard(card, syntheticMapping, 'UNL');
  });

  const spDef = COMBO_CRYSTAL_ROSE_SPOTS.find(def => def.spNumber === spot.pairedSpNumber);
  const spCards = spDef ? cardsForCrystalRoseSpot(catalog, spDef) : [];
  return uniqueCards([...poroCards, ...unlSupportCards, ...spCards]).sort(sortChampionFamily);
}

function cardsForCrystalRoseSpot(catalog = [], spot = {}) {
  const mapping = vendettaSpotMapping(spot.vendettaColorSpot, 'VEN');
  if (!mapping) return [];
  const spNumber = spot.spNumber.toUpperCase();
  const cards = catalog.filter(card => {
    if (setCode(card) !== 'VEN') return false;
    const number = String(card.card_number || '').trim().toUpperCase();
    const name = norm(prefixName(card));
    if (number === spNumber) return true;
    if (name === norm(mapping.rune) && isShowcaseRune(card)) return true;
    if (mapping.extras.some(extra => name === norm(extra))) return true;
    return isVendettaRareColorCard(card, mapping, 'VEN');
  });
  return uniqueCards(cards).sort(sortChampionFamily);
}

function cardsForBaronSpot(catalog = []) {
  // This intentionally means all Baron Nashor printings: regular Epic, AA,
  // and Ultimate/overnumbered. It does NOT sweep generic Chaos cards into Baron.
  return uniqueCards(catalog.filter(card => cardBelongsToBaron(card, 'UNL'))).sort(sortChampionFamily);
}

function visualFamilyForSpot(catalog = [], spot = {}) {
  if (spot.poro) return cardsForPoroSpot(catalog, spot);
  if (spot.spNumber) return cardsForCrystalRoseSpot(catalog, spot);
  return cardsForChampionSpot(catalog, spot);
}

function listingNoteForSpot(spot = {}) {
  if (spot.poro) return spot.displayLabel;
  const extras = (spot.extraOnChampions || []).map(name => ` + ${name} ON + Epic (VEN)`).join('');
  return `${spot.displayLabel}${extras}`;
}

function isSignatureCard(card = {}) {
  const value = treatment(card);
  const number = String(card.card_number || '').trim();
  return value === 'SIGNATURE' || /\*$/.test(number);
}

function heroCardsForSpot(catalog = [], spot = {}, boardAnchor = {}) {
  // Hero cards are display-only. For champion combo spots, the popup/display
  // should show the two Signature selections that define the purchased visual
  // combo. Single-anchor spots intentionally keep a single hero so the normal
  // reveal behavior remains unchanged.
  if (spot.baron) {
    const renekton = (spot.champions || [])[0];
    const renektonFamily = renekton ? catalog.filter(card => cardBelongsToChampion(card, renekton.name, renekton.setCode)) : [];
    const renektonHero = renektonFamily.filter(isSignatureCard).sort(sortChampionFamily)[0] || renektonFamily.sort(sortChampionFamily)[0];
    const baronFamily = cardsForBaronSpot(catalog);
    const baronHero = baronFamily.find(card => treatment(card) === 'OVERNUMBERED' || treatment(card) === 'ULTIMATE') || baronFamily[0] || boardAnchor;
    return uniqueCards([baronHero, renektonHero].filter(Boolean));
  }
  if (spot.champions) {
    return uniqueCards(spot.champions.map(member => {
      const family = catalog.filter(card => cardBelongsToChampion(card, member.name, member.setCode));
      return family.filter(isSignatureCard).sort(sortChampionFamily)[0]
        || family.sort(sortChampionFamily)[0]
        || (norm(prefixName(boardAnchor)) === norm(member.name) ? boardAnchor : null);
    }).filter(Boolean));
  }
  if (spot.spNumber) {
    const exact = catalog.find(card => setCode(card) === 'VEN' && String(card.card_number || '').trim().toUpperCase() === String(spot.spNumber).toUpperCase());
    return exact ? [exact] : (boardAnchor?.id ? [boardAnchor] : []);
  }
  if (spot.poro) {
    const family = cardsForPoroSpot(catalog, spot);
    const poroHero = family.find(card => setCode(card) === 'UNL' && norm(prefixName(card)) === norm(spot.poro) && treatment(card) === 'OVERNUMBERED')
      || family.find(card => setCode(card) === 'UNL' && norm(prefixName(card)) === norm(spot.poro))
      || boardAnchor;
    const spHero = spot.pairedSpNumber
      ? family.find(card => setCode(card) === 'VEN' && String(card.card_number || '').trim().toUpperCase() === String(spot.pairedSpNumber).toUpperCase())
      : null;
    return uniqueCards([poroHero, spHero].filter(Boolean));
  }
  return boardAnchor?.id ? [boardAnchor] : [];
}

function buildVisualSpot(catalog = [], boardAnchor = {}) {
  const spot = findVisualSpotForAnchor(boardAnchor);
  if (!spot) return null;
  return {
    profileId: COMBO_VISUAL_PROFILE_ID,
    anchorCardId: Number(boardAnchor.id) || 0,
    position: Number(boardAnchor.position) || 0,
    displayLabel: spot.displayLabel,
    anchor: spot.anchor,
    anchorSet: spot.anchorSet,
    visualOnly: true,
    family: visualFamilyForSpot(catalog, spot),
    heroCards: heroCardsForSpot(catalog, spot, boardAnchor),
    listingNote: listingNoteForSpot(spot)
  };
}

module.exports = {
  COMBO_BARON_SPOT,
  COMBO_CHAMPION_SPOTS,
  COMBO_CRYSTAL_ROSE_SPOTS,
  COMBO_NAMED_CHASE_DOMAIN,
  COMBO_PORO_SPOTS,
  COMBO_VISUAL_PROFILE_ID,
  COMBO_VISUAL_SPOTS,
  buildVisualSpot,
  cardsForBaronSpot,
  cardsForChampionSpot,
  cardsForCrystalRoseSpot,
  cardsForPoroSpot,
  findVisualSpotForAnchor,
  heroCardsForSpot,
  listingNoteForSpot,
  visualFamilyForSpot
};
