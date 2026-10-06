# backend/app/services/subscription_service.py
# Single-transaction subscribe/unsubscribe on wallet identity (ADR 0006).
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Fan
from app.db.repositories import AnonymousLinkRepo, FanRepo


async def subscribe(
    session: AsyncSession, channel_id: str | uuid.UUID, wallet_address: str
) -> Fan:
    fan_repo, link_repo = FanRepo(session), AnonymousLinkRepo(session)
    fan = await fan_repo.get_by_wallet(wallet_address)
    if fan is None:
        fan = await fan_repo.create(wallet_address=wallet_address, commit=False)
    link = await link_repo.get_by_channel_and_fan(channel_id, fan.id)
    if link is None:
        await link_repo.create(channel_id=channel_id, fan_id=fan.id, commit=False)
    elif link.status != "active":
        await link_repo.reactivate(channel_id, fan.id, commit=False)
    try:
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    return fan


async def unsubscribe(
    session: AsyncSession, channel_id: str | uuid.UUID, wallet_address: str
) -> None:
    fan = await FanRepo(session).get_by_wallet(wallet_address)
    if fan is None:
        return  # idempotent: unsubscribing a never-subscribed wallet succeeds
    link = await AnonymousLinkRepo(session).get_by_channel_and_fan(channel_id, fan.id)
    if link is not None and link.status == "active":
        await AnonymousLinkRepo(session).set_opted_out(channel_id, fan.id)
