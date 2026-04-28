"""multiple api keys per provider

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-24

Allows each user to store more than one API key per provider.
Changes:
  - Adds `label` column (VARCHAR 100, default "Default")
  - Adds `is_active` column (BOOLEAN, default true)
  - Drops unique constraint uq_user_provider (user_id, provider)
  - Adds unique constraint uq_user_provider_label (user_id, provider, label)

Idempotent: safe to run on a DB bootstrapped from init.sql (columns may already
exist when init.sql was updated before this migration ran).  Uses IF NOT EXISTS /
DO $$ ... END $$ guards throughout so re-running never raises an error.
"""

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add columns only when absent (init.sql may already have them).
    op.execute("ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS label VARCHAR(100)")
    op.execute("ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS is_active BOOLEAN")

    # Backfill nulls left by IF NOT EXISTS no-op or genuinely new rows.
    op.execute(
        "UPDATE user_api_keys SET label = 'Default' WHERE label IS NULL"
    )
    op.execute(
        "UPDATE user_api_keys SET is_active = true WHERE is_active IS NULL"
    )

    # Tighten NOT NULL now that every row has a value.
    op.execute("ALTER TABLE user_api_keys ALTER COLUMN label SET NOT NULL")
    op.execute("ALTER TABLE user_api_keys ALTER COLUMN is_active SET NOT NULL")

    # Set column defaults for future inserts.
    op.execute("ALTER TABLE user_api_keys ALTER COLUMN label SET DEFAULT 'Default'")
    op.execute("ALTER TABLE user_api_keys ALTER COLUMN is_active SET DEFAULT true")

    # Swap constraints: drop old (user_id, provider) unique, add (user_id, provider, label).
    # Both operations are conditional so re-running is safe.
    op.execute("""
        DO $$ BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'user_api_keys'::regclass
                  AND conname  = 'uq_user_provider'
                  AND contype  = 'u'
            ) THEN
                ALTER TABLE user_api_keys DROP CONSTRAINT uq_user_provider;
            END IF;
        END $$
    """)

    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'user_api_keys'::regclass
                  AND conname  = 'uq_user_provider_label'
                  AND contype  = 'u'
            ) THEN
                ALTER TABLE user_api_keys
                    ADD CONSTRAINT uq_user_provider_label UNIQUE (user_id, provider, label);
            END IF;
        END $$
    """)


def downgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'user_api_keys'::regclass
                  AND conname  = 'uq_user_provider_label'
                  AND contype  = 'u'
            ) THEN
                ALTER TABLE user_api_keys DROP CONSTRAINT uq_user_provider_label;
            END IF;
        END $$
    """)

    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'user_api_keys'::regclass
                  AND conname  = 'uq_user_provider'
                  AND contype  = 'u'
            ) THEN
                ALTER TABLE user_api_keys
                    ADD CONSTRAINT uq_user_provider UNIQUE (user_id, provider);
            END IF;
        END $$
    """)

    op.execute("ALTER TABLE user_api_keys DROP COLUMN IF EXISTS is_active")
    op.execute("ALTER TABLE user_api_keys DROP COLUMN IF EXISTS label")
