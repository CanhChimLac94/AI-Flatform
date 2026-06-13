"""System-wide shared agents — visible to all users, managed by admins."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_admin_user, get_current_user, get_optional_user
from app.db.session import get_db
from app.models.user import User
from app.repositories.agent import AgentRepository
from app.repositories.system_agent import AgentCategoryRepository, SystemAgentRepository
from app.schemas.system_agent import (
    AgentCategoryCreate,
    AgentCategoryOut,
    AgentCategoryUpdate,
    SystemAgentCreate,
    SystemAgentOut,
    SystemAgentUpdate,
)

router = APIRouter(prefix="/system-agents", tags=["system-agents"])


def _to_out(agent) -> SystemAgentOut:
    return SystemAgentOut(
        id=agent.id,
        owner_user_id=agent.owner_user_id,
        name=agent.name,
        description=agent.description,
        system_prompt=agent.system_prompt,
        model=agent.model,
        params=agent.params or {},
        tools=agent.tools or [],
        icon=agent.icon,
        is_system=True,
        categories=[AgentCategoryOut.model_validate(c) for c in agent.categories],
        created_at=agent.created_at,
        updated_at=agent.updated_at,
    )


@router.get("/categories", response_model=list[AgentCategoryOut])
async def list_categories(db: AsyncSession = Depends(get_db)):
    repo = AgentCategoryRepository(db)
    return await repo.list_all()


@router.post("/categories", response_model=AgentCategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(
    body: AgentCategoryCreate,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    repo = AgentCategoryRepository(db)
    if body.slug and await repo.get_by_slug(body.slug):
        raise HTTPException(status_code=400, detail="Category slug already exists")
    category = await repo.create_category(
        name=body.name,
        slug=body.slug,
        description=body.description,
        color=body.color,
        icon=body.icon,
        sort_order=body.sort_order,
    )
    await db.commit()
    return category


@router.patch("/categories/{category_id}", response_model=AgentCategoryOut)
async def update_category(
    category_id: UUID,
    body: AgentCategoryUpdate,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    repo = AgentCategoryRepository(db)
    category = await repo.get_by_id(category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")

    if body.slug is not None and body.slug != category.slug:
        if await repo.get_by_slug(body.slug):
            raise HTTPException(status_code=400, detail="Category slug already exists")
        category.slug = body.slug
    if body.name is not None:
        category.name = body.name
    if body.description is not None:
        category.description = body.description
    if body.color is not None:
        category.color = body.color
    if "icon" in body.model_fields_set:
        category.icon = body.icon
    if body.sort_order is not None:
        category.sort_order = body.sort_order

    await repo.save(category)
    await db.commit()
    return category


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: UUID,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    repo = AgentCategoryRepository(db)
    category = await repo.get_by_id(category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    await repo.delete_category(category)
    await db.commit()


@router.get("", response_model=list[SystemAgentOut])
async def list_system_agents(
    category_id: UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _user: User | None = Depends(get_optional_user),
):
    """Browse system agents. Auth optional for read-only catalog."""
    repo = SystemAgentRepository(db)
    agents = await repo.list_system(category_id=category_id)
    return [_to_out(a) for a in agents]


@router.get("/{agent_id}", response_model=SystemAgentOut)
async def get_system_agent(
    agent_id: UUID,
    db: AsyncSession = Depends(get_db),
    _user: User | None = Depends(get_optional_user),
):
    repo = SystemAgentRepository(db)
    agent = await repo.get_system(agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="System agent not found")
    return _to_out(agent)


@router.post("", response_model=SystemAgentOut, status_code=status.HTTP_201_CREATED)
async def create_system_agent(
    body: SystemAgentCreate,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    cat_repo = AgentCategoryRepository(db)
    categories = await cat_repo.get_by_ids(body.category_ids)

    repo = SystemAgentRepository(db)
    agent = await repo.create(
        owner_user_id=admin.id,
        name=body.name,
        description=body.description,
        system_prompt=body.system_prompt,
        model=body.model,
        params=body.params,
        tools=body.tools,
        icon=body.icon,
        is_public=True,
        is_system=True,
    )
    await repo.set_categories(agent, categories)
    await db.commit()
    agent = await repo.get_system(agent.id)
    return _to_out(agent)


@router.patch("/{agent_id}", response_model=SystemAgentOut)
async def update_system_agent(
    agent_id: UUID,
    body: SystemAgentUpdate,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    repo = SystemAgentRepository(db)
    agent = await repo.get_system(agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="System agent not found")

    if body.name is not None:
        agent.name = body.name
    if body.description is not None:
        agent.description = body.description
    if body.system_prompt is not None:
        agent.system_prompt = body.system_prompt
    if body.model is not None:
        agent.model = body.model
    if body.params is not None:
        agent.params = body.params
    if body.tools is not None:
        agent.tools = body.tools
    if "icon" in body.model_fields_set:
        agent.icon = body.icon

    if body.category_ids is not None:
        cat_repo = AgentCategoryRepository(db)
        categories = await cat_repo.get_by_ids(body.category_ids)
        await repo.set_categories(agent, categories)

    await repo.save(agent)
    await db.commit()
    agent = await repo.get_system(agent_id)
    return _to_out(agent)


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_system_agent(
    agent_id: UUID,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    repo = SystemAgentRepository(db)
    agent = await repo.get_system(agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="System agent not found")
    await repo.delete(agent)
    await db.commit()


@router.post("/{agent_id}/duplicate", status_code=status.HTTP_201_CREATED)
async def duplicate_system_agent_to_personal(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Copy a system agent into the caller's personal agents library."""
    sys_repo = SystemAgentRepository(db)
    source = await sys_repo.get_system(agent_id)
    if source is None:
        raise HTTPException(status_code=404, detail="System agent not found")

    personal_repo = AgentRepository(db)
    copy = await personal_repo.create(
        owner_user_id=current_user.id,
        name=source.name,
        description=source.description,
        system_prompt=source.system_prompt,
        model=source.model,
        params=source.params,
        tools=source.tools,
        icon=source.icon,
        is_public=False,
        is_system=False,
    )
    await db.commit()
    return {"id": str(copy.id), "name": copy.name}
