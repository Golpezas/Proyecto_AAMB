// The connector deliberately treats the first number as the only machine
// value.  Everything after it is display text and can contain names, stars,
// diamonds, or any other wording used in a break listing.
function leadingBlockNumber(value) {
  const match = String(value ?? '').trim().match(/^0*(\d{1,4})(?=\D|$)/);
  if (!match) return null;
  const position = Number(match[1]);
  return Number.isInteger(position) && position > 0 ? position : null;
}

module.exports = { leadingBlockNumber };
