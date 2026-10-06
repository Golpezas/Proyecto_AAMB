# backend/app/services/queue_service.py
import httpx

from app.core.config import settings


async def publish(path: str, body: dict) -> str:
    """Publish one QStash message whose destination is public_api_url + path."""
    destination = f"{settings.public_api_url}{path}"
    url = f"https://qstash.upstash.io/v2/publish/{destination}"
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            url,
            json=body,
            headers={"Authorization": f"Bearer {settings.upstash_qstash_token}"},
        )
        resp.raise_for_status()
        return resp.json().get("messageId", "")
