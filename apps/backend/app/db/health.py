"""Lightweight connectivity checks for Postgres and Redis."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, OperationalError

from app.db.redis import get_redis
from app.db.session import engine


async def ping_postgres() -> bool:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except (OperationalError, DBAPIError, OSError):
        return False


async def ping_redis() -> bool:
    try:
        redis = get_redis()
        await redis.ping()
        return True
    except Exception:
        return False
