"""add telegram_id and telegram_username to users

Revision ID: 0001
Revises:
Create Date: 2026-04-22

Idempotent design: handles two scenarios without crashing:
  1. Existing DB that was created before these columns were added — columns get added fresh.
  2. Fresh DB initialised from init.sql (which already includes the columns) — ADD COLUMN IF NOT EXISTS
     is a no-op; the DO block skips constraint creation when a unique constraint already covers
     telegram_id (e.g. the inline UNIQUE from init.sql named "users_telegram_id_key").

The UNIQUE constraint's implicit B-tree index is the fast-lookup index used by
_get_user_by_telegram_id (WHERE telegram_id = ?); no separate index is needed.
"""

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ADD COLUMN IF NOT EXISTS: no-op when init.sql already created these columns.
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id BIGINT")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(100)")

    # Create unique constraint only when no unique constraint already covers telegram_id.
    # Avoids a duplicate when init.sql created its own inline UNIQUE ("users_telegram_id_key").
    # The constraint implicitly creates a unique B-tree index — sufficient for fast lookups.
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM   pg_constraint c
                JOIN   pg_attribute  a
                       ON  a.attnum    = ANY(c.conkey)
                       AND a.attrelid  = c.conrelid
                WHERE  c.conrelid = 'users'::regclass
                  AND  c.contype  = 'u'
                  AND  a.attname  = 'telegram_id'
            ) THEN
                ALTER TABLE users ADD CONSTRAINT uq_users_telegram_id UNIQUE (telegram_id);
            END IF;
        END $$
    """)


def downgrade() -> None:
    # DROP CONSTRAINT IF EXISTS is safe whether it was created by this migration or not.
    # Inline UNIQUE from init.sql (named "users_telegram_id_key") is left intact on downgrade
    # because it was not created by this migration.
    op.execute("""
        ALTER TABLE users
            DROP CONSTRAINT IF EXISTS uq_users_telegram_id,
            DROP COLUMN     IF EXISTS telegram_username,
            DROP COLUMN     IF EXISTS telegram_id
    """)
