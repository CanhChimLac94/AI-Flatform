"""
Per-user provider model catalog.

Seeds from provider_registry on first access; users can add custom models,
rename entries, enable/disable, and delete custom models.
"""

import uuid
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_provider_model import UserProviderModel
from app.repositories.user_provider_model import UserProviderModelRepository
from app.services.provider_registry import REGISTRY, ALL_PROVIDERS, get_models
from app.services.user_keys import is_usable_api_key


def _key_is_usable(key: str) -> bool:
    return is_usable_api_key(key)


def _provider_name(provider_id: str) -> str:
    info = REGISTRY.get(provider_id)
    return info["name"] if info else provider_id


async def ensure_provider_seeded(
    db: AsyncSession, user_id: UUID, provider: str
) -> list[UserProviderModel]:
    repo = UserProviderModelRepository(db)
    existing = await repo.list_for_provider(user_id, provider)
    existing_ids = {row.model_id for row in existing}

    registry_models = get_models(provider)
    if not registry_models:
        return existing

    missing = [m for m in registry_models if m not in existing_ids]
    if not missing:
        return existing

    base_order = len(existing)
    for offset, model_id in enumerate(missing):
        db.add(
            UserProviderModel(
                user_id=user_id,
                provider=provider,
                model_id=model_id,
                display_name=None,
                is_enabled=True,
                is_builtin=True,
                sort_order=base_order + offset,
            )
        )

    await db.commit()
    return await repo.list_for_provider(user_id, provider)


async def ensure_all_providers_seeded(db: AsyncSession, user_id: UUID) -> None:
    for provider in ALL_PROVIDERS:
        await ensure_provider_seeded(db, user_id, provider)


async def list_provider_groups(
    db: AsyncSession, user_id: UUID
) -> list[dict]:
    await ensure_all_providers_seeded(db, user_id)
    repo = UserProviderModelRepository(db)
    rows = await repo.list_all_for_user(user_id)

    grouped: dict[str, list[UserProviderModel]] = {p: [] for p in ALL_PROVIDERS}
    for row in rows:
        if row.provider in grouped:
            grouped[row.provider].append(row)

    return [
        {
            "provider": provider,
            "provider_name": _provider_name(provider),
            "models": grouped[provider],
        }
        for provider in ALL_PROVIDERS
    ]


async def list_provider_entries(
    db: AsyncSession, user_id: UUID, provider: str
) -> list[UserProviderModel]:
    return await ensure_provider_seeded(db, user_id, provider)


async def enabled_model_ids(
    db: AsyncSession, user_id: UUID, provider: str
) -> list[str]:
    rows = await ensure_provider_seeded(db, user_id, provider)
    return [r.model_id for r in rows if r.is_enabled]


_CATALOG_NS = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")


def _registry_catalog_groups() -> list[dict]:
    """Static enabled catalog for guests (no display names)."""
    groups: list[dict] = []
    for provider in ALL_PROVIDERS:
        info = REGISTRY.get(provider)
        if not info:
            continue
        models = [
            {
                "id": uuid.uuid5(_CATALOG_NS, f"{provider}:{model_id}"),
                "provider": provider,
                "model_id": model_id,
                "display_name": None,
                "is_enabled": True,
                "is_builtin": True,
                "sort_order": idx,
            }
            for idx, model_id in enumerate(info["models"])
        ]
        if models:
            groups.append(
                {
                    "provider": provider,
                    "provider_name": info["name"],
                    "models": models,
                }
            )
    return groups


async def list_enabled_catalog_groups(
    db: AsyncSession, user_id: UUID | None, *, require_keys: bool = False
) -> list[dict]:
    """Enabled models grouped by provider for model pickers (chat, agents)."""
    if user_id is None:
        if require_keys:
            return []
        return _registry_catalog_groups()

    groups = await list_provider_groups(db, user_id)
    result: list[dict] = []
    for group in groups:
        enabled = [m for m in group["models"] if m.is_enabled]
        if enabled:
            result.append(
                {
                    "provider": group["provider"],
                    "provider_name": group["provider_name"],
                    "models": enabled,
                }
            )

    if require_keys:
        from app.services.user_keys import get_all_effective_keys

        keys = await get_all_effective_keys(user_id, db)
        configured = {p for p, k in keys.items() if _key_is_usable(k)}
        result = [g for g in result if g["provider"] in configured]

    return result
