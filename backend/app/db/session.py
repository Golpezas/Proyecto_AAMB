# backend/app/db/session.py
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings


def build_engine(database_url: str, **kwargs) -> AsyncEngine:
    """Build an async engine for an arbitrary URL.

    Useful for tests pointing at in-memory SQLite, e.g.
    ``build_engine("sqlite+aiosqlite:///:memory:", poolclass=StaticPool)``.
    """
    return create_async_engine(database_url, echo=False, **kwargs)


# Dev default: in-memory SQLite when DATABASE_URL is unset so the module imports
# and the app can boot locally without a Postgres instance.
_database_url = settings.database_url or "sqlite+aiosqlite:///:memory:"

engine = build_engine(_database_url)
async_session: async_sessionmaker[AsyncSession] = async_sessionmaker(
    engine, expire_on_commit=False
)