# backend/app/models/schemas.py
from pydantic import BaseModel, Field, field_validator
import re
from datetime import datetime
from typing import Any

class SubscribeRequest(BaseModel):
    channel_handle: str
    pin: str = Field(min_length=6, max_length=12)
    phone: str = Field(description="E.164 format")

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not re.match(r"^\+[1-9]\d{7,14}$", v):
            raise ValueError("Phone must be E.164 format, e.g. +15551234567")
        return v

class WalletSubscribeRequest(BaseModel):
    channel_handle: str
    wallet_address: str = Field(pattern=r"^0x[0-9a-fA-F]{40}$")
    phone: str | None = None

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

class Channel(BaseModel):
    id: str
    creator_id: str
    handle: str
    signing_key: str
    pin_hash: str | None = None
    subscription_tier: str = "free"
    monthly_ping_limit: int = 100
    sms_sent_this_period: int = 0
    period_start: datetime | None = None
    created_at: datetime | None = None

class Fan(BaseModel):
    id: str
    created_at: datetime | None = None

class AnonymousLink(BaseModel):
    id: str
    channel_id: str
    fan_id: str
    wallet_address: str | None = None
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
