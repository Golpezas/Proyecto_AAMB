(function exposeRoundAssignmentWindow(root) {
  function count(pageCount, roundStartCount) {
    if (!Number.isInteger(pageCount) || !Number.isInteger(roundStartCount)) return 0;
    return Math.max(0, pageCount - roundStartCount);
  }

  function select({ candidates = [], pageCount = null, roundStartCount = null } = {}) {
    return (Array.isArray(candidates) ? candidates : []).slice(0, count(pageCount, roundStartCount));
  }

  const api = Object.freeze({ count, select });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BreakSuiteRoundAssignmentWindow = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
