# backend/tests/test_session.py
import pytest

import app.db.session as session_mod
from app.core.config import settings


def test_missing_database_url_raises_runtime_error(monkeypatch):
    monkeypatch.setattr(settings, "database_url", "")
    monkeypatch.setattr(session_mod, "_engine", None)
    monkeypatch.setattr(session_mod, "_async_session", None)

    with pytest.raises(RuntimeError, match="DATABASE_URL is not set"):
        _ = session_mod.engine

    with pytest.raises(RuntimeError, match="DATABASE_URL is not set"):
        _ = session_mod.async_session


def test_build_engine_rejects_empty_url():
    with pytest.raises(RuntimeError, match="non-empty database URL"):
        session_mod.build_engine("")
