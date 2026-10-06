function applyOverlayLiveAssignments(cards, assignments) {
  if (!Array.isArray(cards) || !Array.isArray(assignments) || cards.length !== assignments.length) return false;
  const byPosition = new Map(assignments.map(row => [Number(row.position), row]));
  if (byPosition.size !== cards.length) return false;
  // Check every identity before mutating any cached card. A newly saved board
  // needs its full card mapping rebuilt, even when it has the same spot count.
  if (cards.some(card => {
    const row = byPosition.get(Number(card.position));
    return !row || Number(row.card_id) !== Number(card.id);
  })) return false;
  cards.forEach(card => {
    const row = byPosition.get(Number(card.position));
    card.block_status = row.block_status;
    card.buyer_name = row.buyer_name;
    card.called_at = row.called_at;
    card.message_marked = row.message_marked;
    card.tracker_marked = row.tracker_marked;
    card.sale_amount_cents = row.sale_amount_cents;
  });
  return true;
}

module.exports = { applyOverlayLiveAssignments };
