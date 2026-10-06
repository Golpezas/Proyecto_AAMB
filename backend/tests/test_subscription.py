# backend/tests/test_subscription.py
import time
import uuid

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
    creator = Creator(id=uuid.uuid4(), email="c@example.com", handle="creator")
    channel = Channel(id=uuid.uuid4(), creator_id=creator.id, handle="alice", signing_key="sk")
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
