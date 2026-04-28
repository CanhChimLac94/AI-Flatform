from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent
from app.repositories.base import BaseRepository


class AgentRepository(BaseRepository[Agent]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Agent, session)

    async def list_for_user(self, owner_user_id: UUID) -> list[Agent]:
        """Returns all agents owned by the user, newest first."""
        result = await self.session.execute(
            select(Agent)
            .where(Agent.owner_user_id == owner_user_id)
            .order_by(Agent.created_at.desc())
        )
        return list(result.scalars().all())

    async def list_public(self) -> list[Agent]:
        """Returns all public agents (for discovery)."""
        result = await self.session.execute(
            select(Agent).where(Agent.is_public.is_(True)).order_by(Agent.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_owned(self, agent_id: UUID, owner_user_id: UUID) -> Agent | None:
        """Returns agent only if caller is the owner."""
        result = await self.session.execute(
            select(Agent).where(
                Agent.id == agent_id,
                Agent.owner_user_id == owner_user_id,
            )
        )
        return result.scalar_one_or_none()
