# Ping Platform — Hybrid Pivot Implementation Plan (Tasks 18–30)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorient the platform to the hybrid Web 2.5 architecture (ADR 0006): wallet-signed fan identity, push-only delivery via OneSignal, GO LIVE alerts, and a Midnight notary stub — then ship the frontend and deployments.

**Architecture:** Keep the proven FastAPI/Supabase core (Tasks 1–7). Remove all phone/PIN-code machinery. Fans act through EIP-191 signatures over canonical messages (no fan sessions). QStash fans out one job per active fan; the worker sends via OneSignal using stored device ids; go-live events additionally publish a best-effort notary job. Next.js frontend: creators use Supabase Auth JWT, fans use Privy embedded wallets + OneSignal Web SDK.

**Tech Stack:** FastAPI, Pydantic v2, SQLAlchemy 2.0 async, Supabase (PostgreSQL), eth-account (EIP-191 recovery), Upstash Redis/QStash, OneSignal (web push), Next.js 14, Tailwind, shadcn/ui, `@privy-io/react-auth`, `react-onesignal`, `@supabase/supabase-js`, Vercel + Render.

**Spec:** `CONTEXT.md`, `docs/adr/0006-hybrid-architecture.md` (primary), `docs/adr/0004-message-delivery.md`, `docs/adr/0005-creator-authentication.md`. ADR 0003 is superseded — do not implement it.

**Continuity:** Numbering continues from `docs/superpowers/plans/2026-06-10-ping-platform-mvp.md`. **Tasks 1–7 are complete** (80 tests green, commits through `c32441d`). Do not redo them.

## Global Constraints

- Python 3.11+, Node 20+
- No fan phone number or email is ever collected, stored, logged, or returned — only wallet addresses + device tokens (ADR 0006, CONTEXT.md invariant 1)
- Fan actions are authorized ONLY by EIP-191 signature over `PIN:<action>:<parts...>:<unix_ts>`; freshness window **±300 s**; recovered address must equal claimed wallet (case-insensitive)
- Idempotency key format: `{ping_id}:{fan_id}:{delivery_method}` unique on `message_queue_jobs` (delivery_method is always `push`)
- Max **160** chars per ping message; tiers: Free **100**/month, Pro **10,000** (kind=`message` only; go-live alerts are quota-exempt)
- Quota counter field: `channels.pings_sent_this_period` (renamed from `sms_sent_this_period`); period = 30 days from `period_start`
- Delivery target: `device_tokens.token = OneSignal.User.onesignalId`; OneSignal call is `POST https://api.onesignal.com/notifications` with `Authorization: Key <onesignal_rest_api_key>`
- Canonical message examples (exact, lowercased parts):
  - `PIN:subscribe:@alice:0xabc...def:1760000000`
  - `PIN:unsubscribe:@alice:0xabc...def:1760000000`
  - `PIN:device:0xabc...def:0192f...:1760000000`
  - `PIN:device-revoke:0xabc...def:0192f...:1760000000`
- Every task ends with **all tests passing** (`cd backend && python -m pytest -v`), `ruff check .` clean for touched files, and a commit
- Router registration pattern: import + `app.include_router(...)` in `create_app()` in `backend/app/main.py` (see existing subscription/channels routers)
- Test harness: use the `api_client` fixture (async httpx + ASGITransport) from `backend/tests/conftest.py`; per-task fixtures go in the task's test module or conftest

---

## Phase A — Backend Pivot (identity + schema)

### Task 18: Wallet-signed subscribe / unsubscribe

**Files:**
- Create: `backend/app/services/signature_service.py`
- Create: `backend/supabase/migrations/0003_wallet_identity.sql`
- Modify: `backend/app/services/subscription_service.py` (rewrite; drop phone flow)
- Modify: `backend/app/api/subscription.py` (rewrite; drop PIN verify)
- Modify: `backend/app/models/schemas.py` (replace SubscribeRequest/WalletSubscribeRequest)
- Modify: `backend/app/db/models.py` (Fan.wallet_address)
- Modify: `backend/app/db/repositories.py` (FanRepo: wallet lookup/create; AnonymousLinkRepo: `set_opted_out(..., commit=True)` param, add `reactivate(...)`)
- Modify: `backend/pyproject.toml` (add `eth-account>=0.11`)
- Test: `backend/tests/test_signature.py`, rewrite `backend/tests/test_subscription.py`

**Interfaces:**
- Consumes: `ChannelRepo.get_by_handle`, `get_session`, `SubscribeResponse` (keep), `api_client` fixture
- Produces (later tasks rely on these exact names):
  - `signature_service.canonical_message(action: str, parts: list[str], timestamp: int) -> str`
  - `signature_service.verify_signature(message: str, signature: str, expected_address: str) -> bool`
  - `signature_service.is_fresh(timestamp: int, now: float | None = None) -> bool`
  - `POST /api/v1/subscribe` body `{channel_handle, wallet_address, signature, timestamp}` → `{success, fan_id}`
  - `POST /api/v1/unsubscribe` body same → `{success}`
  - `FanRepo.get_by_wallet(wallet_address: str) -> Fan | None`
  - `FanRepo.create(wallet_address: str, commit: bool = True) -> Fan`
  - `subscription_service.subscribe(session, channel_id, wallet_address) -> Fan`
  - `subscription_service.unsubscribe(session, channel_id, wallet_address) -> None`

- [ ] **Step 1: Add dependency**

`backend/pyproject.toml` → dependencies += `"eth-account>=0.11"`; run `pip install -e ".[dev]"` (or `uv pip install -e .`) in `backend/`.

- [ ] **Step 2: Write failing tests** — `backend/tests/test_signature.py`

```python
# backend/tests/test_signature.py
import time

from eth_account import Account
from eth_account.messages import encode_defunct

from app.services.signature_service import (
    canonical_message,
    is_fresh,
    verify_signature,
)


def _sign(text: str, private_key: str) -> str:
    return Account.sign_message(encode_defunct(text=text), private_key).signature.hex()


def test_canonical_message_format():
    msg = canonical_message("subscribe", ["@Alice", "0xABC"], 1760000000)
    assert msg == "PIN:subscribe:@alice:0xabc:1760000000"


def test_verify_signature_roundtrip():
    acct = Account.create()
    msg = canonical_message("subscribe", ["@alice", acct.address.lower()], 1760000000)
    sig = _sign(msg, acct.key)
    assert verify_signature(msg, sig, acct.address) is True


def test_verify_signature_rejects_wrong_wallet():
    acct, other = Account.create(), Account.create()
    msg = canonical_message("subscribe", ["@alice", other.address.lower()], 1760000000)
    sig = _sign(msg, acct.key)
    assert verify_signature(msg, sig, other.address) is False


def test_verify_signature_rejects_tampered_message():
    acct = Account.create()
    sig = _sign("PIN:subscribe:@alice:%s:1760000000" % acct.address.lower(), acct.key)
    assert verify_signature("PIN:subscribe:@bob:%s:1760000000" % acct.address.lower(), sig, acct.address) is False


def test_verify_signature_rejects_garbage():
    assert verify_signature("PIN:subscribe:@alice:0xabc:1", "not-a-sig", "0xabc") is False


def test_is_fresh_window():
    now = 1760000000.0
    assert is_fresh(1760000000, now=now) is True
    assert is_fresh(1760000000 - 300, now=now) is True
    assert is_fresh(1760000000 - 301, now=now) is False
    assert is_fresh(1760000000 + 301, now=now) is False
```

- [ ] **Step 3: Run tests to verify failure**

Run: `cd backend && python -m pytest tests/test_signature.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.signature_service'`

- [ ] **Step 4: Implement `signature_service.py`**

```python
# backend/app/services/signature_service.py
# EIP-191 personal_sign verification for fan actions (ADR 0006 rule 4).
# There are no fan sessions/JWTs: each state-changing request carries a
# signature over a canonical message with a unix timestamp.
import time

from eth_account import Account
from eth_account.messages import encode_defunct

SIGNATURE_WINDOW_SECONDS = 300


def canonical_message(action: str, parts: list[str], timestamp: int) -> str:
    lowered = [p.lower() for p in parts]
    return ":".join(["PIN", action, *lowered, str(timestamp)])


def verify_signature(message: str, signature: str, expected_address: str) -> bool:
    try:
        signable = encode_defunct(text=message)
        recovered = Account.recover_message(signable, signature=signature)
    except Exception:
        return False
    return recovered.lower() == expected_address.lower()


def is_fresh(timestamp: int, now: float | None = None) -> bool:
    now = time.time() if now is None else now
    return abs(now - timestamp) <= SIGNATURE_WINDOW_SECONDS
```

- [ ] **Step 5: Run signature tests to verify pass**

Run: `cd backend && python -m pytest tests/test_signature.py -v` → PASS

- [ ] **Step 6: Schema (model + migration) — write failing model test**

Add to `backend/tests/test_subscription.py` (file gets rewritten below) or `test_repositories.py`:

```python
async def test_fan_wallet_is_unique(db_session):
    from app.db.repositories import FanRepo
    acct = "0x" + "11" * 20
    await FanRepo(db_session).create(wallet_address=acct)
    await FanRepo(db_session).create(wallet_address=acct)
    import pytest, sqlalchemy.exc
    with pytest.raises(sqlalchemy.exc.IntegrityError):
        await db_session.commit()
```

Wait for existing subscription tests to break too: run `python -m pytest tests/test_subscription.py -v` → FAIL (old phone flow vs new signatures).

- [ ] **Step 7: Implement model + migration**

`models.py` — on `Fan`:

```python
    wallet_address: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
```

`backend/supabase/migrations/0003_wallet_identity.sql`:

```sql
-- ADR 0006: fan identity is the embedded-wallet address (no phone, no PIN).
ALTER TABLE fans ADD COLUMN wallet_address TEXT NOT NULL;
CREATE UNIQUE INDEX uq_fans_wallet_address ON fans(wallet_address);
```

- [ ] **Step 8: Repositories**

- `FanRepo.get_by_wallet(wallet_address: str) -> Fan | None` (select where `Fan.wallet_address == wallet_address.lower()`)
- `FanRepo.create(wallet_address: str, commit: bool = True) -> Fan` (store `wallet_address.lower()`)
- `AnonymousLinkRepo.set_opted_out(channel_id, fan_id, commit: bool = True)` — add the param, commit only when true (backward compatible)
- `AnonymousLinkRepo.reactivate(channel_id, fan_id, commit: bool = True) -> AnonymousLink | None` — mirror of `set_opted_out`: sets `status="active"`, `opted_out_at=None`

- [ ] **Step 9: Rewrite schemas, service, API**

`schemas.py` — replace `SubscribeRequest` and `WalletSubscribeRequest` with:

```python
class SignedFanRequest(BaseModel):
    channel_handle: str
    wallet_address: str = Field(pattern=r"^0x[0-9a-fA-F]{40}$")
    signature: str = Field(min_length=2, max_length=1024)
    timestamp: int

    @field_validator("wallet_address")
    @classmethod
    def normalize_wallet(cls, v: str) -> str:
        return v.lower()


class UnsubscribeResponse(BaseModel):
    success: bool = True
```

(keep `SubscribeResponse` unchanged; `AnonymousLink.wallet_address` schema field is deleted in Task 19)

`subscription_service.py` (full rewrite):

```python
# backend/app/services/subscription_service.py
# Single-transaction subscribe/unsubscribe on wallet identity (ADR 0006).
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Fan
from app.db.repositories import AnonymousLinkRepo, FanRepo


async def subscribe(
    session: AsyncSession, channel_id: str | uuid.UUID, wallet_address: str
) -> Fan:
    fan_repo, link_repo = FanRepo(session), AnonymousLinkRepo(session)
    fan = await fan_repo.get_by_wallet(wallet_address)
    if fan is None:
        fan = await fan_repo.create(wallet_address=wallet_address, commit=False)
    link = await link_repo.get_by_channel_and_fan(channel_id, fan.id)
    if link is None:
        await link_repo.create(channel_id=channel_id, fan_id=fan.id, commit=False)
    elif link.status != "active":
        await link_repo.reactivate(channel_id, fan.id, commit=False)
    try:
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    return fan


async def unsubscribe(
    session: AsyncSession, channel_id: str | uuid.UUID, wallet_address: str
) -> None:
    fan = await FanRepo(session).get_by_wallet(wallet_address)
    if fan is None:
        return  # idempotent: unsubscribing a never-subscribed wallet succeeds
    link = await AnonymousLinkRepo(session).get_by_channel_and_fan(channel_id, fan.id)
    if link is not None and link.status == "active":
        await AnonymousLinkRepo(session).set_opted_out(channel_id, fan.id)
```

`api/subscription.py` (full rewrite) — two handlers sharing one verifier parameterized by action:

```python
# backend/app/api/subscription.py
# Wallet-signed subscribe/unsubscribe. Nothing identifying ever leaves the
# server: the response carries only fan_id (PII isolation invariant).
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories import ChannelRepo
from app.db.session import get_session
from app.models.schemas import SignedFanRequest, SubscribeResponse, UnsubscribeResponse
from app.services import subscription_service
from app.services.signature_service import canonical_message, is_fresh, verify_signature

router = APIRouter(prefix="/api/v1", tags=["subscriptions"])


async def _verify(req: SignedFanRequest, action: str, session: AsyncSession):
    channel = await ChannelRepo(session).get_by_handle(req.channel_handle)
    if channel is None:
        raise HTTPException(status_code=404, detail="Channel not found")
    message = canonical_message(action, [req.channel_handle, req.wallet_address], req.timestamp)
    if not is_fresh(req.timestamp) or not verify_signature(message, req.signature, req.wallet_address):
        raise HTTPException(status_code=401, detail="Invalid signature")
    return channel


@router.post("/subscribe", response_model=SubscribeResponse)
async def subscribe(req: SignedFanRequest, session: Annotated[AsyncSession, Depends(get_session)]) -> SubscribeResponse:
    channel = await _verify(req, "subscribe", session)
    fan = await subscription_service.subscribe(session, channel.id, req.wallet_address)
    return SubscribeResponse(success=True, fan_id=str(fan.id))


@router.post("/unsubscribe", response_model=UnsubscribeResponse)
async def unsubscribe(req: SignedFanRequest, session: Annotated[AsyncSession, Depends(get_session)]) -> UnsubscribeResponse:
    channel = await _verify(req, "unsubscribe", session)
    await subscription_service.unsubscribe(session, channel.id, req.wallet_address)
    return UnsubscribeResponse(success=True)
```

- [ ] **Step 10: Rewrite `backend/tests/test_subscription.py`**

```python
# backend/tests/test_subscription.py
import time

import pytest
from eth_account import Account
from eth_account.messages import encode_defunct

from app.db.models import Channel, Creator


def _signed_body(handle: str, acct, action: str = "subscribe") -> dict:
    ts = int(time.time())
    wallet = acct.address.lower()
    msg = f"PIN:{action}:{handle.lower()}:{wallet}:{ts}"
    sig = Account.sign_message(encode_defunct(text=msg), acct.key).signature.hex()
    return {"channel_handle": handle, "wallet_address": wallet, "signature": sig, "timestamp": ts}


@pytest.fixture
async def seeded_channel(db_session):
    creator = Creator(id=Account.create().address and __import__("uuid").uuid4(), email="c@example.com", handle="creator")
    channel = Channel(id=__import__("uuid").uuid4(), creator_id=creator.id, handle="alice", signing_key="sk")
    db_session.add_all([creator, channel])
    await db_session.commit()
    return channel


async def test_subscribe_returns_fan_id(api_client, seeded_channel):
    acct = Account.create()
    resp = await api_client.post("/api/v1/subscribe", json=_signed_body("alice", acct))
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "wallet" not in str(data) and "@" not in str(data).replace("alice", "")


async def test_subscribe_is_idempotent(api_client, seeded_channel):
    acct = Account.create()
    r1 = await api_client.post("/api/v1/subscribe", json=_signed_body("alice", acct))
    r2 = await api_client.post("/api/v1/subscribe", json=_signed_body("alice", acct))
    assert r1.json()["fan_id"] == r2.json()["fan_id"]


async def test_subscribe_rejects_bad_signature(api_client, seeded_channel):
    acct, other = Account.create(), Account.create()
    body = _signed_body("alice", acct)
    body["wallet_address"] = other.address.lower()  # sig no longer matches wallet
    resp = await api_client.post("/api/v1/subscribe", json=body)
    assert resp.status_code == 401


async def test_subscribe_rejects_stale_timestamp(api_client, seeded_channel):
    acct = Account.create()
    body = _signed_body("alice", acct)
    body["timestamp"] -= 3600
    resp = await api_client.post("/api/v1/subscribe", json=body)
    assert resp.status_code == 401


async def test_subscribe_unknown_channel_404(api_client, seeded_channel):
    acct = Account.create()
    resp = await api_client.post("/api/v1/subscribe", json=_signed_body("nobody", acct))
    assert resp.status_code == 404


async def test_unsubscribe_flips_status(api_client, db_session, seeded_channel):
    acct = Account.create()
    await api_client.post("/api/v1/subscribe", json=_signed_body("alice", acct))
    resp = await api_client.post("/api/v1/unsubscribe", json=_signed_body("alice", acct, action="unsubscribe"))
    assert resp.status_code == 200 and resp.json()["success"] is True
    from app.db.repositories import AnonymousLinkRepo
    link = await AnonymousLinkRepo(db_session).get_by_channel_and_fan(seeded_channel.id, (await _fan_id(db_session, acct)))
    assert link.status == "opted_out"


async def _fan_id(db_session, acct):
    from app.db.repositories import FanRepo
    fan = await FanRepo(db_session).get_by_wallet(acct.address.lower())
    return fan.id
```

(Write the fixture cleanly — no `__import__` hacks: import `uuid` at top and create `Creator`/`Channel` with explicit UUIDs. Shown shape is binding: signed-body helper + these six cases.)

- [ ] **Step 11: Run full suite**

Run: `cd backend && python -m pytest -v`
Expected: PASS — old phone/PIN subscription tests replaced; all other suites green. If `test_channels.py` or others still reference `SubscribeRequest(pin=...)`, update only that reference to `SignedFanRequest`.

- [ ] **Step 12: Commit**

```bash
git add backend/ && git commit -m "feat: wallet-signed subscribe/unsubscribe with EIP-191 verification"
```

---

### Task 19: Remove phone/PIN machinery + schema constraints

**Files:**
- Create: `backend/supabase/migrations/0004_pivot_removals.sql`
- Delete: `backend/app/services/crypto_service.py`, `backend/app/services/pin_service.py`, `backend/tests/test_crypto.py`, `backend/tests/test_pin_service.py`
- Modify: `backend/app/db/models.py` (drop EncryptedPhone; Channel: drop `pin_hash`, rename `sms_sent_this_period`→`pings_sent_this_period`, `creator_id` unique)
- Modify: `backend/app/db/repositories.py` (drop EncryptedPhoneRepo, `set_pin_hash`, EncryptedPhone import; AnonymousLink: drop wallet_address param)
- Modify: `backend/app/api/channels.py` (drop `POST /{id}/pin`), `backend/app/models/schemas.py` (drop PinSet*, phone validators, `Channel.pin_hash`/`sms_sent_this_period`, `AnonymousLink.wallet_address`)
- Modify: `backend/app/core/config.py` (drop `twilio_*`, `phone_encryption_key`, `privy_app_id`, `privy_app_secret`)
- Modify: `backend/pyproject.toml` (remove `cryptography`, `bcrypt` after verifying no remaining imports: `rg "bcrypt|cryptography" backend/app backend/tests`)
- Modify: `backend/supabase/migrations/0002_rls_policies.sql` (drop policies referencing `encrypted_phones`)
- Modify: `backend/tests/test_channels.py`, `backend/tests/test_repositories.py`, `backend/tests/test_schema.sql`, `backend/tests/test_schemas.py` (remove/adjust affected cases)
- Test: full suite must stay green

**Interfaces:**
- Produces: `channels.pings_sent_this_period` (quota counter, consumed by Task 23), `channels.creator_id` UNIQUE, schema of record = migrations 0001+0003+0004

- [ ] **Step 1: Write failing cleanup tests**

`backend/tests/test_channels.py` — add:

```python
async def test_pin_endpoint_removed(api_client, auth_headers, seeded_channel):
    resp = await api_client.post(
        f"/api/v1/channels/{seeded_channel.id}/pin", json={"pin": "123456"},
        headers=auth_headers,
    )
    assert resp.status_code == 405  # route gone
```

(`auth_headers`/`seeded_channel` fixtures already exist in that file from Task 7.)

- [ ] **Step 2: Verify failure**

Run: `cd backend && python -m pytest tests/test_channels.py -v` → FAIL (endpoint still exists)

- [ ] **Step 3: Write migration `0004_pivot_removals.sql`**

```sql
-- ADR 0006: remove phone/PIN machinery; enforce one channel per creator;
-- rename the SMS counter to the product-quota counter.
DROP TABLE IF EXISTS encrypted_phones;
ALTER TABLE channels DROP COLUMN IF EXISTS pin_hash;
ALTER TABLE anonymous_links DROP COLUMN IF EXISTS wallet_address;
ALTER TABLE channels ADD CONSTRAINT uq_channels_creator UNIQUE (creator_id);
ALTER TABLE channels RENAME COLUMN sms_sent_this_period TO pings_sent_this_period;
```

- [ ] **Step 4: Delete code and prune references**

- Delete the four files listed above.
- `models.py`: remove `EncryptedPhone` class + `LargeBinary` import if unused; `Channel`: remove `pin_hash`, rename field, add `unique=True` to `creator_id` mapped_column; `AnonymousLink`: remove `wallet_address` field + `UniqueConstraint("channel_id", "wallet_address")`.
- `repositories.py`: remove `EncryptedPhoneRepo`, `set_pin_hash`, `EncryptedPhone` import; `AnonymousLinkRepo.create` drops `wallet_address` param.
- `channels.py`: remove the PIN rotation route.
- `schemas.py`: remove `PinSetRequest`, `PinSetResponse`, `Channel.pin_hash`, rename `Channel.sms_sent_this_period`, remove `AnonymousLink.wallet_address`.
- `config.py`: remove the four settings groups.
- `0002_rls_policies.sql`: delete any policy/statement mentioning `encrypted_phones`.
- `test_schema.sql`: update DDL/RLS assertions to match migrations 0001+0003+0004 (drop encrypted_phones + pin_hash + anonymous_links.wallet_address sections; add `fans.wallet_address`, `uq_channels_creator`, renamed column).

- [ ] **Step 5: Run full suite**

Run: `cd backend && python -m pytest -v` → PASS (all crypto/pin/phone tests were deleted with their subjects)

- [ ] **Step 6: Verify no residue**

Run: `cd backend && rg -i "encrypted_phone|pin_hash|twilio|phone_encryption|PinSet|sms_sent" app tests supabase` → only hits allowed: migration 0004 comments, `0004_pivot_removals.sql`, `test_schema.sql` comments about removals.

- [ ] **Step 7: Commit**

```bash
git add -A backend/ && git commit -m "feat!: drop phone/PIN machinery, add one-channel constraint (ADR 0006)"
```

---

### Task 20: Device tokens API

**Files:**
- Create: `backend/supabase/migrations/0005_device_tokens.sql`
- Create: `backend/app/api/devices.py`
- Modify: `backend/app/db/models.py` (+`DeviceToken`), `backend/app/db/repositories.py` (+`DeviceTokenRepo`), `backend/app/models/schemas.py` (+request/response models), `backend/app/main.py` (+router)
- Test: `backend/tests/test_devices.py`

**Interfaces:**
- Consumes: `canonical_message`/`verify_signature`/`is_fresh` (Task 18), `FanRepo.get_by_wallet`
- Produces: `POST /api/v1/devices`, `POST /api/v1/devices/revoke`, `DeviceTokenRepo.list_by_fan(fan_id) -> list[DeviceToken]` (worker, Task 22)

- [ ] **Step 1: Write failing tests** — `backend/tests/test_devices.py`

```python
# backend/tests/test_devices.py
import time

import pytest
from eth_account import Account
from eth_account.messages import encode_defunct

from app.db.models import Channel, Creator
import uuid


def _signed(acct, action: str, extra: str) -> dict:
    ts = int(time.time())
    wallet = acct.address.lower()
    msg = f"PIN:{action}:{wallet}:{extra.lower()}:{ts}"
    sig = Account.sign_message(encode_defunct(text=msg), acct.key).signature.hex()
    return {"wallet_address": wallet, "signature": sig, "timestamp": ts}


@pytest.fixture
def acct():
    return Account.create()


@pytest.fixture
async def seeded_channel(db_session):
    creator = Creator(id=uuid.uuid4(), email="c@example.com", handle="creator")
    channel = Channel(id=uuid.uuid4(), creator_id=creator.id, handle="alice", signing_key="sk")
    db_session.add_all([creator, channel])
    await db_session.commit()
    return channel


async def test_register_device(api_client, db_session, acct):
    body = {"token": "device-123", "platform": "web", **_signed(acct, "device", "device-123")}
    resp = await api_client.post("/api/v1/devices", json=body)
    assert resp.status_code == 200 and resp.json()["success"] is True
    from app.db.repositories import DeviceTokenRepo, FanRepo
    fan = await FanRepo(db_session).get_by_wallet(acct.address.lower())
    tokens = await DeviceTokenRepo(db_session).list_by_fan(fan.id)
    assert [t.token for t in tokens] == ["device-123"]


async def test_register_device_upserts(api_client, db_session, acct):
    body = {"token": "device-123", "platform": "web", **_signed(acct, "device", "device-123")}
    await api_client.post("/api/v1/devices", json=body)
    body2 = {"token": "device-123", "platform": "ios", **_signed(acct, "device", "device-123")}
    resp = await api_client.post("/api/v1/devices", json=body2)
    assert resp.status_code == 200
    from app.db.repositories import DeviceTokenRepo, FanRepo
    fan = await FanRepo(db_session).get_by_wallet(acct.address.lower())
    tokens = await DeviceTokenRepo(db_session).list_by_fan(fan.id)
    assert len(tokens) == 1 and tokens[0].platform == "ios"


async def test_register_device_rejects_bad_signature(api_client, acct):
    body = {"token": "device-123", "platform": "web", **_signed(acct, "device", "OTHER")}
    resp = await api_client.post("/api/v1/devices", json=body)
    assert resp.status_code == 401


async def test_register_device_rejects_bad_platform(api_client, acct):
    body = {"token": "d", "platform": "blackberry", **_signed(acct, "device", "d")}
    resp = await api_client.post("/api/v1/devices", json=body)
    assert resp.status_code == 422


async def test_revoke_device(api_client, db_session, acct):
    body = {"token": "device-123", "platform": "web", **_signed(acct, "device", "device-123")}
    await api_client.post("/api/v1/devices", json=body)
    resp = await api_client.post(
        "/api/v1/devices/revoke", json=_signed(acct, "device-revoke", "device-123")
    )
    assert resp.status_code == 200 and resp.json()["success"] is True
    from app.db.repositories import DeviceTokenRepo, FanRepo
    fan = await FanRepo(db_session).get_by_wallet(acct.address.lower())
    assert await DeviceTokenRepo(db_session).list_by_fan(fan.id) == []


async def test_revoke_unknown_token_is_idempotent(api_client, acct):
    resp = await api_client.post(
        "/api/v1/devices/revoke", json=_signed(acct, "device-revoke", "ghost")
    )
    assert resp.status_code == 200 and resp.json()["success"] is True
```

- [ ] **Step 2: Verify failure**

Run: `cd backend && python -m pytest tests/test_devices.py -v` → FAIL (404 route)

- [ ] **Step 3: Migration `0005_device_tokens.sql`**

```sql
-- ADR 0006 zone 3: pseudonymous routing data only. RLS enabled with no
-- policies -> service-role/API path only (defense-in-depth).
CREATE TABLE device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fan_id UUID NOT NULL REFERENCES fans(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,       -- OneSignal.User.onesignalId
    platform TEXT NOT NULL DEFAULT 'web',  -- web, ios, android
    created_at TIMESTAMPTZ DEFAULT now(),
    last_seen_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_device_tokens_fan ON device_tokens(fan_id);
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 4: Model + repo**

```python
class DeviceToken(Base):
    __tablename__ = "device_tokens"
    __table_args__ = (Index("idx_device_tokens_fan", "fan_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    fan_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("fans.id", ondelete="CASCADE"), nullable=False
    )
    token: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    platform: Mapped[str] = mapped_column(Text, default="web", server_default="web", nullable=False)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

`DeviceTokenRepo` (follow the `commit: bool = True` / `_commit` / flush pattern in `repositories.py`):

```python
class DeviceTokenRepo:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def upsert(self, fan_id, token: str, platform: str, commit: bool = True) -> DeviceToken:
        res = await self._session.execute(select(DeviceToken).where(DeviceToken.token == token))
        row = res.scalar_one_or_none()
        if row is None:
            row = DeviceToken(fan_id=_to_uuid(fan_id), token=token, platform=platform)
            self._session.add(row)
        else:
            row.fan_id = _to_uuid(fan_id)
            row.platform = platform
            row.last_seen_at = func.now()
        if commit:
            await _commit(self._session)
            await self._session.refresh(row)
        else:
            await self._session.flush()
        return row

    async def list_by_fan(self, fan_id) -> list[DeviceToken]:
        res = await self._session.execute(
            select(DeviceToken).where(DeviceToken.fan_id == _to_uuid(fan_id))
        )
        return list(res.scalars().all())

    async def delete_for_fan(self, token: str, fan_id, commit: bool = True) -> bool:
        res = await self._session.execute(
            select(DeviceToken).where(DeviceToken.token == token, DeviceToken.fan_id == _to_uuid(fan_id))
        )
        row = res.scalar_one_or_none()
        if row is None:
            return False
        await self._session.delete(row)
        if commit:
            await _commit(self._session)
        else:
            await self._session.flush()
        return True
```

- [ ] **Step 5: Schemas + API**

```python
# schemas.py
class DeviceRegisterRequest(BaseModel):
    token: str = Field(min_length=1, max_length=512)
    platform: str = Field(default="web", pattern=r"^(web|ios|android)$")
    wallet_address: str = Field(pattern=r"^0x[0-9a-fA-F]{40}$")
    signature: str = Field(min_length=2, max_length=1024)
    timestamp: int

    @field_validator("wallet_address")
    @classmethod
    def normalize_wallet(cls, v: str) -> str:
        return v.lower()


class DeviceRevokeRequest(BaseModel):
    token: str = Field(min_length=1, max_length=512)
    wallet_address: str = Field(pattern=r"^0x[0-9a-fA-F]{40}$")
    signature: str = Field(min_length=2, max_length=1024)
    timestamp: int

    @field_validator("wallet_address")
    @classmethod
    def normalize_wallet(cls, v: str) -> str:
        return v.lower()


class DeviceResponse(BaseModel):
    success: bool = True
```

```python
# backend/app/api/devices.py
router = APIRouter(prefix="/api/v1", tags=["devices"])


async def _verify_fan(req, action: str, session: AsyncSession):
    if not is_fresh(req.timestamp):
        raise HTTPException(status_code=401, detail="Invalid signature")
    message = canonical_message(action, [req.wallet_address, req.token], req.timestamp)
    if not verify_signature(message, req.signature, req.wallet_address):
        raise HTTPException(status_code=401, detail="Invalid signature")
    return await FanRepo(session).get_by_wallet(req.wallet_address)


@router.post("/devices", response_model=DeviceResponse)
async def register_device(req: DeviceRegisterRequest, session: Annotated[AsyncSession, Depends(get_session)]):
    fan = await _verify_fan(req, "device", session)
    if fan is None:
        fan = await FanRepo(session).create(wallet_address=req.wallet_address, commit=False)
        await session.commit()
    await DeviceTokenRepo(session).upsert(fan.id, req.token, req.platform)
    return DeviceResponse(success=True)


@router.post("/devices/revoke", response_model=DeviceResponse)
async def revoke_device(req: DeviceRevokeRequest, session: Annotated[AsyncSession, Depends(get_session)]):
    fan = await _verify_fan(req, "device-revoke", session)
    if fan is not None:
        await DeviceTokenRepo(session).delete_for_fan(req.token, fan.id)
    return DeviceResponse(success=True)  # idempotent
```

Register both routes in `create_app()` (`main.py`).

- [ ] **Step 6: Run suite** → `cd backend && python -m pytest -v` PASS

- [ ] **Step 7: Commit**

```bash
git add backend/ && git commit -m "feat: add device token registration and revoke (signed, wallet-keyed)"
```

---

## Phase B — Delivery Pipeline (queue, worker, pings, go-live)

### Task 21: QStash queue + fan-out service

**Files:**
- Create: `backend/app/services/queue_service.py`, `backend/app/services/fanout_service.py`
- Modify: `backend/app/core/config.py` (+`public_api_url: str = ""`), `backend/app/db/repositories.py` (+`MessageQueueJobRepo`)
- Test: `backend/tests/test_queue.py`, `backend/tests/test_fanout.py`

**Interfaces:**
- Consumes: `QueueProvider` shape (ports.py), `AnonymousLinkRepo.list_active_fan_ids` (exists)
- Produces:
  - `queue_service.publish(path: str, body: dict) -> str` (returns QStash messageId)
  - `fanout_service.fanout_ping(session, ping_id, channel_id, message, kind) -> int` (returns recipient count; commits jobs; enqueues after commit)
  - `MessageQueueJobRepo.create(ping_id, channel_id, fan_id, delivery_method, payload, idempotency_key, commit=True)` and `MessageQueueJobRepo.get_by_idempotency_key(key) -> MessageQueueJob | None`

- [ ] **Step 1: Write failing tests** — `backend/tests/test_queue.py`, `backend/tests/test_fanout.py`

```python
# backend/tests/test_queue.py
import pytest
from unittest.mock import AsyncMock, patch

from app.services.queue_service import publish


@pytest.mark.asyncio
async def test_publish_posts_to_qstash_with_auth():
    mock_resp = AsyncMock()
    mock_resp.json.return_value = {"messageId": "msg_1"}
    mock_resp.raise_for_status.return_value = None
    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.post.return_value = mock_resp
    with patch("app.services.queue_service.httpx.AsyncClient", return_value=mock_client), \
         patch("app.services.queue_service.settings") as s:
        s.public_api_url = "https://api.example.com"
        s.upstash_qstash_token = "tok"
        msg_id = await publish("/api/v1/worker/deliver", {"a": 1})
    assert msg_id == "msg_1"
    url = mock_client.post.call_args.args[0]
    assert url == "https://qstash.upstash.io/v2/publish/https://api.example.com/api/v1/worker/deliver"
    assert mock_client.post.call_args.kwargs["headers"] == {"Authorization": "Bearer tok"}
    assert mock_client.post.call_args.kwargs["json"] == {"a": 1}
```

```python
# backend/tests/test_fanout.py
import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.db.models import Channel, Creator, Ping
from app.services.fanout_service import fanout_ping


@pytest.fixture
async def seeded(db_session):
    creator = Creator(id=uuid.uuid4(), email="c@example.com", handle="c")
    channel = Channel(id=uuid.uuid4(), creator_id=creator.id, handle="alice", signing_key="sk")
    db_session.add_all([creator, channel])
    await db_session.flush()
    ping = Ping(id=uuid.uuid4(), channel_id=channel.id, message="hi", delivery_method="push")
    db_session.add(ping)
    await db_session.commit()
    return channel, ping


async def test_fanout_creates_one_job_per_active_fan(db_session, seeded):
    from app.db.repositories import AnonymousLinkRepo, FanRepo
    channel, ping = seeded
    f1 = await FanRepo(db_session).create(wallet_address="0x" + "11" * 20)
    f2 = await FanRepo(db_session).create(wallet_address="0x" + "22" * 20)
    f3 = await FanRepo(db_session).create(wallet_address="0x" + "33" * 20)
    links = AnonymousLinkRepo(db_session)
    await links.create(channel_id=channel.id, fan_id=f1.id)
    await links.create(channel_id=channel.id, fan_id=f2.id)
    await links.create(channel_id=channel.id, fan_id=f3.id)
    await links.set_opted_out(channel.id, f3.id)

    with patch("app.services.fanout_service.publish", new_callable=AsyncMock) as pub:
        count = await fanout_ping(db_session, ping.id, channel.id, "hi", "message")

    assert count == 2
    assert pub.call_count == 2
    from app.db.repositories import MessageQueueJobRepo
    job = await MessageQueueJobRepo(db_session).get_by_idempotency_key(f"{ping.id}:{f1.id}:push")
    assert job is not None and job.status == "queued"
    assert job.payload == {"message": "hi", "kind": "message"}
```

- [ ] **Step 2: Verify failure** → `python -m pytest tests/test_queue.py tests/test_fanout.py -v` FAIL

- [ ] **Step 3: Implement**

```python
# backend/app/services/queue_service.py
import httpx

from app.core.config import settings


async def publish(path: str, body: dict) -> str:
    """Publish one QStash message whose destination is public_api_url + path."""
    destination = f"{settings.public_api_url}{path}"
    url = f"https://qstash.upstash.io/v2/publish/{destination}"
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            url,
            json=body,
            headers={"Authorization": f"Bearer {settings.upstash_qstash_token}"},
        )
        resp.raise_for_status()
        return resp.json().get("messageId", "")
```

```python
# backend/app/services/fanout_service.py
# Fan-out: create jobs in ONE transaction, then enqueue (ADR 0004 flow).
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories import AnonymousLinkRepo, MessageQueueJobRepo
from app.services.queue_service import publish


async def fanout_ping(
    session: AsyncSession,
    ping_id: str | uuid.UUID,
    channel_id: str | uuid.UUID,
    message: str,
    kind: str,
) -> int:
    fan_ids = await AnonymousLinkRepo(session).list_active_fan_ids(channel_id)
    bodies: list[dict] = []
    jobs = MessageQueueJobRepo(session)
    for fan_id in fan_ids:
        key = f"{ping_id}:{fan_id}:push"
        await jobs.create(
            ping_id=ping_id,
            channel_id=channel_id,
            fan_id=fan_id,
            delivery_method="push",
            payload={"message": message, "kind": kind},
            idempotency_key=key,
            commit=False,
        )
        bodies.append(
            {
                "ping_id": str(ping_id),
                "channel_id": str(channel_id),
                "fan_id": str(fan_id),
                "message": message,
                "kind": kind,
                "idempotency_key": key,
            }
        )
    await session.commit()
    for body in bodies:
        await publish("/api/v1/worker/deliver", body)
    return len(bodies)
```

`MessageQueueJobRepo` — mirror existing repo patterns exactly (import `MessageQueueJob` from models; `_commit`; `get_by_idempotency_key` via `select(...).where(idempotency_key == key)`; `claim(key) -> bool` helper for Task 22: `UPDATE`-style `update(MessageQueueJob).where(key, status=="queued").values(status="processing")` returning `rowcount > 0`; `mark(key, status, error=None)` setting status + `processed_at` when terminal).

- [ ] **Step 4: Verify pass** → both files PASS

- [ ] **Step 5: Commit**

```bash
git add backend/ && git commit -m "feat: add QStash publish + transactional ping fan-out"
```

---

### Task 22: OneSignal provider + delivery worker

**Files:**
- Create: `backend/app/services/onesignal_provider.py`, `backend/app/services/rate_limiter.py`, `backend/app/api/worker.py`
- Modify: `backend/app/main.py` (router), `backend/app/db/repositories.py` (PingRepo job-result helper)
- Modify: `backend/pyproject.toml` (dev: `fakeredis>=2.23`)
- Test: `backend/tests/test_onesignal.py`, `backend/tests/test_worker.py`

**Interfaces:**
- Consumes: `PushProvider`/`SendResult` (`app/core/ports.py`), `MessageQueueJobRepo.claim/mark`, `AnonymousLinkRepo.list/get_by_channel_and_fan`, `DeviceTokenRepo.list_by_fan` (Task 20), `PingRepo.update_counts` (exists)
- Produces: `POST /api/v1/worker/deliver` body `{ping_id, channel_id, fan_id, message, kind, idempotency_key}` → `{"status": one_of["sent","duplicate","opted_out","skipped","failed"]}`; `rate_limiter.acquire_slot(channel_id, max_per_minute=120) -> bool`; `OneSignalProvider.send(player_ids, message) -> SendResult`

- [ ] **Step 1: Write failing provider test** — `backend/tests/test_onesignal.py`

```python
from unittest.mock import AsyncMock, patch

import pytest

from app.services.onesignal_provider import OneSignalProvider


@pytest.mark.asyncio
async def test_send_success():
    mock_resp = AsyncMock(status_code=200)
    mock_resp.json.return_value = {"id": "notif-1", "errors": []}
    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.post.return_value = mock_resp
    with patch("app.services.onesignal_provider.httpx.AsyncClient", return_value=mock_client), \
         patch("app.services.onesignal_provider.settings") as s:
        s.onesignal_app_id = "app-id"
        s.onesignal_rest_api_key = "key"
        result = await OneSignalProvider().send(["dev-1"], "hello")
    assert result.success is True and result.provider_id == "notif-1"
    kwargs = mock_client.post.call_args
    assert kwargs.args[0] == "https://api.onesignal.com/notifications"
    assert kwargs.kwargs["headers"] == {"Authorization": "Key key"}
    assert kwargs.kwargs["json"] == {
        "app_id": "app-id",
        "target_channel": "push",
        "include_aliases": {"onesignal_id": ["dev-1"]},
        "contents": {"en": "hello"},
    }


@pytest.mark.asyncio
async def test_send_reports_errors():
    mock_resp = AsyncMock(status_code=200)
    mock_resp.json.return_value = {"id": None, "errors": {"invalid_player_ids": ["x"]}}
    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.post.return_value = mock_resp
    with patch("app.services.onesignal_provider.httpx.AsyncClient", return_value=mock_client), \
         patch("app.services.onesignal_provider.settings"):
        result = await OneSignalProvider().send(["x"], "hello")
    assert result.success is False and "invalid_player_ids" in (result.error or "")
```

- [ ] **Step 2: Rate limiter test** (same file or `test_rate_limiter.py`)

```python
import fakeredis.aioredis

from app.services import rate_limiter


async def test_acquire_slot_limits_per_window(monkeypatch):
    fake = fakeredis.aioredis.FakeRedis()
    monkeypatch.setattr(rate_limiter, "_redis", fake)
    assert all([await rate_limiter.acquire_slot("ch1", max_per_minute=3) for _ in range(3)])
    assert await rate_limiter.acquire_slot("ch1", max_per_minute=3) is False
    assert await rate_limiter.acquire_slot("ch2", max_per_minute=3) is True
```

- [ ] **Step 3: Verify failure** → FAIL (modules missing)

- [ ] **Step 4: Implement provider + rate limiter**

```python
# backend/app/services/onesignal_provider.py
import httpx

from app.core.config import settings
from app.core.ports import SendResult


class OneSignalProvider:
    async def send(self, player_ids: list[str], message: str) -> SendResult:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    "https://api.onesignal.com/notifications",
                    headers={"Authorization": f"Key {settings.onesignal_rest_api_key}"},
                    json={
                        "app_id": settings.onesignal_app_id,
                        "target_channel": "push",
                        "include_aliases": {"onesignal_id": player_ids},
                        "contents": {"en": message},
                    },
                )
            data = resp.json() if resp.status_code == 200 else {}
            if resp.status_code == 200 and not data.get("errors"):
                return SendResult(success=True, provider_id=data.get("id"))
            return SendResult(
                success=False,
                error=str(data.get("errors") or f"HTTP {resp.status_code}"),
            )
        except Exception as exc:  # network errors must not crash the worker
            return SendResult(success=False, error=str(exc))
```

```python
# backend/app/services/rate_limiter.py
# Per-channel sliding window (INCR + EXPIRE). Pacing, not a security
# control -- atomic Lua is unnecessary (ADR 0004).
import redis.asyncio as aioredis

from app.core.config import settings

_redis: aioredis.Redis | None = None


def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.upstash_redis_url, decode_responses=True)
    return _redis


async def acquire_slot(channel_id: str, max_per_minute: int = 120) -> bool:
    key = f"ratelimit:channel:{channel_id}"
    redis = _get_redis()
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, 60)
    return count <= max_per_minute
```

Note: tests monkeypatch module attr `_redis` directly — structure the limiter so `_get_redis` reads `_redis` each call (module-global read, no caching past it).

- [ ] **Step 5: Worker endpoint + failing tests first** — `backend/tests/test_worker.py`

Fixtures (in the test module): seeded channel + active fan + fan device token + ping + job row with status `queued` and matching idempotency key (create via repos directly); `patch` `app.api.worker.get_push_provider` to return an AsyncMock whose `send` returns `SendResult(success=True, provider_id="n1")`; `patch` `app.api.worker.acquire_slot` → `AsyncMock(return_value=True)`.

Cases:
1. happy path → 200 `{"status":"sent"}`; job row `sent`, `processed_at` set; ping `sent_count == 1`
2. second call same key → `{"status":"duplicate"}` (job already not `queued`)
3. link `opted_out` → `{"status":"opted_out"}`, job `opted_out`, ping `failed_count == 1`
4. fan has no device tokens → `{"status":"skipped"}`, job `skipped`
5. provider returns `SendResult(success=False, error="boom")` → `{"status":"failed"}`, job `failed` + `error_message=="boom"`
6. `acquire_slot` False → **503** (QStash retries; job untouched, still `queued`)
7. ping `total_recipients==1` + terminal result → ping `status=="completed"`, `completed_at` set

- [ ] **Step 6: Implement worker**

```python
# backend/app/api/worker.py
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ports import PushProvider, SendResult
from app.db.repositories import (
    AnonymousLinkRepo,
    DeviceTokenRepo,
    MessageQueueJobRepo,
    PingRepo,
)
from app.db.session import get_session
from app.services.onesignal_provider import OneSignalProvider
from app.services.rate_limiter import acquire_slot

router = APIRouter(prefix="/api/v1/worker", tags=["worker"])


class DeliverJob(BaseModel):
    ping_id: str
    channel_id: str
    fan_id: str
    message: str
    kind: str = "message"
    idempotency_key: str


def get_push_provider() -> PushProvider:
    return OneSignalProvider()


async def _finish_ping(session: AsyncSession, ping_id: str) -> None:
    repo = PingRepo(session)
    ping = await repo.get(ping_id)
    if ping is None:
        return
    done = (ping.sent_count or 0) + (ping.failed_count or 0)
    if ping.total_recipients and done >= ping.total_recipients:
        await repo.update_counts(ping_id, status="completed")


async def _bump(session: AsyncSession, ping_id: str, delivered: bool) -> None:
    repo = PingRepo(session)
    ping = await repo.get(ping_id)
    if ping is None:
        return
    sent = (ping.sent_count or 0) + (1 if delivered else 0)
    failed = (ping.failed_count or 0) + (0 if delivered else 1)
    await repo.update_counts(ping_id, sent_count=sent, failed_count=failed)
    await _finish_ping(session, ping_id)


@router.post("/deliver")
async def deliver(job: DeliverJob, session: Annotated[AsyncSession, Depends(get_session)]):
    if not await acquire_slot(job.channel_id):
        raise HTTPException(status_code=503, detail="Rate limited")  # QStash retries
    jobs = MessageQueueJobRepo(session)
    if not await jobs.claim(job.idempotency_key):
        return {"status": "duplicate"}
    link = await AnonymousLinkRepo(session).get_by_channel_and_fan(job.channel_id, job.fan_id)
    if link is None or link.status != "active":
        await jobs.mark(job.idempotency_key, "opted_out")
        await _bump(session, job.ping_id, delivered=False)
        return {"status": "opted_out"}
    tokens = await DeviceTokenRepo(session).list_by_fan(_uuid(job.fan_id))
    if not tokens:
        await jobs.mark(job.idempotency_key, "skipped")
        await _bump(session, job.ping_id, delivered=False)
        return {"status": "skipped"}
    result: SendResult = await get_push_provider().send([t.token for t in tokens], job.message)
    if result.success:
        await jobs.mark(job.idempotency_key, "sent")
        await _bump(session, job.ping_id, delivered=True)
        return {"status": "sent"}
    await jobs.mark(job.idempotency_key, "failed", error=result.error)
    await _bump(session, job.ping_id, delivered=False)
    return {"status": "failed"}
```

(`_uuid = uuid.UUID(str)` helper; `mark(key, status, error=None)` sets `processed_at` for terminal statuses. Add `Annotated` import.)

Register `worker_router` in `create_app()`.

- [ ] **Step 7: Run suite** → PASS (including existing 80 tests)

- [ ] **Step 8: Commit**

```bash
git add backend/ && git commit -m "feat: OneSignal push provider, rate limiter, and delivery worker"
```

---

### Task 23: Ping creation with quota + stats

**Files:**
- Create: `backend/app/api/pings.py`, `backend/app/services/quota_service.py`
- Modify: `backend/app/db/models.py` (+`Ping.kind`), `backend/app/db/repositories.py` (PingRepo.create gains `kind`, `status`, `commit` params; AnonymousLinkRepo +`count_active(channel_id)`), `backend/app/models/schemas.py` (PingCreate rewrite, ChannelStatsResponse), `backend/app/main.py`
- Create: `backend/supabase/migrations/0006_ping_kind.sql`
- Test: `backend/tests/test_pings.py`

**Interfaces:**
- Consumes: creator auth (`app/core/auth.get_current_creator_id`/`get_current_creator`), `quota_service.check_and_consume_quota`, `fanout_service.fanout_ping` (Task 21), `ChannelRepo.get/get_by_creator`
- Produces: `POST /api/v1/pings` `{channel_id, message}` → `PingResponse`; `GET /api/v1/pings/{id}` → `PingResponse`; `GET /api/v1/channels/{id}/stats` → `{subscriber_count, pings_sent_this_period, monthly_ping_limit}`; `PingResponse {id, status, total_recipients, sent_count, failed_count}`

- [ ] **Step 1: Failing tests** — `backend/tests/test_pings.py`

Reuse the `auth_headers` + channel-fixture pattern from `backend/tests/test_channels.py` (synthesize HS256 token exactly as that file does). Seed 2 active fans + 1 opted-out fan via repos. Mock `app.api.pings.fanout_ping` with `AsyncMock(return_value=2)`.

```python
# backend/tests/test_pings.py
import uuid
import pytest
from unittest.mock import patch, AsyncMock

from app.db.repositories import ChannelRepo, CreatorRepo, AnonymousLinkRepo, DeviceTokenRepo

# Fixtures — defined in this file to avoid cross-test dependencies
TEST_SECRET = "test-supabase-jwt-secret-do-not-use-in-prod"
AUDIENCE = "authenticated"

def mint_token(sub: str | None = None, email: str = "creator@example.com", *, secret: str = TEST_SECRET) -> str:
    import jwt
    payload = {"sub": sub or str(uuid.uuid4()), "aud": AUDIENCE}
    if email: payload["email"] = email
    return jwt.encode(payload, secret, algorithm="HS256")

def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def auth_headers():
    return bearer(mint_token())

@pytest.fixture
def auth_headers2():
    return bearer(mint_token(email="other@example.com"))

@pytest.fixture
async def seeded_channel_with_fans(db_session):
    creator = await CreatorRepo(db_session).create(
        email="c@example.com", handle="testchan"
    )
    channel = await ChannelRepo(db_session).create(
        creator_id=creator.id, handle="testchan", signing_key="sk_test_123"
    )
    # 2 active fans with device tokens (for fanout)
    for i in range(2):
        fan = await AnonymousLinkRepo(db_session).create(
            channel_id=channel.id, wallet_address=f"0x{i:040x}", status="active"
        )
        await DeviceTokenRepo(db_session).upsert(fan.id, f"onesignal_token_{i}")
    # 1 opted-out fan (should be skipped by worker)
    fan3 = await AnonymousLinkRepo(db_session).create(
        channel_id=channel.id, wallet_address="0x3" + "0"*39, status="opted_out"
    )
    return channel
```
    with patch("app.api.pings.fanout_ping", new_callable=AsyncMock, return_value=2):
        resp = await api_client.post(
            "/api/v1/pings",
            json={"channel_id": str(seeded_channel_with_fans.id), "message": "Show at 5PM!"},
            headers=auth_headers,
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "queued" and data["total_recipients"] == 2


async def test_ping_over_quota_402(api_client, auth_headers, seeded_channel_with_fans):
    seeded_channel_with_fans.monthly_ping_limit = 0
    await seeded_channel_with_fans.__class__  # flush via session fixture
    resp = await api_client.post(
        "/api/v1/pings",
        json={"channel_id": str(seeded_channel_with_fans.id), "message": "hi"},
        headers=auth_headers,
    )
    assert resp.status_code == 402


async def test_ping_forbidden_other_creator(api_client, auth_headers2, seeded_channel_with_fans):
    resp = await api_client.post(
        "/api/v1/pings",
        json={"channel_id": str(seeded_channel_with_fans.id), "message": "hi"},
        headers=auth_headers2,
    )
    assert resp.status_code == 403


async def test_ping_message_too_long_422(api_client, auth_headers, seeded_channel_with_fans):
    resp = await api_client.post(
        "/api/v1/pings",
        json={"channel_id": str(seeded_channel_with_fans.id), "message": "x" * 161},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_get_ping_and_stats(api_client, auth_headers, seeded_channel_with_fans):
    with patch("app.api.pings.fanout_ping", new_callable=AsyncMock, return_value=2):
        created = await api_client.post(
            "/api/v1/pings",
            json={"channel_id": str(seeded_channel_with_fans.id), "message": "hi"},
            headers=auth_headers,
        )
    ping_id = created.json()["id"]

    detail = await api_client.get(f"/api/v1/pings/{ping_id}", headers=auth_headers)
    assert detail.status_code == 200 and detail.json()["status"] == "queued"
    assert detail.json()["total_recipients"] == 2

    stats = await api_client.get(
        f"/api/v1/channels/{seeded_channel_with_fans.id}/stats", headers=auth_headers
    )
    assert stats.status_code == 200
    body = stats.json()
    assert body["pings_sent"] == 1 and body["fans"] >= 1


async def test_get_ping_not_found(api_client, auth_headers):
    resp = await api_client.get(f"/api/v1/pings/{uuid4()}", headers=auth_headers)
    assert resp.status_code == 404
```

- [ ] **Step 2: Verify failure** → FAIL (404)

- [ ] **Step 3: Migration `0006_ping_kind.sql`**

```sql
-- ADR 0006: pings are either creator messages or automatic go-live alerts.
ALTER TABLE pings ADD COLUMN kind TEXT NOT NULL DEFAULT 'message';
```

(+ `kind: Mapped[str] = mapped_column(Text, default="message", server_default="message", nullable=False)` on `Ping`.)

- [ ] **Step 4: Quota service**

```python
# backend/app/services/quota_service.py
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Channel

PERIOD_DAYS = 30


async def check_and_consume_quota(session: AsyncSession, channel: Channel) -> bool:
    """One ping slot per call. Returns False (no mutation) when exhausted."""
    now = datetime.now(timezone.utc)
    used = channel.pings_sent_this_period or 0
    start = channel.period_start
    if start is None or (now - start).days >= PERIOD_DAYS:
        used = 0
        channel.period_start = now
    limit = channel.monthly_ping_limit or 0
    if used >= limit:
        await session.rollback()  # discard the rollover write too
        return False
    channel.pings_sent_this_period = used + 1
    await session.commit()
    return True
```

- [ ] **Step 5: API**

```python
# backend/app/api/pings.py
router = APIRouter(prefix="/api/v1", tags=["pings"])


@router.post("/pings", response_model=PingResponse)
async def create_ping(
    req: PingCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    creator_id: Annotated[str, Depends(get_current_creator_id)],
):
    channel = await ChannelRepo(session).get(req.channel_id)
    if channel is None:
        raise HTTPException(status_code=404, detail="Channel not found")
    if str(channel.creator_id) != creator_id:
        raise HTTPException(status_code=403, detail="Not your channel")
    if not await check_and_consume_quota(session, channel):
        raise HTTPException(status_code=402, detail="Monthly quota exceeded")
    ping = await PingRepo(session).create(
        channel_id=channel.id, message=req.message, delivery_method="push",
        kind="message", status="processing", commit=False,
    )
    count = await fanout_ping(session, ping.id, channel.id, req.message, "message")
    await PingRepo(session).update_counts(ping.id, total_recipients=count, status="queued")
    return PingResponse(id=str(ping.id), status="queued", total_recipients=count)


@router.get("/pings/{ping_id}", response_model=PingResponse)
async def get_ping(ping_id, session=..., creator_id=Depends(get_current_creator_id)):
    ping = await PingRepo(session).get(ping_id)  # 404 if None
    channel = await ChannelRepo(session).get(ping.channel_id)
    if str(channel.creator_id) != creator_id: 403
    return PingResponse(id=str(ping.id), status=ping.status or "pending",
                        total_recipients=ping.total_recipients or 0,
                        sent_count=ping.sent_count or 0, failed_count=ping.failed_count or 0)


@router.get("/channels/{channel_id}/stats")
async def channel_stats(...):
    ownership 403; return {
        "subscriber_count": await AnonymousLinkRepo(session).count_active(channel.id),
        "pings_sent_this_period": channel.pings_sent_this_period or 0,
        "monthly_ping_limit": channel.monthly_ping_limit or 0,
    }
```

Schemas: `PingCreate {channel_id: str, message: str = Field(max_length=160)}` (delivery_method removed — always push), `PingResponse` gains `sent_count`/`failed_count`, `ChannelStatsResponse`. Register router.

- [ ] **Step 6: Run suite** → PASS

- [ ] **Step 7: Commit**

```bash
git add backend/ && git commit -m "feat: ping creation with tier quota, stats, and fan-out"
```

---

### Task 24: GO LIVE + Midnight notary stub

**Files:**
- Create: `backend/supabase/migrations/0007_go_live.sql`, `backend/app/services/notary_service.py`
- Modify: `backend/app/core/ports.py` (+`NotaryPort`), `backend/app/api/channels.py` (+`POST /{id}/live`, `GET /{id}`, `GET /mine`), `backend/app/api/worker.py` (+`POST /notary`), `backend/app/db/models.py` (Channel.is_live, live_since), `backend/app/models/schemas.py` (GoLiveResponse, ChannelStatusResponse), `backend/app/main.py` if needed
- Test: `backend/tests/test_go_live.py`

**Interfaces:**
- Consumes: `fanout_ping`, `queue_service.publish`, creator auth (Task 7), `PingRepo`
- Produces: `POST /api/v1/channels/{id}/live` `{live: bool}` → `{is_live}`; `GET /api/v1/channels/{id}` → `{id, handle, is_live, live_since}`; `GET /api/v1/channels/mine` → same shape or 404; `POST /api/v1/worker/notary` body `{event_id, channel_id, kind, timestamp}` → `{status}`; `NotaryPort.record_event(payload: dict) -> bool`; `notary_service.get_notary() -> NotaryPort`

- [ ] **Step 1: Failing tests** — `backend/tests/test_go_live.py`

```python
async def test_channels_mine(api_client, auth_headers, seeded_channel):
    resp = await api_client.get("/api/v1/channels/mine", headers=auth_headers)
    assert resp.status_code == 200 and resp.json()["handle"] == seeded_channel.handle
    assert resp.json()["is_live"] is False


async def test_channels_mine_no_channel(api_client, auth_headers):
    resp = await api_client.get("/api/v1/channels/mine", headers=auth_headers)
    assert resp.status_code == 404

```python
async def test_go_live_creates_alert_and_enqueues(api_client, auth_headers, seeded_channel):
    with patch("app.api.channels.fanout_ping", new_callable=AsyncMock, return_value=3), \
         patch("app.api.channels.publish", new_callable=AsyncMock) as pub:
        resp = await api_client.post(
            f"/api/v1/channels/{seeded_channel.id}/live", json={"live": True},
            headers=auth_headers,
        )
    assert resp.status_code == 200 and resp.json()["is_live"] is True
    assert pub.call_count == 1
    assert pub.call_args.args[0] == "/api/v1/worker/notary"
    notary_body = pub.call_args.args[1]
    assert notary_body["kind"] == "go_live" and notary_body["channel_id"] == str(seeded_channel.id)
    # a Ping row with kind='live' exists


async def test_go_live_twice_no_second_alert(api_client, auth_headers, seeded_channel):
    with patch("app.api.channels.fanout_ping", new_callable=AsyncMock, return_value=0), \
         patch("app.api.channels.publish", new_callable=AsyncMock):
        await api_client.post(f"/api/v1/channels/{seeded_channel.id}/live", json={"live": True}, headers=auth_headers)
        resp = await api_client.post(f"/api/v1/channels/{seeded_channel.id}/live", json={"live": True}, headers=auth_headers)
    assert resp.json()["is_live"] is True  # idempotent
    # fanout called exactly once


async def test_go_live_notary_failure_does_not_fail(api_client, auth_headers, seeded_channel):
    with patch("app.api.channels.fanout_ping", new_callable=AsyncMock, return_value=0), \
         patch("app.api.channels.publish", new_callable=AsyncMock, side_effect=RuntimeError("qstash down")):
        resp = await api_client.post(f"/api/v1/channels/{seeded_channel.id}/live", json={"live": True}, headers=auth_headers)
    assert resp.status_code == 200


async def test_go_live_off(api_client, auth_headers, seeded_channel): ...  # live:True then live:False -> is_live False, no publish


async def test_worker_notary_endpoint_calls_port(api_client):
    with patch("app.api.worker.get_notary") as g:
        g.return_value.record_event = AsyncMock(return_value=True)
        resp = await api_client.post("/api/v1/worker/notary",
            json={"event_id": "e1", "channel_id": "c1", "kind": "go_live", "timestamp": 1760000000})
    assert resp.status_code == 200 and resp.json()["status"] == "recorded"
    g.return_value.record_event.assert_awaited_once()


async def test_worker_notary_stub_failure_returns_accepted(api_client):
    with patch("app.api.worker.get_notary") as g:
        g.return_value.record_event = AsyncMock(side_effect=RuntimeError("midnight down"))
        resp = await api_client.post("/api/v1/worker/notary",
            json={"event_id": "e1", "channel_id": "c1", "kind": "go_live", "timestamp": 1760000000})
    assert resp.status_code == 200 and resp.json()["status"] == "accepted"
```

(Ownership/403 test: second creator's auth_headers → 403.)

- [ ] **Step 2: Verify failure** → FAIL

- [ ] **Step 3: Migration `0007_go_live.sql`**

```sql
ALTER TABLE channels ADD COLUMN is_live BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE channels ADD COLUMN live_since TIMESTAMPTZ;
```

(+ model fields `is_live` default False server_default `text("false")`… on SQLite use `server_default=text("0")`-compatible boolean: use `server_default=text("false")` fails on SQLite create_all — use `default=False` client-side + `server_default=text("false")` only if SQLite accepts; safest mirror rule from Task 4: `Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))` — verify with the suite, SQLite accepts `false` keyword in DDL since 3.23.)

- [ ] **Step 4: NotaryPort + stub**

```python
# ports.py (add)
class NotaryPort(Protocol):
    async def record_event(self, payload: dict) -> bool: ...
```

```python
# backend/app/services/notary_service.py
# ADR 0006 rule 5: best-effort sidecar. This stub logs the proof payload;
# the real implementation posts a Compact commitment to Midnight later.
import logging

logger = logging.getLogger(__name__)


class NotaryStub:
    async def record_event(self, payload: dict) -> bool:
        logger.info("notary stub recorded event %s", payload.get("event_id"))
        return True


def get_notary():
    return NotaryStub()
```

- [ ] **Step 5: Channels endpoints + worker notary route**

`channels.py`:

```python
class GoLiveRequest(BaseModel):
    live: bool


@router.post("/channels/{channel_id}/live", response_model=GoLiveResponse)
async def set_live(channel_id: str, req: GoLiveRequest, session=Depends(get_session), creator_id=Depends(get_current_creator_id)):
    channel = await ChannelRepo(session).get(channel_id)
    if channel is None: raise HTTPException(404, "Channel not found")
    if str(channel.creator_id) != creator_id: raise HTTPException(403, "Not your channel")
    if req.live and not channel.is_live:
        channel.is_live = True
        channel.live_since = func.now()
        ping = await PingRepo(session).create(
            channel_id=channel.id, message=f"@{channel.handle} is LIVE!",
            delivery_method="push", kind="live", status="processing", commit=False,
        )
        count = await fanout_ping(session, ping.id, channel.id, ping.message, "live")
        await PingRepo(session).update_counts(ping.id, total_recipients=count, status="queued")
        try:
            await publish("/api/v1/worker/notary", {
                "event_id": str(ping.id), "channel_id": str(channel.id),
                "kind": "go_live", "timestamp": int(time.time()),
            })
        except Exception:
            logger.warning("notary enqueue failed for ping %s", ping.id)  # best effort
    elif not req.live and channel.is_live:
        channel.is_live = False
        channel.live_since = None
        await session.commit()
    return GoLiveResponse(is_live=channel.is_live)


@router.get("/channels/{channel_id}", response_model=ChannelStatusResponse)
async def get_channel(channel_id, session=Depends(get_session), creator_id=Depends(get_current_creator_id)):
    # 404 / 403 same pattern; return {id, handle, is_live, live_since}
```

Register: import `publish` from queue_service into channels.py. Worker: add `NotaryJob(BaseModel)` + route (code in Step 1 test contract); `get_notary` imported from `app.services.notary_service`.

Add `GoLiveRequest`/`GoLiveResponse`/`ChannelStatusResponse` to `models/schemas.py` (public API schemas live there; `GoLiveRequest` may stay local to channels.py like other request models).

Also add the dashboard's channel lookup (needed by Task 26 — there is no list endpoint and `POST /channels` would collide on the `UNIQUE(creator_id)` constraint added in Task 19):

```python
@router.get("/channels/mine", response_model=ChannelStatusResponse)
async def get_my_channel(session=Depends(get_session), creator_id=Depends(get_current_creator_id)):
    channel = await ChannelRepo(session).get_by_creator(creator_id)
    if channel is None:
        raise HTTPException(404, "No channel")
    return ChannelStatusResponse(id=str(channel.id), handle=channel.handle, is_live=channel.is_live, live_since=channel.live_since)
```

(404 on no channel is the dashboard's signal to show the create form; `ChannelRepo.get_by_creator` already exists at `repositories.py:87`.)

- [ ] **Step 6: Run suite** → PASS

- [ ] **Step 7: Commit**

```bash
git add backend/ && git commit -m "feat: go-live alerts with best-effort Midnight notary stub"
```

---

## Phase C — Frontend

### Task 25: Next.js scaffold + landing

**Files:** `frontend/` — scaffold via create-next-app (TypeScript, Tailwind, App Router), shadcn/ui init + `button card input label textarea`, `frontend/app/page.tsx`, `frontend/.env.example`

**Interfaces:** Produces running Next.js app; `lib/` conventions for Tasks 26–27.

- [ ] **Step 1: Scaffold**

Run: `npx create-next-app@latest frontend --typescript --tailwind --app --eslint` (accept defaults), then `cd frontend && npx shadcn@latest init` (defaults) and `npx shadcn@latest add button card input label textarea`

- [ ] **Step 2: Landing page**

```tsx
// frontend/app/page.tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight">
          Go live. <span className="text-primary">Everyone knows.</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Privacy-first notifications for creators. Fans subscribe with a
          wallet — no phone numbers, no emails, ever.
        </p>
        <Button size="lg" className="mt-8">Get Started Free</Button>
      </section>
      <section className="mx-auto max-w-4xl px-6 pb-24 grid gap-4 sm:grid-cols-3">
        <Card><CardHeader><CardTitle>Wallet identity</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">Fans subscribe by signing with an embedded wallet.</CardContent></Card>
        <Card><CardHeader><CardTitle>Instant push</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">Pings and live alerts arrive as web push — fast and free.</CardContent></Card>
        <Card><CardHeader><CardTitle>Verifiable events</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">Live events are mirrored to an on-chain notary, asynchronously.</CardContent></Card>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: `frontend/.env.example`**

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_PRIVY_APP_ID=...
NEXT_PUBLIC_ONESIGNAL_APP_ID=...
```

- [ ] **Step 4: Verify** — `cd frontend && npm run dev` → page renders; `npm run build` passes.

- [ ] **Step 5: Commit** — `git add frontend/ && git commit -m "feat: scaffold Next.js frontend with landing page"`

---

### Task 26: Creator auth + dashboard

**Files:** `frontend/lib/supabase.ts`, `frontend/lib/api.ts`, `frontend/app/login/page.tsx`, `frontend/app/dashboard/page.tsx`, `frontend/components/ping-composer.tsx`, `frontend/components/stats-card.tsx`, `frontend/components/live-toggle.tsx`

**Interfaces:**
- Consumes: `POST /api/v1/channels` (Task 7), `POST /api/v1/pings`, `GET /api/v1/channels/{id}/stats`, `POST /api/v1/channels/{id}/live`, `GET /api/v1/channels/mine` (Task 24), Supabase Auth JWT (ADR 0005)
- Produces: authenticated dashboard; API client helper `api(path, {method, body})` attaching `Authorization: Bearer <access_token>`
- **Constraint: do NOT modify `frontend/app/layout.tsx`** (Task 27 owns the root layout — Privy/OneSignal providers).

- [ ] **Step 1: Supabase client + API helper**

```ts
// frontend/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

```tsx
// frontend/lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function api(path: string, opts: { method?: string; body?: unknown } = {}) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    method: opts.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? `HTTP ${res.status}`);
  return res.json();
}
```

- [ ] **Step 2: Login page**

```tsx
// frontend/app/login/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAuth(mode: "signup" | "login") {
    setError(null);
    const fn = mode === "signup" ? supabase.auth.signUp : supabase.auth.signInWithPassword;
    const { error: err } = await fn({ email, password }); // signUp: fn({email, password})
    if (err) return setError(err.message);
    router.push("/dashboard");
  }
  // render email + password Input + two Buttons (Create account / Sign in)
}
```

- [ ] **Step 3: Dashboard**

Flow (no list endpoint exists; `GET /channels/mine` from Task 24 resolves the channel in one call):

1. On mount, `api("/channels/mine")` (catch 404 → show create-channel form with `handle` input → `POST /channels` → keep the returned `channel_id` in component state).
2. If a channel exists, render composer + stats + live toggle with its id. Do **not** store the channel id in localStorage — `/channels/mine` is authoritative on every load.

Composer (binding):

```tsx
// frontend/components/ping-composer.tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

export function PingComposer({ channelId }: { channelId: string }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      await api("/pings", { method: "POST", body: { channel_id: channelId, message } });
      setMessage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3">
      <Textarea placeholder="What's happening? (max 160 chars)" maxLength={160}
        value={message} onChange={(e) => setMessage(e.target.value)} />
      {error && <p className="text-sm text-destructive">{error}</p>}
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

`stats-card.tsx` fetches `/channels/{id}/stats`; `live-toggle.tsx` reads `/channels/{id}` and POSTs `/channels/{id}/live` flipping `live`.

- [ ] **Step 4: Verify** — `npm run dev` → login → create channel → composer sends (backend may be down: error path must render, not crash); `npm run build` passes.

- [ ] **Step 5: Commit** — `git add frontend/ && git commit -m "feat: creator dashboard with auth, composer, stats, live toggle"`

---

### Task 27: Fan join flow + push opt-in

**Files:** `frontend/app/layout.tsx` (PrivyProvider), `frontend/app/join/[handle]/page.tsx`, `frontend/components/fan-actions.tsx`, `frontend/components/onesignal-provider.tsx`, `frontend/public/OneSignalSDKWorker.js`, `frontend/public/manifest.json`, `frontend/lib/signing.ts`

**Interfaces:**
- Consumes: `POST /subscribe`, `/unsubscribe`, `/devices` (Tasks 18/20), `@privy-io/react-auth`, `react-onesignal`
- Produces: the full fan funnel; canonical message builder shared client-side

- [ ] **Step 1: Dependencies**

`npm i @privy-io/react-auth react-onesignal` in `frontend/`. Set `NEXT_PUBLIC_PRIVY_APP_ID` and `NEXT_PUBLIC_ONESIGNAL_APP_ID` in `.env.local`.

- [ ] **Step 2: Root layout with PrivyProvider**

```tsx
// frontend/app/layout.tsx (modify)
import { PrivyProvider } from "@privy-io/react-auth";

export const metadata = { title: "PIN — Private Instant Notification" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PrivyProvider
          appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
          config={{ embeddedWallets: { ethereum: { createOnLogin: "all-users" } } }}
        >
          {children}
        </PrivyProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Canonical signing helper**

```ts
// frontend/lib/signing.ts
export function canonicalMessage(action: string, parts: string[], timestamp: number): string {
  return ["PIN", action, ...parts.map((p) => p.toLowerCase()), String(timestamp)].join(":");
}
```

Must match `signature_service.canonical_message` exactly (lowercased parts).

- [ ] **Step 4: OneSignal service worker**

`frontend/public/OneSignalSDKWorker.js`:

```javascript
importScripts("https://onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
```

`frontend/public/manifest.json` — minimal PWA manifest (`name`, `short_name`, `start_url`, `display`, `"gcm_sender_id": "103953800507"`). Verify at execution against https://documentation.onesignal.com/docs/onesignal-service-worker whether the manifest entry is still required; keep it (harmless) unless docs say otherwise.

- [ ] **Step 5: Fan actions component** (binding flow)

```tsx
// frontend/components/fan-actions.tsx
"use client";
import { useState } from "react";
import { usePrivy, useSignMessage, useWallets } from "@privy-io/react-auth";
import OneSignal from "react-onesignal";
import { api } from "@/lib/api";
import { canonicalMessage } from "@/lib/signing";

export function FanActions({ handle }: { handle: string }) {
  const { login, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { signMessage } = useSignMessage();
  const [state, setState] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signFor(action: string, extra: string, ts: number) {
    const wallet = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
    const msg = canonicalMessage(action, [wallet.address, extra], ts);
    const { signature } = await signMessage({ message: msg }, { address: wallet.address });
    return { wallet_address: wallet.address.toLowerCase(), signature, timestamp: ts };
  }

  async function subscribe() {
    setBusy(true);
    try {
      if (!authenticated) { login(); return; }
      const ts = Math.floor(Date.now() / 1000);
      const wallet = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
      const subMsg = canonicalMessage("subscribe", [handle, wallet.address], ts);
      const { signature } = await signMessage({ message: subMsg }, { address: wallet.address });
      await api("/subscribe", {
        method: "POST",
        body: { channel_handle: handle, wallet_address: wallet.address.toLowerCase(), signature, timestamp: ts },
      });
      setState("Subscribed! Turning on notifications…");
      // Push opt-in: init OneSignal, prompt, then register the device id.
      await OneSignal.init({ appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID! });
      await OneSignal.Slidedown.promptPush();
      const deviceId: string | undefined = OneSignal.User.onesignalId;
      if (deviceId) {
        const ts2 = Math.floor(Date.now() / 1000);
        const body = await signFor("device", deviceId, ts2);
        await api("/devices", { method: "POST", body: { token: deviceId, platform: "web", ...body } });
        setState("You're in — push enabled.");
      } else {
        setState("Subscribed (push permission not granted).");
      }
    } catch (e) {
      setState(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    try {
      const ts = Math.floor(Date.now() / 1000);
      const wallet = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
      const msg = canonicalMessage("unsubscribe", [handle, wallet.address], ts);
      const { signature } = await signMessage({ message: msg }, { address: wallet.address });
      await api("/unsubscribe", {
        method: "POST",
        body: { channel_handle: handle, wallet_address: wallet.address.toLowerCase(), signature, timestamp: ts },
      });
      setState("Unsubscribed.");
    } catch (e) {
      setState(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button onClick={subscribe} disabled={busy} className="...">
        {authenticated ? "Follow for live alerts" : "Sign in to subscribe"}
      </button>
      {authenticated && <button onClick={unsubscribe} disabled={busy}>Unsubscribe</button>}
      {state && <p className="text-sm text-muted-foreground">{state}</p>}
    </div>
  );
}
```

- [ ] **Step 6: Join page** — `frontend/app/join/[handle]/page.tsx`: reads `handle` param, fetches channel display (creator-facing channel GET requires auth — for MVP show handle + form; channel profile endpoint is a follow-up), renders `<FanActions handle={handle} />`.

- [ ] **Step 7: Verify**

Run: `cd frontend && npm run dev` → open `/join/alice` → login modal opens → subscribe flow reaches signature prompt (backend offline: error state renders). `npm run build` passes. Confirm `GET /OneSignalSDKWorker.js` serves 200.

- [ ] **Step 8: Commit**

```bash
git add frontend/ && git commit -m "feat: fan join flow with wallet subscribe and push opt-in"
```

---

## Phase D — Deployment

### Task 28: Backend deploy + live database verification

**Files:** `render.yaml` (create/update), `.env.example` (update), `backend/supabase/migrations` applied to cloud Supabase

**Interfaces:** Produces `PUBLIC_API_URL` (Render URL) used by QStash callbacks; closes deferred gates (live schema from Tasks 2/4).

- [ ] **Step 1: render.yaml**

```yaml
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
      - key: SUPABASE_JWT_SECRET
        sync: false
      - key: PUBLIC_API_URL
        sync: false
      - key: UPSTASH_REDIS_URL
        sync: false
      - key: UPSTASH_QSTASH_TOKEN
        sync: false
      - key: ONESIGNAL_APP_ID
        sync: false
      - key: ONESIGNAL_REST_API_KEY
        sync: false
```

`.env.example`: same keys; remove every Twilio/phone/Privy-backend key (Task 19 already dropped them from Settings).

- [ ] **Step 2: Apply migrations to cloud Supabase**

Run: `cd backend && supabase link --project-ref <ref>` then `supabase db push` (requires Supabase CLI login — **may need user credentials**; if unavailable, fall back to SQL editor: apply 0001, 0002, 0003, 0004, 0005, 0006, 0007 in order).
Expected: no errors; `SELECT tablename FROM pg_tables WHERE schemaname='public'` shows `creators, channels, fans, anonymous_links, pings, message_queue_jobs, device_tokens` and **no** `encrypted_phones`.

- [ ] **Step 3: Live schema fidelity check (closes Task 4 defer #5)**

Diff `information_schema.columns` for every table against `backend/app/db/models.py`; fix any drift in models or migrations (whichever is wrong).

- [ ] **Step 4: Run the suite against Postgres**

Set `DATABASE_URL=postgresql+asyncpg://...` (Supabase pooler) and run `python -m pytest -v`. The SQLite in-memory fixtures stay the default (`db_engine` fixture pins `sqlite+aiosqlite` — it does not read DATABASE_URL); run a dedicated smoke script instead:

```python
# backend/scripts/db_smoke.py — create one channel + fan + ping row via repos, then delete them
```

(closes Task 2 defer: `tests/test_schema.sql` executed via `psql -f` against the cloud DB.)

- [ ] **Step 5: Deploy to Render + smoke** — push repo, deploy, `GET {PUBLIC_API_URL}/health` → `{"status":"ok"}`.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: Render deploy config and live DB verification"`

---

### Task 29: Frontend deploy to Vercel

**Files:** `frontend/.env.example` update (all four vars), optional `frontend/vercel.json`

- [ ] **Step 1: Env** — `.env.example` = `NEXT_PUBLIC_API_URL` (Render URL), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_PRIVY_APP_ID`, `NEXT_PUBLIC_ONESIGNAL_APP_ID`.
- [ ] **Step 2: Deploy** — `cd frontend && vercel --prod` (needs Vercel login — may need user). Verify landing + `/join/test` render.
- [ ] **Step 3: OneSignal origin** — add the Vercel domain as allowed origin in OneSignal dashboard (manual step, note in PR).
- [ ] **Step 4: Commit** — env example + vercel config.

---

## Phase E — Verification

### Task 30: E2E flow test + final checklist

**Files:** `backend/tests/test_e2e_flow.py`, lint/config sweep, `README.md`

- [ ] **Step 1: E2E test** — one async test module covering, with `fanout` real (jobs created) but `publish` mocked and provider mocked:

1. creator JWT (synthesized as in `test_channels.py`) creates channel
2. fan A signs subscribe → 200, fan_id
3. fan A registers device
4. fan B subscribes, then unsubscribes
5. creator sends ping → `total_recipients == 1` (B excluded)
6. worker delivers A's job → `sent`; ping counters update; ping `completed`
7. worker called again with same key → `duplicate`
8. fan A unsubscribes; creator sends ping 2 → worker returns `opted_out`
9. go-live → `kind='live'` ping + notary publish called
10. assert no wallet… (wallets are allowed) — assert **no phone-like strings** and no `signature` fields appear in any response body (`"\+?\d{7,}"` heuristic over captured responses)

- [ ] **Step 2: Full suite + lint**

Run: `cd backend && python -m pytest -v && ruff check .`
Fix deferred lint minors from the ledger: ruff config for I001, path-header comments, missing `app/core/__init__.py` — and `ruff format` the tree.

- [ ] **Step 3: Frontend build** — `cd frontend && npm run build`.

- [ ] **Step 4: README** — setup (Supabase, Upstash, OneSignal, Privy, Render, Vercel), env tables, run instructions, architecture summary linking ADR 0006.

- [ ] **Step 5: Checklist**

- [ ] All backend tests pass
- [ ] No phone/email PII path exists (grep: `phone|twilio|sms` in `backend/app` → only allowed comments)
- [ ] `ruff check` clean; `npm run build` clean
- [ ] `.env.example` files complete and accurate
- [ ] Migrations 0001–0007 applied to cloud DB
- [ ] README updated

- [ ] **Step 6: Commit** — `git add -A && git commit -m "test: e2e flow, lint sweep, README"`

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
- Real Midnight Compact notary contract behind `NotaryPort`
- Native iOS/Android apps (APNs/FCM direct) using the same device-token API
- Creator wallet signing of go-live events; Privy→Supabase unified login
- Job replay tooling for `failed`/stuck `processing` jobs
