"""Agent and category icons

Revision ID: 0010
Revises: 0009
Create Date: 2026-06-13
"""

import sqlalchemy as sa
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None

CATEGORY_ICON_DEFAULTS = {
    "quan-tri": "briefcase",
    "it": "cpu-chip",
    "marketing": "megaphone",
    "media": "film",
    "mmo": "currency-dollar",
}


def upgrade() -> None:
    op.add_column("agents", sa.Column("icon", sa.String(50), nullable=True))
    op.add_column("agent_categories", sa.Column("icon", sa.String(50), nullable=True))

    for slug, icon in CATEGORY_ICON_DEFAULTS.items():
        op.execute(
            sa.text("UPDATE agent_categories SET icon = :icon WHERE slug = :slug").bindparams(
                icon=icon, slug=slug
            )
        )


def downgrade() -> None:
    op.drop_column("agent_categories", "icon")
    op.drop_column("agents", "icon")
