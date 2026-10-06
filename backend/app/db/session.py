# backend/app/db/session.py
# Async engine/session factory.
#
# There is NO in-memory fallback: a missing DATABASE_URL is a configuration
# error, not something to paper over with an ephemeral SQLite database (that
# would silently lose data in production). The module-level engine and session
# factory are therefore built lazily on first access (PEP 562 __getattr__), so
# importing this module for build_engine() -- as tests/conftest.py does -- never
# requires DATABASE_URL, while any real use of engine/async_session without one
# raises RuntimeError with a clear message.
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
    if not database_url:
        raise RuntimeError(
            "build_engine() requires a non-empty database URL; "
            "there is no in-memory fallback."
        )
    return create_async_engine(database_url, echo=False, **kwargs)


def _require_database_url() -> str:
    database_url = settings.database_url
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL is not set. Configure it (e.g. in backend/.env) "
            "before using app.db.session.engine or app.db.session.async_session; "
            "there is no in-memory SQLite fallback."
        )
    return database_url


_engine: AsyncEngine | None = None
_async_session: async_sessionmaker[AsyncSession] | None = None


def _get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        _engine = build_engine(_require_database_url())
    return _engine


def _get_async_session() -> async_sessionmaker[AsyncSession]:
    global _async_session
    if _async_session is None:
        _async_session = async_sessionmaker(_get_engine(), expire_on_commit=False)
    return _async_session


def __getattr__(name: str):
    if name == "engine":
        return _get_engine()
    if name == "async_session":
        return _get_async_session()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
