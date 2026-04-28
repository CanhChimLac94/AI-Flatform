import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(100))
    avatar_url: Mapped[str | None] = mapped_column(Text)
    hashed_password: Mapped[str | None] = mapped_column(Text)
    persona_config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # Default provider/model for this user (set on register, updatable via PATCH /settings/defaults)
    default_provider: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default="groq", default="groq"
    )
    default_model: Mapped[str] = mapped_column(
        String(100), nullable=False, server_default="llama-3.3-70b-versatile", default="llama-3.3-70b-versatile"
    )
    # Language preference (vi, en, etc.)
    language_preference: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default="vi", default="vi"
    )
    # Telegram integration (FR-07, US05)
    telegram_id: Mapped[int | None] = mapped_column(BigInteger, unique=True)
    telegram_username: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    conversations: Mapped[list["Conversation"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    agents: Mapped[list["Agent"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    memories: Mapped[list["UserMemory"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    daily_usage: Mapped[list["DailyUsage"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
