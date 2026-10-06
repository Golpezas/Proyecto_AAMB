# backend/app/api/subscription.py
# Wallet-signed subscribe/unsubscribe. Nothing identifying ever leaves the
# server: the response carries only fan_id (PII isolation invariant).
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories import ChannelRepo
from app.db.session import get_session
from app.models.schemas import SignedFanRequest, SubscribeResponse, UnsubscribeResponse
from app.services import subscription_service
from app.services.signature_service import canonical_message, is_fresh, verify_signature

router = APIRouter(prefix="/api/v1", tags=["subscriptions"])


async def _verify(req: SignedFanRequest, action: str, session: AsyncSession):
    channel = await ChannelRepo(session).get_by_handle(req.channel_handle)
    if channel is None:
        raise HTTPException(status_code=404, detail="Channel not found")
    message = canonical_message(action, [req.channel_handle, req.wallet_address], req.timestamp)
    if not is_fresh(req.timestamp) or not verify_signature(message, req.signature, req.wallet_address):
        raise HTTPException(status_code=401, detail="Invalid signature")
    return channel


@router.post("/subscribe", response_model=SubscribeResponse)
async def subscribe(req: SignedFanRequest, session: Annotated[AsyncSession, Depends(get_session)]) -> SubscribeResponse:
    channel = await _verify(req, "subscribe", session)
    fan = await subscription_service.subscribe(session, channel.id, req.wallet_address)
    return SubscribeResponse(success=True, fan_id=str(fan.id))


@router.post("/unsubscribe", response_model=UnsubscribeResponse)
async def unsubscribe(req: SignedFanRequest, session: Annotated[AsyncSession, Depends(get_session)]) -> UnsubscribeResponse:
    channel = await _verify(req, "unsubscribe", session)
    await subscription_service.unsubscribe(session, channel.id, req.wallet_address)
    return UnsubscribeResponse(success=True)
