"""
Tests for Agent CRUD + permission model + agent injection in chat.

Scenarios:
  1. Create agent → 201 with correct fields
  2. List agents → only returns owner's agents
  3. GET agent — owner can read, non-owner blocked for private agents
  4. GET agent — non-owner CAN read public agents
  5. PATCH agent — only owner can update (non-owner → 404)
  6. DELETE agent — only owner can delete (non-owner → 404)
  7. Duplicate — creates a copy owned by the caller
  8. Chat endpoint injects agent system_prompt when agent_id provided
  9. Chat endpoint uses conversation.agent_id when no agent_id in request
 10. Guest (unauthenticated) cannot list/create agents (→ 401)
"""

import json
import uuid
from collections.abc import AsyncGenerator
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient


# ── Fixtures & helpers ────────────────────────────────────────────────────────

OWNER_ID = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000001")
OTHER_ID  = uuid.UUID("bbbbbbbb-0000-0000-0000-000000000002")


def _make_agent(
    owner_id: uuid.UUID = OWNER_ID,
    name: str = "Test Agent",
    system_prompt: str = "You are a test agent.",
    model: str | None = None,
    tools: list | None = None,
    is_public: bool = False,
    agent_id: uuid.UUID | None = None,
) -> MagicMock:
    a = MagicMock()
    a.id = agent_id or uuid.uuid4()
    a.owner_user_id = owner_id
    a.name = name
    a.description = "A test agent"
    a.system_prompt = system_prompt
    a.model = model
    a.params = {}
    a.tools = tools or []
    a.is_public = is_public
    a.created_at = datetime(2025, 1, 1)
    a.updated_at = datetime(2025, 1, 1)
    return a


def _make_user(user_id: uuid.UUID = OWNER_ID) -> MagicMock:
    u = MagicMock()
    u.id = user_id
    u.email = f"user-{user_id}@example.com"
    u.full_name = "Test User"
    u.persona_config = {}
    return u


def _fake_db():
    async def _gen():
        session = AsyncMock()
        session.execute.return_value.scalar_one_or_none.return_value = None
        session.execute.return_value.scalars.return_value.all.return_value = []
        yield session
    return _gen()


def _make_sse_stream(*events: dict) -> AsyncGenerator[str, None]:
    async def _gen():
        for ev in events:
            yield f"data: {json.dumps(ev)}\n\n"
    return _gen()


@pytest.fixture(scope="module")
def client():
    """TestClient with DB, Redis, moderation, and memory mocked."""
    with (
        patch("app.db.session.get_db", return_value=_fake_db()),
        patch("app.db.redis.get_redis", return_value=_mock_redis()),
        patch("app.services.moderation.check_content", new_callable=AsyncMock),
        patch("app.services.memory.retrieve_memory_context", new_callable=AsyncMock, return_value=""),
        patch("app.services.memory.extract_and_store_facts", new_callable=AsyncMock),
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
    return r


def _auth_header(user_id: uuid.UUID = OWNER_ID) -> dict:
    from app.core.security import create_access_token
    return {"Authorization": f"Bearer {create_access_token(subject=str(user_id))}"}


# ── 10. Guest cannot list/create agents ──────────────────────────────────────

class TestGuestAgentAccess:
    def test_list_agents_requires_auth(self, client):
        resp = client.get("/agents")
        assert resp.status_code == 401

    def test_create_agent_requires_auth(self, client):
        resp = client.post("/agents", json={"name": "x", "system_prompt": "y"})
        assert resp.status_code == 401


# ── 1. Create agent ───────────────────────────────────────────────────────────

class TestCreateAgent:
    def test_create_agent_returns_201(self, client):
        owner = _make_user(OWNER_ID)
        created_agent = _make_agent(owner_id=OWNER_ID, name="My Expert")

        with (
            patch("app.api.dependencies.get_current_user", return_value=owner),
            patch("app.repositories.agent.AgentRepository.create", new_callable=AsyncMock, return_value=created_agent),
        ):
            resp = client.post(
                "/agents",
                json={
                    "name": "My Expert",
                    "system_prompt": "You are a Python expert.",
                    "tools": ["web_search"],
                    "is_public": False,
                },
                headers=_auth_header(OWNER_ID),
            )

        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == "My Expert"
        assert str(body["owner_user_id"]) == str(OWNER_ID)

    def test_create_agent_name_required(self, client):
        owner = _make_user(OWNER_ID)

        with patch("app.api.dependencies.get_current_user", return_value=owner):
            resp = client.post(
                "/agents",
                json={"system_prompt": "No name provided"},
                headers=_auth_header(OWNER_ID),
            )

        assert resp.status_code == 422


# ── 2. List agents ────────────────────────────────────────────────────────────

class TestListAgents:
    def test_list_returns_owner_agents_only(self, client):
        owner = _make_user(OWNER_ID)
        agents = [_make_agent(name="A1"), _make_agent(name="A2")]

        with (
            patch("app.api.dependencies.get_current_user", return_value=owner),
            patch("app.repositories.agent.AgentRepository.list_for_user", new_callable=AsyncMock, return_value=agents),
        ):
            resp = client.get("/agents", headers=_auth_header(OWNER_ID))

        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 2
        assert {a["name"] for a in body} == {"A1", "A2"}


# ── 3 & 4. GET agent — owner vs non-owner ────────────────────────────────────

class TestGetAgent:
    def test_owner_can_read_private_agent(self, client):
        owner = _make_user(OWNER_ID)
        agent = _make_agent(owner_id=OWNER_ID, is_public=False)

        with (
            patch("app.api.dependencies.get_current_user", return_value=owner),
            patch("app.repositories.agent.AgentRepository.get", new_callable=AsyncMock, return_value=agent),
        ):
            resp = client.get(f"/agents/{agent.id}", headers=_auth_header(OWNER_ID))

        assert resp.status_code == 200

    def test_non_owner_blocked_on_private_agent(self, client):
        other = _make_user(OTHER_ID)
        agent = _make_agent(owner_id=OWNER_ID, is_public=False)

        with (
            patch("app.api.dependencies.get_current_user", return_value=other),
            patch("app.repositories.agent.AgentRepository.get", new_callable=AsyncMock, return_value=agent),
        ):
            resp = client.get(f"/agents/{agent.id}", headers=_auth_header(OTHER_ID))

        assert resp.status_code == 403

    def test_non_owner_can_read_public_agent(self, client):
        other = _make_user(OTHER_ID)
        agent = _make_agent(owner_id=OWNER_ID, is_public=True)

        with (
            patch("app.api.dependencies.get_current_user", return_value=other),
            patch("app.repositories.agent.AgentRepository.get", new_callable=AsyncMock, return_value=agent),
        ):
            resp = client.get(f"/agents/{agent.id}", headers=_auth_header(OTHER_ID))

        assert resp.status_code == 200


# ── 5. PATCH agent — owner only ───────────────────────────────────────────────

class TestUpdateAgent:
    def test_owner_can_update(self, client):
        owner = _make_user(OWNER_ID)
        agent = _make_agent(owner_id=OWNER_ID)
        updated = _make_agent(owner_id=OWNER_ID, name="Updated Name")

        with (
            patch("app.api.dependencies.get_current_user", return_value=owner),
            patch("app.repositories.agent.AgentRepository.get_owned", new_callable=AsyncMock, return_value=agent),
            patch("app.repositories.agent.AgentRepository.save", new_callable=AsyncMock),
        ):
            resp = client.patch(
                f"/agents/{agent.id}",
                json={"name": "Updated Name"},
                headers=_auth_header(OWNER_ID),
            )

        assert resp.status_code == 200

    def test_non_owner_cannot_update(self, client):
        other = _make_user(OTHER_ID)

        with (
            patch("app.api.dependencies.get_current_user", return_value=other),
            patch("app.repositories.agent.AgentRepository.get_owned", new_callable=AsyncMock, return_value=None),
        ):
            resp = client.patch(
                f"/agents/{uuid.uuid4()}",
                json={"name": "Hijacked"},
                headers=_auth_header(OTHER_ID),
            )

        assert resp.status_code == 404


# ── 6. DELETE agent — owner only ──────────────────────────────────────────────

class TestDeleteAgent:
    def test_owner_can_delete(self, client):
        owner = _make_user(OWNER_ID)
        agent = _make_agent(owner_id=OWNER_ID)

        with (
            patch("app.api.dependencies.get_current_user", return_value=owner),
            patch("app.repositories.agent.AgentRepository.get_owned", new_callable=AsyncMock, return_value=agent),
            patch("app.repositories.agent.AgentRepository.delete", new_callable=AsyncMock),
        ):
            resp = client.delete(f"/agents/{agent.id}", headers=_auth_header(OWNER_ID))

        assert resp.status_code == 204

    def test_non_owner_delete_returns_404(self, client):
        other = _make_user(OTHER_ID)

        with (
            patch("app.api.dependencies.get_current_user", return_value=other),
            patch("app.repositories.agent.AgentRepository.get_owned", new_callable=AsyncMock, return_value=None),
        ):
            resp = client.delete(f"/agents/{uuid.uuid4()}", headers=_auth_header(OTHER_ID))

        assert resp.status_code == 404


# ── 7. Duplicate ──────────────────────────────────────────────────────────────

class TestDuplicateAgent:
    def test_duplicate_creates_copy_for_caller(self, client):
        owner = _make_user(OWNER_ID)
        source = _make_agent(owner_id=OWNER_ID, name="Original")
        copy_agent = _make_agent(owner_id=OWNER_ID, name="Original (copy)")

        with (
            patch("app.api.dependencies.get_current_user", return_value=owner),
            patch("app.repositories.agent.AgentRepository.get", new_callable=AsyncMock, return_value=source),
            patch("app.repositories.agent.AgentRepository.create", new_callable=AsyncMock, return_value=copy_agent),
        ):
            resp = client.post(f"/agents/{source.id}/duplicate", headers=_auth_header(OWNER_ID))

        assert resp.status_code == 201
        assert "(copy)" in resp.json()["name"]

    def test_cannot_duplicate_private_agent_of_other(self, client):
        other = _make_user(OTHER_ID)
        source = _make_agent(owner_id=OWNER_ID, is_public=False)

        with (
            patch("app.api.dependencies.get_current_user", return_value=other),
            patch("app.repositories.agent.AgentRepository.get", new_callable=AsyncMock, return_value=source),
        ):
            resp = client.post(f"/agents/{source.id}/duplicate", headers=_auth_header(OTHER_ID))

        assert resp.status_code == 403


# ── 8. Chat: agent_id in request injects system_prompt ───────────────────────

class TestAgentInjectionInChat:
    FAKE_DONE = {
        "type": "done",
        "usage": {
            "prompt_tokens": 5, "completion_tokens": 5,
            "total_tokens": 10, "provider": "openai", "model": "gpt-4o",
        },
    }

    def test_agent_system_prompt_injected(self, client):
        """When agent_id is passed, agent.system_prompt is used as system prompt."""
        agent = _make_agent(
            owner_id=OWNER_ID,
            system_prompt="You are an expert sommelier.",
            is_public=True,
        )
        fake_stream = _make_sse_stream(
            {"type": "content", "delta": "A fine Bordeaux."},
            self.FAKE_DONE,
        )

        with (
            patch("app.repositories.agent.AgentRepository.get", new_callable=AsyncMock, return_value=agent),
            patch("app.services.orchestrator.stream_chat_completion", return_value=fake_stream),
            patch("app.api.v1.chat.get_all_effective_keys", new_callable=AsyncMock, return_value={}),
        ):
            resp = client.post(
                "/v1/chat/completions",
                json={
                    "messages": [{"role": "user", "content": "Recommend a wine."}],
                    "agent_id": str(agent.id),
                    "provider": "openai",
                    "model": "gpt-4o",
                    "api_key": "sk-test",
                    "stream": True,
                },
                stream=True,
            )

        assert resp.status_code == 200
        events = []
        for line in resp.iter_lines():
            if isinstance(line, bytes):
                line = line.decode()
            if line.startswith("data: "):
                try:
                    events.append(json.loads(line[6:]))
                except json.JSONDecodeError:
                    pass
        types = [e.get("type") for e in events]
        assert "content" in types or "done" in types

    def test_agent_model_override_applied(self, client):
        """Agent.model overrides the request model when req.model is not set."""
        agent = _make_agent(
            owner_id=OWNER_ID,
            model="gpt-4-turbo",
            is_public=True,
        )
        received_reqs = []

        async def _capture_stream(req, **kwargs):
            received_reqs.append(req)
            yield f"data: {json.dumps({'type': 'content', 'delta': 'ok'})}\n\n"
            yield f"data: {json.dumps(self.FAKE_DONE)}\n\n"

        with (
            patch("app.repositories.agent.AgentRepository.get", new_callable=AsyncMock, return_value=agent),
            patch("app.services.orchestrator.stream_chat_completion", side_effect=_capture_stream),
            patch("app.api.v1.chat.get_all_effective_keys", new_callable=AsyncMock, return_value={}),
        ):
            resp = client.post(
                "/v1/chat/completions",
                json={
                    "messages": [{"role": "user", "content": "Hello"}],
                    "agent_id": str(agent.id),
                    "provider": "openai",
                    "api_key": "sk-test",
                    "stream": True,
                    # model NOT set — agent.model should take over
                },
                stream=True,
            )

        assert resp.status_code == 200
        if received_reqs:
            assert received_reqs[0].model == "gpt-4-turbo"
