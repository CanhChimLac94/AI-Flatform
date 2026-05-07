"""
Orchestrator — Phase 4 (LangChain intent classification + RAG + Web Search + Failover).
Ref: AiChat-UIUX-Wireframe §III, US06, FR-03, FR-05, FR-06, EX-01

Pipeline per request:
  1. Classify intent         → pick provider + model (STEP 4.1)
  2. Retrieve memory context → inject into system prompt (STEP 4.2)
  3. Web search (if needed)  → inject results + stream citations event (STEP 4.3)
  4. Stream from provider    → failover on 429/5xx (EX-01)

Guest / explicit-provider path (new):
  - If req.provider is set, skip intent classification and use it directly.
  - If req.api_key is set, override the provider's resolved key.
  - If req.model is set, use that exact model instead of the registry default.
"""

import asyncio
import json
import time
from collections.abc import AsyncGenerator
from uuid import UUID

import anthropic
import httpx
from anthropic import APIStatusError as AnthropicAPIStatusError
from groq import APIStatusError as GroqAPIStatusError
from groq import AsyncGroq
from openai import APIStatusError, AsyncOpenAI, RateLimitError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.schemas.chat import (
    ChatCompletionRequest,
    SSECitations,
    SSEContent,
    SSEDone,
    SSEError,
    SSEStatus,
    SSEUsage,
)
from app.services.attachment_processor import build_message_content
from app.services.context_window import apply_sliding_window
from app.services.intent_classifier import Intent, classify_intent, intent_to_provider
from app.services.memory import retrieve_memory_context
from app.services.tools.web_search import SearchUnavailableError, search_available, web_search

# Failover priority (lower index = preferred after primary fails — EX-01)
PROVIDER_FALLBACK_ORDER = ["openai", "anthropic", "groq"]

# Default model per provider — callers can override via req.model
PROVIDER_MODELS: dict[str, str] = {
    "openai":      "gpt-4o",
    "anthropic":   "claude-3-5-sonnet-20241022",
    "groq":        "llama-3.3-70b-versatile",
    "openrouter":  "openai/gpt-4o",
    "nvidia":      "meta/llama-4-maverick-17b-128e-instruct",
    "google":      "gemini-pro",
}

FAILOVER_TIMEOUT_SECONDS = 3.0

# Alias map: decommissioned / renamed Groq model IDs → current equivalents
_GROQ_MODEL_ALIASES: dict[str, str] = {
    "llama3-70b-8192":    "llama-3.3-70b-versatile",
    "Llama3-70B":         "llama-3.3-70b-versatile",
    "llama-3-70b":        "llama-3.3-70b-versatile",
    "llama3-8b-8192":     "llama-3.1-8b-instant",
    "mixtral-8x7b-32768": "llama-3.3-70b-versatile",
}

# Alias map: decommissioned NVIDIA NIM model IDs → current equivalents
_NVIDIA_MODEL_ALIASES: dict[str, str] = {
    "meta/llama3-70b-instruct": "meta/llama-3.1-70b-instruct",  # EOL 2026-04-15
    "nvidia/nemotron-4-340b-instruct": "meta/llama-3.1-70b-instruct",
}

# Alias map: short/alternative OpenRouter model names → canonical slugs
_OPENROUTER_MODEL_ALIASES: dict[str, str] = {
    "gpt-oss-120":   "openai/gpt-oss-120b:free",
    "gpt-oss-120b":  "openai/gpt-oss-120b:free",
    "gpt-oss-20":    "openai/gpt-oss-20b:free",
    "gpt-oss-20b":   "openai/gpt-oss-20b:free",
}


# OpenRouter models that use /api/v1/videos endpoint instead of /api/v1/chat/completions
_OPENROUTER_VIDEO_MODELS: frozenset[str] = frozenset({
    "google/veo-3.1-fast",
    "google/veo-3.1-lite",
    "kwaivgi/kling-video-o1",
    "openai/sora-2-pro",
    "bytedance/seedance-2.0",
    "bytedance/seedance-2.0-fast",
    "bytedance/seedance-1-5-pro",
    "bytedance-seed/seedream-4.5",
    "alibaba/wan-2.7",
    "alibaba/wan-2.6",
    "minimax/hailuo-2.3",
    "tencent/hy3-preview",
})

_VIDEO_POLL_INTERVAL_SECONDS = 5.0
_VIDEO_MAX_WAIT_SECONDS = 600  # 10 minutes


class _ModelDecommissionedError(Exception):
    """Raised when a provider rejects the model as decommissioned (e.g. Groq HTTP 400)."""


def _normalize_model(provider: str, model: str) -> str:
    """Resolve alias/deprecated model IDs to their current replacements."""
    if provider == "groq":
        return _GROQ_MODEL_ALIASES.get(model, model)
    if provider == "nvidia":
        return _NVIDIA_MODEL_ALIASES.get(model, model)
    if provider == "openrouter":
        return _OPENROUTER_MODEL_ALIASES.get(model, model)
    return model


def _is_groq_decommissioned(exc: GroqAPIStatusError) -> bool:
    body = getattr(exc, "body", None)
    if isinstance(body, dict):
        err = body.get("error", {})
        if isinstance(err, dict):
            return (
                err.get("code") == "model_decommissioned"
                or "decommissioned" in (err.get("message") or "").lower()
            )
    return "decommissioned" in str(exc).lower()


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


# ── Provider streaming adapters ───────────────────────────────────────────────

async def _stream_openai(messages: list[dict], model: str, api_key: str = "") -> AsyncGenerator[str, None]:
    client = AsyncOpenAI(api_key=(api_key or settings.OPENAI_API_KEY).strip())
    prompt_tokens = completion_tokens = 0

    async with client.chat.completions.stream(
        model=model,
        messages=messages,
        stream_options={"include_usage": True},
    ) as stream:
        async for event in stream:
            if event.type == "content.delta" and event.delta:
                completion_tokens += 1
                yield _sse(SSEContent(delta=event.delta).model_dump())
            elif event.type == "chunk" and event.chunk.usage:
                prompt_tokens = event.chunk.usage.prompt_tokens or 0
                completion_tokens = event.chunk.usage.completion_tokens or 0

    yield _sse(SSEDone(usage=SSEUsage(
        prompt_tokens=prompt_tokens, completion_tokens=completion_tokens,
        total_tokens=prompt_tokens + completion_tokens,
        provider="openai", model=model,
    )).model_dump())


async def _stream_groq(messages: list[dict], model: str, api_key: str = "") -> AsyncGenerator[str, None]:
    client = AsyncGroq(api_key=(api_key or settings.GROQ_API_KEY).strip())
    prompt_tokens = completion_tokens = 0

    try:
        stream = await client.chat.completions.create(model=model, messages=messages, stream=True)
        async for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                completion_tokens += 1
                yield _sse(SSEContent(delta=delta).model_dump())
            if chunk.usage:
                prompt_tokens = chunk.usage.prompt_tokens or 0
                completion_tokens = chunk.usage.completion_tokens or 0
    except GroqAPIStatusError as exc:
        if _is_groq_decommissioned(exc):
            raise _ModelDecommissionedError(str(exc)) from exc
        raise

    yield _sse(SSEDone(usage=SSEUsage(
        prompt_tokens=prompt_tokens, completion_tokens=completion_tokens,
        total_tokens=prompt_tokens + completion_tokens,
        provider="groq", model=model,
    )).model_dump())


async def _stream_anthropic(messages: list[dict], model: str, api_key: str = "") -> AsyncGenerator[str, None]:
    from app.services.attachment_processor import openai_to_anthropic_content
    client = anthropic.AsyncAnthropic(api_key=(api_key or settings.ANTHROPIC_API_KEY).strip())
    system_content = " ".join(
        (m["content"] if isinstance(m["content"], str) else "")
        for m in messages if m["role"] == "system"
    )
    non_system = [
        {"role": m["role"], "content": openai_to_anthropic_content(m["content"])}
        for m in messages if m["role"] != "system"
    ]
    input_tokens = output_tokens = 0

    async with client.messages.stream(
        model=model, max_tokens=4096,
        system=system_content or "You are a helpful assistant.",
        messages=non_system,
    ) as stream:
        async for text in stream.text_stream:
            output_tokens += 1
            yield _sse(SSEContent(delta=text).model_dump())
        usage = (await stream.get_final_message()).usage
        input_tokens, output_tokens = usage.input_tokens, usage.output_tokens

    yield _sse(SSEDone(usage=SSEUsage(
        prompt_tokens=input_tokens, completion_tokens=output_tokens,
        total_tokens=input_tokens + output_tokens,
        provider="anthropic", model=model,
    )).model_dump())


async def _openrouter_video_generate(
    messages: list[dict], model: str, api_key: str
) -> AsyncGenerator[str, None]:
    """
    Handle video generation models on OpenRouter via POST /api/v1/videos + polling.
    Extracts the last user message as the video prompt.
    Uses a persistent httpx client (not context manager) so yields work correctly.
    """
    prompt = next(
        (m["content"] for m in reversed(messages) if m["role"] == "user"), ""
    )
    if not prompt:
        yield _sse(SSEError(message="No prompt found for video generation.").model_dump())
        return

    auth_header = {"Authorization": f"Bearer {api_key}"}
    client = httpx.AsyncClient(timeout=60.0)
    try:
        # Submit video generation job
        resp = await client.post(
            "https://openrouter.ai/api/v1/videos",
            headers={**auth_header, "Content-Type": "application/json"},
            json={"model": model, "prompt": prompt},
        )
        resp.raise_for_status()
        result = resp.json()
        job_id = result.get("id", "unknown")
        polling_url = result["polling_url"]
    except Exception as exc:
        await client.aclose()
        raise exc

    yield _sse(SSEStatus(content=f"Video generation started (job: {job_id})…").model_dump())

    # Poll until completed or failed
    elapsed = 0.0
    final_sse: str | None = None
    try:
        while elapsed < _VIDEO_MAX_WAIT_SECONDS:
            await asyncio.sleep(_VIDEO_POLL_INTERVAL_SECONDS)
            elapsed += _VIDEO_POLL_INTERVAL_SECONDS

            poll_resp = await client.get(polling_url, headers=auth_header, timeout=30.0)
            poll_resp.raise_for_status()
            status_data = poll_resp.json()
            status = status_data.get("status", "")

            if status == "completed":
                urls = status_data.get("unsigned_urls", [])
                if urls:
                    video_links = "\n".join(f"[Video]({url})" for url in urls)
                    final_sse = _sse(SSEContent(delta=video_links).model_dump())
                else:
                    final_sse = _sse(SSEError(
                        message="Video generation completed but no URLs returned."
                    ).model_dump())
                break
            elif status == "failed":
                error = status_data.get("error", "Unknown error")
                final_sse = _sse(SSEError(message=f"Video generation failed: {error}").model_dump())
                break
            else:
                yield _sse(SSEStatus(content=f"Video status: {status}…").model_dump())
        else:
            final_sse = _sse(SSEError(
                message=f"Video generation timed out after {_VIDEO_MAX_WAIT_SECONDS}s."
            ).model_dump())
    finally:
        await client.aclose()

    if final_sse:
        yield final_sse

    yield _sse(SSEDone(usage=SSEUsage(
        prompt_tokens=0, completion_tokens=0, total_tokens=0,
        provider="openrouter", model=model,
    )).model_dump())


async def _stream_openrouter(messages: list[dict], model: str, api_key: str = "") -> AsyncGenerator[str, None]:
    """
    OpenRouter uses an OpenAI-compatible API at https://openrouter.ai/api/v1.
    Set OPENROUTER_API_KEY in .env or supply via req.api_key (guest mode).
    Model strings use the format "provider/model-name", e.g. "openai/gpt-4o".
    Video generation models use a separate /api/v1/videos endpoint with polling.
    """
    key = (api_key or settings.OPENROUTER_API_KEY).strip()
    if not key:
        raise ValueError("OpenRouter API key not configured. Set OPENROUTER_API_KEY or provide api_key in the request.")

    # Video generation models require a different endpoint + polling flow
    if model in _OPENROUTER_VIDEO_MODELS:
        async for chunk in _openrouter_video_generate(messages, model, key):
            yield chunk
        return

    client = AsyncOpenAI(
        api_key=key,
        base_url="https://openrouter.ai/api/v1",
    )
    prompt_tokens = completion_tokens = 0

    stream = await client.chat.completions.create(
        model=model,
        messages=messages,
        max_tokens=4096,
        stream=True,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content if chunk.choices else None
        if delta:
            completion_tokens += 1
            yield _sse(SSEContent(delta=delta).model_dump())
        if chunk.usage:
            prompt_tokens = chunk.usage.prompt_tokens or 0
            completion_tokens = chunk.usage.completion_tokens or 0

    yield _sse(SSEDone(usage=SSEUsage(
        prompt_tokens=prompt_tokens, completion_tokens=completion_tokens,
        total_tokens=prompt_tokens + completion_tokens,
        provider="openrouter", model=model,
    )).model_dump())


async def _stream_nvidia(messages: list[dict], model: str, api_key: str = "") -> AsyncGenerator[str, None]:
    """
    NVIDIA NIM uses an OpenAI-compatible API at https://integrate.api.nvidia.com/v1.
    Set NVIDIA_API_KEY in .env or supply via req.api_key (guest mode).
    Model strings use the format "org/model-name", e.g. "meta/llama3-70b-instruct".
    TODO: For private/on-prem NIM endpoints, override NVIDIA_BASE_URL in .env.
    """
    key = (api_key or settings.NVIDIA_API_KEY).strip()
    if not key:
        raise ValueError("NVIDIA API key not configured. Set NVIDIA_API_KEY or provide api_key in the request.")

    # TODO: allow override via settings.NVIDIA_BASE_URL for on-prem NIM deployments
    client = AsyncOpenAI(
        api_key=key,
        base_url="https://integrate.api.nvidia.com/v1",
    )
    prompt_tokens = completion_tokens = 0

    stream = await client.chat.completions.create(
        model=model,
        messages=messages,
        stream=True,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content if chunk.choices else None
        if delta:
            completion_tokens += 1
            yield _sse(SSEContent(delta=delta).model_dump())
        if chunk.usage:
            prompt_tokens = chunk.usage.prompt_tokens or 0
            completion_tokens = chunk.usage.completion_tokens or 0

    yield _sse(SSEDone(usage=SSEUsage(
        prompt_tokens=prompt_tokens, completion_tokens=completion_tokens,
        total_tokens=prompt_tokens + completion_tokens,
        provider="nvidia", model=model,
    )).model_dump())


_PROVIDER_STREAMS: dict[str, any] = {
    "openai":      _stream_openai,
    "anthropic":   _stream_anthropic,
    "groq":        _stream_groq,
    "openrouter":  _stream_openrouter,
    "nvidia":      _stream_nvidia,
}

# Exposed so the chat endpoint can validate req.provider before streaming starts
VALID_PROVIDERS: frozenset[str] = frozenset(_PROVIDER_STREAMS.keys())


# ── Main entry point ──────────────────────────────────────────────────────────

async def stream_chat_completion(
    req: ChatCompletionRequest,
    system_prompt: str,
    user_id: UUID | None = None,
    db: AsyncSession | None = None,
    user_api_keys: dict[str, str] | None = None,
) -> AsyncGenerator[str, None]:
    """
    Full Phase 4 orchestration pipeline. Yields raw SSE strings.

    Guest / explicit-provider path:
      - req.provider overrides intent classification.
      - req.model overrides the registry default for that provider.
      - req.api_key (if set alongside req.provider) overrides all stored keys.
    """
    last_user_msg = next(
        (m.content for m in reversed(req.messages) if m.role == "user"), ""
    )
    has_attachments = any(m.attachments for m in req.messages)

    # ── STEP 4.1: Determine provider ──────────────────────────────────────────
    if req.provider:
        # Explicit provider from caller — skip intent classification entirely.
        preferred_provider = req.provider
        intent_label = "EXPLICIT"
    elif req.model_preference != "auto":
        preferred_provider = "groq" if req.model_preference == "speed" else "openai"
        intent_label = req.model_preference.upper()
    else:
        intent = await classify_intent(last_user_msg, has_attachments)
        preferred_provider, _ = intent_to_provider(intent)
        intent_label = intent.value

    yield _sse(SSEStatus(content=f"Routing to {preferred_provider} ({intent_label})…").model_dump())

    # ── STEP 4.2: Long-term Memory Context Injection ──────────────────────────
    if user_id and db and settings.USE_PGVECTOR:
        memory_context = await retrieve_memory_context(user_id, last_user_msg, db)
        if memory_context:
            system_prompt += memory_context

    # ── STEP 4.3: Web Search Tool ─────────────────────────────────────────────
    search_context = ""
    # Use intent from classification (or skip if explicit provider with no web_search tool)
    run_web_search = "web_search" in req.tools and search_available()
    if not req.provider and search_available():
        # Only check intent-based web search when we ran classification
        try:
            intent_obj = await classify_intent(last_user_msg, has_attachments)
            run_web_search = run_web_search or (intent_obj == Intent.WEB_SEARCH)
        except Exception:
            pass

    if run_web_search:
        yield _sse(SSEStatus(content="Searching the web…").model_dump())
        try:
            result = await web_search(last_user_msg)
            search_context = result.context
            if result.citations:
                yield _sse(SSECitations(links=result.citations).model_dump())
        except SearchUnavailableError:
            search_context = ""
            yield _sse(SSEStatus(
                content="Không thể kết nối Internet, tôi sẽ trả lời dựa trên dữ liệu cũ."
            ).model_dump())

    # ── Assemble final message list ───────────────────────────────────────────
    windowed = apply_sliding_window(req.messages)

    full_system = system_prompt
    if search_context:
        full_system += f"\n\n{search_context}"

    messages: list[dict] = [{"role": "system", "content": full_system}]
    messages += [
        {"role": m.role, "content": build_message_content(m.content, m.attachments)}
        for m in windowed
    ]

    # ── Build effective key map ───────────────────────────────────────────────
    # Priority: inline req.api_key > user_api_keys (DB/cache) > system .env key
    _keys: dict[str, str] = dict(user_api_keys or {})
    if req.api_key and req.provider:
        _keys[req.provider] = req.api_key

    # ── Provider dispatch with failover (EX-01) ───────────────────────────────
    # If caller specified an explicit provider, no failover — fail fast.
    if req.provider:
        fallback_chain = [req.provider]
    else:
        fallback_chain = [preferred_provider] + [
            p for p in PROVIDER_FALLBACK_ORDER if p != preferred_provider
        ]

    deadline = time.monotonic() + FAILOVER_TIMEOUT_SECONDS
    last_error: Exception | None = None

    for provider in fallback_chain:
        if time.monotonic() > deadline and provider != preferred_provider:
            break

        # Resolve model: explicit req.model > registry default, then normalize aliases
        raw_model = (req.model if req.provider else None) or PROVIDER_MODELS.get(provider, "")
        model = _normalize_model(provider, raw_model)
        stream_fn = _PROVIDER_STREAMS.get(provider)
        if stream_fn is None:
            yield _sse(SSEError(message=f"Unknown provider: {provider}").model_dump())
            return

        try:
            if provider != preferred_provider:
                yield _sse(SSEStatus(content=f"Switching to {provider} (failover)…").model_dump())

            async for chunk in stream_fn(messages, model, api_key=_keys.get(provider, "")):
                yield chunk
            return

        except _ModelDecommissionedError:
            # Retry once with the provider's current default model
            default_model = PROVIDER_MODELS.get(provider, "")
            if model != default_model:
                yield _sse(SSEStatus(
                    content=f"Model '{model}' decommissioned — retrying with '{default_model}'…"
                ).model_dump())
                try:
                    async for chunk in stream_fn(messages, default_model, api_key=_keys.get(provider, "")):
                        yield chunk
                    return
                except Exception as exc2:
                    last_error = exc2
            else:
                last_error = Exception(f"Default model '{model}' also decommissioned on {provider}")
            if req.provider:
                break
            continue

        except (RateLimitError, APIStatusError, AnthropicAPIStatusError, GroqAPIStatusError) as exc:
            last_error = exc
            if req.provider:
                # No failover for explicit provider — surface error immediately
                break
            continue
        except ValueError as exc:
            # Configuration errors (missing API key, etc.) — no point retrying
            last_error = exc
            break
        except Exception as exc:
            last_error = exc
            break

    if req.provider:
        yield _sse(SSEError(message=str(last_error)).model_dump())
    else:
        yield _sse(SSEError(message=f"All providers failed: {last_error}").model_dump())
