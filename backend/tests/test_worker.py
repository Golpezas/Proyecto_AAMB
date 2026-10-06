# backend/tests/test_worker.py
import time
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from eth_account import Account
from eth_account.messages import encode_defunct

from app.db.models import Channel, Creator, MessageQueueJob, Ping
from app.db.repositories import (
    AnonymousLinkRepo,
    DeviceTokenRepo,
    FanRepo,
    MessageQueueJobRepo,
    PingRepo,
)


def _signed_body(handle: str, acct, action: str = "subscribe") -> dict:
    ts = int(time.time())
    wallet = acct.address.lower()
    msg = f"PIN:{action}:{handle.lower()}:{wallet}:{ts}"
    sig = Account.sign_message(encode_defunct(text=msg), acct.key).signature.hex()
    return {"channel_handle": handle, "wallet_address": wallet, "signature": sig, "timestamp": ts}


@pytest.fixture
async def seeded_setup(db_session):
    """Create a channel, fan, device token, ping, and job with status queued."""
    creator = Creator(id=uuid.uuid4(), email="c@example.com", handle="creator")
    channel = Channel(
        id=uuid.uuid4(),
        creator_id=creator.id,
        handle="alice",
        signing_key="sk",
        subscription_tier="free",
        monthly_ping_limit=100,
        pings_sent_this_period=0,
    )
    db_session.add_all([creator, channel])
    await db_session.flush()

    acct = Account.create()
    wallet = acct.address.lower()
    fan = await FanRepo(db_session).create(wallet_address=wallet, commit=False)

    await AnonymousLinkRepo(db_session).create(
        channel_id=channel.id, fan_id=fan.id, commit=False
    )

    await DeviceTokenRepo(db_session).upsert(
        fan.id, "device-token-123", "web", commit=False
    )

    ping = Ping(
        id=uuid.uuid4(),
        channel_id=channel.id,
        message="Test ping",
        delivery_method="push",
        kind="message",
        status="processing",
        total_recipients=1,
    )
    db_session.add(ping)

    job_key = f"{ping.id}:{fan.id}:push"
    job = MessageQueueJob(
        ping_id=ping.id,
        channel_id=channel.id,
        fan_id=fan.id,
        delivery_method="push",
        payload={"message": "Test ping", "kind": "message"},
        idempotency_key=job_key,
        status="queued",
    )
    db_session.add(job)

    await db_session.commit()

    return {
        "channel": channel,
        "fan": fan,
        "ping": ping,
        "job_key": job_key,
        "acct": acct,
    }


@pytest.mark.asyncio
async def test_worker_happy_path(api_client, db_session, seeded_setup):
    from app.core.ports import SendResult

    setup = seeded_setup
    with patch("app.api.worker.get_push_provider") as mock_provider_fn, \
         patch("app.api.worker.acquire_slot", new_callable=AsyncMock, return_value=True) as _mock_acquire:
        mock_provider = AsyncMock()
        mock_provider.send = AsyncMock(return_value=SendResult(success=True, provider_id="n1"))
        mock_provider_fn.return_value = mock_provider

        resp = await api_client.post(
            "/api/v1/worker/deliver",
            json={
                "ping_id": str(setup["ping"].id),
                "channel_id": str(setup["channel"].id),
                "fan_id": str(setup["fan"].id),
                "message": "Test ping",
                "kind": "message",
                "idempotency_key": setup["job_key"],
            },
        )

    assert resp.status_code == 200
    assert resp.json() == {"status": "sent"}

    job = await MessageQueueJobRepo(db_session).get_by_idempotency_key(setup["job_key"])
    assert job.status == "sent"
    assert job.processed_at is not None

    ping = await PingRepo(db_session).get(setup["ping"].id)
    assert ping.sent_count == 1
    assert ping.failed_count == 0
    assert ping.status == "completed"
    assert ping.completed_at is not None


@pytest.mark.asyncio
async def test_worker_duplicate(api_client, db_session, seeded_setup):
    setup = seeded_setup
    # First call
    with patch("app.api.worker.get_push_provider") as mock_provider_fn, \
         patch("app.api.worker.acquire_slot", new_callable=AsyncMock, return_value=True):
        mock_provider = AsyncMock()
        from app.core.ports import SendResult
        mock_provider.send = AsyncMock(return_value=SendResult(success=True, provider_id="n1"))
        mock_provider_fn.return_value = mock_provider

        resp1 = await api_client.post(
            "/api/v1/worker/deliver",
            json={
                "ping_id": str(setup["ping"].id),
                "channel_id": str(setup["channel"].id),
                "fan_id": str(setup["fan"].id),
                "message": "Test ping",
                "kind": "message",
                "idempotency_key": setup["job_key"],
            },
        )
    assert resp1.json() == {"status": "sent"}

    # Second call with same key
    with patch("app.api.worker.get_push_provider") as mock_provider_fn, \
         patch("app.api.worker.acquire_slot", new_callable=AsyncMock, return_value=True):
        mock_provider = AsyncMock()
        from app.core.ports import SendResult
        mock_provider.send = AsyncMock(return_value=SendResult(success=True, provider_id="n2"))
        mock_provider_fn.return_value = mock_provider

        resp2 = await api_client.post(
            "/api/v1/worker/deliver",
            json={
                "ping_id": str(setup["ping"].id),
                "channel_id": str(setup["channel"].id),
                "fan_id": str(setup["fan"].id),
                "message": "Test ping",
                "kind": "message",
                "idempotency_key": setup["job_key"],
            },
        )
    assert resp2.status_code == 200
    assert resp2.json() == {"status": "duplicate"}


@pytest.mark.asyncio
async def test_worker_opted_out(api_client, db_session, seeded_setup):
    setup = seeded_setup
    # Set link to opted_out
    await AnonymousLinkRepo(db_session).set_opted_out(setup["channel"].id, setup["fan"].id)

    with patch("app.api.worker.get_push_provider") as mock_provider_fn, \
         patch("app.api.worker.acquire_slot", new_callable=AsyncMock, return_value=True):
        mock_provider = AsyncMock()
        from app.core.ports import SendResult
        mock_provider.send = AsyncMock(return_value=SendResult(success=True, provider_id="n1"))
        mock_provider_fn.return_value = mock_provider

        resp = await api_client.post(
            "/api/v1/worker/deliver",
            json={
                "ping_id": str(setup["ping"].id),
                "channel_id": str(setup["channel"].id),
                "fan_id": str(setup["fan"].id),
                "message": "Test ping",
                "kind": "message",
                "idempotency_key": setup["job_key"],
            },
        )

    assert resp.status_code == 200
    assert resp.json() == {"status": "opted_out"}

    job = await MessageQueueJobRepo(db_session).get_by_idempotency_key(setup["job_key"])
    assert job.status == "opted_out"

    ping = await PingRepo(db_session).get(setup["ping"].id)
    assert ping.failed_count == 1


@pytest.mark.asyncio
async def test_worker_no_tokens(api_client, db_session, seeded_setup):
    setup = seeded_setup
    # Remove device token
    from app.db.repositories import DeviceTokenRepo
    tokens = await DeviceTokenRepo(db_session).list_by_fan(setup["fan"].id)
    for t in tokens:
        await DeviceTokenRepo(db_session).delete_for_fan(t.token, setup["fan"].id)

    with patch("app.api.worker.get_push_provider") as mock_provider_fn, \
         patch("app.api.worker.acquire_slot", new_callable=AsyncMock, return_value=True):
        mock_provider = AsyncMock()
        from app.core.ports import SendResult
        mock_provider.send = AsyncMock(return_value=SendResult(success=True, provider_id="n1"))
        mock_provider_fn.return_value = mock_provider

        resp = await api_client.post(
            "/api/v1/worker/deliver",
            json={
                "ping_id": str(setup["ping"].id),
                "channel_id": str(setup["channel"].id),
                "fan_id": str(setup["fan"].id),
                "message": "Test ping",
                "kind": "message",
                "idempotency_key": setup["job_key"],
            },
        )

    assert resp.status_code == 200
    assert resp.json() == {"status": "skipped"}

    job = await MessageQueueJobRepo(db_session).get_by_idempotency_key(setup["job_key"])
    assert job.status == "skipped"

    ping = await PingRepo(db_session).get(setup["ping"].id)
    assert ping.failed_count == 1


@pytest.mark.asyncio
async def test_worker_provider_error(api_client, db_session, seeded_setup):
    setup = seeded_setup
    with patch("app.api.worker.get_push_provider") as mock_provider_fn, \
         patch("app.api.worker.acquire_slot", new_callable=AsyncMock, return_value=True):
        mock_provider = AsyncMock()
        from app.core.ports import SendResult
        mock_provider.send = AsyncMock(return_value=SendResult(success=False, error="boom"))
        mock_provider_fn.return_value = mock_provider

        resp = await api_client.post(
            "/api/v1/worker/deliver",
            json={
                "ping_id": str(setup["ping"].id),
                "channel_id": str(setup["channel"].id),
                "fan_id": str(setup["fan"].id),
                "message": "Test ping",
                "kind": "message",
                "idempotency_key": setup["job_key"],
            },
        )

    assert resp.status_code == 200
    assert resp.json() == {"status": "failed"}

    job = await MessageQueueJobRepo(db_session).get_by_idempotency_key(setup["job_key"])
    assert job.status == "failed"
    assert job.error_message == "boom"

    ping = await PingRepo(db_session).get(setup["ping"].id)
    assert ping.failed_count == 1


@pytest.mark.asyncio
async def test_worker_rate_limited_503(api_client, db_session, seeded_setup):
    setup = seeded_setup
    with patch("app.api.worker.get_push_provider") as mock_provider_fn, \
         patch("app.api.worker.acquire_slot", new_callable=AsyncMock, return_value=False):
        mock_provider = AsyncMock()
        from app.core.ports import SendResult
        mock_provider.send = AsyncMock(return_value=SendResult(success=True, provider_id="n1"))
        mock_provider_fn.return_value = mock_provider

        resp = await api_client.post(
            "/api/v1/worker/deliver",
            json={
                "ping_id": str(setup["ping"].id),
                "channel_id": str(setup["channel"].id),
                "fan_id": str(setup["fan"].id),
                "message": "Test ping",
                "kind": "message",
                "idempotency_key": setup["job_key"],
            },
        )

    assert resp.status_code == 503
    assert resp.json()["detail"] == "Rate limited"

    job = await MessageQueueJobRepo(db_session).get_by_idempotency_key(setup["job_key"])
    # Job should remain queued (not claimed)
    assert job.status == "queued"


@pytest.mark.asyncio
async def test_worker_completed_on_last(api_client, db_session):
    """Test that ping status becomes completed when total_recipients == 1 and result is terminal."""
    creator = Creator(id=uuid.uuid4(), email="c@example.com", handle="creator")
    channel = Channel(
        id=uuid.uuid4(),
        creator_id=creator.id,
        handle="alice",
        signing_key="sk",
        subscription_tier="free",
        monthly_ping_limit=100,
        pings_sent_this_period=0,
    )
    db_session.add_all([creator, channel])
    await db_session.flush()

    acct = Account.create()
    wallet = acct.address.lower()
    fan = await FanRepo(db_session).create(wallet_address=wallet, commit=False)

    await AnonymousLinkRepo(db_session).create(
        channel_id=channel.id, fan_id=fan.id, commit=False
    )

    await DeviceTokenRepo(db_session).upsert(
        fan.id, "device-token-123", "web", commit=False
    )

    ping = Ping(
        id=uuid.uuid4(),
        channel_id=channel.id,
        message="Test ping",
        delivery_method="push",
        kind="message",
        status="processing",
        total_recipients=1,
    )
    db_session.add(ping)

    job_key = f"{ping.id}:{fan.id}:push"
    job = MessageQueueJob(
        ping_id=ping.id,
        channel_id=channel.id,
        fan_id=fan.id,
        delivery_method="push",
        payload={"message": "Test ping", "kind": "message"},
        idempotency_key=job_key,
        status="queued",
    )
    db_session.add(job)

    await db_session.commit()

    with patch("app.api.worker.get_push_provider") as mock_provider_fn, \
         patch("app.api.worker.acquire_slot", new_callable=AsyncMock, return_value=True) as _mock_acquire:
        mock_provider = AsyncMock()
        from app.core.ports import SendResult
        mock_provider.send = AsyncMock(return_value=SendResult(success=True, provider_id="n1"))
        mock_provider_fn.return_value = mock_provider

        resp = await api_client.post(
            "/api/v1/worker/deliver",
            json={
                "ping_id": str(ping.id),
                "channel_id": str(channel.id),
                "fan_id": str(fan.id),
                "message": "Test ping",
                "kind": "message",
                "idempotency_key": job_key,
            },
        )

    assert resp.status_code == 200
    assert resp.json() == {"status": "sent"}

    ping = await PingRepo(db_session).get(ping.id)
    assert ping.status == "completed"
    assert ping.completed_at is not None
    assert ping.sent_count == 1