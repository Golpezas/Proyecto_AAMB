# backend/tests/test_repositories.py
import uuid

import pytest
from sqlalchemy.exc import IntegrityError

from app.db.models import AnonymousLink
from app.db.repositories import (
    AnonymousLinkRepo,
    ChannelRepo,
    CreatorRepo,
    FanRepo,
    PingRepo,
)


async def _make_channel(channel_repo, creator_repo, creator=None, handle="creator1"):
    creator = creator or await creator_repo.create(
        email=f"{uuid.uuid4().hex}@example.com", handle=handle
    )
    return await channel_repo.create(
        creator_id=creator.id, handle=handle, signing_key="sk_test_123"
    )


@pytest.fixture
def creator_repo(db_session):
    return CreatorRepo(db_session)


@pytest.fixture
def channel_repo(db_session):
    return ChannelRepo(db_session)


@pytest.fixture
def fan_repo(db_session):
    return FanRepo(db_session)


@pytest.fixture
def link_repo(db_session):
    return AnonymousLinkRepo(db_session)


@pytest.fixture
def ping_repo(db_session):
    return PingRepo(db_session)


@pytest.mark.asyncio
async def test_create_and_get_creator(creator_repo):
    creator = await creator_repo.create(email="c@example.com", handle="creator1")
    assert creator.id is not None
    assert creator.handle == "creator1"

    fetched = await creator_repo.get(creator.id)
    assert fetched is not None
    assert fetched.email == "c@example.com"
    assert await creator_repo.get(uuid.uuid4()) is None


@pytest.mark.asyncio
async def test_create_and_get_channel(creator_repo, channel_repo):
    creator = await creator_repo.create(email="c@example.com", handle="creator1")
    channel = await channel_repo.create(
        creator_id=creator.id, handle="creator1", signing_key="sk_test_123"
    )
    assert channel.id is not None
    assert channel.subscription_tier == "free"
    assert channel.monthly_ping_limit == 100
    assert channel.pings_sent_this_period == 0

    fetched = await channel_repo.get(channel.id)
    assert fetched is not None
    assert fetched.handle == "creator1"
    assert fetched.signing_key == "sk_test_123"
    assert await channel_repo.get(uuid.uuid4()) is None


@pytest.mark.asyncio
async def test_channel_get_by_handle(creator_repo, channel_repo):
    await _make_channel(channel_repo, creator_repo)
    fetched = await channel_repo.get_by_handle("creator1")
    assert fetched is not None
    assert fetched.signing_key == "sk_test_123"
    assert await channel_repo.get_by_handle("does-not-exist") is None


@pytest.mark.asyncio
async def test_channel_handle_is_unique(creator_repo, channel_repo):
    creator = await creator_repo.create(email="c@example.com", handle="creator1")
    await _make_channel(channel_repo, creator_repo, creator=creator)
    with pytest.raises(IntegrityError):
        await _make_channel(channel_repo, creator_repo, creator=creator)


@pytest.mark.asyncio
async def test_session_recovers_after_failed_commit(creator_repo, channel_repo):
    creator = await creator_repo.create(email="c@example.com", handle="creator1")
    await _make_channel(channel_repo, creator_repo, creator=creator)

    with pytest.raises(IntegrityError):
        await _make_channel(channel_repo, creator_repo, creator=creator)

    # the injected session must not be poisoned by the failed commit:
    # subsequent reads and writes both still work
    fetched = await channel_repo.get_by_handle("creator1")
    assert fetched is not None
    assert fetched.signing_key == "sk_test_123"

    other = await creator_repo.create(email="d@example.com", handle="creator2")
    assert other.id is not None
    second_channel = await channel_repo.create(
        creator_id=other.id, handle="creator2", signing_key="sk_test_456"
    )
    assert second_channel.id is not None


@pytest.mark.asyncio
async def test_fan_wallet_is_unique(db_session):
    from app.db.repositories import FanRepo

    acct = "0x" + "11" * 20
    await FanRepo(db_session).create(wallet_address=acct)
    import sqlalchemy.exc

    with pytest.raises(sqlalchemy.exc.IntegrityError):
        await FanRepo(db_session).create(wallet_address=acct)


@pytest.mark.asyncio
async def test_create_and_get_fan(fan_repo):
    fan = await fan_repo.create(wallet_address="0x" + "22" * 20)
    assert fan.id is not None

    fetched = await fan_repo.get(fan.id)
    assert fetched is not None
    assert await fan_repo.get(uuid.uuid4()) is None


@pytest.mark.asyncio
async def test_create_anonymous_link_and_list_active_fans(
    creator_repo, channel_repo, fan_repo, link_repo
):
    channel = await _make_channel(channel_repo, creator_repo)
    fan1 = await fan_repo.create(wallet_address="0x" + "31" * 20)
    fan2 = await fan_repo.create(wallet_address="0x" + "32" * 20)

    link1 = await link_repo.create(channel_id=channel.id, fan_id=fan1.id)
    link2 = await link_repo.create(channel_id=channel.id, fan_id=fan2.id)
    assert link1.id is not None
    assert link2.id is not None
    assert link1.status == "active"

    active = await link_repo.list_active_fan_ids(channel.id)
    assert set(active) == {str(fan1.id), str(fan2.id)}
    assert await link_repo.list_active_fan_ids(uuid.uuid4()) == []


@pytest.mark.asyncio
async def test_list_active_fan_ids_skips_fanless_links(
    creator_repo, channel_repo, fan_repo, link_repo, db_session
):
    channel = await _make_channel(channel_repo, creator_repo)
    fan = await fan_repo.create(wallet_address="0x" + "33" * 20)
    await link_repo.create(channel_id=channel.id, fan_id=fan.id)

    # link with no fan attached: fan_id NULL must never be emitted
    db_session.add(
        AnonymousLink(channel_id=channel.id)
    )
    await db_session.commit()

    active = await link_repo.list_active_fan_ids(channel.id)
    assert active == [str(fan.id)]
    assert "None" not in active


@pytest.mark.asyncio
async def test_get_anonymous_link_by_channel_and_fan(
    creator_repo, channel_repo, fan_repo, link_repo
):
    channel = await _make_channel(channel_repo, creator_repo)
    fan = await fan_repo.create(wallet_address="0x" + "34" * 20)
    link = await link_repo.create(channel_id=channel.id, fan_id=fan.id)

    found = await link_repo.get_by_channel_and_fan(channel.id, fan.id)
    assert found is not None
    assert found.id == link.id
    assert await link_repo.get_by_channel_and_fan(uuid.uuid4(), fan.id) is None


@pytest.mark.asyncio
async def test_opt_out_removes_fan_from_active_list(
    creator_repo, channel_repo, fan_repo, link_repo
):
    channel = await _make_channel(channel_repo, creator_repo)
    fan1 = await fan_repo.create(wallet_address="0x" + "35" * 20)
    fan2 = await fan_repo.create(wallet_address="0x" + "36" * 20)
    await link_repo.create(channel_id=channel.id, fan_id=fan1.id)
    await link_repo.create(channel_id=channel.id, fan_id=fan2.id)

    updated = await link_repo.set_opted_out(channel.id, fan1.id)
    assert updated.status == "opted_out"
    assert updated.opted_out_at is not None

    active = await link_repo.list_active_fan_ids(channel.id)
    assert str(fan1.id) not in active
    assert str(fan2.id) in active


@pytest.mark.asyncio
async def test_create_and_get_ping(creator_repo, channel_repo, ping_repo):
    channel = await _make_channel(channel_repo, creator_repo)

    ping = await ping_repo.create(
        channel_id=channel.id, message="hello fans", delivery_method="both"
    )
    assert ping.id is not None
    assert ping.status == "pending"
    assert ping.total_recipients == 0
    assert ping.sent_count == 0
    assert ping.failed_count == 0

    fetched = await ping_repo.get(ping.id)
    assert fetched is not None
    assert fetched.message == "hello fans"
    assert fetched.delivery_method == "both"
    assert await ping_repo.get(uuid.uuid4()) is None


@pytest.mark.asyncio
async def test_ping_update_counts(creator_repo, channel_repo, ping_repo):
    channel = await _make_channel(channel_repo, creator_repo)
    ping = await ping_repo.create(
        channel_id=channel.id, message="hello fans", delivery_method="sms"
    )

    updated = await ping_repo.update_counts(
        ping.id,
        total_recipients=3,
        sent_count=2,
        failed_count=1,
        status="completed",
    )
    assert updated.total_recipients == 3
    assert updated.sent_count == 2
    assert updated.failed_count == 1
    assert updated.status == "completed"
    assert updated.completed_at is not None

    refreshed = await ping_repo.get(ping.id)
    assert refreshed.total_recipients == 3
    assert refreshed.status == "completed"