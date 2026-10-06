# backend/app/api/devices.py
# Wallet-signed device token registration/revoke. The token is opaque push
# routing data (OneSignal user id); no personal identity is involved.
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories import DeviceTokenRepo, FanRepo
from app.db.session import get_session
from app.models.schemas import (
    DeviceRegisterRequest,
    DeviceResponse,
    DeviceRevokeRequest,
)
from app.services.signature_service import canonical_message, is_fresh, verify_signature

router = APIRouter(prefix="/api/v1", tags=["devices"])


async def _verify_fan(req, action: str, session: AsyncSession):
    if not is_fresh(req.timestamp):
        raise HTTPException(status_code=401, detail="Invalid signature")
    message = canonical_message(action, [req.wallet_address, req.token], req.timestamp)
    if not verify_signature(message, req.signature, req.wallet_address):
        raise HTTPException(status_code=401, detail="Invalid signature")
    return await FanRepo(session).get_by_wallet(req.wallet_address)


@router.post("/devices", response_model=DeviceResponse)
async def register_device(req: DeviceRegisterRequest, session: Annotated[AsyncSession, Depends(get_session)]):
    fan = await _verify_fan(req, "device", session)
    if fan is None:
        fan = await FanRepo(session).create(wallet_address=req.wallet_address, commit=False)
        await DeviceTokenRepo(session).upsert(fan.id, req.token, req.platform, commit=False)
        await session.commit()
    else:
        await DeviceTokenRepo(session).upsert(fan.id, req.token, req.platform)
    return DeviceResponse(success=True)


@router.post("/devices/revoke", response_model=DeviceResponse)
async def revoke_device(req: DeviceRevokeRequest, session: Annotated[AsyncSession, Depends(get_session)]):
    fan = await _verify_fan(req, "device-revoke", session)
    if fan is not None:
        await DeviceTokenRepo(session).delete_for_fan(req.token, fan.id)
    return DeviceResponse(success=True)  # idempotent
