function cleanIdentityPart(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function canonicalImageUrl(value) {
  const raw = cleanIdentityPart(value);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    // Bandai changes cache-busting query strings without changing the card
    // image.  The path is the image identity; the query is not.
    return `${url.hostname.toLowerCase()}${url.pathname.toLowerCase()}`;
  } catch {
    return raw.split(/[?#]/, 1)[0].toLowerCase();
  }
}

function officialCardIdentity({ cardNumber, rarity, cardType, name, imageUrl, rawDetails }) {
  const imageIdentity = canonicalImageUrl(imageUrl);
  return [
    cleanIdentityPart(cardNumber).toUpperCase(),
    cleanIdentityPart(rarity).toUpperCase(),
    cleanIdentityPart(cardType).toUpperCase(),
    cleanIdentityPart(name).toLowerCase(),
    imageIdentity || cleanIdentityPart(rawDetails).toLowerCase()
  ].join('|');
}

module.exports = { canonicalImageUrl, officialCardIdentity };
