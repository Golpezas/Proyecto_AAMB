(function liveRowStabilityModule(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BreakSuiteLiveRowStability = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function liveRowStabilityFactory() {
  function normalizedCount(value) {
    if (value === null || value === undefined || value === '') return null;
    const count = Number(value);
    return Number.isInteger(count) && count >= 0 ? count : null;
  }

  function decide({
    candidateSignature = '',
    visibleTopSignature = '',
    previousSignature = '',
    firstSeenAt = 0,
    now = Date.now(),
    baselineCount = null,
    pageCount = null,
    pending = false,
    viewportAtTop = true,
    ledgerReady = false,
    minimumStableMs = 1100
  } = {}) {
    const candidate = String(candidateSignature || '');
    const visibleTop = String(visibleTopSignature || '');
    const baseline = normalizedCount(baselineCount);
    const current = normalizedCount(pageCount);
    const countIsStaleOrUnavailable = current === null || baseline === null || current === baseline;
    const eligible = Boolean(
      ledgerReady
      && viewportAtTop
      && !pending
      && candidate
      && candidate === visibleTop
      && countIsStaleOrUnavailable
    );

    if (!eligible) return { action: 'reset', signature: '', firstSeenAt: 0 };
    if (candidate !== previousSignature || !Number.isFinite(Number(firstSeenAt)) || Number(firstSeenAt) <= 0) {
      return { action: 'track', signature: candidate, firstSeenAt: Number(now) };
    }
    if (Number(now) - Number(firstSeenAt) < Math.max(0, Number(minimumStableMs) || 0)) {
      return { action: 'track', signature: candidate, firstSeenAt: Number(firstSeenAt) };
    }
    return { action: 'emit', signature: candidate, firstSeenAt: Number(firstSeenAt) };
  }

  return { decide, normalizedCount };
});
