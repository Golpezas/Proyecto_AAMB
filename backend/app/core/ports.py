# backend/app/core/ports.py
from typing import Protocol

from pydantic import BaseModel


class SendResult(BaseModel):
    success: bool
    provider_id: str | None = None
    error: str | None = None

class SMSProvider(Protocol):
    async def send(self, to: str, body: str, channel_id: str) -> SendResult: ...

class PushProvider(Protocol):
    async def send(self, player_ids: list[str], message: str) -> SendResult: ...

class QueueProvider(Protocol):
    async def enqueue(self, job: dict) -> str: ...
    async def enqueue_batch(self, jobs: list[dict]) -> list[str]: ...

class NotaryPort(Protocol):
    async def record_event(self, payload: dict) -> bool: ...
