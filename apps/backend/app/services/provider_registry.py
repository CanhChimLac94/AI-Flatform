"""
Central registry of all supported LLM providers.

Single source of truth for:
  - display names
  - base URLs (for OpenAI-compatible providers)
  - static model lists (fallback when live fetch unavailable)
  - default models
  - key format hints for the UI

Used by:
  - settings.py  — GET /settings/providers/{id}/models, GET /settings/defaults
  - auth.py      — seed default_provider/default_model on register
  - orchestrator — provider routing
"""

from typing import TypedDict


class ProviderInfo(TypedDict):
    name: str
    base_url: str | None          # None = SDK default (e.g. OpenAI official)
    models: list[str]
    default_model: str
    key_prefix_hint: str          # shown as placeholder in UI
    openai_compatible: bool       # True → can use AsyncOpenAI client for test ping


REGISTRY: dict[str, ProviderInfo] = {
    "groq": {
        "name": "Groq",
        "base_url": "https://api.groq.com/openai/v1",
        "models": [
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "meta-llama/llama-4-scout-17b-16e-instruct",
            "qwen/qwen3-32b",
            "groq/compound",
            "groq/compound-mini",
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b",
            "allam-2-7b",
        ],
        "default_model": "llama-3.3-70b-versatile",
        "key_prefix_hint": "gsk_...",
        "openai_compatible": True,
    },
    "openrouter": {
        "name": "OpenRouter",
        "base_url": "https://openrouter.ai/api/v1",
        "models": [
            "openai/gpt-4o",
            "openai/gpt-4o-mini",
            "openai/gpt-oss-120b:free",
            "openai/gpt-oss-20b:free",
            "inclusionai/ling-2.6-1t:free",
            "tencent/hy3-preview:free",
            "inclusionai/ling-2.6-flash:free",
            "baidu/qianfan-ocr-fast:free",
            "google/gemma-3n-e2b-it:free",
            "google/gemma-3n-e4b-it:free",
            "google/gemma-3-4b-it:free",
            "google/gemma-3-12b-it:free",
            "google/gemma-3-27b-it:free"
            "google/gemma-4-26b-a4b-it:free",
            "google/gemma-4-31b-it:free",
            "google/lyria-3-pro-preview",
            "google/lyria-3-clip-preview",
            "nousresearch/hermes-3-llama-3.1-405b:free",
            "meta-llama/llama-3-70b-instruct",
            "meta-llama/llama-3.3-70b-instruct",
            "meta-llama/llama-3.2-3b-instruct",
            "mistralai/mistral-7b-instruct",
            "nvidia/nemotron-3-super-120b-a12b",
            "nvidia/nemotron-3-nano-30b-a3b",
            "nvidia/nemotron-nano-12b-v2-vl",
            "nvidia/nemotron-nano-9b-v2",
            "qwen/qwen3-next-80b-a3b-instruct",
            "qwen/qwen3-coder:free",
            "minimax/minimax-m2.5:free",
            "liquid/lfm-2.5-1.2b-thinking",
            "liquid/lfm-2.5-1.2b-instruct",
            "sourceful/riverflow-v2-pro",
            "sourceful/riverflow-v2-fast",
            "sourceful/riverflow-v2-max-preview",
            "sourceful/riverflow-v2-standard-preview",
            "sourceful/riverflow-v2-fast-preview",
            "nousresearch/hermes-3-llama-3.1-405b",
            "inclusionai/ling-2.6-1t",
            "inclusionai/ling-2.6-flash",
            "z-ai/glm-4.5-air",
            "cognitivecomputations/dolphin-mistral-24b-venice-edition",
            "nvidia/nemotron-3-super-120b-a12b:free",
            "nvidia/llama-nemotron-embed-vl-1b-v2:free",
            "sourceful/riverflow-v2-pro",
            "sourceful/riverflow-v2-fast",
            "liquid/lfm-2.5-1.2b-thinking:free",
            "liquid/lfm-2.5-1.2b-instruct:free",
            "black-forest-labs/flux.2-klein-4b",
            "liquid/lfm-2.5-1.2b-instruct:free",
            "black-forest-labs/flux.2-klein-4b",
            "bytedance-seed/seedream-4.5",
            "black-forest-labs/flux.2-max",
            "nvidia/nemotron-3-nano-30b-a3b:free",
            "sourceful/riverflow-v2-max-preview",
            "sourceful/riverflow-v2-standard-preview",
            "sourceful/riverflow-v2-fast-preview",
            "black-forest-labs/flux.2-flex",
            "black-forest-labs/flux.2-pro",
            "nvidia/nemotron-nano-12b-v2-vl:free",
            "qwen/qwen3-next-80b-a3b-instruct:free",
            "nvidia/nemotron-nano-9b-v2:free",


        ],
        "default_model": "openai/gpt-4o-mini",
        "key_prefix_hint": "sk-or-...",
        "openai_compatible": True,
    },
    "nvidia": {
        "name": "NVIDIA NIM",
        "base_url": "https://integrate.api.nvidia.com/v1",
        "models": [
            "meta/llama-4-maverick-17b-128e-instruct",
            "meta/llama-3.3-70b-instruct",
            "meta/llama-3.1-405b-instruct",
            "meta/llama-3.1-70b-instruct",
            "meta/llama-3.2-90b-vision-instruct",
            "meta/llama-3.2-11b-vision-instruct",
            "meta/llama-3.2-3b-instruct",
            "meta/llama-3.2-1b-instruct",
            "deepseek-ai/deepseek-v3.2",
            "deepseek-ai/deepseek-v3.1-terminus",
            "qwen/qwen3-coder-480b-a35b-instruct",
            "qwen/qwen3.5-397b-a17b",
            "qwen/qwen3.5-122b-a10b",
            "qwen/qwen3-next-80b-a3b-instruct",
            "qwen/qwen3-next-80b-a3b-thinking",
            "qwen/qwq-32b",
            "qwen/qwen2.5-coder-32b-instruct",
            "qwen/qwen2.5-7b-instruct",
            "qwen/qwen2.5-coder-7b-instruct",
            "qwen/qwen2-7b-instruct",
            "mistralai/mistral-large-3-675b-instruct-2512",
            "mistralai/devstral-2-123b-instruct-2512",
            "mistralai/ministral-14b-instruct-2512",
            "mistralai/mistral-small-4-119b-2603",
            "mistralai/magistral-small-2506",
            "mistralai/mistral-medium-3-instruct",
            "mistralai/mistral-small-3.1-24b-instruct-2503",
            "mistralai/mistral-small-24b-instruct",
            "mistralai/mistral-nemotron",
            "mistralai/mamba-codestral-7b-v0.1",
            "nvidia/llama-3.3-nemotron-super-49b-v1.5",
            "nvidia/llama-3.3-nemotron-super-49b-v1",
            "nvidia/nemotron-3-super-120b-a12b",
            "nvidia/nemotron-3-nano-30b-a3b",
            "nvidia/nemotron-nano-12b-v2-vl",
            "nvidia/nvidia-nemotron-nano-9b-v2",
            "nvidia/llama-3.1-nemotron-nano-8b-v1",
            "nvidia/llama-3.1-nemotron-nano-vl-8b-v1",
            "nvidia/nemotron-mini-4b-instruct",
            "nvidia/nemotron-4-mini-hindi-4b-instruct",
            "nvidia/usdcode",
            "google/gemma-4-31b-it",
            "google/gemma-3-27b-it",
            "google/gemma-3n-e4b-it",
            "google/gemma-3n-e2b-it",
            "google/gemma-2-2b-it",
            "microsoft/phi-4-mini-flash-reasoning",
            "microsoft/phi-4-mini-instruct",
            "microsoft/phi-4-multimodal-instruct",
            "microsoft/phi-3.5-mini-instruct",
            "moonshotai/kimi-k2-instruct",
            "moonshotai/kimi-k2-thinking",
            "moonshotai/kimi-k2.5",
            "moonshotai/kimi-k2-instruct-0905",
            "minimaxai/minimax-m2.7",
            "minimaxai/minimax-m2.5",
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b",
            "bytedance/seed-oss-36b-instruct",
            "stepfun-ai/step-3.5-flash",
            "z-ai/glm-5.1",
            "z-ai/glm-4.7",
            "marin/marin-8b-instruct",
            "sarvamai/sarvam-m",
            "stockmark/stockmark-2-100b-instruct",
            "abacusai/dracarys-llama-3.1-70b-instruct",
            "opengpt-x/teuken-7b-instruct-commercial-v0.4",
            "rakuten/rakutenai-7b-instruct",
            "rakuten/rakutenai-7b-chat",
            "nvidia/ising-calibration-1-35b-a3b",
        ],
        "default_model": "meta/llama-4-maverick-17b-128e-instruct",
        "key_prefix_hint": "nvapi-...",
        "openai_compatible": True,
    },
    "openai": {
        "name": "OpenAI",
        "base_url": None,
        "models": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
        "default_model": "gpt-4o-mini",
        "key_prefix_hint": "sk-...",
        "openai_compatible": True,
    },
    "anthropic": {
        "name": "Anthropic",
        "base_url": None,
        "models": [
            "claude-3-5-sonnet-20241022",
            "claude-3-haiku-20240307",
            "claude-3-opus-20240229",
        ],
        "default_model": "claude-3-5-sonnet-20241022",
        "key_prefix_hint": "sk-ant-...",
        "openai_compatible": False,
    },
    "google": {
        "name": "Google Gemini",
        "base_url": None,
        "models": ["gemini-pro", "gemini-pro-vision", "gemini-1.5-pro"],
        "default_model": "gemini-pro",
        "key_prefix_hint": "AIza...",
        "openai_compatible": False,
    },
    
}

ALL_PROVIDERS: tuple[str, ...] = tuple(REGISTRY.keys())

DEFAULT_PROVIDER = "groq"
DEFAULT_MODEL = "llama-3.3-70b-versatile"


def get_provider(provider_id: str) -> ProviderInfo | None:
    return REGISTRY.get(provider_id)


def get_models(provider_id: str) -> list[str]:
    info = REGISTRY.get(provider_id)
    return info["models"] if info else []


def get_default_model(provider_id: str) -> str:
    info = REGISTRY.get(provider_id)
    return info["default_model"] if info else DEFAULT_MODEL


async def test_provider_key(provider_id: str, api_key: str) -> tuple[bool, str]:
    """
    Pings the provider with the given key.
    Returns (ok: bool, message: str).
    Uses GET /models (OpenAI-compatible) or equivalent.
    Deliberately lightweight — just enough to verify auth.
    """
    info = REGISTRY.get(provider_id)
    if not info:
        return False, f"Unknown provider: {provider_id}"

    if info["openai_compatible"]:
        return await _ping_openai_compatible(provider_id, api_key, info["base_url"])
    elif provider_id == "anthropic":
        return await _ping_anthropic(api_key)
    elif provider_id == "google":
        return await _ping_google(api_key)
    return False, "Test not supported for this provider"


async def _ping_openai_compatible(provider_id: str, api_key: str, base_url: str | None) -> tuple[bool, str]:
    try:
        from openai import AsyncOpenAI, AuthenticationError, APIConnectionError
        kwargs: dict = {"api_key": api_key}
        if base_url:
            kwargs["base_url"] = base_url
        client = AsyncOpenAI(**kwargs)
        await client.models.list()
        return True, "Key valid"
    except Exception as exc:
        cls_name = type(exc).__name__
        if "auth" in cls_name.lower() or "401" in str(exc):
            return False, "Invalid API key"
        return False, f"Connection error: {cls_name}"


async def _ping_anthropic(api_key: str) -> tuple[bool, str]:
    try:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=api_key)
        # Cheapest possible call: count tokens on an empty message
        await client.messages.count_tokens(
            model="claude-3-haiku-20240307",
            messages=[{"role": "user", "content": "hi"}],
        )
        return True, "Key valid"
    except Exception as exc:
        if "401" in str(exc) or "auth" in str(exc).lower():
            return False, "Invalid API key"
        return False, f"Connection error: {type(exc).__name__}"


async def _ping_google(api_key: str) -> tuple[bool, str]:
    """Validate Google key format only — no live call to avoid SDK dependency."""
    if not api_key.startswith("AIza") or len(api_key) < 20:
        return False, "Key should start with 'AIza' and be at least 20 characters"
    return True, "Key format valid (live test not available)"
