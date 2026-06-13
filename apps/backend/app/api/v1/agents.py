"""
Agent CRUD — POST /v1/agents, GET /v1/agents, GET/PATCH/DELETE /v1/agents/:id
Plus POST /v1/agents/:id/duplicate.

Permission model:
  - Only the owner can PATCH / DELETE.
  - Any authenticated user can read their own agents + public agents.
  - Guests cannot create or list agents (authentication required).
"""

from datetime import datetime
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.agent_knowledge import AgentKnowledgeFile
from app.models.user import User
from app.repositories.agent import AgentRepository
from app.repositories.system_agent import AgentCategoryRepository, SystemAgentRepository
from app.schemas.agent import AgentCreate, AgentOut, AgentUpdate
from app.schemas.system_agent import AgentCategoryOut

UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

KNOWLEDGE_MAX_SIZE = 20 * 1024 * 1024  # 20 MB
KNOWLEDGE_ALLOWED_EXT = {".pdf", ".docx", ".xlsx", ".txt", ".md"}


class KnowledgeFileOut(BaseModel):
    id: UUID
    agent_id: UUID
    file_id: str
    name: str
    content_type: str
    size: int
    created_at: datetime

    model_config = {"from_attributes": True}

router = APIRouter(prefix="/agents", tags=["agents"])


def _agent_out(agent) -> AgentOut:
    return AgentOut(
        id=agent.id,
        owner_user_id=agent.owner_user_id,
        name=agent.name,
        description=agent.description,
        system_prompt=agent.system_prompt,
        model=agent.model,
        params=agent.params,
        tools=agent.tools,
        is_public=agent.is_public,
        icon=agent.icon,
        categories=[AgentCategoryOut.model_validate(c) for c in agent.categories],
        created_at=agent.created_at,
        updated_at=agent.updated_at,
    )


@router.get("", response_model=list[AgentOut])
async def list_agents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns all agents owned by the authenticated user."""
    repo = AgentRepository(db)
    agents = await repo.list_for_user(current_user.id)
    return [_agent_out(a) for a in agents]


@router.post("", response_model=AgentOut, status_code=status.HTTP_201_CREATED)
async def create_agent(
    body: AgentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = AgentRepository(db)
    cat_repo = AgentCategoryRepository(db)
    agent = await repo.create(
        owner_user_id=current_user.id,
        name=body.name,
        description=body.description,
        system_prompt=body.system_prompt,
        model=body.model,
        params=body.params,
        tools=body.tools,
        icon=body.icon,
        is_public=body.is_public,
    )
    if body.category_ids:
        categories = await cat_repo.get_by_ids(body.category_ids)
        await repo.set_categories(agent, categories)
    await db.commit()
    loaded = await repo.get_with_categories(agent.id)
    return _agent_out(loaded or agent)


@router.get("/{agent_id}", response_model=AgentOut)
async def get_agent(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = AgentRepository(db)
    agent = await repo.get_with_categories(agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.is_system:
        return _agent_out(agent)
    if str(agent.owner_user_id) != str(current_user.id) and not agent.is_public:
        raise HTTPException(status_code=403, detail="Access denied")
    return _agent_out(agent)


@router.patch("/{agent_id}", response_model=AgentOut)
async def update_agent(
    agent_id: UUID,
    body: AgentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = AgentRepository(db)
    cat_repo = AgentCategoryRepository(db)
    agent = await repo.get_owned(agent_id, current_user.id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found or access denied")

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
    if body.is_public is not None:
        agent.is_public = body.is_public
    if body.category_ids is not None:
        categories = await cat_repo.get_by_ids(body.category_ids)
        await repo.set_categories(agent, categories)

    await repo.save(agent)
    await db.commit()
    loaded = await repo.get_with_categories(agent.id)
    return _agent_out(loaded or agent)


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = AgentRepository(db)
    agent = await repo.get_owned(agent_id, current_user.id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found or access denied")
    await repo.delete(agent)
    await db.commit()


@router.post("/{agent_id}/duplicate", response_model=AgentOut, status_code=status.HTTP_201_CREATED)
async def duplicate_agent(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Creates a copy of an agent owned by (or public to) the caller."""
    repo = AgentRepository(db)
    cat_repo = AgentCategoryRepository(db)
    sys_repo = SystemAgentRepository(db)
    source = await repo.get_with_categories(agent_id)
    if source is None:
        source = await sys_repo.get_system(agent_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    if not source.is_system and str(source.owner_user_id) != str(current_user.id) and not source.is_public:
        raise HTTPException(status_code=403, detail="Access denied")

    copy = await repo.create(
        owner_user_id=current_user.id,
        name=f"{source.name} (copy)",
        description=source.description,
        system_prompt=source.system_prompt,
        model=source.model,
        params=source.params,
        tools=source.tools,
        icon=source.icon,
        is_public=False,
    )
    if source.categories:
        await repo.set_categories(copy, list(source.categories))
    await db.commit()
    loaded = await repo.get_with_categories(copy.id)
    return _agent_out(loaded or copy)


# ── Knowledge files ───────────────────────────────────────────────────────────

@router.get("/{agent_id}/knowledge", response_model=list[KnowledgeFileOut])
async def list_knowledge_files(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = AgentRepository(db)
    agent = await repo.get(agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    if not agent.is_system and str(agent.owner_user_id) != str(current_user.id) and not agent.is_public:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(AgentKnowledgeFile)
        .where(AgentKnowledgeFile.agent_id == agent_id)
        .order_by(AgentKnowledgeFile.created_at.asc())
    )
    return list(result.scalars().all())


@router.post("/{agent_id}/knowledge", response_model=KnowledgeFileOut, status_code=status.HTTP_201_CREATED)
async def upload_knowledge_file(
    agent_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = AgentRepository(db)
    agent = await repo.get_owned(agent_id, current_user.id)
    if agent is None or agent.is_system:
        raise HTTPException(status_code=404, detail="Agent not found or access denied")

    import uuid as _uuid
    ext = Path(file.filename or "file").suffix.lower()
    if ext not in KNOWLEDGE_ALLOWED_EXT:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}. Allowed: {', '.join(KNOWLEDGE_ALLOWED_EXT)}")

    data = await file.read()
    if len(data) > KNOWLEDGE_MAX_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 20MB limit")

    file_id = str(_uuid.uuid4())
    (UPLOADS_DIR / f"{file_id}{ext}").write_bytes(data)

    kf = AgentKnowledgeFile(
        agent_id=agent_id,
        file_id=file_id,
        name=file.filename or "file",
        content_type=file.content_type or "application/octet-stream",
        size=len(data),
    )
    db.add(kf)
    await db.commit()
    await db.refresh(kf)
    return kf


@router.delete("/{agent_id}/knowledge/{knowledge_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge_file(
    agent_id: UUID,
    knowledge_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = AgentRepository(db)
    agent = await repo.get_owned(agent_id, current_user.id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found or access denied")

    result = await db.execute(
        select(AgentKnowledgeFile).where(
            AgentKnowledgeFile.id == knowledge_id,
            AgentKnowledgeFile.agent_id == agent_id,
        )
    )
    kf = result.scalar_one_or_none()
    if kf is None:
        raise HTTPException(status_code=404, detail="Knowledge file not found")

    # Remove the physical file
    matches = list(UPLOADS_DIR.glob(f"{kf.file_id}.*"))
    for f in matches:
        f.unlink(missing_ok=True)

    await db.delete(kf)
    await db.commit()
