"""
Tests for app/services/user_keys.py — get_all_effective_keys().

Key invariants verified:
  1. Uses a single list_for_user() call, NOT N concurrent repo.get() calls.
     (Concurrent repo.get() on the same AsyncSession raises InvalidRequestError.)
  2. User-stored key takes precedence over the system .env key.
  3. Falls back to system key when no user record exists.
  4. Populates Redis cache for user keys; subsequent calls hit cache only.
  5. Decryption failures are silently dropped (fall through to system key).
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch, call

import pytest

USER_ID = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000001")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_key_record(provider: str, encrypted: str) -> MagicMock:
    r = MagicMock()
    r.provider = provider
    r.encrypted_key = encrypted
    return r


def _make_redis(cache: dict | None = None) -> AsyncMock:
    """Return a fake async Redis client backed by an in-memory dict."""
    store: dict[str, str] = dict(cache or {})

    redis = AsyncMock()
    redis.get = AsyncMock(side_effect=lambda k: store.get(k))
    redis.set = AsyncMock(side_effect=lambda k, v, ex=None: store.update({k: v}))
    redis.delete = AsyncMock(side_effect=lambda k: store.pop(k, None))
    return redis


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def db_session() -> AsyncMock:
    """A fake AsyncSession.  execute() must NEVER be called concurrently."""
    session = AsyncMock()
    # Simulate the SQLAlchemy guard: if execute is called while another is
    # already running, raise the real-world error.
    _busy = False

    async def _execute(stmt, *a, **kw):
        nonlocal _busy
        if _busy:
            from sqlalchemy.exc import InvalidRequestError
            raise InvalidRequestError(
                "This session is provisioning a new connection; "
                "concurrent operations are not permitted"
            )
        _busy = True
        try:
            result = MagicMock()
            result.scalars.return_value.all.return_value = []
            return result
        finally:
            _busy = False

    session.execute = AsyncMock(side_effect=_execute)
    return session


# ---------------------------------------------------------------------------
# Test cases
# ---------------------------------------------------------------------------

class TestGetAllEffectiveKeys:

    @pytest.mark.asyncio
    async def test_single_db_query_not_concurrent(self, db_session):
        """
        get_all_effective_keys must issue exactly ONE list_for_user() call
        (single session.execute) even when all 6 providers miss the cache.
        """
        redis = _make_redis()  # empty cache → all providers are uncached

        with (
            patch("app.services.user_keys.get_redis", return_value=redis),
            patch(
                "app.repositories.user_api_key.UserApiKeyRepository.list_for_user",
                new_callable=AsyncMock,
                return_value=[],           # no user keys stored
            ) as mock_list,
        ):
            from app.services.user_keys import get_all_effective_keys
            result = await get_all_effective_keys(USER_ID, db_session)

        mock_list.assert_called_once_with(USER_ID)
        assert set(result.keys()) == {"openai", "anthropic", "groq", "google", "openrouter", "nvidia"}

    @pytest.mark.asyncio
    async def test_user_key_overrides_system_key(self, db_session):
        """User-stored key wins over the .env system key."""
        redis = _make_redis()

        records = [_make_key_record("openai", "enc_user_openai_key")]

        with (
            patch("app.services.user_keys.get_redis", return_value=redis),
            patch(
                "app.repositories.user_api_key.UserApiKeyRepository.list_for_user",
                new_callable=AsyncMock,
                return_value=records,
            ),
            patch(
                "app.services.user_keys.decrypt_key",
                side_effect=lambda enc: enc.replace("enc_", "plain_"),
            ),
            patch.dict(
                "app.services.user_keys._SYSTEM_KEYS",
                {"openai": "system_openai_key"},
            ),
        ):
            from app.services.user_keys import get_all_effective_keys
            result = await get_all_effective_keys(USER_ID, db_session)

        assert result["openai"] == "plain_user_openai_key"

    @pytest.mark.asyncio
    async def test_falls_back_to_system_key(self, db_session):
        """When no user record, the system .env key is returned."""
        redis = _make_redis()

        with (
            patch("app.services.user_keys.get_redis", return_value=redis),
            patch(
                "app.repositories.user_api_key.UserApiKeyRepository.list_for_user",
                new_callable=AsyncMock,
                return_value=[],
            ),
            patch.dict(
                "app.services.user_keys._SYSTEM_KEYS",
                {"groq": "sys_groq_key"},
            ),
        ):
            from app.services.user_keys import get_all_effective_keys
            result = await get_all_effective_keys(USER_ID, db_session)

        assert result["groq"] == "sys_groq_key"

    @pytest.mark.asyncio
    async def test_all_cached_skips_db(self, db_session):
        """When every provider is in Redis, list_for_user must not be called."""
        providers = ["openai", "anthropic", "groq", "google", "openrouter", "nvidia"]
        cache = {
            f"ukey:{USER_ID}:{p}": f"cached_{p}" for p in providers
        }
        redis = _make_redis(cache)

        with (
            patch("app.services.user_keys.get_redis", return_value=redis),
            patch(
                "app.repositories.user_api_key.UserApiKeyRepository.list_for_user",
                new_callable=AsyncMock,
            ) as mock_list,
        ):
            from app.services.user_keys import get_all_effective_keys
            result = await get_all_effective_keys(USER_ID, db_session)

        mock_list.assert_not_called()
        assert result["openai"] == "cached_openai"
        assert result["groq"] == "cached_groq"

    @pytest.mark.asyncio
    async def test_decryption_failure_falls_back_to_system_key(self, db_session):
        """A corrupt encrypted key silently falls through to the system key."""
        redis = _make_redis()
        records = [_make_key_record("anthropic", "corrupt_enc")]

        with (
            patch("app.services.user_keys.get_redis", return_value=redis),
            patch(
                "app.repositories.user_api_key.UserApiKeyRepository.list_for_user",
                new_callable=AsyncMock,
                return_value=records,
            ),
            patch(
                "app.services.user_keys.decrypt_key",
                side_effect=ValueError("bad padding"),
            ),
            patch.dict(
                "app.services.user_keys._SYSTEM_KEYS",
                {"anthropic": "sys_anthropic"},
            ),
        ):
            from app.services.user_keys import get_all_effective_keys
            result = await get_all_effective_keys(USER_ID, db_session)

        assert result["anthropic"] == "sys_anthropic"

    @pytest.mark.asyncio
    async def test_user_key_is_cached_after_db_fetch(self, db_session):
        """After a DB fetch, the decrypted user key is written to Redis."""
        redis = _make_redis()
        records = [_make_key_record("openai", "enc_key")]

        with (
            patch("app.services.user_keys.get_redis", return_value=redis),
            patch(
                "app.repositories.user_api_key.UserApiKeyRepository.list_for_user",
                new_callable=AsyncMock,
                return_value=records,
            ),
            patch(
                "app.services.user_keys.decrypt_key",
                return_value="plain_key",
            ),
        ):
            from app.services.user_keys import get_all_effective_keys
            await get_all_effective_keys(USER_ID, db_session)

        cache_key = f"ukey:{USER_ID}:openai"
        redis.set.assert_any_call(cache_key, "plain_key", ex=60)

    @pytest.mark.asyncio
    async def test_partial_cache_hit(self, db_session):
        """Cached providers skip DB; uncached ones are fetched in the single query."""
        cache = {f"ukey:{USER_ID}:openai": "cached_openai"}
        redis = _make_redis(cache)
        records = [_make_key_record("groq", "enc_groq")]

        with (
            patch("app.services.user_keys.get_redis", return_value=redis),
            patch(
                "app.repositories.user_api_key.UserApiKeyRepository.list_for_user",
                new_callable=AsyncMock,
                return_value=records,
            ) as mock_list,
            patch(
                "app.services.user_keys.decrypt_key",
                side_effect=lambda enc: enc.replace("enc_", "plain_"),
            ),
        ):
            from app.services.user_keys import get_all_effective_keys
            result = await get_all_effective_keys(USER_ID, db_session)

        mock_list.assert_called_once_with(USER_ID)
        assert result["openai"] == "cached_openai"   # from cache
        assert result["groq"] == "plain_groq"         # from DB
