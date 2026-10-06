# CONTEXT.md — Ping Notification Platform

## Glossary

**Creator** — A content creator (streamer, influencer, artist) who sends "pings" (notifications) to their audience. Owns a Channel.

**Fan** — An end-user who subscribes to a Creator's channel to receive pings. Identified only by an anonymous PIN or embedded wallet.

**Channel** — A Creator's broadcast endpoint. Has a unique public handle (e.g., `@creatorname`) and a private signing key for webhook verification.

**PIN** — A 6-digit numeric code (or alphanumeric string) that serves as an anonymous identifier linking a Fan to a Channel. The Fan shares their PIN with the Creator; the Creator never sees the Fan's phone number.

**Anonymous Link** — The cryptographic relationship `Channel ↔ PIN ↔ PhoneNumber` stored in the database. The phone number is encrypted at rest; only the messaging worker can decrypt it at send time.

**Ping** — A short notification message (max 160 chars for SMS, longer for Push) sent by a Creator to all subscribed Fans of a Channel.

**Embedded Wallet** — A non-custodial wallet created invisibly via Privy for each Fan. Provides a cryptographic identity without requiring MetaMask or seed phrases. The wallet address serves as an alternative to PIN for linking.

**Web3 Identity** — Either a PIN or an embedded wallet address that uniquely identifies a Fan-Channel subscription without exposing PII.

**Message Queue Job** — A background task enqueued in Upstash/QStash representing one Ping delivery to one Fan. Contains: `channel_id`, `fan_id`, `message`, `delivery_method` (SMS|Push), `retry_count`.

**Rate Limit Bucket** — Per-channel token bucket controlling SMS send rate to stay within Twilio limits and carrier restrictions.

**Subscription Tier** — Creator pricing plan: Free (limited pings/month), Pro ($1-2/mo for high volume), Enterprise (custom).

---

## Key Invariants

1. **PII Isolation**: No Creator, no admin dashboard, no log ever contains a Fan's raw phone number. Only the SMS worker decrypts it ephemerally at send time.

2. **Anonymous Subscription**: A Fan subscribes by entering a PIN (or connecting wallet) — no email, no name, no phone number visible to Creator.

3. **Idempotent Delivery**: Each Ping→Fan delivery is idempotent (deduplicated by `message_id` + `fan_id`).

4. **Opt-out Instant**: Fan can unsubscribe by texting STOP or deleting their PIN — takes effect immediately.

5. **Cost Control**: SMS sends are tracked per Channel per billing period. Hard cap prevents bill shock.

---

## Domain Relationships

```
Creator 1──* Channel
Channel 1──* AnonymousLink (Fan subscriptions)
AnonymousLink *──1 Fan (via PIN or Wallet)
Fan 1──1 EncryptedPhoneNumber (stored separately, encrypted)
Ping 1──* MessageQueueJob (fan-out)
Channel 1──1 SubscriptionTier
```