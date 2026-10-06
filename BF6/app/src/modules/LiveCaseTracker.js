const {
  BOX_HIT_FIELDS,
  normalizeBoxCount,
  normalizeProductName,
  normalizeTrackerName
} = require('./BoxTracker');
const {
  normalizedTrackerGameCode,
  trackerClassificationForPull,
  trackerContextForHistory,
  trackerFieldForClassification
} = require('./AutomaticBoxTracker');

const TRACKER_DESTINATION_MODES = Object.freeze({
  AUTO: 'AUTO',
  OPEN_CASE: 'OPEN_CASE'
});

function normalizeTrackerDestinationMode(value, fallback = TRACKER_DESTINATION_MODES.AUTO) {
  const mode = String(value || '').trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(TRACKER_DESTINATION_MODES, mode) ? mode : fallback;
}

function requiredOpenCaseId(value) {
  const id = Number(value?.openCaseId ?? value?.trackerId ?? value?.id ?? value);
  if (!Number.isInteger(id) || id < 1) throw new Error('Choose the current open case before archiving this box.');
  return id;
}

function comparableSetCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function caseCatalogSet(database, gameCode, setCode) {
  if (!setCode) return null;
  return database.prepare(`
    SELECT set_code, set_name, product_name, box_count
    FROM catalog_sets
    WHERE UPPER(TRIM(game_code)) = ? AND UPPER(TRIM(set_code)) = ?
    LIMIT 1
  `).get(gameCode, setCode) || null;
}

// Transaction-neutral: the main process owns the transaction so case creation
// can participate in the same persistence rules as the rest of Box Tracker.
function createOpenCaseTracker(database, payload = {}, options = {}) {
  const requestedName = String(payload.caseName || payload.trackerName || '').trim();
  if (!requestedName) throw new Error('Enter a name for this open case.');
  const gameCode = normalizedTrackerGameCode(payload.gameCode);
  if (!gameCode) throw new Error('Choose One Piece or Riftbound for this case.');
  const requestedSetCode = String(payload.setCode || '').trim().toUpperCase();
  if (!requestedSetCode) throw new Error('Choose the set inside this case.');
  const catalogSet = caseCatalogSet(database, gameCode, requestedSetCode);
  const setCode = String(catalogSet?.set_code || requestedSetCode).trim().toUpperCase();
  const setName = String(payload.setName || catalogSet?.set_name || setCode).trim();
  const trackerName = normalizeTrackerName(requestedName);
  const overlayTitle = normalizeTrackerName(payload.overlayTitle || trackerName);
  const productName = normalizeProductName(payload.productName || catalogSet?.product_name || setName);
  const totalBoxes = normalizeBoxCount(payload.totalBoxes, Number(catalogSet?.box_count || 12) || 12);
  const now = String(payload.createdAt || '').trim() || new Date().toISOString();
  const inserted = database.prepare(`
    INSERT INTO box_trackers (
      tracker_name, overlay_title, product_name, game_code, set_code, set_name,
      record_type, source_mode, lifecycle_status, total_boxes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'CASE', 'OPEN_CASE', 'OPEN', ?, ?, ?)
  `).run(trackerName, overlayTitle, productName, gameCode, setCode, setName, totalBoxes, now, now);
  const trackerId = Number(inserted.lastInsertRowid);
  const insertBox = database.prepare(`
    INSERT INTO box_tracker_boxes (tracker_id, box_number, status, notes, updated_at)
    VALUES (?, ?, 'sealed', '', ?)
  `);
  for (let boxNumber = 1; boxNumber <= totalBoxes; boxNumber += 1) insertBox.run(trackerId, boxNumber, now);
  if (typeof options.setActiveTracker === 'function') options.setActiveTracker(trackerId);
  if (typeof options.setActiveOpenCase === 'function') options.setActiveOpenCase(trackerId);
  return {
    trackerId,
    caseName: trackerName,
    gameCode,
    setCode,
    setName,
    totalBoxes,
    openedBoxes: 0,
    remainingBoxes: totalBoxes,
    lifecycleStatus: 'OPEN'
  };
}

function hitSnapshot(pulls = [], gameCode = '') {
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
  return { hitCounts, qualifyingPulls };
}

function caseLinkForHistory(database, historyId) {
  return database.prepare(`
    SELECT link.tracker_id, link.history_id, link.box_number, link.pull_history_batch_id,
      tracker.tracker_name, tracker.lifecycle_status, tracker.source_mode
    FROM box_tracker_history_links link
    JOIN box_trackers tracker ON tracker.id = link.tracker_id
    WHERE link.history_id = ?
    LIMIT 1
  `).get(historyId) || null;
}

// Transaction-neutral. A first save occupies the next free box; subsequent
// saves for the same history replace that exact box. This is the core duplicate
// guard used by both archive and missed-card correction flows.
function syncOpenCaseBoxFromHistory(database, payload = {}, options = {}) {
  const historyId = Number(payload.historyId || 0);
  if (!Number.isInteger(historyId) || historyId < 1) throw new Error('The saved break could not be linked to the open case.');
  const trackerId = requiredOpenCaseId(payload);
  const tracker = database.prepare(`
    SELECT id, tracker_name, game_code, set_code, set_name, total_boxes,
      lifecycle_status, source_mode
    FROM box_trackers
    WHERE id = ?
  `).get(trackerId);
  if (!tracker || !['OPEN_CASE', 'FINALIZED_CASE'].includes(String(tracker.source_mode || '').toUpperCase())) {
    throw new Error('That open case no longer exists. Refresh Box Tracker and choose another case.');
  }

  const existingLink = caseLinkForHistory(database, historyId);
  if (existingLink && Number(existingLink.tracker_id) !== trackerId) {
    throw new Error(`This archived box is already stored in “${existingLink.tracker_name}”. It was not added twice.`);
  }
  const lifecycle = String(tracker.lifecycle_status || '').toUpperCase();
  if (!existingLink && lifecycle !== 'OPEN') throw new Error('That case is already finalized. Choose a case that is still open.');

  const pulls = Array.isArray(payload.pulls) ? payload.pulls : [];
  const assigned = Array.isArray(payload.assigned) ? payload.assigned : [];
  const context = trackerContextForHistory(database, payload);
  const trackerGame = normalizedTrackerGameCode(tracker.game_code);
  if (trackerGame !== context.gameCode) {
    throw new Error(`This is a ${context.gameCode === 'RIFTBOUND' ? 'Riftbound' : 'One Piece'} box, but “${tracker.tracker_name}” is for ${trackerGame === 'RIFTBOUND' ? 'Riftbound' : 'One Piece'}.`);
  }
  const caseSet = comparableSetCode(tracker.set_code);
  const historySet = comparableSetCode(context.setCode);
  if (caseSet && caseSet !== 'MULTI' && historySet && caseSet !== historySet) {
    throw new Error(`This box is ${context.setName || context.setCode}, but “${tracker.tracker_name}” is tracking ${tracker.set_name || tracker.set_code}.`);
  }

  let boxNumber = Number(existingLink?.box_number || 0);
  if (!boxNumber) {
    const available = database.prepare(`
      SELECT box.box_number
      FROM box_tracker_boxes box
      LEFT JOIN box_tracker_history_links link
        ON link.tracker_id = box.tracker_id AND link.box_number = box.box_number
      WHERE box.tracker_id = ? AND link.history_id IS NULL
      ORDER BY box.box_number ASC
      LIMIT 1
    `).get(trackerId);
    boxNumber = Number(available?.box_number || 0);
    if (!boxNumber) throw new Error(`“${tracker.tracker_name}” is full. Finalize it or create a new open case before archiving another box.`);
  }

  const now = String(payload.recordedAt || '').trim() || new Date().toISOString();
  const pullHistoryBatchId = Number(payload.pullHistoryBatchId || 0) || null;
  const { hitCounts, qualifyingPulls } = hitSnapshot(pulls, context.gameCode);
  database.prepare(`
    UPDATE box_tracker_boxes
    SET status = 'opened', notes = ?, updated_at = ?,
      ${BOX_HIT_FIELDS.map(field => `${field.key} = ?`).join(', ')}
    WHERE tracker_id = ? AND box_number = ?
  `).run(
    `Archived from Order History #${historyId}.`,
    now,
    ...BOX_HIT_FIELDS.map(field => Number(hitCounts[field.key] || 0)),
    trackerId,
    boxNumber
  );
  database.prepare('DELETE FROM box_tracker_hit_winners WHERE tracker_id = ? AND box_number = ?').run(trackerId, boxNumber);

  const paidByPosition = new Map(assigned.map(item => [
    Number(item.position || 0),
    Math.max(0, Number(item.sale_amount_cents || item.saleAmountCents || 0))
  ]));
  const insertWinner = database.prepare(`
    INSERT INTO box_tracker_hit_winners (
      tracker_id, box_number, card_name, rarity, buyer_name, spot_number,
      sale_amount_cents, card_number, category_key, quantity,
      source_history_id, note, recorded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const { pull, classification, quantity } of qualifyingPulls) {
    const position = Math.max(0, Number(pull.position || 0));
    insertWinner.run(
      trackerId,
      boxNumber,
      String(pull.cardName || pull.card_name || 'Unnamed card').trim(),
      String(classification.categoryLabel || pull.rarity || '').trim(),
      String(pull.buyerName || pull.buyer_name || '').trim().replace(/^@+/, ''),
      position,
      Number(paidByPosition.get(position) || 0),
      String(pull.cardNumber || pull.card_number || '').trim(),
      String(classification.categoryKey || '').trim(),
      quantity,
      historyId,
      String(pull.collectorTreatment || pull.collector_treatment || '').trim(),
      now
    );
  }

  if (existingLink) {
    database.prepare(`
      UPDATE box_tracker_history_links
      SET pull_history_batch_id = ?, linked_at = ?
      WHERE history_id = ?
    `).run(pullHistoryBatchId, now, historyId);
  } else {
    database.prepare(`
      INSERT INTO box_tracker_history_links (
        tracker_id, history_id, box_number, pull_history_batch_id, linked_at
      ) VALUES (?, ?, ?, ?, ?)
    `).run(trackerId, historyId, boxNumber, pullHistoryBatchId, now);
  }
  database.prepare(`
    UPDATE box_trackers
    SET pull_history_batch_id = ?, updated_at = ?
    WHERE id = ?
  `).run(pullHistoryBatchId, now, trackerId);
  database.prepare(`
    UPDATE break_order_history
    SET tracker_record_type = 'BOX', tracker_game_code = ?, tracker_set_code = ?,
      tracker_set_name = ?, box_tracker_id = ?
    WHERE id = ?
  `).run(context.gameCode, context.setCode, context.setName, trackerId, historyId);

  const progress = database.prepare(`
    SELECT COUNT(*) AS opened_boxes
    FROM box_tracker_history_links
    WHERE tracker_id = ?
  `).get(trackerId);
  const openedBoxes = Number(progress?.opened_boxes || 0);
  if (typeof options.setActiveTracker === 'function') options.setActiveTracker(trackerId);
  if (lifecycle === 'OPEN' && typeof options.setActiveOpenCase === 'function') options.setActiveOpenCase(trackerId);
  return {
    trackerId,
    recordType: 'BOX',
    routeMode: TRACKER_DESTINATION_MODES.OPEN_CASE,
    caseName: String(tracker.tracker_name || ''),
    boxNumber,
    gameCode: context.gameCode,
    setCode: context.setCode,
    setName: context.setName,
    trackedHitCount: qualifyingPulls.reduce((total, item) => total + item.quantity, 0),
    openedBoxes,
    totalBoxes: Number(tracker.total_boxes || 0),
    remainingBoxes: Math.max(0, Number(tracker.total_boxes || 0) - openedBoxes)
  };
}

function syncLinkedCaseBoxFromHistory(database, payload = {}, options = {}) {
  const historyId = Number(payload.historyId || 0);
  const link = caseLinkForHistory(database, historyId);
  if (!link) return null;
  return syncOpenCaseBoxFromHistory(database, { ...payload, openCaseId: Number(link.tracker_id) }, options);
}

function detachHistoryFromCaseTracker(database, historyId, payload = {}) {
  const link = caseLinkForHistory(database, Number(historyId));
  if (!link) return null;
  const now = String(payload.updatedAt || '').trim() || new Date().toISOString();
  database.prepare('DELETE FROM box_tracker_hit_winners WHERE tracker_id = ? AND box_number = ?')
    .run(link.tracker_id, link.box_number);
  database.prepare('DELETE FROM box_tracker_history_links WHERE history_id = ?').run(historyId);
  database.prepare(`
    UPDATE box_tracker_boxes
    SET status = 'sealed', notes = '', updated_at = ?,
      ${BOX_HIT_FIELDS.map(field => `${field.key} = 0`).join(', ')}
    WHERE tracker_id = ? AND box_number = ?
  `).run(now, link.tracker_id, link.box_number);
  database.prepare('UPDATE break_order_history SET box_tracker_id = NULL WHERE id = ? AND box_tracker_id = ?')
    .run(historyId, link.tracker_id);
  const newestRemaining = database.prepare(`
    SELECT pull_history_batch_id FROM box_tracker_history_links
    WHERE tracker_id = ? ORDER BY linked_at DESC, box_number DESC LIMIT 1
  `).get(link.tracker_id);
  database.prepare('UPDATE box_trackers SET pull_history_batch_id = ?, updated_at = ? WHERE id = ?')
    .run(Number(newestRemaining?.pull_history_batch_id || 0) || null, now, link.tracker_id);
  return { trackerId: Number(link.tracker_id), boxNumber: Number(link.box_number), caseName: link.tracker_name };
}

function requiredEditableOpenCase(database, value) {
  const trackerId = requiredOpenCaseId(value);
  const tracker = database.prepare(`
    SELECT id, tracker_name, overlay_title, total_boxes, lifecycle_status, source_mode
    FROM box_trackers
    WHERE id = ?
  `).get(trackerId);
  if (!tracker || String(tracker.source_mode || '').toUpperCase() !== 'OPEN_CASE') {
    throw new Error('That live case no longer exists. Refresh Box Tracker and choose another case.');
  }
  if (String(tracker.lifecycle_status || '').toUpperCase() !== 'OPEN') {
    throw new Error('That case is already finalized and can no longer be edited as a live case.');
  }
  return tracker;
}

// Transaction-neutral. Only the live case label and capacity are editable.
// Game/set identity remains locked so boxes from a different product cannot be
// introduced accidentally. A capacity reduction may remove only unused tail
// positions; an archived box can never be cut off silently.
function updateOpenCaseTracker(database, payload = {}) {
  const tracker = requiredEditableOpenCase(database, payload);
  const trackerId = Number(tracker.id);
  const trackerName = normalizeTrackerName(payload.caseName || payload.trackerName || tracker.tracker_name);
  const totalBoxes = normalizeBoxCount(payload.totalBoxes, Number(tracker.total_boxes || 1));
  const highestLinked = Number(database.prepare(`
    SELECT MAX(box_number) AS box_number
    FROM box_tracker_history_links
    WHERE tracker_id = ?
  `).get(trackerId)?.box_number || 0);
  if (totalBoxes < highestLinked) {
    throw new Error(`Box ${String(highestLinked).padStart(2, '0')} already contains an archived Buyer Bag. Remove that box from the case before reducing its size.`);
  }

  const now = String(payload.updatedAt || '').trim() || new Date().toISOString();
  if (totalBoxes < Number(tracker.total_boxes || 0)) {
    database.prepare('DELETE FROM box_tracker_boxes WHERE tracker_id = ? AND box_number > ?')
      .run(trackerId, totalBoxes);
  } else if (totalBoxes > Number(tracker.total_boxes || 0)) {
    const insertBox = database.prepare(`
      INSERT OR IGNORE INTO box_tracker_boxes (tracker_id, box_number, status, notes, updated_at)
      VALUES (?, ?, 'sealed', '', ?)
    `);
    for (let boxNumber = Number(tracker.total_boxes || 0) + 1; boxNumber <= totalBoxes; boxNumber += 1) {
      insertBox.run(trackerId, boxNumber, now);
    }
  }
  const currentOverlayTitle = String(tracker.overlay_title || '').trim();
  const overlayTitle = !currentOverlayTitle || currentOverlayTitle === String(tracker.tracker_name || '').trim()
    ? trackerName
    : currentOverlayTitle;
  database.prepare(`
    UPDATE box_trackers
    SET tracker_name = ?, overlay_title = ?, total_boxes = ?, updated_at = ?
    WHERE id = ?
  `).run(trackerName, overlayTitle, totalBoxes, now, trackerId);
  return { trackerId, caseName: trackerName, totalBoxes, updatedAt: now };
}

// Transaction-neutral. Detaching a box clears only its live-case copy. The
// underlying Orders History and Pull History rows remain saved and auditable.
function removeOpenCaseBox(database, payload = {}) {
  const tracker = requiredEditableOpenCase(database, payload);
  const trackerId = Number(tracker.id);
  const boxNumber = Number(payload.boxNumber);
  if (!Number.isInteger(boxNumber) || boxNumber < 1 || boxNumber > Number(tracker.total_boxes || 0)) {
    throw new Error('Choose a valid box from this live case.');
  }
  const link = database.prepare(`
    SELECT link.history_id, link.pull_history_batch_id, history.break_name
    FROM box_tracker_history_links link
    LEFT JOIN break_order_history history ON history.id = link.history_id
    WHERE link.tracker_id = ? AND link.box_number = ?
  `).get(trackerId, boxNumber);
  if (!link) throw new Error(`Box ${String(boxNumber).padStart(2, '0')} is already available and has nothing to remove.`);

  const now = String(payload.updatedAt || '').trim() || new Date().toISOString();
  database.prepare('DELETE FROM box_tracker_hit_winners WHERE tracker_id = ? AND box_number = ?')
    .run(trackerId, boxNumber);
  database.prepare('DELETE FROM box_tracker_history_links WHERE tracker_id = ? AND box_number = ?')
    .run(trackerId, boxNumber);
  database.prepare(`
    UPDATE box_tracker_boxes
    SET status = 'sealed', notes = '', updated_at = ?,
      ${BOX_HIT_FIELDS.map(field => `${field.key} = 0`).join(', ')}
    WHERE tracker_id = ? AND box_number = ?
  `).run(now, trackerId, boxNumber);
  database.prepare(`
    UPDATE break_order_history
    SET box_tracker_id = NULL
    WHERE id = ? AND box_tracker_id = ?
  `).run(link.history_id, trackerId);
  const newestRemaining = database.prepare(`
    SELECT pull_history_batch_id
    FROM box_tracker_history_links
    WHERE tracker_id = ?
    ORDER BY linked_at DESC, box_number DESC
    LIMIT 1
  `).get(trackerId);
  database.prepare(`
    UPDATE box_trackers
    SET pull_history_batch_id = ?, updated_at = ?
    WHERE id = ?
  `).run(Number(newestRemaining?.pull_history_batch_id || 0) || null, now, trackerId);
  return {
    trackerId,
    caseName: String(tracker.tracker_name || ''),
    boxNumber,
    historyId: Number(link.history_id),
    pullHistoryBatchId: Number(link.pull_history_batch_id || 0) || null,
    breakName: String(link.break_name || '').trim(),
    removed: true
  };
}

// Transaction-neutral. Deleting a live case removes its case/box presentation
// but deliberately keeps every source ledger record. History rows are unlinked
// first so they never point at a tracker that no longer exists.
function deleteOpenCaseTracker(database, value) {
  const tracker = requiredEditableOpenCase(database, value);
  const trackerId = Number(tracker.id);
  const linkedBoxes = Number(database.prepare(`
    SELECT COUNT(*) AS count FROM box_tracker_history_links WHERE tracker_id = ?
  `).get(trackerId)?.count || 0);
  database.prepare('UPDATE break_order_history SET box_tracker_id = NULL WHERE box_tracker_id = ?').run(trackerId);
  database.prepare('DELETE FROM box_trackers WHERE id = ?').run(trackerId);
  return {
    trackerId,
    caseName: String(tracker.tracker_name || ''),
    linkedBoxes,
    deleted: true
  };
}

function finalizeOpenCaseTracker(database, value, payload = {}) {
  const trackerId = requiredOpenCaseId(value);
  const tracker = database.prepare(`
    SELECT id, tracker_name, lifecycle_status, total_boxes
    FROM box_trackers
    WHERE id = ? AND source_mode = 'OPEN_CASE'
  `).get(trackerId);
  if (!tracker) throw new Error('That open case no longer exists.');
  if (String(tracker.lifecycle_status || '').toUpperCase() !== 'OPEN') throw new Error('That case has already been finalized.');
  const openedBoxes = Number(database.prepare(`
    SELECT COUNT(*) AS count FROM box_tracker_history_links WHERE tracker_id = ?
  `).get(trackerId)?.count || 0);
  if (!openedBoxes) throw new Error('Archive at least one box into this case before finalizing it.');
  const now = String(payload.completedAt || '').trim() || new Date().toISOString();
  database.prepare(`
    UPDATE box_trackers
    SET lifecycle_status = 'FINALIZED', source_mode = 'FINALIZED_CASE', completed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(now, now, trackerId);
  return {
    trackerId,
    caseName: tracker.tracker_name,
    openedBoxes,
    totalBoxes: Number(tracker.total_boxes || 0),
    remainingBoxes: Math.max(0, Number(tracker.total_boxes || 0) - openedBoxes),
    completedAt: now,
    lifecycleStatus: 'FINALIZED'
  };
}

module.exports = {
  TRACKER_DESTINATION_MODES,
  caseLinkForHistory,
  createOpenCaseTracker,
  deleteOpenCaseTracker,
  detachHistoryFromCaseTracker,
  finalizeOpenCaseTracker,
  normalizeTrackerDestinationMode,
  removeOpenCaseBox,
  requiredOpenCaseId,
  syncLinkedCaseBoxFromHistory,
  syncOpenCaseBoxFromHistory,
  updateOpenCaseTracker
};
