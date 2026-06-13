from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_provider_model import UserProviderModel
from app.repositories.base import BaseRepository


class UserProviderModelRepository(BaseRepository[UserProviderModel]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(UserProviderModel, session)

    async def list_for_provider(self, user_id: UUID, provider: str) -> list[UserProviderModel]:
        result = await self.session.execute(
            select(UserProviderModel)
            .where(
                UserProviderModel.user_id == user_id,
                UserProviderModel.provider == provider,
            )
            .order_by(UserProviderModel.sort_order, UserProviderModel.model_id)
        )
        return list(result.scalars().all())

    async def list_all_for_user(self, user_id: UUID) -> list[UserProviderModel]:
        result = await self.session.execute(
            select(UserProviderModel)
            .where(UserProviderModel.user_id == user_id)
            .order_by(UserProviderModel.provider, UserProviderModel.sort_order, UserProviderModel.model_id)
        )
        return list(result.scalars().all())

    async def count_for_provider(self, user_id: UUID, provider: str) -> int:
        rows = await self.list_for_provider(user_id, provider)
        return len(rows)

    async def get_for_user(self, user_id: UUID, entry_id: UUID) -> UserProviderModel | None:
        result = await self.session.execute(
            select(UserProviderModel).where(
                UserProviderModel.user_id == user_id,
                UserProviderModel.id == entry_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_by_model_id(
        self, user_id: UUID, provider: str, model_id: str
    ) -> UserProviderModel | None:
        result = await self.session.execute(
            select(UserProviderModel).where(
                UserProviderModel.user_id == user_id,
                UserProviderModel.provider == provider,
                UserProviderModel.model_id == model_id,
            )
        )
        return result.scalar_one_or_none()

    async def delete_for_user(self, user_id: UUID, entry_id: UUID) -> bool:
        result = await self.session.execute(
            delete(UserProviderModel).where(
                UserProviderModel.user_id == user_id,
                UserProviderModel.id == entry_id,
            )
        )
        return (result.rowcount or 0) > 0
