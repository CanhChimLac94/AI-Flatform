from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.system_agent import _validate_icon


class AgentDesignMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1)


class AgentDraft(BaseModel):
    name: str = ""
    description: str | None = None
    system_prompt: str = ""
    model: str | None = None
    tools: list[str] = Field(default_factory=list)
    icon: str | None = None
    category_slugs: list[str] = Field(default_factory=list)
    is_public: bool = False

    @field_validator("icon")
    @classmethod
    def _icon(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        try:
            return _validate_icon(v)
        except ValueError:
            return None

    @field_validator("tools")
    @classmethod
    def _tools(cls, v: list[str]) -> list[str]:
        allowed = {"web_search"}
        return [t for t in v if t in allowed]


class AgentDesignChatRequest(BaseModel):
    scope: Literal["personal", "system"] = "personal"
    messages: list[AgentDesignMessage] = Field(..., min_length=1)
    draft: AgentDraft | None = None
    provider: str | None = None
    model: str | None = None
    api_key: str | None = None


class AgentDesignChatResponse(BaseModel):
    message: str
    draft: AgentDraft | None = None
    ready: bool = False
