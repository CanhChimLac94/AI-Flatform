from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from app.services.flow_schedule_utils import VALID_FREQUENCIES


DEFAULT_FLOW_GRAPH: dict = {"nodes": [], "edges": [], "version": "1.0"}


class FlowGraph(BaseModel):
    nodes: list[dict] = Field(default_factory=list)
    edges: list[dict] = Field(default_factory=list)
    version: str = "1.0"

    @field_validator("nodes", "edges", mode="before")
    @classmethod
    def _coerce_list(cls, v: object) -> list:
        return v if isinstance(v, list) else []


class FlowCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: str | None = None
    graph: FlowGraph | None = None


class FlowUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    graph: FlowGraph | None = None


class FlowSummaryOut(BaseModel):
    id: UUID
    owner_user_id: UUID
    name: str
    description: str | None
    node_count: int
    edge_count: int
    created_at: datetime
    updated_at: datetime
    schedule_enabled: bool | None = None
    schedule_frequency: str | None = None
    next_run_at: datetime | None = None
    last_run_at: datetime | None = None
    last_run_status: str | None = None

    model_config = {"from_attributes": True}


FlowFrequency = Literal["once", "hourly", "daily", "weekly"]


class FlowScheduleUpsert(BaseModel):
    enabled: bool = True
    frequency: FlowFrequency = "daily"
    run_at: datetime | None = None
    interval_minutes: int | None = Field(default=60, ge=1, le=10080)
    time_of_day: str | None = Field(default="09:00", pattern=r"^\d{2}:\d{2}$")
    day_of_week: int | None = Field(default=0, ge=0, le=6)
    timezone: str = "Asia/Ho_Chi_Minh"

    @model_validator(mode="after")
    def _validate_frequency_fields(self) -> "FlowScheduleUpsert":
        if self.frequency not in VALID_FREQUENCIES:
            raise ValueError(f"frequency must be one of {sorted(VALID_FREQUENCIES)}")
        if self.frequency == "once" and self.run_at is None:
            raise ValueError("run_at is required for once schedules")
        if self.frequency in {"daily", "weekly"} and not self.time_of_day:
            raise ValueError("time_of_day is required for daily/weekly schedules")
        if self.frequency == "weekly" and self.day_of_week is None:
            raise ValueError("day_of_week is required for weekly schedules")
        return self


class FlowScheduleOut(BaseModel):
    id: UUID
    flow_id: UUID
    enabled: bool
    frequency: str
    run_at: datetime | None
    interval_minutes: int | None
    time_of_day: str | None
    day_of_week: int | None
    timezone: str
    next_run_at: datetime | None
    last_run_at: datetime | None
    last_status: str | None
    last_error: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FlowRunOut(BaseModel):
    id: UUID
    flow_id: UUID
    trigger: str
    status: str
    started_at: datetime
    finished_at: datetime | None
    result: dict
    error_message: str | None

    model_config = {"from_attributes": True}


class FlowOut(FlowSummaryOut):
    graph: FlowGraph
