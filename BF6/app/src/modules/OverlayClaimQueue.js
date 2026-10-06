function createOverlayClaimQueue({ durationMs = () => 8750, catchUpDurationMs = 3000 } = {}) {
  let sequence = 0;
  let active = null;
  let activeSince = 0;
  let pending = [];

  function displayDuration() {
    const value = Number(durationMs());
    return Number.isFinite(value) ? Math.max(1000, value) : 8750;
  }

  function activate(event, now) {
    active = event;
    activeSince = now;
  }

  function advance(now = Date.now()) {
    if (!active && pending.length) activate(pending.shift(), now);
    // A burst of sales should still show every card, but must not make the
    // third buyer wait through two full-length reveals. The newest sale keeps
    // the operator's normal display time once the backlog is empty.
    const duration = pending.length
      ? Math.min(displayDuration(), Math.max(1000, Number(catchUpDurationMs) || 3000))
      : displayDuration();
    if (!active || now - activeSince < duration) return active;
    if (pending.length) activate(pending.shift(), now);
    else {
      active = null;
      activeSince = 0;
    }
    return active;
  }

  function enqueue({ position, calledAt }, now = Date.now()) {
    const event = { sequence: ++sequence, position: Number(position), calledAt: String(calledAt || '') };
    advance(now);
    if (active) pending.push(event);
    else activate(event, now);
    return event;
  }

  function current(now = Date.now()) {
    const event = advance(now);
    return event ? { ...event } : null;
  }

  function clear() {
    active = null;
    activeSince = 0;
    pending = [];
  }

  function size() {
    return (active ? 1 : 0) + pending.length;
  }

  return Object.freeze({ enqueue, current, clear, size });
}

function createOverlayRevealSourcePresence({ timeoutMs = 3000 } = {}) {
  let dedicatedLastSeenAt = null;

  function noteDedicatedSource(now = Date.now()) {
    dedicatedLastSeenAt = now;
  }

  function boardShouldReveal(now = Date.now()) {
    return dedicatedLastSeenAt === null || now - dedicatedLastSeenAt > timeoutMs;
  }

  return Object.freeze({ noteDedicatedSource, boardShouldReveal });
}

module.exports = { createOverlayClaimQueue, createOverlayRevealSourcePresence };
