import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class MessageRole(str, enum.Enum):
    user = "user"
    assistant = "assistant"
    system = "system"


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    conv_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    role: Mapped[MessageRole] = mapped_column(
        Enum(MessageRole, name="message_role", create_type=False), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Stores: file attachments, image URLs, search citations, code blocks (Schema §4 Strategy #3)
    extra: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)
    tokens_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    # Soft delete — Schema §4 Strategy #2
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")
