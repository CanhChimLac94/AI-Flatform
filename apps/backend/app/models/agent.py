import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Agent(Base):
    """Custom agent owned by a user.  Defines a system prompt, model override, and tool allowlist."""

    __tablename__ = "agents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # Optional model override — e.g. "gpt-4o-mini".  NULL means use the orchestrator default.
    model: Mapped[str | None] = mapped_column(String(100))
    # Extra LLM params: {"temperature": 0.7, "max_tokens": 2000}
    params: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # Tool allow-list: ["web_search"]
    tools: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    owner: Mapped["User"] = relationship(back_populates="agents")
    conversations: Mapped[list["Conversation"]] = relationship(back_populates="agent")
    knowledge_files: Mapped[list["AgentKnowledgeFile"]] = relationship(
        back_populates="agent", cascade="all, delete-orphan"
    )
