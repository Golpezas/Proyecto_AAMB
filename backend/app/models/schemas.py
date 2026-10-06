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
        if not re.fullmatch(r"\+[1-9]\d{7,14}", v):
            raise ValueError("Phone must be E.164 format, e.g. +15551234567")
        return v

class SubscribeResponse(BaseModel):
    # Deliberately narrow: a response_model enforces at serialization time
    # that ONLY these fields can ever leave the server (PII isolation).
    success: bool = True
    fan_id: str

class WalletSubscribeRequest(BaseModel):
    channel_handle: str
    wallet_address: str = Field(pattern=r"^0x[0-9a-fA-F]{40}$")
    phone: str | None = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not re.fullmatch(r"\+[1-9]\d{7,14}", v):
            raise ValueError("Phone must be E.164 format, e.g. +15551234567")
        return v

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
    # Deliberately narrow: never serializes pin_hash or signing_key.
    id: str
    handle: str
    subscription_tier: str = "free"
    monthly_ping_limit: int = 100

class PinSetRequest(BaseModel):
    pin: str

    @field_validator("pin")
    @classmethod
    def validate_pin(cls, v: str) -> str:
        if not re.fullmatch(r"\d{6}", v):
            raise ValueError("PIN must be exactly 6 digits")
        return v

class PinSetResponse(BaseModel):
    # Never includes the plaintext PIN or its hash.
    success: bool = True

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
