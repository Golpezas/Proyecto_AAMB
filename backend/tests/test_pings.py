# backend/tests/test_pings.py
import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.core.config import settings
from app.db.repositories import (
    AnonymousLinkRepo,
    ChannelRepo,
    CreatorRepo,
    DeviceTokenRepo,
)

# Fixtures — defined in this file to avoid cross-test dependencies.
# CRITICAL: the JWT `sub` and the seeded channel's creator_id must be the
# SAME uuid — `CreatorRepo.create(email, handle)` generates its own id, so
# use `CreatorRepo.upsert(sub, ...)` (repositories.py:47) with a shared sub.
TEST_SECRET = "test-supabase-jwt-secret-do-not-use-in-prod"
AUDIENCE = "authenticated"

def mint_token(sub: str, email: str = "creator@example.com", *, secret: str = TEST_SECRET) -> str:
    import jwt
    return jwt.encode({"sub": sub, "aud": AUDIENCE, "email": email}, secret, algorithm="HS256")

def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture(autouse=True)
def jwt_secret(monkeypatch):
    # The empty default must never be active during tests: an unconfigured
    # secret is a 500 by design (fail loud), not an auth bypass.
    monkeypatch.setattr(settings, "supabase_jwt_secret", TEST_SECRET)

@pytest.fixture
def creator_sub() -> str:
    return str(uuid.uuid4())

@pytest.fixture
def auth_headers(creator_sub):
    return bearer(mint_token(creator_sub))

@pytest.fixture
def auth_headers2():
    return bearer(mint_token(str(uuid.uuid4()), email="other@example.com"))

@pytest.fixture
async def seeded_channel_with_fans(db_session, creator_sub):
    from app.db.repositories import FanRepo
    creator = await CreatorRepo(db_session).upsert(
        creator_sub, email="c@example.com", handle="testchan"
    )
    channel = await ChannelRepo(db_session).create(
        creator_id=creator.id, handle="testchan", signing_key="sk_test_123"
    )
    # 2 active fans with device tokens (for fanout)
    for i in range(2):
        fan = await FanRepo(db_session).create(wallet_address=f"0x{i:040x}")
        await AnonymousLinkRepo(db_session).create(channel_id=channel.id, fan_id=fan.id)
        await DeviceTokenRepo(db_session).upsert(fan.id, f"onesignal_token_{i}", "web")
    # 1 opted-out fan (should be skipped by worker)
    fan3 = await FanRepo(db_session).create(wallet_address="0x3" + "0"*39)
    await AnonymousLinkRepo(db_session).create(channel_id=channel.id, fan_id=fan3.id)
    await AnonymousLinkRepo(db_session).set_opted_out(channel.id, fan3.id)
    return channel


async def test_create_ping_ok(api_client, auth_headers, seeded_channel_with_fans):
    with patch("app.api.pings.fanout_ping", new_callable=AsyncMock, return_value=2):
        resp = await api_client.post(
            "/api/v1/pings",
            json={"channel_id": str(seeded_channel_with_fans.id), "message": "Show at 5PM!"},
            headers=auth_headers,
        )
    print(f"Response: {resp.status_code} {resp.text}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "queued" and data["total_recipients"] == 2


async def test_ping_over_quota_402(api_client, auth_headers, seeded_channel_with_fans, db_session):
    seeded_channel_with_fans.monthly_ping_limit = 0
    await db_session.flush()
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
    assert body["pings_sent_this_period"] == 1 and body["subscriber_count"] >= 1


async def test_get_ping_not_found(api_client, auth_headers):
    resp = await api_client.get(f"/api/v1/pings/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404