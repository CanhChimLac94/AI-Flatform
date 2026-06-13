"""Seed default system agents from Flow Designer samples

Revision ID: 0011
Revises: 0010
Create Date: 2026-06-13
"""

import uuid

import sqlalchemy as sa
from alembic import op

from app.data.default_system_agents import DEFAULT_SYSTEM_AGENTS, DEFAULT_SYSTEM_AGENT_NAMES

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def _resolve_owner_id(conn) -> uuid.UUID | None:
    row = conn.execute(
        sa.text(
            "SELECT id FROM users WHERE is_admin = true ORDER BY created_at ASC LIMIT 1"
        )
    ).first()
    if row:
        return row[0]
    row = conn.execute(
        sa.text("SELECT id FROM users ORDER BY created_at ASC LIMIT 1")
    ).first()
    return row[0] if row else None


def upgrade() -> None:
    conn = op.get_bind()
    owner_id = _resolve_owner_id(conn)
    if owner_id is None:
        return

    for spec in DEFAULT_SYSTEM_AGENTS:
        exists = conn.execute(
            sa.text(
                "SELECT 1 FROM agents WHERE is_system = true AND name = :name LIMIT 1"
            ),
            {"name": spec.name},
        ).first()
        if exists:
            continue

        agent_id = uuid.uuid4()
        conn.execute(
            sa.text(
                """
                INSERT INTO agents (
                    id, owner_user_id, name, description, system_prompt,
                    model, params, tools, is_public, is_system, icon,
                    created_at, updated_at
                ) VALUES (
                    :id, :owner_id, :name, :description, :system_prompt,
                    NULL, '{}', '[]', true, true, :icon,
                    now(), now()
                )
                """
            ),
            {
                "id": agent_id,
                "owner_id": owner_id,
                "name": spec.name,
                "description": spec.description,
                "system_prompt": spec.system_prompt,
                "icon": spec.icon,
            },
        )

        cat_row = conn.execute(
            sa.text("SELECT id FROM agent_categories WHERE slug = :slug LIMIT 1"),
            {"slug": spec.category_slug},
        ).first()
        if cat_row:
            conn.execute(
                sa.text(
                    """
                    INSERT INTO agent_category_links (agent_id, category_id)
                    VALUES (:agent_id, :category_id)
                    ON CONFLICT DO NOTHING
                    """
                ),
                {"agent_id": agent_id, "category_id": cat_row[0]},
            )


def downgrade() -> None:
    conn = op.get_bind()
    for name in DEFAULT_SYSTEM_AGENT_NAMES:
        conn.execute(
            sa.text("DELETE FROM agents WHERE is_system = true AND name = :name"),
            {"name": name},
        )
