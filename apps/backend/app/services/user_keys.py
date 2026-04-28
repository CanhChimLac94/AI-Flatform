"""
User API key resolver.

Priority: user's active key (from user_api_keys table) > system .env key.
Results are cached in Redis for 60 s to avoid a DB round-trip on every request.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.redis import get_redis
from app.repositories.user_api_key import UserApiKeyRepository
from app.services.encryption import decrypt_key

_CACHE_TTL = 60  # seconds
_CACHE_PREFIX = "ukey:{user_id}:{provider}"

# System-level fallbacks from .env
_SYSTEM_KEYS: dict[str, str] = {
    "openai":      settings.OPENAI_API_KEY,
    "anthropic":   settings.ANTHROPIC_API_KEY,
    "groq":        settings.GROQ_API_KEY,
    "google":      getattr(settings, "GOOGLE_API_KEY", ""),
    "openrouter":  getattr(settings, "OPENROUTER_API_KEY", ""),
    "nvidia":      getattr(settings, "NVIDIA_API_KEY", ""),
}

_ALL_PROVIDERS = ("openai", "anthropic", "groq", "google", "openrouter", "nvidia")


async def get_effective_key(provider: str, user_id: UUID, db: AsyncSession) -> str:
    """
    Returns the decrypted active API key for a provider.
    User's own active key takes precedence; falls back to system .env key.
    """
    redis = get_redis()
    cache_key = _CACHE_PREFIX.format(user_id=user_id, provider=provider)

    cached = await redis.get(cache_key)
    if cached is not None:
        return cached

    repo = UserApiKeyRepository(db)
    record = await repo.get_active(user_id, provider)

    if record and record.encrypted_key:
        try:
            plaintext = decrypt_key(record.encrypted_key)
            await redis.set(cache_key, plaintext, ex=_CACHE_TTL)
            return plaintext
        except ValueError:
            pass

    return _SYSTEM_KEYS.get(provider, "")


async def get_all_effective_keys(user_id: UUID, db: AsyncSession) -> dict[str, str]:
    """
    Fetch effective API keys for all providers in a single DB query.

    Uses list_for_user() and picks the active key per provider, avoiding
    N concurrent repo.get_active() calls on the same AsyncSession.
    """
    redis = get_redis()
    result: dict[str, str] = {}
    uncached: list[str] = []

    # ── Phase 1: Redis cache lookup ───────────────────────────────────────────
    for provider in _ALL_PROVIDERS:
        cached = await redis.get(_CACHE_PREFIX.format(user_id=user_id, provider=provider))
        if cached is not None:
            result[provider] = cached
        else:
            uncached.append(provider)

    if not uncached:
        return result

    # ── Phase 2: Single query for all user-stored keys ────────────────────────
    repo = UserApiKeyRepository(db)
    records = await repo.list_for_user(user_id)

    # Pick the active key per provider (fallback: most recent if none marked active)
    active_by_provider: dict[str, str] = {}
    by_provider: dict[str, list] = {}
    for r in records:
        if r.provider not in uncached:
            continue
        by_provider.setdefault(r.provider, []).append(r)
        if r.is_active and r.encrypted_key:
            try:
                active_by_provider[r.provider] = decrypt_key(r.encrypted_key)
            except ValueError:
                pass

    # Fallback: use most recent key for providers with no active key
    for provider, recs in by_provider.items():
        if provider not in active_by_provider:
            newest = max(recs, key=lambda r: r.created_at)
            if newest.encrypted_key:
                try:
                    active_by_provider[provider] = decrypt_key(newest.encrypted_key)
                except ValueError:
                    pass

    # ── Phase 3: Merge with system keys and populate cache ────────────────────
    for provider in uncached:
        key = active_by_provider.get(provider) or _SYSTEM_KEYS.get(provider, "")
        result[provider] = key
        if provider in active_by_provider:
            await redis.set(
                _CACHE_PREFIX.format(user_id=user_id, provider=provider),
                key,
                ex=_CACHE_TTL,
            )

    return result


async def invalidate_cache(user_id: UUID, provider: str) -> None:
    redis = get_redis()
    await redis.delete(_CACHE_PREFIX.format(user_id=user_id, provider=provider))
