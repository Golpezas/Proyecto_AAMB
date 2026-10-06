const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

assert.match(html, /id="toggle-pull-history-buyer-values"[^>]*>Hide Buyer Values<\/button>/);
assert.match(html, /id="pull-history-privacy-state"[^>]*>BUYER VALUES VISIBLE<\/span>/);
assert.match(app, /pullHistoryBuyerValuesVisible:\s*true/);
assert.match(app, /state\.pullHistoryBuyerValuesVisible\s*=\s*!state\.pullHistoryBuyerValuesVisible/);
assert.match(app, /state\.pullHistoryBuyerValuesVisible\s*\?\s*`<div><small>PAID<b>/);
assert.match(app, /Show Buyer Values/);
assert.match(app, /BUYER VALUES HIDDEN/);
assert.match(app, /PullHistoryBuyerMessage\.isPriorityBuyer\(buyer, buyerItems\)/);
assert.match(app, /priority-spender/);
assert.match(app, /spent over \$100 or pulled Promo, Alt Art\/Showcase, SP, Ultimate, Overnumbered, or Signature/);
assert.match(app, /Copy \+ Message includes only those top hits; Epic and lower stay saved but are not copied/);

const css = fs.readFileSync(path.join(__dirname, 'breaker-center.css'), 'utf8');
assert.match(css, /\.pull-history-buyer-card\.priority-spender/);

console.log('Pull History buyer-value privacy checks passed.');
