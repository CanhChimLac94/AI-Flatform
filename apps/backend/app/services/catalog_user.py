"""System-wide model catalog owner (single DB source for all users)."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User

SYSTEM_CATALOG_USER_ID = UUID("00000000-0000-0000-0000-000000000001")
SYSTEM_CATALOG_EMAIL = "system-catalog@aichat.internal"


async def ensure_catalog_user(db: AsyncSession) -> UUID:
    user = await db.get(User, SYSTEM_CATALOG_USER_ID)
    if user is None:
        db.add(
            User(
                id=SYSTEM_CATALOG_USER_ID,
                email=SYSTEM_CATALOG_EMAIL,
                full_name="System Catalog",
                hashed_password=None,
                is_admin=False,
            )
        )
        await db.flush()
    return SYSTEM_CATALOG_USER_ID


async def get_first_admin_id(db: AsyncSession) -> UUID | None:
    result = await db.execute(
        select(User.id).where(User.is_admin.is_(True)).order_by(User.created_at).limit(1)
    )
    return result.scalar_one_or_none()
