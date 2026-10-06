function searchTerms(query) {
  return String(query || '').trim().split(/\s+/).filter(Boolean).map(value => ({
    plain: `%${value}%`,
    compact: `%${value.replace(/[^a-z0-9]/gi, '').toUpperCase()}%`
  }));
}

module.exports = { searchTerms };
