# backend/app/db/models.py
# SQLAlchemy 2.0 declarative models mirroring the Task 2 SQL schema
# (backend/supabase/migrations/0001_initial_schema.sql). Portable types are
# used so the same models run on Postgres (asyncpg) and SQLite (aiosqlite).
#
# Mirroring rules (column-by-column against the migration):
#   - A column the SQL declares without NOT NULL is Optional here, even when it
#     has a DEFAULT (e.g. subscription_tier TEXT DEFAULT 'free' is nullable).
#   - Every DDL DEFAULT gets a server_default= so create_all reproduces the
#     migration DDL; numeric server defaults use text() so they render
#     unquoted (DEFAULT 100, not DEFAULT '100'). Client-side default= stays
#     for value constants so Python sees the value before a refresh.
#   - The one intentional exception: PK `id DEFAULT gen_random_uuid()` is kept
#     client-side only (default=uuid.uuid4), because a function-call server
#     default would break SQLite create_all (used by the tests).
#   - The SQL has no ON UPDATE for updated_at, so no onupdate= is set.
import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    Text,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Creator(Base):
    __tablename__ = "creators"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    handle: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Channel(Base):
    __tablename__ = "channels"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    creator_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("creators.id", ondelete="CASCADE"), nullable=True
    )
    handle: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    signing_key: Mapped[str] = mapped_column(Text, nullable=False)
    pin_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    subscription_tier: Mapped[str | None] = mapped_column(
        Text, default="free", server_default="free"
    )
    monthly_ping_limit: Mapped[int | None] = mapped_column(
        Integer, default=100, server_default=text("100")
    )
    sms_sent_this_period: Mapped[int | None] = mapped_column(
        Integer, default=0, server_default=text("0")
    )
    period_start: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Fan(Base):
    __tablename__ = "fans"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class EncryptedPhone(Base):
    __tablename__ = "encrypted_phones"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    fan_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("fans.id", ondelete="CASCADE"), unique=True, nullable=True
    )
    phone_encrypted: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    encryption_key_id: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class AnonymousLink(Base):
    __tablename__ = "anonymous_links"
    __table_args__ = (
        UniqueConstraint("channel_id", "fan_id"),
        UniqueConstraint("channel_id", "wallet_address"),
        Index("idx_anonymous_links_channel_status", "channel_id", "status"),
        Index("idx_anonymous_links_wallet", "wallet_address"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    channel_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("channels.id", ondelete="CASCADE"), nullable=True
    )
    fan_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("fans.id", ondelete="CASCADE"), nullable=True
    )
    wallet_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str | None] = mapped_column(
        Text, default="active", server_default="active"
    )
    subscribed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    opted_out_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class Ping(Base):
    __tablename__ = "pings"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    channel_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("channels.id", ondelete="CASCADE"), nullable=True
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    delivery_method: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str | None] = mapped_column(
        Text, default="pending", server_default="pending"
    )
    total_recipients: Mapped[int | None] = mapped_column(
        Integer, default=0, server_default=text("0")
    )
    sent_count: Mapped[int | None] = mapped_column(
        Integer, default=0, server_default=text("0")
    )
    failed_count: Mapped[int | None] = mapped_column(
        Integer, default=0, server_default=text("0")
    )
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class MessageQueueJob(Base):
    __tablename__ = "message_queue_jobs"
    __table_args__ = (
        Index("idx_message_queue_jobs_status", "status"),
        Index("idx_message_queue_jobs_idempotency", "idempotency_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    ping_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("pings.id", ondelete="CASCADE"), nullable=True
    )
    channel_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("channels.id", ondelete="CASCADE"), nullable=True
    )
    fan_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("fans.id", ondelete="CASCADE"), nullable=True
    )
    delivery_method: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[str | None] = mapped_column(
        Text, default="queued", server_default="queued"
    )
    retry_count: Mapped[int | None] = mapped_column(
        Integer, default=0, server_default=text("0")
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    idempotency_key: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
