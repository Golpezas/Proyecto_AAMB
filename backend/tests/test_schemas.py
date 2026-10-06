# backend/tests/test_schemas.py
from app.models.schemas import SubscribeRequest, PingCreate

import pytest
from pydantic import ValidationError

from app.models.schemas import (
    AnonymousLink,
    Channel,
    Creator,
    Fan,
    MessageQueueJob,
    Ping,
    PingResponse,
    SendResponse,
    WalletSubscribeRequest,
)

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

def test_subscribe_request_rejects_short_pin():
    with pytest.raises(ValidationError):
        SubscribeRequest(channel_handle="c", pin="123", phone="+15551234567")

def test_wallet_subscribe_request_valid():
    addr = "0x" + "ab" * 20
    req = WalletSubscribeRequest(channel_handle="creator1", wallet_address=addr)
    assert req.wallet_address == addr
    assert req.phone is None

def test_wallet_subscribe_request_rejects_bad_address():
    with pytest.raises(ValidationError):
        WalletSubscribeRequest(channel_handle="c", wallet_address="0xnope")

def test_ping_create_defaults_to_push():
    ping = PingCreate(channel_id="ch_1", message="hello")
    assert ping.delivery_method == "push"

def test_ping_create_rejects_unknown_delivery_method():
    with pytest.raises(ValidationError):
        PingCreate(channel_id="ch_1", message="hello", delivery_method="email")

def test_ping_create_message_length_boundary():
    ok = PingCreate(channel_id="ch_1", message="x" * 160)
    assert len(ok.message) == 160
    with pytest.raises(ValidationError):
        PingCreate(channel_id="ch_1", message="x" * 161)

def test_ping_response():
    resp = PingResponse(id="p1", status="pending", total_recipients=42)
    assert resp.status == "pending"
    assert resp.total_recipients == 42

def test_send_response():
    ok = SendResponse(success=True, provider_id="SM123")
    assert ok.error is None
    err = SendResponse(success=False, error="provider down")
    assert err.provider_id is None
    assert err.error == "provider down"

def test_creator_model():
    c = Creator(id="u1", email="c@example.com", handle="creator1")
    assert c.email == "c@example.com"
    assert c.created_at is None

def test_channel_model_defaults():
    ch = Channel(id="ch1", creator_id="u1", handle="creator1", signing_key="sk_test")
    assert ch.pin_hash is None
    assert ch.subscription_tier == "free"
    assert ch.monthly_ping_limit == 100
    assert ch.sms_sent_this_period == 0

def test_fan_model():
    f = Fan(id="f1")
    assert f.created_at is None

def test_anonymous_link_model_defaults():
    link = AnonymousLink(id="l1", channel_id="ch1", fan_id="f1")
    assert link.status == "active"
    assert link.wallet_address is None
    assert link.opted_out_at is None

def test_anonymous_link_requires_fan_id():
    with pytest.raises(ValidationError):
        AnonymousLink(id="l1", channel_id="ch1")

def test_ping_model_defaults():
    p = Ping(id="p1", channel_id="ch1", message="hi", delivery_method="both")
    assert p.status == "pending"
    assert p.total_recipients == 0
    assert p.failed_count == 0

def test_message_queue_job_model():
    job = MessageQueueJob(
        id="j1",
        ping_id="p1",
        channel_id="ch1",
        fan_id="f1",
        delivery_method="sms",
        payload={"message": "hi"},
        idempotency_key="p1:f1:sms",
    )
    assert job.status == "queued"
    assert job.retry_count == 0
    assert job.error_message is None

def test_message_queue_job_requires_idempotency_key():
    with pytest.raises(ValidationError):
        MessageQueueJob(
            id="j1",
            ping_id="p1",
            channel_id="ch1",
            fan_id="f1",
            delivery_method="sms",
            payload={},
        )
