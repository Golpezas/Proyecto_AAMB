const {
  BOX_HIT_FIELDS,
  TRACKER_RECORD_TYPES,
  normalizeProductName,
  normalizeTrackerName,
  requireTrackerRecordType
} = require('./BoxTracker');
const { classifyMajorHit } = require('./OrderHitTracker');

function normalizedTrackerGameCode(value) {
  const code = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  if (code === 'RIFTBOUND') return 'RIFTBOUND';
  if (code === 'ONEPIECE') return 'ONEPIECE';
  return '';
}

function gameCodeForPullSet(setCode) {
  const normalized = String(setCode || '').trim().toUpperCase();
  if (/^(?:OGN|OGS|SFD|UNL|VEN)$/.test(normalized)) return 'RIFTBOUND';
  if (normalized) return 'ONEPIECE';
  return '';
}

function trackerClassificationForPull(item = {}, gameCode = '') {
  return classifyMajorHit({
    game_code: normalizedTrackerGameCode(gameCode),
    card_number: item.cardNumber || item.card_number || '',
    set_code: item.setCode || item.set_code || '',
    rarity: item.rarity || '',
    variant: [item.variantHint || item.variant_hint, item.collectorTreatment || item.collector_treatment].filter(Boolean).join(' '),
    manual_category: item.collectorTreatment || item.collector_treatment || ''
  });
}

function trackerFieldForClassification(classification = {}) {
  classification = classification || {};
  const gameCode = normalizedTrackerGameCode(classification.gameCode || classification.game_code);
  const category = String(classification.categoryKey || classification.hit_category || '').trim().toUpperCase();
  if (gameCode === 'RIFTBOUND') {
    return ({
      EPIC: 'epic_count',
      SP: 'sp_count',
      ALT_ART: 'alt_art_count',
      OVERNUMBERED: 'overnumbered_count',
      SIGNATURE: 'signature_count'
    })[category] || '';
  }
  return ({
    MANGA: 'manga_count',
    SP_GOLD: 'sp_count',
    SP: 'sp_count',
    SEC: 'sec_count',
    SEC_AA: 'sec_aa_count',
    L_AA: 'leader_aa_count',
    SR_AA: 'sr_aa_count',
    R_AA: 'r_aa_count',
    AA: 'r_aa_count',
    TR: 'tr_count',
    GOLD_DON: 'gold_don_count'
  })[category] || '';
}

function trackerContextForHistory(database, payload = {}) {
  const pulls = Array.isArray(payload.pulls) ? payload.pulls : [];
  const batchId = Number(payload.pullHistoryBatchId || 0);
  const batch = batchId
    ? database.prepare('SELECT game_code, set_code, set_name FROM pull_history_batches WHERE id = ?').get(batchId)
    : null;
  const pullSetCodes = [...new Set(pulls
    .map(item => String(item.setCode || item.set_code || '').trim().toUpperCase())
    .filter(Boolean))];
  const pullGameCodes = [...new Set(pullSetCodes.map(gameCodeForPullSet).filter(Boolean))];
  const gameCode = normalizedTrackerGameCode(payload.gameCode)
    || normalizedTrackerGameCode(batch?.game_code)
    || normalizedTrackerGameCode(pullGameCodes.length === 1 ? pullGameCodes[0] : '')
    || 'ONEPIECE';
  let setCode = String(payload.setCode || batch?.set_code || '').trim().toUpperCase();
  if (!setCode && pullSetCodes.length === 1) setCode = pullSetCodes[0];
  if (!setCode && pullSetCodes.length > 1) setCode = 'MULTI';
  let setName = String(payload.setName || batch?.set_name || '').trim();
  if (!setName && setCode && setCode !== 'MULTI') {
    setName = String(database.prepare(`
      SELECT set_name FROM catalog_sets
      WHERE game_code = ? AND UPPER(TRIM(set_code)) = ?
      LIMIT 1
    `).get(gameCode, setCode)?.set_name || '').trim();
  }
  if (!setName) setName = setCode === 'MULTI'
    ? 'Multi-set break'
    : (setCode || (gameCode === 'RIFTBOUND' ? 'Riftbound' : 'One Piece'));
  return { gameCode, setCode, setName };
}

// This function is deliberately transaction-neutral. The caller invokes it
// inside the same transaction that writes Order History so the two records
// either save together or roll back together.
function syncBoxTrackerFromHistory(database, payload = {}, options = {}) {
  const historyId = Number(payload.historyId || 0);
  if (!Number.isInteger(historyId) || historyId < 1) throw new Error('The saved break could not be linked to Box Tracker.');
  const recordType = requireTrackerRecordType(payload.recordType);
  const pulls = Array.isArray(payload.pulls) ? payload.pulls : [];
  const assigned = Array.isArray(payload.assigned) ? payload.assigned : [];
  const { gameCode, setCode, setName } = trackerContextForHistory(database, payload);
  const typeLabel = TRACKER_RECORD_TYPES[recordType];
  const rawBreakName = String(payload.breakName || '').trim();
  const normalizedBreakName = rawBreakName.toUpperCase();
  const includesSet = [setName, setCode]
    .map(value => String(value || '').trim().toUpperCase())
    .filter(Boolean)
    .some(value => normalizedBreakName.includes(value));
  const includesType = /\b(?:BOX|CASE)\b/.test(normalizedBreakName);
  const automaticName = `${setName || setCode} ${typeLabel}`.trim();
  const trackerName = normalizeTrackerName(
    rawBreakName && includesSet && includesType
      ? rawBreakName
      : [automaticName, rawBreakName].filter(Boolean).join(' · ')
  );
  const productName = normalizeProductName(setName || setCode);
  const now = String(payload.recordedAt || '').trim() || new Date().toISOString();
  const pullHistoryBatchId = Number(payload.pullHistoryBatchId || 0) || null;
  const existing = database.prepare('SELECT id FROM box_trackers WHERE order_history_id = ?').get(historyId);
  let trackerId = Number(existing?.id || 0);
  if (trackerId) {
    database.prepare(`
      UPDATE box_trackers
      SET tracker_name = ?, overlay_title = ?, product_name = ?, game_code = ?,
        set_code = ?, set_name = ?, record_type = ?, pull_history_batch_id = ?,
        source_mode = 'ORDER_HISTORY', lifecycle_status = 'FINALIZED',
        completed_at = COALESCE(completed_at, ?), total_boxes = 1, updated_at = ?
      WHERE id = ?
    `).run(trackerName, trackerName, productName, gameCode, setCode, setName, recordType, pullHistoryBatchId, now, now, trackerId);
  } else {
    const inserted = database.prepare(`
      INSERT INTO box_trackers (
        tracker_name, overlay_title, product_name, game_code, set_code, set_name,
        record_type, order_history_id, pull_history_batch_id, source_mode,
        lifecycle_status, completed_at, total_boxes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ORDER_HISTORY', 'FINALIZED', ?, 1, ?, ?)
    `).run(trackerName, trackerName, productName, gameCode, setCode, setName, recordType, historyId, pullHistoryBatchId, now, now, now);
    trackerId = Number(inserted.lastInsertRowid);
  }

  const hitCounts = Object.fromEntries(BOX_HIT_FIELDS.map(field => [field.key, 0]));
  const qualifyingPulls = [];
  for (const pull of pulls) {
    const classification = trackerClassificationForPull(pull, gameCode);
    const field = trackerFieldForClassification(classification);
    if (!field) continue;
    const quantity = Math.max(1, Math.min(99, Math.floor(Number(pull.quantity || 1))));
    hitCounts[field] = Math.min(99, Number(hitCounts[field] || 0) + quantity);
    qualifyingPulls.push({ pull, classification, quantity });
  }

  database.prepare('DELETE FROM box_tracker_hit_winners WHERE tracker_id = ?').run(trackerId);
  database.prepare('DELETE FROM box_tracker_boxes WHERE tracker_id = ?').run(trackerId);
  database.prepare(`
    INSERT INTO box_tracker_boxes (
      tracker_id, box_number, status, notes, updated_at,
      ${BOX_HIT_FIELDS.map(field => field.key).join(', ')}
    ) VALUES (?, 1, 'opened', ?, ?, ${BOX_HIT_FIELDS.map(() => '?').join(', ')})
  `).run(
    trackerId,
    `Automatically saved from Order History #${historyId}.`,
    now,
    ...BOX_HIT_FIELDS.map(field => Number(hitCounts[field.key] || 0))
  );
  const paidByPosition = new Map(assigned.map(item => [Number(item.position || 0), Math.max(0, Number(item.sale_amount_cents || item.saleAmountCents || 0))]));
  const insertWinner = database.prepare(`
    INSERT INTO box_tracker_hit_winners (
      tracker_id, box_number, card_name, rarity, buyer_name, spot_number,
      sale_amount_cents, card_number, category_key, quantity,
      source_history_id, note, recorded_at
    ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const { pull, classification, quantity } of qualifyingPulls) {
    const position = Math.max(0, Number(pull.position || 0));
    const treatment = String(pull.collectorTreatment || pull.collector_treatment || '').trim();
    insertWinner.run(
      trackerId,
      String(pull.cardName || pull.card_name || 'Unnamed card').trim(),
      String(classification.categoryLabel || pull.rarity || '').trim(),
      String(pull.buyerName || pull.buyer_name || '').trim().replace(/^@+/, ''),
      position,
      Number(paidByPosition.get(position) || 0),
      String(pull.cardNumber || pull.card_number || '').trim(),
      String(classification.categoryKey || '').trim(),
      quantity,
      historyId,
      treatment,
      now
    );
  }
  database.prepare(`
    UPDATE break_order_history
    SET tracker_record_type = ?, tracker_game_code = ?, tracker_set_code = ?,
      tracker_set_name = ?, box_tracker_id = ?
    WHERE id = ?
  `).run(recordType, gameCode, setCode, setName, trackerId, historyId);
  if (typeof options.setActiveTracker === 'function') options.setActiveTracker(trackerId);
  return {
    trackerId,
    recordType,
    routeMode: 'AUTO',
    gameCode,
    setCode,
    setName,
    trackedHitCount: qualifyingPulls.reduce((total, item) => total + item.quantity, 0)
  };
}

module.exports = {
  gameCodeForPullSet,
  normalizedTrackerGameCode,
  syncBoxTrackerFromHistory,
  trackerClassificationForPull,
  trackerContextForHistory,
  trackerFieldForClassification
};
