# backend/app/services/rate_limiter.py
# Per-channel sliding window (INCR + EXPIRE). Pacing, not a security
# control -- atomic Lua is unnecessary (ADR 0004).
import redis.asyncio as aioredis

from app.core.config import settings

_redis: aioredis.Redis | None = None


def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.upstash_redis_url, decode_responses=True)
    return _redis


async def acquire_slot(channel_id: str, max_per_minute: int = 120) -> bool:
    key = f"ratelimit:channel:{channel_id}"
    redis = _get_redis()
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, 60)
    return count <= max_per_minute