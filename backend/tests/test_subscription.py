# backend/tests/test_subscription.py
# POST /api/v1/subscribe. Uses the async `api_client` fixture (httpx +
# ASGITransport) so the app and the in-memory SQLite StaticPool connection
# share one event loop.
import base64
import os

import bcrypt
import pytest
from sqlalchemy import func, select

from app.core.config import settings
from app.db.models import EncryptedPhone, Fan
from app.db.repositories import (
    AnonymousLinkRepo,
    ChannelRepo,
    CreatorRepo,
    EncryptedPhoneRepo,
)
from app.services.crypto_service import decrypt_phone

HANDLE = "creator1"
PIN = "123456"
PHONE = "+15551234567"


@pytest.fixture(autouse=True)
def phone_encryption_key(monkeypatch):
    monkeypatch.setattr(
        settings,
        "phone_encryption_key",
        base64.b64encode(os.urandom(32)).decode(),
    )


@pytest.fixture
async def seeded_channel(db_session):
    creator = await CreatorRepo(db_session).create(
        email="c@example.com", handle=HANDLE
    )
    channel = await ChannelRepo(db_session).create(
        creator_id=creator.id, handle=HANDLE, signing_key="sk_test_123"
    )
    pin_hash = bcrypt.hashpw(PIN.encode(), bcrypt.gensalt(rounds=4)).decode()
    await ChannelRepo(db_session).set_pin_hash(channel.id, pin_hash)
    return channel


async def _subscribe(client, *, handle, pin=PIN, phone=PHONE):
    return await client.post(
        "/api/v1/subscribe",
        json={"channel_handle": handle, "pin": pin, "phone": phone},
    )


async def test_subscribe_with_valid_pin(api_client, seeded_channel):
    resp = await _subscribe(api_client, handle=seeded_channel.handle)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["fan_id"]
    # PII invariant: raw phone never leaves the server
    assert PHONE not in resp.text


async def test_subscribe_creates_anonymous_link(
    api_client, seeded_channel, db_session
):
    resp = await _subscribe(api_client, handle=seeded_channel.handle)
    assert resp.status_code == 200

    fan_id = resp.json()["fan_id"]
    link = await AnonymousLinkRepo(db_session).get_by_channel_and_fan(
        seeded_channel.id, fan_id
    )
    assert link is not None
    assert link.status == "active"


async def test_subscribe_wrong_pin(api_client, seeded_channel):
    resp = await _subscribe(api_client, handle=seeded_channel.handle, pin="999999")
    assert resp.status_code == 401


async def test_subscribe_channel_without_pin_hash(api_client, db_session):
    creator = await CreatorRepo(db_session).create(
        email="nopin@example.com", handle="nopin"
    )
    channel = await ChannelRepo(db_session).create(
        creator_id=creator.id, handle="nopin", signing_key="sk_test_456"
    )
    resp = await _subscribe(api_client, handle=channel.handle)
    assert resp.status_code == 401


async def test_subscribe_unknown_handle(api_client, seeded_channel):
    resp = await _subscribe(api_client, handle="ghostchannel")
    assert resp.status_code == 404


async def test_subscribe_stores_encrypted_phone(
    api_client, seeded_channel, db_session
):
    resp = await _subscribe(api_client, handle=seeded_channel.handle)
    assert resp.status_code == 200

    fan_id = resp.json()["fan_id"]
    row = await EncryptedPhoneRepo(db_session).get_by_fan_id(fan_id)
    assert row is not None
    # at rest: ciphertext, never the plaintext phone
    assert row.phone_encrypted != PHONE.encode()
    assert PHONE.encode() not in row.phone_encrypted
    # ...but it round-trips back through the crypto service
    assert decrypt_phone(row.phone_encrypted) == PHONE
    # and no ciphertext echo in the response either
    assert PHONE not in resp.text


async def test_subscribe_failure_rolls_back_entire_flow(
    api_client, seeded_channel, db_session, monkeypatch
):
    """Atomicity: a mid-flow failure must not orphan rows.

    With the current (pre-fix) implementation each repo committed
    independently, so a failure creating the AnonymousLink left the Fan
    (and its ciphertext) behind. The unit-of-work service must roll back
    everything it flushed before the failure.
    """
    async def boom(*args, **kwargs):
        raise RuntimeError("link insert failed")

    monkeypatch.setattr(AnonymousLinkRepo, "create", boom)

    with pytest.raises(RuntimeError, match="link insert failed"):
        await _subscribe(api_client, handle=seeded_channel.handle)

    fan_count = (
        await db_session.execute(select(func.count()).select_from(Fan))
    ).scalar_one()
    phone_count = (
        await db_session.execute(select(func.count()).select_from(EncryptedPhone))
    ).scalar_one()
    assert fan_count == 0, "orphaned Fan must be rolled back"
    assert phone_count == 0, "ciphertext must not outlive a failed subscribe"


async def test_subscribe_validation_error_does_not_echo_phone(
    api_client, seeded_channel
):
    """PII hardening: a 422 must not reflect the submitted phone value back."""
    resp = await _subscribe(
        api_client, handle=seeded_channel.handle, phone="garbage"
    )
    assert resp.status_code == 422
    assert "garbage" not in resp.text
