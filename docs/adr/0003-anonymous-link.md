# ADR 0003: Anonymous Link Architecture (PIN + Wallet)

## Status
**Superseded by ADR 0006 (Hybrid Architecture).** The 6-digit subscription PIN
(Path A) is deprecated — subscriptions are wallet-signed, and the product name
itself is now "PIN" (Private Instant Notification), making the code a semantic
collision. Phone numbers no longer exist on our servers, so `encrypted_phones`
is removed. Kept below for history; do not implement from this document.

## Context
Fans must subscribe to a Creator's channel without revealing their phone number to the Creator or the platform. The link must work via:
1. **PIN**: 6-digit numeric code shared by Creator (e.g., on stream overlay)
2. **Wallet**: Privy embedded wallet (invisible, created on first visit)

Both must map to the same `Fan` record with an encrypted phone number.

## Decision
**Dual-path subscription flow** converging on `anonymous_links` table:

### Path A: PIN Subscription
1. Creator shares PIN (e.g., "123456") on stream
2. Fan visits `ping.app/join/@creatorname` → enters PIN + phone number
3. Frontend hashes PIN client-side (bcrypt, 12 rounds) → sends `pin_hash` + `phone_e164`
4. Backend:
   - Verifies `pin_hash` matches channel's PIN
   - Creates/upserts `Fan` record
   - Encrypts phone number → stores in `encrypted_phones`
   - Creates `anonymous_links` row linking `channel_id` + `pin_hash` + `fan_id`
   - Returns success (no phone number in response)

### Path B: Wallet Subscription (Privy)
1. Fan visits `ping.app/join/@creatorname` → clicks "Connect Wallet"
2. Privy creates embedded wallet (invisible, email/social login)
3. Frontend gets wallet address → sends to backend
4. Backend:
   - Verifies wallet signature (SIWE)
   - Creates/upserts `Fan` record linked to wallet
   - If phone provided: encrypts → `encrypted_phones`
   - Creates `anonymous_links` row with `wallet_address`
   - Returns success

### PIN Generation (Creator Side)
- Creator sets PIN in dashboard (6 digits, alphanumeric optional)
- Backend stores `bcrypt(pin, 12)` in `channels.pin_hash`
- PIN rotatable: Creator can regenerate, old PIN invalidated immediately

### Wallet Address as Identity
- Privy embedded wallet address = `0x...` (Ethereum-compatible)
- Stored in `anonymous_links.wallet_address` (unique per channel)
- Allows passwordless re-authentication on return visits

## Security Considerations
- **PIN hashing**: bcrypt with cost 12 (slow, resistant to brute force)
- **Rate limiting**: 5 attempts/minute per IP on PIN verify endpoint
- **Phone encryption**: AES-256-GCM with per-environment key rotation
- **No PII in logs**: Structured logging excludes phone, PIN, wallet
- **Opt-out**: `status = 'opted_out'` on anonymous_links + STOP keyword handling via Twilio webhook

## Consequences
- **Pros**: True anonymity for Fans, Creator never sees phone, dual auth paths
- **Cons**: PIN hash verification adds latency, wallet flow requires Privy dependency
- **Migration**: Support both paths from day one; PIN is primary for non-crypto users

---

## Related
- ADR 0001: Tech Stack (Privy integration)
- ADR 0002: Database Schema (encrypted_phones table)
- ADR 0004: Message Delivery (uses anonymous_links for fan-out)