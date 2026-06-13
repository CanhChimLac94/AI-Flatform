from datetime import datetime, timedelta, timezone

import pytest

from app.services.flow_schedule_utils import compute_next_run_at


def test_daily_next_run_in_future():
    now = datetime(2026, 6, 13, 8, 0, tzinfo=timezone.utc)
    nxt = compute_next_run_at(
        frequency="daily",
        time_of_day="09:00",
        timezone_name="Asia/Ho_Chi_Minh",
        from_time=now,
    )
    assert nxt is not None
    assert nxt > now


def test_once_past_returns_none():
    past = datetime.now(timezone.utc) - timedelta(hours=1)
    assert compute_next_run_at(frequency="once", run_at=past) is None


def test_hourly_adds_interval():
    now = datetime(2026, 6, 13, 10, 0, tzinfo=timezone.utc)
    nxt = compute_next_run_at(frequency="hourly", interval_minutes=30, from_time=now)
    assert nxt == now + timedelta(minutes=30)
