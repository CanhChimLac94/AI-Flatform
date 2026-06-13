from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.agent_flow_schedule import AgentFlowRun, AgentFlowSchedule
from app.repositories.base import BaseRepository


class FlowScheduleRepository(BaseRepository[AgentFlowSchedule]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AgentFlowSchedule, session)

    async def get_for_flow(self, flow_id: UUID, owner_user_id: UUID) -> AgentFlowSchedule | None:
        result = await self.session.execute(
            select(AgentFlowSchedule).where(
                AgentFlowSchedule.flow_id == flow_id,
                AgentFlowSchedule.owner_user_id == owner_user_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_for_owner(self, owner_user_id: UUID) -> list[AgentFlowSchedule]:
        result = await self.session.execute(
            select(AgentFlowSchedule)
            .where(AgentFlowSchedule.owner_user_id == owner_user_id)
            .options(selectinload(AgentFlowSchedule.flow))
            .order_by(AgentFlowSchedule.next_run_at.asc().nulls_last())
        )
        return list(result.scalars().all())


class FlowRunRepository(BaseRepository[AgentFlowRun]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AgentFlowRun, session)

    async def list_for_flow(self, flow_id: UUID, owner_user_id: UUID, limit: int = 20) -> list[AgentFlowRun]:
        result = await self.session.execute(
            select(AgentFlowRun)
            .where(
                AgentFlowRun.flow_id == flow_id,
                AgentFlowRun.owner_user_id == owner_user_id,
            )
            .order_by(AgentFlowRun.started_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def latest_for_owner_flows(
        self, owner_user_id: UUID, flow_ids: list[UUID]
    ) -> dict[UUID, AgentFlowRun]:
        if not flow_ids:
            return {}
        result = await self.session.execute(
            select(AgentFlowRun)
            .where(
                AgentFlowRun.owner_user_id == owner_user_id,
                AgentFlowRun.flow_id.in_(flow_ids),
            )
            .order_by(AgentFlowRun.started_at.desc())
        )
        latest: dict[UUID, AgentFlowRun] = {}
        for run in result.scalars().all():
            if run.flow_id not in latest:
                latest[run.flow_id] = run
        return latest
