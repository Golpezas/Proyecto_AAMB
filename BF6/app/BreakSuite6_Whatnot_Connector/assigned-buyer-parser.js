(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BreakSuiteAssignedBuyerParser = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function compact(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function validHandle(value) {
    const handle = compact(value).replace(/^@+/, '');
    return /^[a-z0-9_.-]{2,64}$/i.test(handle) ? handle : '';
  }

  function extract(text, profileText = '') {
    // A profile link inside the Assigned row is the strongest evidence.
    const profile = validHandle(profileText);
    if (profile) return profile;

    const source = compact(text);
    if (!source) return '';

    // Current Whatnot Assigned rows use “Sold to: [avatar initial] username”.
    // “Sold to” itself is specific enough that the colon may be omitted by a
    // layout/accessibility repaint.
    const soldTo = source.match(/\bsold\s+to\s*[:\-]?\s*(?:[a-z0-9]{1,2}\s+)?@?([a-z0-9_.-]{2,64})(?=\s|$)/i);
    if (soldTo) return validHandle(soldTo[1]);

    // Older layouts may label Buyer/Username/Winner. Require real punctuation
    // after those generic words. This is deliberate: Whatnot has helper copy
    // such as “Add winner will …”. The old permissive parser interpreted that
    // sentence as buyer @will.
    const explicit = source.match(/\b(?:buyer|username|winner)\s*[:\-]\s*(?:[a-z0-9]{1,2}\s+)?@?([a-z0-9_.-]{2,64})(?=\s|$)/i);
    return explicit ? validHandle(explicit[1]) : '';
  }

  return { extract, validHandle };
});
