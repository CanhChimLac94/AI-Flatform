"""
FastAPI dependency injections:
  - get_current_user  : validates JWT, returns User (NFR-02)
  - rate_limit_check  : Redis sliding-window per account (EX-05, max 10 req/min)
  - quota_check       : daily token quota gate (EX-05, R03 → 403 on exhaustion)
"""

from uuid import UUID

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decode_access_token
from app.db.redis import get_redis
from app.db.session import get_db
from app.models.user import User
from app.repositories.user import UserRepository
from app.services.quota import is_quota_exceeded
from typing import Optional

bearer_scheme = HTTPBearer()
optional_bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        user_id = decode_access_token(credentials.credentials)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    repo = UserRepository(db)
    user = await repo.get(UUID(user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Returns the authenticated User, or None if no/invalid token (allows anonymous access)."""
    if credentials is None:
        return None
    try:
        user_id = decode_access_token(credentials.credentials)
    except ValueError:
        return None
    repo = UserRepository(db)
    return await repo.get(UUID(user_id))


async def rate_limit_check(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> None:
    """
    Sliding-window rate limit: max RATE_LIMIT_MESSAGES_PER_MINUTE per account.
    Uses Redis INCR + EXPIRE so the window resets every 60 seconds (EX-05).
    """
    redis = get_redis()
    key = f"rl:{current_user.id}"
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, 60)
    if count > settings.RATE_LIMIT_MESSAGES_PER_MINUTE:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded: max {settings.RATE_LIMIT_MESSAGES_PER_MINUTE} messages/minute.",
        )


async def quota_check(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Daily token quota gate. Returns 403 when exhausted (R03 / EX-05).
    Redis is the fast path; Postgres is the source of truth (see services/quota.py).
    """
    if await is_quota_exceeded(current_user.id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Đã hết lượt dùng miễn phí trong ngày.",
        )
