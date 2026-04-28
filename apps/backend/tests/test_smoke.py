"""
Smoke tests — guest & authenticated chat flows.

These tests exercise the full HTTP contract between the test client and the
FastAPI app without hitting a real LLM or database:
  - Provider adapters are mocked at the orchestrator level.
  - DB session is replaced by an in-memory AsyncMock.
  - Redis is replaced by an AsyncMock.

Test scenarios:
  1. Guest chat with OpenRouter (explicit provider + inline api_key)
  2. Guest chat with NVIDIA NIM  (explicit provider + inline api_key)
  3. Logged-in chat with default provider (intent routing, no explicit provider)
"""

import json
import os
from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_sse_stream(*events: dict) -> AsyncGenerator[str, None]:
    """Build a fake SSE async generator from a list of event dicts."""
    async def _gen():
        for ev in events:
            yield f"data: {json.dumps(ev)}\n\n"
    return _gen()


FAKE_CONTENT_EVENT = {"type": "content", "delta": "Hello!"}
FAKE_DONE_EVENT = {
    "type": "done",
    "usage": {
        "prompt_tokens": 10,
        "completion_tokens": 5,
        "total_tokens": 15,
        "provider": "openrouter",
        "model": "openai/gpt-4o",
    },
}
FAKE_DONE_NVIDIA = {
    "type": "done",
    "usage": {
        "prompt_tokens": 10,
        "completion_tokens": 5,
        "total_tokens": 15,
        "provider": "nvidia",
        "model": "meta/llama-4-maverick-17b-128e-instruct",
    },
}
FAKE_DONE_OPENAI = {
    "type": "done",
    "usage": {
        "prompt_tokens": 10,
        "completion_tokens": 5,
        "total_tokens": 15,
        "provider": "openai",
        "model": "gpt-4o",
    },
}


def _collect_sse(response) -> list[dict]:
    """Parse all SSE data lines from a streaming response."""
    events = []
    for line in response.iter_lines():
        if isinstance(line, bytes):
            line = line.decode()
        if line.startswith("data: "):
            try:
                events.append(json.loads(line[6:]))
            except json.JSONDecodeError:
                pass
    return events


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def client():
    """TestClient with all external I/O mocked out."""
    # Patch DB, Redis, moderation, memory, and web_search globally for all tests.
    with (
        patch("app.db.session.get_db", return_value=_mock_db_session()),
        patch("app.db.redis.get_redis", return_value=_mock_redis()),
        patch("app.services.moderation.check_content", new_callable=AsyncMock),
        patch("app.services.memory.retrieve_memory_context", new_callable=AsyncMock, return_value=""),
        patch("app.services.memory.extract_and_store_facts", new_callable=AsyncMock),
        patch("app.services.tools.web_search.web_search", new_callable=AsyncMock),
    ):
        from main import app  # import inside context to pick up patches
        with TestClient(app, raise_server_exceptions=False) as c:
            yield c


def _mock_db_session():
    """Async generator yielding a no-op AsyncMock session."""
    async def _gen():
        session = AsyncMock()
        session.execute.return_value.scalar_one_or_none.return_value = None
        session.execute.return_value.scalars.return_value.all.return_value = []
        yield session
    return _gen()


def _mock_redis():
    redis = AsyncMock()
    redis.get.return_value = None
    redis.set.return_value = True
    redis.incr.return_value = 1
    redis.expire.return_value = True
    return redis


# ── Smoke test 1: Guest chat with OpenRouter ──────────────────────────────────

class TestGuestChatOpenRouter:
    """Guest user sends a message using OpenRouter with an inline API key."""

    def test_returns_sse_stream(self, client):
        fake_stream = _make_sse_stream(FAKE_CONTENT_EVENT, FAKE_DONE_EVENT)

        with patch(
            "app.services.orchestrator._stream_openrouter",
            return_value=fake_stream,
        ):
            resp = client.post(
                "/v1/chat/completions",
                json={
                    "messages": [{"role": "user", "content": "Hello from OpenRouter"}],
                    "provider": "openrouter",
                    "model": "openai/gpt-4o",
                    "api_key": "sk-or-test-key",
                    "stream": True,
                },
                headers={"X-Request-Id": "smoke-test-openrouter-001"},
                stream=True,
            )

        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers.get("content-type", "")
        assert resp.headers.get("x-request-id") == "smoke-test-openrouter-001"

        events = _collect_sse(resp)
        types = [e.get("type") for e in events]
        assert "content" in types
        assert "done" in types

    def test_invalid_provider_returns_400(self, client):
        resp = client.post(
            "/v1/chat/completions",
            json={
                "messages": [{"role": "user", "content": "Hi"}],
                "provider": "not-a-real-provider",
                "api_key": "test",
            },
        )
        assert resp.status_code == 400
        body = resp.json()
        assert "detail" in body or "message" in body

    def test_request_id_generated_when_absent(self, client):
        fake_stream = _make_sse_stream(FAKE_CONTENT_EVENT, FAKE_DONE_EVENT)

        with patch(
            "app.services.orchestrator._stream_openrouter",
            return_value=fake_stream,
        ):
            resp = client.post(
                "/v1/chat/completions",
                json={
                    "messages": [{"role": "user", "content": "No request id"}],
                    "provider": "openrouter",
                    "model": "openai/gpt-4o",
                    "api_key": "sk-or-test-key",
                    "stream": True,
                },
                stream=True,
            )

        # Backend must always echo or generate X-Request-Id
        assert resp.headers.get("x-request-id") is not None


# ── Smoke test 2: Guest chat with NVIDIA ──────────────────────────────────────

class TestGuestChatNvidia:
    """Guest user sends a message using NVIDIA NIM with an inline API key."""

    def test_returns_sse_stream(self, client):
        fake_stream = _make_sse_stream(FAKE_CONTENT_EVENT, FAKE_DONE_NVIDIA)

        with patch(
            "app.services.orchestrator._stream_nvidia",
            return_value=fake_stream,
        ):
            resp = client.post(
                "/v1/chat/completions",
                json={
                    "messages": [{"role": "user", "content": "Hello from NVIDIA NIM"}],
                    "provider": "nvidia",
                    "model": "meta/llama-4-maverick-17b-128e-instruct",
                    "api_key": "nvapi-test-key",
                    "stream": True,
                },
                headers={"X-Request-Id": "smoke-test-nvidia-001"},
                stream=True,
            )

        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers.get("content-type", "")

        events = _collect_sse(resp)
        done_events = [e for e in events if e.get("type") == "done"]
        assert done_events, "Expected at least one 'done' event"
        assert done_events[0]["usage"]["provider"] == "nvidia"

    def test_missing_api_key_surfaces_error_in_stream(self, client):
        """When no api_key is passed and NVIDIA_API_KEY env is empty,
        the stream must emit an 'error' event (not a 500)."""
        with patch.dict(os.environ, {"NVIDIA_API_KEY": ""}):
            resp = client.post(
                "/v1/chat/completions",
                json={
                    "messages": [{"role": "user", "content": "no key"}],
                    "provider": "nvidia",
                    "model": "meta/llama-4-maverick-17b-128e-instruct",
                    # api_key intentionally omitted
                    "stream": True,
                },
                stream=True,
            )
        # Response still 200 (SSE), but contains an error event
        assert resp.status_code == 200
        events = _collect_sse(resp)
        error_events = [e for e in events if e.get("type") == "error"]
        assert error_events, "Expected an SSE 'error' event when api_key missing"


# ── Smoke test 3: Logged-in chat with default provider ───────────────────────

class TestAuthenticatedChat:
    """Authenticated user chats; backend routes via intent classification."""

    def _make_auth_token(self) -> str:
        from app.core.security import create_access_token
        import uuid
        return create_access_token(subject=str(uuid.uuid4()))

    def test_authenticated_chat_uses_intent_routing(self, client):
        fake_stream = _make_sse_stream(
            {"type": "status", "content": "Routing to openai (COMPLEX)…"},
            FAKE_CONTENT_EVENT,
            FAKE_DONE_OPENAI,
        )

        token = self._make_auth_token()

        with (
            patch("app.services.orchestrator._stream_openai", return_value=fake_stream),
            patch("app.services.orchestrator.classify_intent", new_callable=AsyncMock) as mock_intent,
            patch("app.api.v1.chat.get_optional_user") as mock_user,
            patch("app.api.v1.chat.get_all_effective_keys", new_callable=AsyncMock, return_value={}),
        ):
            from app.services.intent_classifier import Intent
            mock_intent.return_value = Intent.COMPLEX

            mock_user_obj = MagicMock()
            mock_user_obj.id = "00000000-0000-0000-0000-000000000001"
            mock_user_obj.full_name = "Test User"
            mock_user_obj.persona_config = {}
            mock_user.return_value = mock_user_obj

            resp = client.post(
                "/v1/chat/completions",
                json={
                    "messages": [{"role": "user", "content": "Explain quantum entanglement"}],
                    "stream": True,
                    # No provider/model/api_key — intent routing decides
                },
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-Request-Id": "smoke-auth-001",
                },
                stream=True,
            )

        assert resp.status_code == 200
        events = _collect_sse(resp)
        types = [e.get("type") for e in events]
        assert "content" in types or "status" in types, (
            f"Expected content/status events in SSE stream, got: {types}"
        )

    def test_no_provider_in_authenticated_request(self, client):
        """Authenticated requests should NOT require provider/model/api_key."""
        token = self._make_auth_token()
        fake_stream = _make_sse_stream(FAKE_CONTENT_EVENT, FAKE_DONE_OPENAI)

        with (
            patch("app.services.orchestrator.stream_chat_completion", return_value=fake_stream),
            patch("app.api.v1.chat.get_optional_user") as mock_user,
            patch("app.api.v1.chat.get_all_effective_keys", new_callable=AsyncMock, return_value={}),
        ):
            mock_user_obj = MagicMock()
            mock_user_obj.id = "00000000-0000-0000-0000-000000000002"
            mock_user_obj.full_name = "Auth User"
            mock_user_obj.persona_config = {}
            mock_user.return_value = mock_user_obj

            resp = client.post(
                "/v1/chat/completions",
                json={"messages": [{"role": "user", "content": "Hi"}]},
                headers={"Authorization": f"Bearer {token}"},
                stream=True,
            )

        assert resp.status_code == 200
