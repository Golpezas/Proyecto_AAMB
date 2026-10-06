# backend/app/api/worker.py
import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ports import NotaryPort, PushProvider, SendResult
from app.db.repositories import (
    AnonymousLinkRepo,
    DeviceTokenRepo,
    MessageQueueJobRepo,
    PingRepo,
)
from app.db.session import get_session
from app.services.notary_service import get_notary
from app.services.onesignal_provider import OneSignalProvider
from app.services.rate_limiter import acquire_slot

router = APIRouter(prefix="/api/v1/worker", tags=["worker"])

logger = logging.getLogger(__name__)


class DeliverJob(BaseModel):
    ping_id: str
    channel_id: str
    fan_id: str
    message: str
    kind: str = "message"
    idempotency_key: str


class NotaryJob(BaseModel):
    event_id: str
    channel_id: str
    kind: str
    timestamp: int


def get_push_provider() -> PushProvider:
    return OneSignalProvider()


def _to_uuid(value: str) -> uuid.UUID:
    return uuid.UUID(str(value))


async def _finish_ping(session: AsyncSession, ping_id: str) -> None:
    repo = PingRepo(session)
    ping = await repo.get(ping_id)
    if ping is None:
        return
    done = (ping.sent_count or 0) + (ping.failed_count or 0)
    if ping.total_recipients and done >= ping.total_recipients:
        await repo.update_counts(ping_id, status="completed")


async def _bump(session: AsyncSession, ping_id: str, delivered: bool) -> None:
    repo = PingRepo(session)
    ping = await repo.get(ping_id)
    if ping is None:
        return
    sent = (ping.sent_count or 0) + (1 if delivered else 0)
    failed = (ping.failed_count or 0) + (0 if delivered else 1)
    await repo.update_counts(ping_id, sent_count=sent, failed_count=failed)
    await _finish_ping(session, ping_id)


@router.post("/deliver")
async def deliver(job: DeliverJob, session: Annotated[AsyncSession, Depends(get_session)]):
    if not await acquire_slot(job.channel_id):
        raise HTTPException(status_code=503, detail="Rate limited")  # QStash retries
    jobs = MessageQueueJobRepo(session)
    if not await jobs.claim(job.idempotency_key):
        return {"status": "duplicate"}
    link = await AnonymousLinkRepo(session).get_by_channel_and_fan(job.channel_id, job.fan_id)
    if link is None or link.status != "active":
        await jobs.mark(job.idempotency_key, "opted_out")
        await _bump(session, job.ping_id, delivered=False)
        return {"status": "opted_out"}
    tokens = await DeviceTokenRepo(session).list_by_fan(_to_uuid(job.fan_id))
    if not tokens:
        await jobs.mark(job.idempotency_key, "skipped")
        await _bump(session, job.ping_id, delivered=False)
        return {"status": "skipped"}
    result: SendResult = await get_push_provider().send([t.token for t in tokens], job.message)
    if result.success:
        await jobs.mark(job.idempotency_key, "sent")
        await _bump(session, job.ping_id, delivered=True)
        return {"status": "sent"}
    await jobs.mark(job.idempotency_key, "failed", error=result.error)
    await _bump(session, job.ping_id, delivered=False)
    return {"status": "failed"}


@router.post("/notary")
async def notary(job: NotaryJob):
    """Best-effort notary endpoint — never fails the go-live flow."""
    notary_port: NotaryPort = get_notary()
    try:
        await notary_port.record_event(job.model_dump())
        return {"status": "recorded"}
    except Exception:  # noqa: BLE001
        # Best-effort: log and return accepted, never fail
        logger.warning("notary record_event failed for event %s", job.event_id)
        return {"status": "accepted"}