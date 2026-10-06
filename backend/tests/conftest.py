# backend/tests/conftest.py
import httpx
import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.models import Base
from app.db.session import build_engine, get_session
from app.main import create_app


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())

@pytest.fixture
async def db_engine():
    engine = build_engine(
        "sqlite+aiosqlite:///:memory:", poolclass=StaticPool
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()

@pytest.fixture
async def db_session(db_engine):
    maker = async_sessionmaker(db_engine, expire_on_commit=False)
    async with maker() as session:
        yield session


@pytest.fixture
async def api_client(db_session):
    """Async ASGI client wired to the test database session.

    httpx.AsyncClient + ASGITransport (NOT sync TestClient) keeps the app and
    the in-memory SQLite StaticPool connection on ONE event loop -- a sync
    TestClient would run the app in a different loop and raise
    "attached to a different loop" on the shared connection.
    """
    app = create_app()

    async def override_get_session():
        yield db_session

    app.dependency_overrides[get_session] = override_get_session
    async with httpx.AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client
