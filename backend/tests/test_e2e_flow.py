# backend/tests/test_e2e_flow.py
# Local end-to-end flow (Task 30). Real fan-out + DB; QStash publish and
# OneSignal provider are mocked. No live Whatnot / push / cloud required.
import re
import time
import uuid
from unittest.mock import AsyncMock, patch

import jwt
import pytest
from eth_account import Account
from eth_account.messages import encode_defunct
from sqlalchemy import select

from app.core.config import settings
from app.core.ports import SendResult
from app.db.repositories import MessageQueueJobRepo, PingRepo

TEST_SECRET = "test-supabase-jwt-secret-do-not-use-in-prod"
AUDIENCE = "authenticated"
# E.164-ish: leading + and 7+ digits, or 10–15 contiguous digits (not UUID hex).
PHONE_LIKE = re.compile(r"\+\d{7,}|\b\d{10,15}\b")
FORBIDDEN_KEYS = {"phone", "email", "signature", "encrypted_phone"}


def mint_token(sub: str, email: str = "creator@example.com") -> str:
    return jwt.encode(
        {"sub": sub, "aud": AUDIENCE, "email": email},
        TEST_SECRET,
        algorithm="HS256",
    )


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def signed_subscribe(handle: str, acct, action: str = "subscribe") -> dict:
    ts = int(time.time())
    wallet = acct.address.lower()
    msg = f"PIN:{action}:{handle.lower()}:{wallet}:{ts}"
    sig = Account.sign_message(encode_defunct(text=msg), acct.key).signature.hex()
    return {
        "channel_handle": handle,
        "wallet_address": wallet,
        "signature": sig,
        "timestamp": ts,
    }


def signed_device(acct, action: str, token: str) -> dict:
    ts = int(time.time())
    wallet = acct.address.lower()
    msg = f"PIN:{action}:{wallet}:{token.lower()}:{ts}"
    sig = Account.sign_message(encode_defunct(text=msg), acct.key).signature.hex()
    return {
        "wallet_address": wallet,
        "signature": sig,
        "timestamp": ts,
        "token": token,
    }


def _walk(value, *, path: str = "") -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            lowered = str(key).lower()
            assert lowered not in FORBIDDEN_KEYS, f"forbidden key {key!r} at {path}"
            _walk(child, path=f"{path}.{key}" if path else str(key))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            _walk(child, path=f"{path}[{index}]")
    elif isinstance(value, str):
        assert PHONE_LIKE.search(value) is None, f"phone-like leak at {path}: {value}"


def assert_safe_response(resp) -> None:
    _walk(resp.json())


@pytest.fixture(autouse=True)
def jwt_secret(monkeypatch):
    monkeypatch.setattr(settings, "supabase_jwt_secret", TEST_SECRET)


@pytest.mark.asyncio
async def test_e2e_fan_and_machine_flow(api_client, db_session):
    captured: list = []
    creator_sub = str(uuid.uuid4())
    headers = bearer(mint_token(creator_sub))

    # 1. Creator creates channel
    created = await api_client.post(
        "/api/v1/channels", json={"handle": "kodrock"}, headers=headers
    )
    assert created.status_code == 200
    captured.append(created)
    channel_id = created.json()["id"]

    fan_a = Account.create()
    fan_b = Account.create()

    # 2. Fan A subscribes
    sub_a = await api_client.post(
        "/api/v1/subscribe", json=signed_subscribe("kodrock", fan_a)
    )
    assert sub_a.status_code == 200
    captured.append(sub_a)
    fan_a_id = sub_a.json()["fan_id"]

    # 3. Fan A registers device
    device = await api_client.post(
        "/api/v1/devices",
        json={"platform": "web", **signed_device(fan_a, "device", "onesignal-a")},
    )
    assert device.status_code == 200
    captured.append(device)

    # 4. Fan B subscribes then unsubscribes
    sub_b = await api_client.post(
        "/api/v1/subscribe", json=signed_subscribe("kodrock", fan_b)
    )
    assert sub_b.status_code == 200
    captured.append(sub_b)
    unsub_b = await api_client.post(
        "/api/v1/unsubscribe",
        json=signed_subscribe("kodrock", fan_b, action="unsubscribe"),
    )
    assert unsub_b.status_code == 200
    captured.append(unsub_b)

    # 5. Creator ping — only fan A is active
    with patch("app.services.fanout_service.publish", new_callable=AsyncMock):
        ping1 = await api_client.post(
            "/api/v1/pings",
            json={"channel_id": channel_id, "message": "Show at 5PM"},
            headers=headers,
        )
    assert ping1.status_code == 200
    captured.append(ping1)
    assert ping1.json()["total_recipients"] == 1
    ping1_id = ping1.json()["id"]
    job_key = f"{ping1_id}:{fan_a_id}:push"
    job = await MessageQueueJobRepo(db_session).get_by_idempotency_key(job_key)
    assert job is not None and job.status == "queued"

    # 6. Worker delivers A's job
    with (
        patch("app.api.worker.get_push_provider") as mock_provider_fn,
        patch("app.api.worker.acquire_slot", new_callable=AsyncMock, return_value=True),
    ):
        mock_provider = AsyncMock()
        mock_provider.send = AsyncMock(
            return_value=SendResult(success=True, provider_id="n1")
        )
        mock_provider_fn.return_value = mock_provider
        deliver1 = await api_client.post(
            "/api/v1/worker/deliver",
            json={
                "ping_id": ping1_id,
                "channel_id": channel_id,
                "fan_id": fan_a_id,
                "message": "Show at 5PM",
                "kind": "message",
                "idempotency_key": job_key,
            },
        )
    assert deliver1.status_code == 200
    assert deliver1.json() == {"status": "sent"}
    captured.append(deliver1)
    ping_row = await PingRepo(db_session).get(ping1_id)
    assert ping_row.sent_count == 1
    assert ping_row.status == "completed"

    # 7. Duplicate delivery
    with (
        patch("app.api.worker.get_push_provider") as mock_provider_fn,
        patch("app.api.worker.acquire_slot", new_callable=AsyncMock, return_value=True),
    ):
        mock_provider_fn.return_value = AsyncMock()
        dup = await api_client.post(
            "/api/v1/worker/deliver",
            json={
                "ping_id": ping1_id,
                "channel_id": channel_id,
                "fan_id": fan_a_id,
                "message": "Show at 5PM",
                "kind": "message",
                "idempotency_key": job_key,
            },
        )
    assert dup.json() == {"status": "duplicate"}
    captured.append(dup)

    # 8. Fan A unsubscribes; next ping's worker returns opted_out
    unsub_a = await api_client.post(
        "/api/v1/unsubscribe",
        json=signed_subscribe("kodrock", fan_a, action="unsubscribe"),
    )
    assert unsub_a.status_code == 200
    captured.append(unsub_a)

    with patch("app.services.fanout_service.publish", new_callable=AsyncMock):
        # Re-subscribe temporarily to create a job path... no: after unsubscribe
        # fanout creates 0 jobs. Seed a queued job manually for the opted_out path.
        pass

    # Create a second ping while A is opted out — 0 recipients
    with patch("app.services.fanout_service.publish", new_callable=AsyncMock):
        ping2 = await api_client.post(
            "/api/v1/pings",
            json={"channel_id": channel_id, "message": "Second ping"},
            headers=headers,
        )
    assert ping2.status_code == 200
    assert ping2.json()["total_recipients"] == 0
    captured.append(ping2)

    # Manual job for opted_out worker check (plan step 8)
    ping2_id = ping2.json()["id"]
    job2_key = f"{ping2_id}:{fan_a_id}:push"
    await MessageQueueJobRepo(db_session).create(
        ping_id=ping2_id,
        channel_id=channel_id,
        fan_id=fan_a_id,
        delivery_method="push",
        payload={"message": "Second ping", "kind": "message"},
        idempotency_key=job2_key,
    )
    with (
        patch("app.api.worker.get_push_provider") as mock_provider_fn,
        patch("app.api.worker.acquire_slot", new_callable=AsyncMock, return_value=True),
    ):
        mock_provider_fn.return_value = AsyncMock()
        opted = await api_client.post(
            "/api/v1/worker/deliver",
            json={
                "ping_id": ping2_id,
                "channel_id": channel_id,
                "fan_id": fan_a_id,
                "message": "Second ping",
                "kind": "message",
                "idempotency_key": job2_key,
            },
        )
    assert opted.json() == {"status": "opted_out"}
    captured.append(opted)

    # 9. Go live — live ping + notary publish
    with (
        patch("app.services.fanout_service.publish", new_callable=AsyncMock),
        patch("app.api.channels.publish", new_callable=AsyncMock) as notary_pub,
    ):
        live = await api_client.post(
            f"/api/v1/channels/{channel_id}/live",
            json={"live": True},
            headers=headers,
        )
    assert live.status_code == 200 and live.json()["is_live"] is True
    captured.append(live)
    assert notary_pub.call_count == 1
    assert notary_pub.call_args.args[0] == "/api/v1/worker/notary"
    from app.db.models import Ping

    live_ping_rows = (
        await db_session.execute(select(Ping).where(Ping.kind == "live"))
    ).scalars().all()
    assert len(live_ping_rows) == 1

    # 10. Machine path — API key
    key_resp = await api_client.post(
        f"/api/v1/channels/{channel_id}/api-key", headers=headers
    )
    assert key_resp.status_code == 200
    captured.append(key_resp)
    api_key = key_resp.json()["api_key"]
    assert api_key.startswith("pin_sk_")

    with patch("app.services.fanout_service.publish", new_callable=AsyncMock):
        machine_ping = await api_client.post(
            "/api/v1/pings",
            json={"channel_id": channel_id, "message": "From BreakSuite"},
            headers={"X-Channel-Key": api_key},
        )
    assert machine_ping.status_code == 200
    captured.append(machine_ping)

    with (
        patch("app.services.fanout_service.publish", new_callable=AsyncMock),
        patch("app.api.channels.publish", new_callable=AsyncMock),
    ):
        # End live first so go-live can fire again
        await api_client.post(
            f"/api/v1/channels/{channel_id}/live",
            json={"live": False},
            headers={"X-Channel-Key": api_key},
        )
        machine_live = await api_client.post(
            f"/api/v1/channels/{channel_id}/live",
            json={"live": True},
            headers={"X-Channel-Key": api_key},
        )
    assert machine_live.status_code == 200
    captured.append(machine_live)

    bad_key = await api_client.post(
        "/api/v1/pings",
        json={"channel_id": channel_id, "message": "nope"},
        headers={"X-Channel-Key": "pin_sk_wrong"},
    )
    assert bad_key.status_code == 401
    captured.append(bad_key)

    # 11. No phone-like strings / no signature echoes in response bodies
    for resp in captured:
        assert_safe_response(resp)
