import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class DailyUsage(Base):
    __tablename__ = "daily_usage"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True, nullable=False
    )
    usage_date: Mapped[date] = mapped_column(
        Date, primary_key=True, server_default=func.current_date(), nullable=False
    )
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    user: Mapped["User"] = relationship(back_populates="daily_usage")
