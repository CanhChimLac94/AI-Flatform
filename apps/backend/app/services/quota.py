"""
Daily token quota enforcement (EX-05, Business Rule #1, AiChat-UIUX-Wireframe §IV R03).

Flow:
  1. On every request: read key quota:{user_id}:{date} from Redis (fast path).
  2. If Redis key missing: load total_tokens from daily_usage table, warm Redis.
  3. After LLM response: atomically increment both Redis counter and Postgres row.
  4. If total >= DAILY_FREE_TOKEN_QUOTA → raise 403.
"""

from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.redis import get_redis
from app.models.daily_usage import DailyUsage


def _redis_quota_key(user_id: UUID) -> str:
    today = date.today().isoformat()
    return f"quota:{user_id}:{today}"


async def get_used_tokens(user_id: UUID, db: AsyncSession) -> int:
    redis = get_redis()
    key = _redis_quota_key(user_id)

    cached = await redis.get(key)
    if cached is not None:
        return int(cached)

    # Cache miss — load from Postgres and warm Redis
    result = await db.execute(
        select(DailyUsage.total_tokens).where(
            DailyUsage.user_id == user_id,
            DailyUsage.usage_date == date.today(),
        )
    )
    total = result.scalar_one_or_none() or 0
    # TTL set to end of day (seconds remaining) + buffer
    now = datetime.now(timezone.utc)
    seconds_left = (24 - now.hour) * 3600 - now.minute * 60 - now.second + 300
    await redis.set(key, total, ex=seconds_left)
    return total


async def is_quota_exceeded(user_id: UUID, db: AsyncSession) -> bool:
    used = await get_used_tokens(user_id, db)
    return used >= settings.DAILY_FREE_TOKEN_QUOTA


async def increment_tokens(user_id: UUID, tokens: int, db: AsyncSession) -> None:
    """Atomically increment both Redis counter and Postgres daily_usage row."""
    redis = get_redis()
    key = _redis_quota_key(user_id)
    await redis.incrby(key, tokens)

    # Upsert daily_usage row (Postgres source of truth)
    stmt = pg_insert(DailyUsage).values(
        user_id=user_id,
        usage_date=date.today(),
        total_tokens=tokens,
    ).on_conflict_do_update(
        index_elements=["user_id", "usage_date"],
        set_={"total_tokens": DailyUsage.total_tokens + tokens},
    )
    await db.execute(stmt)
    await db.commit()
