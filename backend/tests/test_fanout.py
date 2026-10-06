# backend/tests/test_fanout.py
import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.db.models import Channel, Creator, Ping
from app.services.fanout_service import fanout_ping


@pytest.fixture
async def seeded(db_session):
    creator = Creator(id=uuid.uuid4(), email="c@example.com", handle="c")
    channel = Channel(id=uuid.uuid4(), creator_id=creator.id, handle="alice", signing_key="sk")
    db_session.add_all([creator, channel])
    await db_session.flush()
    ping = Ping(id=uuid.uuid4(), channel_id=channel.id, message="hi", delivery_method="push")
    db_session.add(ping)
    await db_session.commit()
    return channel, ping


async def test_fanout_creates_one_job_per_active_fan(db_session, seeded):
    from app.db.repositories import AnonymousLinkRepo, FanRepo
    channel, ping = seeded
    f1 = await FanRepo(db_session).create(wallet_address="0x" + "11" * 20)
    f2 = await FanRepo(db_session).create(wallet_address="0x" + "22" * 20)
    f3 = await FanRepo(db_session).create(wallet_address="0x" + "33" * 20)
    links = AnonymousLinkRepo(db_session)
    await links.create(channel_id=channel.id, fan_id=f1.id)
    await links.create(channel_id=channel.id, fan_id=f2.id)
    await links.create(channel_id=channel.id, fan_id=f3.id)
    await links.set_opted_out(channel.id, f3.id)

    with patch("app.services.fanout_service.publish", new_callable=AsyncMock) as pub:
        count = await fanout_ping(db_session, ping.id, channel.id, "hi", "message")

    assert count == 2
    assert pub.call_count == 2
    from app.db.repositories import MessageQueueJobRepo
    job = await MessageQueueJobRepo(db_session).get_by_idempotency_key(f"{ping.id}:{f1.id}:push")
    assert job is not None and job.status == "queued"
    assert job.payload == {"message": "hi", "kind": "message"}
