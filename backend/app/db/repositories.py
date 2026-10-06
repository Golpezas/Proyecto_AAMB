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


async def _commit(session: AsyncSession) -> None:
    """Commit, rolling back before re-raising on failure.

    A failed commit leaves the AsyncSession in a "rollback required" state;
    without the rollback every later query on the injected session would raise
    PendingRollbackError instead of the original error surfacing once.
    """
    try:
        await session.commit()
    except Exception:
        await session.rollback()
        raise


class CreatorRepo:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, id: str | uuid.UUID) -> Creator | None:
        return await self._session.get(Creator, _to_uuid(id))

    async def create(self, email: str, handle: str) -> Creator:
        creator = Creator(email=email, handle=handle)
        self._session.add(creator)
        await _commit(self._session)
        await self._session.refresh(creator)
        return creator

    async def upsert(
        self,
        id: str | uuid.UUID,
        email: str,
        handle: str,
        commit: bool = True,
    ) -> Creator:
        """Insert or update the creator keyed by the Supabase user id.

        `creators.id` equals `auth.uid()` (ADR 0005), so the id is supplied
        by the caller (from the verified JWT `sub`), never generated here.
        """
        creator = await self.get(id)
        if creator is None:
            creator = Creator(id=_to_uuid(id), email=email, handle=handle)
            self._session.add(creator)
        else:
            creator.email = email
            creator.handle = handle
        if commit:
            await _commit(self._session)
        else:
            await self._session.flush()
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

    async def get_by_creator(
        self, creator_id: str | uuid.UUID
    ) -> Channel | None:
        res = await self._session.execute(
            select(Channel)
            .where(Channel.creator_id == _to_uuid(creator_id))
            .order_by(Channel.created_at)
        )
        return res.scalars().first()

    async def create(
        self,
        creator_id: str | uuid.UUID,
        handle: str,
        signing_key: str,
        subscription_tier: str = "free",
        monthly_ping_limit: int = 100,
        commit: bool = True,
    ) -> Channel:
        channel = Channel(
            creator_id=_to_uuid(creator_id),
            handle=handle,
            signing_key=signing_key,
            subscription_tier=subscription_tier,
            monthly_ping_limit=monthly_ping_limit,
        )
        self._session.add(channel)
        if commit:
            await _commit(self._session)
        else:
            # Unit-of-work mode: keep the caller's transaction open so sibling
            # inserts commit (or roll back) as one.
            await self._session.flush()
        await self._session.refresh(channel)
        return channel

class FanRepo:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, id: str | uuid.UUID) -> Fan | None:
        return await self._session.get(Fan, _to_uuid(id))

    async def get_by_wallet(self, wallet_address: str) -> Fan | None:
        res = await self._session.execute(
            select(Fan).where(Fan.wallet_address == wallet_address.lower())
        )
        return res.scalar_one_or_none()

    async def create(self, wallet_address: str, commit: bool = True) -> Fan:
        fan = Fan(wallet_address=wallet_address.lower())
        self._session.add(fan)
        if commit:
            await _commit(self._session)
        else:
            # Unit-of-work mode: assign ids via flush but keep the caller's
            # transaction open so sibling inserts commit (or roll back) as one.
            await self._session.flush()
        await self._session.refresh(fan)
        return fan


class AnonymousLinkRepo:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        channel_id: str | uuid.UUID,
        fan_id: str | uuid.UUID,
        commit: bool = True,
    ) -> AnonymousLink:
        link = AnonymousLink(
            channel_id=_to_uuid(channel_id),
            fan_id=_to_uuid(fan_id),
        )
        self._session.add(link)
        if commit:
            await _commit(self._session)
        else:
            await self._session.flush()
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
                # Skip rows with no fan attached; never emit "None".
                AnonymousLink.fan_id.is_not(None),
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
        self, channel_id: str | uuid.UUID, fan_id: str | uuid.UUID, commit: bool = True
    ) -> AnonymousLink | None:
        link = await self.get_by_channel_and_fan(channel_id, fan_id)
        if link is None:
            return None
        link.status = "opted_out"
        link.opted_out_at = func.now()
        if commit:
            await _commit(self._session)
        else:
            await self._session.flush()
        await self._session.refresh(link)
        return link

    async def reactivate(
        self, channel_id: str | uuid.UUID, fan_id: str | uuid.UUID, commit: bool = True
    ) -> AnonymousLink | None:
        link = await self.get_by_channel_and_fan(channel_id, fan_id)
        if link is None:
            return None
        link.status = "active"
        link.opted_out_at = None
        if commit:
            await _commit(self._session)
        else:
            await self._session.flush()
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
        await _commit(self._session)
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
        await _commit(self._session)
        await self._session.refresh(ping)
        return ping