# ADR 0004: Notification Delivery Guarantees & Queue Architecture

## Status
Accepted (revised by ADR 0006 — push-only delivery; Twilio/SMS removed)

## Context
When a Creator sends a Ping (or goes live) to 2,000+ fans, we cannot make
2,000 synchronous HTTP calls from the request cycle. We need:
- Async fan-out via message queue
- Bounded per-channel pacing (anti-storm; OneSignal API rate limits)
- Idempotent delivery (no duplicate notifications)
- Retry with exponential backoff
- Quota enforcement per channel (tier limit)
- Two triggers on the same pipeline: Creator pings and **Go Live events**

Push is the only delivery channel (ADR 0006): there is no per-message cost
and no phone number anywhere in the system.

## Decision
**Upstash QStash** as the durable message queue with **per-channel rate limit
buckets** in Redis, sending through **OneSignal** (web push + mobile FCM/APNs).

### Queue Flow

```
Creator sends Ping (POST /api/v1/pings)        ── or ──  GO LIVE event
    │
    ▼
FastAPI: Validate tier quota, create Ping record (kind=message|live,
         status=processing)
    │
    ▼
Fan-out: SELECT fan_id FROM anonymous_links WHERE channel_id=?
         AND status='active'
    │
    ▼
For each fan: MessageQueueJob (idempotency_key = ping_id:fan_id:'push')
    │
    ▼
Enqueue batch to QStash (up to 1000 jobs per API call)
    │
    ▼
QStash delivers to Worker endpoint (POST /api/v1/worker/deliver)
    │
    ▼
Worker: Check rate limit bucket → send via OneSignal (include_player_ids)
        → update job status
    │
    ▼  (parallel, best-effort — never blocks fan-out)
QStash delayed job → NotaryPort → Midnight notary stub
        (pseudonymous channel id, event id, timestamp)
```

### Rate Limiting (Counter per Channel)
A per-channel sliding-window counter in Redis (`INCR` + `EXPIRE` on first hit,
120 sends/min/channel default) throttles fan-out pacing. Atomic Lua is not
required — this is pacing, not a security control. The original Twilio carrier
rationale is gone; the counter now exists to prevent fan-out storms and stay
within OneSignal API throughput limits.

### Idempotency
- `idempotency_key = f"{ping_id}:{fan_id}:{delivery_method}"`
- Unique constraint on `message_queue_jobs.idempotency_key`
- Worker checks status before processing: if `sent` or `processing`, skip

### Retry Policy
| Attempt | Delay | Max Retries |
|---------|-------|-------------|
| 1 | Immediate | - |
| 2 | 30 seconds | 3 |
| 3 | 2 minutes | 3 |
| 4 | 10 minutes | 3 |
| 5 | 1 hour | 3 |

Implemented via QStash `retries` + custom backoff in worker.

### OneSignal Send
- Server-side `POST https://api.onesignal.com/notifications`, header
  `Authorization: Key <onesignal_rest_api_key>`.
- Targeting: `include_aliases: {"onesignal_id": [<stored device ids>]}` with
  `target_channel: "push"` (the stored ids come from
  `device_tokens.token = OneSignal.User.onesignalId` per device).
- Payloads contain only public content (creator handle, message text) —
  OneSignal sees device ids and payloads, never fan identity.
- Fans without a registered device token are marked `skipped` on the job
  (no delivery handle), not failed.

### Quota Tracking (was Cost Tracking)
- Increment a per-channel, per-period ping counter atomically on send.
- Hard cap at tier limit (Free: 100, Pro: 10,000, Enterprise: custom),
  checked **before** fan-out — rejection happens at the API, not mid-queue.
- The old "prevent SMS bill shock" rationale is retired (ADR 0006); the cap
  is now a product quota. Alert at 80% usage is a follow-up.

### Dead Letter Queue
- Jobs failing after max retries → `status = 'failed'` + `error_message`
- Daily cron job aggregates failures → alerts ops
- Manual replay via admin dashboard

## Consequences
- **Pros**: horizontal scaling, durable delivery, zero per-message cost,
  single pipeline for pings and go-live alerts, notary is isolated behind
  `NotaryPort` (lag/failure cannot affect delivery).
- **Cons**: added complexity (queue, worker, buckets), eventual consistency,
  reach limited to devices with granted push permission (no SMS fallback).
- **Monitoring**: dashboard with queue depth, delivery latency, failure rate.

---

## Related
- ADR 0001: Tech Stack (Upstash QStash, OneSignal)
- ADR 0002: Database Schema (message_queue_jobs, pings)
- ADR 0003: Anonymous Link (fan-out source; superseded)
- ADR 0006: Hybrid Architecture (push-only, notary sidecar, quota rationale)
