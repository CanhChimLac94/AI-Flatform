from uuid import UUID

from sqlalchemy import delete, insert, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.agent import Agent
from app.models.agent_category import AgentCategory, agent_category_links
from app.repositories.base import BaseRepository


class AgentRepository(BaseRepository[Agent]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Agent, session)

    async def list_for_user(self, owner_user_id: UUID) -> list[Agent]:
        """Returns personal agents owned by the user (excludes system agents)."""
        result = await self.session.execute(
            select(Agent)
            .where(
                Agent.owner_user_id == owner_user_id,
                Agent.is_system.is_(False),
            )
            .options(selectinload(Agent.categories))
            .order_by(Agent.created_at.desc())
        )
        return list(result.scalars().unique().all())

    async def get_with_categories(self, agent_id: UUID) -> Agent | None:
        result = await self.session.execute(
            select(Agent)
            .where(Agent.id == agent_id)
            .options(selectinload(Agent.categories))
        )
        return result.scalar_one_or_none()

    async def set_categories(self, agent: Agent, categories: list[AgentCategory]) -> None:
        await self.session.execute(
            delete(agent_category_links).where(agent_category_links.c.agent_id == agent.id)
        )
        if categories:
            await self.session.execute(
                insert(agent_category_links),
                [{"agent_id": agent.id, "category_id": c.id} for c in categories],
            )
        self.session.expire(agent, ["categories"])
        await self.session.flush()

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
