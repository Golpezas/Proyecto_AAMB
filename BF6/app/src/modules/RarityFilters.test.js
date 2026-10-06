const assert = require('node:assert/strict');
const {
  ALTERNATE_ART,
  MANUAL_GOLD_DON,
  MANUAL_MANGA,
  breakRarityForCard,
  groupRarityEntries,
  isBreakRarityFilterEntry,
  rarityFilterDefinition,
  rarityValuesForFilter,
  normalizedRarity,
  rarityLabel,
  raritySortKey,
  rarityFilterKey
} = require('./RarityFilters');

assert.deepEqual(rarityValuesForFilter('All'), []);
assert.deepEqual(rarityValuesForFilter('Leader'), ['L', 'LEADER']);
assert.deepEqual(rarityValuesForFilter('Super Rare'), ['SR', 'SUPER RARE']);
assert.deepEqual(rarityValuesForFilter('SP'), ['SP', 'SPECIAL', 'SP CARD']);
assert.deepEqual(rarityValuesForFilter('Special'), ['SP', 'SPECIAL', 'SP CARD']);
assert.deepEqual(rarityValuesForFilter('DON!! Card'), ['DON!!', 'DON!! CARD', 'DON CARD', '-']);
assert.deepEqual(rarityValuesForFilter('Leader AA'), ['L', 'LEADER']);
assert.equal(rarityLabel('SP CARD'), 'SP');
assert.equal(rarityLabel('-'), 'DON!! Card');
assert.ok(raritySortKey('L') < raritySortKey('SR'));
assert.equal(normalizedRarity('SP CARD'), 'SP');
assert.equal(normalizedRarity('Promo'), 'PROMO');
assert.equal(rarityFilterKey('SP CARD'), 'SP');
assert.equal(rarityFilterKey('-'), 'DON!! Card');
assert.equal(rarityFilterKey('MANGA'), 'Manga');
assert.equal(rarityFilterKey('GOLD DON'), 'Gold DON!!');
assert.equal(isBreakRarityFilterEntry({ value: 'P' }), false);
assert.equal(isBreakRarityFilterEntry({ value: 'PROMO' }), false);
assert.equal(isBreakRarityFilterEntry({ value: 'P', manual_category: MANUAL_MANGA }), true);
assert.equal(breakRarityForCard({ rarity: 'L', variant: ALTERNATE_ART }), 'L AA');
assert.equal(breakRarityForCard({ rarity: 'SR', variant: ALTERNATE_ART }), 'SR AA');
assert.equal(breakRarityForCard({ rarity: 'SEC', variant: ALTERNATE_ART }), 'SEC AA');
assert.equal(breakRarityForCard({ rarity: 'L', variant: '' }), 'L');
assert.equal(breakRarityForCard({ rarity: 'SP CARD', variant: '' }), 'SP');
assert.equal(breakRarityForCard({ rarity: 'SR', manual_category: MANUAL_MANGA }), 'MANGA');
assert.equal(breakRarityForCard({ rarity: 'DON!! CARD', manual_category: MANUAL_GOLD_DON }), 'GOLD DON!!');
assert.deepEqual(rarityFilterDefinition('Leader AA'), { values: ['L', 'LEADER'], requiredVariant: 'Alternate Art', excludedVariant: '', manualCategory: '', excludesManualCategory: true });
assert.deepEqual(rarityFilterDefinition('Leader'), { values: ['L', 'LEADER'], requiredVariant: '', excludedVariant: 'Alternate Art', manualCategory: '', excludesManualCategory: true });
assert.deepEqual(rarityFilterDefinition('Manga'), { values: ['MANGA', 'MANGA RARE', 'MANGA SEC', 'MANGA SR', 'MANGA R'], requiredVariant: '', excludedVariant: '', manualCategory: 'Manga', excludesManualCategory: false });
assert.deepEqual(rarityFilterDefinition('Gold DON!!'), { values: ['GOLD DON', 'GOLD DON!!'], requiredVariant: '', excludedVariant: '', manualCategory: 'Gold DON!!', excludesManualCategory: false });
assert.deepEqual(groupRarityEntries([{ value: 'L', count: 6 }, { value: 'SP CARD', count: 6 }, { value: '-', count: 2 }]), [
  { filter: 'Leader', label: 'Leader', count: 6 },
  { filter: 'SP', label: 'SP', count: 6 },
  { filter: 'DON!! Card', label: 'DON!! Card', count: 2 }
]);
assert.deepEqual(groupRarityEntries([
  { value: 'L', variant: '', count: 6 },
  { value: 'L', variant: ALTERNATE_ART, count: 2 },
  { value: 'SR', variant: ALTERNATE_ART, count: 3 },
  { value: 'SEC', variant: ALTERNATE_ART, count: 1 }
]), [
  { filter: 'Leader', label: 'Leader', count: 6 },
  { filter: 'Leader AA', label: 'Leader Alternate Art (L AA)', count: 2 },
  { filter: 'Super Rare AA', label: 'Super Rare Alternate Art (SR AA)', count: 3 },
  { filter: 'Secret Rare AA', label: 'Secret Rare Alternate Art (SEC AA)', count: 1 }
]);
assert.deepEqual(groupRarityEntries([
  { value: 'SR', manual_category: MANUAL_MANGA, count: 2 },
  { value: 'DON!! CARD', manual_category: MANUAL_GOLD_DON, count: 1 }
]), [
  { filter: 'Manga', label: 'Manga', count: 2 },
  { filter: 'Gold DON!!', label: 'Gold DON!!', count: 1 }
]);
console.log('Rarity filter mapping test passed.');
