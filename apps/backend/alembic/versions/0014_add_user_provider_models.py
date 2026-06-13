"""Add user_provider_models table

Revision ID: 0014
Revises: 0013
Create Date: 2026-06-13
"""

from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS user_provider_models (
            id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            provider      VARCHAR(50) NOT NULL,
            model_id      VARCHAR(200) NOT NULL,
            display_name  VARCHAR(200),
            is_enabled    BOOLEAN     NOT NULL DEFAULT true,
            is_builtin    BOOLEAN     NOT NULL DEFAULT false,
            sort_order    INTEGER     NOT NULL DEFAULT 0,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_user_provider_model UNIQUE (user_id, provider, model_id)
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_user_provider_models_user_provider
        ON user_provider_models (user_id, provider)
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS user_provider_models")
