# backend/tests/test_onesignal.py
from unittest.mock import AsyncMock, patch

import pytest

from app.services.onesignal_provider import OneSignalProvider


@pytest.mark.asyncio
async def test_send_success():
    mock_resp = AsyncMock(status_code=200)
    mock_resp.json.return_value = {"id": "notif-1", "errors": []}
    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.post.return_value = mock_resp
    with patch("app.services.onesignal_provider.httpx.AsyncClient", return_value=mock_client), \
         patch("app.services.onesignal_provider.settings") as s:
        s.onesignal_app_id = "app-id"
        s.onesignal_rest_api_key = "key"
        result = await OneSignalProvider().send(["dev-1"], "hello")
    assert result.success is True and result.provider_id == "notif-1"
    kwargs = mock_client.post.call_args
    assert kwargs.args[0] == "https://api.onesignal.com/notifications"
    assert kwargs.kwargs["headers"] == {"Authorization": "Key key"}
    assert kwargs.kwargs["json"] == {
        "app_id": "app-id",
        "target_channel": "push",
        "include_aliases": {"onesignal_id": ["dev-1"]},
        "contents": {"en": "hello"},
    }


@pytest.mark.asyncio
async def test_send_reports_errors():
    mock_resp = AsyncMock(status_code=200)
    mock_resp.json.return_value = {"id": None, "errors": {"invalid_player_ids": ["x"]}}
    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.post.return_value = mock_resp
    with patch("app.services.onesignal_provider.httpx.AsyncClient", return_value=mock_client), \
         patch("app.services.onesignal_provider.settings"):
        result = await OneSignalProvider().send(["x"], "hello")
    assert result.success is False and "invalid_player_ids" in (result.error or "")


import fakeredis.aioredis

from app.services import rate_limiter


async def test_acquire_slot_limits_per_window(monkeypatch):
    fake = fakeredis.aioredis.FakeRedis()
    monkeypatch.setattr(rate_limiter, "_redis", fake)
    assert all([await rate_limiter.acquire_slot("ch1", max_per_minute=3) for _ in range(3)])
    assert await rate_limiter.acquire_slot("ch1", max_per_minute=3) is False
    assert await rate_limiter.acquire_slot("ch2", max_per_minute=3) is True