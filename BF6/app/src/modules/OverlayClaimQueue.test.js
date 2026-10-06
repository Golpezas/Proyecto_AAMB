const assert = require('node:assert/strict');
const { createOverlayClaimQueue, createOverlayRevealSourcePresence } = require('./OverlayClaimQueue');

const queue = createOverlayClaimQueue({ durationMs: () => 8000 });
queue.enqueue({ position: 1, calledAt: 'first' }, 1000);
queue.enqueue({ position: 2, calledAt: 'second' }, 1100);
queue.enqueue({ position: 3, calledAt: 'third' }, 1200);
assert.equal(queue.size(), 3);
assert.deepEqual(queue.current(2000), { sequence: 1, position: 1, calledAt: 'first' });
assert.deepEqual(queue.current(9001), { sequence: 2, position: 2, calledAt: 'second' });
assert.deepEqual(queue.current(17002), { sequence: 3, position: 3, calledAt: 'third' });
assert.equal(queue.current(25003), null);
queue.enqueue({ position: 4, calledAt: 'fourth' }, 26000);
assert.deepEqual(queue.current(26001), { sequence: 4, position: 4, calledAt: 'fourth' });
queue.clear();
assert.equal(queue.size(), 0);
assert.equal(queue.current(27000), null);

const burst = createOverlayClaimQueue({ durationMs: () => 8000, catchUpDurationMs: 3000 });
burst.enqueue({ position: 1, calledAt: 'burst-first' }, 1000);
burst.enqueue({ position: 2, calledAt: 'burst-second' }, 1100);
burst.enqueue({ position: 3, calledAt: 'burst-third' }, 1200);
assert.equal(burst.current(3999).position, 1, 'Give the first buyer a readable reveal');
assert.equal(burst.current(4000).position, 2, 'Move through waiting sales after three seconds');
assert.equal(burst.current(6999).position, 2);
assert.equal(burst.current(7000).position, 3);
assert.equal(burst.current(14999).position, 3, 'The last buyer gets the configured display time');
assert.equal(burst.current(15000), null);

const sources = createOverlayRevealSourcePresence({ timeoutMs: 3000 });
assert.equal(sources.boardShouldReveal(1000), true, 'An existing board-only OBS scene should show sales');
sources.noteDedicatedSource(1000);
assert.equal(sources.boardShouldReveal(3999), false, 'The dedicated popup owns reveals while polling');
sources.noteDedicatedSource(3500);
assert.equal(sources.boardShouldReveal(6500), false, 'A current dedicated popup prevents duplicate reveals');
assert.equal(sources.boardShouldReveal(6501), true, 'The board resumes reveals after the popup source disappears');

console.log('Overlay claim queue tests passed.');
