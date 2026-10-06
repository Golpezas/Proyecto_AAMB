# backend/app/core/channel_auth.py
# Dual auth for machine-reachable endpoints: a per-channel API key
# (X-Channel-Key) or the owning creator's Supabase JWT. Everything else
# stays JWT-only (ADR 0005 + 2026-10-06 revision).
import hashlib

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_creator_id
from app.db.repositories import ChannelRepo


async def authorize_channel_access(
    session: AsyncSession,
    channel_id: str,
    x_channel_key: str | None,
    authorization: str | None,
):
    channel = await ChannelRepo(session).get(channel_id)
    if channel is None:
        raise HTTPException(status_code=404, detail="Channel not found")
    if x_channel_key is not None:
        digest = hashlib.sha256(x_channel_key.encode()).hexdigest()
        if channel.api_key_hash is not None and channel.api_key_hash == digest:
            return channel
        raise HTTPException(status_code=401, detail="Invalid channel key")
    if authorization is not None:
        creator_id = get_current_creator_id(authorization)  # sync call, raw header value
        if str(channel.creator_id) != creator_id:
            raise HTTPException(status_code=403, detail="Not your channel")
        return channel
    raise HTTPException(status_code=401, detail="Missing credentials")