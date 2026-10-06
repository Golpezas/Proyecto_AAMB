# backend/app/services/onesignal_provider.py
import httpx

from app.core.config import settings
from app.core.ports import SendResult


class OneSignalProvider:
    async def send(self, player_ids: list[str], message: str) -> SendResult:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    "https://api.onesignal.com/notifications",
                    headers={"Authorization": f"Key {settings.onesignal_rest_api_key}"},
                    json={
                        "app_id": settings.onesignal_app_id,
                        "target_channel": "push",
                        "include_aliases": {"onesignal_id": player_ids},
                        "contents": {"en": message},
                    },
                )
            data = await resp.json() if resp.status_code == 200 else {}
            if resp.status_code == 200 and not data.get("errors"):
                return SendResult(success=True, provider_id=data.get("id"))
            return SendResult(
                success=False,
                error=str(data.get("errors") or f"HTTP {resp.status_code}"),
            )
        except Exception as exc:  # noqa: BLE001 - network errors must not crash the worker
            return SendResult(success=False, error=str(exc))