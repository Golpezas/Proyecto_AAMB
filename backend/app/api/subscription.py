# backend/app/api/subscription.py
# Anonymous PIN-based subscription. The handler never returns (or logs) the
# raw phone number or its ciphertext -- the response carries only the new
# fan_id (PII isolation invariant). The three row inserts happen in ONE
# transaction via subscription_service.create_subscription.
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories import ChannelRepo
from app.db.session import get_session
from app.models.schemas import SubscribeRequest, SubscribeResponse
from app.services.pin_service import verify_pin
from app.services.subscription_service import create_subscription

router = APIRouter(prefix="/api/v1", tags=["subscriptions"])


@router.post("/subscribe", response_model=SubscribeResponse)
async def subscribe(
    req: SubscribeRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SubscribeResponse:
    channel = await ChannelRepo(session).get_by_handle(req.channel_handle)
    if channel is None:
        raise HTTPException(status_code=404, detail="Channel not found")

    # 401 both for "no PIN configured" and "wrong PIN": identical response,
    # so callers cannot use the status code as a PIN-existence oracle.
    if not channel.pin_hash or not verify_pin(req.pin, channel.pin_hash):
        raise HTTPException(status_code=401, detail="Invalid PIN")

    fan = await create_subscription(session, channel.id, req.phone)
    return SubscribeResponse(success=True, fan_id=str(fan.id))
