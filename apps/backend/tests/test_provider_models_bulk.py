"""Tests for bulk provider model catalog operations."""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from pydantic import ValidationError

from app.schemas.provider_model import BulkProviderModelRequest
from app.services.provider_models import (
    bulk_update_provider_models,
    export_provider_catalog,
    import_provider_catalog,
)

USER_ID = uuid.UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
CATALOG_UID = uuid.UUID("00000000-0000-0000-0000-000000000001")
PROVIDER = "groq"
ENTRY_A = uuid.UUID("11111111-1111-1111-1111-111111111111")
ENTRY_B = uuid.UUID("22222222-2222-2222-2222-222222222222")


def _row(entry_id: uuid.UUID, *, enabled: bool = True) -> MagicMock:
    row = MagicMock()
    row.id = entry_id
    row.provider = PROVIDER
    row.is_enabled = enabled
    return row


@pytest.mark.asyncio
async def test_bulk_enable_all():
    db = AsyncMock()
    row_a = _row(ENTRY_A, enabled=False)
    row_b = _row(ENTRY_B, enabled=False)

    with pytest.MonkeyPatch.context() as mp:
        repo = AsyncMock()
        repo.list_for_provider.return_value = [row_a, row_b]
        mp.setattr(
            "app.services.provider_models.UserProviderModelRepository",
            lambda _db: repo,
        )

        affected = await bulk_update_provider_models(
            db, USER_ID, PROVIDER, action="enable", apply_to_all=True
        )

    assert affected == 2
    assert row_a.is_enabled is True
    assert row_b.is_enabled is True
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_bulk_disable_selected():
    db = AsyncMock()
    row_a = _row(ENTRY_A, enabled=True)
    row_b = _row(ENTRY_B, enabled=True)

    with pytest.MonkeyPatch.context() as mp:
        repo = AsyncMock()

        async def _get_for_user(_user_id, entry_id):
            if entry_id == ENTRY_A:
                return row_a
            if entry_id == ENTRY_B:
                return row_b
            return None

        repo.get_for_user.side_effect = _get_for_user
        mp.setattr(
            "app.services.provider_models.UserProviderModelRepository",
            lambda _db: repo,
        )

        affected = await bulk_update_provider_models(
            db,
            USER_ID,
            PROVIDER,
            action="disable",
            entry_ids=[ENTRY_A],
        )

    assert affected == 1
    assert row_a.is_enabled is False
    assert row_b.is_enabled is True
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_bulk_delete_selected():
    db = AsyncMock()
    row_a = _row(ENTRY_A)

    with pytest.MonkeyPatch.context() as mp:
        repo = AsyncMock()
        repo.get_for_user.return_value = row_a
        repo.soft_delete_for_user.return_value = True
        mp.setattr(
            "app.services.provider_models.UserProviderModelRepository",
            lambda _db: repo,
        )

        affected = await bulk_update_provider_models(
            db,
            USER_ID,
            PROVIDER,
            action="delete",
            entry_ids=[ENTRY_A],
        )

    assert affected == 1
    repo.soft_delete_for_user.assert_awaited_once_with(CATALOG_UID, ENTRY_A)
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_export_provider_catalog():
    db = AsyncMock()
    row = _row(ENTRY_A)
    row.model_id = "llama-3.3-70b-versatile"
    row.display_name = None
    row.is_builtin = True
    row.sort_order = 0

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(
            "app.services.provider_models._ensure_system_catalog_initialized",
            AsyncMock(return_value=CATALOG_UID),
        )
        mp.setattr(
            "app.services.provider_models.list_provider_entries",
            AsyncMock(return_value=[row]),
        )

        payload = await export_provider_catalog(db, PROVIDER)

    assert payload["provider"] == PROVIDER
    assert len(payload["models"]) == 1
    assert payload["models"][0]["model_id"] == "llama-3.3-70b-versatile"


@pytest.mark.asyncio
async def test_import_provider_catalog_replace_soft_deletes_existing():
    db = AsyncMock()
    row_old = _row(ENTRY_A)

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(
            "app.services.provider_models._ensure_system_catalog_initialized",
            AsyncMock(return_value=CATALOG_UID),
        )
        repo = AsyncMock()
        repo.list_for_provider.return_value = [row_old]
        repo.get_by_model_id.return_value = None
        mp.setattr(
            "app.services.provider_models.UserProviderModelRepository",
            lambda _db: repo,
        )

        affected = await import_provider_catalog(
            db,
            PROVIDER,
            [{"model_id": "new-model", "is_enabled": True, "sort_order": 0}],
            mode="replace",
        )

    assert affected == 1
    repo.soft_delete_for_user.assert_awaited_once_with(CATALOG_UID, ENTRY_A)
    db.add.assert_called_once()
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_import_provider_catalog_merge_updates_existing():
    db = AsyncMock()
    existing = _row(ENTRY_A)
    existing.model_id = "llama-3.3-70b-versatile"
    existing.is_removed = True
    existing.is_enabled = False

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(
            "app.services.provider_models._ensure_system_catalog_initialized",
            AsyncMock(return_value=CATALOG_UID),
        )
        repo = AsyncMock()
        repo.get_by_model_id.return_value = existing
        mp.setattr(
            "app.services.provider_models.UserProviderModelRepository",
            lambda _db: repo,
        )

        affected = await import_provider_catalog(
            db,
            PROVIDER,
            [{"model_id": "llama-3.3-70b-versatile", "is_enabled": True, "sort_order": 1}],
            mode="merge",
        )

    assert affected == 1
    assert existing.is_removed is False
    assert existing.is_enabled is True
    assert existing.sort_order == 1
    db.add.assert_not_called()
    db.commit.assert_awaited_once()


def test_bulk_request_requires_entry_ids_without_apply_to_all():
    with pytest.raises(ValidationError):
        BulkProviderModelRequest(action="enable")


def test_bulk_request_apply_to_all_without_entry_ids():
    body = BulkProviderModelRequest(action="disable", apply_to="all")
    assert body.apply_to == "all"
    assert body.entry_ids is None
