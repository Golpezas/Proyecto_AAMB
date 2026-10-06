const FILTER_VALUES = Object.freeze({
  Leader: ['L', 'LEADER'],
  Common: ['C', 'COMMON'],
  Uncommon: ['UC', 'UNCOMMON'],
  Rare: ['R', 'RARE'],
  'Super Rare': ['SR', 'SUPER RARE'],
  'Secret Rare': ['SEC', 'SECRET RARE'],
  SP: ['SP', 'SPECIAL', 'SP CARD'],
  // Kept only so an older saved filter value still works after this update.
  Special: ['SP', 'SPECIAL', 'SP CARD'],
  Manga: ['MANGA', 'MANGA RARE', 'MANGA SEC', 'MANGA SR', 'MANGA R'],
  'Gold DON!!': ['GOLD DON', 'GOLD DON!!'],
  'Treasure Rare': ['TR', 'TREASURE RARE'],
  'DON!! Card': ['DON!!', 'DON!! CARD', 'DON CARD', '-']
});

const ALTERNATE_ART = 'Alternate Art';
const MANUAL_MANGA = 'Manga';
const MANUAL_GOLD_DON = 'Gold DON!!';
// Bandai uses P for promotional-card records. It is useful source data, but
// it is not one of the break rarity buckets the user builds a break list from.
const NON_BREAK_RARITIES = Object.freeze(['P', 'PROMO', 'PROMOTIONAL', 'PROMOTION']);

// Bandai's catalog normally supplies the base rarity only.  The local variant
// label gives the break library a separate AA category without overwriting the
// official rarity used for source data and deduplication.
const ALTERNATE_ART_FILTERS = Object.freeze({
  'Leader AA': { label: 'Leader Alternate Art (L AA)', values: FILTER_VALUES.Leader, sortValue: 'L AA' },
  'Rare AA': { label: 'Rare Alternate Art (R AA)', values: FILTER_VALUES.Rare, sortValue: 'R AA' },
  'Super Rare AA': { label: 'Super Rare Alternate Art (SR AA)', values: FILTER_VALUES['Super Rare'], sortValue: 'SR AA' },
  'Secret Rare AA': { label: 'Secret Rare Alternate Art (SEC AA)', values: FILTER_VALUES['Secret Rare'], sortValue: 'SEC AA' },
  'Alternate Art': { label: 'Alternate Art', values: [], sortValue: 'AA' }
});

const ALTERNATE_ART_FILTER_BY_BASE = Object.freeze({
  Leader: 'Leader AA',
  Rare: 'Rare AA',
  'Super Rare': 'Super Rare AA',
  'Secret Rare': 'Secret Rare AA'
});

const MANUAL_CATEGORY_FILTERS = Object.freeze({
  [MANUAL_MANGA]: { filter: 'Manga', label: 'Manga', sortValue: 'MANGA' },
  [MANUAL_GOLD_DON]: { filter: 'Gold DON!!', label: 'Gold DON!!', sortValue: 'GOLD DON!!' }
});

const RARITY_LABELS = Object.freeze({
  L: 'Leader',
  C: 'Common',
  UC: 'Uncommon',
  R: 'Rare',
  SR: 'Super Rare',
  SEC: 'Secret Rare',
  SP: 'SP',
  'SP CARD': 'SP',
  MANGA: 'Manga',
  'MANGA RARE': 'Manga',
  'MANGA SEC': 'Manga',
  'MANGA SR': 'Manga',
  'MANGA R': 'Manga',
  'GOLD DON': 'Gold DON!!',
  'GOLD DON!!': 'Gold DON!!',
  TR: 'Treasure Rare',
  '-': 'DON!! Card',
  'DON!!': 'DON!! Card',
  'DON!! CARD': 'DON!! Card'
});

function rarityValuesForFilter(filter) {
  const label = String(filter || '').trim();
  if (!label || label === 'All') return [];
  if (ALTERNATE_ART_FILTERS[label]) return ALTERNATE_ART_FILTERS[label].values;
  return FILTER_VALUES[label] || [label.toUpperCase()];
}

function normalizedRarity(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'SP CARD' || raw === 'SPECIAL') return 'SP';
  if (['MANGA', 'MANGA RARE', 'MANGA SEC', 'MANGA SR', 'MANGA R'].includes(raw)) return 'MANGA';
  if (raw === 'GOLD DON' || raw === 'GOLD DON!!') return 'GOLD DON!!';
  return raw;
}

function isAlternateArt(variant) {
  return String(variant || '').trim().toLowerCase() === ALTERNATE_ART.toLowerCase();
}

function normalizedManualCategory(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === MANUAL_MANGA.toLowerCase()) return MANUAL_MANGA;
  if (raw === MANUAL_GOLD_DON.toLowerCase() || raw === 'gold don') return MANUAL_GOLD_DON;
  return '';
}

function manualCategoryForFilter(filter) {
  const label = String(filter || '').trim();
  if (label === 'Manga') return MANUAL_MANGA;
  if (label === 'Gold DON!!') return MANUAL_GOLD_DON;
  return '';
}

function rarityFilterDefinition(filter) {
  const label = String(filter || '').trim() || 'All';
  if (ALTERNATE_ART_FILTERS[label]) {
    return {
      values: ALTERNATE_ART_FILTERS[label].values,
      requiredVariant: ALTERNATE_ART,
      excludedVariant: '',
      manualCategory: '',
      excludesManualCategory: true
    };
  }
  const manualCategory = manualCategoryForFilter(label);
  if (manualCategory) {
    return {
      values: rarityValuesForFilter(label),
      requiredVariant: '',
      excludedVariant: '',
      manualCategory,
      excludesManualCategory: false
    };
  }
  return {
    values: rarityValuesForFilter(label),
    requiredVariant: '',
    // Base rarity filters intentionally keep AA-labeled cards separate.
    excludedVariant: label === 'All' ? '' : ALTERNATE_ART,
    manualCategory: '',
    excludesManualCategory: label !== 'All'
  };
}

function rarityLabel(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return RARITY_LABELS[normalized] || String(value || '').trim();
}

function raritySortKey(value) {
  const order = ['L', 'LEADER', 'L AA', 'AA', 'C', 'UC', 'R', 'RARE', 'R AA', 'SR', 'SUPER RARE', 'SR AA', 'SEC', 'SECRET RARE', 'SEC AA', 'SP', 'SP CARD', 'MANGA', 'MANGA RARE', 'MANGA SEC', 'MANGA SR', 'MANGA R', 'GOLD DON', 'GOLD DON!!', 'TR', '-', 'DON!!', 'DON!! CARD'];
  const position = order.indexOf(String(value || '').trim().toUpperCase());
  return position === -1 ? order.length : position;
}

function rarityFilterKey(value) {
  const normalized = normalizedRarity(value);
  const matchingLabel = Object.entries(FILTER_VALUES).find(([, values]) => values.includes(normalized));
  return matchingLabel ? matchingLabel[0] : String(value || '').trim();
}

function isBreakRarityFilterEntry({ value, manual_category } = {}) {
  // A user-assigned break category always takes precedence, including for a
  // promotional card that has been identified as Manga or Gold DON!!.
  if (normalizedManualCategory(manual_category)) return true;
  return !NON_BREAK_RARITIES.includes(String(value || '').trim().toUpperCase());
}

function breakRarityForCard({ rarity, variant, manual_category } = {}) {
  const manualCategory = normalizedManualCategory(manual_category);
  if (manualCategory === MANUAL_MANGA) return 'MANGA';
  if (manualCategory === MANUAL_GOLD_DON) return 'GOLD DON!!';
  if (!isAlternateArt(variant)) return normalizedRarity(rarity);
  const filter = ALTERNATE_ART_FILTER_BY_BASE[rarityFilterKey(rarity)] || 'Alternate Art';
  return ({ 'Leader AA': 'L AA', 'Rare AA': 'R AA', 'Super Rare AA': 'SR AA', 'Secret Rare AA': 'SEC AA', 'Alternate Art': 'AA' })[filter];
}

function rarityEntryDescriptor(entry) {
  const manualCategory = normalizedManualCategory(entry.manual_category);
  if (manualCategory) {
    const definition = MANUAL_CATEGORY_FILTERS[manualCategory];
    return { filter: definition.filter, label: definition.label, sortValue: definition.sortValue };
  }
  const baseFilter = rarityFilterKey(entry.value);
  if (isAlternateArt(entry.variant)) {
    const filter = ALTERNATE_ART_FILTER_BY_BASE[baseFilter] || 'Alternate Art';
    const definition = ALTERNATE_ART_FILTERS[filter];
    return { filter, label: definition.label, sortValue: definition.sortValue };
  }
  return { filter: baseFilter, label: rarityLabel(entry.value), sortValue: entry.value };
}

function groupRarityEntries(entries) {
  const grouped = new Map();
  for (const entry of entries) {
    const { filter, label, sortValue } = rarityEntryDescriptor(entry);
    const existing = grouped.get(filter) || { filter, label, count: 0, sortValue };
    existing.count += Number(entry.count) || 0;
    grouped.set(filter, existing);
  }
  return [...grouped.values()]
    .sort((left, right) => raritySortKey(left.sortValue) - raritySortKey(right.sortValue) || left.label.localeCompare(right.label))
    .map(({ sortValue, ...entry }) => entry);
}

module.exports = {
  ALTERNATE_ART,
  MANUAL_GOLD_DON,
  MANUAL_MANGA,
  breakRarityForCard,
  groupRarityEntries,
  isBreakRarityFilterEntry,
  isAlternateArt,
  manualCategoryForFilter,
  normalizedManualCategory,
  rarityFilterDefinition,
  rarityValuesForFilter,
  normalizedRarity,
  rarityLabel,
  raritySortKey,
  rarityFilterKey
};
