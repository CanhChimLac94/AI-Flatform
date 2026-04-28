from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AgentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: str | None = None
    system_prompt: str = ""
    model: str | None = None
    params: dict = {}
    tools: list[str] = []
    is_public: bool = False


class AgentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    system_prompt: str | None = None
    model: str | None = None
    params: dict | None = None
    tools: list[str] | None = None
    is_public: bool | None = None


class AgentOut(BaseModel):
    id: UUID
    owner_user_id: UUID
    name: str
    description: str | None
    system_prompt: str
    model: str | None
    params: dict
    tools: list
    is_public: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True, "protected_namespaces": ()}
