'use strict';

const {
  COMBO_CHAMPION_SPOTS,
  COMBO_NAMED_CHASE_DOMAIN,
  COMBO_PORO_SPOTS,
  COMBO_VISUAL_SPOTS
} = require('./RiftboundComboVisualProfile');
const {
  UNLEASHED_CHAMPIONS,
  UNLEASHED_PORO_MAPPINGS,
  VENDETTA_SIGNATURE_CHAMPIONS
} = require('./RiftboundChampionAudit');

const VENDETTA_RIVAL_ON_CHAMPIONS = Object.freeze([
  'Vi', 'Jinx', 'Zed', 'Shen', 'Riven', 'Draven', 'Swain', 'Irelia',
  'Jayce', 'Viktor', 'Renekton', 'Nasus', 'Rengar', "Kha'Zix", 'Gangplank',
  'Illaoi', 'Diana', 'Leona', 'Kayle', 'Morgana', 'Ambessa', 'Mel'
]);


const EXPECTED_STANDALONE_ON_ASSIGNMENTS = Object.freeze({
  Akali: 'Irelia',
  Diana: 'Leona',
  Zed: 'Riven',
  Jayce: 'Viktor',
  Mel: 'Kayle',
  LeBlanc: 'Morgana',
  Nasus: 'Illaoi',
  Vex: 'Swain',
  Vi: 'Jinx',
  Pyke: 'Draven',
  'Baron Nashor': 'Gangplank'
});


const EXPECTED_PORO_VISUAL_PAIRS = Object.freeze({
  'Pouty Poro': Object.freeze({ sp: "Kai'Sa", domain: 'Fury', rune: 'Fury Rune' }),
  'Lonely Poro': Object.freeze({ sp: 'Sona', domain: 'Calm', rune: 'Calm Rune' }),
  'Plundering Poro': Object.freeze({ sp: 'Ahri', domain: 'Mind', rune: 'Mind Rune' }),
  'Veteran Poro': Object.freeze({ sp: 'Sett', domain: 'Body', rune: 'Body Rune' }),
  'Mystic Poro': Object.freeze({ sp: 'Ezreal', domain: 'Chaos', rune: 'Chaos Rune' }),
  'Daring Poro': Object.freeze({ sp: 'Lux', domain: 'Order', rune: 'Order Rune' })
});

const UNLEASHED_RUNE_CHAMPION_UNITS = Object.freeze([
  Object.freeze({ domain: 'Fury', names: Object.freeze(['Katarina', 'Xerath']) }),
  Object.freeze({ domain: 'Calm', names: Object.freeze(['Nami', 'Yuumi']) }),
  Object.freeze({ domain: 'Mind', names: Object.freeze(['Hwei', 'Zilean']) }),
  Object.freeze({ domain: 'Body', names: Object.freeze(['Nidalee', 'Nilah']) }),
  Object.freeze({ domain: 'Chaos', names: Object.freeze(['Evelynn', 'Syndra']) }),
  Object.freeze({ domain: 'Order', names: Object.freeze(['Ashe', 'Galio']) })
]);

function norm(value) {
  return String(value || '').trim().toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']+/g, ' ');
}

function championLaneNames() {
  return COMBO_CHAMPION_SPOTS.flatMap(spot => (spot.champions || []).map(member => member.name));
}

function extraOnNames() {
  return COMBO_CHAMPION_SPOTS.flatMap(spot => spot.extraOnChampions || []);
}

function designatedVendettaNames() {
  return COMBO_CHAMPION_SPOTS.flatMap(spot => (spot.champions || [])
    .filter(member => member.setCode === 'VEN')
    .map(member => member.name));
}

function containsName(list, name) {
  const key = norm(name);
  return list.some(value => norm(value) === key);
}

function auditComboMapping() {
  const champNames = championLaneNames();
  const extras = extraOnNames();
  const vendettaDesignated = designatedVendettaNames();

  const missingUnleashedChampions = UNLEASHED_CHAMPIONS.filter(name => !containsName(champNames, name));
  const missingVendettaSignatures = VENDETTA_SIGNATURE_CHAMPIONS.filter(name => !containsName(vendettaDesignated, name));
  const missingVendettaRivalOns = VENDETTA_RIVAL_ON_CHAMPIONS.filter(name =>
    !containsName(champNames, name) && !containsName(extras, name));
  const duplicateRivalOns = VENDETTA_RIVAL_ON_CHAMPIONS.filter(name => {
    const key = norm(name);
    const count = champNames.filter(value => norm(value) === key).length + extras.filter(value => norm(value) === key).length;
    return count > 1;
  });
  const missingPoros = UNLEASHED_PORO_MAPPINGS.filter(mapping =>
    !COMBO_PORO_SPOTS.some(spot => norm(spot.poro) === norm(mapping.poro))).map(mapping => mapping.poro);
  const hasBaron = COMBO_CHAMPION_SPOTS.some(spot => spot.baron === true && /^Baron\s*\+/i.test(spot.displayLabel));
  const badPoroVisualPairs = COMBO_PORO_SPOTS.filter(spot => {
    const expected = EXPECTED_PORO_VISUAL_PAIRS[spot.poro];
    return !expected
      || norm(spot.spAnchor) !== norm(expected.sp)
      || norm(spot.visualDomain) !== norm(expected.domain)
      || norm(spot.visualRune) !== norm(expected.rune);
  });
  const riftHeraldVisualDomain = COMBO_NAMED_CHASE_DOMAIN[norm('Rift Herald')] || '';
  const irresistibleVisualDomain = COMBO_NAMED_CHASE_DOMAIN[norm('Irresistible Faefolk')] || '';
  const standaloneOnAssignments = COMBO_CHAMPION_SPOTS.map(spot => ({
    anchor: spot.anchor,
    names: [...(spot.extraOnChampions || [])]
  }));
  const badStandaloneOnAssignments = standaloneOnAssignments.filter(item =>
    item.names.length !== 1 || norm(item.names[0]) !== norm(EXPECTED_STANDALONE_ON_ASSIGNMENTS[item.anchor])
  );
  const duplicateStandaloneOns = extras.filter((name, index) =>
    extras.findIndex(other => norm(other) === norm(name)) !== index
  );

  return {
    spotCount: COMBO_VISUAL_SPOTS.length,
    championSpotCount: COMBO_CHAMPION_SPOTS.length,
    poroSpotCount: COMBO_PORO_SPOTS.length,
    missingUnleashedChampions,
    missingVendettaSignatures,
    missingVendettaRivalOns,
    duplicateRivalOns,
    missingPoros,
    missingBaron: !hasBaron,
    standaloneOnAssignments,
    badStandaloneOnAssignments,
    duplicateStandaloneOns,
    badPoroVisualPairs,
    riftHeraldVisualDomain,
    irresistibleVisualDomain,
    runeChampionUnits: UNLEASHED_RUNE_CHAMPION_UNITS,
    ok: missingUnleashedChampions.length === 0
      && missingVendettaSignatures.length === 0
      && missingVendettaRivalOns.length === 0
      && duplicateRivalOns.length === 0
      && missingPoros.length === 0
      && badStandaloneOnAssignments.length === 0
      && duplicateStandaloneOns.length === 0
      && badPoroVisualPairs.length === 0
      && norm(riftHeraldVisualDomain) === norm('Order')
      && norm(irresistibleVisualDomain) === norm('Body')
      && hasBaron
      && COMBO_VISUAL_SPOTS.length === 17
  };
}

module.exports = {
  EXPECTED_PORO_VISUAL_PAIRS,
  EXPECTED_STANDALONE_ON_ASSIGNMENTS,
  UNLEASHED_RUNE_CHAMPION_UNITS,
  VENDETTA_RIVAL_ON_CHAMPIONS,
  auditComboMapping
};
