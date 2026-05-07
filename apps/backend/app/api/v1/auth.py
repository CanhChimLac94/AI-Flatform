from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.user import User
from app.repositories.user import UserRepository
from app.services.provider_registry import DEFAULT_PROVIDER, DEFAULT_MODEL

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    username: str | None = None

    @field_validator("username")
    @classmethod
    def _validate_username(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            return None
        if len(v) < 3 or len(v) > 50:
            raise ValueError("Username must be between 3 and 50 characters")
        import re
        if not re.match(r"^[a-zA-Z0-9_.-]+$", v):
            raise ValueError("Username may only contain letters, numbers, _, . and -")
        return v


class LoginRequest(BaseModel):
    identifier: str  # accepts email or username
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PersonaConfig(BaseModel):
    """Free-form persona config stored as JSONB.  All fields optional/extensible."""
    persona: str = ""
    language: str = ""
    tone: str = "helpful"


class UserOut(BaseModel):
    id: str
    email: str
    username: str | None = None
    full_name: str | None = None
    avatar_url: str | None = None
    persona_config: dict = {}
    default_provider: str = DEFAULT_PROVIDER
    default_model: str = DEFAULT_MODEL

    model_config = {"from_attributes": True}


class PatchMeRequest(BaseModel):
    full_name: str | None = None
    persona_config: dict | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_user_out(user: User) -> UserOut:
    """Construct UserOut with guaranteed non-null defaults."""
    return UserOut(
        id=str(user.id),
        email=user.email,
        username=user.username,
        full_name=user.full_name,
        avatar_url=user.avatar_url,
        persona_config=user.persona_config or {},
        default_provider=user.default_provider or DEFAULT_PROVIDER,
        default_model=user.default_model or DEFAULT_MODEL,
    )


async def _ensure_defaults(user: User, repo: UserRepository, db: AsyncSession) -> None:
    """Backfill default_provider/model for existing users that pre-date migration 0003."""
    dirty = False
    if not user.default_provider:
        user.default_provider = DEFAULT_PROVIDER
        dirty = True
    if not user.default_model:
        user.default_model = DEFAULT_MODEL
        dirty = True
    if dirty:
        await repo.save(user)
        await db.commit()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    repo = UserRepository(db)
    if await repo.email_exists(body.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    if body.username and await repo.username_exists(body.username):
        raise HTTPException(status_code=400, detail="Username already taken")

    user = await repo.create(
        email=body.email,
        username=body.username,
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
    )
    await db.commit()
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    repo = UserRepository(db)
    user = await repo.get_by_identifier(body.identifier)

    if user is None or user.hashed_password is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    await _ensure_defaults(user, repo, db)

    return TokenResponse(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserOut)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> UserOut:
    """Returns the authenticated user's profile including persona_config and default provider."""
    return _build_user_out(current_user)


@router.patch("/me", response_model=UserOut)
async def patch_me(
    body: PatchMeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    """Partially updates the authenticated user's profile (persona, full_name).
    Use PATCH /settings/defaults to update default_provider/model.
    """
    repo = UserRepository(db)

    if body.full_name is not None:
        current_user.full_name = body.full_name

    if body.persona_config is not None:
        current_user.persona_config = body.persona_config

    await repo.save(current_user)
    await db.commit()

    return _build_user_out(current_user)
