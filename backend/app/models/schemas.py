# backend/app/models/schemas.py
import re
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


class SignedFanRequest(BaseModel):
    channel_handle: str
    wallet_address: str = Field(pattern=r"^0x[0-9a-fA-F]{40}$")
    signature: str = Field(min_length=2, max_length=1024)
    timestamp: int

    @field_validator("wallet_address")
    @classmethod
    def normalize_wallet(cls, v: str) -> str:
        return v.lower()

class SubscribeResponse(BaseModel):
    # Deliberately narrow: a response_model enforces at serialization time
    # that ONLY these fields can ever leave the server (PII isolation).
    success: bool = True
    fan_id: str

class UnsubscribeResponse(BaseModel):
    success: bool = True

class DeviceRegisterRequest(BaseModel):
    token: str = Field(min_length=1, max_length=512)
    platform: str = Field(default="web", pattern=r"^(web|ios|android)$")
    wallet_address: str = Field(pattern=r"^0x[0-9a-fA-F]{40}$")
    signature: str = Field(min_length=2, max_length=1024)
    timestamp: int

    @field_validator("token")
    @classmethod
    def normalize_token(cls, v: str) -> str:
        return v.lower()

    @field_validator("wallet_address")
    @classmethod
    def normalize_wallet(cls, v: str) -> str:
        return v.lower()


class DeviceRevokeRequest(BaseModel):
    token: str = Field(min_length=1, max_length=512)
    wallet_address: str = Field(pattern=r"^0x[0-9a-fA-F]{40}$")
    signature: str = Field(min_length=2, max_length=1024)
    timestamp: int

    @field_validator("token")
    @classmethod
    def normalize_token(cls, v: str) -> str:
        return v.lower()

    @field_validator("wallet_address")
    @classmethod
    def normalize_wallet(cls, v: str) -> str:
        return v.lower()


class DeviceResponse(BaseModel):
    success: bool = True


class PingCreate(BaseModel):
    channel_id: str
    message: str = Field(max_length=160)
    delivery_method: str = Field(default="push", pattern="^(sms|push|both)$")

class PingResponse(BaseModel):
    id: str
    status: str
    total_recipients: int

class SendResponse(BaseModel):
    success: bool
    provider_id: str | None = None
    error: str | None = None

class Creator(BaseModel):
    id: str
    email: str
    handle: str
    created_at: datetime | None = None

class ChannelCreateRequest(BaseModel):
    handle: str

    @field_validator("handle")
    @classmethod
    def validate_handle(cls, v: str) -> str:
        if not re.fullmatch(r"[a-z0-9_]{1,32}", v):
            raise ValueError(
                "Handle must be 1-32 characters: lowercase letters, digits, underscores"
            )
        return v

class ChannelCreateResponse(BaseModel):
    # Deliberately narrow: never serializes signing_key.
    id: str
    handle: str
    subscription_tier: str = "free"
    monthly_ping_limit: int = 100

class Channel(BaseModel):
    id: str
    creator_id: str
    handle: str
    signing_key: str
    subscription_tier: str = "free"
    monthly_ping_limit: int = 100
    pings_sent_this_period: int = 0
    period_start: datetime | None = None
    created_at: datetime | None = None

class Fan(BaseModel):
    id: str
    created_at: datetime | None = None

class AnonymousLink(BaseModel):
    id: str
    channel_id: str
    fan_id: str
    status: str = "active"
    subscribed_at: datetime | None = None
    opted_out_at: datetime | None = None

class Ping(BaseModel):
    id: str
    channel_id: str
    message: str
    delivery_method: str
    status: str = "pending"
    total_recipients: int = 0
    sent_count: int = 0
    failed_count: int = 0
    created_at: datetime | None = None
    completed_at: datetime | None = None

class MessageQueueJob(BaseModel):
    id: str
    ping_id: str
    channel_id: str
    fan_id: str
    delivery_method: str
    payload: dict[str, Any]
    status: str = "queued"
    retry_count: int = 0
    error_message: str | None = None
    idempotency_key: str
    created_at: datetime | None = None
    processed_at: datetime | None = None
