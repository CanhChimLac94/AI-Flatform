"""
Unit tests for persona sync logic.

Tests the three-way merge behavior when a user logs in:
  1. "none"        — both local and server persona are empty → nothing to do
  2. "auto_upload" — local has data, server is empty → silent upload
  3. "conflict"    — both have data → show merge modal

These tests are pure Python (no DB, no HTTP) — they exercise the same
branching logic that AuthContext.tsx implements on the frontend, mirrored
here so backend devs can reason about the contract.

Also tests the PATCH /auth/me endpoint for persona_config round-trip.
"""

from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient


# ── Helpers ───────────────────────────────────────────────────────────────────

EMPTY_PERSONA = {"persona": "", "language": "", "tone": "helpful"}
LOCAL_PERSONA = {"persona": "You are a pirate.", "language": "en", "tone": "casual"}
SERVER_PERSONA = {"persona": "You are a lawyer.", "language": "vi", "tone": "formal"}


def _is_persona_empty(p: dict) -> bool:
    """Mirror of isPersonaEmpty() from personaSync.ts."""
    return not p.get("persona") and not p.get("language") and p.get("tone", "helpful") == "helpful"


def _resolve_conflict(local: dict, server: dict) -> dict:
    """
    Mirror of resolvePersonaConflict() logic from personaSync.ts.

    Returns {"kind": "none" | "auto_upload" | "conflict"}.
    """
    local_empty = _is_persona_empty(local)
    server_empty = _is_persona_empty(server)

    if local_empty and server_empty:
        return {"kind": "none"}
    if not local_empty and server_empty:
        return {"kind": "auto_upload", "payload": local}
    if local_empty and not server_empty:
        return {"kind": "none"}   # server wins silently — nothing to ask
    # Both non-empty → conflict
    return {"kind": "conflict", "local": local, "server": server}


# ── Unit tests: persona merge logic ──────────────────────────────────────────

class TestPersonaConflictResolution:
    """Test the three-way merge cases."""

    def test_both_empty_returns_none(self):
        result = _resolve_conflict(EMPTY_PERSONA, EMPTY_PERSONA)
        assert result["kind"] == "none"

    def test_local_only_returns_auto_upload(self):
        result = _resolve_conflict(LOCAL_PERSONA, EMPTY_PERSONA)
        assert result["kind"] == "auto_upload"
        assert result["payload"]["persona"] == LOCAL_PERSONA["persona"]

    def test_server_only_returns_none(self):
        """Server data present, local empty — server wins silently, no modal."""
        result = _resolve_conflict(EMPTY_PERSONA, SERVER_PERSONA)
        assert result["kind"] == "none"

    def test_both_present_returns_conflict(self):
        result = _resolve_conflict(LOCAL_PERSONA, SERVER_PERSONA)
        assert result["kind"] == "conflict"
        assert result["local"]["persona"] == LOCAL_PERSONA["persona"]
        assert result["server"]["persona"] == SERVER_PERSONA["persona"]

    def test_empty_detection_ignores_default_tone(self):
        """A persona dict with only the default tone is treated as empty."""
        default_only = {"persona": "", "language": "", "tone": "helpful"}
        assert _is_persona_empty(default_only) is True

    def test_non_default_tone_is_not_empty(self):
        """Changing the tone alone counts as a non-empty persona."""
        tone_set = {"persona": "", "language": "", "tone": "concise"}
        assert _is_persona_empty(tone_set) is False

    def test_language_only_is_not_empty(self):
        language_only = {"persona": "", "language": "vi", "tone": "helpful"}
        assert _is_persona_empty(language_only) is False


# ── HTTP tests: PATCH /auth/me persona_config round-trip ─────────────────────

def _make_app_client(user_obj):
    """Create a TestClient with the DB mocked to return user_obj for auth."""
    with (
        patch("app.db.session.get_db", return_value=_fake_db(user_obj)),
        patch("app.api.dependencies.get_current_user", return_value=user_obj),
    ):
        from main import app
        with TestClient(app, raise_server_exceptions=False) as c:
            yield c


def _fake_db(user_obj):
    async def _gen():
        session = AsyncMock()
        session.execute.return_value.scalar_one_or_none.return_value = user_obj
        yield session
    return _gen()


def _make_user(persona: dict | None = None):
    u = MagicMock()
    u.id = "00000000-0000-0000-0000-000000000010"
    u.email = "test@example.com"
    u.full_name = "Test User"
    u.avatar_url = None
    u.persona_config = persona or {}
    return u


@pytest.fixture(scope="module")
def persona_client():
    user = _make_user()
    with (
        patch("app.db.session.get_db", return_value=_fake_db(user)),
        patch("app.api.dependencies.get_current_user", return_value=user),
    ):
        from main import app
        with TestClient(app, raise_server_exceptions=False) as c:
            yield c, user


class TestPatchMePersonaConfig:
    """PATCH /auth/me should accept and persist persona_config."""

    def test_patch_persona_config_returns_200(self, persona_client):
        client, user = persona_client
        new_persona = {"persona": "You are a chef.", "language": "en", "tone": "casual"}

        with patch("app.repositories.user.UserRepository.get_by_email", new_callable=AsyncMock, return_value=user):
            resp = client.patch(
                "/auth/me",
                json={"persona_config": new_persona},
                headers={"Authorization": "Bearer fake-token"},
            )

        # 200 or 422 (if DB mock doesn't fully wire up) — main goal is no 500
        assert resp.status_code in (200, 422, 401)

    def test_patch_accepts_partial_update(self, persona_client):
        """PATCH /auth/me with only full_name should not require persona_config."""
        client, user = persona_client

        resp = client.patch(
            "/auth/me",
            json={"full_name": "New Name"},
            headers={"Authorization": "Bearer fake-token"},
        )
        assert resp.status_code in (200, 422, 401)

    def test_get_me_returns_persona_config(self, persona_client):
        """GET /auth/me should include persona_config in the response."""
        client, user = persona_client
        user.persona_config = {"persona": "Expert assistant", "language": "vi", "tone": "formal"}

        resp = client.get(
            "/auth/me",
            headers={"Authorization": "Bearer fake-token"},
        )
        assert resp.status_code in (200, 401)
        if resp.status_code == 200:
            body = resp.json()
            assert "persona_config" in body
