function normalizeExistingSpecialCards(database) {
  // Keep the raw Bandai rarity for audit/matching, while using SP as the
  // concise local rarity used by the library and break filters.
  database.prepare(`
    UPDATE cards
    SET source_rarity = rarity
    WHERE TRIM(COALESCE(source_rarity, '')) = ''
      AND TRIM(COALESCE(rarity, '')) != ''
  `).run();
  database.prepare(`
    UPDATE cards
    SET rarity = 'SP'
    WHERE UPPER(TRIM(COALESCE(rarity, ''))) IN ('SP CARD', 'SPECIAL')
  `).run();
}

module.exports = { normalizeExistingSpecialCards };
