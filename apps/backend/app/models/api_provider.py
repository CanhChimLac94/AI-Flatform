from sqlalchemy import Boolean, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class ApiProvider(Base):
    __tablename__ = "api_providers"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # 'openai', 'anthropic', 'groq'
    base_url: Mapped[str] = mapped_column(Text, nullable=False)
    # Stored encrypted at application layer (NFR-02); raw key never logged
    api_key: Mapped[str] = mapped_column(Text, nullable=False, default="placeholder")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Lower priority = preferred provider; drives EX-01 failover order
    priority: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
