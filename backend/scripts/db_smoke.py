"""Smoke against a live Postgres (Supabase). Does not run in pytest by default.

Usage:
  cd backend
  set DATABASE_URL=postgresql+asyncpg://...
  python scripts/db_smoke.py
"""
from __future__ import annotations

import asyncio
import os
import sys
import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker

# Allow `python scripts/db_smoke.py` from backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.repositories import ChannelRepo, CreatorRepo, FanRepo
from app.db.session import build_engine


async def main() -> None:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        raise SystemExit("Set DATABASE_URL first (postgresql+asyncpg://...)")

    engine = build_engine(url)
    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with maker() as session:
        tables = (
            await session.execute(
                text(
                    "SELECT tablename FROM pg_tables "
                    "WHERE schemaname='public' ORDER BY tablename"
                )
            )
        ).scalars().all()
        print("tables:", ", ".join(tables))
        if "encrypted_phones" in tables:
            raise SystemExit("FAIL: encrypted_phones still present (pivot incomplete)")
        required = {
            "creators",
            "channels",
            "fans",
            "anonymous_links",
            "pings",
            "message_queue_jobs",
            "device_tokens",
        }
        missing = required - set(tables)
        if missing:
            raise SystemExit(f"FAIL: missing tables {sorted(missing)}")

        sub = str(uuid.uuid4())
        creator = await CreatorRepo(session).upsert(
            sub, email="smoke@example.com", handle="smoke"
        )
        channel = await ChannelRepo(session).create(
            creator_id=creator.id, handle=f"smoke-{sub[:8]}", signing_key="sk_smoke"
        )
        fan = await FanRepo(session).create(wallet_address="0x" + "ab" * 20)
        await session.execute(
            text("DELETE FROM fans WHERE id = :id"), {"id": str(fan.id)}
        )
        await session.execute(
            text("DELETE FROM channels WHERE id = :id"), {"id": str(channel.id)}
        )
        await session.execute(
            text("DELETE FROM creators WHERE id = :id"), {"id": str(creator.id)}
        )
        await session.commit()
        print("OK: schema present; create/delete smoke rows succeeded")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
