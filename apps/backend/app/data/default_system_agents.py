"""Default system agents — load from JSON for post-deploy updates."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).resolve().parent
BUNDLED_JSON_PATH = _DATA_DIR / "default_system_agents.json"


@dataclass(frozen=True)
class DefaultSystemAgent:
    name: str
    system_prompt: str
    icon: str
    category_slug: str
    description: str | None = None


_BUILTIN_DEFAULT_SYSTEM_AGENTS: tuple[DefaultSystemAgent, ...] = (
    DefaultSystemAgent(
        name="Business Analysis",
        system_prompt="Phân tích yêu cầu nghiệp vụ và tạo đặc tả chức năng.",
        icon="chart-bar",
        category_slug="quan-tri",
        description="Phân tích nghiệp vụ, thu thập yêu cầu và viết đặc tả chức năng.",
    ),
    DefaultSystemAgent(
        name="UI/UX Designer",
        system_prompt="Thiết kế giao diện người dùng và trải nghiệm tương tác.",
        icon="paint-brush",
        category_slug="media",
        description="Thiết kế wireframe, UI và trải nghiệm người dùng.",
    ),
    DefaultSystemAgent(
        name="System Architect",
        system_prompt="Thiết kế kiến trúc hạ tầng và sơ đồ cơ sở dữ liệu.",
        icon="server-stack",
        category_slug="it",
        description="Thiết kế kiến trúc hệ thống, API và cơ sở dữ liệu.",
    ),
    DefaultSystemAgent(
        name="Fullstack Dev",
        system_prompt="Triển khai logic backend và giao diện frontend.",
        icon="code-bracket",
        category_slug="it",
        description="Phát triển fullstack: backend, frontend và tích hợp.",
    ),
    DefaultSystemAgent(
        name="QA Tester",
        system_prompt="Kiểm thử các trường hợp sử dụng và báo cáo lỗi.",
        icon="shield-check",
        category_slug="it",
        description="Viết test case, kiểm thử và báo cáo lỗi.",
    ),
    DefaultSystemAgent(
        name="Architect",
        system_prompt="Thiết kế sơ đồ database và API.",
        icon="puzzle-piece",
        category_slug="it",
        description="Thiết kế database schema và contract API cho dự án phần mềm.",
    ),
    DefaultSystemAgent(
        name="Developer",
        system_prompt="Viết code frontend và backend.",
        icon="code-bracket",
        category_slug="it",
        description="Triển khai tính năng phần mềm trên frontend và backend.",
    ),
    DefaultSystemAgent(
        name="Researcher",
        system_prompt="Tìm kiếm xu hướng và số liệu thống kê.",
        icon="beaker",
        category_slug="marketing",
        description="Nghiên cứu chủ đề, xu hướng thị trường và số liệu.",
    ),
    DefaultSystemAgent(
        name="Blog Writer",
        system_prompt="Viết bài blog chi tiết.",
        icon="document-text",
        category_slug="marketing",
        description="Soạn thảo bài blog chuyên sâu, có cấu trúc rõ ràng.",
    ),
    DefaultSystemAgent(
        name="Social Media",
        system_prompt="Viết caption Facebook/Insta.",
        icon="megaphone",
        category_slug="marketing",
        description="Tạo nội dung ngắn cho mạng xã hội.",
    ),
)

# Frozen snapshot for Alembic migration 0011 (do not change after deploy).
DEFAULT_SYSTEM_AGENTS: tuple[DefaultSystemAgent, ...] = _BUILTIN_DEFAULT_SYSTEM_AGENTS
DEFAULT_SYSTEM_AGENT_NAMES: frozenset[str] = frozenset(a.name for a in DEFAULT_SYSTEM_AGENTS)

_REQUIRED_FIELDS = ("name", "system_prompt", "icon", "category_slug")


def _parse_agent_entry(raw: dict[str, Any], *, source: str, index: int) -> DefaultSystemAgent:
    missing = [field for field in _REQUIRED_FIELDS if not str(raw.get(field, "")).strip()]
    if missing:
        raise ValueError(
            f"{source}: entry #{index + 1} missing required field(s): {', '.join(missing)}"
        )

    description = raw.get("description")
    if description is not None and not isinstance(description, str):
        raise ValueError(f"{source}: entry #{index + 1} 'description' must be a string or null")

    return DefaultSystemAgent(
        name=str(raw["name"]).strip(),
        system_prompt=str(raw["system_prompt"]).strip(),
        icon=str(raw["icon"]).strip(),
        category_slug=str(raw["category_slug"]).strip(),
        description=description.strip() if isinstance(description, str) and description.strip() else None,
    )


def _extract_agent_list(data: Any, *, source: str) -> list[dict[str, Any]]:
    if isinstance(data, list):
        entries = data
    elif isinstance(data, dict) and isinstance(data.get("agents"), list):
        entries = data["agents"]
    else:
        raise ValueError(
            f"{source}: expected a JSON array or object with an 'agents' array"
        )

    result: list[dict[str, Any]] = []
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            raise ValueError(f"{source}: entry #{index + 1} must be an object")
        result.append(entry)
    return result


def load_default_system_agents_from_path(path: Path) -> tuple[DefaultSystemAgent, ...]:
    """Load and validate agents from a JSON file."""
    source = str(path)
    try:
        raw_text = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise ValueError(f"{source}: cannot read file ({exc})") from exc

    try:
        payload = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"{source}: invalid JSON ({exc})") from exc

    entries = _extract_agent_list(payload, source=source)
    agents = tuple(
        _parse_agent_entry(entry, source=source, index=index)
        for index, entry in enumerate(entries)
    )
    if not agents:
        raise ValueError(f"{source}: agent list is empty")
    return agents


def get_default_system_agents(file_path: str | Path | None = None) -> tuple[DefaultSystemAgent, ...]:
    """
    Resolve default system agents for runtime seeding.

    Priority:
    1. Explicit ``file_path`` argument
    2. ``settings.DEFAULT_SYSTEM_AGENTS_FILE`` when set
    3. Bundled ``app/data/default_system_agents.json``
    4. Built-in Python fallback
    """
    candidates: list[tuple[str, Path]] = []

    if file_path:
        candidates.append(("custom", Path(file_path)))

    if not file_path:
        from app.core.config import settings

        if settings.DEFAULT_SYSTEM_AGENTS_FILE.strip():
            candidates.append(("env", Path(settings.DEFAULT_SYSTEM_AGENTS_FILE.strip())))

    candidates.append(("bundled", BUNDLED_JSON_PATH))

    for label, path in candidates:
        if not path.is_file():
            if label in {"custom", "env"}:
                logger.warning("Default system agents file not found (%s): %s", label, path)
            continue
        try:
            agents = load_default_system_agents_from_path(path)
            logger.info(
                "Loaded %s default system agent(s) from %s (%s).",
                len(agents),
                path,
                label,
            )
            return agents
        except ValueError as exc:
            logger.error("Failed to load default system agents from %s (%s): %s", path, label, exc)

    logger.warning(
        "Using built-in default system agents fallback (%s agents).",
        len(_BUILTIN_DEFAULT_SYSTEM_AGENTS),
    )
    return _BUILTIN_DEFAULT_SYSTEM_AGENTS
