"""add default_provider and default_model to users

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-22

Idempotent: uses ADD COLUMN IF NOT EXISTS and an UPDATE guard so re-running is safe.
Seeds sensible defaults for both new and existing rows.
"""

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add columns with DB-level defaults so existing rows get values immediately.
    op.execute("""
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS default_provider VARCHAR(50)  NOT NULL DEFAULT 'openai',
            ADD COLUMN IF NOT EXISTS default_model    VARCHAR(100) NOT NULL DEFAULT 'gpt-4o-mini'
    """)

    # Belt-and-suspenders: backfill any rows that somehow ended up with empty strings.
    op.execute("""
        UPDATE users
        SET default_provider = 'openai',
            default_model    = 'gpt-4o-mini'
        WHERE default_provider = ''
           OR default_model    = ''
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE users
            DROP COLUMN IF EXISTS default_model,
            DROP COLUMN IF EXISTS default_provider
    """)
