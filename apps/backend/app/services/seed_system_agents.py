import logging
import uuid

from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.default_system_agents import get_default_system_agents
from app.models.agent import Agent
from app.models.agent_category import AgentCategory, agent_category_links
from app.models.user import User

logger = logging.getLogger(__name__)


async def _resolve_owner_id(session: AsyncSession) -> uuid.UUID | None:
    admin = await session.scalar(
        select(User.id).where(User.is_admin.is_(True)).order_by(User.created_at.asc()).limit(1)
    )
    if admin:
        return admin
    return await session.scalar(select(User.id).order_by(User.created_at.asc()).limit(1))


async def ensure_default_system_agents(session: AsyncSession) -> int:
    """Insert missing default system agents. Returns count of newly created agents."""
    owner_id = await _resolve_owner_id(session)
    if owner_id is None:
        return 0

    created = 0
    for spec in get_default_system_agents():
        exists = await session.scalar(
            select(Agent.id).where(Agent.is_system.is_(True), Agent.name == spec.name).limit(1)
        )
        if exists:
            continue

        agent = Agent(
            owner_user_id=owner_id,
            name=spec.name,
            description=spec.description,
            system_prompt=spec.system_prompt,
            is_public=True,
            is_system=True,
            icon=spec.icon,
        )
        session.add(agent)
        await session.flush()

        category = await session.scalar(
            select(AgentCategory).where(AgentCategory.slug == spec.category_slug)
        )
        if category:
            await session.execute(
                insert(agent_category_links).values(
                    agent_id=agent.id,
                    category_id=category.id,
                )
            )

        created += 1

    if created:
        await session.commit()
        logger.info("Seeded %s default system agent(s).", created)
    return created
