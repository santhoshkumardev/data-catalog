import json
from typing import Any

import redis.asyncio as aioredis

from app.config import settings

pool: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global pool
    if pool is None:
        pool = aioredis.from_url(settings.redis_url, decode_responses=True)
    return pool


async def cache_get(key: str) -> Any | None:
    r = await get_redis()
    val = await r.get(key)
    if val is None:
        return None
    return json.loads(val)


async def cache_set(key: str, value: Any, ttl: int = 300) -> None:
    r = await get_redis()
    await r.set(key, json.dumps(value, default=str), ex=ttl)


async def cache_delete(key: str) -> None:
    r = await get_redis()
    await r.delete(key)


async def cache_delete_pattern(pattern: str) -> None:
    r = await get_redis()
    cursor = 0
    while True:
        cursor, keys = await r.scan(cursor, match=pattern, count=100)
        if keys:
            await r.delete(*keys)
        if cursor == 0:
            break


async def blacklist_token(jti: str, ttl: int) -> None:
    r = await get_redis()
    await r.set(f"bl:{jti}", "1", ex=ttl)


async def is_token_blacklisted(jti: str) -> bool:
    r = await get_redis()
    return await r.exists(f"bl:{jti}") > 0
