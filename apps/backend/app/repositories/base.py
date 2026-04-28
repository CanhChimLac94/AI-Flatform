from typing import Any, Generic, Sequence, Type, TypeVar
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    def __init__(self, model: Type[ModelT], session: AsyncSession) -> None:
        self.model = model
        self.session = session

    async def get(self, id: UUID | str) -> ModelT | None:
        return await self.session.get(self.model, id)

    async def create(self, **kwargs: Any) -> ModelT:
        obj = self.model(**kwargs)
        self.session.add(obj)
        await self.session.flush()
        await self.session.refresh(obj)
        return obj

    async def save(self, obj: ModelT) -> ModelT:
        self.session.add(obj)
        await self.session.flush()
        await self.session.refresh(obj)
        return obj

    async def delete(self, obj: ModelT) -> None:
        await self.session.delete(obj)
        await self.session.flush()


class SoftDeleteRepository(BaseRepository[ModelT]):
    """
    Repository for tables with a `deleted_at` column.
    All list/get queries automatically exclude soft-deleted rows (Schema §4 Strategy #2).
    """

    async def get(self, id: UUID | str) -> ModelT | None:
        result = await self.session.execute(
            select(self.model).where(
                self.model.id == id,
                self.model.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def soft_delete(self, obj: ModelT) -> None:
        from datetime import datetime, timezone
        obj.deleted_at = datetime.now(timezone.utc)
        await self.session.flush()

    async def list_active(self, **filters: Any) -> Sequence[ModelT]:
        stmt = select(self.model).where(self.model.deleted_at.is_(None))
        for col, val in filters.items():
            stmt = stmt.where(getattr(self.model, col) == val)
        result = await self.session.execute(stmt)
        return result.scalars().all()
