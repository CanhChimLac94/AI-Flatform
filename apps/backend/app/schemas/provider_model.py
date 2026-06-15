from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


class ProviderModelEntryOut(BaseModel):
    id: UUID
    provider: str
    model_id: str
    display_name: str | None
    is_enabled: bool
    is_builtin: bool
    sort_order: int

    model_config = {"from_attributes": True}


class ProviderModelGroupOut(BaseModel):
    provider: str
    provider_name: str
    models: list[ProviderModelEntryOut]


class CreateProviderModelRequest(BaseModel):
    model_id: str = Field(..., min_length=1, max_length=200)
    display_name: str | None = Field(default=None, max_length=200)

    @field_validator("model_id")
    @classmethod
    def strip_model_id(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("model_id must not be empty")
        return v

    @field_validator("display_name")
    @classmethod
    def strip_display_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class UpdateProviderModelRequest(BaseModel):
    model_id: str | None = Field(default=None, min_length=1, max_length=200)
    display_name: str | None = Field(default=None, max_length=200)
    is_enabled: bool | None = None

    @field_validator("model_id")
    @classmethod
    def strip_model_id(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            raise ValueError("model_id must not be empty")
        return v

    @field_validator("display_name")
    @classmethod
    def strip_display_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class BulkProviderModelRequest(BaseModel):
    action: Literal["enable", "disable", "delete"]
    entry_ids: list[UUID] | None = None
    apply_to: Literal["all"] | None = None

    @model_validator(mode="after")
    def validate_scope(self) -> "BulkProviderModelRequest":
        if self.apply_to == "all":
            return self
        if not self.entry_ids:
            raise ValueError("entry_ids required when apply_to is not 'all'")
        return self


class BulkProviderModelResponse(BaseModel):
    affected: int


class ProviderModelExportEntry(BaseModel):
    model_id: str = Field(..., min_length=1, max_length=200)
    display_name: str | None = None
    is_enabled: bool = True
    is_builtin: bool = False
    sort_order: int = 0

    @field_validator("model_id")
    @classmethod
    def strip_model_id(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("model_id must not be empty")
        return v


class ProviderModelExportOut(BaseModel):
    provider: str
    provider_name: str
    exported_at: str
    models: list[ProviderModelExportEntry]


class ImportProviderModelRequest(BaseModel):
    mode: Literal["replace", "merge"] = "replace"
    models: list[ProviderModelExportEntry]

    @field_validator("models")
    @classmethod
    def models_not_empty(cls, v: list[ProviderModelExportEntry]) -> list[ProviderModelExportEntry]:
        if not v:
            raise ValueError("models must not be empty")
        return v


class ImportProviderModelResponse(BaseModel):
    imported: int
