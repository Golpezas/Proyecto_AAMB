# CONTEXT.md — PIN Notification Platform

A privacy-preserving notification platform: creators alert their audience
(new pings and go-live events) without ever seeing fan personal data.

## Glossary

**Creator** — A content creator (streamer, influencer, artist) who sends pings
and go-live alerts to their audience. Owns a Channel. Authenticated via
Supabase Auth (ADR 0005).

**Fan** — An end-user who subscribes to a Creator's channel to receive
notifications. Identified only by an embedded wallet address; the platform
never collects a Fan's phone number, email, or real name.

**Channel** — A Creator's broadcast endpoint. Has a unique public handle
(e.g., `@creatorname`), a live status, and a private signing key for webhook
verification.

**Ping** — A short notification message (max 160 chars) sent by a Creator to
all subscribed Fans of a Channel.

**Go Live Event** — A Channel status transition (off → live) initiated by the
Creator; notifies all subscribed Fans. Mirrored asynchronously to the notary.

**Anonymous Link** — The pseudonymous relationship `Channel ↔ Fan` stored in
the database, keyed by the Fan's wallet address. No phone number exists in
this relationship.

**Embedded Wallet** — A non-custodial wallet created invisibly via Privy for
each Fan (and Creator). Provides a cryptographic identity without MetaMask or
seed phrases; used to sign subscriptions and actions.

**Device Token** — An opaque push-delivery token (FCM/APNs) registered by a
Fan's device. The only routing data the platform stores for a Fan's device;
it carries no personal identity.

**Message Queue Job** — A background task enqueued in Upstash/QStash
representing one notification delivery to one Fan. Contains `channel_id`,
`fan_id`, payload, `delivery_method` (push), `retry_count`.

**Notary** — An asynchronous sidecar that records event proofs (channel
pseudonym, event id, timestamp) on Midnight. Never in the delivery path; may
lag or fail without affecting notifications.

**Rate Limit Bucket** — Per-channel token bucket throttling fan-out pacing.

**Subscription Tier** — Creator plan: Free (limited pings/month), Pro
(higher quota), Enterprise (custom). Quotas are a product limit, not a
delivery-cost control (push has no per-message cost).

## Key Invariants

1. **PII Isolation**: No Creator, no admin dashboard, no log ever contains a
   Fan's phone number, email, or real name. The platform does not collect
   them at all — only wallet addresses and device tokens.

2. **Anonymous Subscription**: A Fan subscribes by signing with their embedded
   wallet — nothing identifying is visible to the Creator or the platform.

3. **Idempotent Delivery**: Each notification→Fan delivery is idempotent
   (deduplicated by event id + `fan_id` + method).

4. **Opt-out Instant**: A Fan can unsubscribe at any time; the Anonymous Link
   flips to `opted_out` and takes effect immediately for future sends.

5. **Quota Control**: Pings are tracked per Channel per period against the
   tier quota; exceeding it is rejected before fan-out.

6. **Notary is Best-Effort**: Notification delivery never waits on or fails
   because of the Midnight notary.

---

## Domain Relationships

```
Creator 1──* Channel
Channel 1──* AnonymousLink (Fan subscriptions, via wallet address)
AnonymousLink *──1 Fan (via embedded wallet)
Fan 1──* DeviceToken (push endpoints per device)
Ping 1──* MessageQueueJob (fan-out)
Channel 1──1 SubscriptionTier
GoLiveEvent ──> Notary (async proof, best-effort)
```
