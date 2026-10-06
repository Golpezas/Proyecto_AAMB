# Ping Platform MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MVP of a privacy-preserving notification platform where creators send SMS/Push pings to fans without ever seeing their phone numbers.

**Architecture:** FastAPI backend with Supabase (PostgreSQL + RLS), PIN/wallet anonymous links via Privy, async message delivery via Upstash QStash → worker → Twilio/OneSignal, Next.js frontend with shadcn/ui.

**Tech Stack:** FastAPI, Pydantic v2, SQLAlchemy 2.0 async, Supabase, Privy, Upstash Redis/QStash, Twilio, OneSignal, Next.js 14, Tailwind CSS, shadcn/ui, Vercel + Render.

**Spec:** `CONTEXT.md` (domain model), `docs/adr/0001-tech-stack.md` through `docs/adr/0004-message-delivery.md`

## Global Constraints

- Python 3.11+, Node 20+
- No phone number in any API response, log, or Creator-visible data
- All PINs hashed with bcrypt cost 12
- Phone numbers encrypted AES-256-GCM at rest
- SMS idempotency via `ping_id:fan_id:method` unique key
- Max 160 chars per SMS segment
- Free tier: 100 pings/month per channel; Pro: 10,000
- Every task ends with passing tests and a commit

---

## Phase 1: Project Scaffolding

### Task 1: Backend project structure

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/core/config.py`
- Create: `backend/app/core/ports.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Test: `backend/tests/test_health.py`

**Interfaces:**
- Produces: `create_app() -> FastAPI`, `Settings` (pydantic-settings), port Protocols

- [ ] **Step 1: Write failing health test**

```python
# backend/tests/test_health.py
from fastapi.testclient import TestClient

def test_health(client: TestClient):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
```

- [ ] **Step 2: Create conftest with TestClient fixture**

```python
# backend/tests/conftest.py
import pytest
from fastapi.testclient import TestClient
from app.main import create_app

@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_health.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app'`

- [ ] **Step 4: Create project structure and config**

```toml
# backend/pyproject.toml
[project]
name = "ping-backend"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.111",
    "pydantic>=2.7",
    "pydantic-settings>=2.2",
    "uvicorn[standard]>=0.29",
    "sqlalchemy[asyncio]>=2.0",
    "asyncpg>=0.29",
    "supabase>=2.4",
    "httpx>=0.27",
    "passlib[bcrypt]>=1.7",
    "cryptography>=42.0",
    "redis>=5.0",
]

[project.optional-dependencies]
dev = ["pytest>=8.0", "pytest-asyncio>=0.23", "ruff>=0.4"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
pythonpath = ["."]
```

```python
# backend/app/core/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_key: str = ""
    database_url: str = ""
    privy_app_id: str = ""
    privy_app_secret: str = ""
    upstash_redis_url: str = ""
    upstash_qstash_token: str = ""
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""
    onesignal_app_id: str = ""
    onesignal_rest_api_key: str = ""
    phone_encryption_key: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

settings = Settings()
```

```python
# backend/app/core/ports.py
from typing import Protocol
from pydantic import BaseModel

class SendResult(BaseModel):
    success: bool
    provider_id: str | None = None
    error: str | None = None

class SMSProvider(Protocol):
    async def send(self, to: str, body: str, channel_id: str) -> SendResult: ...

class PushProvider(Protocol):
    async def send(self, player_ids: list[str], message: str) -> SendResult: ...

class QueueProvider(Protocol):
    async def enqueue(self, job: dict) -> str: ...
    async def enqueue_batch(self, jobs: list[dict]) -> list[str]: ...
```

- [ ] **Step 5: Create main app**

```python
# backend/app/main.py
from fastapi import FastAPI

def create_app() -> FastAPI:
    app = FastAPI(title="Ping Platform", version="0.1.0")

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_health.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat: scaffold backend with FastAPI, config, and health endpoint"
```

---

### Task 2: Database schema and Supabase migration

**Files:**
- Create: `backend/supabase/migrations/0001_initial_schema.sql`
- Create: `backend/supabase/migrations/0002_rls_policies.sql`
- Test: `backend/tests/test_schema.sql` (manual verification via psql)

**Interfaces:**
- Produces: tables `creators`, `channels`, `fans`, `encrypted_phones`, `anonymous_links`, `pings`, `message_queue_jobs`

- [ ] **Step 1: Write initial schema migration**

```sql
-- backend/supabase/migrations/0001_initial_schema.sql
-- Full schema from ADR 0002: creators, channels, fans,
-- encrypted_phones, anonymous_links, pings, message_queue_jobs
-- + indexes + unique constraints
```

Copy the complete DDL from `docs/adr/0002-database-schema.md` into this migration file.

- [ ] **Step 2: Write RLS migration**

```sql
-- backend/supabase/migrations/0002_rls_policies.sql
-- RLS policies + get_decrypted_phone() SECURITY DEFINER function
-- from ADR 0002
```

Copy the RLS policies from `docs/adr/0002-database-schema.md`.

- [ ] **Step 3: Apply migration to local Supabase**

Run: `supabase db push` or `psql -f backend/supabase/migrations/0001_initial_schema.sql`
Expected: Tables created, no errors

- [ ] **Step 4: Verify RLS is active**

```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';
-- All tables should show rowsecurity=true
```

- [ ] **Step 5: Commit**

```bash
git add backend/supabase/
git commit -m "feat: add database schema and RLS policies"
```

---

### Task 3: Domain models (Pydantic)

**Files:**
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/schemas.py`
- Test: `backend/tests/test_schemas.py`

**Interfaces:**
- Produces: `Creator`, `Channel`, `Fan`, `AnonymousLink`, `Ping`, `MessageQueueJob`, `SubscribeRequest`, `PingCreate`

- [ ] **Step 1: Write failing schema tests**

```python
# backend/tests/test_schemas.py
from app.models.schemas import SubscribeRequest, PingCreate

def test_subscribe_request_valid():
    req = SubscribeRequest(channel_handle="creator1", pin="123456", phone="+15551234567")
    assert req.pin == "123456"

def test_subscribe_request_rejects_bad_phone():
    import pytest
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        SubscribeRequest(channel_handle="c", pin="123456", phone="not-a-phone")

def test_ping_create_max_length():
    import pytest
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        PingCreate(message="x" * 161)
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd backend && python -m pytest tests/test_schemas.py -v`
Expected: FAIL — module not found

- [ ] **Step 3: Implement schemas**

```python
# backend/app/models/schemas.py
from pydantic import BaseModel, Field, field_validator
import re

class SubscribeRequest(BaseModel):
    channel_handle: str
    pin: str = Field(min_length=6, max_length=12)
    phone: str = Field(description="E.164 format")

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not re.match(r"^\+[1-9]\d{7,14}$", v):
            raise ValueError("Phone must be E.164 format, e.g. +15551234567")
        return v

class WalletSubscribeRequest(BaseModel):
    channel_handle: str
    wallet_address: str = Field(pattern=r"^0x[0-9a-fA-F]{40}$")
    phone: str | None = None

class PingCreate(BaseModel):
    channel_id: str
    message: str = Field(max_length=160)
    delivery_method: str = Field(default="push", pattern="^(sms|push|both)$")

class PingResponse(BaseModel):
    id: str
    status: str
    total_recipients: int

class SendResult(BaseModel):
    success: bool
    provider_id: str | None = None
    error: str | None = None
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd backend && python -m pytest tests/test_schemas.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/ backend/tests/test_schemas.py
git commit -m "feat: add Pydantic domain schemas with validation"
```

---

## Phase 2: Core Backend API

### Task 4: Database access layer

**Files:**
- Create: `backend/app/db/__init__.py`
- Create: `backend/app/db/session.py`
- Create: `backend/app/db/repositories.py`
- Test: `backend/tests/test_repositories.py`

**Interfaces:**
- Consumes: schema from Task 2, schemas from Task 3
- Produces: `CreatorRepo`, `ChannelRepo`, `AnonymousLinkRepo`, `PingRepo`

- [ ] **Step 1: Write failing repository tests** (use in-memory SQLite or mocked Supabase client)

```python
# backend/tests/test_repositories.py
import pytest
from app.db.repositories import AnonymousLinkRepo

@pytest.mark.asyncio
async def test_create_anonymous_link(mock_repo: AnonymousLinkRepo):
    link = await mock_repo.create(
        channel_id="ch_1", pin_hash="$2b$12$abc...", fan_id="fan_1"
    )
    assert link.id is not None
    assert link.status == "active"
```

- [ ] **Step 2: Implement session and repositories**

```python
# backend/app/db/session.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.core.config import settings

engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, expire_on_commit=False)
```

```python
# backend/app/db/repositories.py
# Async repository classes using SQLAlchemy 2.0 for each entity
# CreatorRepo, ChannelRepo, FanRepo, AnonymousLinkRepo, PingRepo
# Each has: get, create, update, list methods
```

- [ ] **Step 3: Run tests**

Run: `cd backend && python -m pytest tests/test_repositories.py -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/app/db/ backend/tests/test_repositories.py
git commit -m "feat: add async database repositories"
```

---

### Task 5: PIN subscription endpoint

**Files:**
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/subscriptions.py`
- Create: `backend/app/services/pin_service.py`
- Test: `backend/tests/test_subscribe.py`

**Interfaces:**
- Consumes: `SubscribeRequest` (Task 3), `AnonymousLinkRepo` (Task 4)
- Produces: `POST /api/v1/subscribe` → `{success: true, fan_id}`

- [ ] **Step 1: Write failing test**

```python
# backend/tests/test_subscribe.py
from fastapi.testclient import TestClient

def test_subscribe_with_valid_pin(client: TestClient, seeded_channel):
    resp = client.post("/api/v1/subscribe", json={
        "channel_handle": seeded_channel.handle,
        "pin": "123456",
        "phone": "+15551234567"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    # CRITICAL: no phone number in response
    assert "phone" not in str(data).replace(seeded_channel.handle, "")

def test_subscribe_wrong_pin(client: TestClient, seeded_channel):
    resp = client.post("/api/v1/subscribe", json={
        "channel_handle": seeded_channel.handle,
        "pin": "999999",
        "phone": "+15551234567"
    })
    assert resp.status_code == 401
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd backend && python -m pytest tests/test_subscribe.py -v`
Expected: FAIL — 404 (route not found)

- [ ] **Step 3: Implement PIN service and endpoint**

```python
# backend/app/services/pin_service.py
import bcrypt

def hash_pin(pin: str) -> str:
    return bcrypt.hashpw(pin.encode(), bcrypt.gensalt(rounds=12)).decode()

def verify_pin(pin: str, pin_hash: str) -> bool:
    return bcrypt.checkpw(pin.encode(), pin_hash.encode())
```

```python
# backend/app/api/subscriptions.py
from fastapi import APIRouter, HTTPException
from app.models.schemas import SubscribeRequest, WalletSubscribeRequest

router = APIRouter(prefix="/api/v1", tags=["subscriptions"])

@router.post("/subscribe")
async def subscribe(req: SubscribeRequest):
    # 1. Lookup channel by handle
    # 2. Verify PIN against channel.pin_hash
    # 3. Create or get fan
    # 4. Encrypt phone → store in encrypted_phones
    # 5. Create anonymous_link
    # 6. Return success (NEVER return phone)
    ...
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd backend && python -m pytest tests/test_subscribe.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/ backend/app/services/ backend/tests/test_subscribe.py
git commit -m "feat: add PIN-based anonymous subscription endpoint"
```

---

### Task 6: Phone encryption service

**Files:**
- Create: `backend/app/services/crypto_service.py`
- Test: `backend/tests/test_crypto.py`

**Interfaces:**
- Produces: `encrypt_phone(phone: str) -> bytes`, `decrypt_phone(cipher: bytes) -> str`

- [ ] **Step 1: Write failing test**

```python
# backend/tests/test_crypto.py
from app.services.crypto_service import encrypt_phone, decrypt_phone

def test_roundtrip():
    phone = "+15551234567"
    encrypted = encrypt_phone(phone)
    assert encrypted != phone.encode()
    assert decrypt_phone(encrypted) == phone

def test_different_nonces():
    phone = "+15551234567"
    e1 = encrypt_phone(phone)
    e2 = encrypt_phone(phone)
    assert e1 != e2  # Same plaintext, different ciphertext (random nonce)
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && python -m pytest tests/test_crypto.py -v`
Expected: FAIL

- [ ] **Step 3: Implement with AES-256-GCM**

```python
# backend/app/services/crypto_service.py
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.core.config import settings

def _get_key() -> bytes:
    return settings.phone_encryption_key.encode().ljust(32, b"\0")[:32]

def encrypt_phone(phone: str) -> bytes:
    aes = AESGCM(_get_key())
    nonce = os.urandom(12)
    return nonce + aes.encrypt(nonce, phone.encode(), None)

def decrypt_phone(cipher: bytes) -> str:
    aes = AESGCM(_get_key())
    nonce, ct = cipher[:12], cipher[12:]
    return aes.decrypt(nonce, ct, None).decode()
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd backend && python -m pytest tests/test_crypto.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/crypto_service.py backend/tests/test_crypto.py
git commit -m "feat: add AES-256-GCM phone encryption service"
```

---

### Task 7: Channel creation and PIN setup (Creator registration)

**Files:**
- Create: `backend/app/api/channels.py`
- Test: `backend/tests/test_channels.py`

**Interfaces:**
- Produces: `POST /api/v1/channels` (creator signup), `POST /api/v1/channels/{id}/pin` (rotate PIN)

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_channels.py
def test_create_channel(client: TestClient, auth_headers):
    resp = client.post("/api/v1/channels", json={"handle": "mychannel"}, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["handle"] == "mychannel"
    assert "pin_hash" not in data  # never expose hash

def test_set_pin(client: TestClient, auth_headers):
    resp = client.post("/api/v1/channels/ch1/pin", json={"pin": "123456"}, headers=auth_headers)
    assert resp.status_code == 200
```

- [ ] **Step 2: Verify failure**

Run: `cd backend && python -m pytest tests/test_channels.py -v`
Expected: FAIL

- [ ] **Step 3: Implement channel endpoints with auth**

```python
# backend/app/api/channels.py
# POST /api/v1/channels — create channel with handle
# POST /api/v1/channels/{id}/pin — set/rotate PIN (store bcrypt hash)
# GET  /api/v1/channels/{id}/stats — ping count, subscriber count (NO phone data)
```

- [ ] **Step 4: Verify pass**

Run: `cd backend && python -m pytest tests/test_channels.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/channels.py backend/tests/test_channels.py
git commit -m "feat: add channel creation and PIN management endpoints"
```

---

## Phase 3: Message Queue & Delivery

### Task 8: Queue abstraction with Upstash QStash

**Files:**
- Create: `backend/app/services/queue_service.py`
- Test: `backend/tests/test_queue.py`

**Interfaces:**
- Consumes: `QueueProvider` protocol (Task 1)
- Produces: `enqueue_ping_fanout(ping_id, channel_id, fan_ids, message, method)`

- [ ] **Step 1: Write failing tests (mock QStash)**

```python
# backend/tests/test_queue.py
import pytest
from unittest.mock import AsyncMock, patch
from app.services.queue_service import enqueue_ping_fanout

@pytest.mark.asyncio
async def test_fanout_creates_jobs():
    mock_client = AsyncMock()
    mock_client.publishJSON = AsyncMock(return_value={"messageId": "msg_1"})

    with patch("app.services.queue_service.get_qstash", return_value=mock_client):
        jobs = await enqueue_ping_fanout(
            ping_id="p1", channel_id="ch1",
            fan_ids=["f1", "f2", "f3"],
            message="Test ping", method="sms"
        )
    assert len(jobs) == 3
    assert mock_client.publishJSON.call_count == 3

@pytest.mark.asyncio
async def test_idempotency_key_format():
    # Verify key = f"{ping_id}:{fan_id}:{method}"
    ...
```

- [ ] **Step 2: Verify failure**

Run: `cd backend && python -m pytest tests/test_queue.py -v`
Expected: FAIL

- [ ] **Step 3: Implement queue service**

```python
# backend/app/services/queue_service.py
from qstash import Client as QStashClient
from app.core.config import settings

def get_qstash() -> QStashClient:
    return QStashClient(token=settings.upstash_qstash_token)

async def enqueue_ping_fanout(
    ping_id: str, channel_id: str, fan_ids: list[str],
    message: str, method: str
) -> list[str]:
    client = get_qstash()
    job_ids = []
    for fan_id in fan_ids:
        job_id = client.publishJSON(
            url="https://your-api.render.com/api/v1/worker/deliver",
            body={
                "ping_id": ping_id,
                "channel_id": channel_id,
                "fan_id": fan_id,
                "message": message,
                "method": method,
                "idempotency_key": f"{ping_id}:{fan_id}:{method}",
            },
        )
        job_ids.append(job_id)
    return job_ids
```

- [ ] **Step 4: Verify pass**

Run: `cd backend && python -m pytest tests/test_queue.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/queue_service.py backend/tests/test_queue.py
git commit -m "feat: add QStash queue service with idempotent fanout"
```

---

### Task 9: Worker endpoint (delivery)

**Files:**
- Create: `backend/app/api/worker.py`
- Create: `backend/app/services/rate_limiter.py`
- Test: `backend/tests/test_worker.py`

**Interfaces:**
- Consumes: `SMSProvider`, `PushProvider` (Task 1), `get_decrypted_phone` (Task 2), rate limiter
- Produces: `POST /api/v1/worker/deliver`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_worker.py
def test_deliver_sms_happy_path(client: TestClient, seeded_delivery_job):
    resp = client.post("/api/v1/worker/deliver", json=seeded_delivery_job)
    assert resp.status_code == 200
    assert resp.json()["status"] == "sent"

def test_deliver_skips_opted_out(client: TestClient, opted_out_job):
    resp = client.post("/api/v1/worker/deliver", json=opted_out_job)
    assert resp.json()["status"] == "opted_out"

def test_deliver_respects_rate_limit(client: TestClient, many_jobs):
    # Exceed rate limit → job queued, not sent
    ...
```

- [ ] **Step 2: Verify failure**

Run: `cd backend && python -m pytest tests/test_worker.py -v`
Expected: FAIL

- [ ] **Step 3: Implement rate limiter**

```python
# backend/app/services/rate_limiter.py
import redis.asyncio as aioredis
from app.core.config import settings

redis_client = aioredis.from_url(settings.upstash_redis_url)

async def acquire_slot(channel_id: str, max_per_minute: int = 30) -> bool:
    key = f"ratelimit:{channel_id}"
    script = """
    local current = tonumber(redis.call('GET', KEYS[1]) or "0")
    if current < tonumber(ARGV[1]) then
        redis.call('INCR', KEYS[1])
        redis.call('EXPIRE', KEYS[1], 60)
        return 1
    end
    return 0
    """
    result = await redis_client.eval(script, 1, key, max_per_minute)
    return result == 1
```

- [ ] **Step 4: Implement worker endpoint**

```python
# backend/app/api/worker.py
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/v1/worker", tags=["worker"])

@router.post("/deliver")
async def deliver(job: dict):
    # 1. Check idempotency (job status)
    # 2. Check rate limit
    # 3. Check fan not opted_out
    # 4. If SMS: decrypt phone → send → increment counter
    # 5. If Push: send to OneSignal
    # 6. Update job status
    ...
```

- [ ] **Step 5: Verify pass**

Run: `cd backend && python -m pytest tests/test_worker.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/worker.py backend/app/services/rate_limiter.py backend/tests/test_worker.py
git commit -m "feat: add delivery worker with rate limiting and idempotency"
```

---

### Task 10: Ping creation endpoint (fan-out trigger)

**Files:**
- Modify: `backend/app/api/__init__.py` (register ping router)
- Create: `backend/app/api/pings.py`
- Test: `backend/tests/test_pings.py`

**Interfaces:**
- Consumes: `PingCreate` (Task 3), `enqueue_ping_fanout` (Task 8)
- Produces: `POST /api/v1/pings`, `GET /api/v1/pings/{id}`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_pings.py
def test_create_ping(client: TestClient, seeded_channel_with_fans):
    resp = client.post("/api/v1/pings", json={
        "channel_id": "ch1",
        "message": "Show at 5PM!",
        "delivery_method": "push"
    }, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "queued"
    assert data["total_recipients"] > 0

def test_ping_respects_free_tier_limit(client: TestClient, over_limit_channel):
    resp = client.post("/api/v1/pings", json={...}, headers=auth_headers)
    assert resp.status_code == 402  # Payment required
```

- [ ] **Step 2: Verify failure**

Run: `cd backend && python -m pytest tests/test_pings.py -v`
Expected: FAIL

- [ ] **Step 3: Implement ping endpoint**

```python
# backend/app/api/pings.py
# POST /api/v1/pings:
#   1. Validate channel ownership (auth)
#   2. Check tier limits (Free: 100/mo)
#   3. Create Ping record
#   4. SELECT active fan_ids from anonymous_links
#   5. Call enqueue_ping_fanout()
#   6. Return ping_id + status
```

- [ ] **Step 4: Verify pass**

Run: `cd backend && python -m pytest tests/test_pings.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/pings.py backend/tests/test_pings.py
git commit -m "feat: add ping creation with tier limits and fan-out"
```

---

## Phase 4: Frontend (Next.js)

### Task 11: Next.js project setup with shadcn/ui

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/app/layout.tsx`
- Create: `frontend/app/page.tsx`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/components/ui/` (shadcn components)

**Interfaces:**
- Produces: running Next.js app with design system

- [ ] **Step 1: Scaffold Next.js project**

Run: `npx create-next-app@latest frontend --typescript --tailwind --app --src-dir=false`

- [ ] **Step 2: Init shadcn/ui**

Run: `cd frontend && npx shadcn@latest init`
Run: `npx shadcn@latest add button card input label toast`

- [ ] **Step 3: Create landing page**

```tsx
// frontend/app/page.tsx
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight">
          Ping your fans. <span className="text-primary">Instantly.</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Privacy-first notifications for creators. No phone numbers exposed.
        </p>
        <Button size="lg" className="mt-8">Get Started Free</Button>
      </section>
    </main>
  )
}
```

- [ ] **Step 4: Verify it runs**

Run: `cd frontend && npm run dev`
Expected: Server starts on :3000, page renders

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold Next.js frontend with shadcn/ui"
```

---

### Task 12: Creator dashboard

**Files:**
- Create: `frontend/app/dashboard/page.tsx`
- Create: `frontend/components/ping-composer.tsx`
- Create: `frontend/components/subscriber-stats.tsx`
- Create: `frontend/lib/api.ts`

**Interfaces:**
- Consumes: `POST /api/v1/pings`, `GET /api/v1/channels/{id}/stats`

- [ ] **Step 1: Create API client**

```tsx
// frontend/lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function createPing(data: {
  channel_id: string;
  message: string;
  delivery_method: string;
}) {
  const res = await fetch(`${API_BASE}/api/v1/pings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to send ping");
  return res.json();
}
```

- [ ] **Step 2: Build ping composer component**

```tsx
// frontend/components/ping-composer.tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createPing } from "@/lib/api";

export function PingComposer({ channelId }: { channelId: string }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    setSending(true);
    await createPing({ channel_id: channelId, message, delivery_method: "push" });
    setMessage("");
    setSending(false);
  }

  return (
    <div className="space-y-3">
      <Textarea
        placeholder="What's happening? (max 160 chars)"
        maxLength={160}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">{message.length}/160</span>
        <Button onClick={handleSend} disabled={sending || !message.trim()}>
          {sending ? "Sending..." : "Send Ping"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build dashboard page**

```tsx
// frontend/app/dashboard/page.tsx
// Layout: sidebar (channel info, stats) + main (ping composer, history)
// Uses shadcn Card components
// Shows: subscriber count, pings this month, tier status
```

- [ ] **Step 4: Verify in browser**

Run: `cd frontend && npm run dev` → navigate to `/dashboard`
Expected: Dashboard renders, composer works (API may 404 without backend)

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat: add creator dashboard with ping composer"
```

---

### Task 13: Fan subscription page (onboarding)

**Files:**
- Create: `frontend/app/join/[handle]/page.tsx`
- Create: `frontend/components/pin-form.tsx`
- Create: `frontend/components/wallet-connect.tsx`

**Interfaces:**
- Consumes: `POST /api/v1/subscribe`, Privy SDK
- Produces: 2-step progressive profiling flow (PIN → confirm)

- [ ] **Step 1: Build PIN form with progressive profiling**

```tsx
// frontend/components/pin-form.tsx
"use client";
// Step 1: Enter PIN (6 digits)
// Step 2: Enter phone (E.164 masked input)
// Step 3: Success screen with confetti (gamified)
// Uses framer-motion for transitions
```

- [ ] **Step 2: Build wallet connect button**

```tsx
// frontend/components/wallet-connect.tsx
"use client";
// Uses Privy @privy-io/react-auth
// `useLogin` hook → embedded wallet → send address to backend
```

- [ ] **Step 3: Create join page**

```tsx
// frontend/app/join/[handle]/page.tsx
// Dynamic route: /join/@creatorname
// Shows channel branding, then PIN form or wallet connect
// Mobile-first design
```

- [ ] **Step 4: Verify flow in browser**

Run: `cd frontend && npm run dev` → navigate to `/join/test`
Expected: PIN form renders, validates input, calls API

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat: add fan subscription flow with PIN and wallet"
```

---

## Phase 5: Deployment

### Task 14: Backend deployment to Render

**Files:**
- Create: `render.yaml`
- Create: `backend/Dockerfile` (optional, Render supports native)
- Create: `.env.example`

- [ ] **Step 1: Create Render config**

```yaml
# render.yaml
services:
  - type: web
    name: ping-api
    runtime: python
    buildCommand: "cd backend && pip install -e ."
    startCommand: "cd backend && uvicorn app.main:create_app --factory --host 0.0.0.0 --port $PORT"
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_KEY
        sync: false
      - key: UPSTASH_REDIS_URL
        sync: false
      - key: UPSTASH_QSTASH_TOKEN
        sync: false
      - key: TWILIO_ACCOUNT_SID
        sync: false
      - key: TWILIO_AUTH_TOKEN
        sync: false
      - key: PHONE_ENCRYPTION_KEY
        sync: false
```

- [ ] **Step 2: Create .env.example**

```bash
# .env.example
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJ...
PRIVY_APP_ID=...
UPSTASH_REDIS_URL=https://xxx.upstash.io
UPSTASH_QSTASH_TOKEN=...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...
ONESIGNAL_APP_ID=...
PHONE_ENCRYPTION_KEY=<32-byte-hex>
```

- [ ] **Step 3: Commit**

```bash
git add render.yaml .env.example
git commit -m "feat: add Render deployment config"
```

---

### Task 15: Frontend deployment to Vercel

**Files:**
- Create: `frontend/vercel.json` (if needed)
- Modify: `frontend/.env.example`

- [ ] **Step 1: Create Vercel config**

```bash
# frontend/.env.example
NEXT_PUBLIC_API_URL=https://ping-api.onrender.com
NEXT_PUBLIC_PRIVY_APP_ID=...
NEXT_PUBLIC_ONESIGNAL_APP_ID=...
```

- [ ] **Step 2: Deploy via Vercel CLI or GitHub integration**

Run: `cd frontend && vercel --prod`
Expected: Live URL provided

- [ ] **Step 3: Commit**

```bash
git add frontend/.env.example frontend/vercel.json
git commit -m "feat: add Vercel deployment config"
```

---

## Phase 6: Integration Testing & Polish

### Task 16: End-to-end integration test

**Files:**
- Create: `backend/tests/test_e2e_flow.py`

- [ ] **Step 1: Write E2E test covering full flow**

```python
# backend/tests/test_e2e_flow.py
def test_full_flow(client: TestClient):
    """Fan subscribes → Creator sends ping → Worker delivers"""
    # 1. Creator creates channel + sets PIN
    # 2. Fan subscribes with PIN + phone
    # 3. Creator sends ping
    # 4. Worker processes delivery (mock Twilio)
    # 5. Verify: job status = sent, no phone in any response
    # 6. Fan texts STOP → verify opted_out
    # 7. Creator sends another ping → verify fan skipped
```

- [ ] **Step 2: Run full test suite**

Run: `cd backend && python -m pytest -v`
Expected: All tests PASS

- [ ] **Step 3: Run linting**

Run: `cd backend && ruff check . && ruff format .`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_e2e_flow.py
git commit -m "test: add end-to-end flow integration test"
```

---

### Task 17: Final verification checklist

- [ ] All tests pass (`pytest -v`)
- [ ] No phone number in any API response (grep test)
- [ ] Linting clean (`ruff check`)
- [ ] Frontend builds (`npm run build`)
- [ ] `.env.example` complete
- [ ] README with setup instructions
- [ ] `tasks/todo.md` marked complete
- [ ] `tasks/lessons.md` updated

---

## Review Section

_Filled in after implementation._

### What was built
_[to fill]_

### What was learned
_[to fill]_

### Known limitations
_[to fill]_

### Next steps beyond MVP
_[to fill]_
