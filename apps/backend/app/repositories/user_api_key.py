from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_api_key import UserApiKey


class UserApiKeyRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_for_user(self, user_id: UUID) -> list[UserApiKey]:
        result = await self.session.execute(
            select(UserApiKey)
            .where(UserApiKey.user_id == user_id)
            .order_by(UserApiKey.created_at)
        )
        return list(result.scalars().all())

    async def list_for_provider(self, user_id: UUID, provider: str) -> list[UserApiKey]:
        result = await self.session.execute(
            select(UserApiKey)
            .where(UserApiKey.user_id == user_id, UserApiKey.provider == provider)
            .order_by(UserApiKey.created_at)
        )
        return list(result.scalars().all())

    async def get_active(self, user_id: UUID, provider: str) -> UserApiKey | None:
        result = await self.session.execute(
            select(UserApiKey).where(
                UserApiKey.user_id == user_id,
                UserApiKey.provider == provider,
                UserApiKey.is_active.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: UUID, key_id: UUID) -> UserApiKey | None:
        result = await self.session.execute(
            select(UserApiKey).where(
                UserApiKey.id == key_id,
                UserApiKey.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def create(
        self,
        user_id: UUID,
        provider: str,
        encrypted_key: str,
        label: str = "Default",
        set_active: bool = True,
    ) -> UserApiKey:
        if set_active:
            await self.session.execute(
                update(UserApiKey)
                .where(UserApiKey.user_id == user_id, UserApiKey.provider == provider)
                .values(is_active=False)
            )

        record = UserApiKey(
            user_id=user_id,
            provider=provider,
            encrypted_key=encrypted_key,
            label=label,
            is_active=set_active,
        )
        self.session.add(record)
        await self.session.flush()
        await self.session.refresh(record)
        return record

    async def update_key(
        self,
        user_id: UUID,
        key_id: UUID,
        encrypted_key: str | None = None,
        label: str | None = None,
    ) -> UserApiKey | None:
        record = await self.get_by_id(user_id, key_id)
        if not record:
            return None
        if encrypted_key is not None:
            record.encrypted_key = encrypted_key
        if label is not None:
            record.label = label
        await self.session.flush()
        return record

    async def activate(self, user_id: UUID, provider: str, key_id: UUID) -> bool:
        """Set key_id as the active key; deactivate all others for the same provider."""
        await self.session.execute(
            update(UserApiKey)
            .where(UserApiKey.user_id == user_id, UserApiKey.provider == provider)
            .values(is_active=False)
        )
        result = await self.session.execute(
            update(UserApiKey)
            .where(UserApiKey.id == key_id, UserApiKey.user_id == user_id)
            .values(is_active=True)
        )
        await self.session.flush()
        return result.rowcount > 0

    async def delete_by_id(self, user_id: UUID, key_id: UUID) -> bool:
        record = await self.get_by_id(user_id, key_id)
        if not record:
            return False

        was_active = record.is_active
        provider = record.provider

        result = await self.session.execute(
            delete(UserApiKey).where(
                UserApiKey.id == key_id,
                UserApiKey.user_id == user_id,
            )
        )
        await self.session.flush()

        # If we deleted the active key, promote the most recently created remaining key
        if was_active and result.rowcount > 0:
            remaining = await self.list_for_provider(user_id, provider)
            if remaining:
                newest = max(remaining, key=lambda r: r.created_at)
                newest.is_active = True
                await self.session.flush()

        return result.rowcount > 0
