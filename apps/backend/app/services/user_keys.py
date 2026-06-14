"""
User API key resolver.

Returns only keys stored by the user (user_api_keys table).
Environment / system keys are intentionally NOT used for chat or settings.
Results are cached in Redis for 60 s to avoid a DB round-trip on every request.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.redis import get_redis
from app.repositories.user_api_key import UserApiKeyRepository
from app.services.encryption import decrypt_key

_CACHE_TTL = 60  # seconds
_CACHE_PREFIX = "ukey:{user_id}:{provider}"

_ALL_PROVIDERS = ("openai", "anthropic", "groq", "google", "openrouter", "nvidia")


def is_usable_api_key(key: str | None) -> bool:
    """True when a non-placeholder user key is present (matches chat catalog filter)."""
    k = (key or "").strip()
    return bool(k) and not k.startswith("sk-...") and len(k) > 8


async def get_effective_key(provider: str, user_id: UUID, db: AsyncSession) -> str:
    """Returns the decrypted active user API key for a provider, or empty string."""
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

    return ""


async def get_all_effective_keys(user_id: UUID, db: AsyncSession) -> dict[str, str]:
    """
    Fetch user-stored API keys for all providers in a single DB query.

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

    # ── Phase 3: Populate result and cache (user keys only) ───────────────────
    for provider in uncached:
        key = active_by_provider.get(provider, "")
        result[provider] = key
        if key:
            await redis.set(
                _CACHE_PREFIX.format(user_id=user_id, provider=provider),
                key,
                ex=_CACHE_TTL,
            )

    return result


async def invalidate_cache(user_id: UUID, provider: str) -> None:
    redis = get_redis()
    await redis.delete(_CACHE_PREFIX.format(user_id=user_id, provider=provider))
