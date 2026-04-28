"""Add agent_knowledge_files table

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-25
"""

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS agent_knowledge_files (
            id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
            agent_id     UUID         NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
            file_id      VARCHAR(36)  NOT NULL,
            name         VARCHAR(255) NOT NULL,
            content_type VARCHAR(120) NOT NULL,
            size         INTEGER      NOT NULL,
            created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_agent_knowledge_agent ON agent_knowledge_files(agent_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS agent_knowledge_files")
