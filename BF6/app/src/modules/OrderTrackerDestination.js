const { requireTrackerRecordType } = require('./BoxTracker');
const { syncBoxTrackerFromHistory } = require('./AutomaticBoxTracker');
const { detachHistoryFromCaseTracker, syncOpenCaseBoxFromHistory } = require('./LiveCaseTracker');

// Transaction-neutral: the caller must wrap this move in one database transaction.
// Orders and Pull History remain the source; only their Box Tracker destination changes.
function changeOrderTrackerDestination(database, payload = {}, options = {}) {
  const historyId = Number(payload.id);
  if (!Number.isInteger(historyId) || historyId < 1) throw new Error('Choose a saved Order first.');
  const destination = String(payload.destination || '').trim().toUpperCase();
  if (!['BOX', 'CASE', 'OPEN_CASE'].includes(destination)) throw new Error('Choose Box, Case, or a named open case.');
  const history = database.prepare(`
    SELECT id, break_name, recorded_at, pull_history_batch_id,
      tracker_record_type, tracker_game_code, tracker_set_code, tracker_set_name
    FROM break_order_history WHERE id = ?
  `).get(historyId);
  if (!history) throw new Error('That saved Order no longer exists. Refresh Orders and try again.');

  const linkedCase = database.prepare(`
    SELECT tracker_id, box_number FROM box_tracker_history_links WHERE history_id = ?
  `).get(historyId);
  const standalone = database.prepare(`
    SELECT id, record_type FROM box_trackers WHERE order_history_id = ?
  `).get(historyId);
  if (linkedCase && standalone) throw new Error('This Order has two tracker destinations. Review its saved tracker before moving it.');

  const openCaseId = destination === 'OPEN_CASE' ? Number(payload.openCaseId) : 0;
  if (destination === 'OPEN_CASE' && (!Number.isInteger(openCaseId) || openCaseId < 1)) {
    throw new Error('Choose the name of the open case for this box.');
  }
  if (destination === 'OPEN_CASE' && Number(linkedCase?.tracker_id) === openCaseId) {
    return { historyId, destination, trackerId: openCaseId, boxNumber: Number(linkedCase.box_number), unchanged: true };
  }
  if (destination !== 'OPEN_CASE' && standalone && standalone.record_type === destination) {
    return { historyId, destination, trackerId: Number(standalone.id), unchanged: true };
  }

  const pulls = database.prepare(`
    SELECT position, buyer_name, card_name, card_number, set_code, rarity,
      collector_treatment, variant_hint, quantity
    FROM break_order_history_pulls WHERE history_id = ? ORDER BY position, id
  `).all(historyId);
  const assigned = database.prepare(`
    SELECT position, buyer_name, sale_amount_cents
    FROM break_order_history_items WHERE history_id = ? ORDER BY position
  `).all(historyId);
  const now = String(options.changedAt || '').trim() || new Date().toISOString();
  const source = {
    historyId,
    breakName: history.break_name,
    recordedAt: now,
    pullHistoryBatchId: history.pull_history_batch_id,
    gameCode: history.tracker_game_code,
    setCode: history.tracker_set_code,
    setName: history.tracker_set_name,
    pulls,
    assigned
  };

  if (linkedCase) detachHistoryFromCaseTracker(database, historyId, { updatedAt: now });
  const trackerOptions = {
    setActiveTracker: options.setActiveTracker,
    setActiveOpenCase: options.setActiveOpenCase
  };
  if (destination === 'OPEN_CASE') {
    const tracker = syncOpenCaseBoxFromHistory(database, { ...source, openCaseId }, trackerOptions);
    if (standalone) {
      const savedCaseRecord = database.prepare('SELECT id FROM box_tracker_case_records WHERE tracker_id = ? LIMIT 1').get(standalone.id);
      if (savedCaseRecord) throw new Error('This standalone tracker has a separate saved case snapshot. Review that saved record before moving the Order.');
      database.prepare('DELETE FROM box_trackers WHERE id = ?').run(standalone.id);
    }
    return { historyId, destination, ...tracker, unchanged: false };
  }

  const tracker = syncBoxTrackerFromHistory(database, { ...source, recordType: requireTrackerRecordType(destination) }, trackerOptions);
  return { historyId, destination, ...tracker, unchanged: false };
}

module.exports = { changeOrderTrackerDestination };
