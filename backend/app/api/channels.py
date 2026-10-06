# backend/app/api/channels.py
# Creator registration (channel creation) and PIN management.
#
# Auth: Supabase Auth JWT verified in app.core.auth (ADR 0005). The caller's
# `sub` IS `creators.id`, so ownership is checkable in the API even though the
# DB connection is privileged (RLS bypassed) -- see the 403 below.
#
# Invariants enforced here:
#   - responses never include pin_hash or signing_key (narrow response models)
#   - one channel per creator (MVP rule, 409)
#   - handle uniqueness across channels (409)
import secrets
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CreatorClaims, get_current_creator, get_current_creator_id
from app.db.models import Channel
from app.db.repositories import ChannelRepo, CreatorRepo
from app.db.session import get_session
from app.models.schemas import (
    ChannelCreateRequest,
    ChannelCreateResponse,
    PinSetRequest,
    PinSetResponse,
)
from app.services.pin_service import hash_pin

router = APIRouter(prefix="/api/v1", tags=["channels"])


async def _get_channel_or_404(session: AsyncSession, channel_id: str) -> Channel:
    try:
        cid = uuid.UUID(channel_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Channel not found")
    channel = await ChannelRepo(session).get(cid)
    if channel is None:
        raise HTTPException(status_code=404, detail="Channel not found")
    return channel


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


@router.post("/channels/{channel_id}/pin", response_model=PinSetResponse)
async def set_channel_pin(
    channel_id: str,
    req: PinSetRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    creator_id: Annotated[str, Depends(get_current_creator_id)],
) -> PinSetResponse:
    channel = await _get_channel_or_404(session, channel_id)

    # Ownership: the DB connection bypasses RLS, so the API enforces it
    # explicitly (creators.id == auth.uid(), ADR 0005).
    if channel.creator_id is None or str(channel.creator_id) != str(
        uuid.UUID(creator_id)
    ):
        raise HTTPException(
            status_code=403, detail="Not allowed to modify this channel"
        )

    await ChannelRepo(session).set_pin_hash(channel.id, hash_pin(req.pin))
    return PinSetResponse(success=True)
