from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import load_only

from app.models.user import User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(User, session)

    async def get_by_email(self, email: str) -> User | None:
        # load_only enumerates columns explicitly so the query stays valid even if
        # a new column (e.g. language_preference) hasn't been migrated yet.
        # Remove load_only once migration 0004 has been applied to all envs.
        result = await self.session.execute(
            select(User)
            .where(User.email == email)
            .options(load_only(
                User.id,
                User.email,
                User.hashed_password,
                User.full_name,
                User.avatar_url,
                User.persona_config,
                User.default_provider,
                User.default_model,
                User.telegram_id,
                User.telegram_username,
                User.created_at,
            ))
        )
        return result.scalar_one_or_none()


    async def email_exists(self, email: str) -> bool:
        return await self.get_by_email(email) is not None

    async def get_by_telegram_id(self, telegram_id: int) -> User | None:
        result = await self.session.execute(
            select(User).where(User.telegram_id == telegram_id)
        )
        return result.scalar_one_or_none()
