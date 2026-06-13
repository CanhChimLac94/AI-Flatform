"""Compute next run times for flow schedules."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

VALID_FREQUENCIES = frozenset({"once", "hourly", "daily", "weekly"})


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _parse_time_of_day(value: str) -> tuple[int, int]:
    parts = value.strip().split(":")
    if len(parts) != 2:
        raise ValueError("time_of_day must be HH:MM")
    hour, minute = int(parts[0]), int(parts[1])
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        raise ValueError("time_of_day must be a valid HH:MM")
    return hour, minute


def compute_next_run_at(
    *,
    frequency: str,
    run_at: datetime | None = None,
    interval_minutes: int | None = None,
    time_of_day: str | None = None,
    day_of_week: int | None = None,
    timezone_name: str = "Asia/Ho_Chi_Minh",
    from_time: datetime | None = None,
) -> datetime | None:
    """Return the next UTC run time, or None when schedule should stop."""
    if frequency not in VALID_FREQUENCIES:
        raise ValueError(f"Unsupported frequency: {frequency}")

    now_utc = _ensure_utc(from_time or datetime.now(timezone.utc))

    if frequency == "once":
        if run_at is None:
            raise ValueError("run_at is required for once schedules")
        target = _ensure_utc(run_at)
        return target if target > now_utc else None

    if frequency == "hourly":
        minutes = interval_minutes or 60
        if minutes < 1:
            raise ValueError("interval_minutes must be at least 1")
        return now_utc + timedelta(minutes=minutes)

    try:
        tz = ZoneInfo(timezone_name)
    except Exception as exc:
        raise ValueError(f"Invalid timezone: {timezone_name}") from exc

    if not time_of_day:
        raise ValueError("time_of_day is required for daily/weekly schedules")
    hour, minute = _parse_time_of_day(time_of_day)
    local_now = now_utc.astimezone(tz)

    if frequency == "daily":
        candidate = local_now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if candidate <= local_now:
            candidate += timedelta(days=1)
        return candidate.astimezone(timezone.utc)

    if frequency == "weekly":
        if day_of_week is None or not (0 <= day_of_week <= 6):
            raise ValueError("day_of_week must be 0-6 (Mon-Sun) for weekly schedules")
        # Python weekday: Mon=0
        days_ahead = (day_of_week - local_now.weekday()) % 7
        candidate = local_now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        candidate += timedelta(days=days_ahead)
        if candidate <= local_now:
            candidate += timedelta(days=7)
        return candidate.astimezone(timezone.utc)

    return None
