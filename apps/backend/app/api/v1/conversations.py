from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.repositories.agent import AgentRepository
from app.repositories.conversation import ConversationRepository
from app.repositories.message import MessageRepository

router = APIRouter(prefix="/conversations", tags=["conversations"])


class ConversationOut(BaseModel):
    id: UUID
    title: str | None
    model_id: str | None
    is_archived: bool
    agent_id: UUID | None = None

    model_config = {"from_attributes": True, "protected_namespaces": ()}


class ConversationRenameRequest(BaseModel):
    title: str


class AssignAgentRequest(BaseModel):
    agent_id: UUID | None


class MessageOut(BaseModel):
    id: UUID
    role: str
    content: str
    metadata: dict | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


@router.get("", response_model=list[ConversationOut])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = ConversationRepository(db)
    return await repo.list_for_user(current_user.id)


@router.post("", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = ConversationRepository(db)
    conv = await repo.create(user_id=current_user.id)
    await db.commit()
    return conv


@router.patch("/{conv_id}", response_model=ConversationOut)
async def rename_conversation(
    conv_id: UUID,
    body: ConversationRenameRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = ConversationRepository(db)
    conv = await repo.get(conv_id)
    if conv is None or conv.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv.title = body.title.strip() or None
    await repo.save(conv)
    await db.commit()
    return conv


@router.get("/{conv_id}/messages", response_model=list[MessageOut])
async def get_conversation_messages(
    conv_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv_repo = ConversationRepository(db)
    conv = await conv_repo.get(conv_id)
    if conv is None or conv.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    msg_repo = MessageRepository(db)
    messages = await msg_repo.list_for_conversation(conv_id)
    return [
        MessageOut(
            id=m.id,
            role=m.role.value,
            content=m.content,
            metadata=m.extra or None,
            created_at=m.created_at,
        )
        for m in messages
        if m.role.value != "system"
    ]


@router.delete("/{conv_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conv_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = ConversationRepository(db)
    conv = await repo.get(conv_id)
    if conv is None or conv.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await repo.soft_delete(conv)
    await db.commit()


@router.put("/{conv_id}/agent", status_code=status.HTTP_204_NO_CONTENT)
async def assign_agent(
    conv_id: UUID,
    body: AssignAgentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Assign (or clear) an agent for a conversation. Pass agent_id=null to detach."""
    conv_repo = ConversationRepository(db)
    conv = await conv_repo.get(conv_id)
    if conv is None or conv.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if body.agent_id is not None:
        agent_repo = AgentRepository(db)
        agent = await agent_repo.get(body.agent_id)
        if agent is None:
            raise HTTPException(status_code=404, detail="Agent not found")
        # Only allow own agents or public agents
        if str(agent.owner_user_id) != str(current_user.id) and not agent.is_public:
            raise HTTPException(status_code=403, detail="Access denied")

    conv.agent_id = body.agent_id
    await conv_repo.save(conv)
    await db.commit()
