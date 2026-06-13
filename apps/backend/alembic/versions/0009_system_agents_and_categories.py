"""System agents, categories, and admin flag

Revision ID: 0009
Revises: 0008
Create Date: 2026-06-13
"""

import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None

DEFAULT_CATEGORIES = [
    ("quan-tri", "Quản trị", "Kế hoạch, vận hành và quản lý doanh nghiệp", "indigo", 1),
    ("it", "IT", "Lập trình, hạ tầng và DevOps", "cyan", 2),
    ("marketing", "Marketing", "Chiến lược, nội dung và quảng cáo", "pink", 3),
    ("media", "Media", "Sản xuất nội dung đa phương tiện", "purple", 4),
    ("mmo", "MMO", "Kiếm tiền online và thương mại số", "amber", 5),
]


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default="false"),
    )

    op.add_column(
        "agents",
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.create_index("ix_agents_is_system", "agents", ["is_system"])

    op.create_table(
        "agent_categories",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(50), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("color", sa.String(30), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("slug", name="uq_agent_categories_slug"),
    )
    op.create_index("ix_agent_categories_slug", "agent_categories", ["slug"])

    op.create_table(
        "agent_category_links",
        sa.Column("agent_id", UUID(as_uuid=True), sa.ForeignKey("agents.id", ondelete="CASCADE"), primary_key=True),
        sa.Column(
            "category_id",
            UUID(as_uuid=True),
            sa.ForeignKey("agent_categories.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )

    categories = sa.table(
        "agent_categories",
        sa.column("id", UUID(as_uuid=True)),
        sa.column("slug", sa.String),
        sa.column("name", sa.String),
        sa.column("description", sa.Text),
        sa.column("color", sa.String),
        sa.column("sort_order", sa.Integer),
    )
    op.bulk_insert(
        categories,
        [
            {
                "id": uuid.uuid4(),
                "slug": slug,
                "name": name,
                "description": desc,
                "color": color,
                "sort_order": order,
            }
            for slug, name, desc, color, order in DEFAULT_CATEGORIES
        ],
    )


def downgrade() -> None:
    op.drop_table("agent_category_links")
    op.drop_index("ix_agent_categories_slug", table_name="agent_categories")
    op.drop_table("agent_categories")
    op.drop_index("ix_agents_is_system", table_name="agents")
    op.drop_column("agents", "is_system")
    op.drop_column("users", "is_admin")
