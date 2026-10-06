function listDuplicateOfficialCardGroups(database) {
  return database.prepare(`
    SELECT GROUP_CONCAT(id) AS ids
    FROM (
      SELECT
        id,
        LOWER(TRIM(COALESCE(card_number, ''))) || char(31) ||
        UPPER(TRIM(COALESCE(rarity, ''))) || char(31) ||
        UPPER(TRIM(COALESCE(card_type, ''))) || char(31) ||
        LOWER(TRIM(COALESCE(name, ''))) || char(31) ||
        CASE
          WHEN TRIM(COALESCE(image_url, '')) = '' THEN ''
          WHEN instr(image_url, '?') > 0 THEN LOWER(substr(image_url, 1, instr(image_url, '?') - 1))
          WHEN instr(image_url, '#') > 0 THEN LOWER(substr(image_url, 1, instr(image_url, '#') - 1))
          ELSE LOWER(image_url)
        END AS duplicate_key
      FROM cards
      WHERE source = 'Official Bandai'
    )
    GROUP BY duplicate_key
    HAVING COUNT(*) > 1
  `).all();
}

function deduplicateOfficialCards(database) {
  const groups = listDuplicateOfficialCardGroups(database);
  if (!groups.length) return { removedDuplicates: 0, groupsRepaired: 0 };

  let removedDuplicates = 0;
  database.exec('BEGIN IMMEDIATE');
  try {
    for (const group of groups) {
      const ids = String(group.ids || '').split(',').map(Number).filter(id => Number.isInteger(id) && id > 0);
      if (ids.length < 2) continue;
      const placeholders = ids.map(() => '?').join(', ');
      const candidates = database.prepare(`
        SELECT
          c.id,
          c.image_path,
          LENGTH(COALESCE(c.details_json, '')) AS details_length,
          CASE WHEN s.card_id IS NULL THEN 0 ELSE 1 END AS is_saved
        FROM cards c
        LEFT JOIN saved_cards s ON s.card_id = c.id
        WHERE c.id IN (${placeholders})
      `).all(...ids);
      candidates.sort((left, right) =>
        Number(Boolean(right.image_path)) - Number(Boolean(left.image_path)) ||
        right.is_saved - left.is_saved ||
        right.details_length - left.details_length ||
        left.id - right.id
      );
      const keeper = candidates[0];
      const duplicateIds = candidates.slice(1).map(card => card.id);
      if (!keeper || !duplicateIds.length) continue;

      if (candidates.some(card => card.is_saved)) {
        database.prepare('INSERT OR IGNORE INTO saved_cards (card_id, saved_at) VALUES (?, ?)').run(keeper.id, new Date().toISOString());
      }
      // Both the working board and the saved live ledger are optional on old
      // databases. If either has selected a duplicate, keep that selection by
      // moving it to the retained official card before deleting the duplicate.
      for (const table of ['break_board_cards', 'active_break_board_cards']) {
        const exists = Boolean(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
        if (!exists) continue;
        const boardOnKeeper = database.prepare(`SELECT card_id FROM ${table} WHERE card_id = ?`).get(keeper.id);
        const boardRows = database.prepare(`
          SELECT card_id, position
          FROM ${table}
          WHERE card_id IN (${duplicateIds.map(() => '?').join(', ')})
          ORDER BY position ASC
        `).all(...duplicateIds);
        if (boardRows.length && !boardOnKeeper) {
          database.prepare(`UPDATE ${table} SET card_id = ? WHERE card_id = ?`).run(keeper.id, boardRows[0].card_id);
        }
        if (boardRows.length > 1 || boardOnKeeper) {
          const selectedToRemove = boardOnKeeper ? boardRows : boardRows.slice(1);
          if (selectedToRemove.length) {
            database.prepare(`DELETE FROM ${table} WHERE card_id IN (${selectedToRemove.map(() => '?').join(', ')})`)
              .run(...selectedToRemove.map(row => row.card_id));
          }
        }
      }
      database.prepare(`DELETE FROM saved_cards WHERE card_id IN (${duplicateIds.map(() => '?').join(', ')})`).run(...duplicateIds);
      database.prepare(`DELETE FROM cards WHERE id IN (${duplicateIds.map(() => '?').join(', ')})`).run(...duplicateIds);
      removedDuplicates += duplicateIds.length;
    }
    database.prepare(`
      INSERT INTO app_metadata (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run('last-library-repair', JSON.stringify({ completedAt: new Date().toISOString(), removedDuplicates }));
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return { removedDuplicates, groupsRepaired: groups.length };
}

function resetLocalLibrary(database, confirmation) {
  if (confirmation !== 'DELETE') throw new Error('Type DELETE exactly to clear the local library.');
  const deletedCards = database.prepare('SELECT COUNT(*) AS count FROM cards').get().count;
  database.exec('BEGIN IMMEDIATE');
  try {
    for (const table of ['break_board_cards', 'active_break_board_cards', 'break_board_preset_cards', 'break_board_presets']) {
      const exists = Boolean(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
      if (exists) database.prepare(`DELETE FROM ${table}`).run();
    }
    database.prepare('DELETE FROM saved_cards').run();
    database.prepare('DELETE FROM cards').run();
    database.prepare('DELETE FROM import_sessions').run();
    database.prepare(`
      INSERT INTO app_metadata (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run('last-library-reset', JSON.stringify({ completedAt: new Date().toISOString(), deletedCards }));
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return { deletedCards, imagesPreserved: true };
}

module.exports = { deduplicateOfficialCards, resetLocalLibrary };
