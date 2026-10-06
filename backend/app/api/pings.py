# backend/app/api/pings.py
# Ping creation with quota, stats, and fan-out (ADR 0006).
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_creator_id
from app.core.channel_auth import authorize_channel_access
from app.db.repositories import AnonymousLinkRepo, ChannelRepo, PingRepo
from app.db.session import get_session
from app.models.schemas import ChannelStatsResponse, PingCreate, PingResponse
from app.services.fanout_service import fanout_ping
from app.services.quota_service import check_and_consume_quota

router = APIRouter(prefix="/api/v1", tags=["pings"])


@router.post("/pings", response_model=PingResponse)
async def create_ping(
    req: PingCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    x_channel_key: Annotated[str | None, Header()] = None,
    authorization: Annotated[str | None, Header()] = None,
) -> PingResponse:
    channel = await authorize_channel_access(session, req.channel_id, x_channel_key, authorization)

    await check_and_consume_quota(session, channel, kind="message")

    ping = await PingRepo(session).create(
        channel_id=channel.id,
        message=req.message,
        delivery_method="push",
        kind="message",
        status="processing",
        commit=False,
    )
    count = await fanout_ping(session, ping.id, channel.id, req.message, "message")
    await PingRepo(session).update_counts(ping.id, total_recipients=count, status="queued")

    return PingResponse(
        id=str(ping.id),
        status="queued",
        total_recipients=count,
        sent_count=0,
        failed_count=0,
    )


@router.get("/pings/{ping_id}", response_model=PingResponse)
async def get_ping(
    ping_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
    creator_id: Annotated[str, Depends(get_current_creator_id)],
) -> PingResponse:
    ping = await PingRepo(session).get(ping_id)
    if ping is None:
        raise HTTPException(status_code=404, detail="Ping not found")
    channel = await ChannelRepo(session).get(ping.channel_id)
    if channel is None or str(channel.creator_id) != creator_id:
        raise HTTPException(status_code=403, detail="Not your channel")

    return PingResponse(
        id=str(ping.id),
        status=ping.status or "pending",
        total_recipients=ping.total_recipients or 0,
        sent_count=ping.sent_count or 0,
        failed_count=ping.failed_count or 0,
    )


@router.get("/channels/{channel_id}/stats", response_model=ChannelStatsResponse)
async def channel_stats(
    channel_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
    creator_id: Annotated[str, Depends(get_current_creator_id)],
) -> ChannelStatsResponse:
    channel = await ChannelRepo(session).get(channel_id)
    if channel is None:
        raise HTTPException(status_code=404, detail="Channel not found")
    if str(channel.creator_id) != creator_id:
        raise HTTPException(status_code=403, detail="Not your channel")

    subscriber_count = await AnonymousLinkRepo(session).count_active(channel.id)

    return ChannelStatsResponse(
        subscriber_count=subscriber_count,
        pings_sent_this_period=channel.pings_sent_this_period or 0,
        monthly_ping_limit=channel.monthly_ping_limit or 0,
    )