'use strict';

function cleanBuyerName(value) {
  return String(value || '').trim().replace(/^@+/, '').replace(/\s+/g, '');
}

function recentUniqueBuyerNames(rows, limit = 100) {
  const names = [];
  const seen = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    const name = cleanBuyerName(row?.buyer_name);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length >= limit) break;
  }
  return names;
}

function splitBuyerMentions(names, maxCharacters = 150) {
  const chunks = [];
  let current = '';
  for (const rawName of Array.isArray(names) ? names : []) {
    const mention = `@${cleanBuyerName(rawName)}`;
    if (mention === '@') continue;
    if (mention.length > maxCharacters) {
      if (current) chunks.push(current);
      chunks.push(mention);
      current = '';
      continue;
    }
    const next = current ? `${current} ${mention}` : mention;
    if (next.length > maxCharacters) {
      if (current) chunks.push(current);
      current = mention;
    } else current = next;
  }
  if (current) chunks.push(current);
  return chunks;
}

module.exports = { cleanBuyerName, recentUniqueBuyerNames, splitBuyerMentions };
