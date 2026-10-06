# ADR 0001: Technology Stack Selection

## Status
Accepted

## Context
We need to select the core technology stack for the Ping notification platform. The system requires:
- FastAPI backend with Pydantic for type-safe APIs
- PostgreSQL database with row-level security (Supabase)
- Web3 authentication via embedded wallets (Privy)
- Serverless Redis for message queues (Upstash/QStash)
- SMS delivery via Twilio
- Push notifications via OneSignal
- Next.js frontend with Tailwind CSS and shadcn/ui
- Deployment on Vercel (frontend) and Render/Railway (backend)

## Decision
**Backend**: FastAPI (Python 3.11+) with Pydantic v2, SQLAlchemy 2.0 async, Supabase (PostgreSQL)  
**Web3 Auth**: Privy for embedded wallets (invisible, no MetaMask required)  
**Queue**: Upstash Redis (serverless) + QStash for durable message delivery  
**SMS**: Twilio (supports Proxy for number masking)  
**Push**: OneSignal (Web Push PWA, zero marginal cost)  
**Frontend**: Next.js 14+ (App Router), Tailwind CSS, shadcn/ui  
**Deployment**: Vercel (frontend), Render (backend API), Upstash (Redis/QStash)  
**Observability**: Sentry for errors, custom metrics for SMS costs

## Consequences
- **Pros**: Type-safe end-to-end (Pydantic → TypeScript via OpenAPI), serverless scaling, Web3 without UX friction, cost-effective push fallback
- **Cons**: Multiple external dependencies (Privy, Twilio, OneSignal, Upstash), need to manage secrets across platforms
- **Risk Mitigation**: Abstract providers behind interfaces (SMSProvider, PushProvider, QueueProvider) for testability and swapability

---

## Key Interfaces to Define

```python
# src/core/ports.py
class SMSProvider(Protocol):
    async def send(self, to: str, body: str, channel_id: str) -> SendResult: ...

class PushProvider(Protocol):
    async def send(self, player_ids: list[str], message: str) -> SendResult: ...

class QueueProvider(Protocol):
    async def enqueue(self, job: MessageQueueJob) -> str: ...
    async def enqueue_batch(self, jobs: list[MessageQueueJob]) -> list[str]: ...
```

## Related
- ADR 0002: Database Schema & RLS Policies
- ADR 0003: Anonymous Link Architecture
- ADR 0004: Message Delivery Guarantees