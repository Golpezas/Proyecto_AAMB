# backend/tests/test_queue.py
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.queue_service import publish


@pytest.mark.asyncio
async def test_publish_posts_to_qstash_with_auth():
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"messageId": "msg_1"}
    mock_resp.raise_for_status.return_value = None
    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.post.return_value = mock_resp
    with patch("app.services.queue_service.httpx.AsyncClient", return_value=mock_client), \
         patch("app.services.queue_service.settings") as s:
        s.public_api_url = "https://api.example.com"
        s.upstash_qstash_token = "tok"
        msg_id = await publish("/api/v1/worker/deliver", {"a": 1})
    assert msg_id == "msg_1"
    url = mock_client.post.call_args.args[0]
    assert url == "https://qstash.upstash.io/v2/publish/https://api.example.com/api/v1/worker/deliver"
    assert mock_client.post.call_args.kwargs["headers"] == {"Authorization": "Bearer tok"}
    assert mock_client.post.call_args.kwargs["json"] == {"a": 1}
