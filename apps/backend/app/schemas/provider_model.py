from uuid import UUID

from pydantic import BaseModel, Field, field_validator


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
