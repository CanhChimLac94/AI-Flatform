import re
import uuid
from uuid import UUID

from sqlalchemy import delete, func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.agent import Agent
from app.models.agent_category import AgentCategory, agent_category_links
from app.repositories.base import BaseRepository

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def slugify(name: str) -> str:
    slug = _SLUG_RE.sub("-", name.lower().strip()).strip("-")
    return (slug[:50] if slug else "category")


class AgentCategoryRepository(BaseRepository[AgentCategory]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AgentCategory, session)

    async def list_all(self) -> list[AgentCategory]:
        result = await self.session.execute(
            select(AgentCategory).order_by(AgentCategory.sort_order.asc(), AgentCategory.name.asc())
        )
        return list(result.scalars().all())

    async def get_by_id(self, category_id: UUID) -> AgentCategory | None:
        result = await self.session.execute(
            select(AgentCategory).where(AgentCategory.id == category_id)
        )
        return result.scalar_one_or_none()

    async def get_by_ids(self, category_ids: list[UUID]) -> list[AgentCategory]:
        if not category_ids:
            return []
        result = await self.session.execute(
            select(AgentCategory).where(AgentCategory.id.in_(category_ids))
        )
        return list(result.scalars().all())

    async def get_by_slug(self, slug: str) -> AgentCategory | None:
        result = await self.session.execute(
            select(AgentCategory).where(AgentCategory.slug == slug)
        )
        return result.scalar_one_or_none()

    async def _unique_slug(self, base: str, exclude_id: UUID | None = None) -> str:
        slug = base
        n = 2
        while True:
            existing = await self.get_by_slug(slug)
            if existing is None or (exclude_id and existing.id == exclude_id):
                return slug
            slug = f"{base[:45]}-{n}"
            n += 1

    async def create_category(
        self,
        *,
        name: str,
        slug: str | None = None,
        description: str | None = None,
        color: str | None = None,
        icon: str | None = None,
        sort_order: int = 0,
    ) -> AgentCategory:
        base_slug = slug or slugify(name)
        unique_slug = await self._unique_slug(base_slug)
        category = AgentCategory(
            id=uuid.uuid4(),
            slug=unique_slug,
            name=name,
            description=description,
            color=color,
            icon=icon,
            sort_order=sort_order,
        )
        await self.save(category)
        return category

    async def count_linked_agents(self, category_id: UUID) -> int:
        result = await self.session.execute(
            select(func.count())
            .select_from(agent_category_links)
            .where(agent_category_links.c.category_id == category_id)
        )
        return int(result.scalar_one())

    async def delete_category(self, category: AgentCategory) -> None:
        await self.delete(category)


class SystemAgentRepository(BaseRepository[Agent]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Agent, session)

    async def list_system(self, category_id: UUID | None = None) -> list[Agent]:
        stmt = (
            select(Agent)
            .where(Agent.is_system.is_(True))
            .options(selectinload(Agent.categories))
            .order_by(Agent.name.asc())
        )
        if category_id is not None:
            stmt = stmt.join(Agent.categories).where(AgentCategory.id == category_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    async def get_system(self, agent_id: UUID) -> Agent | None:
        result = await self.session.execute(
            select(Agent)
            .where(Agent.id == agent_id, Agent.is_system.is_(True))
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
