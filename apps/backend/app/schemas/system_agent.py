import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

_ICON_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def _validate_icon(v: str | None) -> str | None:
    if v is None or v == "":
        return None
    if not _ICON_RE.match(v) or len(v) > 50:
        raise ValueError("Icon must be a lowercase kebab-case identifier (e.g. cpu-chip)")
    return v


class AgentCategoryOut(BaseModel):
    id: UUID
    slug: str
    name: str
    description: str | None = None
    color: str | None = None
    icon: str | None = None
    sort_order: int

    model_config = {"from_attributes": True}


class AgentCategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    slug: str | None = Field(default=None, min_length=1, max_length=50)
    description: str | None = None
    color: str | None = Field(default=None, max_length=30)
    icon: str | None = None
    sort_order: int = 0

    @field_validator("icon")
    @classmethod
    def _icon(cls, v: str | None) -> str | None:
        return _validate_icon(v)

    @field_validator("slug")
    @classmethod
    def _slug(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip().lower()
        if not _ICON_RE.match(v):
            raise ValueError("Slug must be lowercase kebab-case")
        return v


class AgentCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    slug: str | None = Field(default=None, min_length=1, max_length=50)
    description: str | None = None
    color: str | None = Field(default=None, max_length=30)
    icon: str | None = None
    sort_order: int | None = None

    @field_validator("icon")
    @classmethod
    def _icon(cls, v: str | None) -> str | None:
        return _validate_icon(v)

    @field_validator("slug")
    @classmethod
    def _slug(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip().lower()
        if not _ICON_RE.match(v):
            raise ValueError("Slug must be lowercase kebab-case")
        return v


class SystemAgentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: str | None = None
    system_prompt: str = ""
    model: str | None = None
    params: dict = {}
    tools: list[str] = []
    icon: str | None = None
    category_ids: list[UUID] = Field(default_factory=list)

    @field_validator("icon")
    @classmethod
    def _icon(cls, v: str | None) -> str | None:
        return _validate_icon(v)


class SystemAgentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    system_prompt: str | None = None
    model: str | None = None
    params: dict | None = None
    tools: list[str] | None = None
    icon: str | None = None
    category_ids: list[UUID] | None = None

    @field_validator("icon")
    @classmethod
    def _icon(cls, v: str | None) -> str | None:
        return _validate_icon(v)


class SystemAgentOut(BaseModel):
    id: UUID
    owner_user_id: UUID
    name: str
    description: str | None
    system_prompt: str
    model: str | None
    params: dict
    tools: list
    icon: str | None
    is_system: bool
    categories: list[AgentCategoryOut]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True, "protected_namespaces": ()}
