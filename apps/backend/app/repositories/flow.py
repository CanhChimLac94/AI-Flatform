from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.agent_flow import AgentFlow
from app.repositories.base import BaseRepository


class FlowRepository(BaseRepository[AgentFlow]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AgentFlow, session)

    async def list_for_user(self, owner_user_id: UUID) -> list[AgentFlow]:
        result = await self.session.execute(
            select(AgentFlow)
            .where(AgentFlow.owner_user_id == owner_user_id)
            .options(selectinload(AgentFlow.schedule))
            .order_by(AgentFlow.updated_at.desc())
        )
        return list(result.scalars().unique().all())

    async def get_owned(self, flow_id: UUID, owner_user_id: UUID) -> AgentFlow | None:
        result = await self.session.execute(
            select(AgentFlow)
            .where(
                AgentFlow.id == flow_id,
                AgentFlow.owner_user_id == owner_user_id,
            )
            .options(selectinload(AgentFlow.schedule))
        )
        return result.scalar_one_or_none()
