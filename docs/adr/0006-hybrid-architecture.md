# ADR 0006: Hybrid Architecture (Web 2.5) — Supabase Core, Push Delivery, Midnight Notary

## Status
Accepted

## Context
The client proposed a redesign (product "PIN – Private Instant Notification",
diagram `WhatsApp Image 2026-10-06 at 11.24.09 AM.jpeg`) based on a pure Web3
dApp on Midnight: encrypted state on-chain, ZK proofs for authorization,
subscriptions as wallet-signed commitments, and delivery via an
indexer/relay that only sees device tokens.

A pure-on-chain design is idealistic for privacy but carries very high
operational risk: Midnight is an early-stage ecosystem, a dApp-first build
would rewrite the working FastAPI/Supabase core (Tasks 1–7), and the
diagram's requirements conflict with three things already built:
- **SMS/Twilio** requires the server to decrypt and know phone numbers —
  forbidden by the diagram ("no phone numbers on-chain", phone stays
  encrypted on the device).
- **The 6-digit subscription PIN** does not exist in the diagram, and the
  product itself is now branded "PIN" (Private Instant Notification) —
  a semantic collision.
- **Auth**: the diagram signs actions with a wallet; Task 7 verifies
  Supabase Auth JWTs.

## Decision
**Hybrid Web 2.5**: keep the server-side core operationally boring, adopt the
diagram's privacy guarantees where the data model is concerned, and use
Midnight strictly as an asynchronous notary — never in the delivery path.

1. **Supabase remains the source of operational truth.** Relational integrity,
   JWT identity (ADR 0005), queue/job state, and fan-out queries stay in
   PostgreSQL. We do not depend on a testnet for the primary data path.
2. **Delivery is push-only via OneSignal (web + mobile FCM/APNs).**
   Twilio/SMS is eliminated. The server never stores fan phone numbers or
   emails — only **device tokens** (pseudonymous delivery handles) and wallet
   addresses. `encrypted_phones`, AES-256-GCM phone encryption, and the
   Twilio rate/cost machinery are removed.
3. **Two notification kinds, one pipeline.** Ping messages (≤160 chars, kept
   as a product constraint) and automatic **Go Live alerts** both flow through
   the existing QStash → worker fan-out with idempotency
   `ping_id:fan_id:method`. Push has no carrier cost, so the Free/Pro tier
   numbers (100 / 10,000 per month) are reinterpreted as a **product quota**;
   the old "hard cap prevents bill shock" rationale is retired.
4. **Subscriptions are wallet-signed.** Fans subscribe by signing with a Privy
   embedded wallet (created invisibly). The 6-digit subscription PIN and
   ADR 0003 Path A are deprecated (ADR 0003 superseded). **Fan authentication
   in general**: every state-changing fan request (subscribe, unsubscribe,
   device register/revoke) carries an EIP-191 `personal_sign` signature over a
   canonical message `PIN:<action>:<params>:<unix_ts>` with a ±300 s freshness
   window; the backend recovers the signer (`eth-account`) and requires it to
   equal the claimed wallet — no fan session/JWT. **Creator authentication**
   stays Supabase Auth JWT (ADR 0005 unchanged): creators log in with
   supabase-js directly (email/magic link → access token → `Bearer`); Privy is
   used for fan wallets only. A unified Privy→Supabase login bridge and
   creator wallet signing are follow-ups (real Compact contract) — until
   then, GO LIVE events are attested by the authenticated backend.
5. **Midnight as notary sidecar (event-time asynchronous).** When a GO LIVE
   event occurs, the fast path (queue → worker → push) runs immediately on
   Supabase/QStash/OneSignal. In parallel, a separate QStash job calls a
   `NotaryPort` (see `app/core/ports.py` pattern) which today records the
   proof payload (pseudonymous channel id, event id, timestamp) through a
   stub; later it posts a ZK/commitment proof to a Midnight Compact contract.
   The notary can lag or fail without affecting delivery.
6. **Data layout mirrors the diagram's three zones**: device (identity,
   contact list, subscription list copy), Supabase (pseudonymous ids, wallet
   links, device tokens, event/job state — no real names, no phone numbers),
   Midnight (commitments/proofs only).

## Consequences
- **Pros**: the privacy invariant becomes *stronger* (no fan phone numbers
  anywhere in our systems, not even encrypted); the operational core already
  built survives; delivery latency is unaffected by blockchain state;
  notary integration is a drop-in behind a port interface.
- **Cons / accepted risks**:
  - Reach narrows: only fans with a push-capable device + granted permission
    receive notifications (no SMS fallback for feature phones).
  - The product's subscription funnel now requires a wallet (Privy makes this
    invisible, but it is a hard dependency).
  - OneSignal sees player ids and notification payloads (not identities); it
    becomes a trusted processor.
- **Code impact (tracked in the pivot plan)**: schema — drop
  `encrypted_phones`, add `device_tokens`, add unique constraint on
  `channels.creator_id`, drop `channels.pin_hash` + the `POST /channels/{id}/pin`
  endpoint, add `pings.kind` (`message` | `live`); remove
  `crypto_service`/`EncryptedPhoneRepo`; rework Task 5 subscribe to
  wallet-signed; worker sends via OneSignal instead of Twilio.
- **Follow-ups**: verify Privy↔Supabase integration in Privy docs; real
  Compact notary contract; creator wallet signing of live events; device-token
  fan authentication design (fan-scoped JWT after wallet signature).

## Related
- ADR 0003: Anonymous Link Architecture (superseded by this ADR)
- ADR 0004: Message Delivery (rewritten for push-only delivery)
- ADR 0005: Creator Authentication (unchanged; bridged by Privy on the frontend)
- ADR 0001: Tech Stack (OneSignal already selected; Twilio removed from scope)
