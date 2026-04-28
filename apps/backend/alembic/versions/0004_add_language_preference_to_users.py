"""add language_preference to users

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-23

Idempotent: uses ADD COLUMN IF NOT EXISTS so re-running is safe.
Sets default language to Vietnamese (vi) for all users.
"""

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add language_preference column with default value 'vi' (Vietnamese)
    op.execute("""
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS language_preference VARCHAR(10) NOT NULL DEFAULT 'vi'
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE users
            DROP COLUMN IF EXISTS language_preference
    """)
