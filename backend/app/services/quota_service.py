# backend/app/services/quota_service.py
# Quota enforcement for ping creation (ADR 0006 rule 5).
# kind="message" validates against monthly_ping_limit; kind="live" is quota-exempt.
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Channel

PERIOD_DAYS = 30


async def check_and_consume_quota(session: AsyncSession, channel: Channel, kind: str = "message") -> tuple[Channel, int]:
    """
    Check quota and consume one slot for kind="message".
    Returns (channel, remaining_quota).
    For kind="live": quota-exempt, returns (channel, limit - used).
    Raises HTTPException(402) if exhausted.
    """
    now = datetime.now(UTC)
    used = channel.pings_sent_this_period or 0
    start = channel.period_start

    # Check if period has rolled over (30 days from period_start)
    # Handle both timezone-aware and naive datetimes (SQLite may store naive)
    if start is not None:
        if start.tzinfo is None:
            start = start.replace(tzinfo=UTC)
        if (now - start).days >= PERIOD_DAYS:
            used = 0
            channel.period_start = now
    else:
        channel.period_start = now

    limit = channel.monthly_ping_limit or 0

    if kind == "message":
        if used >= limit:
            await session.rollback()
            raise HTTPException(status_code=402, detail="Monthly ping limit exceeded")
        channel.pings_sent_this_period = used + 1
        await session.commit()
        return channel, limit - (used + 1)
    else:
        # kind="live" is quota-exempt
        return channel, limit - used