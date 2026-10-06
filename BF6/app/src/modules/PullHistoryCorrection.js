const { addPullHistoryItem } = require('./PullHistory');
const { syncBoxTrackerFromHistory } = require('./AutomaticBoxTracker');
const { syncLinkedCaseBoxFromHistory } = require('./LiveCaseTracker');

function pullRows(database, batchId) {
  return database.prepare(`
    SELECT id, batch_id, buyer_name, position, card_name, card_number, set_code,
      rarity, collector_treatment, variant_hint, quantity, source_kind,
      market_price_cents, market_source, market_variant, market_external_id,
      market_updated_at, market_match_status
    FROM pull_history_items
    WHERE batch_id = ?
    ORDER BY position ASC, card_number ASC, card_name ASC, id ASC
  `).all(batchId);
}

function replaceArchivedPulls(database, historyId, pulls) {
  database.prepare('DELETE FROM break_order_history_pulls WHERE history_id = ?').run(historyId);
  const insert = database.prepare(`
    INSERT INTO break_order_history_pulls (
      history_id, buyer_name, position, card_name, card_number, set_code,
      rarity, collector_treatment, variant_hint, quantity, source_kind
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const pull of pulls) {
    insert.run(
      historyId,
      String(pull.buyer_name || ''),
      Number(pull.position),
      String(pull.card_name || ''),
      String(pull.card_number || ''),
      String(pull.set_code || ''),
      String(pull.rarity || ''),
      String(pull.collector_treatment || ''),
      String(pull.variant_hint || ''),
      Math.max(1, Math.min(99, Number(pull.quantity || 1))),
      String(pull.source_kind || 'selected')
    );
  }
}

// Corrects a completed Pull History record without reading or writing the
// live board. Any archived Order History pull copy is replaced from the
// corrected canonical batch, and an existing linked Box Tracker is rebuilt
// in place so quantities can never accumulate twice.
function addPullHistoryCardCorrection(database, payload = {}) {
  const correctedAt = String(payload.correctedAt || payload.corrected_at || '').trim() || new Date().toISOString();
  let added;
  let linkedOrderCount = 0;
  let rebuiltTrackerCount = 0;
  let pulls = [];
  database.exec('BEGIN IMMEDIATE');
  try {
    added = addPullHistoryItem(database, payload);
    pulls = pullRows(database, added.batchId);
    const histories = database.prepare(`
      SELECT id, break_name, recorded_at, tracker_record_type, box_tracker_id
      FROM break_order_history
      WHERE pull_history_batch_id = ?
      ORDER BY id ASC
    `).all(added.batchId);
    linkedOrderCount = histories.length;
    for (const history of histories) {
      replaceArchivedPulls(database, Number(history.id), pulls);
      const assigned = database.prepare(`
        SELECT position, buyer_name, sale_amount_cents
        FROM break_order_history_items
        WHERE history_id = ?
        ORDER BY position ASC
      `).all(history.id);
      const rebuiltCaseBox = syncLinkedCaseBoxFromHistory(database, {
        historyId: Number(history.id),
        pullHistoryBatchId: added.batchId,
        breakName: String(history.break_name || ''),
        recordedAt: correctedAt,
        pulls,
        assigned
      });
      if (rebuiltCaseBox) {
        rebuiltTrackerCount += 1;
        continue;
      }
      const tracker = database.prepare(`
        SELECT id, record_type
        FROM box_trackers
        WHERE order_history_id = ? OR (id = ? AND source_mode = 'ORDER_HISTORY')
        ORDER BY CASE WHEN order_history_id = ? THEN 0 ELSE 1 END, id ASC
        LIMIT 1
      `).get(history.id, Number(history.box_tracker_id || 0), history.id);
      if (!tracker) continue;
      syncBoxTrackerFromHistory(database, {
        historyId: Number(history.id),
        pullHistoryBatchId: added.batchId,
        recordType: String(tracker.record_type || history.tracker_record_type || 'BOX'),
        breakName: String(history.break_name || ''),
        recordedAt: correctedAt,
        pulls,
        assigned
      });
      rebuiltTrackerCount += 1;
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return {
    ...added,
    savedCardCount: pulls.reduce((total, pull) => total + Math.max(1, Number(pull.quantity || 1)), 0),
    linkedOrderCount,
    rebuiltTrackerCount,
    correctedAt
  };
}

module.exports = {
  addPullHistoryCardCorrection,
  replaceArchivedPulls
};
