# backend/app/api/api_keys.py
# Channel API key management (JWT-only, owner only)
import hashlib
import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_creator_id
from app.db.repositories import ChannelRepo
from app.db.session import get_session

router = APIRouter(prefix="/api/v1", tags=["api-keys"])


class ApiKeyResponse(BaseModel):
    api_key: str


class SuccessResponse(BaseModel):
    success: bool = True


@router.post("/channels/{channel_id}/api-key", response_model=ApiKeyResponse)
async def generate_api_key(
    channel_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
    creator_id: Annotated[str, Depends(get_current_creator_id)],
) -> ApiKeyResponse:
    channel = await ChannelRepo(session).get(channel_id)
    if channel is None:
        raise HTTPException(status_code=404, detail="Channel not found")
    if str(channel.creator_id) != creator_id:
        raise HTTPException(status_code=403, detail="Not your channel")

    # Generate key: "pin_sk_" + 24 bytes hex = 7 + 48 = 55 chars
    key = "pin_sk_" + secrets.token_hex(24)
    digest = hashlib.sha256(key.encode()).hexdigest()

    await ChannelRepo(session).set_api_key_hash(channel_id, digest)

    return ApiKeyResponse(api_key=key)


@router.delete("/channels/{channel_id}/api-key", response_model=SuccessResponse)
async def revoke_api_key(
    channel_id: str,
    session: Annotated[AsyncSession, Depends(get_session)],
    creator_id: Annotated[str, Depends(get_current_creator_id)],
) -> SuccessResponse:
    channel = await ChannelRepo(session).get(channel_id)
    if channel is None:
        raise HTTPException(status_code=404, detail="Channel not found")
    if str(channel.creator_id) != creator_id:
        raise HTTPException(status_code=403, detail="Not your channel")

    await ChannelRepo(session).set_api_key_hash(channel_id, None)

    return SuccessResponse(success=True)