import json
from pathlib import Path

import pytest

from app.data.default_system_agents import (
    BUNDLED_JSON_PATH,
    DEFAULT_SYSTEM_AGENTS,
    get_default_system_agents,
    load_default_system_agents_from_path,
)


def _sample_agent() -> dict:
    return {
        "name": "Test Agent",
        "system_prompt": "Do something useful.",
        "icon": "sparkles",
        "category_slug": "it",
        "description": "A test agent.",
    }


def test_load_from_json_array(tmp_path: Path) -> None:
    path = tmp_path / "agents.json"
    path.write_text(json.dumps([_sample_agent()]), encoding="utf-8")

    agents = load_default_system_agents_from_path(path)

    assert len(agents) == 1
    assert agents[0].name == "Test Agent"
    assert agents[0].category_slug == "it"


def test_load_from_wrapped_agents_key(tmp_path: Path) -> None:
    path = tmp_path / "agents.json"
    path.write_text(json.dumps({"agents": [_sample_agent()]}), encoding="utf-8")

    agents = load_default_system_agents_from_path(path)

    assert len(agents) == 1
    assert agents[0].name == "Test Agent"


def test_rejects_missing_required_field(tmp_path: Path) -> None:
    path = tmp_path / "agents.json"
    path.write_text(json.dumps([{"name": "Incomplete"}]), encoding="utf-8")

    with pytest.raises(ValueError, match="missing required field"):
        load_default_system_agents_from_path(path)


def test_get_default_system_agents_uses_explicit_path(tmp_path: Path) -> None:
    path = tmp_path / "custom.json"
    path.write_text(json.dumps([_sample_agent()]), encoding="utf-8")

    agents = get_default_system_agents(path)

    assert agents[0].name == "Test Agent"


def test_bundled_json_matches_builtin_count() -> None:
    agents = load_default_system_agents_from_path(BUNDLED_JSON_PATH)

    assert len(agents) == len(DEFAULT_SYSTEM_AGENTS)
    assert {a.name for a in agents} == {a.name for a in DEFAULT_SYSTEM_AGENTS}
