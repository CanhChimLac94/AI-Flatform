"""Background scheduler — polls due flow schedules and executes them."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import DBAPIError, OperationalError
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.health import ping_postgres, ping_redis
from app.db.redis import get_redis
from app.db.session import AsyncSessionLocal, engine
from app.models.agent_flow import AgentFlow
from app.models.agent_flow_schedule import AgentFlowSchedule
from app.models.user import User
from app.services.flow_runner import execute_flow
from app.services.flow_schedule_utils import compute_next_run_at

logger = logging.getLogger(__name__)

_LOCK_PREFIX = "flow_schedule_lock:"
_LOCK_TTL_SECONDS = 600


async def _try_acquire_lock(schedule_id: str) -> bool:
    try:
        redis = get_redis()
        acquired = await redis.set(
            f"{_LOCK_PREFIX}{schedule_id}",
            "1",
            nx=True,
            ex=_LOCK_TTL_SECONDS,
        )
        return bool(acquired)
    except Exception as exc:
        logger.warning("Flow schedule lock unavailable for %s: %s", schedule_id, exc)
        return False


async def _release_lock(schedule_id: str) -> None:
    try:
        redis = get_redis()
        await redis.delete(f"{_LOCK_PREFIX}{schedule_id}")
    except Exception as exc:
        logger.warning("Flow schedule lock release failed for %s: %s", schedule_id, exc)


async def _process_schedule(schedule: AgentFlowSchedule, flow: AgentFlow, owner: User) -> None:
    schedule_id = str(schedule.id)
    if not await _try_acquire_lock(schedule_id):
        return

    try:
        async with AsyncSessionLocal() as session:
            db_schedule = await session.get(AgentFlowSchedule, schedule.id)
            db_flow = await session.get(AgentFlow, flow.id)
            db_owner = await session.get(User, owner.id)
            if not db_schedule or not db_flow or not db_owner:
                return

            now = datetime.now(timezone.utc)
            db_schedule.last_run_at = now
            db_schedule.last_status = "running"
            db_schedule.last_error = None
            await session.flush()

            try:
                await execute_flow(
                    session,
                    db_flow,
                    owner=db_owner,
                    trigger="schedule",
                    schedule_id=db_schedule.id,
                )
                db_schedule.last_status = "success"
            except Exception as exc:
                db_schedule.last_status = "failed"
                db_schedule.last_error = str(exc)[:2000]

            if db_schedule.enabled:
                if db_schedule.frequency == "once":
                    db_schedule.enabled = False
                    db_schedule.next_run_at = None
                else:
                    db_schedule.next_run_at = compute_next_run_at(
                        frequency=db_schedule.frequency,
                        run_at=db_schedule.run_at,
                        interval_minutes=db_schedule.interval_minutes,
                        time_of_day=db_schedule.time_of_day,
                        day_of_week=db_schedule.day_of_week,
                        timezone_name=db_schedule.timezone,
                        from_time=now,
                    )
            else:
                db_schedule.next_run_at = None

            await session.commit()
            logger.info(
                "Executed scheduled flow %s (schedule %s) status=%s",
                db_flow.id,
                db_schedule.id,
                db_schedule.last_status,
            )
    finally:
        await _release_lock(schedule_id)


async def _poll_due_schedules() -> None:
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(AgentFlowSchedule)
            .where(
                AgentFlowSchedule.enabled.is_(True),
                AgentFlowSchedule.next_run_at.is_not(None),
                AgentFlowSchedule.next_run_at <= now,
            )
            .options(selectinload(AgentFlowSchedule.flow))
            .limit(20)
        )
        schedules = list(result.scalars().all())

    for schedule in schedules:
        flow = schedule.flow
        if flow is None:
            continue
        async with AsyncSessionLocal() as session:
            owner = await session.get(User, schedule.owner_user_id)
        if owner is None:
            continue
        await _process_schedule(schedule, flow, owner)


async def flow_scheduler_loop() -> None:
    """Run forever until cancelled."""
    poll_seconds = max(15, settings.FLOW_SCHEDULER_POLL_SECONDS)
    logger.info("Flow scheduler started (poll every %ss)", poll_seconds)
    postgres_paused = False
    redis_paused = False
    while True:
        try:
            if not await ping_postgres():
                if not postgres_paused:
                    logger.warning("Flow scheduler paused: Postgres unavailable")
                    postgres_paused = True
                await asyncio.sleep(poll_seconds)
                continue
            if postgres_paused:
                logger.info("Flow scheduler resumed: Postgres is available again")
                postgres_paused = False

            if not await ping_redis():
                if not redis_paused:
                    logger.warning("Flow scheduler paused: Redis unavailable")
                    redis_paused = True
                await asyncio.sleep(poll_seconds)
                continue
            if redis_paused:
                logger.info("Flow scheduler resumed: Redis is available again")
                redis_paused = False

            await _poll_due_schedules()
        except asyncio.CancelledError:
            raise
        except (OperationalError, DBAPIError, OSError) as exc:
            logger.warning("Flow scheduler poll skipped: database unavailable (%s)", exc)
            await engine.dispose()
            postgres_paused = True
        except Exception:
            logger.exception("Flow scheduler poll failed")
        await asyncio.sleep(poll_seconds)
