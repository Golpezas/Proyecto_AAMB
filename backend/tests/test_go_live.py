# backend/tests/test_go_live.py
import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.core.config import settings
from app.db.repositories import (
    AnonymousLinkRepo,
    ChannelRepo,
    CreatorRepo,
    DeviceTokenRepo,
    FanRepo,
    PingRepo,
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
def other_creator_headers():
    return bearer(mint_token(str(uuid.uuid4()), email="other@example.com"))


@pytest.fixture
async def seeded_channel(db_session, creator_sub):
    """Channel with 2 active fans with device tokens + 1 opted-out fan."""
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
    fan3 = await FanRepo(db_session).create(wallet_address="0x3" + "0" * 39)
    await AnonymousLinkRepo(db_session).create(channel_id=channel.id, fan_id=fan3.id)
    await AnonymousLinkRepo(db_session).set_opted_out(channel.id, fan3.id)
    return channel


@pytest.fixture
async def seeded_channel_no_fans(db_session, creator_sub):
    """Channel with no fans."""
    creator = await CreatorRepo(db_session).upsert(
        creator_sub, email="c@example.com", handle="testchan"
    )
    channel = await ChannelRepo(db_session).create(
        creator_id=creator.id, handle="testchan", signing_key="sk_test_123"
    )
    return channel


async def test_channels_mine(api_client, auth_headers, seeded_channel):
    resp = await api_client.get("/api/v1/channels/mine", headers=auth_headers)
    assert resp.status_code == 200 and resp.json()["handle"] == seeded_channel.handle
    assert resp.json()["is_live"] is False


async def test_channels_mine_no_channel(api_client, auth_headers):
    resp = await api_client.get("/api/v1/channels/mine", headers=auth_headers)
    assert resp.status_code == 404


async def test_get_channel_status(api_client, auth_headers, seeded_channel):
    resp = await api_client.get(f"/api/v1/channels/{seeded_channel.id}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(seeded_channel.id)
    assert data["handle"] == seeded_channel.handle
    assert data["is_live"] is False
    assert data["live_since"] is None


async def test_get_channel_forbidden_other_creator(api_client, other_creator_headers, seeded_channel):
    resp = await api_client.get(f"/api/v1/channels/{seeded_channel.id}", headers=other_creator_headers)
    assert resp.status_code == 403


async def test_go_live_creates_alert_and_enqueues(api_client, auth_headers, seeded_channel, db_session):
    with patch("app.api.channels.fanout_ping", new_callable=AsyncMock, return_value=3) as mock_fanout, \
         patch("app.api.channels.publish", new_callable=AsyncMock) as mock_publish:
        resp = await api_client.post(
            f"/api/v1/channels/{seeded_channel.id}/live", json={"live": True},
            headers=auth_headers,
        )
    assert resp.status_code == 200 and resp.json()["is_live"] is True
    assert mock_fanout.call_count == 1
    assert mock_publish.call_count == 1
    assert mock_publish.call_args.args[0] == "/api/v1/worker/notary"
    notary_body = mock_publish.call_args.args[1]
    assert notary_body["kind"] == "go_live"
    assert notary_body["channel_id"] == str(seeded_channel.id)
    # a Ping row with kind='live' exists
    ping = await PingRepo(db_session).get(notary_body["event_id"])
    assert ping is not None
    assert ping.kind == "live"
    assert ping.status == "queued"
    assert ping.message == f"@{seeded_channel.handle} is LIVE!"


async def test_go_live_twice_no_second_alert(api_client, auth_headers, seeded_channel):
    with patch("app.api.channels.fanout_ping", new_callable=AsyncMock, return_value=0) as mock_fanout, \
         patch("app.api.channels.publish", new_callable=AsyncMock) as mock_publish:
        await api_client.post(f"/api/v1/channels/{seeded_channel.id}/live", json={"live": True}, headers=auth_headers)
        resp = await api_client.post(f"/api/v1/channels/{seeded_channel.id}/live", json={"live": True}, headers=auth_headers)
    assert resp.json()["is_live"] is True  # idempotent
    # fanout and publish called exactly once
    assert mock_fanout.call_count == 1
    assert mock_publish.call_count == 1


async def test_go_live_notary_failure_does_not_fail(api_client, auth_headers, seeded_channel):
    with patch("app.api.channels.fanout_ping", new_callable=AsyncMock, return_value=0), \
         patch("app.api.channels.publish", new_callable=AsyncMock, side_effect=RuntimeError("qstash down")):
        resp = await api_client.post(f"/api/v1/channels/{seeded_channel.id}/live", json={"live": True}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["is_live"] is True


async def test_go_live_off(api_client, auth_headers, seeded_channel):
    with patch("app.api.channels.fanout_ping", new_callable=AsyncMock, return_value=0), \
         patch("app.api.channels.publish", new_callable=AsyncMock) as mock_publish:
        # First go live
        resp = await api_client.post(f"/api/v1/channels/{seeded_channel.id}/live", json={"live": True}, headers=auth_headers)
        assert resp.json()["is_live"] is True
        # Then go offline
        resp = await api_client.post(f"/api/v1/channels/{seeded_channel.id}/live", json={"live": False}, headers=auth_headers)
    assert resp.json()["is_live"] is False
    # No publish on going offline
    assert mock_publish.call_count == 1  # only for the go-live


async def test_go_live_off_idempotent(api_client, auth_headers, seeded_channel):
    """Going offline when already offline is a no-op."""
    with patch("app.api.channels.publish", new_callable=AsyncMock) as mock_publish:
        # Go offline without ever going live
        resp = await api_client.post(f"/api/v1/channels/{seeded_channel.id}/live", json={"live": False}, headers=auth_headers)
    assert resp.json()["is_live"] is False
    assert mock_publish.call_count == 0


async def test_go_live_forbidden_other_creator(api_client, other_creator_headers, seeded_channel):
    with patch("app.api.channels.fanout_ping", new_callable=AsyncMock, return_value=0), \
         patch("app.api.channels.publish", new_callable=AsyncMock):
        resp = await api_client.post(f"/api/v1/channels/{seeded_channel.id}/live", json={"live": True}, headers=other_creator_headers)
    assert resp.status_code == 403


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