"""
User settings endpoints.

API key management (multi-key per provider):
  GET    /settings/api-keys                            → list providers + all stored keys
  POST   /settings/api-keys/{provider}                 → add new key with label
  PUT    /settings/api-keys/{provider}/{key_id}        → update key (label / value)
  DELETE /settings/api-keys/{provider}/{key_id}        → remove a specific key
  POST   /settings/api-keys/{provider}/{key_id}/activate → set as active key
  GET    /settings/api-keys/{provider}/{key_id}/reveal  → decrypt and return key
  POST   /settings/api-keys/{provider}/test            → test a key (live ping)

Default provider/model:
  GET    /settings/defaults               → { default_provider, default_model }
  PATCH  /settings/defaults               → update default provider/model

Provider catalogue (no auth needed):
  GET    /settings/providers              → list all providers with metadata
  GET    /settings/providers/{id}/models  → model list for a provider
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.user_api_key import SUPPORTED_PROVIDERS
from app.repositories.user import UserRepository
from app.repositories.user_api_key import UserApiKeyRepository
from app.services.encryption import encrypt_key, decrypt_key, mask_key
from app.services.provider_registry import (
    REGISTRY, ALL_PROVIDERS, DEFAULT_PROVIDER, DEFAULT_MODEL,
    get_models, test_provider_key,
)
from app.services.user_keys import invalidate_cache

router = APIRouter(prefix="/settings", tags=["settings"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class StoredKeyInfo(BaseModel):
    id: str
    label: str
    is_active: bool
    masked_key: str


class ProviderKeyGroup(BaseModel):
    provider: str
    name: str
    is_set: bool
    using_system_key: bool
    keys: list[StoredKeyInfo]


class AddKeyRequest(BaseModel):
    api_key: str
    label: str = "Default"
    set_active: bool = True

    @field_validator("api_key")
    @classmethod
    def not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("api_key must not be empty")
        if len(v) < 8:
            raise ValueError("api_key is too short to be valid")
        return v

    @field_validator("label")
    @classmethod
    def label_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("label must not be empty")
        return v


class UpdateKeyRequest(BaseModel):
    api_key: str | None = None
    label: str | None = None

    @field_validator("api_key")
    @classmethod
    def key_not_empty(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not v or len(v) < 8:
                raise ValueError("api_key is too short to be valid")
        return v

    @field_validator("label")
    @classmethod
    def label_not_empty(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("label must not be empty")
        return v


class TestKeyRequest(BaseModel):
    api_key: str

    @field_validator("api_key")
    @classmethod
    def not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("api_key must not be empty")
        return v


class RevealKeyResponse(BaseModel):
    plain_key: str


class TestKeyResponse(BaseModel):
    ok: bool
    message: str


class UserDefaultsOut(BaseModel):
    default_provider: str
    default_model: str


class PatchDefaultsRequest(BaseModel):
    default_provider: str | None = None
    default_model: str | None = None

    @field_validator("default_provider")
    @classmethod
    def valid_provider(cls, v: str | None) -> str | None:
        if v is not None and v not in ALL_PROVIDERS:
            raise ValueError(f"Invalid provider '{v}'. Valid: {sorted(ALL_PROVIDERS)}")
        return v


class ProviderCatalogItem(BaseModel):
    id: str
    name: str
    models: list[str]
    default_model: str
    key_prefix_hint: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _system_keys() -> dict[str, str]:
    from app.core.config import settings as s
    return {
        "openai":     s.OPENAI_API_KEY,
        "anthropic":  s.ANTHROPIC_API_KEY,
        "groq":       s.GROQ_API_KEY,
        "google":     getattr(s, "GOOGLE_API_KEY", ""),
        "openrouter": getattr(s, "OPENROUTER_API_KEY", ""),
        "nvidia":     getattr(s, "NVIDIA_API_KEY", ""),
    }


def _sys_key_is_set(key: str) -> bool:
    return bool(key) and not key.startswith("sk-...") and len(key) > 8


def _validate_provider(provider: str) -> None:
    if provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")


# ── API key management ────────────────────────────────────────────────────────

@router.get("/api-keys", response_model=list[ProviderKeyGroup])
async def list_api_keys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns all supported providers with their stored keys and connection status."""
    sys_keys = _system_keys()
    repo = UserApiKeyRepository(db)
    all_records = await repo.list_for_user(current_user.id)

    by_provider: dict[str, list] = {p: [] for p in SUPPORTED_PROVIDERS}
    for r in all_records:
        if r.provider in by_provider:
            by_provider[r.provider].append(r)

    result = []
    for provider_id in SUPPORTED_PROVIDERS:
        info = REGISTRY.get(provider_id)
        name = info["name"] if info else provider_id
        records = by_provider[provider_id]

        stored_keys: list[StoredKeyInfo] = []
        for r in records:
            try:
                plain = decrypt_key(r.encrypted_key)
                masked = mask_key(plain)
            except ValueError:
                masked = "••••••••"
            stored_keys.append(StoredKeyInfo(
                id=str(r.id),
                label=r.label,
                is_active=r.is_active,
                masked_key=masked,
            ))

        if stored_keys:
            result.append(ProviderKeyGroup(
                provider=provider_id,
                name=name,
                is_set=True,
                using_system_key=False,
                keys=stored_keys,
            ))
        else:
            sys_key = sys_keys.get(provider_id, "")
            has_sys = _sys_key_is_set(sys_key)
            result.append(ProviderKeyGroup(
                provider=provider_id,
                name=name,
                is_set=has_sys,
                using_system_key=has_sys,
                keys=[],
            ))
    return result


@router.post("/api-keys/{provider}", status_code=status.HTTP_201_CREATED, response_model=StoredKeyInfo)
async def add_api_key(
    provider: str,
    body: AddKeyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a new API key for a provider. If set_active=true the new key becomes active."""
    _validate_provider(provider)

    repo = UserApiKeyRepository(db)
    record = await repo.create(
        user_id=current_user.id,
        provider=provider,
        encrypted_key=encrypt_key(body.api_key),
        label=body.label,
        set_active=body.set_active,
    )
    await db.commit()
    await invalidate_cache(current_user.id, provider)

    try:
        plain = decrypt_key(record.encrypted_key)
        masked = mask_key(plain)
    except ValueError:
        masked = "••••••••"

    return StoredKeyInfo(id=str(record.id), label=record.label, is_active=record.is_active, masked_key=masked)


@router.put("/api-keys/{provider}/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def update_api_key(
    provider: str,
    key_id: UUID,
    body: UpdateKeyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a stored key's value and/or label."""
    _validate_provider(provider)

    repo = UserApiKeyRepository(db)
    record = await repo.update_key(
        user_id=current_user.id,
        key_id=key_id,
        encrypted_key=encrypt_key(body.api_key) if body.api_key else None,
        label=body.label,
    )
    if not record:
        raise HTTPException(status_code=404, detail="Key not found")

    await db.commit()
    await invalidate_cache(current_user.id, provider)


@router.delete("/api-keys/{provider}/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_key(
    provider: str,
    key_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _validate_provider(provider)

    repo = UserApiKeyRepository(db)
    deleted = await repo.delete_by_id(current_user.id, key_id)
    await db.commit()
    await invalidate_cache(current_user.id, provider)

    if not deleted:
        raise HTTPException(status_code=404, detail="Key not found")


@router.post("/api-keys/{provider}/{key_id}/activate", status_code=status.HTTP_204_NO_CONTENT)
async def activate_api_key(
    provider: str,
    key_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set the specified key as the active key for this provider."""
    _validate_provider(provider)

    repo = UserApiKeyRepository(db)
    ok = await repo.activate(current_user.id, provider, key_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Key not found")

    await db.commit()
    await invalidate_cache(current_user.id, provider)


@router.get("/api-keys/{provider}/{key_id}/reveal", response_model=RevealKeyResponse)
async def reveal_api_key(
    provider: str,
    key_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns the decrypted key so the user can copy it."""
    _validate_provider(provider)

    repo = UserApiKeyRepository(db)
    record = await repo.get_by_id(current_user.id, key_id)
    if not record:
        raise HTTPException(status_code=404, detail="Key not found")

    try:
        plain = decrypt_key(record.encrypted_key)
    except ValueError:
        raise HTTPException(status_code=500, detail="Failed to decrypt key")

    return RevealKeyResponse(plain_key=plain)


@router.post("/api-keys/{provider}/test", response_model=TestKeyResponse)
async def test_api_key(
    provider: str,
    body: TestKeyRequest,
    current_user: User = Depends(get_current_user),
):
    """Tests a provider key by making a lightweight live ping."""
    _validate_provider(provider)

    ok, message = await test_provider_key(provider, body.api_key.strip())
    return TestKeyResponse(ok=ok, message=message)


# ── Default provider/model ────────────────────────────────────────────────────

@router.get("/defaults", response_model=UserDefaultsOut)
async def get_defaults(
    current_user: User = Depends(get_current_user),
) -> UserDefaultsOut:
    return UserDefaultsOut(
        default_provider=current_user.default_provider or DEFAULT_PROVIDER,
        default_model=current_user.default_model or DEFAULT_MODEL,
    )


@router.patch("/defaults", response_model=UserDefaultsOut)
async def patch_defaults(
    body: PatchDefaultsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserDefaultsOut:
    repo = UserRepository(db)
    dirty = False

    if body.default_provider is not None:
        current_user.default_provider = body.default_provider
        dirty = True

    if body.default_model is not None:
        current_user.default_model = body.default_model
        dirty = True

    if dirty:
        await repo.save(current_user)
        await db.commit()

    return UserDefaultsOut(
        default_provider=current_user.default_provider or DEFAULT_PROVIDER,
        default_model=current_user.default_model or DEFAULT_MODEL,
    )


# ── Provider catalogue (public) ───────────────────────────────────────────────

@router.get("/providers", response_model=list[ProviderCatalogItem])
async def list_providers():
    """Returns all supported providers with model lists.  No auth required."""
    return [
        ProviderCatalogItem(
            id=pid,
            name=info["name"],
            models=info["models"],
            default_model=info["default_model"],
            key_prefix_hint=info["key_prefix_hint"],
        )
        for pid, info in REGISTRY.items()
    ]


@router.get("/providers/{provider_id}/models", response_model=list[str])
async def get_provider_models(provider_id: str):
    """Returns the static model list for a provider.  No auth required."""
    if provider_id not in REGISTRY:
        raise HTTPException(status_code=404, detail=f"Unknown provider: {provider_id}")
    return get_models(provider_id)
