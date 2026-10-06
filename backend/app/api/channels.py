# backend/app/api/channels.py
# Creator registration (channel creation).
#
# Auth: Supabase Auth JWT verified in app.core.auth (ADR 0005). The caller's
# `sub` IS `creators.id`, so ownership is checkable in the API even though the
# DB connection is privileged (RLS bypassed) -- see the 403 below.
#
# Invariants enforced here:
#   - responses never include signing_key (narrow response models)
#   - one channel per creator (MVP rule, 409)
#   - handle uniqueness across channels (409)
import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CreatorClaims, get_current_creator
from app.db.repositories import ChannelRepo, CreatorRepo
from app.db.session import get_session
from app.models.schemas import (
    ChannelCreateRequest,
    ChannelCreateResponse,
)

router = APIRouter(prefix="/api/v1", tags=["channels"])


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
