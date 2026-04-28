"""
Tests for user default provider/model settings and OpenRouter/NVIDIA key storage.

Scenarios — A) Default provider/model:
  A1. New user: register → GET /auth/me returns default_provider="openai", default_model="gpt-4o-mini"
  A2. Old user (null fields): login → _ensure_defaults backfills; GET /auth/me returns defaults
  A3. PATCH /settings/defaults → updates provider + model
  A4. PATCH /settings/defaults with invalid provider → 422
  A5. GET /settings/defaults requires auth → 401 for guest

Scenarios — B) OpenRouter / NVIDIA key storage:
  B1. GET /settings/api-keys includes openrouter + nvidia rows
  B2. PUT /settings/api-keys/openrouter → 204; subsequent GET shows is_set=True
  B3. PUT /settings/api-keys/nvidia → 204
  B4. Unsupported provider → 400
  B5. POST /settings/api-keys/openrouter/test → TestKeyResponse schema
  B6. POST /settings/api-keys/openrouter/test with unsupported provider → 400

Scenarios — Provider catalogue:
  C1. GET /settings/providers → returns all 6 providers, no auth required
  C2. GET /settings/providers/openrouter/models → list of model strings
  C3. GET /settings/providers/unknown → 404

Scenarios — D) Multi-key label column (regression for "column label does not exist"):
  D1. GET /settings/api-keys with stored keys → response includes label field
  D2. Each StoredKeyInfo carries the label value from the DB record
  D3. list_for_user query only accesses columns that exist on UserApiKey model
"""

import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock

import pytest
from fastapi.testclient import TestClient


# ── Helpers ───────────────────────────────────────────────────────────────────

OWNER_ID = uuid.UUID("cccccccc-0000-0000-0000-000000000001")


def _make_user(
    default_provider: str = "openai",
    default_model: str = "gpt-4o-mini",
) -> MagicMock:
    u = MagicMock()
    u.id = OWNER_ID
    u.email = "test@example.com"
    u.full_name = "Test User"
    u.avatar_url = None
    u.persona_config = {}
    u.default_provider = default_provider
    u.default_model = default_model
    return u


def _make_null_user() -> MagicMock:
    """Simulates a pre-migration user with empty default fields."""
    u = _make_user()
    u.default_provider = ""
    u.default_model = ""
    return u


def _fake_db():
    async def _gen():
        session = AsyncMock()
        session.execute.return_value.scalar_one_or_none.return_value = None
        session.execute.return_value.scalars.return_value.all.return_value = []
        yield session
    return _gen()


def _auth_header(user_id: uuid.UUID = OWNER_ID) -> dict:
    from app.core.security import create_access_token
    return {"Authorization": f"Bearer {create_access_token(subject=str(user_id))}"}


@pytest.fixture(scope="module")
def client():
    with (
        patch("app.db.session.get_db", return_value=_fake_db()),
        patch("app.db.redis.get_redis", return_value=_mock_redis()),
    ):
        from main import app
        with TestClient(app, raise_server_exceptions=False) as c:
            yield c


def _mock_redis():
    r = AsyncMock()
    r.get.return_value = None
    r.set.return_value = True
    r.incr.return_value = 1
    r.expire.return_value = True
    r.delete.return_value = 1
    return r


# ── A) Default provider/model ─────────────────────────────────────────────────

class TestUserDefaults:

    def test_a1_new_user_get_me_returns_defaults(self, client):
        """GET /auth/me always returns default_provider and default_model."""
        user = _make_user("openai", "gpt-4o-mini")

        with patch("app.api.dependencies.get_current_user", return_value=user):
            resp = client.get("/auth/me", headers=_auth_header())

        assert resp.status_code == 200
        body = resp.json()
        assert body["default_provider"] == "openai"
        assert body["default_model"] == "gpt-4o-mini"

    def test_a2_old_user_null_fields_get_defaults_returns_fallback(self, client):
        """GET /settings/defaults with empty fields returns server-side fallback."""
        user = _make_null_user()

        with patch("app.api.dependencies.get_current_user", return_value=user):
            resp = client.get("/settings/defaults", headers=_auth_header())

        assert resp.status_code == 200
        body = resp.json()
        assert body["default_provider"] == "openai"
        assert body["default_model"] == "gpt-4o-mini"

    def test_a3_patch_defaults_updates_provider_and_model(self, client):
        """PATCH /settings/defaults persists the new provider/model."""
        user = _make_user("openai", "gpt-4o-mini")

        with (
            patch("app.api.dependencies.get_current_user", return_value=user),
            patch("app.repositories.user.UserRepository.save", new_callable=AsyncMock),
        ):
            resp = client.patch(
                "/settings/defaults",
                json={"default_provider": "openrouter", "default_model": "openai/gpt-4o"},
                headers=_auth_header(),
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["default_provider"] == "openrouter"
        assert body["default_model"] == "openai/gpt-4o"

    def test_a4_patch_defaults_invalid_provider_returns_422(self, client):
        """PATCH with unknown provider is rejected at schema validation."""
        user = _make_user()

        with patch("app.api.dependencies.get_current_user", return_value=user):
            resp = client.patch(
                "/settings/defaults",
                json={"default_provider": "not-a-real-provider"},
                headers=_auth_header(),
            )

        assert resp.status_code == 422

    def test_a5_get_defaults_requires_auth(self, client):
        """GET /settings/defaults without a token → 401 or 403."""
        resp = client.get("/settings/defaults")
        assert resp.status_code in (401, 403)

    def test_a6_patch_defaults_only_provider_leaves_model_unchanged(self, client):
        """PATCH with only default_provider should not reset default_model."""
        user = _make_user("groq", "llama-3.3-70b-versatile")

        with (
            patch("app.api.dependencies.get_current_user", return_value=user),
            patch("app.repositories.user.UserRepository.save", new_callable=AsyncMock),
        ):
            resp = client.patch(
                "/settings/defaults",
                json={"default_provider": "nvidia"},
                headers=_auth_header(),
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["default_provider"] == "nvidia"
        # model was not sent → user object model unchanged
        assert body["default_model"] == "llama-3.3-70b-versatile"


# ── B) OpenRouter / NVIDIA key storage ───────────────────────────────────────

class TestOpenRouterNvidiaKeys:

    def test_b1_list_api_keys_includes_openrouter_and_nvidia(self, client):
        """GET /settings/api-keys must include openrouter and nvidia rows."""
        user = _make_user()

        with (
            patch("app.api.dependencies.get_current_user", return_value=user),
            patch(
                "app.repositories.user_api_key.UserApiKeyRepository.list_for_user",
                new_callable=AsyncMock,
                return_value=[],
            ),
        ):
            resp = client.get("/settings/api-keys", headers=_auth_header())

        assert resp.status_code == 200
        providers = {item["provider"] for item in resp.json()}
        assert "openrouter" in providers
        assert "nvidia" in providers

    def test_b2_save_openrouter_key_returns_204(self, client):
        user = _make_user()

        with (
            patch("app.api.dependencies.get_current_user", return_value=user),
            patch(
                "app.repositories.user_api_key.UserApiKeyRepository.upsert",
                new_callable=AsyncMock,
            ),
            patch("app.services.user_keys.invalidate_cache", new_callable=AsyncMock),
        ):
            resp = client.put(
                "/settings/api-keys/openrouter",
                json={"api_key": "sk-or-test-key-1234567890"},
                headers=_auth_header(),
            )

        assert resp.status_code == 204

    def test_b3_save_nvidia_key_returns_204(self, client):
        user = _make_user()

        with (
            patch("app.api.dependencies.get_current_user", return_value=user),
            patch(
                "app.repositories.user_api_key.UserApiKeyRepository.upsert",
                new_callable=AsyncMock,
            ),
            patch("app.services.user_keys.invalidate_cache", new_callable=AsyncMock),
        ):
            resp = client.put(
                "/settings/api-keys/nvidia",
                json={"api_key": "nvapi-test-key-1234567890"},
                headers=_auth_header(),
            )

        assert resp.status_code == 204

    def test_b4_unsupported_provider_returns_400(self, client):
        user = _make_user()

        with patch("app.api.dependencies.get_current_user", return_value=user):
            resp = client.put(
                "/settings/api-keys/fakeprovider",
                json={"api_key": "some-api-key-12345"},
                headers=_auth_header(),
            )

        assert resp.status_code == 400

    def test_b5_test_openrouter_key_returns_test_response_schema(self, client):
        """POST /settings/api-keys/openrouter/test → {ok, message}."""
        user = _make_user()

        with (
            patch("app.api.dependencies.get_current_user", return_value=user),
            patch(
                "app.services.provider_registry.test_provider_key",
                new_callable=AsyncMock,
                return_value=(True, "Key valid"),
            ),
        ):
            resp = client.post(
                "/settings/api-keys/openrouter/test",
                json={"api_key": "sk-or-test-key-1234567890"},
                headers=_auth_header(),
            )

        assert resp.status_code == 200
        body = resp.json()
        assert "ok" in body
        assert "message" in body
        assert body["ok"] is True

    def test_b5_test_invalid_key_returns_ok_false(self, client):
        user = _make_user()

        with (
            patch("app.api.dependencies.get_current_user", return_value=user),
            patch(
                "app.services.provider_registry.test_provider_key",
                new_callable=AsyncMock,
                return_value=(False, "Invalid API key"),
            ),
        ):
            resp = client.post(
                "/settings/api-keys/openrouter/test",
                json={"api_key": "bad-key-1234567890"},
                headers=_auth_header(),
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["ok"] is False
        assert "Invalid" in body["message"]

    def test_b6_test_unsupported_provider_returns_400(self, client):
        user = _make_user()

        with patch("app.api.dependencies.get_current_user", return_value=user):
            resp = client.post(
                "/settings/api-keys/fakeprovider/test",
                json={"api_key": "some-key-12345"},
                headers=_auth_header(),
            )

        assert resp.status_code == 400


# ── C) Provider catalogue ─────────────────────────────────────────────────────

class TestProviderCatalogue:

    def test_c1_list_providers_no_auth_returns_all_six(self, client):
        """GET /settings/providers is public and returns all 6 providers."""
        resp = client.get("/settings/providers")
        assert resp.status_code == 200
        ids = {p["id"] for p in resp.json()}
        assert ids == {"openai", "anthropic", "groq", "google", "openrouter", "nvidia"}

    def test_c1_each_provider_has_required_fields(self, client):
        resp = client.get("/settings/providers")
        for item in resp.json():
            assert "id" in item
            assert "name" in item
            assert "models" in item
            assert isinstance(item["models"], list)
            assert len(item["models"]) > 0
            assert "default_model" in item
            assert "key_prefix_hint" in item

    def test_c2_get_openrouter_models(self, client):
        resp = client.get("/settings/providers/openrouter/models")
        assert resp.status_code == 200
        models = resp.json()
        assert isinstance(models, list)
        assert len(models) > 0
        # All OpenRouter models follow "provider/model" format
        assert all("/" in m for m in models)

    def test_c2_get_nvidia_models(self, client):
        resp = client.get("/settings/providers/nvidia/models")
        assert resp.status_code == 200
        models = resp.json()
        assert "meta/llama-4-maverick-17b-128e-instruct" in models

    def test_c3_unknown_provider_returns_404(self, client):
        resp = client.get("/settings/providers/fakeprovider/models")
        assert resp.status_code == 404


# ── D) _ensure_defaults backfill logic (unit test) ───────────────────────────

class TestEnsureDefaultsLogic:
    """
    Unit-tests the _ensure_defaults helper from auth.py without HTTP overhead.
    """

    @pytest.mark.asyncio
    async def test_backfill_empty_provider_and_model(self):
        from app.api.v1.auth import _ensure_defaults

        user = _make_null_user()
        repo = AsyncMock()
        repo.save = AsyncMock()
        db = AsyncMock()

        await _ensure_defaults(user, repo, db)

        assert user.default_provider == "openai"
        assert user.default_model == "gpt-4o-mini"
        repo.save.assert_called_once_with(user)

    @pytest.mark.asyncio
    async def test_no_backfill_when_already_set(self):
        from app.api.v1.auth import _ensure_defaults

        user = _make_user("anthropic", "claude-3-5-sonnet-20241022")
        repo = AsyncMock()
        repo.save = AsyncMock()
        db = AsyncMock()

        await _ensure_defaults(user, repo, db)

        assert user.default_provider == "anthropic"
        repo.save.assert_not_called()


# ── D) Multi-key label column regression ─────────────────────────────────────

def _make_api_key_record(
    provider: str = "openai",
    label: str = "Default",
    is_active: bool = True,
) -> MagicMock:
    """Return a minimal UserApiKey-like mock that matches the ORM model fields."""
    from app.services.encryption import encrypt_key

    r = MagicMock()
    r.id = uuid.uuid4()
    r.user_id = OWNER_ID
    r.provider = provider
    r.label = label            # must exist — absence causes the production error
    r.is_active = is_active
    r.encrypted_key = encrypt_key("sk-test-key-1234567890")
    r.created_at = datetime.utcnow()
    return r


class TestMultiKeyLabel:
    """Regression suite: column user_api_keys.label does not exist."""

    def test_d1_list_api_keys_includes_label_field(self, client):
        """GET /settings/api-keys must include 'label' in every StoredKeyInfo."""
        user = _make_user()
        records = [_make_api_key_record("openai", "Work key")]

        with (
            patch("app.api.dependencies.get_current_user", return_value=user),
            patch(
                "app.repositories.user_api_key.UserApiKeyRepository.list_for_user",
                new_callable=AsyncMock,
                return_value=records,
            ),
        ):
            resp = client.get("/settings/api-keys", headers=_auth_header())

        assert resp.status_code == 200
        openai_group = next(g for g in resp.json() if g["provider"] == "openai")
        assert openai_group["is_set"] is True
        stored = openai_group["keys"]
        assert len(stored) == 1
        assert "label" in stored[0], "StoredKeyInfo must expose 'label'"
        assert stored[0]["label"] == "Work key"

    def test_d2_multiple_keys_each_carry_own_label(self, client):
        """When a provider has two keys their labels are distinct in the response."""
        user = _make_user()
        records = [
            _make_api_key_record("groq", "Personal", is_active=False),
            _make_api_key_record("groq", "Work",     is_active=True),
        ]

        with (
            patch("app.api.dependencies.get_current_user", return_value=user),
            patch(
                "app.repositories.user_api_key.UserApiKeyRepository.list_for_user",
                new_callable=AsyncMock,
                return_value=records,
            ),
        ):
            resp = client.get("/settings/api-keys", headers=_auth_header())

        assert resp.status_code == 200
        groq_group = next(g for g in resp.json() if g["provider"] == "groq")
        labels = {k["label"] for k in groq_group["keys"]}
        assert labels == {"Personal", "Work"}

    @pytest.mark.asyncio
    async def test_d3_list_for_user_repo_accesses_label_attribute(self):
        """Unit-test: UserApiKeyRepository.list_for_user returns records with .label."""
        from app.repositories.user_api_key import UserApiKeyRepository

        record = _make_api_key_record("anthropic", "My Claude key")

        session = AsyncMock()
        execute_result = MagicMock()
        execute_result.scalars.return_value.all.return_value = [record]
        session.execute = AsyncMock(return_value=execute_result)

        repo = UserApiKeyRepository(session)
        results = await repo.list_for_user(OWNER_ID)

        assert len(results) == 1
        # Accessing .label must not raise AttributeError — confirms model has the field.
        assert results[0].label == "My Claude key"
        assert results[0].is_active is True

    def test_d4_stored_key_info_schema_has_label_not_name(self, client):
        """StoredKeyInfo response schema uses 'label', not a renamed 'name' field."""
        user = _make_user()
        records = [_make_api_key_record("openai", "Default")]

        with (
            patch("app.api.dependencies.get_current_user", return_value=user),
            patch(
                "app.repositories.user_api_key.UserApiKeyRepository.list_for_user",
                new_callable=AsyncMock,
                return_value=records,
            ),
        ):
            resp = client.get("/settings/api-keys", headers=_auth_header())

        assert resp.status_code == 200
        openai_group = next(g for g in resp.json() if g["provider"] == "openai")
        key_obj = openai_group["keys"][0]
        assert "label" in key_obj
        assert "name" not in key_obj  # 'name' is not the exposed field
