"""
System-wide provider model catalog (PostgreSQL only).

All model rows live under the system catalog user. Admin UI reads/writes that
catalog; chat pickers and guests read enabled entries from the same source.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_provider_model import UserProviderModel
from app.repositories.user_provider_model import UserProviderModelRepository
from app.services.catalog_user import ensure_catalog_user, get_first_admin_id
from app.services.provider_registry import REGISTRY, ALL_PROVIDERS, get_models
from app.services.user_keys import is_usable_api_key


def _key_is_usable(key: str) -> bool:
    return is_usable_api_key(key)


def _provider_name(provider_id: str) -> str:
    info = REGISTRY.get(provider_id)
    return info["name"] if info else provider_id


async def _catalog_user_id(db: AsyncSession) -> UUID:
    return await ensure_catalog_user(db)


async def _ensure_system_catalog_initialized(db: AsyncSession) -> UUID:
    """Ensure system catalog exists; migrate legacy admin rows or bootstrap once."""
    catalog_uid = await _catalog_user_id(db)
    repo = UserProviderModelRepository(db)
    existing = await repo.list_all_for_user(catalog_uid)
    if existing:
        return catalog_uid

    admin_id = await get_first_admin_id(db)
    if admin_id and admin_id != catalog_uid:
        legacy = await repo.list_all_for_user(admin_id)
        if legacy:
            for row in legacy:
                db.add(
                    UserProviderModel(
                        user_id=catalog_uid,
                        provider=row.provider,
                        model_id=row.model_id,
                        display_name=row.display_name,
                        is_enabled=row.is_enabled,
                        is_builtin=row.is_builtin,
                        is_removed=False,
                        sort_order=row.sort_order,
                    )
                )
            await db.commit()
            return catalog_uid

    await _bootstrap_provider_from_registry(db, catalog_uid, ALL_PROVIDERS)
    return catalog_uid


async def _bootstrap_provider_from_registry(
    db: AsyncSession, catalog_uid: UUID, providers: tuple[str, ...] | list[str]
) -> None:
    repo = UserProviderModelRepository(db)
    for provider in providers:
        known = await repo.known_model_ids(catalog_uid, provider)
        if known:
            continue
        registry_models = get_models(provider)
        if not registry_models:
            continue
        for idx, model_id in enumerate(registry_models):
            db.add(
                UserProviderModel(
                    user_id=catalog_uid,
                    provider=provider,
                    model_id=model_id,
                    display_name=None,
                    is_enabled=True,
                    is_builtin=True,
                    is_removed=False,
                    sort_order=idx,
                )
            )
    await db.commit()


async def list_provider_groups(db: AsyncSession, _user_id: UUID | None = None) -> list[dict]:
    catalog_uid = await _ensure_system_catalog_initialized(db)
    repo = UserProviderModelRepository(db)
    rows = await repo.list_all_for_user(catalog_uid)

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
    db: AsyncSession, _user_id: UUID | None, provider: str
) -> list[UserProviderModel]:
    catalog_uid = await _ensure_system_catalog_initialized(db)
    repo = UserProviderModelRepository(db)
    return await repo.list_for_provider(catalog_uid, provider)


async def bulk_update_provider_models(
    db: AsyncSession,
    _user_id: UUID,
    provider: str,
    *,
    action: str,
    entry_ids: list[UUID] | None = None,
    apply_to_all: bool = False,
) -> int:
    catalog_uid = await _ensure_system_catalog_initialized(db)
    repo = UserProviderModelRepository(db)

    if apply_to_all:
        rows = await repo.list_for_provider(catalog_uid, provider)
    else:
        rows = []
        for entry_id in entry_ids or []:
            row = await repo.get_for_user(catalog_uid, entry_id)
            if row and row.provider == provider:
                rows.append(row)

    if action == "delete":
        affected = 0
        for row in rows:
            if await repo.soft_delete_for_user(catalog_uid, row.id):
                affected += 1
    elif action in ("enable", "disable"):
        enabled = action == "enable"
        for row in rows:
            row.is_enabled = enabled
        affected = len(rows)
    else:
        raise ValueError(f"Unsupported bulk action: {action}")

    await db.commit()
    return affected


async def enabled_model_ids(
    db: AsyncSession, _user_id: UUID | None, provider: str
) -> list[str]:
    rows = await list_provider_entries(db, None, provider)
    return [r.model_id for r in rows if r.is_enabled]


async def list_enabled_catalog_groups(
    db: AsyncSession,
    _user_id: UUID | None,
    *,
    require_keys: bool = False,
    keys_user_id: UUID | None = None,
) -> list[dict]:
    """Enabled models grouped by provider for model pickers (chat, agents)."""
    groups = await list_provider_groups(db)
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

    if require_keys and keys_user_id is not None:
        from app.services.user_keys import get_all_effective_keys

        keys = await get_all_effective_keys(keys_user_id, db)
        configured = {p for p, k in keys.items() if _key_is_usable(k)}
        result = [g for g in result if g["provider"] in configured]

    return result


def _entry_export_dict(row: UserProviderModel) -> dict:
    return {
        "model_id": row.model_id,
        "display_name": row.display_name,
        "is_enabled": row.is_enabled,
        "is_builtin": row.is_builtin,
        "sort_order": row.sort_order,
    }


async def export_provider_catalog(db: AsyncSession, provider: str) -> dict:
    rows = await list_provider_entries(db, None, provider)
    return {
        "provider": provider,
        "provider_name": _provider_name(provider),
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "models": [_entry_export_dict(r) for r in rows],
    }


async def resolve_catalog_user(db: AsyncSession) -> UUID:
    return await _ensure_system_catalog_initialized(db)


async def import_provider_catalog(
    db: AsyncSession,
    provider: str,
    models: list[dict],
    *,
    mode: str = "replace",
) -> int:
    catalog_uid = await _ensure_system_catalog_initialized(db)
    repo = UserProviderModelRepository(db)

    if mode == "replace":
        active = await repo.list_for_provider(catalog_uid, provider)
        for row in active:
            await repo.soft_delete_for_user(catalog_uid, row.id)

    affected = 0
    for idx, item in enumerate(models):
        model_id = str(item.get("model_id", "")).strip()
        if not model_id:
            continue
        display_name = item.get("display_name")
        if isinstance(display_name, str):
            display_name = display_name.strip() or None
        is_enabled = bool(item.get("is_enabled", True))
        is_builtin = bool(item.get("is_builtin", False))
        sort_order = int(item.get("sort_order", idx))

        existing = await repo.get_by_model_id(catalog_uid, provider, model_id)
        if existing:
            existing.is_removed = False
            existing.display_name = display_name
            existing.is_enabled = is_enabled
            existing.is_builtin = is_builtin
            existing.sort_order = sort_order
        else:
            db.add(
                UserProviderModel(
                    user_id=catalog_uid,
                    provider=provider,
                    model_id=model_id,
                    display_name=display_name,
                    is_enabled=is_enabled,
                    is_builtin=is_builtin,
                    is_removed=False,
                    sort_order=sort_order,
                )
            )
        affected += 1

    await db.commit()
    return affected
