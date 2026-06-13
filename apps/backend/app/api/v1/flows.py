"""
Agent Flow CRUD — per-user workflow persistence for Flow Designer.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.agent_flow import AgentFlow
from app.models.agent_flow_schedule import AgentFlowRun, AgentFlowSchedule
from app.models.user import User
from app.repositories.flow import FlowRepository
from app.repositories.flow_schedule import FlowRunRepository, FlowScheduleRepository
from app.schemas.flow import (
    DEFAULT_FLOW_GRAPH,
    FlowCreate,
    FlowGraph,
    FlowOut,
    FlowRunOut,
    FlowScheduleOut,
    FlowScheduleUpsert,
    FlowSummaryOut,
    FlowUpdate,
)
from app.services.flow_runner import execute_flow
from app.services.flow_schedule_utils import compute_next_run_at

router = APIRouter(prefix="/flows", tags=["flows"])


def _graph_counts(graph: dict) -> tuple[int, int]:
    nodes = graph.get("nodes")
    edges = graph.get("edges")
    return (
        len(nodes) if isinstance(nodes, list) else 0,
        len(edges) if isinstance(edges, list) else 0,
    )


def _apply_schedule_to_summary(summary: FlowSummaryOut, schedule: AgentFlowSchedule | None) -> FlowSummaryOut:
    if schedule is None:
        return summary
    return summary.model_copy(
        update={
            "schedule_enabled": schedule.enabled,
            "schedule_frequency": schedule.frequency,
            "next_run_at": schedule.next_run_at,
            "last_run_at": schedule.last_run_at,
            "last_run_status": schedule.last_status,
        }
    )


def _flow_summary(flow: AgentFlow, latest_run: AgentFlowRun | None = None) -> FlowSummaryOut:
    node_count, edge_count = _graph_counts(flow.graph or {})
    summary = FlowSummaryOut(
        id=flow.id,
        owner_user_id=flow.owner_user_id,
        name=flow.name,
        description=flow.description,
        node_count=node_count,
        edge_count=edge_count,
        created_at=flow.created_at,
        updated_at=flow.updated_at,
    )
    summary = _apply_schedule_to_summary(summary, getattr(flow, "schedule", None))
    if latest_run is not None:
        summary = summary.model_copy(
            update={
                "last_run_at": latest_run.finished_at or latest_run.started_at,
                "last_run_status": latest_run.status,
            }
        )
    return summary


def _flow_out(flow: AgentFlow, latest_run: AgentFlowRun | None = None) -> FlowOut:
    summary = _flow_summary(flow, latest_run)
    graph_data = flow.graph if isinstance(flow.graph, dict) else DEFAULT_FLOW_GRAPH
    return FlowOut(
        **summary.model_dump(),
        graph=FlowGraph.model_validate(graph_data),
    )


def _schedule_out(schedule: AgentFlowSchedule) -> FlowScheduleOut:
    return FlowScheduleOut.model_validate(schedule)


async def _upsert_schedule_record(
    *,
    db: AsyncSession,
    flow: AgentFlow,
    owner: User,
    body: FlowScheduleUpsert,
) -> AgentFlowSchedule:
    sched_repo = FlowScheduleRepository(db)
    schedule = await sched_repo.get_for_flow(flow.id, owner.id)

    try:
        next_run = (
            compute_next_run_at(
                frequency=body.frequency,
                run_at=body.run_at,
                interval_minutes=body.interval_minutes,
                time_of_day=body.time_of_day,
                day_of_week=body.day_of_week,
                timezone_name=body.timezone,
            )
            if body.enabled
            else None
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if body.enabled and next_run is None and body.frequency == "once":
        raise HTTPException(status_code=400, detail="run_at must be in the future for once schedules")

    payload = {
        "enabled": body.enabled,
        "frequency": body.frequency,
        "run_at": body.run_at,
        "interval_minutes": body.interval_minutes,
        "time_of_day": body.time_of_day,
        "day_of_week": body.day_of_week,
        "timezone": body.timezone,
        "next_run_at": next_run if body.enabled else None,
    }

    if schedule is None:
        schedule = await sched_repo.create(
            flow_id=flow.id,
            owner_user_id=owner.id,
            **payload,
        )
    else:
        for key, value in payload.items():
            setattr(schedule, key, value)
        await sched_repo.save(schedule)

    return schedule


@router.get("", response_model=list[FlowSummaryOut])
async def list_flows(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = FlowRepository(db)
    run_repo = FlowRunRepository(db)
    flows = await repo.list_for_user(current_user.id)
    latest_runs = await run_repo.latest_for_owner_flows(
        current_user.id, [f.id for f in flows]
    )
    return [_flow_summary(f, latest_runs.get(f.id)) for f in flows]


@router.post("", response_model=FlowOut, status_code=status.HTTP_201_CREATED)
async def create_flow(
    body: FlowCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = FlowRepository(db)
    graph = (body.graph or FlowGraph()).model_dump()
    flow = await repo.create(
        owner_user_id=current_user.id,
        name=body.name,
        description=body.description,
        graph=graph,
    )
    await db.commit()
    await db.refresh(flow)
    return _flow_out(flow)


@router.get("/{flow_id}", response_model=FlowOut)
async def get_flow(
    flow_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = FlowRepository(db)
    flow = await repo.get_owned(flow_id, current_user.id)
    if flow is None:
        raise HTTPException(status_code=404, detail="Flow not found or access denied")
    return _flow_out(flow)


@router.patch("/{flow_id}", response_model=FlowOut)
async def update_flow(
    flow_id: UUID,
    body: FlowUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = FlowRepository(db)
    flow = await repo.get_owned(flow_id, current_user.id)
    if flow is None:
        raise HTTPException(status_code=404, detail="Flow not found or access denied")

    if body.name is not None:
        flow.name = body.name
    if body.description is not None:
        flow.description = body.description
    if body.graph is not None:
        flow.graph = body.graph.model_dump()

    await repo.save(flow)
    await db.commit()
    await db.refresh(flow)
    return _flow_out(flow)


@router.delete("/{flow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_flow(
    flow_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = FlowRepository(db)
    flow = await repo.get_owned(flow_id, current_user.id)
    if flow is None:
        raise HTTPException(status_code=404, detail="Flow not found or access denied")
    await repo.delete(flow)
    await db.commit()


@router.post("/{flow_id}/duplicate", response_model=FlowOut, status_code=status.HTTP_201_CREATED)
async def duplicate_flow(
    flow_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = FlowRepository(db)
    source = await repo.get_owned(flow_id, current_user.id)
    if source is None:
        raise HTTPException(status_code=404, detail="Flow not found or access denied")

    copy = await repo.create(
        owner_user_id=current_user.id,
        name=f"{source.name} (copy)",
        description=source.description,
        graph=source.graph if isinstance(source.graph, dict) else DEFAULT_FLOW_GRAPH,
    )
    await db.commit()
    await db.refresh(copy)
    return _flow_out(copy)


@router.get("/{flow_id}/schedule", response_model=FlowScheduleOut)
async def get_flow_schedule(
    flow_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    flow_repo = FlowRepository(db)
    sched_repo = FlowScheduleRepository(db)
    flow = await flow_repo.get_owned(flow_id, current_user.id)
    if flow is None:
        raise HTTPException(status_code=404, detail="Flow not found or access denied")

    schedule = await sched_repo.get_for_flow(flow_id, current_user.id)
    if schedule is None:
        raise HTTPException(status_code=404, detail="Schedule not configured for this flow")
    return _schedule_out(schedule)


@router.put("/{flow_id}/schedule", response_model=FlowScheduleOut)
async def upsert_flow_schedule(
    flow_id: UUID,
    body: FlowScheduleUpsert,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    flow_repo = FlowRepository(db)
    flow = await flow_repo.get_owned(flow_id, current_user.id)
    if flow is None:
        raise HTTPException(status_code=404, detail="Flow not found or access denied")

    schedule = await _upsert_schedule_record(db=db, flow=flow, owner=current_user, body=body)
    await db.commit()
    await db.refresh(schedule)
    return _schedule_out(schedule)


@router.delete("/{flow_id}/schedule", status_code=status.HTTP_204_NO_CONTENT)
async def delete_flow_schedule(
    flow_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    flow_repo = FlowRepository(db)
    sched_repo = FlowScheduleRepository(db)
    flow = await flow_repo.get_owned(flow_id, current_user.id)
    if flow is None:
        raise HTTPException(status_code=404, detail="Flow not found or access denied")

    schedule = await sched_repo.get_for_flow(flow_id, current_user.id)
    if schedule is None:
        raise HTTPException(status_code=404, detail="Schedule not configured for this flow")
    await sched_repo.delete(schedule)
    await db.commit()


@router.post("/{flow_id}/run", response_model=FlowRunOut)
async def run_flow_now(
    flow_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    flow_repo = FlowRepository(db)
    flow = await flow_repo.get_owned(flow_id, current_user.id)
    if flow is None:
        raise HTTPException(status_code=404, detail="Flow not found or access denied")

    try:
        run = await execute_flow(db, flow, owner=current_user, trigger="manual")
        await db.commit()
        await db.refresh(run)
        return FlowRunOut.model_validate(run)
    except Exception as exc:
        await db.commit()
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/{flow_id}/runs", response_model=list[FlowRunOut])
async def list_flow_runs(
    flow_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    flow_repo = FlowRepository(db)
    run_repo = FlowRunRepository(db)
    flow = await flow_repo.get_owned(flow_id, current_user.id)
    if flow is None:
        raise HTTPException(status_code=404, detail="Flow not found or access denied")

    runs = await run_repo.list_for_flow(flow_id, current_user.id)
    return [FlowRunOut.model_validate(r) for r in runs]
