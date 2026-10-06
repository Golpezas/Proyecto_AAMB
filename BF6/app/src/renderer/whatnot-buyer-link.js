(function exposeWhatnotBuyerLink(root) {
  function username(value) {
    const normalized = String(value || '').trim().replace(/^@+/, '');
    return /^[a-z0-9_.-]{2,80}$/i.test(normalized) ? normalized : '';
  }

  function profileUrl(value) {
    const buyer = username(value);
    return buyer ? `https://www.whatnot.com/user/${encodeURIComponent(buyer)}` : '';
  }

  const api = Object.freeze({ username, profileUrl });
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.WhatnotBuyerLink = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
