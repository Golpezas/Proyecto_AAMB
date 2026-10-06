# backend/app/services/fanout_service.py
# Fan-out: create jobs in ONE transaction, then enqueue (ADR 0004 flow).
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories import AnonymousLinkRepo, MessageQueueJobRepo
from app.services.queue_service import publish


async def fanout_ping(
    session: AsyncSession,
    ping_id: str | uuid.UUID,
    channel_id: str | uuid.UUID,
    message: str,
    kind: str,
) -> int:
    fan_ids = await AnonymousLinkRepo(session).list_active_fan_ids(channel_id)
    bodies: list[dict] = []
    jobs = MessageQueueJobRepo(session)
    for fan_id in fan_ids:
        key = f"{ping_id}:{fan_id}:push"
        await jobs.create(
            ping_id=ping_id,
            channel_id=channel_id,
            fan_id=fan_id,
            delivery_method="push",
            payload={"message": message, "kind": kind},
            idempotency_key=key,
            commit=False,
        )
        bodies.append(
            {
                "ping_id": str(ping_id),
                "channel_id": str(channel_id),
                "fan_id": str(fan_id),
                "message": message,
                "kind": kind,
                "idempotency_key": key,
            }
        )
    await session.commit()
    for body in bodies:
        await publish("/api/v1/worker/deliver", body)
    return len(bodies)
