# backend/tests/test_channels.py
# POST /api/v1/channels and POST /api/v1/channels/{id}/pin with Supabase JWT
# creator auth. Uses the async `api_client` fixture (httpx + ASGITransport)
# so the app and the in-memory SQLite StaticPool connection share one event
# loop. The only thing monkeypatched is the JWT secret -- DB and auth
# internals run for real.
import uuid

import jwt
import pytest

from app.core.config import settings
from app.db.repositories import ChannelRepo, CreatorRepo
from app.services.pin_service import verify_pin

TEST_SECRET = "test-supabase-jwt-secret-do-not-use-in-prod"
AUDIENCE = "authenticated"


def mint_token(
    sub: str | None = None,
    email: str | None = "creator@example.com",
    *,
    secret: str = TEST_SECRET,
    **extra_claims,
) -> str:
    payload = {
        "sub": sub or str(uuid.uuid4()),
        "aud": AUDIENCE,
        **extra_claims,
    }
    if email is not None:
        payload["email"] = email
    return jwt.encode(payload, secret, algorithm="HS256")


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def jwt_secret(monkeypatch):
    # The empty default must never be active during tests: an unconfigured
    # secret is a 500 by design (fail loud), not an auth bypass.
    monkeypatch.setattr(settings, "supabase_jwt_secret", TEST_SECRET)


@pytest.fixture
def auth_headers():
    return bearer(mint_token())


@pytest.fixture
def other_creator_headers():
    return bearer(mint_token(email="other@example.com"))


async def create_channel(client, headers, handle="mychannel"):
    return await client.post("/api/v1/channels", json={"handle": handle}, headers=headers)


async def test_create_channel_ok(api_client, auth_headers, db_session):
    resp = await create_channel(api_client, auth_headers, handle="mychannel")
    assert resp.status_code == 200
    data = resp.json()
    assert data["handle"] == "mychannel"
    assert data["subscription_tier"] == "free"
    assert data["monthly_ping_limit"] == 100
    assert data["id"]
    # secrets must never leave the server
    assert "pin_hash" not in data
    assert "signing_key" not in data

    channel = await ChannelRepo(db_session).get_by_handle("mychannel")
    assert channel is not None
    assert channel.pin_hash is None
    assert channel.signing_key  # generated, non-empty
    assert "mychannel" not in channel.signing_key


async def test_create_channel_upserts_creator(api_client, auth_headers, db_session):
    resp = await create_channel(api_client, auth_headers)
    assert resp.status_code == 200
    sub = jwt.decode(
        auth_headers["Authorization"].removeprefix("Bearer "),
        TEST_SECRET,
        algorithms=["HS256"],
        audience=AUDIENCE,
    )["sub"]

    creator = await CreatorRepo(db_session).get(sub)
    assert creator is not None
    # creators.id == auth.uid(): the Supabase sub IS the creator primary key
    assert str(creator.id) == sub
    assert creator.email == "creator@example.com"
    assert creator.handle == "mychannel"


async def test_create_channel_without_auth(api_client):
    resp = await create_channel(api_client, headers={})
    assert resp.status_code == 401


async def test_create_channel_malformed_auth_header(api_client):
    resp = await create_channel(api_client, headers={"Authorization": "Token abc"})
    assert resp.status_code == 401


async def test_create_channel_tampered_token(api_client):
    # signed with the wrong secret -> signature verification fails
    resp = await create_channel(
        api_client,
        headers=bearer(mint_token(secret="wrong-secret- definitely not the key!!")),
    )
    assert resp.status_code == 401


async def test_create_channel_expired_token(api_client):
    token = mint_token(exp=1)  # expired long ago
    resp = await create_channel(api_client, headers=bearer(token))
    assert resp.status_code == 401


async def test_create_channel_auth_not_configured(api_client, monkeypatch):
    # fail loud: empty secret is a 500, never a silent accept
    monkeypatch.setattr(settings, "supabase_jwt_secret", "")
    resp = await create_channel(api_client, headers=bearer(mint_token()))
    assert resp.status_code == 500
    assert "not configured" in resp.json()["detail"]


@pytest.mark.parametrize(
    "handle", ["", "UPPER", "has space", "dash-not-allowed", "a" * 33]
)
async def test_create_channel_invalid_handle(api_client, auth_headers, handle):
    resp = await create_channel(api_client, auth_headers, handle=handle)
    assert resp.status_code == 422


async def test_create_channel_duplicate_handle(
    api_client, auth_headers, other_creator_headers
):
    first = await create_channel(api_client, auth_headers, handle="taken")
    assert first.status_code == 200

    second = await create_channel(api_client, other_creator_headers, handle="taken")
    assert second.status_code == 409


async def test_create_second_channel_same_creator(api_client, auth_headers):
    first = await create_channel(api_client, auth_headers, handle="first")
    assert first.status_code == 200

    second = await create_channel(api_client, auth_headers, handle="second")
    assert second.status_code == 409


async def test_set_pin(api_client, auth_headers, db_session):
    created = await create_channel(api_client, auth_headers)
    channel_id = created.json()["id"]

    resp = await api_client.post(
        f"/api/v1/channels/{channel_id}/pin",
        json={"pin": "123456"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json() == {"success": True}
    # never echo the plaintext PIN or the hash
    assert "123456" not in resp.text

    channel = await ChannelRepo(db_session).get(channel_id)
    assert channel.pin_hash is not None
    assert channel.pin_hash != "123456"
    assert channel.pin_hash.startswith("$2")  # bcrypt
    assert "123456" not in channel.pin_hash
    assert verify_pin("123456", channel.pin_hash) is True
    assert verify_pin("654321", channel.pin_hash) is False


async def test_set_pin_other_creators_channel(
    api_client, auth_headers, other_creator_headers
):
    created = await create_channel(api_client, auth_headers)
    channel_id = created.json()["id"]

    resp = await api_client.post(
        f"/api/v1/channels/{channel_id}/pin",
        json={"pin": "123456"},
        headers=other_creator_headers,
    )
    assert resp.status_code == 403


async def test_set_pin_unknown_channel(api_client, auth_headers):
    resp = await api_client.post(
        f"/api/v1/channels/{uuid.uuid4()}/pin",
        json={"pin": "123456"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_set_pin_malformed_channel_id(api_client, auth_headers):
    resp = await api_client.post(
        "/api/v1/channels/not-a-uuid/pin",
        json={"pin": "123456"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_set_pin_invalid_pin(api_client, auth_headers):
    created = await create_channel(api_client, auth_headers)
    channel_id = created.json()["id"]

    resp = await api_client.post(
        f"/api/v1/channels/{channel_id}/pin",
        json={"pin": "abc"},
        headers=auth_headers,
    )
    assert resp.status_code == 422
    # 422 handler must not echo the submitted value
    assert "abc" not in resp.text


async def test_set_pin_without_auth(api_client, auth_headers):
    created = await create_channel(api_client, auth_headers)
    channel_id = created.json()["id"]

    resp = await api_client.post(
        f"/api/v1/channels/{channel_id}/pin", json={"pin": "123456"}, headers={}
    )
    assert resp.status_code == 401
