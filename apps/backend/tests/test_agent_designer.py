"""Tests for agent design chat parsing."""

from app.schemas.agent_design import AgentDraft
from app.services.agent_designer import parse_design_response, _draft_ready


def test_parse_design_response_extracts_draft():
    raw = """Here is your agent draft:

```json
{"draft": {"name": "Code Reviewer", "description": "Reviews PRs", "system_prompt": "You review code.", "tools": [], "icon": "code-bracket", "category_slugs": ["it"], "is_public": false}, "ready": true}
```
"""
    message, draft, ready = parse_design_response(raw)
    assert "Code Reviewer" in (draft.name if draft else "")
    assert draft is not None
    assert draft.name == "Code Reviewer"
    assert ready is True
    assert "```" not in message


def test_draft_ready_system_requires_category():
    d = AgentDraft(name="A", system_prompt="Do things", category_slugs=[])
    assert _draft_ready(d, scope="system") is False
    d2 = AgentDraft(name="A", system_prompt="Do things", category_slugs=["it"])
    assert _draft_ready(d2, scope="system") is True
