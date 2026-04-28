from pydantic import BaseModel, EmailStr
from typing import Optional


class UserResponse(BaseModel):
    """User response model for GET /auth/me"""
    id: str
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    default_provider: str
    default_model: str
    language_preference: str = "vi"
    persona_config: Optional[dict] = None

    class Config:
        from_attributes = True


class UserUpdateRequest(BaseModel):
    """User update model for PATCH /auth/me"""
    full_name: Optional[str] = None
    persona_config: Optional[dict] = None
    language_preference: Optional[str] = None


class UserSettingsUpdate(BaseModel):
    """User settings update model for PATCH /settings/defaults"""
    default_provider: Optional[str] = None
    default_model: Optional[str] = None
    language_preference: Optional[str] = None
