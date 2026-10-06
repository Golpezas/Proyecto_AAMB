# backend/app/services/subscription_service.py
# Single-transaction subscription creation. The three row inserts (Fan,
# EncryptedPhone, AnonymousLink) are flushed inside ONE transaction and
# committed exactly once, so a failure at any step rolls everything back
# instead of leaving an orphaned Fan or ciphertext at rest (PII isolation).
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Fan
from app.db.repositories import (
    AnonymousLinkRepo,
    EncryptedPhoneRepo,
    FanRepo,
)
from app.services.crypto_service import encrypt_phone


async def create_subscription(
    session: AsyncSession,
    channel_id: str | uuid.UUID,
    phone: str,
) -> Fan:
    """Create Fan + EncryptedPhone + AnonymousLink atomically.

    The repos run in unit-of-work mode (``commit=False``); this function
    commits exactly once at the end. On any failure it rolls back everything
    it wrote and re-raises the original error.
    """
    try:
        fan = await FanRepo(session).create(commit=False)
        await EncryptedPhoneRepo(session).create(
            fan_id=fan.id,
            phone_encrypted=encrypt_phone(phone),
            commit=False,
        )
        await AnonymousLinkRepo(session).create(
            channel_id=channel_id,
            fan_id=fan.id,
            commit=False,
        )
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    return fan