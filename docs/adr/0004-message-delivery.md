# ADR 0004: Message Delivery Guarantees & Queue Architecture

## Status
Accepted

## Context
When a Creator sends a Ping to 2,000+ fans, we cannot make 2,000 synchronous HTTP calls to Twilio/OneSignal. We need:
- Async fan-out via message queue
- Rate limiting per channel (Twilio carrier limits)
- Idempotent delivery (no duplicate SMS)
- Retry with exponential backoff
- Cost tracking per channel
- Push fallback when SMS fails or for cost savings

## Decision
**Upstash QStash** as the durable message queue with **per-channel rate limit buckets** in Redis.

### Queue Flow

```
Creator sends Ping (POST /api/pings)
    │
    ▼
FastAPI: Validate tier limits, create Ping record (status=processing)
    │
    ▼
Fan-out: SELECT fan_id FROM anonymous_links WHERE channel_id=? AND status='active'
    │
    ▼
For each fan: Create MessageQueueJob (idempotency_key = ping_id:fan_id:method)
    │
    ▼
Enqueue batch to QStash (up to 1000 jobs per API call)
    │
    ▼
QStash delivers to Worker endpoint (POST /api/worker/deliver)
    │
    ▼
Worker: Check rate limit bucket → Decrypt phone (if SMS) → Send via provider → Update job status
```

### Rate Limiting (Token Bucket per Channel)

```python
# Redis key: ratelimit:channel:{channel_id}
# Tokens: max_sms_per_minute (e.g., 30 for Twilio trial, 1000+ for verified)
# Refill: 1 token per second

async def acquire_sms_slot(channel_id: str) -> bool:
    key = f"ratelimit:channel:{channel_id}"
    # Lua script for atomic check-and-decrement
    script = """
    local tokens = tonumber(redis.call('GET', KEYS[1]) or ARGV[1])
    if tokens > 0 then
        redis.call('DECR', KEYS[1])
        return 1
    end
    return 0
    """
    return await redis.eval(script, 1, key, max_tokens)
```

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

### Push Fallback Logic
```python
async def determine_delivery_method(fan: Fan, channel: Channel) -> str:
    # Priority: User preference > Cost > Reliability
    if fan.push_token and channel.tier != 'free':
        return 'push'  # Zero cost, instant
    if fan.has_phone:
        return 'sms'   # Costs money, guaranteed delivery
    return 'push'      # Fallback
```

### Cost Tracking
- Increment `channels.sms_sent_this_period` atomically on SMS send
- Hard cap at tier limit (Free: 100, Pro: 10,000, Enterprise: custom)
- Alert at 80% usage via webhook to Creator

### Dead Letter Queue
- Jobs failing after max retries → `status = 'failed'` + `error_message`
- Daily cron job aggregates failures → alerts ops
- Manual replay via admin dashboard

## Consequences
- **Pros**: Horizontal scaling, durable delivery, cost control, observability
- **Cons**: Added complexity (queue, worker, rate limiting), eventual consistency
- **Monitoring**: Dashboard with queue depth, delivery latency, failure rate, cost/channel

---

## Related
- ADR 0001: Tech Stack (Upstash QStash)
- ADR 0002: Database Schema (message_queue_jobs)
- ADR 0003: Anonymous Link (fan-out source)