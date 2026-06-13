"""Add agent_flows table for Flow Designer persistence

Revision ID: 0012
Revises: 0011
Create Date: 2026-06-13
"""

from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS agent_flows (
            id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
            owner_user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name            VARCHAR(120) NOT NULL,
            description     TEXT,
            graph           JSONB       NOT NULL DEFAULT '{"nodes":[],"edges":[],"version":"1.0"}',
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_agent_flows_owner ON agent_flows(owner_user_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS agent_flows")
