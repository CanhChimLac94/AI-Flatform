"""
Conversational agent designer — LLM helps draft agent fields from user descriptions.
"""

from __future__ import annotations

import json
import re
from typing import Any

from groq import AsyncGroq
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.system_agent import AgentCategoryRepository
from app.schemas.agent_design import AgentDesignMessage, AgentDraft
from app.services.provider_registry import DEFAULT_PROVIDER, REGISTRY, get_default_model
from app.services.user_keys import get_all_effective_keys, is_usable_api_key

_VALID_ICONS = (
    "cpu-chip", "sparkles", "code-bracket", "briefcase", "megaphone", "film",
    "currency-dollar", "globe-alt", "light-bulb", "rocket-launch", "beaker",
    "chart-bar", "document-text", "paint-brush", "user-group", "shield-check",
    "wrench-screwdriver", "puzzle-piece", "chat-bubble-left-right", "server-stack",
    "academic-cap", "bolt",
)

_JSON_BLOCK_RE = re.compile(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", re.IGNORECASE)


def _draft_ready(draft: AgentDraft, *, scope: str) -> bool:
    if not draft.name.strip() or not draft.system_prompt.strip():
        return False
    if scope == "system" and not draft.category_slugs:
        return False
    return True


def parse_design_response(raw: str) -> tuple[str, AgentDraft | None, bool]:
    """Extract assistant message, optional draft, and ready flag from LLM output."""
    draft: AgentDraft | None = None
    ready = False
    display = raw.strip()

    match = _JSON_BLOCK_RE.search(raw)
    if match:
        display = (raw[: match.start()] + raw[match.end() :]).strip()
        try:
            payload = json.loads(match.group(1))
            if isinstance(payload, dict):
                inner = payload.get("draft", payload)
                if isinstance(inner, dict):
                    draft = AgentDraft.model_validate(inner)
                ready = bool(payload.get("ready", False))
        except (json.JSONDecodeError, ValueError):
            draft = None

    if not display:
        display = raw.strip()

    return display, draft, ready


def _build_system_prompt(
    *,
    scope: str,
    categories: list[dict[str, str]],
    current_draft: AgentDraft | None,
) -> str:
    cat_lines = "\n".join(
        f'  - slug: "{c["slug"]}", name: "{c["name"]}"' for c in categories
    ) or "  (none configured)"

    scope_rules = (
        "System catalog agent: choose at least one category_slugs entry."
        if scope == "system"
        else "Personal agent: category_slugs optional; is_public may be true/false."
    )

    draft_block = ""
    if current_draft and current_draft.name:
        draft_block = f"\nCurrent draft (refine when user asks to change):\n{current_draft.model_dump_json()}\n"

    return f"""You are an expert AI Agent Designer inside an AI chat application.

Your job: converse with the user to design a custom AI agent ({scope} scope).
{scope_rules}

Workflow:
1. Ask clarifying questions when requirements are vague (role, tone, tasks, constraints).
2. When you have enough detail, propose a complete agent draft.
3. When the user asks to change something, update the draft accordingly.

Agent draft fields:
- name: short display name (required before ready)
- description: one-line summary for the card UI
- system_prompt: full system instructions the agent will use (required, be thorough)
- model: optional model id string (leave null to use app default)
- tools: array; only "web_search" is supported
- icon: one of {list(_VALID_ICONS)}
- category_slugs: array of category slug strings from the list below
- is_public: boolean (personal scope only)

Available categories:
{cat_lines}

When presenting a draft, ALWAYS append a fenced JSON block exactly like:
```json
{{"draft": {{"name": "...", "description": "...", "system_prompt": "...", "model": null, "tools": [], "icon": "sparkles", "category_slugs": ["slug"], "is_public": false}}, "ready": true}}
```

Set "ready": true only when name and system_prompt are complete and (for system scope) at least one category_slug is set.
Reply in the same language the user uses. Keep conversational text outside the JSON block concise.
{draft_block}"""


async def _completion(
    *,
    provider: str,
    api_key: str,
    model: str | None,
    messages: list[dict[str, str]],
) -> str:
    info = REGISTRY.get(provider)
    if not info:
        raise ValueError(f"Unknown provider: {provider}")

    resolved_model = model or get_default_model(provider)

    if info["openai_compatible"]:
        kwargs: dict[str, Any] = {"api_key": api_key}
        if info["base_url"]:
            kwargs["base_url"] = info["base_url"]
        client = AsyncOpenAI(**kwargs)
        response = await client.chat.completions.create(
            model=resolved_model,
            messages=messages,
            temperature=0.5,
            max_tokens=4096,
        )
        return (response.choices[0].message.content or "").strip()

    if provider == "groq":
        client = AsyncGroq(api_key=api_key)
        response = await client.chat.completions.create(
            model=resolved_model,
            messages=messages,
            temperature=0.5,
            max_tokens=4096,
        )
        return (response.choices[0].message.content or "").strip()

    raise ValueError(f"Provider '{provider}' is not supported for agent design yet")


async def resolve_design_llm(
    db: AsyncSession,
    user: User | None,
    *,
    provider: str | None,
    model: str | None,
    api_key: str | None,
) -> tuple[str, str | None, str]:
    if user is not None:
        keys = await get_all_effective_keys(user.id, db)
        resolved_provider = provider or user.default_provider or DEFAULT_PROVIDER
        resolved_key = (api_key or keys.get(resolved_provider, "")).strip()
        resolved_model = model or user.default_model
    else:
        if not provider or not api_key:
            raise ValueError("provider and api_key are required for guest agent design")
        resolved_provider = provider
        resolved_key = api_key.strip()
        resolved_model = model

    if not is_usable_api_key(resolved_key):
        raise ValueError(
            f"No usable API key for provider '{resolved_provider}'. "
            "Configure a key in Settings → API Keys."
        )

    return resolved_provider, resolved_model, resolved_key


async def run_agent_design_chat(
    db: AsyncSession,
    user: User | None,
    *,
    scope: str,
    messages: list[AgentDesignMessage],
    current_draft: AgentDraft | None,
    provider: str | None = None,
    model: str | None = None,
    api_key: str | None = None,
) -> tuple[str, AgentDraft | None, bool]:
    cat_repo = AgentCategoryRepository(db)
    categories = await cat_repo.list_all()
    cat_payload = [{"slug": c.slug, "name": c.name} for c in categories]

    resolved_provider, resolved_model, resolved_key = await resolve_design_llm(
        db, user, provider=provider, model=model, api_key=api_key
    )

    system_prompt = _build_system_prompt(
        scope=scope,
        categories=cat_payload,
        current_draft=current_draft,
    )

    llm_messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    for msg in messages:
        llm_messages.append({"role": msg.role, "content": msg.content})

    raw = await _completion(
        provider=resolved_provider,
        api_key=resolved_key,
        model=resolved_model,
        messages=llm_messages,
    )

    display, parsed_draft, llm_ready = parse_design_response(raw)
    draft = parsed_draft or current_draft
    ready = llm_ready and draft is not None and _draft_ready(draft, scope=scope)

    return display, draft, ready
