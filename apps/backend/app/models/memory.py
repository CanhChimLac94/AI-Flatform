import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

# Matches OpenAI text-embedding-3-small output dimension
EMBEDDING_DIM = 1536


class UserMemory(Base):
    __tablename__ = "user_memories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    fact_content: Mapped[str] = mapped_column(Text, nullable=False)
    # External ID when using Pinecone instead of pgvector (config: USE_PGVECTOR=false)
    vector_id: Mapped[str | None] = mapped_column(String(255), index=True)
    # pgvector column — used when USE_PGVECTOR=true (FR-06 RAG retrieval)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM))
    importance_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="memories")
