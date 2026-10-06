# backend/app/api/channels.py
# Creator registration (channel creation) + go-live + channel status.
#
# Auth: Supabase Auth JWT verified in app.core.auth (ADR 0005). The caller's
# `sub` IS `creators.id`, so ownership is checkable in the API even though the
# DB connection is privileged (RLS bypassed) -- see the 403 below.
#
# Invariants enforced here:
#   - responses never include signing_key (narrow response models)
#   - one channel per creator (MVP rule, 409)
#   - handle uniqueness across channels (409)
#   - POST /channels/{id}/live accepts either JWT (creator) or X-Channel-Key (machine)
import logging
import secrets
import time
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CreatorClaims, get_current_creator, get_current_creator_id
from app.core.channel_auth import authorize_channel_access
from app.db.repositories import ChannelRepo, CreatorRepo, PingRepo
from app.db.session import get_session
from app.models.schemas import (
    ChannelCreateRequest,
    ChannelCreateResponse,
    ChannelStatusResponse,
    GoLiveRequest,
    GoLiveResponse,
)
from app.services.fanout_service import fanout_ping
from app.services.queue_service import publish

router = APIRouter(prefix="/api/v1", tags=["channels"])

logger = logging.getLogger(__name__)


@router.post("/channels", response_model=ChannelCreateResponse)
async def create_channel(
    req: ChannelCreateRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    creator: Annotated[CreatorClaims, Depends(get_current_creator)],
) -> ChannelCreateResponse:
    channel_repo = ChannelRepo(session)

    # MVP rule: ONE channel per creator.
    if await channel_repo.get_by_creator(creator.id) is not None:
        raise HTTPException(
            status_code=409, detail="Creator already has a channel"
        )
    if await channel_repo.get_by_handle(req.handle) is not None:
        raise HTTPException(status_code=409, detail="Handle already taken")

    # JWT `email` claim; tokens without one (custom claims, service roles)
    # get a deterministic placeholder so creators.email stays NOT NULL.
    email = creator.email or f"{creator.id}@placeholder.local"

    # Creator upsert + channel insert commit as ONE transaction: a handle
    # conflict must not leave a half-registered creator behind.
    try:
        await CreatorRepo(session).upsert(
            id=creator.id, email=email, handle=req.handle, commit=False
        )
        channel = await channel_repo.create(
            creator_id=creator.id,
            handle=req.handle,
            signing_key=secrets.token_urlsafe(32),
            commit=True,
        )
    except IntegrityError:
        # Unique-constraint race (creators.handle/email or channels.handle);
        # _commit/flush already failed, so roll the unit of work back.
        await session.rollback()
        raise HTTPException(status_code=409, detail="Handle already taken")

    return ChannelCreateResponse(
        id=str(channel.id),
        handle=channel.handle,
        subscription_tier=channel.subscription_tier or "free",
        monthly_ping_limit=channel.monthly_ping_limit or 100,
    )


@router.get("/channels/mine", response_model=ChannelStatusResponse)
async def get_my_channel(
    session: Annotated[AsyncSession, Depends(get_session)],
    creator_id: Annotated[str, Depends(get_current_creator_id)],
) -> ChannelStatusResponse:
    channel = await ChannelRepo(session).get_by_creator(creator_id)
    if channel is None:
        raise HTTPException(404, "No channel")
    return ChannelStatusResponse(
        id=str(channel.id),
        handle=channel.handle,
        is_live=channel.is_live,
        live_since=channel.live_since,
    )


@router.get("/channels/{channel_id}", response_model=ChannelStatusResponse)
async def get_channel(
    channel_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
    creator_id: Annotated[str, Depends(get_current_creator_id)],
) -> ChannelStatusResponse:
    channel = await ChannelRepo(session).get(channel_id)
    if channel is None:
        raise HTTPException(404, "Channel not found")
    if str(channel.creator_id) != creator_id:
        raise HTTPException(403, "Not your channel")
    return ChannelStatusResponse(
        id=str(channel.id),
        handle=channel.handle,
        is_live=channel.is_live,
        live_since=channel.live_since,
    )


@router.post("/channels/{channel_id}/live", response_model=GoLiveResponse)
async def set_live(
    channel_id: str,
    req: GoLiveRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    x_channel_key: Annotated[str | None, Header()] = None,
    authorization: Annotated[str | None, Header()] = None,
) -> GoLiveResponse:
    channel = await authorize_channel_access(session, channel_id, x_channel_key, authorization)

    if req.live and not channel.is_live:
        # Going live
        channel.is_live = True
        channel.live_since = func.now()
        ping = await PingRepo(session).create(
            channel_id=channel.id,
            message=f"@{channel.handle} is LIVE!",
            delivery_method="push",
            kind="live",
            status="processing",
            commit=False,
        )
        count = await fanout_ping(session, ping.id, channel.id, ping.message, "live")
        await PingRepo(session).update_counts(ping.id, total_recipients=count, status="queued")
        # Best-effort notary publish
        try:
            await publish("/api/v1/worker/notary", {
                "event_id": str(ping.id),
                "channel_id": str(channel.id),
                "kind": "go_live",
                "timestamp": int(time.time()),
            })
        except Exception:  # noqa: BLE001
            logger.warning("notary enqueue failed for ping %s", ping.id)
    elif not req.live and channel.is_live:
        # Going offline
        channel.is_live = False
        channel.live_since = None
        await session.commit()

    return GoLiveResponse(is_live=channel.is_live)