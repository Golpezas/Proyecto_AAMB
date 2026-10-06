# backend/tests/test_devices.py
import time
import uuid

import pytest
from eth_account import Account
from eth_account.messages import encode_defunct

from app.db.models import Channel, Creator


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
        "/api/v1/devices/revoke", json={"token": "device-123", **_signed(acct, "device-revoke", "device-123")}
    )
    assert resp.status_code == 200 and resp.json()["success"] is True
    from app.db.repositories import DeviceTokenRepo, FanRepo
    fan = await FanRepo(db_session).get_by_wallet(acct.address.lower())
    assert await DeviceTokenRepo(db_session).list_by_fan(fan.id) == []


async def test_revoke_unknown_token_is_idempotent(api_client, acct):
    resp = await api_client.post(
        "/api/v1/devices/revoke", json={"token": "ghost", **_signed(acct, "device-revoke", "ghost")}
    )
    assert resp.status_code == 200 and resp.json()["success"] is True


async def test_token_casing_idempotent(api_client, db_session, acct):
    from app.db.repositories import DeviceTokenRepo, FanRepo

    wallet = acct.address.lower()
    await api_client.post(
        "/api/v1/devices",
        json={"token": "ABC", "platform": "web", **_signed(acct, "device", "ABC")},
    )
    resp = await api_client.post(
        "/api/v1/devices",
        json={"token": "abc", "platform": "web", **_signed(acct, "device", "abc")},
    )
    assert resp.status_code == 200
    fan = await FanRepo(db_session).get_by_wallet(wallet)
    tokens = await DeviceTokenRepo(db_session).list_by_fan(fan.id)
    assert len(tokens) == 1 and tokens[0].token == "abc"

    resp = await api_client.post(
        "/api/v1/devices/revoke", json={"token": "abc", **_signed(acct, "device-revoke", "abc")}
    )
    assert resp.status_code == 200
    assert await DeviceTokenRepo(db_session).list_by_fan(fan.id) == []
