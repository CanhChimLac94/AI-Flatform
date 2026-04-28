"""
Tests for FR-07 / US05 Telegram schema: migration, model definition, and repository queries.

These are pure-unit tests — no live database required.
"""

import importlib.util
import pathlib
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import BigInteger, String


# ── 1. Model column definitions ───────────────────────────────────────────────

class TestUserModelTelegramColumns:
    """User model must declare telegram_id and telegram_username with correct types/constraints."""

    def setup_method(self):
        from app.models.user import User
        self.User = User

    def test_telegram_id_column_exists(self):
        cols = {c.name: c for c in self.User.__table__.columns}
        assert "telegram_id" in cols, "telegram_id column missing from users table"

    def test_telegram_id_is_bigint(self):
        col = self.User.__table__.columns["telegram_id"]
        assert isinstance(col.type, BigInteger)

    def test_telegram_id_is_nullable(self):
        col = self.User.__table__.columns["telegram_id"]
        assert col.nullable is True, "telegram_id must be nullable (users without Telegram)"

    def test_telegram_id_is_unique(self):
        col = self.User.__table__.columns["telegram_id"]
        assert col.unique is True, "telegram_id must have a unique constraint"

    def test_telegram_username_column_exists(self):
        cols = {c.name: c for c in self.User.__table__.columns}
        assert "telegram_username" in cols, "telegram_username column missing from users table"

    def test_telegram_username_is_string(self):
        col = self.User.__table__.columns["telegram_username"]
        assert isinstance(col.type, String)

    def test_telegram_username_is_nullable(self):
        col = self.User.__table__.columns["telegram_username"]
        assert col.nullable is True


# ── 2. Migration file structure ───────────────────────────────────────────────

def _load_migration():
    """Load the migration module by file path (module name starts with a digit)."""
    migration_path = (
        pathlib.Path(__file__).parent.parent
        / "alembic" / "versions" / "0001_add_telegram_fields_to_users.py"
    )
    spec = importlib.util.spec_from_file_location("migration_0001", migration_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class TestMigration0001Structure:
    """Migration 0001 must be importable, have correct revision chain, and call ADD COLUMN."""

    def setup_method(self):
        self.migration = _load_migration()

    def test_revision_id(self):
        assert self.migration.revision == "0001"

    def test_no_parent_revision(self):
        assert self.migration.down_revision is None

    def test_upgrade_function_exists(self):
        assert callable(self.migration.upgrade)

    def test_downgrade_function_exists(self):
        assert callable(self.migration.downgrade)

    def test_upgrade_executes_add_column_telegram_id(self):
        mock_op = MagicMock()
        with patch.object(self.migration, "op", mock_op):
            self.migration.upgrade()
        sql_calls = " ".join(str(c.args[0]).lower() for c in mock_op.execute.call_args_list)
        assert "telegram_id" in sql_calls
        assert "add column" in sql_calls

    def test_upgrade_executes_add_column_telegram_username(self):
        mock_op = MagicMock()
        with patch.object(self.migration, "op", mock_op):
            self.migration.upgrade()
        sql_calls = " ".join(str(c.args[0]).lower() for c in mock_op.execute.call_args_list)
        assert "telegram_username" in sql_calls

    def test_downgrade_drops_both_columns(self):
        mock_op = MagicMock()
        with patch.object(self.migration, "op", mock_op):
            self.migration.downgrade()
        sql_calls = " ".join(str(c.args[0]).lower() for c in mock_op.execute.call_args_list)
        assert "telegram_id" in sql_calls
        assert "telegram_username" in sql_calls
        assert "drop" in sql_calls


# ── 3. UserRepository.get_by_email ────────────────────────────────────────────

class TestUserRepositoryGetByEmail:
    """get_by_email must execute without errors and return the scalar result."""

    @pytest.mark.asyncio
    async def test_returns_user_when_found(self):
        from app.repositories.user import UserRepository

        mock_user = MagicMock()
        mock_session = AsyncMock()
        mock_session.execute.return_value.scalar_one_or_none.return_value = mock_user

        repo = UserRepository(session=mock_session)
        result = await repo.get_by_email("alice@example.com")

        assert result is mock_user
        mock_session.execute.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self):
        from app.repositories.user import UserRepository

        mock_session = AsyncMock()
        mock_session.execute.return_value.scalar_one_or_none.return_value = None

        repo = UserRepository(session=mock_session)
        result = await repo.get_by_email("nobody@example.com")

        assert result is None

    @pytest.mark.asyncio
    async def test_query_filters_by_email(self):
        """Verify the SELECT is filtering on email, not some other column."""
        from app.repositories.user import UserRepository
        from sqlalchemy import select
        from app.models.user import User

        captured = []

        async def capture_execute(stmt, *args, **kwargs):
            captured.append(stmt)
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = None
            return mock_result

        mock_session = AsyncMock()
        mock_session.execute.side_effect = capture_execute

        repo = UserRepository(session=mock_session)
        await repo.get_by_email("test@example.com")

        assert len(captured) == 1
        compiled = str(captured[0].compile(compile_kwargs={"literal_binds": True}))
        assert "email" in compiled.lower()


# ── 4. UserRepository.get_by_telegram_id ──────────────────────────────────────

class TestUserRepositoryGetByTelegramId:
    """get_by_telegram_id must filter on telegram_id and return scalar result."""

    @pytest.mark.asyncio
    async def test_returns_user_when_found(self):
        from app.repositories.user import UserRepository

        mock_user = MagicMock()
        mock_session = AsyncMock()
        mock_session.execute.return_value.scalar_one_or_none.return_value = mock_user

        repo = UserRepository(session=mock_session)
        result = await repo.get_by_telegram_id(123456789)

        assert result is mock_user

    @pytest.mark.asyncio
    async def test_returns_none_when_not_linked(self):
        from app.repositories.user import UserRepository

        mock_session = AsyncMock()
        mock_session.execute.return_value.scalar_one_or_none.return_value = None

        repo = UserRepository(session=mock_session)
        result = await repo.get_by_telegram_id(999)

        assert result is None

    @pytest.mark.asyncio
    async def test_query_filters_on_telegram_id_column(self):
        from app.repositories.user import UserRepository

        captured = []

        async def capture_execute(stmt, *args, **kwargs):
            captured.append(stmt)
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = None
            return mock_result

        mock_session = AsyncMock()
        mock_session.execute.side_effect = capture_execute

        repo = UserRepository(session=mock_session)
        await repo.get_by_telegram_id(111222333)

        assert len(captured) == 1
        compiled = str(captured[0].compile(compile_kwargs={"literal_binds": True}))
        assert "telegram_id" in compiled.lower()


# ── 5. Unique constraint enforcement (model-level) ────────────────────────────

class TestTelegramIdUniqueness:
    """telegram_id unique constraint must be declared at the SQLAlchemy model level."""

    def test_unique_constraint_on_telegram_id(self):
        from app.models.user import User

        col = User.__table__.columns["telegram_id"]
        assert col.unique is True, (
            "telegram_id must have unique=True; duplicate Telegram accounts must be rejected"
        )

    def test_two_users_different_telegram_ids_are_distinct(self):
        """Model construction with different telegram_ids must not raise."""
        from app.models.user import User

        u1 = User(
            id=uuid.uuid4(),
            email="user1@test.com",
            telegram_id=100,
            telegram_username="user_one",
            persona_config={},
        )
        u2 = User(
            id=uuid.uuid4(),
            email="user2@test.com",
            telegram_id=200,
            telegram_username="user_two",
            persona_config={},
        )
        assert u1.telegram_id != u2.telegram_id

    def test_user_without_telegram_id_is_valid(self):
        """telegram_id=None must be accepted (users who haven't linked Telegram)."""
        from app.models.user import User

        u = User(
            id=uuid.uuid4(),
            email="nobot@test.com",
            telegram_id=None,
            persona_config={},
        )
        assert u.telegram_id is None
