from typing import Literal
from pydantic import BaseModel, Field


class AttachmentRef(BaseModel):
    id: str
    name: str
    url: str
    content_type: str
    size: int


class MessageIn(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str
    attachments: list[AttachmentRef] = []


class ChatCompletionRequest(BaseModel):
    model_config = {"protected_namespaces": ()}

    conversation_id: str | None = None
    model_preference: Literal["auto", "speed", "quality"] = "auto"
    messages: list[MessageIn]
    tools: list[str] = []  # e.g. ["web_search", "image_gen"]
    stream: bool = True

    # Explicit provider/model override — used by guest mode and direct selection.
    # When set, bypasses intent classification and uses this provider + model directly.
    provider: str | None = Field(default=None, description="Provider id: openai|anthropic|groq|openrouter|nvidia|google")
    model: str | None = Field(default=None, description="Exact model name for the chosen provider")
    # Client-supplied API key (guest mode BYOK). Only trusted when provider is also set.
    api_key: str | None = Field(default=None, description="Caller-supplied API key (guest mode)")
    # Agent override — UUID of an agent to use for this specific message (guest/server).
    agent_id: str | None = Field(default=None, description="Agent UUID to inject as system prompt")


class ErrorResponse(BaseModel):
    """Standard error envelope used by all non-streaming error responses."""
    code: str
    message: str
    details: dict | None = None


# ── SSE event shapes (AiChat-UIUX-Wireframe §II) ─────────────────────────────

class SSEStatus(BaseModel):
    type: Literal["status"] = "status"
    content: str


class SSECitation(BaseModel):
    id: int
    url: str
    title: str | None = None


class SSECitations(BaseModel):
    type: Literal["citations"] = "citations"
    links: list[SSECitation]


class SSEContent(BaseModel):
    type: Literal["content"] = "content"
    delta: str


class SSEUsage(BaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    provider: str
    model: str


class SSEDone(BaseModel):
    type: Literal["done"] = "done"
    usage: SSEUsage


class SSEError(BaseModel):
    type: Literal["error"] = "error"
    message: str
