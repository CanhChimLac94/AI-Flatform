"""
POST /v1/chat/completions — Main SSE streaming endpoint (Phase 4).
Ref: AiChat-UIUX-Wireframe §II, AiChat-SRS-Main §3.1

Pipeline:
  1. Optional Auth (JWT) — anonymous allowed
  2. Rate limit check for authenticated users — EX-05
  3. Quota check for authenticated users — EX-05 / R03 → 403
  4. Validate explicit provider/model (guest mode)
  5. Moderation       — EX-02 → refusal
  6. Persist user message (authenticated only)
  7. Stream via Orchestrator (intent → memory → search → LLM)
  8. Persist assistant reply + increment token counter (authenticated only)
  9. Background: extract long-term memory facts (authenticated only, FR-05)
"""

import json
import uuid
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_optional_user, quota_check, rate_limit_check
from app.db.session import get_db
from app.models.agent import Agent
from app.models.agent_knowledge import AgentKnowledgeFile
from app.models.message import MessageRole
from app.models.user import User
from app.repositories.agent import AgentRepository
from app.repositories.conversation import ConversationRepository
from app.repositories.message import MessageRepository
from app.schemas.chat import ChatCompletionRequest, SSEError
from app.services.attachment_processor import (
    _extract_docx_text, _extract_pdf_text, _extract_xlsx_text, UPLOADS_DIR,
)
from app.services.memory import extract_and_store_facts
from app.services.moderation import ModerationError, check_content, REFUSAL_MESSAGE
from app.services.orchestrator import VALID_PROVIDERS, stream_chat_completion
from app.services.quota import increment_tokens
from app.services.user_keys import get_all_effective_keys


async def _build_knowledge_context(agent_id: UUID, db: AsyncSession) -> str:
    """Extract text from all knowledge files attached to an agent and return as context block."""
    result = await db.execute(
        select(AgentKnowledgeFile)
        .where(AgentKnowledgeFile.agent_id == agent_id)
        .order_by(AgentKnowledgeFile.created_at.asc())
    )
    files = list(result.scalars().all())
    if not files:
        return ""

    parts: list[str] = []
    for kf in files:
        matches = list(UPLOADS_DIR.glob(f"{kf.file_id}.*"))
        if not matches:
            continue
        path = matches[0]
        data = path.read_bytes()
        ext = path.suffix.lower()

        if ext == ".pdf":
            text = _extract_pdf_text(data)
        elif ext == ".docx":
            text = _extract_docx_text(data)
        elif ext == ".xlsx":
            text = _extract_xlsx_text(data)
        elif ext in (".txt", ".md"):
            text = data.decode("utf-8", errors="replace")
        else:
            text = ""

        if text.strip():
            parts.append(f"### Knowledge file: {kf.name}\n{text.strip()}")

    if not parts:
        return ""

    return "\n\n## Knowledge Base\nUse the following documents as your knowledge source when answering:\n\n" + "\n\n---\n\n".join(parts)

router = APIRouter(prefix="/chat", tags=["chat"])


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.post("/completions")
async def chat_completions(
    http_request: Request,
    req: ChatCompletionRequest,
    background_tasks: BackgroundTasks,
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    # Propagate X-Request-Id for distributed tracing; generate one if absent
    request_id = http_request.headers.get("x-request-id") or str(uuid.uuid4())

    response_headers = {
        "X-Request-Id": request_id,
        "Cache-Control": "no-cache",
    }

    # ── 1. Rate limit + quota for authenticated users only ───────────────────
    if current_user is not None:
        from app.db.redis import get_redis
        from app.core.config import settings
        from app.services.quota import is_quota_exceeded

        redis = get_redis()
        key = f"rl:{current_user.id}"
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, 60)
        if count > settings.RATE_LIMIT_MESSAGES_PER_MINUTE:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded: max {settings.RATE_LIMIT_MESSAGES_PER_MINUTE} messages/minute.",
            )

        if await is_quota_exceeded(current_user.id, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Đã hết lượt dùng miễn phí trong ngày.",
            )

    # ── 2. Validate explicit provider (guest mode) ───────────────────────────
    if req.provider is not None:
        if req.provider not in VALID_PROVIDERS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid provider '{req.provider}'. Valid providers: {sorted(VALID_PROVIDERS)}",
            )
        # Guest mode: api_key must be present when no system key exists for this provider
        # (the orchestrator will raise at stream time if key is empty — acceptable UX)

    # ── 3. Moderation (EX-02) ────────────────────────────────────────────────
    last_user_msg_obj = next((m for m in reversed(req.messages) if m.role == "user"), None)
    last_user_content = last_user_msg_obj.content if last_user_msg_obj else ""
    last_user_attachments = last_user_msg_obj.attachments if last_user_msg_obj else []
    try:
        await check_content(last_user_content)
    except ModerationError:
        async def refusal_stream():
            yield _sse({"type": "content", "delta": REFUSAL_MESSAGE})
            yield _sse({"type": "done", "usage": {
                "prompt_tokens": 0, "completion_tokens": 0,
                "total_tokens": 0, "provider": "moderation", "model": "none",
            }})
        return StreamingResponse(
            refusal_stream(),
            media_type="text/event-stream",
            headers=response_headers,
        )

    # ── 4. Resolve or create conversation (authenticated only) ───────────────
    conv_repo = ConversationRepository(db)
    msg_repo = MessageRepository(db)
    conv = None

    if current_user is not None:
        if req.conversation_id:
            conv = await conv_repo.get(UUID(req.conversation_id))
            if conv is None or conv.user_id != current_user.id:
                raise HTTPException(status_code=404, detail="Conversation not found")
        else:
            conv = await conv_repo.create(user_id=current_user.id)
            await db.commit()

        # ── 5. Persist incoming user message ────────────────────────────────
        user_extra: dict = {}
        if last_user_attachments:
            user_extra["attachments"] = [att.model_dump() for att in last_user_attachments]
        await msg_repo.create_message(
            conv_id=conv.id,
            role=MessageRole.user,
            content=last_user_content,
            extra=user_extra or None,
        )

        # Auto-generate title from first user message
        if conv.title is None:
            raw = last_user_content.strip()
            title = raw[:60]
            if len(raw) > 60:
                # truncate at last word boundary
                title = title.rsplit(" ", 1)[0] + "…"
            conv.title = title or "New conversation"
            await conv_repo.save(conv)

        await db.commit()

    # ── 6. Load agent — from request (stateless) or from conversation (persistent) ─
    active_agent: Agent | None = None
    agent_repo = AgentRepository(db)

    if req.agent_id:
        # Stateless: caller passed agent_id directly (works for guest agents too)
        from uuid import UUID as _UUID
        try:
            fetched = await agent_repo.get(_UUID(req.agent_id))
            if fetched and (
                current_user is None or
                str(fetched.owner_user_id) == str(current_user.id) or
                fetched.is_public
            ):
                active_agent = fetched
        except (ValueError, Exception):
            pass  # Invalid UUID or not found — continue without agent

    elif current_user is not None and conv is not None and conv.agent_id is not None:
        # Persistent: conversation has an agent assigned
        active_agent = await agent_repo.get(conv.agent_id)

    # ── 7. Build system prompt ───────────────────────────────────────────────
    if active_agent is not None and active_agent.system_prompt:
        # Agent takes over the full system prompt
        system_prompt = active_agent.system_prompt
        tone = current_user.persona_config.get("tone", "") if (current_user and current_user.persona_config) else ""
        language = current_user.persona_config.get("language", "") if (current_user and current_user.persona_config) else ""
        if language:
            system_prompt += f"\n\nRespond in {language}."
        if tone and tone not in ("helpful", ""):
            system_prompt += f" Use a {tone} tone."
    elif current_user is not None:
        persona_cfg = current_user.persona_config or {}
        persona = persona_cfg.get("persona", "")
        language = persona_cfg.get("language", "")
        tone = persona_cfg.get("tone", "helpful")
        system_prompt = (
            f"You are a helpful AI assistant. "
            f"The user's name is {current_user.full_name or 'there'}. "
            f"Respond in the same language the user uses."
            + (f" {persona}" if persona else "")
            + (f" Respond in {language}." if language else "")
            + (f" Use a {tone} tone." if tone and tone != "helpful" else "")
        )
    else:
        system_prompt = "You are a helpful AI assistant. Respond in the same language the user uses."

    # ── 7b. Inject agent knowledge base into system prompt ───────────────────
    if active_agent is not None:
        knowledge_context = await _build_knowledge_context(active_agent.id, db)
        if knowledge_context:
            system_prompt += knowledge_context

    # ── 8. Apply agent model/tools override to request ───────────────────────
    # Build a shallow override dict so we don't mutate the parsed req object
    agent_model_override: str | None = None
    agent_tools_override: list[str] | None = None
    if active_agent is not None:
        if active_agent.model and not req.model:
            agent_model_override = active_agent.model
        if active_agent.tools:
            # Merge: agent tools + caller tools (deduplicated)
            agent_tools_override = list(dict.fromkeys(active_agent.tools + list(req.tools)))

    # Reconstruct request with agent overrides applied when needed
    if agent_model_override or agent_tools_override:
        from copy import copy
        req = copy(req)
        if agent_model_override:
            req.model = agent_model_override
        if agent_tools_override:
            req.tools = agent_tools_override

    # ── 9. Resolve per-user API keys (BYOK, authenticated only) ─────────────
    # For guest mode, req.api_key is injected directly in the orchestrator.
    user_api_keys = await get_all_effective_keys(current_user.id, db) if current_user else {}

    # ── 10. Stream via Orchestrator ──────────────────────────────────────────
    async def event_stream():
        collected_content: list[str] = []
        total_tokens = 0
        provider_used = "unknown"
        model_used = "unknown"

        try:
            async for raw_sse in stream_chat_completion(
                req,
                system_prompt=system_prompt,
                user_id=current_user.id if current_user else None,
                db=db,
                user_api_keys=user_api_keys,
            ):
                if raw_sse.startswith("data: "):
                    try:
                        payload = json.loads(raw_sse[6:].strip())
                        ptype = payload.get("type")
                        if ptype == "content":
                            collected_content.append(payload.get("delta", ""))
                        elif ptype == "done":
                            usage = payload.get("usage", {})
                            total_tokens = usage.get("total_tokens", 0)
                            provider_used = usage.get("provider", "unknown")
                            model_used = usage.get("model", "unknown")
                    except json.JSONDecodeError:
                        pass
                yield raw_sse

        except Exception as exc:
            yield _sse(SSEError(message=str(exc)).model_dump())
            return

        # ── 11. Persist assistant reply (authenticated only) ─────────────────
        if current_user is not None and conv is not None and collected_content:
            full_reply = "".join(collected_content)
            await msg_repo.create_message(
                conv_id=conv.id,
                role=MessageRole.assistant,
                content=full_reply,
                extra={"provider": provider_used, "model": model_used},
                tokens_used=total_tokens,
            )
            conv.model_id = model_used
            await conv_repo.save(conv)
            await db.commit()

            if total_tokens > 0:
                await increment_tokens(current_user.id, total_tokens, db)

            # Notify frontend of conversation title (set on first message)
            yield _sse({"type": "conv_update", "conv_id": str(conv.id), "title": conv.title})

            # ── 12. Background: extract long-term memory (FR-05, US04 AC1) ───
            all_messages = [
                {"role": m.role.value, "content": m.content}
                for m in await msg_repo.list_for_conversation(conv.id)
            ]
            background_tasks.add_task(
                extract_and_store_facts, current_user.id, all_messages
            )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers=response_headers,
    )
