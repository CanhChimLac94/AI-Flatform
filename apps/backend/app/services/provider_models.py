"""
Per-user provider model catalog.

Seeds from provider_registry on first access; users can add custom models,
rename entries, enable/disable, and delete custom models.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_provider_model import UserProviderModel
from app.repositories.user_provider_model import UserProviderModelRepository
from app.services.provider_registry import REGISTRY, ALL_PROVIDERS, get_models


def _provider_name(provider_id: str) -> str:
    info = REGISTRY.get(provider_id)
    return info["name"] if info else provider_id


async def ensure_provider_seeded(
    db: AsyncSession, user_id: UUID, provider: str
) -> list[UserProviderModel]:
    repo = UserProviderModelRepository(db)
    existing = await repo.list_for_provider(user_id, provider)
    if existing:
        return existing

    registry_models = get_models(provider)
    if not registry_models:
        return []

    created: list[UserProviderModel] = []
    for idx, model_id in enumerate(registry_models):
        row = UserProviderModel(
            user_id=user_id,
            provider=provider,
            model_id=model_id,
            display_name=None,
            is_enabled=True,
            is_builtin=True,
            sort_order=idx,
        )
        db.add(row)
        created.append(row)

    await db.flush()
    return created


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


def entry_to_dict(row: UserProviderModel) -> dict:
    return {
        "id": row.id,
        "provider": row.provider,
        "model_id": row.model_id,
        "display_name": row.display_name,
        "is_enabled": row.is_enabled,
        "is_builtin": row.is_builtin,
        "sort_order": row.sort_order,
    }
