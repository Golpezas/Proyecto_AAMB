(function assignmentCountGateModule(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BreakSuiteAssignmentCountGate = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function assignmentCountGateFactory() {
  function normalizedCount(value) {
    if (value === null || value === undefined || value === '') return null;
    const count = Number(value);
    return Number.isInteger(count) && count >= 0 ? count : null;
  }

  function decide({ baselineCount, pageCount, freshCount = 0, pendingTarget = null } = {}) {
    const baseline = normalizedCount(baselineCount);
    const current = normalizedCount(pageCount);
    const fresh = Math.max(0, Number(freshCount) || 0);
    const pending = normalizedCount(pendingTarget);

    // Without the official Assigned (n) count, DOM rows are synchronization
    // state only. Never guess that a lazily-rendered row is a new purchase.
    if (current === null) return { action: 'sync', nextCount: baseline, emitIndex: -1 };
    if (baseline === null) return { action: 'baseline', nextCount: current, emitIndex: -1 };
    if (current < baseline) return { action: 'sync', nextCount: current, emitIndex: -1 };
    // A new Assigned row can paint a frame before Whatnot updates its count.
    // Keep it pending so the following +1 count can authorize exactly one
    // reveal. If it was merely a historical lazy row, it remains harmless.
    if (current === baseline && fresh > 0) return { action: 'wait', nextCount: baseline, emitIndex: -1 };
    if (current === baseline) return { action: 'sync', nextCount: baseline, emitIndex: -1 };
    if (pending !== null) return { action: 'wait', nextCount: baseline, emitIndex: -1 };
    const increase = current - baseline;
    // The seller may have scrolled away from the virtualized newest rows.
    // The official count still tells us to inspect the top of Assigned, but
    // that probe must validate a genuinely new row before delivering it.
    if (!fresh) return { action: 'probe', nextCount: current, emitIndex: -1, emitCount: increase };

    // Whatnot can confirm several purchases between two DOM scans. Every
    // official count increase belongs to the current live batch; the content
    // scanner reads exactly that many newest rows and sends them oldest-first.
    return { action: 'emit', nextCount: current, emitIndex: 0, emitCount: increase };
  }

  return { decide, normalizedCount };
});
