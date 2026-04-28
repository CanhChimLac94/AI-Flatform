from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import Message, MessageRole
from app.repositories.base import SoftDeleteRepository


class MessageRepository(SoftDeleteRepository[Message]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Message, session)

    async def list_for_conversation(self, conv_id: UUID) -> list[Message]:
        """Returns active messages ordered chronologically for context window assembly."""
        result = await self.session.execute(
            select(Message)
            .where(
                Message.conv_id == conv_id,
                Message.deleted_at.is_(None),
            )
            .order_by(Message.created_at.asc())
        )
        return list(result.scalars().all())

    async def create_message(
        self,
        conv_id: UUID,
        role: MessageRole,
        content: str,
        extra: dict | None = None,
        tokens_used: int = 0,
    ) -> Message:
        return await self.create(
            conv_id=conv_id,
            role=role,
            content=content,
            extra=extra or {},
            tokens_used=tokens_used,
        )
