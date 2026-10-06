const SUPPORTED_SET_CODES = new Set(['OGN', 'OGS', 'SFD', 'UNL', 'VEN']);

function setCodeFromCardNumber(value) {
  const match = String(value || '').trim().toUpperCase().match(/^(OGN|OGS|SFD|UNL|VEN)(?:-|\s)/);
  return match?.[1] || '';
}

function repairRiftboundSetAssignments(database, sets = []) {
  const setByCode = new Map(sets.map(set => [String(set.setCode || '').toUpperCase(), set]));
  const rows = database.prepare(`
    SELECT id, card_number, game_code, set_code, set_name, game_name, product_name
    FROM cards
    WHERE LOWER(TRIM(COALESCE(official_id, ''))) LIKE 'riftbound:%'
       OR UPPER(TRIM(COALESCE(game_code, ''))) = 'RIFTBOUND'
  `).all();
  const update = database.prepare(`
    UPDATE cards
    SET game_code = 'RIFTBOUND', game_name = ?, set_code = ?, set_name = ?, product_name = ?
    WHERE id = ?
  `);
  let repaired = 0;
  database.exec('BEGIN IMMEDIATE');
  try {
    for (const row of rows) {
      const inferredCode = setCodeFromCardNumber(row.card_number);
      const currentCode = String(row.set_code || '').trim().toUpperCase();
      const setCode = SUPPORTED_SET_CODES.has(currentCode) ? currentCode : inferredCode;
      const set = setByCode.get(setCode);
      if (!set) continue;
      const correct = String(row.game_code || '').trim().toUpperCase() === 'RIFTBOUND'
        && currentCode === setCode
        && String(row.set_name || '').trim() === set.setName
        && String(row.game_name || '').trim() === 'Riftbound: League of Legends TCG';
      if (correct) continue;
      update.run('Riftbound: League of Legends TCG', setCode, set.setName, set.productName, row.id);
      repaired += 1;
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return { repairedRiftboundSetAssignments: repaired };
}

module.exports = { SUPPORTED_SET_CODES, setCodeFromCardNumber, repairRiftboundSetAssignments };
