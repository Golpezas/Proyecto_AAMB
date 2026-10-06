# backend/app/db/repositories.py
# Async repository classes over the SQLAlchemy models. Each repo takes an
# AsyncSession and exposes the methods its consumers (services/later tasks)
# need. IDs are accepted as str or uuid.UUID and normalized to UUID objects.
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AnonymousLink, Channel, Creator, Fan, Ping


def _to_uuid(value: str | uuid.UUID) -> uuid.UUID:
    if isinstance(value, uuid.UUID):
        return value
    return uuid.UUID(str(value))


class CreatorRepo:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, id: str | uuid.UUID) -> Creator | None:
        return await self._session.get(Creator, _to_uuid(id))

    async def create(self, email: str, handle: str) -> Creator:
        creator = Creator(email=email, handle=handle)
        self._session.add(creator)
        await self._session.commit()
        await self._session.refresh(creator)
        return creator


class ChannelRepo:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, id: str | uuid.UUID) -> Channel | None:
        return await self._session.get(Channel, _to_uuid(id))

    async def get_by_handle(self, handle: str) -> Channel | None:
        res = await self._session.execute(
            select(Channel).where(Channel.handle == handle)
        )
        return res.scalar_one_or_none()

    async def create(
        self,
        creator_id: str | uuid.UUID,
        handle: str,
        signing_key: str,
        subscription_tier: str = "free",
        monthly_ping_limit: int = 100,
    ) -> Channel:
        channel = Channel(
            creator_id=_to_uuid(creator_id),
            handle=handle,
            signing_key=signing_key,
            subscription_tier=subscription_tier,
            monthly_ping_limit=monthly_ping_limit,
        )
        self._session.add(channel)
        await self._session.commit()
        await self._session.refresh(channel)
        return channel

    async def set_pin_hash(
        self, channel_id: str | uuid.UUID, pin_hash: str
    ) -> Channel | None:
        channel = await self.get(channel_id)
        if channel is None:
            return None
        channel.pin_hash = pin_hash
        await self._session.commit()
        await self._session.refresh(channel)
        return channel


class FanRepo:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, id: str | uuid.UUID) -> Fan | None:
        return await self._session.get(Fan, _to_uuid(id))

    async def create(self) -> Fan:
        fan = Fan()
        self._session.add(fan)
        await self._session.commit()
        await self._session.refresh(fan)
        return fan


class AnonymousLinkRepo:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        channel_id: str | uuid.UUID,
        fan_id: str | uuid.UUID,
        wallet_address: str | None = None,
    ) -> AnonymousLink:
        link = AnonymousLink(
            channel_id=_to_uuid(channel_id),
            fan_id=_to_uuid(fan_id),
            wallet_address=wallet_address,
        )
        self._session.add(link)
        await self._session.commit()
        await self._session.refresh(link)
        return link

    async def list_active_fan_ids(
        self, channel_id: str | uuid.UUID
    ) -> list[str]:
        res = await self._session.execute(
            select(AnonymousLink.fan_id)
            .where(
                AnonymousLink.channel_id == _to_uuid(channel_id),
                AnonymousLink.status == "active",
            )
            .order_by(AnonymousLink.fan_id)
        )
        return [str(fan_id) for (fan_id,) in res.all()]

    async def get_by_channel_and_fan(
        self, channel_id: str | uuid.UUID, fan_id: str | uuid.UUID
    ) -> AnonymousLink | None:
        res = await self._session.execute(
            select(AnonymousLink).where(
                AnonymousLink.channel_id == _to_uuid(channel_id),
                AnonymousLink.fan_id == _to_uuid(fan_id),
            )
        )
        return res.scalar_one_or_none()

    async def set_opted_out(
        self, channel_id: str | uuid.UUID, fan_id: str | uuid.UUID
    ) -> AnonymousLink | None:
        link = await self.get_by_channel_and_fan(channel_id, fan_id)
        if link is None:
            return None
        link.status = "opted_out"
        link.opted_out_at = func.now()
        await self._session.commit()
        await self._session.refresh(link)
        return link


class PingRepo:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, id: str | uuid.UUID) -> Ping | None:
        return await self._session.get(Ping, _to_uuid(id))

    async def create(
        self,
        channel_id: str | uuid.UUID,
        message: str,
        delivery_method: str,
    ) -> Ping:
        ping = Ping(
            channel_id=_to_uuid(channel_id),
            message=message,
            delivery_method=delivery_method,
        )
        self._session.add(ping)
        await self._session.commit()
        await self._session.refresh(ping)
        return ping

    async def update_counts(
        self,
        id: str | uuid.UUID,
        total_recipients: int | None = None,
        sent_count: int | None = None,
        failed_count: int | None = None,
        status: str | None = None,
    ) -> Ping | None:
        ping = await self.get(id)
        if ping is None:
            return None
        if total_recipients is not None:
            ping.total_recipients = total_recipients
        if sent_count is not None:
            ping.sent_count = sent_count
        if failed_count is not None:
            ping.failed_count = failed_count
        if status is not None:
            ping.status = status
            if status == "completed":
                ping.completed_at = func.now()
        await self._session.commit()
        await self._session.refresh(ping)
        return ping