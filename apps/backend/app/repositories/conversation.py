from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.conversation import Conversation
from app.repositories.base import SoftDeleteRepository


class ConversationRepository(SoftDeleteRepository[Conversation]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Conversation, session)

    async def list_for_user(self, user_id: UUID, limit: int = 50) -> list[Conversation]:
        """Returns active conversations ordered by most recently updated (sidebar list)."""
        result = await self.session.execute(
            select(Conversation)
            .where(
                Conversation.user_id == user_id,
                Conversation.deleted_at.is_(None),
            )
            .order_by(Conversation.updated_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_with_messages(self, conv_id: UUID, user_id: UUID) -> Conversation | None:
        """Fetches a conversation with its messages pre-loaded (ownership check included)."""
        result = await self.session.execute(
            select(Conversation)
            .where(
                Conversation.id == conv_id,
                Conversation.user_id == user_id,
                Conversation.deleted_at.is_(None),
            )
            .options(selectinload(Conversation.messages))
        )
        return result.scalar_one_or_none()
