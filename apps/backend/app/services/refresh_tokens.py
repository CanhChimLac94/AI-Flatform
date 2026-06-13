"""Refresh token storage in Redis (rotated on each use)."""

import hashlib
import secrets
from uuid import UUID

from app.core.config import settings
from app.db.redis import get_redis

REFRESH_PREFIX = "auth:refresh:"


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def issue_refresh_token(user_id: UUID) -> str:
    token = generate_refresh_token()
    ttl = settings.JWT_REFRESH_EXPIRE_DAYS * 86400
    redis = get_redis()
    await redis.setex(f"{REFRESH_PREFIX}{hash_refresh_token(token)}", ttl, str(user_id))
    return token


async def consume_refresh_token(token: str) -> UUID | None:
    """Validate and revoke a refresh token (rotation). Returns user_id if valid."""
    redis = get_redis()
    key = f"{REFRESH_PREFIX}{hash_refresh_token(token)}"
    user_id = await redis.getdel(key)
    if not user_id:
        return None
    return UUID(user_id)


async def revoke_refresh_token(token: str) -> None:
    redis = get_redis()
    await redis.delete(f"{REFRESH_PREFIX}{hash_refresh_token(token)}")
