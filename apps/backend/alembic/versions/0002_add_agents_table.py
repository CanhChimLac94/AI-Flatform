"""Add agents table and agent_id to conversations

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-22
"""

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS agents (
            id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
            owner_user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name            VARCHAR(120) NOT NULL,
            description     TEXT,
            system_prompt   TEXT        NOT NULL DEFAULT '',
            model           VARCHAR(100),
            params          JSONB       NOT NULL DEFAULT '{}',
            tools           JSONB       NOT NULL DEFAULT '[]',
            is_public       BOOLEAN     NOT NULL DEFAULT FALSE,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents(owner_user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_agents_public ON agents(is_public) WHERE is_public = TRUE")

    # Add agent_id FK to conversations (nullable, SET NULL on agent delete)
    op.execute("""
        ALTER TABLE conversations
        ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE SET NULL
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE conversations DROP COLUMN IF EXISTS agent_id")
    op.execute("DROP TABLE IF EXISTS agents")
