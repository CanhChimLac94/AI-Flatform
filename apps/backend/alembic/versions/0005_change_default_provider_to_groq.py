"""change default provider/model to groq/llama-3.3-70b-versatile

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-24

Updates the DB column server_defaults and backfills users who still have
the old openai/gpt-4o-mini defaults (i.e. never explicitly changed them).
"""

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Update column-level server defaults for new rows
    op.execute("""
        ALTER TABLE users
            ALTER COLUMN default_provider SET DEFAULT 'groq',
            ALTER COLUMN default_model    SET DEFAULT 'llama-3.3-70b-versatile'
    """)

    # Backfill existing users that still have the original openai defaults
    op.execute("""
        UPDATE users
        SET default_provider = 'groq',
            default_model    = 'llama-3.3-70b-versatile'
        WHERE default_provider = 'openai'
          AND default_model    = 'gpt-4o-mini'
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE users
            ALTER COLUMN default_provider SET DEFAULT 'openai',
            ALTER COLUMN default_model    SET DEFAULT 'gpt-4o-mini'
    """)

    op.execute("""
        UPDATE users
        SET default_provider = 'openai',
            default_model    = 'gpt-4o-mini'
        WHERE default_provider = 'groq'
          AND default_model    = 'llama-3.3-70b-versatile'
    """)
