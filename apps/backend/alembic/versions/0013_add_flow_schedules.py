"""Add agent_flow_schedules and agent_flow_runs tables

Revision ID: 0013
Revises: 0012
Create Date: 2026-06-13
"""

from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS agent_flow_schedules (
            id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
            flow_id           UUID        NOT NULL UNIQUE REFERENCES agent_flows(id) ON DELETE CASCADE,
            owner_user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            enabled           BOOLEAN     NOT NULL DEFAULT TRUE,
            frequency         VARCHAR(20) NOT NULL DEFAULT 'daily',
            run_at            TIMESTAMPTZ,
            interval_minutes  INTEGER,
            time_of_day       VARCHAR(5),
            day_of_week       SMALLINT,
            timezone          VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
            next_run_at       TIMESTAMPTZ,
            last_run_at       TIMESTAMPTZ,
            last_status       VARCHAR(20),
            last_error        TEXT,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_flow_schedules_due ON agent_flow_schedules(next_run_at) "
        "WHERE enabled = TRUE AND next_run_at IS NOT NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_flow_schedules_owner ON agent_flow_schedules(owner_user_id)"
    )

    op.execute("""
        CREATE TABLE IF NOT EXISTS agent_flow_runs (
            id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
            flow_id         UUID        NOT NULL REFERENCES agent_flows(id) ON DELETE CASCADE,
            schedule_id     UUID        REFERENCES agent_flow_schedules(id) ON DELETE SET NULL,
            owner_user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            trigger         VARCHAR(20) NOT NULL DEFAULT 'schedule',
            status          VARCHAR(20) NOT NULL DEFAULT 'running',
            started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            finished_at     TIMESTAMPTZ,
            result          JSONB       NOT NULL DEFAULT '{}',
            error_message   TEXT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_flow_runs_flow ON agent_flow_runs(flow_id, started_at DESC)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS agent_flow_runs")
    op.execute("DROP TABLE IF EXISTS agent_flow_schedules")
