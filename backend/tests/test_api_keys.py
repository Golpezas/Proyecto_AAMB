# backend/tests/test_api_keys.py
# Channel API keys (machine auth for BreakSuite6) — Task 26
import hashlib
import secrets
import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.core.config import settings
from app.db.repositories import AnonymousLinkRepo, ChannelRepo, CreatorRepo, FanRepo

# Fixtures — defined in this file to avoid cross-test dependencies.
# CRITICAL: the JWT `sub` and the seeded channel's creator_id must be the
# SAME uuid — `CreatorRepo.upsert(sub, ...)` with a shared sub.
TEST_SECRET = "test-supabase-jwt-secret-do-not-use-in-prod"
AUDIENCE = "authenticated"


def mint_token(sub: str, email: str = "creator@example.com", *, secret: str = TEST_SECRET) -> str:
    import jwt
    return jwt.encode({"sub": sub, "aud": AUDIENCE, "email": email}, secret, algorithm="HS256")


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def make_key() -> str:
    return "pin_sk_" + secrets.token_hex(24)


def key_hash(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


@pytest.fixture(autouse=True)
def jwt_secret(monkeypatch):
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
async def seeded_channel(db_session, creator_sub):
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
    return channel


async def _make_key(api_client, auth_headers, seeded_channel):
    resp = await api_client.post(
        f"/api/v1/channels/{seeded_channel.id}/api-key", headers=auth_headers
    )
    assert resp.status_code == 200
    return resp.json()["api_key"]


async def test_generate_key_returns_plaintext_once(api_client, auth_headers, seeded_channel, db_session):
    resp = await api_client.post(
        f"/api/v1/channels/{seeded_channel.id}/api-key", headers=auth_headers
    )
    assert resp.status_code == 200
    key = resp.json()["api_key"]
    assert key.startswith("pin_sk_") and len(key) == 7 + 48

    # DB stores only the hash — plaintext must not be retrievable
    await db_session.refresh(seeded_channel)
    assert seeded_channel.api_key_hash == key_hash(key)
    assert seeded_channel.api_key_hash != key


async def test_ping_with_channel_key(api_client, seeded_channel, auth_headers, db_session):
    key = await _make_key(api_client, auth_headers, seeded_channel)
    with patch("app.api.pings.fanout_ping", new_callable=AsyncMock, return_value=0):
        resp = await api_client.post(
            "/api/v1/pings",
            json={"channel_id": str(seeded_channel.id), "message": "hi"},
            headers={"X-Channel-Key": key},
        )
    assert resp.status_code == 200


async def test_key_scoped_to_own_channel(api_client, db_session, creator_sub, auth_headers):
    # Create channel A
    creator_a = await CreatorRepo(db_session).upsert(
        creator_sub, email="c@example.com", handle="chana"
    )
    channel_a = await ChannelRepo(db_session).create(
        creator_id=creator_a.id, handle="chana", signing_key="sk_a"
    )
    key = await _make_key(api_client, auth_headers, channel_a)

    # Create channel B (different creator)
    creator_b = await CreatorRepo(db_session).upsert(
        str(uuid.uuid4()), email="other@example.com", handle="chanb"
    )
    channel_b = await ChannelRepo(db_session).create(
        creator_id=creator_b.id, handle="chanb", signing_key="sk_b"
    )

    # Use channel A's key on channel B's /pings → 401 (invalid key for this channel)
    with patch("app.api.pings.fanout_ping", new_callable=AsyncMock, return_value=0):
        resp = await api_client.post(
            "/api/v1/pings",
            json={"channel_id": str(channel_b.id), "message": "hi"},
            headers={"X-Channel-Key": key},
        )
    assert resp.status_code == 401


async def test_regenerate_invalidates_old_key(api_client, auth_headers, seeded_channel, db_session):
    # Generate first key
    resp1 = await api_client.post(
        f"/api/v1/channels/{seeded_channel.id}/api-key", headers=auth_headers
    )
    assert resp1.status_code == 200
    key1 = resp1.json()["api_key"]

    # Generate second key (regenerate)
    resp2 = await api_client.post(
        f"/api/v1/channels/{seeded_channel.id}/api-key", headers=auth_headers
    )
    assert resp2.status_code == 200
    key2 = resp2.json()["api_key"]
    assert key1 != key2

    # Old key should be invalid
    with patch("app.api.pings.fanout_ping", new_callable=AsyncMock, return_value=0):
        resp_old = await api_client.post(
            "/api/v1/pings",
            json={"channel_id": str(seeded_channel.id), "message": "hi"},
            headers={"X-Channel-Key": key1},
        )
    assert resp_old.status_code == 401

    # New key should work
    with patch("app.api.pings.fanout_ping", new_callable=AsyncMock, return_value=0):
        resp_new = await api_client.post(
            "/api/v1/pings",
            json={"channel_id": str(seeded_channel.id), "message": "hi"},
            headers={"X-Channel-Key": key2},
        )
    assert resp_new.status_code == 200


async def test_revoke_key(api_client, auth_headers, seeded_channel, db_session):
    key = await _make_key(api_client, auth_headers, seeded_channel)

    # Revoke the key
    resp = await api_client.delete(
        f"/api/v1/channels/{seeded_channel.id}/api-key", headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    # Key should no longer work
    with patch("app.api.pings.fanout_ping", new_callable=AsyncMock, return_value=0):
        resp_key = await api_client.post(
            "/api/v1/pings",
            json={"channel_id": str(seeded_channel.id), "message": "hi"},
            headers={"X-Channel-Key": key},
        )
    assert resp_key.status_code == 401

    # But JWT should still work
    with patch("app.api.pings.fanout_ping", new_callable=AsyncMock, return_value=0):
        resp_jwt = await api_client.post(
            "/api/v1/pings",
            json={"channel_id": str(seeded_channel.id), "message": "hi"},
            headers=auth_headers,
        )
    assert resp_jwt.status_code == 200


async def test_no_credentials_401(api_client, seeded_channel):
    # POST /pings with neither X-Channel-Key nor Authorization → 401
    with patch("app.api.pings.fanout_ping", new_callable=AsyncMock, return_value=0):
        resp = await api_client.post(
            "/api/v1/pings",
            json={"channel_id": str(seeded_channel.id), "message": "hi"},
            headers={},
        )
    assert resp.status_code == 401


async def test_go_live_with_channel_key(api_client, seeded_channel, auth_headers, db_session):
    key = await _make_key(api_client, auth_headers, seeded_channel)
    with patch("app.api.channels.fanout_ping", new_callable=AsyncMock, return_value=0), \
         patch("app.api.channels.publish", new_callable=AsyncMock):
        resp = await api_client.post(
            f"/api/v1/channels/{seeded_channel.id}/live",
            json={"live": True},
            headers={"X-Channel-Key": key},
        )
    assert resp.status_code == 200
    assert resp.json()["is_live"] is True


async def test_delete_api_key_forbidden_other_creator(api_client, auth_headers2, seeded_channel):
    # Other creator tries to delete the key → 403
    resp = await api_client.delete(
        f"/api/v1/channels/{seeded_channel.id}/api-key", headers=auth_headers2
    )
    assert resp.status_code == 403


async def test_generate_api_key_forbidden_other_creator(api_client, auth_headers2, seeded_channel):
    # Other creator tries to generate a key → 403
    resp = await api_client.post(
        f"/api/v1/channels/{seeded_channel.id}/api-key", headers=auth_headers2
    )
    assert resp.status_code == 403