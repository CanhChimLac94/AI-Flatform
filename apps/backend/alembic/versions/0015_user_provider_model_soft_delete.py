"""Add is_removed to user_provider_models for soft delete

Revision ID: 0015
Revises: 0014
Create Date: 2026-06-14
"""

import sqlalchemy as sa
from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_provider_models",
        sa.Column("is_removed", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("user_provider_models", "is_removed")
