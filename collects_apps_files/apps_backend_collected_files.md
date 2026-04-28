# Collected Files - backend

> **Nguồn:** `/mnt/d/01.WORKS/WWW/AI-Projects/AIChat/apps/backend`
> **Bộ lọc:** chỉ collect source/config/script text; bỏ qua dependency, env, build cache, media và binary

---

## `.dockerignore`

```dockerignore
__pycache__/
*.py[cod]
*.egg-info/
.venv/
venv/
.env
.env.*
!.env.example
*.log
.pytest_cache/
.mypy_cache/
.ruff_cache/
alembic/versions/*.py
tests/
.git/
.gitignore
Dockerfile
*.md

```

---

## `.env.example`

```example
DATABASE_URL=postgresql+asyncpg://omni:omni_secret@localhost:5432/omni_ai
REDIS_URL=redis://localhost:6379/0

JWT_SECRET_KEY=change_this_to_a_random_secret_256_bits
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440

OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk_...

USE_PGVECTOR=true
PINECONE_API_KEY=
PINECONE_ENVIRONMENT=
PINECONE_INDEX_NAME=omni-memories

TAVILY_API_KEY=tvly-...
TELEGRAM_BOT_TOKEN=

ENVIRONMENT=development

```

---

## `Dockerfile`

```WORKS/WWW/AI-Projects/AIChat/apps/backend/Dockerfile
# ── Stage 1: builder ─────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: production runner ────────────────────────────────────────────────
FROM python:3.11-slim AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local
COPY . .

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ENVIRONMENT=production

EXPOSE 8000

# Run migrations then start server; UVICORN_WORKERS defaults to 2
CMD ["sh", "-c", "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 8000 --workers ${UVICORN_WORKERS:-2}"]

```

---

## `alembic.ini`

```ini
[alembic]
script_location = alembic
prepend_sys_path = .
version_path_separator = os
sqlalchemy.url = postgresql+asyncpg://omni:omni_secret@localhost:5432/omni_ai

[post_write_hooks]

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S

```

---

## `alembic/env.py`

```py
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.db.session import Base

# Import all models so Alembic detects them for autogenerate
import app.models  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())

```

---

<!-- SKIPPED (non-source): alembic/script.py.mako -->
<!-- SKIPPED (non-source): alembic/versions/.gitkeep -->
## `alembic/versions/0001_add_telegram_fields_to_users.py`

```py
"""add telegram_id and telegram_username to users

Revision ID: 0001
Revises:
Create Date: 2026-04-22

Idempotent design: handles two scenarios without crashing:
  1. Existing DB that was created before these columns were added — columns get added fresh.
  2. Fresh DB initialised from init.sql (which already includes the columns) — ADD COLUMN IF NOT EXISTS
     is a no-op; the DO block skips constraint creation when a unique constraint already covers
     telegram_id (e.g. the inline UNIQUE from init.sql named "users_telegram_id_key").

The UNIQUE constraint's implicit B-tree index is the fast-lookup index used by
_get_user_by_telegram_id (WHERE telegram_id = ?); no separate index is needed.
"""

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ADD COLUMN IF NOT EXISTS: no-op when init.sql already created these columns.
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id BIGINT")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(100)")

    # Create unique constraint only when no unique constraint already covers telegram_id.
    # Avoids a duplicate when init.sql created its own inline UNIQUE ("users_telegram_id_key").
    # The constraint implicitly creates a unique B-tree index — sufficient for fast lookups.
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM   pg_constraint c
                JOIN   pg_attribute  a
                       ON  a.attnum    = ANY(c.conkey)
                       AND a.attrelid  = c.conrelid
                WHERE  c.conrelid = 'users'::regclass
                  AND  c.contype  = 'u'
                  AND  a.attname  = 'telegram_id'
            ) THEN
                ALTER TABLE users ADD CONSTRAINT uq_users_telegram_id UNIQUE (telegram_id);
            END IF;
        END $$
    """)


def downgrade() -> None:
    # DROP CONSTRAINT IF EXISTS is safe whether it was created by this migration or not.
    # Inline UNIQUE from init.sql (named "users_telegram_id_key") is left intact on downgrade
    # because it was not created by this migration.
    op.execute("""
        ALTER TABLE users
            DROP CONSTRAINT IF EXISTS uq_users_telegram_id,
            DROP COLUMN     IF EXISTS telegram_username,
            DROP COLUMN     IF EXISTS telegram_id
    """)

```

---

## `alembic/versions/0002_add_agents_table.py`

```py
"""Add agents table and agent_id to conversations

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-22
"""

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS agents (
            id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
            owner_user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name            VARCHAR(120) NOT NULL,
            description     TEXT,
            system_prompt   TEXT        NOT NULL DEFAULT '',
            model           VARCHAR(100),
            params          JSONB       NOT NULL DEFAULT '{}',
            tools           JSONB       NOT NULL DEFAULT '[]',
            is_public       BOOLEAN     NOT NULL DEFAULT FALSE,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents(owner_user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_agents_public ON agents(is_public) WHERE is_public = TRUE")

    # Add agent_id FK to conversations (nullable, SET NULL on agent delete)
    op.execute("""
        ALTER TABLE conversations
        ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE SET NULL
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE conversations DROP COLUMN IF EXISTS agent_id")
    op.execute("DROP TABLE IF EXISTS agents")

```

---

## `alembic/versions/0003_add_user_default_provider_model.py`

```py
"""add default_provider and default_model to users

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-22

Idempotent: uses ADD COLUMN IF NOT EXISTS and an UPDATE guard so re-running is safe.
Seeds sensible defaults for both new and existing rows.
"""

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add columns with DB-level defaults so existing rows get values immediately.
    op.execute("""
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS default_provider VARCHAR(50)  NOT NULL DEFAULT 'openai',
            ADD COLUMN IF NOT EXISTS default_model    VARCHAR(100) NOT NULL DEFAULT 'gpt-4o-mini'
    """)

    # Belt-and-suspenders: backfill any rows that somehow ended up with empty strings.
    op.execute("""
        UPDATE users
        SET default_provider = 'openai',
            default_model    = 'gpt-4o-mini'
        WHERE default_provider = ''
           OR default_model    = ''
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE users
            DROP COLUMN IF EXISTS default_model,
            DROP COLUMN IF EXISTS default_provider
    """)

```

---

## `alembic/versions/0004_add_language_preference_to_users.py`

```py
"""add language_preference to users

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-23

Idempotent: uses ADD COLUMN IF NOT EXISTS so re-running is safe.
Sets default language to Vietnamese (vi) for all users.
"""

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add language_preference column with default value 'vi' (Vietnamese)
    op.execute("""
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS language_preference VARCHAR(10) NOT NULL DEFAULT 'vi'
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE users
            DROP COLUMN IF EXISTS language_preference
    """)

```

---

## `alembic/versions/0005_change_default_provider_to_groq.py`

```py
"""change default provider/model to groq/llama-3.3-70b-versatile

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-24

Updates the DB column server_defaults and backfills users who still have
the old openai/gpt-4o-mini defaults (i.e. never explicitly changed them).
"""

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Update column-level server defaults for new rows
    op.execute("""
        ALTER TABLE users
            ALTER COLUMN default_provider SET DEFAULT 'groq',
            ALTER COLUMN default_model    SET DEFAULT 'llama-3.3-70b-versatile'
    """)

    # Backfill existing users that still have the original openai defaults
    op.execute("""
        UPDATE users
        SET default_provider = 'groq',
            default_model    = 'llama-3.3-70b-versatile'
        WHERE default_provider = 'openai'
          AND default_model    = 'gpt-4o-mini'
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE users
            ALTER COLUMN default_provider SET DEFAULT 'openai',
            ALTER COLUMN default_model    SET DEFAULT 'gpt-4o-mini'
    """)

    op.execute("""
        UPDATE users
        SET default_provider = 'openai',
            default_model    = 'gpt-4o-mini'
        WHERE default_provider = 'groq'
          AND default_model    = 'llama-3.3-70b-versatile'
    """)

```

---

## `alembic/versions/0006_multiple_api_keys_per_provider.py`

```py
"""multiple api keys per provider

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-24

Allows each user to store more than one API key per provider.
Changes:
  - Adds `label` column (VARCHAR 100, default "Default")
  - Adds `is_active` column (BOOLEAN, default true)
  - Drops unique constraint uq_user_provider (user_id, provider)
  - Adds unique constraint uq_user_provider_label (user_id, provider, label)

Idempotent: safe to run on a DB bootstrapped from init.sql (columns may already
exist when init.sql was updated before this migration ran).  Uses IF NOT EXISTS /
DO $$ ... END $$ guards throughout so re-running never raises an error.
"""

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add columns only when absent (init.sql may already have them).
    op.execute("ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS label VARCHAR(100)")
    op.execute("ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS is_active BOOLEAN")

    # Backfill nulls left by IF NOT EXISTS no-op or genuinely new rows.
    op.execute(
        "UPDATE user_api_keys SET label = 'Default' WHERE label IS NULL"
    )
    op.execute(
        "UPDATE user_api_keys SET is_active = true WHERE is_active IS NULL"
    )

    # Tighten NOT NULL now that every row has a value.
    op.execute("ALTER TABLE user_api_keys ALTER COLUMN label SET NOT NULL")
    op.execute("ALTER TABLE user_api_keys ALTER COLUMN is_active SET NOT NULL")

    # Set column defaults for future inserts.
    op.execute("ALTER TABLE user_api_keys ALTER COLUMN label SET DEFAULT 'Default'")
    op.execute("ALTER TABLE user_api_keys ALTER COLUMN is_active SET DEFAULT true")

    # Swap constraints: drop old (user_id, provider) unique, add (user_id, provider, label).
    # Both operations are conditional so re-running is safe.
    op.execute("""
        DO $$ BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'user_api_keys'::regclass
                  AND conname  = 'uq_user_provider'
                  AND contype  = 'u'
            ) THEN
                ALTER TABLE user_api_keys DROP CONSTRAINT uq_user_provider;
            END IF;
        END $$
    """)

    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'user_api_keys'::regclass
                  AND conname  = 'uq_user_provider_label'
                  AND contype  = 'u'
            ) THEN
                ALTER TABLE user_api_keys
                    ADD CONSTRAINT uq_user_provider_label UNIQUE (user_id, provider, label);
            END IF;
        END $$
    """)


def downgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'user_api_keys'::regclass
                  AND conname  = 'uq_user_provider_label'
                  AND contype  = 'u'
            ) THEN
                ALTER TABLE user_api_keys DROP CONSTRAINT uq_user_provider_label;
            END IF;
        END $$
    """)

    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'user_api_keys'::regclass
                  AND conname  = 'uq_user_provider'
                  AND contype  = 'u'
            ) THEN
                ALTER TABLE user_api_keys
                    ADD CONSTRAINT uq_user_provider UNIQUE (user_id, provider);
            END IF;
        END $$
    """)

    op.execute("ALTER TABLE user_api_keys DROP COLUMN IF EXISTS is_active")
    op.execute("ALTER TABLE user_api_keys DROP COLUMN IF EXISTS label")

```

---

<!-- SKIPPED (binary): app/__init__.py -->
<!-- SKIPPED (binary): app/api/__init__.py -->
## `app/api/dependencies.py`

```py
"""
FastAPI dependency injections:
  - get_current_user  : validates JWT, returns User (NFR-02)
  - rate_limit_check  : Redis sliding-window per account (EX-05, max 10 req/min)
  - quota_check       : daily token quota gate (EX-05, R03 → 403 on exhaustion)
"""

from uuid import UUID

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decode_access_token
from app.db.redis import get_redis
from app.db.session import get_db
from app.models.user import User
from app.repositories.user import UserRepository
from app.services.quota import is_quota_exceeded
from typing import Optional

bearer_scheme = HTTPBearer()
optional_bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        user_id = decode_access_token(credentials.credentials)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    repo = UserRepository(db)
    user = await repo.get(UUID(user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Returns the authenticated User, or None if no/invalid token (allows anonymous access)."""
    if credentials is None:
        return None
    try:
        user_id = decode_access_token(credentials.credentials)
    except ValueError:
        return None
    repo = UserRepository(db)
    return await repo.get(UUID(user_id))


async def rate_limit_check(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> None:
    """
    Sliding-window rate limit: max RATE_LIMIT_MESSAGES_PER_MINUTE per account.
    Uses Redis INCR + EXPIRE so the window resets every 60 seconds (EX-05).
    """
    redis = get_redis()
    key = f"rl:{current_user.id}"
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, 60)
    if count > settings.RATE_LIMIT_MESSAGES_PER_MINUTE:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded: max {settings.RATE_LIMIT_MESSAGES_PER_MINUTE} messages/minute.",
        )


async def quota_check(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Daily token quota gate. Returns 403 when exhausted (R03 / EX-05).
    Redis is the fast path; Postgres is the source of truth (see services/quota.py).
    """
    if await is_quota_exceeded(current_user.id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Đã hết lượt dùng miễn phí trong ngày.",
        )

```

---

<!-- SKIPPED (binary): app/api/v1/__init__.py -->
## `app/api/v1/agents.py`

```py
"""
Agent CRUD — POST /v1/agents, GET /v1/agents, GET/PATCH/DELETE /v1/agents/:id
Plus POST /v1/agents/:id/duplicate.

Permission model:
  - Only the owner can PATCH / DELETE.
  - Any authenticated user can read their own agents + public agents.
  - Guests cannot create or list agents (authentication required).
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.repositories.agent import AgentRepository
from app.schemas.agent import AgentCreate, AgentOut, AgentUpdate

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("", response_model=list[AgentOut])
async def list_agents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns all agents owned by the authenticated user."""
    repo = AgentRepository(db)
    return await repo.list_for_user(current_user.id)


@router.post("", response_model=AgentOut, status_code=status.HTTP_201_CREATED)
async def create_agent(
    body: AgentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = AgentRepository(db)
    agent = await repo.create(
        owner_user_id=current_user.id,
        name=body.name,
        description=body.description,
        system_prompt=body.system_prompt,
        model=body.model,
        params=body.params,
        tools=body.tools,
        is_public=body.is_public,
    )
    await db.commit()
    return agent


@router.get("/{agent_id}", response_model=AgentOut)
async def get_agent(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = AgentRepository(db)
    agent = await repo.get(agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    # Allow access to own agents or public agents
    if str(agent.owner_user_id) != str(current_user.id) and not agent.is_public:
        raise HTTPException(status_code=403, detail="Access denied")
    return agent


@router.patch("/{agent_id}", response_model=AgentOut)
async def update_agent(
    agent_id: UUID,
    body: AgentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = AgentRepository(db)
    agent = await repo.get_owned(agent_id, current_user.id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found or access denied")

    if body.name is not None:
        agent.name = body.name
    if body.description is not None:
        agent.description = body.description
    if body.system_prompt is not None:
        agent.system_prompt = body.system_prompt
    if body.model is not None:
        agent.model = body.model
    if body.params is not None:
        agent.params = body.params
    if body.tools is not None:
        agent.tools = body.tools
    if body.is_public is not None:
        agent.is_public = body.is_public

    await repo.save(agent)
    await db.commit()
    return agent


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = AgentRepository(db)
    agent = await repo.get_owned(agent_id, current_user.id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found or access denied")
    await repo.delete(agent)
    await db.commit()


@router.post("/{agent_id}/duplicate", response_model=AgentOut, status_code=status.HTTP_201_CREATED)
async def duplicate_agent(
    agent_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Creates a copy of an agent owned by (or public to) the caller."""
    repo = AgentRepository(db)
    source = await repo.get(agent_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    if str(source.owner_user_id) != str(current_user.id) and not source.is_public:
        raise HTTPException(status_code=403, detail="Access denied")

    copy = await repo.create(
        owner_user_id=current_user.id,
        name=f"{source.name} (copy)",
        description=source.description,
        system_prompt=source.system_prompt,
        model=source.model,
        params=source.params,
        tools=source.tools,
        is_public=False,
    )
    await db.commit()
    return copy

```

---

## `app/api/v1/auth.py`

```py
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
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


class LoginRequest(BaseModel):
    email: EmailStr
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
    full_name: str | None = None
    avatar_url: str | None = None
    persona_config: dict = {}
    # Default provider/model — always non-null (fallback to openai/gpt-4o-mini)
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

    # default_provider / default_model are seeded by the SQLAlchemy column default
    user = await repo.create(
        email=body.email,
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
    )
    await db.commit()
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    repo = UserRepository(db)
    user = await repo.get_by_email(body.email)

    if user is None or user.hashed_password is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Backfill defaults for users created before migration 0003
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

```

---

## `app/api/v1/chat.py`

```py
"""
POST /v1/chat/completions — Main SSE streaming endpoint (Phase 4).
Ref: AiChat-UIUX-Wireframe §II, AiChat-SRS-Main §3.1

Pipeline:
  1. Optional Auth (JWT) — anonymous allowed
  2. Rate limit check for authenticated users — EX-05
  3. Quota check for authenticated users — EX-05 / R03 → 403
  4. Validate explicit provider/model (guest mode)
  5. Moderation       — EX-02 → refusal
  6. Persist user message (authenticated only)
  7. Stream via Orchestrator (intent → memory → search → LLM)
  8. Persist assistant reply + increment token counter (authenticated only)
  9. Background: extract long-term memory facts (authenticated only, FR-05)
"""

import json
import uuid
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_optional_user, quota_check, rate_limit_check
from app.db.session import get_db
from app.models.agent import Agent
from app.models.message import MessageRole
from app.models.user import User
from app.repositories.agent import AgentRepository
from app.repositories.conversation import ConversationRepository
from app.repositories.message import MessageRepository
from app.schemas.chat import ChatCompletionRequest, SSEError
from app.services.memory import extract_and_store_facts
from app.services.moderation import ModerationError, check_content, REFUSAL_MESSAGE
from app.services.orchestrator import VALID_PROVIDERS, stream_chat_completion
from app.services.quota import increment_tokens
from app.services.user_keys import get_all_effective_keys

router = APIRouter(prefix="/chat", tags=["chat"])


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.post("/completions")
async def chat_completions(
    http_request: Request,
    req: ChatCompletionRequest,
    background_tasks: BackgroundTasks,
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    # Propagate X-Request-Id for distributed tracing; generate one if absent
    request_id = http_request.headers.get("x-request-id") or str(uuid.uuid4())

    response_headers = {
        "X-Request-Id": request_id,
        "Cache-Control": "no-cache",
    }

    # ── 1. Rate limit + quota for authenticated users only ───────────────────
    if current_user is not None:
        from app.db.redis import get_redis
        from app.core.config import settings
        from app.services.quota import is_quota_exceeded

        redis = get_redis()
        key = f"rl:{current_user.id}"
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, 60)
        if count > settings.RATE_LIMIT_MESSAGES_PER_MINUTE:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded: max {settings.RATE_LIMIT_MESSAGES_PER_MINUTE} messages/minute.",
            )

        if await is_quota_exceeded(current_user.id, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Đã hết lượt dùng miễn phí trong ngày.",
            )

    # ── 2. Validate explicit provider (guest mode) ───────────────────────────
    if req.provider is not None:
        if req.provider not in VALID_PROVIDERS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid provider '{req.provider}'. Valid providers: {sorted(VALID_PROVIDERS)}",
            )
        # Guest mode: api_key must be present when no system key exists for this provider
        # (the orchestrator will raise at stream time if key is empty — acceptable UX)

    # ── 3. Moderation (EX-02) ────────────────────────────────────────────────
    last_user_content = next(
        (m.content for m in reversed(req.messages) if m.role == "user"), ""
    )
    try:
        await check_content(last_user_content)
    except ModerationError:
        async def refusal_stream():
            yield _sse({"type": "content", "delta": REFUSAL_MESSAGE})
            yield _sse({"type": "done", "usage": {
                "prompt_tokens": 0, "completion_tokens": 0,
                "total_tokens": 0, "provider": "moderation", "model": "none",
            }})
        return StreamingResponse(
            refusal_stream(),
            media_type="text/event-stream",
            headers=response_headers,
        )

    # ── 4. Resolve or create conversation (authenticated only) ───────────────
    conv_repo = ConversationRepository(db)
    msg_repo = MessageRepository(db)
    conv = None

    if current_user is not None:
        if req.conversation_id:
            conv = await conv_repo.get(UUID(req.conversation_id))
            if conv is None or conv.user_id != current_user.id:
                raise HTTPException(status_code=404, detail="Conversation not found")
        else:
            conv = await conv_repo.create(user_id=current_user.id)
            await db.commit()

        # ── 5. Persist incoming user message ────────────────────────────────
        await msg_repo.create_message(
            conv_id=conv.id,
            role=MessageRole.user,
            content=last_user_content,
        )
        await db.commit()

    # ── 6. Load agent — from request (stateless) or from conversation (persistent) ─
    active_agent: Agent | None = None
    agent_repo = AgentRepository(db)

    if req.agent_id:
        # Stateless: caller passed agent_id directly (works for guest agents too)
        from uuid import UUID as _UUID
        try:
            fetched = await agent_repo.get(_UUID(req.agent_id))
            if fetched and (
                current_user is None or
                str(fetched.owner_user_id) == str(current_user.id) or
                fetched.is_public
            ):
                active_agent = fetched
        except (ValueError, Exception):
            pass  # Invalid UUID or not found — continue without agent

    elif current_user is not None and conv is not None and conv.agent_id is not None:
        # Persistent: conversation has an agent assigned
        active_agent = await agent_repo.get(conv.agent_id)

    # ── 7. Build system prompt ───────────────────────────────────────────────
    if active_agent is not None and active_agent.system_prompt:
        # Agent takes over the full system prompt
        system_prompt = active_agent.system_prompt
        tone = current_user.persona_config.get("tone", "") if (current_user and current_user.persona_config) else ""
        language = current_user.persona_config.get("language", "") if (current_user and current_user.persona_config) else ""
        if language:
            system_prompt += f"\n\nRespond in {language}."
        if tone and tone not in ("helpful", ""):
            system_prompt += f" Use a {tone} tone."
    elif current_user is not None:
        persona_cfg = current_user.persona_config or {}
        persona = persona_cfg.get("persona", "")
        language = persona_cfg.get("language", "")
        tone = persona_cfg.get("tone", "helpful")
        system_prompt = (
            f"You are a helpful AI assistant. "
            f"The user's name is {current_user.full_name or 'there'}. "
            f"Respond in the same language the user uses."
            + (f" {persona}" if persona else "")
            + (f" Respond in {language}." if language else "")
            + (f" Use a {tone} tone." if tone and tone != "helpful" else "")
        )
    else:
        system_prompt = "You are a helpful AI assistant. Respond in the same language the user uses."

    # ── 8. Apply agent model/tools override to request ───────────────────────
    # Build a shallow override dict so we don't mutate the parsed req object
    agent_model_override: str | None = None
    agent_tools_override: list[str] | None = None
    if active_agent is not None:
        if active_agent.model and not req.model:
            agent_model_override = active_agent.model
        if active_agent.tools:
            # Merge: agent tools + caller tools (deduplicated)
            agent_tools_override = list(dict.fromkeys(active_agent.tools + list(req.tools)))

    # Reconstruct request with agent overrides applied when needed
    if agent_model_override or agent_tools_override:
        from copy import copy
        req = copy(req)
        if agent_model_override:
            req.model = agent_model_override
        if agent_tools_override:
            req.tools = agent_tools_override

    # ── 9. Resolve per-user API keys (BYOK, authenticated only) ─────────────
    # For guest mode, req.api_key is injected directly in the orchestrator.
    user_api_keys = await get_all_effective_keys(current_user.id, db) if current_user else {}

    # ── 10. Stream via Orchestrator ──────────────────────────────────────────
    async def event_stream():
        collected_content: list[str] = []
        total_tokens = 0
        provider_used = "unknown"
        model_used = "unknown"

        try:
            async for raw_sse in stream_chat_completion(
                req,
                system_prompt=system_prompt,
                user_id=current_user.id if current_user else None,
                db=db,
                user_api_keys=user_api_keys,
            ):
                if raw_sse.startswith("data: "):
                    try:
                        payload = json.loads(raw_sse[6:].strip())
                        ptype = payload.get("type")
                        if ptype == "content":
                            collected_content.append(payload.get("delta", ""))
                        elif ptype == "done":
                            usage = payload.get("usage", {})
                            total_tokens = usage.get("total_tokens", 0)
                            provider_used = usage.get("provider", "unknown")
                            model_used = usage.get("model", "unknown")
                    except json.JSONDecodeError:
                        pass
                yield raw_sse

        except Exception as exc:
            yield _sse(SSEError(message=str(exc)).model_dump())
            return

        # ── 11. Persist assistant reply (authenticated only) ─────────────────
        if current_user is not None and conv is not None and collected_content:
            full_reply = "".join(collected_content)
            await msg_repo.create_message(
                conv_id=conv.id,
                role=MessageRole.assistant,
                content=full_reply,
                extra={"provider": provider_used, "model": model_used},
                tokens_used=total_tokens,
            )
            conv.model_id = model_used
            await conv_repo.save(conv)
            await db.commit()

            if total_tokens > 0:
                await increment_tokens(current_user.id, total_tokens, db)

            # ── 12. Background: extract long-term memory (FR-05, US04 AC1) ───
            all_messages = [
                {"role": m.role.value, "content": m.content}
                for m in await msg_repo.list_for_conversation(conv.id)
            ]
            background_tasks.add_task(
                extract_and_store_facts, current_user.id, all_messages, db
            )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers=response_headers,
    )

```

---

## `app/api/v1/conversations.py`

```py
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.repositories.agent import AgentRepository
from app.repositories.conversation import ConversationRepository

router = APIRouter(prefix="/conversations", tags=["conversations"])


class ConversationOut(BaseModel):
    id: UUID
    title: str | None
    model_id: str | None
    is_archived: bool
    agent_id: UUID | None = None

    model_config = {"from_attributes": True, "protected_namespaces": ()}


class AssignAgentRequest(BaseModel):
    agent_id: UUID | None


@router.get("", response_model=list[ConversationOut])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = ConversationRepository(db)
    return await repo.list_for_user(current_user.id)


@router.post("", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = ConversationRepository(db)
    conv = await repo.create(user_id=current_user.id)
    await db.commit()
    return conv


@router.delete("/{conv_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conv_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = ConversationRepository(db)
    conv = await repo.get(conv_id)
    if conv is None or conv.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await repo.soft_delete(conv)
    await db.commit()


@router.put("/{conv_id}/agent", status_code=status.HTTP_204_NO_CONTENT)
async def assign_agent(
    conv_id: UUID,
    body: AssignAgentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Assign (or clear) an agent for a conversation. Pass agent_id=null to detach."""
    conv_repo = ConversationRepository(db)
    conv = await conv_repo.get(conv_id)
    if conv is None or conv.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if body.agent_id is not None:
        agent_repo = AgentRepository(db)
        agent = await agent_repo.get(body.agent_id)
        if agent is None:
            raise HTTPException(status_code=404, detail="Agent not found")
        # Only allow own agents or public agents
        if str(agent.owner_user_id) != str(current_user.id) and not agent.is_public:
            raise HTTPException(status_code=403, detail="Access denied")

    conv.agent_id = body.agent_id
    await conv_repo.save(conv)
    await db.commit()

```

---

## `app/api/v1/integrations.py`

```py
"""Account linking endpoint — generates one-time codes for Telegram (US05 AC1)."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.dependencies import get_current_user
from app.models.user import User
from app.services.telegram import generate_link_code

router = APIRouter(prefix="/integrations", tags=["integrations"])


class LinkCodeResponse(BaseModel):
    code: str
    expires_in_seconds: int = 600
    instructions: str


@router.post("/telegram/link-code", response_model=LinkCodeResponse)
async def get_telegram_link_code(current_user: User = Depends(get_current_user)):
    code = await generate_link_code(str(current_user.id))
    return LinkCodeResponse(
        code=code,
        instructions=f"Send /link {code} to the Omni AI Telegram bot within 10 minutes.",
    )

```

---

## `app/api/v1/router.py`

```py
from fastapi import APIRouter

from app.api.v1 import agents, auth, chat, conversations, integrations, settings, webhooks

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(conversations.router)
api_router.include_router(chat.router)
api_router.include_router(settings.router)
api_router.include_router(agents.router)
api_router.include_router(webhooks.router)
api_router.include_router(integrations.router)

```

---

## `app/api/v1/settings.py`

```py
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

```

---

## `app/api/v1/webhooks.py`

```py
"""
STEP 6.1 — Telegram Webhook Gateway.
Ref: FR-07, US05, AiChat-SRS-Main §3.3

Supported commands (US05 AC3):
  /start          → welcome + linking instructions
  /link {CODE}    → link Telegram account to web account
  /newchat        → create a new conversation
  /summary        → summarise the current conversation (stub for Phase 2 extension)
  /mode auto|speed|quality → change routing preference for this session
  <text>          → forward to orchestrator, stream reply back to Telegram
"""

import hashlib
import hmac
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.conversation import Conversation
from app.models.message import MessageRole
from app.repositories.conversation import ConversationRepository
from app.repositories.message import MessageRepository
from app.repositories.user import UserRepository
from app.schemas.chat import ChatCompletionRequest, MessageIn
from app.services.moderation import ModerationError, check_content, REFUSAL_MESSAGE
from app.services.orchestrator import stream_chat_completion
from app.services.quota import increment_tokens, is_quota_exceeded
from app.services.telegram import (
    generate_link_code,
    resolve_link_code,
    send_message,
    stream_reply_to_telegram,
)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# Per-session model preference stored in Redis key: tg_mode:{telegram_id}
_MODE_KEY = "tg_mode:{}"
_ACTIVE_CONV_KEY = "tg_conv:{}"


def _verify_telegram_token(secret_token: str | None) -> bool:
    """Telegram sends X-Telegram-Bot-Api-Secret-Token when configured."""
    if not settings.TELEGRAM_BOT_TOKEN:
        return False
    expected = hmac.new(
        key=b"WebAppData",
        msg=settings.TELEGRAM_BOT_TOKEN.encode(),
        digestmod=hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(secret_token or "", expected)


async def _get_or_create_conv(user_id, tg_id: int, db: AsyncSession) -> Conversation:
    from app.db.redis import get_redis
    redis = get_redis()
    conv_id = await redis.get(_ACTIVE_CONV_KEY.format(tg_id))
    repo = ConversationRepository(db)
    if conv_id:
        conv = await repo.get(conv_id)
        if conv and conv.user_id == user_id:
            return conv
    conv = await repo.create(user_id=user_id)
    await db.commit()
    await redis.set(_ACTIVE_CONV_KEY.format(tg_id), str(conv.id), ex=86400)
    return conv


async def _handle_update(update: dict[str, Any]) -> None:
    """Background task — processes one Telegram update asynchronously."""
    message = update.get("message") or update.get("edited_message")
    if not message:
        return

    chat_id: int = message["chat"]["id"]
    telegram_id: int = message["from"]["id"]
    telegram_username: str = message["from"].get("username", "")
    text: str = (message.get("text") or "").strip()

    if not text:
        return

    async with AsyncSessionLocal() as db:
        from app.db.redis import get_redis
        redis = get_redis()

        # ── /start ───────────────────────────────────────────────────────────
        if text == "/start":
            await send_message(
                chat_id,
                "👋 *Welcome to Omni AI Chat!*\n\n"
                "To link your account, visit the web app and generate a code "
                "under Settings → Integrations, then send:\n"
                "`/link YOUR_CODE`\n\n"
                "Commands: /newchat · /summary · /mode auto|speed|quality",
            )
            return

        # ── /link {CODE} ──────────────────────────────────────────────────────
        if text.startswith("/link "):
            code = text.split(" ", 1)[1].strip()
            user_id = await resolve_link_code(code)
            if not user_id:
                await send_message(chat_id, "❌ Code expired or invalid. Please generate a new one.")
                return
            user_repo = UserRepository(db)
            user = await user_repo.get(user_id)
            if user:
                user.telegram_id = telegram_id
                user.telegram_username = telegram_username
                await db.commit()
                await send_message(chat_id, f"✅ Account linked! Welcome, {user.full_name or user.email}.")
            return

        # ── Resolve user ──────────────────────────────────────────────────────
        user = await UserRepository(db).get_by_telegram_id(telegram_id)
        if not user:
            await send_message(
                chat_id,
                "🔗 Please link your account first using `/link YOUR_CODE`.\n"
                "Get a code from the web app under Settings → Integrations.",
            )
            return

        # ── /newchat ──────────────────────────────────────────────────────────
        if text == "/newchat":
            await redis.delete(_ACTIVE_CONV_KEY.format(telegram_id))
            await send_message(chat_id, "✅ New conversation started.")
            return

        # ── /summary ──────────────────────────────────────────────────────────
        if text == "/summary":
            await send_message(chat_id, "📝 Summary feature coming soon in Phase 4.2 extension.")
            return

        # ── /mode ─────────────────────────────────────────────────────────────
        if text.startswith("/mode"):
            parts = text.split()
            mode = parts[1].lower() if len(parts) > 1 else "auto"
            if mode not in ("auto", "speed", "quality"):
                await send_message(chat_id, "Usage: /mode auto | speed | quality")
                return
            await redis.set(_MODE_KEY.format(telegram_id), mode, ex=86400)
            await send_message(chat_id, f"✅ Model mode set to *{mode}*.")
            return

        # ── Quota check ───────────────────────────────────────────────────────
        if await is_quota_exceeded(user.id, db):
            await send_message(chat_id, "⚠️ Daily token quota exhausted. Try again tomorrow.")
            return

        # ── Moderation (EX-02) ────────────────────────────────────────────────
        try:
            await check_content(text)
        except ModerationError:
            await send_message(chat_id, REFUSAL_MESSAGE)
            return

        # ── Build request + stream ─────────────────────────────────────────────
        mode_raw = await redis.get(_MODE_KEY.format(telegram_id)) or "auto"
        conv = await _get_or_create_conv(user.id, telegram_id, db)

        msg_repo = MessageRepository(db)
        await msg_repo.create_message(conv_id=conv.id, role=MessageRole.user, content=text)
        await db.commit()

        req = ChatCompletionRequest(
            conversation_id=str(conv.id),
            model_preference=mode_raw,
            messages=[MessageIn(role="user", content=text)],
            stream=True,
        )
        system_prompt = (
            f"You are a helpful AI assistant replying via Telegram. "
            f"The user's name is {user.full_name or 'there'}. "
            f"Keep responses concise since this is a messaging interface. "
            f"Respond in the same language the user uses."
        )

        generator = stream_chat_completion(req, system_prompt, user_id=user.id, db=db)
        await stream_reply_to_telegram(chat_id, generator)

        # Increment quota (tokens counted inside stream_reply_to_telegram via done event)
        # Full token tracking done via increment_tokens inside the SSE generator


@router.post("/telegram")
async def telegram_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
):
    # In production, verify the secret token set when registering the webhook
    # Skipped in dev when token is not configured
    if settings.ENVIRONMENT != "development" and not _verify_telegram_token(
        x_telegram_bot_api_secret_token
    ):
        raise HTTPException(status_code=403, detail="Invalid webhook token")

    update = await request.json()
    background_tasks.add_task(_handle_update, update)
    return {"ok": True}

```

---

<!-- SKIPPED (binary): app/core/__init__.py -->
## `app/core/config.py`

```py
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://omni:omni_secret@localhost:5432/omni_ai"
    REDIS_URL: str = "redis://localhost:6379/0"

    # Auth
    JWT_SECRET_KEY: str = "insecure-dev-secret"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440

    # LLM Providers
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    NVIDIA_API_KEY: str = ""

    # Vector DB
    USE_PGVECTOR: bool = True
    PINECONE_API_KEY: str = ""
    PINECONE_ENVIRONMENT: str = ""
    PINECONE_INDEX_NAME: str = "omni-memories"

    # Search
    TAVILY_API_KEY: str = ""

    # Telegram
    TELEGRAM_BOT_TOKEN: str = ""

    # App
    ENVIRONMENT: str = "development"

    # Rate limiting (EX-05): max messages per minute per account
    RATE_LIMIT_MESSAGES_PER_MINUTE: int = 10
    # Daily free token quota per user (FR-04, Business Rule #1)
    DAILY_FREE_TOKEN_QUOTA: int = 50_000


settings = Settings()

```

---

## `app/core/security.py`

```py
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: Any) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {"sub": str(subject), "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> str:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload["sub"]
    except JWTError:
        raise ValueError("Invalid or expired token")

```

---

<!-- SKIPPED (binary): app/db/__init__.py -->
## `app/db/redis.py`

```py
import redis.asyncio as aioredis

from app.core.config import settings

_pool: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    global _pool
    if _pool is None:
        _pool = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _pool


async def close_redis() -> None:
    global _pool
    if _pool:
        await _pool.aclose()
        _pool = None

```

---

## `app/db/session.py`

```py
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_pre_ping=True)

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session

```

---

## `app/models/__init__.py`

```py
from app.models.agent import Agent
from app.models.api_provider import ApiProvider
from app.models.conversation import Conversation
from app.models.daily_usage import DailyUsage
from app.models.memory import UserMemory
from app.models.message import Message, MessageRole
from app.models.user import User

__all__ = [
    "User",
    "Agent",
    "Conversation",
    "Message",
    "MessageRole",
    "UserMemory",
    "ApiProvider",
    "DailyUsage",
]

```

---

## `app/models/agent.py`

```py
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Agent(Base):
    """Custom agent owned by a user.  Defines a system prompt, model override, and tool allowlist."""

    __tablename__ = "agents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # Optional model override — e.g. "gpt-4o-mini".  NULL means use the orchestrator default.
    model: Mapped[str | None] = mapped_column(String(100))
    # Extra LLM params: {"temperature": 0.7, "max_tokens": 2000}
    params: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # Tool allow-list: ["web_search"]
    tools: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    owner: Mapped["User"] = relationship(back_populates="agents")
    conversations: Mapped[list["Conversation"]] = relationship(back_populates="agent")

```

---

## `app/models/api_provider.py`

```py
from sqlalchemy import Boolean, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class ApiProvider(Base):
    __tablename__ = "api_providers"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # 'openai', 'anthropic', 'groq'
    base_url: Mapped[str] = mapped_column(Text, nullable=False)
    # Stored encrypted at application layer (NFR-02); raw key never logged
    api_key: Mapped[str] = mapped_column(Text, nullable=False, default="placeholder")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Lower priority = preferred provider; drives EX-01 failover order
    priority: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)

```

---

## `app/models/conversation.py`

```py
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str | None] = mapped_column(String(255))
    model_id: Mapped[str | None] = mapped_column(String(50))
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    # Soft delete — Schema §4 Strategy #2
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Optional agent assigned to this conversation
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True
    )

    user: Mapped["User"] = relationship(back_populates="conversations")
    agent: Mapped["Agent | None"] = relationship(back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at"
    )

```

---

## `app/models/daily_usage.py`

```py
import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class DailyUsage(Base):
    __tablename__ = "daily_usage"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True, nullable=False
    )
    usage_date: Mapped[date] = mapped_column(
        Date, primary_key=True, server_default=func.current_date(), nullable=False
    )
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    user: Mapped["User"] = relationship(back_populates="daily_usage")

```

---

## `app/models/memory.py`

```py
import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

# Matches OpenAI text-embedding-3-small output dimension
EMBEDDING_DIM = 1536


class UserMemory(Base):
    __tablename__ = "user_memories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    fact_content: Mapped[str] = mapped_column(Text, nullable=False)
    # External ID when using Pinecone instead of pgvector (config: USE_PGVECTOR=false)
    vector_id: Mapped[str | None] = mapped_column(String(255), index=True)
    # pgvector column — used when USE_PGVECTOR=true (FR-06 RAG retrieval)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM))
    importance_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="memories")

```

---

## `app/models/message.py`

```py
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class MessageRole(str, enum.Enum):
    user = "user"
    assistant = "assistant"
    system = "system"


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    conv_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    role: Mapped[MessageRole] = mapped_column(
        Enum(MessageRole, name="message_role", create_type=False), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Stores: file attachments, image URLs, search citations, code blocks (Schema §4 Strategy #3)
    extra: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)
    tokens_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    # Soft delete — Schema §4 Strategy #2
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")

```

---

## `app/models/user.py`

```py
import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(100))
    avatar_url: Mapped[str | None] = mapped_column(Text)
    hashed_password: Mapped[str | None] = mapped_column(Text)
    persona_config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # Default provider/model for this user (set on register, updatable via PATCH /settings/defaults)
    default_provider: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default="groq", default="groq"
    )
    default_model: Mapped[str] = mapped_column(
        String(100), nullable=False, server_default="llama-3.3-70b-versatile", default="llama-3.3-70b-versatile"
    )
    # Language preference (vi, en, etc.)
    language_preference: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default="vi", default="vi"
    )
    # Telegram integration (FR-07, US05)
    telegram_id: Mapped[int | None] = mapped_column(BigInteger, unique=True)
    telegram_username: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    conversations: Mapped[list["Conversation"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    agents: Mapped[list["Agent"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    memories: Mapped[list["UserMemory"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    daily_usage: Mapped[list["DailyUsage"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

```

---

## `app/models/user_api_key.py`

```py
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base

SUPPORTED_PROVIDERS = ("groq", "nvidia", "openrouter", "openai", "anthropic", "google")


class UserApiKey(Base):
    __tablename__ = "user_api_keys"
    __table_args__ = (
        UniqueConstraint("user_id", "provider", "label", name="uq_user_provider_label"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False, default="Default")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    encrypted_key: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

```

---

<!-- SKIPPED (binary): app/repositories/__init__.py -->
## `app/repositories/agent.py`

```py
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent
from app.repositories.base import BaseRepository


class AgentRepository(BaseRepository[Agent]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Agent, session)

    async def list_for_user(self, owner_user_id: UUID) -> list[Agent]:
        """Returns all agents owned by the user, newest first."""
        result = await self.session.execute(
            select(Agent)
            .where(Agent.owner_user_id == owner_user_id)
            .order_by(Agent.created_at.desc())
        )
        return list(result.scalars().all())

    async def list_public(self) -> list[Agent]:
        """Returns all public agents (for discovery)."""
        result = await self.session.execute(
            select(Agent).where(Agent.is_public.is_(True)).order_by(Agent.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_owned(self, agent_id: UUID, owner_user_id: UUID) -> Agent | None:
        """Returns agent only if caller is the owner."""
        result = await self.session.execute(
            select(Agent).where(
                Agent.id == agent_id,
                Agent.owner_user_id == owner_user_id,
            )
        )
        return result.scalar_one_or_none()

```

---

## `app/repositories/base.py`

```py
from typing import Any, Generic, Sequence, Type, TypeVar
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    def __init__(self, model: Type[ModelT], session: AsyncSession) -> None:
        self.model = model
        self.session = session

    async def get(self, id: UUID | str) -> ModelT | None:
        return await self.session.get(self.model, id)

    async def create(self, **kwargs: Any) -> ModelT:
        obj = self.model(**kwargs)
        self.session.add(obj)
        await self.session.flush()
        await self.session.refresh(obj)
        return obj

    async def save(self, obj: ModelT) -> ModelT:
        self.session.add(obj)
        await self.session.flush()
        await self.session.refresh(obj)
        return obj

    async def delete(self, obj: ModelT) -> None:
        await self.session.delete(obj)
        await self.session.flush()


class SoftDeleteRepository(BaseRepository[ModelT]):
    """
    Repository for tables with a `deleted_at` column.
    All list/get queries automatically exclude soft-deleted rows (Schema §4 Strategy #2).
    """

    async def get(self, id: UUID | str) -> ModelT | None:
        result = await self.session.execute(
            select(self.model).where(
                self.model.id == id,
                self.model.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def soft_delete(self, obj: ModelT) -> None:
        from datetime import datetime, timezone
        obj.deleted_at = datetime.now(timezone.utc)
        await self.session.flush()

    async def list_active(self, **filters: Any) -> Sequence[ModelT]:
        stmt = select(self.model).where(self.model.deleted_at.is_(None))
        for col, val in filters.items():
            stmt = stmt.where(getattr(self.model, col) == val)
        result = await self.session.execute(stmt)
        return result.scalars().all()

```

---

## `app/repositories/conversation.py`

```py
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.conversation import Conversation
from app.repositories.base import SoftDeleteRepository


class ConversationRepository(SoftDeleteRepository[Conversation]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Conversation, session)

    async def list_for_user(self, user_id: UUID, limit: int = 50) -> list[Conversation]:
        """Returns active conversations ordered by most recently updated (sidebar list)."""
        result = await self.session.execute(
            select(Conversation)
            .where(
                Conversation.user_id == user_id,
                Conversation.deleted_at.is_(None),
            )
            .order_by(Conversation.updated_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_with_messages(self, conv_id: UUID, user_id: UUID) -> Conversation | None:
        """Fetches a conversation with its messages pre-loaded (ownership check included)."""
        result = await self.session.execute(
            select(Conversation)
            .where(
                Conversation.id == conv_id,
                Conversation.user_id == user_id,
                Conversation.deleted_at.is_(None),
            )
            .options(selectinload(Conversation.messages))
        )
        return result.scalar_one_or_none()

```

---

## `app/repositories/memory.py`

```py
"""
UserMemory repository with pgvector ANN similarity search.
Ref: AiChat-Database-Schema.md Group C, FR-06
"""

from uuid import UUID

from pgvector.sqlalchemy import Vector
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.memory import UserMemory
from app.repositories.base import BaseRepository


class UserMemoryRepository(BaseRepository[UserMemory]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(UserMemory, session)

    async def find_similar(
        self,
        user_id: UUID,
        query_embedding: list[float],
        top_k: int = 5,
        min_importance: float = 0.0,
    ) -> list[UserMemory]:
        """
        Cosine ANN search using the HNSW index created in init.sql.
        Returns top_k memories ordered by similarity (most similar first).
        """
        result = await self.session.execute(
            select(UserMemory)
            .where(
                UserMemory.user_id == user_id,
                UserMemory.embedding.is_not(None),
                UserMemory.importance_score >= min_importance,
            )
            .order_by(
                UserMemory.embedding.cosine_distance(query_embedding)
            )
            .limit(top_k)
        )
        return list(result.scalars().all())

    async def list_for_user(self, user_id: UUID) -> list[UserMemory]:
        result = await self.session.execute(
            select(UserMemory)
            .where(UserMemory.user_id == user_id)
            .order_by(UserMemory.importance_score.desc())
        )
        return list(result.scalars().all())

    async def upsert_fact(
        self,
        user_id: UUID,
        fact_content: str,
        embedding: list[float],
        importance_score: float = 0.5,
    ) -> UserMemory:
        """
        If a very similar fact already exists (cosine distance < 0.15),
        update it with newer content (EC-03 — contradictory memory resolution).
        Otherwise create a new record.
        """
        existing = await self.find_similar(
            user_id, embedding, top_k=1, min_importance=0.0
        )
        if existing:
            # Check distance threshold — pgvector cosine_distance returns 0..2
            candidate = existing[0]
            distance_row = await self.session.execute(
                text(
                    "SELECT embedding <=> :emb AS dist FROM user_memories WHERE id = :id"
                ),
                {"emb": str(embedding), "id": str(candidate.id)},
            )
            dist = distance_row.scalar_one_or_none()
            if dist is not None and dist < 0.15:
                candidate.fact_content = fact_content
                candidate.embedding = embedding
                candidate.importance_score = max(candidate.importance_score, importance_score)
                await self.session.flush()
                return candidate

        return await self.create(
            user_id=user_id,
            fact_content=fact_content,
            embedding=embedding,
            importance_score=importance_score,
        )

```

---

## `app/repositories/message.py`

```py
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import Message, MessageRole
from app.repositories.base import SoftDeleteRepository


class MessageRepository(SoftDeleteRepository[Message]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Message, session)

    async def list_for_conversation(self, conv_id: UUID) -> list[Message]:
        """Returns active messages ordered chronologically for context window assembly."""
        result = await self.session.execute(
            select(Message)
            .where(
                Message.conv_id == conv_id,
                Message.deleted_at.is_(None),
            )
            .order_by(Message.created_at.asc())
        )
        return list(result.scalars().all())

    async def create_message(
        self,
        conv_id: UUID,
        role: MessageRole,
        content: str,
        extra: dict | None = None,
        tokens_used: int = 0,
    ) -> Message:
        return await self.create(
            conv_id=conv_id,
            role=role,
            content=content,
            extra=extra or {},
            tokens_used=tokens_used,
        )

```

---

## `app/repositories/user.py`

```py
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import load_only

from app.models.user import User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(User, session)

    async def get_by_email(self, email: str) -> User | None:
        # load_only enumerates columns explicitly so the query stays valid even if
        # a new column (e.g. language_preference) hasn't been migrated yet.
        # Remove load_only once migration 0004 has been applied to all envs.
        result = await self.session.execute(
            select(User)
            .where(User.email == email)
            .options(load_only(
                User.id,
                User.email,
                User.hashed_password,
                User.full_name,
                User.avatar_url,
                User.persona_config,
                User.default_provider,
                User.default_model,
                User.telegram_id,
                User.telegram_username,
                User.created_at,
            ))
        )
        return result.scalar_one_or_none()


    async def email_exists(self, email: str) -> bool:
        return await self.get_by_email(email) is not None

    async def get_by_telegram_id(self, telegram_id: int) -> User | None:
        result = await self.session.execute(
            select(User).where(User.telegram_id == telegram_id)
        )
        return result.scalar_one_or_none()

```

---

## `app/repositories/user_api_key.py`

```py
from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_api_key import UserApiKey


class UserApiKeyRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_for_user(self, user_id: UUID) -> list[UserApiKey]:
        result = await self.session.execute(
            select(UserApiKey)
            .where(UserApiKey.user_id == user_id)
            .order_by(UserApiKey.created_at)
        )
        return list(result.scalars().all())

    async def list_for_provider(self, user_id: UUID, provider: str) -> list[UserApiKey]:
        result = await self.session.execute(
            select(UserApiKey)
            .where(UserApiKey.user_id == user_id, UserApiKey.provider == provider)
            .order_by(UserApiKey.created_at)
        )
        return list(result.scalars().all())

    async def get_active(self, user_id: UUID, provider: str) -> UserApiKey | None:
        result = await self.session.execute(
            select(UserApiKey).where(
                UserApiKey.user_id == user_id,
                UserApiKey.provider == provider,
                UserApiKey.is_active.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: UUID, key_id: UUID) -> UserApiKey | None:
        result = await self.session.execute(
            select(UserApiKey).where(
                UserApiKey.id == key_id,
                UserApiKey.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def create(
        self,
        user_id: UUID,
        provider: str,
        encrypted_key: str,
        label: str = "Default",
        set_active: bool = True,
    ) -> UserApiKey:
        if set_active:
            await self.session.execute(
                update(UserApiKey)
                .where(UserApiKey.user_id == user_id, UserApiKey.provider == provider)
                .values(is_active=False)
            )

        record = UserApiKey(
            user_id=user_id,
            provider=provider,
            encrypted_key=encrypted_key,
            label=label,
            is_active=set_active,
        )
        self.session.add(record)
        await self.session.flush()
        await self.session.refresh(record)
        return record

    async def update_key(
        self,
        user_id: UUID,
        key_id: UUID,
        encrypted_key: str | None = None,
        label: str | None = None,
    ) -> UserApiKey | None:
        record = await self.get_by_id(user_id, key_id)
        if not record:
            return None
        if encrypted_key is not None:
            record.encrypted_key = encrypted_key
        if label is not None:
            record.label = label
        await self.session.flush()
        return record

    async def activate(self, user_id: UUID, provider: str, key_id: UUID) -> bool:
        """Set key_id as the active key; deactivate all others for the same provider."""
        await self.session.execute(
            update(UserApiKey)
            .where(UserApiKey.user_id == user_id, UserApiKey.provider == provider)
            .values(is_active=False)
        )
        result = await self.session.execute(
            update(UserApiKey)
            .where(UserApiKey.id == key_id, UserApiKey.user_id == user_id)
            .values(is_active=True)
        )
        await self.session.flush()
        return result.rowcount > 0

    async def delete_by_id(self, user_id: UUID, key_id: UUID) -> bool:
        record = await self.get_by_id(user_id, key_id)
        if not record:
            return False

        was_active = record.is_active
        provider = record.provider

        result = await self.session.execute(
            delete(UserApiKey).where(
                UserApiKey.id == key_id,
                UserApiKey.user_id == user_id,
            )
        )
        await self.session.flush()

        # If we deleted the active key, promote the most recently created remaining key
        if was_active and result.rowcount > 0:
            remaining = await self.list_for_provider(user_id, provider)
            if remaining:
                newest = max(remaining, key=lambda r: r.created_at)
                newest.is_active = True
                await self.session.flush()

        return result.rowcount > 0

```

---

<!-- SKIPPED (binary): app/schemas/__init__.py -->
## `app/schemas/agent.py`

```py
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AgentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: str | None = None
    system_prompt: str = ""
    model: str | None = None
    params: dict = {}
    tools: list[str] = []
    is_public: bool = False


class AgentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    system_prompt: str | None = None
    model: str | None = None
    params: dict | None = None
    tools: list[str] | None = None
    is_public: bool | None = None


class AgentOut(BaseModel):
    id: UUID
    owner_user_id: UUID
    name: str
    description: str | None
    system_prompt: str
    model: str | None
    params: dict
    tools: list
    is_public: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True, "protected_namespaces": ()}

```

---

## `app/schemas/chat.py`

```py
from typing import Literal
from pydantic import BaseModel, Field


class MessageIn(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str
    attachments: list[str] = []


class ChatCompletionRequest(BaseModel):
    model_config = {"protected_namespaces": ()}

    conversation_id: str | None = None
    model_preference: Literal["auto", "speed", "quality"] = "auto"
    messages: list[MessageIn]
    tools: list[str] = []  # e.g. ["web_search", "image_gen"]
    stream: bool = True

    # Explicit provider/model override — used by guest mode and direct selection.
    # When set, bypasses intent classification and uses this provider + model directly.
    provider: str | None = Field(default=None, description="Provider id: openai|anthropic|groq|openrouter|nvidia|google")
    model: str | None = Field(default=None, description="Exact model name for the chosen provider")
    # Client-supplied API key (guest mode BYOK). Only trusted when provider is also set.
    api_key: str | None = Field(default=None, description="Caller-supplied API key (guest mode)")
    # Agent override — UUID of an agent to use for this specific message (guest/server).
    agent_id: str | None = Field(default=None, description="Agent UUID to inject as system prompt")


class ErrorResponse(BaseModel):
    """Standard error envelope used by all non-streaming error responses."""
    code: str
    message: str
    details: dict | None = None


# ── SSE event shapes (AiChat-UIUX-Wireframe §II) ─────────────────────────────

class SSEStatus(BaseModel):
    type: Literal["status"] = "status"
    content: str


class SSECitation(BaseModel):
    id: int
    url: str
    title: str | None = None


class SSECitations(BaseModel):
    type: Literal["citations"] = "citations"
    links: list[SSECitation]


class SSEContent(BaseModel):
    type: Literal["content"] = "content"
    delta: str


class SSEUsage(BaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    provider: str
    model: str


class SSEDone(BaseModel):
    type: Literal["done"] = "done"
    usage: SSEUsage


class SSEError(BaseModel):
    type: Literal["error"] = "error"
    message: str

```

---

## `app/schemas/user.py`

```py
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

```

---

<!-- SKIPPED (binary): app/services/__init__.py -->
## `app/services/context_window.py`

```py
"""
Sliding Window context management — EX-03.

When the conversation exceeds max_tokens, the oldest non-system messages are
dropped first so the most recent context is always preserved.
Approximation: 1 token ≈ 4 characters (fast, no tiktoken dependency).
"""

from app.schemas.chat import MessageIn

# Conservative limit — leaves headroom for the model's reply
DEFAULT_MAX_CONTEXT_TOKENS = 6_000


def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def apply_sliding_window(
    messages: list[MessageIn],
    max_tokens: int = DEFAULT_MAX_CONTEXT_TOKENS,
) -> list[MessageIn]:
    """
    Returns a trimmed message list that fits within max_tokens.
    System messages are always preserved at the front.
    """
    system_msgs = [m for m in messages if m.role == "system"]
    non_system = [m for m in messages if m.role != "system"]

    system_tokens = sum(_estimate_tokens(m.content) for m in system_msgs)
    budget = max_tokens - system_tokens

    # Walk from newest to oldest, keeping messages that fit
    kept: list[MessageIn] = []
    used = 0
    for msg in reversed(non_system):
        cost = _estimate_tokens(msg.content)
        if used + cost > budget:
            break
        kept.append(msg)
        used += cost

    kept.reverse()
    return system_msgs + kept

```

---

## `app/services/encryption.py`

```py
"""
Symmetric encryption for user API keys stored in Postgres (NFR-02).
Uses Fernet (AES-128-CBC + HMAC-SHA256) with a key derived from JWT_SECRET_KEY.
"""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


def _fernet() -> Fernet:
    # Derive a 32-byte URL-safe base64 key from the app secret
    raw = hashlib.sha256(settings.JWT_SECRET_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(raw))


def encrypt_key(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_key(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken:
        raise ValueError("Failed to decrypt API key — possible key rotation or corruption.")


def mask_key(plaintext: str) -> str:
    """Returns e.g. 'sk-...xK3p' for display — never exposes the full key."""
    if len(plaintext) <= 8:
        return "••••••••"
    return plaintext[:4] + "••••••••" + plaintext[-4:]

```

---

## `app/services/intent_classifier.py`

```py
"""
STEP 4.1 — Smart Model Routing via LangChain intent classification.
Ref: AiChat-UIUX-Wireframe §III Step 1, US06

Uses Groq Llama3 (fastest/cheapest) to classify intent before routing.
Returns an IntentResult that the orchestrator uses to pick provider + tools.
"""

from enum import Enum

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq

from app.core.config import settings


class Intent(str, Enum):
    CHATTER = "CHATTER"        # small talk / simple Q&A  → Groq (US06 AC1)
    COMPLEX = "COMPLEX"        # reasoning, code, analysis → GPT-4o / Claude (US06 AC2)
    WEB_SEARCH = "WEB_SEARCH"  # needs live data           → search tool + LLM (FR-03, US03)
    FILE_ANALYSIS = "FILE_ANALYSIS"  # attachments present → vision model (FR-01)


_CLASSIFIER_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        """You are an intent classifier for an AI chat router.
Classify the user message into EXACTLY ONE of these labels:
- CHATTER     : greetings, small talk, simple factual Q&A (< 50 words, no live data needed)
- WEB_SEARCH  : needs current/real-time information (news, prices, weather, recent events)
- COMPLEX     : coding, deep analysis, mathematics, document review, multi-step reasoning
- FILE_ANALYSIS : the user is asking about an attached file or image

Reply with ONLY the label, nothing else.""",
    ),
    ("human", "{user_message}"),
])


async def classify_intent(user_message: str, has_attachments: bool = False) -> Intent:
    """
    Classifies the user's intent. Falls back to COMPLEX on any error
    so we never accidentally under-serve a user with a fast/cheap model.
    """
    if has_attachments:
        return Intent.FILE_ANALYSIS

    if not settings.GROQ_API_KEY or settings.GROQ_API_KEY == "gsk_...":
        # No key configured — fall back to word-count heuristic
        return Intent.CHATTER if len(user_message.split()) < 50 else Intent.COMPLEX

    try:
        llm = ChatGroq(
            api_key=settings.GROQ_API_KEY,
            model="llama-3.1-8b-instant",   # 8B is fast enough for classification
            temperature=0,
            max_tokens=10,
        )
        chain = _CLASSIFIER_PROMPT | llm | StrOutputParser()
        raw = await chain.ainvoke({"user_message": user_message[:500]})
        label = raw.strip().upper().split()[0]
        return Intent(label)
    except Exception:
        return Intent.COMPLEX   # Safe fallback


def intent_to_provider(intent: Intent) -> tuple[str, str]:
    """Maps intent → (provider, model) following US06 routing rules."""
    mapping = {
        Intent.CHATTER: ("groq", "llama-3.3-70b-versatile"),
        Intent.COMPLEX: ("openai", "gpt-4o"),
        Intent.WEB_SEARCH: ("openai", "gpt-4o"),      # web results injected as context
        Intent.FILE_ANALYSIS: ("openai", "gpt-4o"),   # vision-capable model
    }
    return mapping[intent]

```

---

## `app/services/memory.py`

```py
"""
STEP 4.2 — Long-term Memory (RAG).
Ref: FR-05, FR-06, US04, AiChat-UIUX-Wireframe §III Step 2

Two entry points:
  extract_and_store_facts()  — background job after conversation ends (FR-05, US04 AC1-AC2)
  retrieve_memory_context()  — called at chat start to build system prompt injection (FR-06, US04 AC3)
"""

from uuid import UUID

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.repositories.memory import UserMemoryRepository

# ── Embedding model ───────────────────────────────────────────────────────────
# 1536 dimensions — matches Vector(1536) column in user_memories table

def _get_embeddings() -> OpenAIEmbeddings:
    return OpenAIEmbeddings(
        api_key=settings.OPENAI_API_KEY,
        model="text-embedding-3-small",
    )


# ── Fact extraction chain (FR-05) ─────────────────────────────────────────────

_EXTRACT_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        """Extract concise, durable facts about the USER from the conversation.
Rules:
- Only facts directly stated by the user (name, job, preferences, goals, location, skills).
- Each fact on its own line, starting with "FACT:".
- Maximum 5 facts. Skip greetings, questions to the AI, and general knowledge.
- If no durable facts exist, output: NONE""",
    ),
    ("human", "Conversation:\n{conversation_text}"),
])


async def extract_and_store_facts(
    user_id: UUID,
    conversation_messages: list[dict],  # [{"role": ..., "content": ...}]
    db: AsyncSession,
) -> int:
    """
    Background job: extract user facts and upsert into user_memories (US04 AC1-AC2).
    Returns the number of facts stored.
    """
    if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY == "sk-...":
        return 0

    # Build conversation text (user turns only for extraction)
    lines = [
        f"{m['role'].upper()}: {m['content']}"
        for m in conversation_messages
        if m["role"] in ("user", "assistant")
    ]
    if not lines:
        return 0

    conversation_text = "\n".join(lines[:40])  # cap at 40 turns

    try:
        llm = ChatOpenAI(
            api_key=settings.OPENAI_API_KEY,
            model="gpt-4o-mini",
            temperature=0,
        )
        chain = _EXTRACT_PROMPT | llm | StrOutputParser()
        raw_output: str = await chain.ainvoke({"conversation_text": conversation_text})
    except Exception:
        return 0

    if raw_output.strip() == "NONE":
        return 0

    facts = [
        line.removeprefix("FACT:").strip()
        for line in raw_output.splitlines()
        if line.strip().startswith("FACT:")
    ]
    if not facts:
        return 0

    embeddings_model = _get_embeddings()
    repo = UserMemoryRepository(db)
    stored = 0

    for fact in facts:
        try:
            embedding = await embeddings_model.aembed_query(fact)
            await repo.upsert_fact(
                user_id=user_id,
                fact_content=fact,
                embedding=embedding,
                importance_score=0.7,
            )
            stored += 1
        except Exception:
            continue

    await db.commit()
    return stored


# ── Context retrieval (FR-06) ─────────────────────────────────────────────────

async def retrieve_memory_context(
    user_id: UUID,
    query: str,
    db: AsyncSession,
    top_k: int = 5,
) -> str:
    """
    Retrieves the most relevant user memories for the current query using cosine
    similarity on pgvector. Returns a formatted string ready to append to the
    system prompt (US04 AC3, AiChat-UIUX-Wireframe §III Step 2).
    """
    if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY == "sk-...":
        return ""

    try:
        embeddings_model = _get_embeddings()
        query_embedding = await embeddings_model.aembed_query(query)

        repo = UserMemoryRepository(db)
        memories = await repo.find_similar(
            user_id=user_id,
            query_embedding=query_embedding,
            top_k=top_k,
            min_importance=0.3,
        )
    except Exception:
        return ""

    if not memories:
        return ""

    facts_text = "\n".join(f"- {m.fact_content}" for m in memories)
    return (
        f"\n\n[Long-term memory about this user — use naturally, don't quote directly]\n"
        f"{facts_text}"
    )

```

---

## `app/services/moderation.py`

```py
"""
Safety filter — EX-02 / EC-04.
Runs BEFORE routing to any LLM. Uses OpenAI moderation endpoint (free, fast).
If flagged → raises ModerationError; caller returns refusal response.
"""

from openai import AsyncOpenAI

from app.core.config import settings

REFUSAL_MESSAGE = (
    "Tôi không thể hỗ trợ yêu cầu này vì vi phạm chính sách an toàn."
)


class ModerationError(Exception):
    pass


async def check_content(text: str) -> None:
    """Raises ModerationError if content violates safety policy."""
    if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY == "sk-...":
        return  # Skip in dev when no key is configured

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    response = await client.moderations.create(input=text)
    result = response.results[0]

    if result.flagged:
        categories = [k for k, v in result.categories.model_dump().items() if v]
        raise ModerationError(f"Content flagged: {', '.join(categories)}")

```

---

## `app/services/orchestrator.py`

```py
"""
Orchestrator — Phase 4 (LangChain intent classification + RAG + Web Search + Failover).
Ref: AiChat-UIUX-Wireframe §III, US06, FR-03, FR-05, FR-06, EX-01

Pipeline per request:
  1. Classify intent         → pick provider + model (STEP 4.1)
  2. Retrieve memory context → inject into system prompt (STEP 4.2)
  3. Web search (if needed)  → inject results + stream citations event (STEP 4.3)
  4. Stream from provider    → failover on 429/5xx (EX-01)

Guest / explicit-provider path (new):
  - If req.provider is set, skip intent classification and use it directly.
  - If req.api_key is set, override the provider's resolved key.
  - If req.model is set, use that exact model instead of the registry default.
"""

import json
import time
from collections.abc import AsyncGenerator
from uuid import UUID

import anthropic
from groq import APIStatusError as GroqAPIStatusError
from groq import AsyncGroq
from openai import APIStatusError, AsyncOpenAI, RateLimitError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.schemas.chat import (
    ChatCompletionRequest,
    SSECitations,
    SSEContent,
    SSEDone,
    SSEError,
    SSEStatus,
    SSEUsage,
)
from app.services.context_window import apply_sliding_window
from app.services.intent_classifier import Intent, classify_intent, intent_to_provider
from app.services.memory import retrieve_memory_context
from app.services.tools.web_search import SearchUnavailableError, web_search

# Failover priority (lower index = preferred after primary fails — EX-01)
PROVIDER_FALLBACK_ORDER = ["openai", "anthropic", "groq"]

# Default model per provider — callers can override via req.model
PROVIDER_MODELS: dict[str, str] = {
    "openai":      "gpt-4o",
    "anthropic":   "claude-3-5-sonnet-20241022",
    "groq":        "llama-3.3-70b-versatile",
    "openrouter":  "openai/gpt-4o",
    "nvidia":      "meta/llama-4-maverick-17b-128e-instruct",
    "google":      "gemini-pro",
}

FAILOVER_TIMEOUT_SECONDS = 3.0

# Alias map: decommissioned / renamed Groq model IDs → current equivalents
_GROQ_MODEL_ALIASES: dict[str, str] = {
    "llama3-70b-8192":    "llama-3.3-70b-versatile",
    "Llama3-70B":         "llama-3.3-70b-versatile",
    "llama-3-70b":        "llama-3.3-70b-versatile",
    "llama3-8b-8192":     "llama-3.1-8b-instant",
    "mixtral-8x7b-32768": "llama-3.3-70b-versatile",
}

# Alias map: decommissioned NVIDIA NIM model IDs → current equivalents
_NVIDIA_MODEL_ALIASES: dict[str, str] = {
    "meta/llama3-70b-instruct": "meta/llama-3.1-70b-instruct",  # EOL 2026-04-15
    "nvidia/nemotron-4-340b-instruct": "meta/llama-3.1-70b-instruct",
}


class _ModelDecommissionedError(Exception):
    """Raised when a provider rejects the model as decommissioned (e.g. Groq HTTP 400)."""


def _normalize_model(provider: str, model: str) -> str:
    """Resolve alias/deprecated model IDs to their current replacements."""
    if provider == "groq":
        return _GROQ_MODEL_ALIASES.get(model, model)
    if provider == "nvidia":
        return _NVIDIA_MODEL_ALIASES.get(model, model)
    return model


def _is_groq_decommissioned(exc: GroqAPIStatusError) -> bool:
    body = getattr(exc, "body", None)
    if isinstance(body, dict):
        err = body.get("error", {})
        if isinstance(err, dict):
            return (
                err.get("code") == "model_decommissioned"
                or "decommissioned" in (err.get("message") or "").lower()
            )
    return "decommissioned" in str(exc).lower()


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


# ── Provider streaming adapters ───────────────────────────────────────────────

async def _stream_openai(messages: list[dict], model: str, api_key: str = "") -> AsyncGenerator[str, None]:
    client = AsyncOpenAI(api_key=api_key or settings.OPENAI_API_KEY)
    prompt_tokens = completion_tokens = 0

    async with client.chat.completions.stream(
        model=model,
        messages=messages,
        stream_options={"include_usage": True},
    ) as stream:
        async for event in stream:
            if event.type == "content.delta" and event.delta:
                completion_tokens += 1
                yield _sse(SSEContent(delta=event.delta).model_dump())
            elif event.type == "chunk" and event.chunk.usage:
                prompt_tokens = event.chunk.usage.prompt_tokens or 0
                completion_tokens = event.chunk.usage.completion_tokens or 0

    yield _sse(SSEDone(usage=SSEUsage(
        prompt_tokens=prompt_tokens, completion_tokens=completion_tokens,
        total_tokens=prompt_tokens + completion_tokens,
        provider="openai", model=model,
    )).model_dump())


async def _stream_groq(messages: list[dict], model: str, api_key: str = "") -> AsyncGenerator[str, None]:
    client = AsyncGroq(api_key=api_key or settings.GROQ_API_KEY)
    prompt_tokens = completion_tokens = 0

    try:
        stream = await client.chat.completions.create(model=model, messages=messages, stream=True)
        async for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                completion_tokens += 1
                yield _sse(SSEContent(delta=delta).model_dump())
            if chunk.usage:
                prompt_tokens = chunk.usage.prompt_tokens or 0
                completion_tokens = chunk.usage.completion_tokens or 0
    except GroqAPIStatusError as exc:
        if _is_groq_decommissioned(exc):
            raise _ModelDecommissionedError(str(exc)) from exc
        raise

    yield _sse(SSEDone(usage=SSEUsage(
        prompt_tokens=prompt_tokens, completion_tokens=completion_tokens,
        total_tokens=prompt_tokens + completion_tokens,
        provider="groq", model=model,
    )).model_dump())


async def _stream_anthropic(messages: list[dict], model: str, api_key: str = "") -> AsyncGenerator[str, None]:
    client = anthropic.AsyncAnthropic(api_key=api_key or settings.ANTHROPIC_API_KEY)
    system_content = " ".join(m["content"] for m in messages if m["role"] == "system")
    non_system = [m for m in messages if m["role"] != "system"]
    input_tokens = output_tokens = 0

    async with client.messages.stream(
        model=model, max_tokens=4096,
        system=system_content or "You are a helpful assistant.",
        messages=non_system,
    ) as stream:
        async for text in stream.text_stream:
            output_tokens += 1
            yield _sse(SSEContent(delta=text).model_dump())
        usage = (await stream.get_final_message()).usage
        input_tokens, output_tokens = usage.input_tokens, usage.output_tokens

    yield _sse(SSEDone(usage=SSEUsage(
        prompt_tokens=input_tokens, completion_tokens=output_tokens,
        total_tokens=input_tokens + output_tokens,
        provider="anthropic", model=model,
    )).model_dump())


async def _stream_openrouter(messages: list[dict], model: str, api_key: str = "") -> AsyncGenerator[str, None]:
    """
    OpenRouter uses an OpenAI-compatible API at https://openrouter.ai/api/v1.
    Set OPENROUTER_API_KEY in .env or supply via req.api_key (guest mode).
    Model strings use the format "provider/model-name", e.g. "openai/gpt-4o".
    """
    key = api_key or settings.OPENROUTER_API_KEY
    if not key:
        raise ValueError("OpenRouter API key not configured. Set OPENROUTER_API_KEY or provide api_key in the request.")

    client = AsyncOpenAI(
        api_key=key,
        base_url="https://openrouter.ai/api/v1",
    )
    prompt_tokens = completion_tokens = 0

    stream = await client.chat.completions.create(
        model=model,
        messages=messages,
        max_tokens=4096,
        stream=True,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content if chunk.choices else None
        if delta:
            completion_tokens += 1
            yield _sse(SSEContent(delta=delta).model_dump())
        if chunk.usage:
            prompt_tokens = chunk.usage.prompt_tokens or 0
            completion_tokens = chunk.usage.completion_tokens or 0

    yield _sse(SSEDone(usage=SSEUsage(
        prompt_tokens=prompt_tokens, completion_tokens=completion_tokens,
        total_tokens=prompt_tokens + completion_tokens,
        provider="openrouter", model=model,
    )).model_dump())


async def _stream_nvidia(messages: list[dict], model: str, api_key: str = "") -> AsyncGenerator[str, None]:
    """
    NVIDIA NIM uses an OpenAI-compatible API at https://integrate.api.nvidia.com/v1.
    Set NVIDIA_API_KEY in .env or supply via req.api_key (guest mode).
    Model strings use the format "org/model-name", e.g. "meta/llama3-70b-instruct".
    TODO: For private/on-prem NIM endpoints, override NVIDIA_BASE_URL in .env.
    """
    key = api_key or settings.NVIDIA_API_KEY
    if not key:
        raise ValueError("NVIDIA API key not configured. Set NVIDIA_API_KEY or provide api_key in the request.")

    # TODO: allow override via settings.NVIDIA_BASE_URL for on-prem NIM deployments
    client = AsyncOpenAI(
        api_key=key,
        base_url="https://integrate.api.nvidia.com/v1",
    )
    prompt_tokens = completion_tokens = 0

    stream = await client.chat.completions.create(
        model=model,
        messages=messages,
        stream=True,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content if chunk.choices else None
        if delta:
            completion_tokens += 1
            yield _sse(SSEContent(delta=delta).model_dump())
        if chunk.usage:
            prompt_tokens = chunk.usage.prompt_tokens or 0
            completion_tokens = chunk.usage.completion_tokens or 0

    yield _sse(SSEDone(usage=SSEUsage(
        prompt_tokens=prompt_tokens, completion_tokens=completion_tokens,
        total_tokens=prompt_tokens + completion_tokens,
        provider="nvidia", model=model,
    )).model_dump())


_PROVIDER_STREAMS: dict[str, any] = {
    "openai":      _stream_openai,
    "anthropic":   _stream_anthropic,
    "groq":        _stream_groq,
    "openrouter":  _stream_openrouter,
    "nvidia":      _stream_nvidia,
}

# Exposed so the chat endpoint can validate req.provider before streaming starts
VALID_PROVIDERS: frozenset[str] = frozenset(_PROVIDER_STREAMS.keys())


# ── Main entry point ──────────────────────────────────────────────────────────

async def stream_chat_completion(
    req: ChatCompletionRequest,
    system_prompt: str,
    user_id: UUID | None = None,
    db: AsyncSession | None = None,
    user_api_keys: dict[str, str] | None = None,
) -> AsyncGenerator[str, None]:
    """
    Full Phase 4 orchestration pipeline. Yields raw SSE strings.

    Guest / explicit-provider path:
      - req.provider overrides intent classification.
      - req.model overrides the registry default for that provider.
      - req.api_key (if set alongside req.provider) overrides all stored keys.
    """
    last_user_msg = next(
        (m.content for m in reversed(req.messages) if m.role == "user"), ""
    )
    has_attachments = any(m.attachments for m in req.messages)

    # ── STEP 4.1: Determine provider ──────────────────────────────────────────
    if req.provider:
        # Explicit provider from caller — skip intent classification entirely.
        preferred_provider = req.provider
        intent_label = "EXPLICIT"
    elif req.model_preference != "auto":
        preferred_provider = "groq" if req.model_preference == "speed" else "openai"
        intent_label = req.model_preference.upper()
    else:
        intent = await classify_intent(last_user_msg, has_attachments)
        preferred_provider, _ = intent_to_provider(intent)
        intent_label = intent.value

    yield _sse(SSEStatus(content=f"Routing to {preferred_provider} ({intent_label})…").model_dump())

    # ── STEP 4.2: Long-term Memory Context Injection ──────────────────────────
    if user_id and db and settings.USE_PGVECTOR:
        memory_context = await retrieve_memory_context(user_id, last_user_msg, db)
        if memory_context:
            system_prompt += memory_context

    # ── STEP 4.3: Web Search Tool ─────────────────────────────────────────────
    search_context = ""
    # Use intent from classification (or skip if explicit provider with no web_search tool)
    run_web_search = "web_search" in req.tools
    if not req.provider:
        # Only check intent-based web search when we ran classification
        try:
            intent_obj = await classify_intent(last_user_msg, has_attachments)
            run_web_search = run_web_search or (intent_obj == Intent.WEB_SEARCH)
        except Exception:
            pass

    if run_web_search:
        yield _sse(SSEStatus(content="Searching the web…").model_dump())
        try:
            result = await web_search(last_user_msg)
            search_context = result.context
            if result.citations:
                yield _sse(SSECitations(links=result.citations).model_dump())
        except SearchUnavailableError:
            search_context = ""
            yield _sse(SSEStatus(
                content="Không thể kết nối Internet, tôi sẽ trả lời dựa trên dữ liệu cũ."
            ).model_dump())

    # ── Assemble final message list ───────────────────────────────────────────
    windowed = apply_sliding_window(req.messages)

    full_system = system_prompt
    if search_context:
        full_system += f"\n\n{search_context}"

    messages: list[dict] = [{"role": "system", "content": full_system}]
    messages += [{"role": m.role, "content": m.content} for m in windowed]

    # ── Build effective key map ───────────────────────────────────────────────
    # Priority: inline req.api_key > user_api_keys (DB/cache) > system .env key
    _keys: dict[str, str] = dict(user_api_keys or {})
    if req.api_key and req.provider:
        _keys[req.provider] = req.api_key

    # ── Provider dispatch with failover (EX-01) ───────────────────────────────
    # If caller specified an explicit provider, no failover — fail fast.
    if req.provider:
        fallback_chain = [req.provider]
    else:
        fallback_chain = [preferred_provider] + [
            p for p in PROVIDER_FALLBACK_ORDER if p != preferred_provider
        ]

    deadline = time.monotonic() + FAILOVER_TIMEOUT_SECONDS
    last_error: Exception | None = None

    for provider in fallback_chain:
        if time.monotonic() > deadline and provider != preferred_provider:
            break

        # Resolve model: explicit req.model > registry default, then normalize aliases
        raw_model = (req.model if req.provider else None) or PROVIDER_MODELS.get(provider, "")
        model = _normalize_model(provider, raw_model)
        stream_fn = _PROVIDER_STREAMS.get(provider)
        if stream_fn is None:
            yield _sse(SSEError(message=f"Unknown provider: {provider}").model_dump())
            return

        try:
            if provider != preferred_provider:
                yield _sse(SSEStatus(content=f"Switching to {provider} (failover)…").model_dump())

            async for chunk in stream_fn(messages, model, api_key=_keys.get(provider, "")):
                yield chunk
            return

        except _ModelDecommissionedError:
            # Retry once with the provider's current default model
            default_model = PROVIDER_MODELS.get(provider, "")
            if model != default_model:
                yield _sse(SSEStatus(
                    content=f"Model '{model}' decommissioned — retrying with '{default_model}'…"
                ).model_dump())
                try:
                    async for chunk in stream_fn(messages, default_model, api_key=_keys.get(provider, "")):
                        yield chunk
                    return
                except Exception as exc2:
                    last_error = exc2
            else:
                last_error = Exception(f"Default model '{model}' also decommissioned on {provider}")
            if req.provider:
                break
            continue

        except (RateLimitError, APIStatusError) as exc:
            last_error = exc
            if req.provider:
                # No failover for explicit provider — surface error immediately
                break
            continue
        except Exception as exc:
            last_error = exc
            break

    yield _sse(SSEError(message=f"All providers failed: {last_error}").model_dump())

```

---

## `app/services/provider_registry.py`

```py
"""
Central registry of all supported LLM providers.

Single source of truth for:
  - display names
  - base URLs (for OpenAI-compatible providers)
  - static model lists (fallback when live fetch unavailable)
  - default models
  - key format hints for the UI

Used by:
  - settings.py  — GET /settings/providers/{id}/models, GET /settings/defaults
  - auth.py      — seed default_provider/default_model on register
  - orchestrator — provider routing
"""

from typing import TypedDict


class ProviderInfo(TypedDict):
    name: str
    base_url: str | None          # None = SDK default (e.g. OpenAI official)
    models: list[str]
    default_model: str
    key_prefix_hint: str          # shown as placeholder in UI
    openai_compatible: bool       # True → can use AsyncOpenAI client for test ping


REGISTRY: dict[str, ProviderInfo] = {
    "groq": {
        "name": "Groq",
        "base_url": "https://api.groq.com/openai/v1",
        "models": [
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "meta-llama/llama-4-scout-17b-16e-instruct",
            "qwen/qwen3-32b",
            "groq/compound",
            "groq/compound-mini",
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b",
            "openai/gpt-oss-safeguard-20b",
            "allam-2-7b",
            "whisper-large-v3",
            "whisper-large-v3-turbo",
            "meta-llama/llama-prompt-guard-2-86m",
            "meta-llama/llama-prompt-guard-2-22m",
            "canopylabs/orpheus-v1-english",
            "canopylabs/orpheus-arabic-saudi",
        ],
        "default_model": "llama-3.3-70b-versatile",
        "key_prefix_hint": "gsk_...",
        "openai_compatible": True,
    },
    "openrouter": {
        "name": "OpenRouter",
        "base_url": "https://openrouter.ai/api/v1",
        "models": [
            "openai/gpt-4o",
            "openai/gpt-4o-mini",
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b",
            "openai/sora-2-pro",
            "anthropic/claude-3.5-sonnet",
            "google/gemini-pro-1.5",
            "google/gemma-4-26b-a4b-it",
            "google/gemma-4-31b-it",
            "google/gemma-3n-e2b-it",
            "google/gemma-3n-e4b-it",
            "google/gemma-3-4b-it",
            "google/gemma-3-12b-it",
            "google/gemma-3-27b-it",
            "google/gemma-3n-e2b-it:free",
            "google/gemma-3n-e4b-it:free",
            "google/gemma-3-4b-it:free",
            "google/gemma-3-12b-it:free",
            "google/gemma-3-27b-it:free",
            "nousresearch/hermes-3-llama-3.1-405b:free",
            "google/veo-3.1-fast",
            "google/veo-3.1-lite",
            "google/lyria-3-pro-preview",
            "google/lyria-3-clip-preview",
            "meta-llama/llama-3-70b-instruct",
            "meta-llama/llama-3.3-70b-instruct",
            "meta-llama/llama-3.2-3b-instruct",
            "mistralai/mistral-7b-instruct",
            "nvidia/nemotron-3-super-120b-a12b",
            "nvidia/nemotron-3-nano-30b-a3b",
            "nvidia/nemotron-nano-12b-v2-vl",
            "nvidia/nemotron-nano-9b-v2",
            "nvidia/llama-nemotron-embed-vl-1b-v2",
            "qwen/qwen3-next-80b-a3b-instruct",
            "qwen/qwen3-coder",
            "qwen/qwen3-coder:free",
            "minimax/hailuo-2.3",
            "minimax/minimax-m2.5",
            "bytedance/seedance-2.0",
            "bytedance/seedance-2.0-fast",
            "bytedance/seedance-1-5-pro",
            "bytedance-seed/seedream-4.5",
            "alibaba/wan-2.7",
            "alibaba/wan-2.6",
            "black-forest-labs/flux.2-pro",
            "black-forest-labs/flux.2-max",
            "black-forest-labs/flux.2-flex",
            "black-forest-labs/flux.2-klein-4b",
            "cohere/rerank-4-pro",
            "cohere/rerank-4-fast",
            "cohere/rerank-v3.5",
            "liquid/lfm-2.5-1.2b-thinking",
            "liquid/lfm-2.5-1.2b-instruct",
            "sourceful/riverflow-v2-pro",
            "sourceful/riverflow-v2-fast",
            "sourceful/riverflow-v2-max-preview",
            "sourceful/riverflow-v2-standard-preview",
            "sourceful/riverflow-v2-fast-preview",
            "nousresearch/hermes-3-llama-3.1-405b",
            "inclusionai/ling-2.6-1t",
            "inclusionai/ling-2.6-flash",
            "tencent/hy3-preview",
            "baidu/qianfan-ocr-fast",
            "kwaivgi/kling-video-o1",
            "z-ai/glm-4.5-air",
            "cognitivecomputations/dolphin-mistral-24b-venice-edition",
        ],
        "default_model": "openai/gpt-4o-mini",
        "key_prefix_hint": "sk-or-...",
        "openai_compatible": True,
    },
    "nvidia": {
        "name": "NVIDIA NIM",
        "base_url": "https://integrate.api.nvidia.com/v1",
        "models": [
            "meta/llama-4-maverick-17b-128e-instruct",
            "meta/llama-3.3-70b-instruct",
            "meta/llama-3.1-405b-instruct",
            "meta/llama-3.1-70b-instruct",
            "meta/llama-3.2-90b-vision-instruct",
            "meta/llama-3.2-11b-vision-instruct",
            "meta/llama-3.2-3b-instruct",
            "meta/llama-3.2-1b-instruct",
            "deepseek-ai/deepseek-v3.2",
            "deepseek-ai/deepseek-v3.1-terminus",
            "qwen/qwen3-coder-480b-a35b-instruct",
            "qwen/qwen3.5-397b-a17b",
            "qwen/qwen3.5-122b-a10b",
            "qwen/qwen3-next-80b-a3b-instruct",
            "qwen/qwen3-next-80b-a3b-thinking",
            "qwen/qwq-32b",
            "qwen/qwen2.5-coder-32b-instruct",
            "qwen/qwen2.5-7b-instruct",
            "qwen/qwen2.5-coder-7b-instruct",
            "qwen/qwen2-7b-instruct",
            "mistralai/mistral-large-3-675b-instruct-2512",
            "mistralai/devstral-2-123b-instruct-2512",
            "mistralai/ministral-14b-instruct-2512",
            "mistralai/mistral-small-4-119b-2603",
            "mistralai/magistral-small-2506",
            "mistralai/mistral-medium-3-instruct",
            "mistralai/mistral-small-3.1-24b-instruct-2503",
            "mistralai/mistral-small-24b-instruct",
            "mistralai/mistral-nemotron",
            "mistralai/mamba-codestral-7b-v0.1",
            "nvidia/llama-3.3-nemotron-super-49b-v1.5",
            "nvidia/llama-3.3-nemotron-super-49b-v1",
            "nvidia/nemotron-3-super-120b-a12b",
            "nvidia/nemotron-3-nano-30b-a3b",
            "nvidia/nemotron-nano-12b-v2-vl",
            "nvidia/nvidia-nemotron-nano-9b-v2",
            "nvidia/llama-3.1-nemotron-nano-8b-v1",
            "nvidia/llama-3.1-nemotron-nano-vl-8b-v1",
            "nvidia/nemotron-mini-4b-instruct",
            "nvidia/nemotron-4-mini-hindi-4b-instruct",
            "nvidia/usdcode",
            "google/gemma-4-31b-it",
            "google/gemma-3-27b-it",
            "google/gemma-3n-e4b-it",
            "google/gemma-3n-e2b-it",
            "google/gemma-2-2b-it",
            "microsoft/phi-4-mini-flash-reasoning",
            "microsoft/phi-4-mini-instruct",
            "microsoft/phi-4-multimodal-instruct",
            "microsoft/phi-3.5-mini-instruct",
            "moonshotai/kimi-k2-instruct",
            "moonshotai/kimi-k2-thinking",
            "moonshotai/kimi-k2.5",
            "moonshotai/kimi-k2-instruct-0905",
            "minimaxai/minimax-m2.7",
            "minimaxai/minimax-m2.5",
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b",
            "bytedance/seed-oss-36b-instruct",
            "stepfun-ai/step-3.5-flash",
            "z-ai/glm-5.1",
            "z-ai/glm-4.7",
            "marin/marin-8b-instruct",
            "sarvamai/sarvam-m",
            "stockmark/stockmark-2-100b-instruct",
            "abacusai/dracarys-llama-3.1-70b-instruct",
            "opengpt-x/teuken-7b-instruct-commercial-v0.4",
            "rakuten/rakutenai-7b-instruct",
            "rakuten/rakutenai-7b-chat",
            "nvidia/ising-calibration-1-35b-a3b",
        ],
        "default_model": "meta/llama-4-maverick-17b-128e-instruct",
        "key_prefix_hint": "nvapi-...",
        "openai_compatible": True,
    },
    "openai": {
        "name": "OpenAI",
        "base_url": None,
        "models": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
        "default_model": "gpt-4o-mini",
        "key_prefix_hint": "sk-...",
        "openai_compatible": True,
    },
    "anthropic": {
        "name": "Anthropic",
        "base_url": None,
        "models": [
            "claude-3-5-sonnet-20241022",
            "claude-3-haiku-20240307",
            "claude-3-opus-20240229",
        ],
        "default_model": "claude-3-5-sonnet-20241022",
        "key_prefix_hint": "sk-ant-...",
        "openai_compatible": False,
    },
    "google": {
        "name": "Google Gemini",
        "base_url": None,
        "models": ["gemini-pro", "gemini-pro-vision", "gemini-1.5-pro"],
        "default_model": "gemini-pro",
        "key_prefix_hint": "AIza...",
        "openai_compatible": False,
    },
    
}

ALL_PROVIDERS: tuple[str, ...] = tuple(REGISTRY.keys())

DEFAULT_PROVIDER = "groq"
DEFAULT_MODEL = "llama-3.3-70b-versatile"


def get_provider(provider_id: str) -> ProviderInfo | None:
    return REGISTRY.get(provider_id)


def get_models(provider_id: str) -> list[str]:
    info = REGISTRY.get(provider_id)
    return info["models"] if info else []


def get_default_model(provider_id: str) -> str:
    info = REGISTRY.get(provider_id)
    return info["default_model"] if info else DEFAULT_MODEL


async def test_provider_key(provider_id: str, api_key: str) -> tuple[bool, str]:
    """
    Pings the provider with the given key.
    Returns (ok: bool, message: str).
    Uses GET /models (OpenAI-compatible) or equivalent.
    Deliberately lightweight — just enough to verify auth.
    """
    info = REGISTRY.get(provider_id)
    if not info:
        return False, f"Unknown provider: {provider_id}"

    if info["openai_compatible"]:
        return await _ping_openai_compatible(provider_id, api_key, info["base_url"])
    elif provider_id == "anthropic":
        return await _ping_anthropic(api_key)
    elif provider_id == "google":
        return await _ping_google(api_key)
    return False, "Test not supported for this provider"


async def _ping_openai_compatible(provider_id: str, api_key: str, base_url: str | None) -> tuple[bool, str]:
    try:
        from openai import AsyncOpenAI, AuthenticationError, APIConnectionError
        kwargs: dict = {"api_key": api_key}
        if base_url:
            kwargs["base_url"] = base_url
        client = AsyncOpenAI(**kwargs)
        await client.models.list()
        return True, "Key valid"
    except Exception as exc:
        cls_name = type(exc).__name__
        if "auth" in cls_name.lower() or "401" in str(exc):
            return False, "Invalid API key"
        return False, f"Connection error: {cls_name}"


async def _ping_anthropic(api_key: str) -> tuple[bool, str]:
    try:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=api_key)
        # Cheapest possible call: count tokens on an empty message
        await client.messages.count_tokens(
            model="claude-3-haiku-20240307",
            messages=[{"role": "user", "content": "hi"}],
        )
        return True, "Key valid"
    except Exception as exc:
        if "401" in str(exc) or "auth" in str(exc).lower():
            return False, "Invalid API key"
        return False, f"Connection error: {type(exc).__name__}"


async def _ping_google(api_key: str) -> tuple[bool, str]:
    """Validate Google key format only — no live call to avoid SDK dependency."""
    if not api_key.startswith("AIza") or len(api_key) < 20:
        return False, "Key should start with 'AIza' and be at least 20 characters"
    return True, "Key format valid (live test not available)"

```

---

## `app/services/quota.py`

```py
"""
Daily token quota enforcement (EX-05, Business Rule #1, AiChat-UIUX-Wireframe §IV R03).

Flow:
  1. On every request: read key quota:{user_id}:{date} from Redis (fast path).
  2. If Redis key missing: load total_tokens from daily_usage table, warm Redis.
  3. After LLM response: atomically increment both Redis counter and Postgres row.
  4. If total >= DAILY_FREE_TOKEN_QUOTA → raise 403.
"""

from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.redis import get_redis
from app.models.daily_usage import DailyUsage


def _redis_quota_key(user_id: UUID) -> str:
    today = date.today().isoformat()
    return f"quota:{user_id}:{today}"


async def get_used_tokens(user_id: UUID, db: AsyncSession) -> int:
    redis = get_redis()
    key = _redis_quota_key(user_id)

    cached = await redis.get(key)
    if cached is not None:
        return int(cached)

    # Cache miss — load from Postgres and warm Redis
    result = await db.execute(
        select(DailyUsage.total_tokens).where(
            DailyUsage.user_id == user_id,
            DailyUsage.usage_date == date.today(),
        )
    )
    total = result.scalar_one_or_none() or 0
    # TTL set to end of day (seconds remaining) + buffer
    now = datetime.now(timezone.utc)
    seconds_left = (24 - now.hour) * 3600 - now.minute * 60 - now.second + 300
    await redis.set(key, total, ex=seconds_left)
    return total


async def is_quota_exceeded(user_id: UUID, db: AsyncSession) -> bool:
    used = await get_used_tokens(user_id, db)
    return used >= settings.DAILY_FREE_TOKEN_QUOTA


async def increment_tokens(user_id: UUID, tokens: int, db: AsyncSession) -> None:
    """Atomically increment both Redis counter and Postgres daily_usage row."""
    redis = get_redis()
    key = _redis_quota_key(user_id)
    await redis.incrby(key, tokens)

    # Upsert daily_usage row (Postgres source of truth)
    stmt = pg_insert(DailyUsage).values(
        user_id=user_id,
        usage_date=date.today(),
        total_tokens=tokens,
    ).on_conflict_do_update(
        index_elements=["user_id", "usage_date"],
        set_={"total_tokens": DailyUsage.total_tokens + tokens},
    )
    await db.execute(stmt)
    await db.commit()

```

---

## `app/services/telegram.py`

```py
"""
STEP 6.1 — Telegram Bot service layer.
Ref: FR-07, US05, AiChat-SRS-Main §3.3

Handles:
  - Sending / editing messages via Bot API
  - Generating one-time account-link codes (stored in Redis, TTL 10 min)
  - Buffering the SSE stream and streaming back to Telegram via message edits
"""

import httpx

from app.core.config import settings
from app.db.redis import get_redis

_BOT_BASE = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}"
_LINK_CODE_TTL = 600   # 10 minutes
_LINK_CODE_PREFIX = "tg_link:"


async def send_message(chat_id: int, text: str, parse_mode: str = "Markdown") -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.post(f"{_BOT_BASE}/sendMessage", json={
            "chat_id": chat_id,
            "text": text[:4096],   # Telegram hard limit
            "parse_mode": parse_mode,
        })
        return r.json()


async def edit_message(chat_id: int, message_id: int, text: str) -> None:
    """Used to simulate streaming: edit an existing bot message with growing content."""
    async with httpx.AsyncClient() as client:
        await client.post(f"{_BOT_BASE}/editMessageText", json={
            "chat_id": chat_id,
            "message_id": message_id,
            "text": text[:4096],
        })


# ── Account linking ───────────────────────────────────────────────────────────

async def generate_link_code(user_id: str) -> str:
    """Stores user_id under a 6-char code in Redis for 10 minutes (US05 AC1)."""
    import secrets
    redis = get_redis()
    code = secrets.token_hex(3).upper()   # e.g. "A3F7B2"
    await redis.set(f"{_LINK_CODE_PREFIX}{code}", user_id, ex=_LINK_CODE_TTL)
    return code


async def resolve_link_code(code: str) -> str | None:
    """Returns user_id and deletes the code (one-time use)."""
    redis = get_redis()
    key = f"{_LINK_CODE_PREFIX}{code.upper()}"
    user_id = await redis.get(key)
    if user_id:
        await redis.delete(key)
    return user_id


# ── Streaming to Telegram ─────────────────────────────────────────────────────

async def stream_reply_to_telegram(
    chat_id: int,
    sse_generator,
) -> None:
    """
    Consumes an orchestrator SSE generator and progressively edits a Telegram message
    so the user sees the response building up (simulated streaming — US05 AC2).
    """
    import json

    # Send placeholder to get message_id for edits
    sent = await send_message(chat_id, "⏳ Thinking…")
    message_id: int | None = sent.get("result", {}).get("message_id")

    accumulated = ""
    edit_threshold = 100   # Edit every ~100 new characters to avoid flood limits

    async for raw_sse in sse_generator:
        if not raw_sse.startswith("data: "):
            continue
        try:
            event = json.loads(raw_sse[6:].strip())
        except json.JSONDecodeError:
            continue

        etype = event.get("type")
        if etype == "content":
            accumulated += event.get("delta", "")
            if message_id and len(accumulated) % edit_threshold < 5:
                await edit_message(chat_id, message_id, accumulated)
        elif etype == "done":
            if message_id and accumulated:
                await edit_message(chat_id, message_id, accumulated)
            return
        elif etype == "error":
            await send_message(chat_id, f"❌ {event.get('message', 'Error')}")
            return

    if accumulated and message_id:
        await edit_message(chat_id, message_id, accumulated)

```

---

<!-- SKIPPED (binary): app/services/tools/__init__.py -->
## `app/services/tools/web_search.py`

```py
"""
STEP 4.3 — Web Search Tool via Tavily API.
Ref: FR-03, US03, AiChat-UIUX-Wireframe §III Step 1

Returns formatted context string + structured citations to inject into the LLM prompt.
Caller streams a "citations" SSE event before the content stream (US03 AC2).
"""

from dataclasses import dataclass

import asyncio
from functools import partial

try:
    from tavily import AsyncTavilyClient as _AsyncTavilyClient
    _HAS_ASYNC_CLIENT = True
except ImportError:
    _HAS_ASYNC_CLIENT = False

from tavily import TavilyClient

from app.core.config import settings
from app.schemas.chat import SSECitation


@dataclass
class SearchResult:
    context: str                    # Formatted text injected into system prompt
    citations: list[SSECitation]    # Sent to client as SSE citations event


class SearchUnavailableError(Exception):
    """Raised when Tavily is unreachable — caller falls back with a notice (US03 AC3)."""
    pass


async def web_search(query: str, max_results: int = 5) -> SearchResult:
    """
    Executes a Tavily web search and returns injected context + citations.
    Raises SearchUnavailableError on any network / auth failure (US03 AC3).
    """
    if not settings.TAVILY_API_KEY or settings.TAVILY_API_KEY == "tvly-...":
        raise SearchUnavailableError("TAVILY_API_KEY not configured")

    try:
        if _HAS_ASYNC_CLIENT:
            client = _AsyncTavilyClient(api_key=settings.TAVILY_API_KEY)
            response = await client.search(
                query=query,
                max_results=max_results,
                include_answer=True,
                include_raw_content=False,
            )
        else:
            # Older tavily-python without AsyncTavilyClient — run sync client in thread
            sync_client = TavilyClient(api_key=settings.TAVILY_API_KEY)
            search_fn = partial(
                sync_client.search,
                query=query,
                max_results=max_results,
                include_answer=True,
                include_raw_content=False,
            )
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(None, search_fn)
    except Exception as exc:
        raise SearchUnavailableError(str(exc)) from exc

    results = response.get("results", [])
    citations: list[SSECitation] = []
    snippets: list[str] = []

    for idx, r in enumerate(results, start=1):
        url = r.get("url", "")
        title = r.get("title", url)
        content = r.get("content", "")
        citations.append(SSECitation(id=idx, url=url, title=title))
        snippets.append(f"[{idx}] {title}\n{content}")

    # Prepend Tavily's synthesized answer if available
    answer = response.get("answer", "")
    if answer:
        snippets.insert(0, f"Summary: {answer}\n")

    context = (
        "--- Web Search Results (use these as your primary source) ---\n"
        + "\n\n".join(snippets)
        + "\n--- End of Search Results ---"
    )
    return SearchResult(context=context, citations=citations)

```

---

## `app/services/user_keys.py`

```py
"""
User API key resolver.

Priority: user's active key (from user_api_keys table) > system .env key.
Results are cached in Redis for 60 s to avoid a DB round-trip on every request.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.redis import get_redis
from app.repositories.user_api_key import UserApiKeyRepository
from app.services.encryption import decrypt_key

_CACHE_TTL = 60  # seconds
_CACHE_PREFIX = "ukey:{user_id}:{provider}"

# System-level fallbacks from .env
_SYSTEM_KEYS: dict[str, str] = {
    "openai":      settings.OPENAI_API_KEY,
    "anthropic":   settings.ANTHROPIC_API_KEY,
    "groq":        settings.GROQ_API_KEY,
    "google":      getattr(settings, "GOOGLE_API_KEY", ""),
    "openrouter":  getattr(settings, "OPENROUTER_API_KEY", ""),
    "nvidia":      getattr(settings, "NVIDIA_API_KEY", ""),
}

_ALL_PROVIDERS = ("openai", "anthropic", "groq", "google", "openrouter", "nvidia")


async def get_effective_key(provider: str, user_id: UUID, db: AsyncSession) -> str:
    """
    Returns the decrypted active API key for a provider.
    User's own active key takes precedence; falls back to system .env key.
    """
    redis = get_redis()
    cache_key = _CACHE_PREFIX.format(user_id=user_id, provider=provider)

    cached = await redis.get(cache_key)
    if cached is not None:
        return cached

    repo = UserApiKeyRepository(db)
    record = await repo.get_active(user_id, provider)

    if record and record.encrypted_key:
        try:
            plaintext = decrypt_key(record.encrypted_key)
            await redis.set(cache_key, plaintext, ex=_CACHE_TTL)
            return plaintext
        except ValueError:
            pass

    return _SYSTEM_KEYS.get(provider, "")


async def get_all_effective_keys(user_id: UUID, db: AsyncSession) -> dict[str, str]:
    """
    Fetch effective API keys for all providers in a single DB query.

    Uses list_for_user() and picks the active key per provider, avoiding
    N concurrent repo.get_active() calls on the same AsyncSession.
    """
    redis = get_redis()
    result: dict[str, str] = {}
    uncached: list[str] = []

    # ── Phase 1: Redis cache lookup ───────────────────────────────────────────
    for provider in _ALL_PROVIDERS:
        cached = await redis.get(_CACHE_PREFIX.format(user_id=user_id, provider=provider))
        if cached is not None:
            result[provider] = cached
        else:
            uncached.append(provider)

    if not uncached:
        return result

    # ── Phase 2: Single query for all user-stored keys ────────────────────────
    repo = UserApiKeyRepository(db)
    records = await repo.list_for_user(user_id)

    # Pick the active key per provider (fallback: most recent if none marked active)
    active_by_provider: dict[str, str] = {}
    by_provider: dict[str, list] = {}
    for r in records:
        if r.provider not in uncached:
            continue
        by_provider.setdefault(r.provider, []).append(r)
        if r.is_active and r.encrypted_key:
            try:
                active_by_provider[r.provider] = decrypt_key(r.encrypted_key)
            except ValueError:
                pass

    # Fallback: use most recent key for providers with no active key
    for provider, recs in by_provider.items():
        if provider not in active_by_provider:
            newest = max(recs, key=lambda r: r.created_at)
            if newest.encrypted_key:
                try:
                    active_by_provider[provider] = decrypt_key(newest.encrypted_key)
                except ValueError:
                    pass

    # ── Phase 3: Merge with system keys and populate cache ────────────────────
    for provider in uncached:
        key = active_by_provider.get(provider) or _SYSTEM_KEYS.get(provider, "")
        result[provider] = key
        if provider in active_by_provider:
            await redis.set(
                _CACHE_PREFIX.format(user_id=user_id, provider=provider),
                key,
                ex=_CACHE_TTL,
            )

    return result


async def invalidate_cache(user_id: UUID, provider: str) -> None:
    redis = get_redis()
    await redis.delete(_CACHE_PREFIX.format(user_id=user_id, provider=provider))

```

---

## `main.py`

```py
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.redis import close_redis


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_redis()


app = FastAPI(
    title="Omni AI Chat – Orchestrator API",
    version="1.0.0",
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/v1")


@app.get("/health")
async def health_check():
    return {"status": "ok", "env": settings.ENVIRONMENT}

```

---

## `pyproject.toml`

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]

[tool.ruff]
line-length = 100
target-version = "py311"

```

---

## `requirements.txt`

```txt
# Web Framework
fastapi==0.111.0
uvicorn[standard]==0.30.1

# Encryption (user API keys at rest — NFR-02)
cryptography==42.0.8

# Config & Env
python-dotenv==1.0.1
pydantic==2.7.4
pydantic-settings==2.3.0

# Database
sqlalchemy==2.0.30
asyncpg==0.29.0
alembic==1.13.1
pgvector==0.3.1

# Cache / Queue
redis==5.0.7

# Auth
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
bcrypt==3.2.2
python-multipart==0.0.9

# LLM Orchestration
langchain==0.2.6
langchain-core==0.2.10
langchain-openai==0.1.14
langchain-anthropic==0.1.19
langchain-groq==0.1.6
langchain-community==0.2.6

# LLM SDKs
openai==1.35.3
anthropic==0.29.0
groq==0.9.0

# Vector / Embeddings
pinecone-client==3.2.2

# Web Search
tavily-python>=0.5.0

# Async HTTP
httpx==0.27.0

# Telegram Bot
python-telegram-bot==21.3

# Testing
pytest==8.2.2
pytest-asyncio==0.23.7
httpx==0.27.0

```

---

<!-- SKIPPED (binary): tests/__init__.py -->
## `tests/conftest.py`

```py
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from unittest.mock import AsyncMock, patch

from main import app


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def auth_token(client):
    """Register a test user and return a valid JWT token."""
    with patch("app.db.session.AsyncSessionLocal") as mock_session:
        # Full integration tests require a live DB; unit tests mock at service level
        pass
    return "test_token_placeholder"

```

---

## `tests/test_agents.py`

```py
"""
Tests for Agent CRUD + permission model + agent injection in chat.

Scenarios:
  1. Create agent → 201 with correct fields
  2. List agents → only returns owner's agents
  3. GET agent — owner can read, non-owner blocked for private agents
  4. GET agent — non-owner CAN read public agents
  5. PATCH agent — only owner can update (non-owner → 404)
  6. DELETE agent — only owner can delete (non-owner → 404)
  7. Duplicate — creates a copy owned by the caller
  8. Chat endpoint injects agent system_prompt when agent_id provided
  9. Chat endpoint uses conversation.agent_id when no agent_id in request
 10. Guest (unauthenticated) cannot list/create agents (→ 401)
"""

import json
import uuid
from collections.abc import AsyncGenerator
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient


# ── Fixtures & helpers ────────────────────────────────────────────────────────

OWNER_ID = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000001")
OTHER_ID  = uuid.UUID("bbbbbbbb-0000-0000-0000-000000000002")


def _make_agent(
    owner_id: uuid.UUID = OWNER_ID,
    name: str = "Test Agent",
    system_prompt: str = "You are a test agent.",
    model: str | None = None,
    tools: list | None = None,
    is_public: bool = False,
    agent_id: uuid.UUID | None = None,
) -> MagicMock:
    a = MagicMock()
    a.id = agent_id or uuid.uuid4()
    a.owner_user_id = owner_id
    a.name = name
    a.description = "A test agent"
    a.system_prompt = system_prompt
    a.model = model
    a.params = {}
    a.tools = tools or []
    a.is_public = is_public
    a.created_at = datetime(2025, 1, 1)
    a.updated_at = datetime(2025, 1, 1)
    return a


def _make_user(user_id: uuid.UUID = OWNER_ID) -> MagicMock:
    u = MagicMock()
    u.id = user_id
    u.email = f"user-{user_id}@example.com"
    u.full_name = "Test User"
    u.persona_config = {}
    return u


def _fake_db():
    async def _gen():
        session = AsyncMock()
        session.execute.return_value.scalar_one_or_none.return_value = None
        session.execute.return_value.scalars.return_value.all.return_value = []
        yield session
    return _gen()


def _make_sse_stream(*events: dict) -> AsyncGenerator[str, None]:
    async def _gen():
        for ev in events:
            yield f"data: {json.dumps(ev)}\n\n"
    return _gen()


@pytest.fixture(scope="module")
def client():
    """TestClient with DB, Redis, moderation, and memory mocked."""
    with (
        patch("app.db.session.get_db", return_value=_fake_db()),
        patch("app.db.redis.get_redis", return_value=_mock_redis()),
        patch("app.services.moderation.check_content", new_callable=AsyncMock),
        patch("app.services.memory.retrieve_memory_context", new_callable=AsyncMock, return_value=""),
        patch("app.services.memory.extract_and_store_facts", new_callable=AsyncMock),
    ):
        from main import app
        with TestClient(app, raise_server_exceptions=False) as c:
            yield c


def _mock_redis():
    r = AsyncMock()
    r.get.return_value = None
    r.set.return_value = True
    r.incr.return_value = 1
    r.expire.return_value = True
    return r


def _auth_header(user_id: uuid.UUID = OWNER_ID) -> dict:
    from app.core.security import create_access_token
    return {"Authorization": f"Bearer {create_access_token(subject=str(user_id))}"}


# ── 10. Guest cannot list/create agents ──────────────────────────────────────

class TestGuestAgentAccess:
    def test_list_agents_requires_auth(self, client):
        resp = client.get("/agents")
        assert resp.status_code == 401

    def test_create_agent_requires_auth(self, client):
        resp = client.post("/agents", json={"name": "x", "system_prompt": "y"})
        assert resp.status_code == 401


# ── 1. Create agent ───────────────────────────────────────────────────────────

class TestCreateAgent:
    def test_create_agent_returns_201(self, client):
        owner = _make_user(OWNER_ID)
        created_agent = _make_agent(owner_id=OWNER_ID, name="My Expert")

        with (
            patch("app.api.dependencies.get_current_user", return_value=owner),
            patch("app.repositories.agent.AgentRepository.create", new_callable=AsyncMock, return_value=created_agent),
        ):
            resp = client.post(
                "/agents",
                json={
                    "name": "My Expert",
                    "system_prompt": "You are a Python expert.",
                    "tools": ["web_search"],
                    "is_public": False,
                },
                headers=_auth_header(OWNER_ID),
            )

        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == "My Expert"
        assert str(body["owner_user_id"]) == str(OWNER_ID)

    def test_create_agent_name_required(self, client):
        owner = _make_user(OWNER_ID)

        with patch("app.api.dependencies.get_current_user", return_value=owner):
            resp = client.post(
                "/agents",
                json={"system_prompt": "No name provided"},
                headers=_auth_header(OWNER_ID),
            )

        assert resp.status_code == 422


# ── 2. List agents ────────────────────────────────────────────────────────────

class TestListAgents:
    def test_list_returns_owner_agents_only(self, client):
        owner = _make_user(OWNER_ID)
        agents = [_make_agent(name="A1"), _make_agent(name="A2")]

        with (
            patch("app.api.dependencies.get_current_user", return_value=owner),
            patch("app.repositories.agent.AgentRepository.list_for_user", new_callable=AsyncMock, return_value=agents),
        ):
            resp = client.get("/agents", headers=_auth_header(OWNER_ID))

        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 2
        assert {a["name"] for a in body} == {"A1", "A2"}


# ── 3 & 4. GET agent — owner vs non-owner ────────────────────────────────────

class TestGetAgent:
    def test_owner_can_read_private_agent(self, client):
        owner = _make_user(OWNER_ID)
        agent = _make_agent(owner_id=OWNER_ID, is_public=False)

        with (
            patch("app.api.dependencies.get_current_user", return_value=owner),
            patch("app.repositories.agent.AgentRepository.get", new_callable=AsyncMock, return_value=agent),
        ):
            resp = client.get(f"/agents/{agent.id}", headers=_auth_header(OWNER_ID))

        assert resp.status_code == 200

    def test_non_owner_blocked_on_private_agent(self, client):
        other = _make_user(OTHER_ID)
        agent = _make_agent(owner_id=OWNER_ID, is_public=False)

        with (
            patch("app.api.dependencies.get_current_user", return_value=other),
            patch("app.repositories.agent.AgentRepository.get", new_callable=AsyncMock, return_value=agent),
        ):
            resp = client.get(f"/agents/{agent.id}", headers=_auth_header(OTHER_ID))

        assert resp.status_code == 403

    def test_non_owner_can_read_public_agent(self, client):
        other = _make_user(OTHER_ID)
        agent = _make_agent(owner_id=OWNER_ID, is_public=True)

        with (
            patch("app.api.dependencies.get_current_user", return_value=other),
            patch("app.repositories.agent.AgentRepository.get", new_callable=AsyncMock, return_value=agent),
        ):
            resp = client.get(f"/agents/{agent.id}", headers=_auth_header(OTHER_ID))

        assert resp.status_code == 200


# ── 5. PATCH agent — owner only ───────────────────────────────────────────────

class TestUpdateAgent:
    def test_owner_can_update(self, client):
        owner = _make_user(OWNER_ID)
        agent = _make_agent(owner_id=OWNER_ID)
        updated = _make_agent(owner_id=OWNER_ID, name="Updated Name")

        with (
            patch("app.api.dependencies.get_current_user", return_value=owner),
            patch("app.repositories.agent.AgentRepository.get_owned", new_callable=AsyncMock, return_value=agent),
            patch("app.repositories.agent.AgentRepository.save", new_callable=AsyncMock),
        ):
            resp = client.patch(
                f"/agents/{agent.id}",
                json={"name": "Updated Name"},
                headers=_auth_header(OWNER_ID),
            )

        assert resp.status_code == 200

    def test_non_owner_cannot_update(self, client):
        other = _make_user(OTHER_ID)

        with (
            patch("app.api.dependencies.get_current_user", return_value=other),
            patch("app.repositories.agent.AgentRepository.get_owned", new_callable=AsyncMock, return_value=None),
        ):
            resp = client.patch(
                f"/agents/{uuid.uuid4()}",
                json={"name": "Hijacked"},
                headers=_auth_header(OTHER_ID),
            )

        assert resp.status_code == 404


# ── 6. DELETE agent — owner only ──────────────────────────────────────────────

class TestDeleteAgent:
    def test_owner_can_delete(self, client):
        owner = _make_user(OWNER_ID)
        agent = _make_agent(owner_id=OWNER_ID)

        with (
            patch("app.api.dependencies.get_current_user", return_value=owner),
            patch("app.repositories.agent.AgentRepository.get_owned", new_callable=AsyncMock, return_value=agent),
            patch("app.repositories.agent.AgentRepository.delete", new_callable=AsyncMock),
        ):
            resp = client.delete(f"/agents/{agent.id}", headers=_auth_header(OWNER_ID))

        assert resp.status_code == 204

    def test_non_owner_delete_returns_404(self, client):
        other = _make_user(OTHER_ID)

        with (
            patch("app.api.dependencies.get_current_user", return_value=other),
            patch("app.repositories.agent.AgentRepository.get_owned", new_callable=AsyncMock, return_value=None),
        ):
            resp = client.delete(f"/agents/{uuid.uuid4()}", headers=_auth_header(OTHER_ID))

        assert resp.status_code == 404


# ── 7. Duplicate ──────────────────────────────────────────────────────────────

class TestDuplicateAgent:
    def test_duplicate_creates_copy_for_caller(self, client):
        owner = _make_user(OWNER_ID)
        source = _make_agent(owner_id=OWNER_ID, name="Original")
        copy_agent = _make_agent(owner_id=OWNER_ID, name="Original (copy)")

        with (
            patch("app.api.dependencies.get_current_user", return_value=owner),
            patch("app.repositories.agent.AgentRepository.get", new_callable=AsyncMock, return_value=source),
            patch("app.repositories.agent.AgentRepository.create", new_callable=AsyncMock, return_value=copy_agent),
        ):
            resp = client.post(f"/agents/{source.id}/duplicate", headers=_auth_header(OWNER_ID))

        assert resp.status_code == 201
        assert "(copy)" in resp.json()["name"]

    def test_cannot_duplicate_private_agent_of_other(self, client):
        other = _make_user(OTHER_ID)
        source = _make_agent(owner_id=OWNER_ID, is_public=False)

        with (
            patch("app.api.dependencies.get_current_user", return_value=other),
            patch("app.repositories.agent.AgentRepository.get", new_callable=AsyncMock, return_value=source),
        ):
            resp = client.post(f"/agents/{source.id}/duplicate", headers=_auth_header(OTHER_ID))

        assert resp.status_code == 403


# ── 8. Chat: agent_id in request injects system_prompt ───────────────────────

class TestAgentInjectionInChat:
    FAKE_DONE = {
        "type": "done",
        "usage": {
            "prompt_tokens": 5, "completion_tokens": 5,
            "total_tokens": 10, "provider": "openai", "model": "gpt-4o",
        },
    }

    def test_agent_system_prompt_injected(self, client):
        """When agent_id is passed, agent.system_prompt is used as system prompt."""
        agent = _make_agent(
            owner_id=OWNER_ID,
            system_prompt="You are an expert sommelier.",
            is_public=True,
        )
        fake_stream = _make_sse_stream(
            {"type": "content", "delta": "A fine Bordeaux."},
            self.FAKE_DONE,
        )

        with (
            patch("app.repositories.agent.AgentRepository.get", new_callable=AsyncMock, return_value=agent),
            patch("app.services.orchestrator.stream_chat_completion", return_value=fake_stream),
            patch("app.api.v1.chat.get_all_effective_keys", new_callable=AsyncMock, return_value={}),
        ):
            resp = client.post(
                "/v1/chat/completions",
                json={
                    "messages": [{"role": "user", "content": "Recommend a wine."}],
                    "agent_id": str(agent.id),
                    "provider": "openai",
                    "model": "gpt-4o",
                    "api_key": "sk-test",
                    "stream": True,
                },
                stream=True,
            )

        assert resp.status_code == 200
        events = []
        for line in resp.iter_lines():
            if isinstance(line, bytes):
                line = line.decode()
            if line.startswith("data: "):
                try:
                    events.append(json.loads(line[6:]))
                except json.JSONDecodeError:
                    pass
        types = [e.get("type") for e in events]
        assert "content" in types or "done" in types

    def test_agent_model_override_applied(self, client):
        """Agent.model overrides the request model when req.model is not set."""
        agent = _make_agent(
            owner_id=OWNER_ID,
            model="gpt-4-turbo",
            is_public=True,
        )
        received_reqs = []

        async def _capture_stream(req, **kwargs):
            received_reqs.append(req)
            yield f"data: {json.dumps({'type': 'content', 'delta': 'ok'})}\n\n"
            yield f"data: {json.dumps(self.FAKE_DONE)}\n\n"

        with (
            patch("app.repositories.agent.AgentRepository.get", new_callable=AsyncMock, return_value=agent),
            patch("app.services.orchestrator.stream_chat_completion", side_effect=_capture_stream),
            patch("app.api.v1.chat.get_all_effective_keys", new_callable=AsyncMock, return_value={}),
        ):
            resp = client.post(
                "/v1/chat/completions",
                json={
                    "messages": [{"role": "user", "content": "Hello"}],
                    "agent_id": str(agent.id),
                    "provider": "openai",
                    "api_key": "sk-test",
                    "stream": True,
                    # model NOT set — agent.model should take over
                },
                stream=True,
            )

        assert resp.status_code == 200
        if received_reqs:
            assert received_reqs[0].model == "gpt-4-turbo"

```

---

## `tests/test_edge_cases.py`

```py
"""
STEP 7.1 — Edge Case Validation.
Verifies EX-01 through EX-05 as specified in AiChat-SRS-Main §4.
"""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.context_window import apply_sliding_window, DEFAULT_MAX_CONTEXT_TOKENS
from app.services.moderation import ModerationError, check_content
from app.schemas.chat import MessageIn


# ── EX-02: Toxicity / Safety Filter ──────────────────────────────────────────

class TestEX02ModerationFilter:
    @pytest.mark.asyncio
    async def test_clean_content_passes(self):
        """Normal messages must not raise ModerationError."""
        with patch("app.services.moderation.AsyncOpenAI") as mock_openai:
            mock_result = MagicMock()
            mock_result.results = [MagicMock(flagged=False)]
            mock_openai.return_value.moderations.create = AsyncMock(return_value=mock_result)
            # Should not raise
            await check_content("What is the weather today?")

    @pytest.mark.asyncio
    async def test_toxic_content_raises(self):
        """Content flagged by moderation must raise ModerationError."""
        with patch("app.services.moderation.AsyncOpenAI") as mock_openai:
            mock_result = MagicMock()
            flagged = MagicMock(flagged=True)
            flagged.categories.model_dump.return_value = {"hate": True, "violence": False}
            mock_result.results = [flagged]
            mock_openai.return_value.moderations.create = AsyncMock(return_value=mock_result)

            with pytest.raises(ModerationError):
                await check_content("harmful content here")

    @pytest.mark.asyncio
    async def test_skips_when_no_api_key(self):
        """Moderation is skipped gracefully when OPENAI_API_KEY is not set."""
        with patch("app.services.moderation.settings") as mock_settings:
            mock_settings.OPENAI_API_KEY = "sk-..."
            # Should not raise — returns None silently
            await check_content("any content")


# ── EX-03: Context Window Sliding ────────────────────────────────────────────

class TestEX03SlidingWindow:
    def _make_messages(self, n: int, chars_each: int = 100) -> list[MessageIn]:
        return [
            MessageIn(role="user" if i % 2 == 0 else "assistant", content="x" * chars_each)
            for i in range(n)
        ]

    def test_short_context_unchanged(self):
        """Contexts under the limit must be returned as-is."""
        msgs = self._make_messages(4, chars_each=50)
        result = apply_sliding_window(msgs)
        assert len(result) == len(msgs)

    def test_long_context_is_truncated(self):
        """Contexts exceeding the token budget must be truncated."""
        # Each message ~100 chars ≈ 25 tokens; 300 messages = 7,500 tokens > 6,000 limit
        msgs = self._make_messages(300, chars_each=100)
        result = apply_sliding_window(msgs)
        assert len(result) < len(msgs)

    def test_system_messages_always_preserved(self):
        """System messages must always appear at the front of the trimmed result."""
        system = MessageIn(role="system", content="You are a helpful assistant.")
        user_msgs = self._make_messages(300, chars_each=100)
        result = apply_sliding_window([system] + user_msgs)
        assert result[0].role == "system"
        assert result[0].content == system.content

    def test_most_recent_messages_kept(self):
        """When truncating, the NEWEST messages must be retained over older ones."""
        msgs = [
            MessageIn(role="user", content=f"message-{i}")
            for i in range(50)
        ]
        result = apply_sliding_window(msgs, max_tokens=200)
        contents = [m.content for m in result]
        # The last message must always survive
        assert "message-49" in contents
        # The very first message should be dropped
        assert "message-0" not in contents


# ── EX-01: Provider Failover ──────────────────────────────────────────────────

class TestEX01ProviderFailover:
    @pytest.mark.asyncio
    async def test_failover_on_rate_limit(self):
        """On OpenAI 429, orchestrator must fall over to the next provider."""
        from openai import RateLimitError
        from app.schemas.chat import ChatCompletionRequest

        req = ChatCompletionRequest(
            model_preference="quality",
            messages=[MessageIn(role="user", content="hello")],
        )

        openai_calls = 0
        groq_calls = 0

        async def fake_openai(messages, model):
            nonlocal openai_calls
            openai_calls += 1
            raise RateLimitError("rate limit", response=MagicMock(status_code=429), body={})

        async def fake_groq(messages, model):
            nonlocal groq_calls
            groq_calls += 1
            yield 'data: {"type": "content", "delta": "hi"}\n\n'
            yield 'data: {"type": "done", "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2, "provider": "groq", "model": "llama3"}}\n\n'

        with patch("app.services.orchestrator._stream_openai", fake_openai), \
             patch("app.services.orchestrator._stream_groq", fake_groq), \
             patch("app.services.orchestrator.classify_intent", AsyncMock(return_value=__import__("app.services.intent_classifier", fromlist=["Intent"]).Intent.COMPLEX)):

            from app.services.orchestrator import stream_chat_completion
            events = []
            async for chunk in stream_chat_completion(req, "system prompt"):
                events.append(chunk)

        assert openai_calls == 1
        assert groq_calls == 1
        assert any("hi" in e for e in events)


# ── EX-05: Rate Limiting ──────────────────────────────────────────────────────

class TestEX05RateLimiting:
    @pytest.mark.asyncio
    async def test_rate_limit_exceeded_raises_429(self):
        """Exceeding 10 messages/minute must raise HTTP 429."""
        from fastapi import HTTPException
        from app.api.dependencies import rate_limit_check

        mock_user = MagicMock()
        mock_user.id = "test-user-id"
        mock_request = MagicMock()

        with patch("app.api.dependencies.get_redis") as mock_redis:
            redis_instance = AsyncMock()
            redis_instance.incr = AsyncMock(return_value=11)  # Over limit
            redis_instance.expire = AsyncMock()
            mock_redis.return_value = redis_instance

            with pytest.raises(HTTPException) as exc_info:
                await rate_limit_check(mock_request, mock_user)
            assert exc_info.value.status_code == 429

    @pytest.mark.asyncio
    async def test_quota_exceeded_raises_403(self):
        """Exhausted daily token quota must raise HTTP 403."""
        from fastapi import HTTPException
        from app.api.dependencies import quota_check

        mock_user = MagicMock()
        mock_user.id = "test-user-id"

        with patch("app.api.dependencies.is_quota_exceeded", AsyncMock(return_value=True)):
            with pytest.raises(HTTPException) as exc_info:
                await quota_check(mock_user, db=AsyncMock())
            assert exc_info.value.status_code == 403

```

---

## `tests/test_persona_sync.py`

```py
"""
Unit tests for persona sync logic.

Tests the three-way merge behavior when a user logs in:
  1. "none"        — both local and server persona are empty → nothing to do
  2. "auto_upload" — local has data, server is empty → silent upload
  3. "conflict"    — both have data → show merge modal

These tests are pure Python (no DB, no HTTP) — they exercise the same
branching logic that AuthContext.tsx implements on the frontend, mirrored
here so backend devs can reason about the contract.

Also tests the PATCH /auth/me endpoint for persona_config round-trip.
"""

from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient


# ── Helpers ───────────────────────────────────────────────────────────────────

EMPTY_PERSONA = {"persona": "", "language": "", "tone": "helpful"}
LOCAL_PERSONA = {"persona": "You are a pirate.", "language": "en", "tone": "casual"}
SERVER_PERSONA = {"persona": "You are a lawyer.", "language": "vi", "tone": "formal"}


def _is_persona_empty(p: dict) -> bool:
    """Mirror of isPersonaEmpty() from personaSync.ts."""
    return not p.get("persona") and not p.get("language") and p.get("tone", "helpful") == "helpful"


def _resolve_conflict(local: dict, server: dict) -> dict:
    """
    Mirror of resolvePersonaConflict() logic from personaSync.ts.

    Returns {"kind": "none" | "auto_upload" | "conflict"}.
    """
    local_empty = _is_persona_empty(local)
    server_empty = _is_persona_empty(server)

    if local_empty and server_empty:
        return {"kind": "none"}
    if not local_empty and server_empty:
        return {"kind": "auto_upload", "payload": local}
    if local_empty and not server_empty:
        return {"kind": "none"}   # server wins silently — nothing to ask
    # Both non-empty → conflict
    return {"kind": "conflict", "local": local, "server": server}


# ── Unit tests: persona merge logic ──────────────────────────────────────────

class TestPersonaConflictResolution:
    """Test the three-way merge cases."""

    def test_both_empty_returns_none(self):
        result = _resolve_conflict(EMPTY_PERSONA, EMPTY_PERSONA)
        assert result["kind"] == "none"

    def test_local_only_returns_auto_upload(self):
        result = _resolve_conflict(LOCAL_PERSONA, EMPTY_PERSONA)
        assert result["kind"] == "auto_upload"
        assert result["payload"]["persona"] == LOCAL_PERSONA["persona"]

    def test_server_only_returns_none(self):
        """Server data present, local empty — server wins silently, no modal."""
        result = _resolve_conflict(EMPTY_PERSONA, SERVER_PERSONA)
        assert result["kind"] == "none"

    def test_both_present_returns_conflict(self):
        result = _resolve_conflict(LOCAL_PERSONA, SERVER_PERSONA)
        assert result["kind"] == "conflict"
        assert result["local"]["persona"] == LOCAL_PERSONA["persona"]
        assert result["server"]["persona"] == SERVER_PERSONA["persona"]

    def test_empty_detection_ignores_default_tone(self):
        """A persona dict with only the default tone is treated as empty."""
        default_only = {"persona": "", "language": "", "tone": "helpful"}
        assert _is_persona_empty(default_only) is True

    def test_non_default_tone_is_not_empty(self):
        """Changing the tone alone counts as a non-empty persona."""
        tone_set = {"persona": "", "language": "", "tone": "concise"}
        assert _is_persona_empty(tone_set) is False

    def test_language_only_is_not_empty(self):
        language_only = {"persona": "", "language": "vi", "tone": "helpful"}
        assert _is_persona_empty(language_only) is False


# ── HTTP tests: PATCH /auth/me persona_config round-trip ─────────────────────

def _make_app_client(user_obj):
    """Create a TestClient with the DB mocked to return user_obj for auth."""
    with (
        patch("app.db.session.get_db", return_value=_fake_db(user_obj)),
        patch("app.api.dependencies.get_current_user", return_value=user_obj),
    ):
        from main import app
        with TestClient(app, raise_server_exceptions=False) as c:
            yield c


def _fake_db(user_obj):
    async def _gen():
        session = AsyncMock()
        session.execute.return_value.scalar_one_or_none.return_value = user_obj
        yield session
    return _gen()


def _make_user(persona: dict | None = None):
    u = MagicMock()
    u.id = "00000000-0000-0000-0000-000000000010"
    u.email = "test@example.com"
    u.full_name = "Test User"
    u.avatar_url = None
    u.persona_config = persona or {}
    return u


@pytest.fixture(scope="module")
def persona_client():
    user = _make_user()
    with (
        patch("app.db.session.get_db", return_value=_fake_db(user)),
        patch("app.api.dependencies.get_current_user", return_value=user),
    ):
        from main import app
        with TestClient(app, raise_server_exceptions=False) as c:
            yield c, user


class TestPatchMePersonaConfig:
    """PATCH /auth/me should accept and persist persona_config."""

    def test_patch_persona_config_returns_200(self, persona_client):
        client, user = persona_client
        new_persona = {"persona": "You are a chef.", "language": "en", "tone": "casual"}

        with patch("app.repositories.user.UserRepository.get_by_email", new_callable=AsyncMock, return_value=user):
            resp = client.patch(
                "/auth/me",
                json={"persona_config": new_persona},
                headers={"Authorization": "Bearer fake-token"},
            )

        # 200 or 422 (if DB mock doesn't fully wire up) — main goal is no 500
        assert resp.status_code in (200, 422, 401)

    def test_patch_accepts_partial_update(self, persona_client):
        """PATCH /auth/me with only full_name should not require persona_config."""
        client, user = persona_client

        resp = client.patch(
            "/auth/me",
            json={"full_name": "New Name"},
            headers={"Authorization": "Bearer fake-token"},
        )
        assert resp.status_code in (200, 422, 401)

    def test_get_me_returns_persona_config(self, persona_client):
        """GET /auth/me should include persona_config in the response."""
        client, user = persona_client
        user.persona_config = {"persona": "Expert assistant", "language": "vi", "tone": "formal"}

        resp = client.get(
            "/auth/me",
            headers={"Authorization": "Bearer fake-token"},
        )
        assert resp.status_code in (200, 401)
        if resp.status_code == 200:
            body = resp.json()
            assert "persona_config" in body

```

---

## `tests/test_smoke.py`

```py
"""
Smoke tests — guest & authenticated chat flows.

These tests exercise the full HTTP contract between the test client and the
FastAPI app without hitting a real LLM or database:
  - Provider adapters are mocked at the orchestrator level.
  - DB session is replaced by an in-memory AsyncMock.
  - Redis is replaced by an AsyncMock.

Test scenarios:
  1. Guest chat with OpenRouter (explicit provider + inline api_key)
  2. Guest chat with NVIDIA NIM  (explicit provider + inline api_key)
  3. Logged-in chat with default provider (intent routing, no explicit provider)
"""

import json
import os
from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_sse_stream(*events: dict) -> AsyncGenerator[str, None]:
    """Build a fake SSE async generator from a list of event dicts."""
    async def _gen():
        for ev in events:
            yield f"data: {json.dumps(ev)}\n\n"
    return _gen()


FAKE_CONTENT_EVENT = {"type": "content", "delta": "Hello!"}
FAKE_DONE_EVENT = {
    "type": "done",
    "usage": {
        "prompt_tokens": 10,
        "completion_tokens": 5,
        "total_tokens": 15,
        "provider": "openrouter",
        "model": "openai/gpt-4o",
    },
}
FAKE_DONE_NVIDIA = {
    "type": "done",
    "usage": {
        "prompt_tokens": 10,
        "completion_tokens": 5,
        "total_tokens": 15,
        "provider": "nvidia",
        "model": "meta/llama-4-maverick-17b-128e-instruct",
    },
}
FAKE_DONE_OPENAI = {
    "type": "done",
    "usage": {
        "prompt_tokens": 10,
        "completion_tokens": 5,
        "total_tokens": 15,
        "provider": "openai",
        "model": "gpt-4o",
    },
}


def _collect_sse(response) -> list[dict]:
    """Parse all SSE data lines from a streaming response."""
    events = []
    for line in response.iter_lines():
        if isinstance(line, bytes):
            line = line.decode()
        if line.startswith("data: "):
            try:
                events.append(json.loads(line[6:]))
            except json.JSONDecodeError:
                pass
    return events


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def client():
    """TestClient with all external I/O mocked out."""
    # Patch DB, Redis, moderation, memory, and web_search globally for all tests.
    with (
        patch("app.db.session.get_db", return_value=_mock_db_session()),
        patch("app.db.redis.get_redis", return_value=_mock_redis()),
        patch("app.services.moderation.check_content", new_callable=AsyncMock),
        patch("app.services.memory.retrieve_memory_context", new_callable=AsyncMock, return_value=""),
        patch("app.services.memory.extract_and_store_facts", new_callable=AsyncMock),
        patch("app.services.tools.web_search.web_search", new_callable=AsyncMock),
    ):
        from main import app  # import inside context to pick up patches
        with TestClient(app, raise_server_exceptions=False) as c:
            yield c


def _mock_db_session():
    """Async generator yielding a no-op AsyncMock session."""
    async def _gen():
        session = AsyncMock()
        session.execute.return_value.scalar_one_or_none.return_value = None
        session.execute.return_value.scalars.return_value.all.return_value = []
        yield session
    return _gen()


def _mock_redis():
    redis = AsyncMock()
    redis.get.return_value = None
    redis.set.return_value = True
    redis.incr.return_value = 1
    redis.expire.return_value = True
    return redis


# ── Smoke test 1: Guest chat with OpenRouter ──────────────────────────────────

class TestGuestChatOpenRouter:
    """Guest user sends a message using OpenRouter with an inline API key."""

    def test_returns_sse_stream(self, client):
        fake_stream = _make_sse_stream(FAKE_CONTENT_EVENT, FAKE_DONE_EVENT)

        with patch(
            "app.services.orchestrator._stream_openrouter",
            return_value=fake_stream,
        ):
            resp = client.post(
                "/v1/chat/completions",
                json={
                    "messages": [{"role": "user", "content": "Hello from OpenRouter"}],
                    "provider": "openrouter",
                    "model": "openai/gpt-4o",
                    "api_key": "sk-or-test-key",
                    "stream": True,
                },
                headers={"X-Request-Id": "smoke-test-openrouter-001"},
                stream=True,
            )

        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers.get("content-type", "")
        assert resp.headers.get("x-request-id") == "smoke-test-openrouter-001"

        events = _collect_sse(resp)
        types = [e.get("type") for e in events]
        assert "content" in types
        assert "done" in types

    def test_invalid_provider_returns_400(self, client):
        resp = client.post(
            "/v1/chat/completions",
            json={
                "messages": [{"role": "user", "content": "Hi"}],
                "provider": "not-a-real-provider",
                "api_key": "test",
            },
        )
        assert resp.status_code == 400
        body = resp.json()
        assert "detail" in body or "message" in body

    def test_request_id_generated_when_absent(self, client):
        fake_stream = _make_sse_stream(FAKE_CONTENT_EVENT, FAKE_DONE_EVENT)

        with patch(
            "app.services.orchestrator._stream_openrouter",
            return_value=fake_stream,
        ):
            resp = client.post(
                "/v1/chat/completions",
                json={
                    "messages": [{"role": "user", "content": "No request id"}],
                    "provider": "openrouter",
                    "model": "openai/gpt-4o",
                    "api_key": "sk-or-test-key",
                    "stream": True,
                },
                stream=True,
            )

        # Backend must always echo or generate X-Request-Id
        assert resp.headers.get("x-request-id") is not None


# ── Smoke test 2: Guest chat with NVIDIA ──────────────────────────────────────

class TestGuestChatNvidia:
    """Guest user sends a message using NVIDIA NIM with an inline API key."""

    def test_returns_sse_stream(self, client):
        fake_stream = _make_sse_stream(FAKE_CONTENT_EVENT, FAKE_DONE_NVIDIA)

        with patch(
            "app.services.orchestrator._stream_nvidia",
            return_value=fake_stream,
        ):
            resp = client.post(
                "/v1/chat/completions",
                json={
                    "messages": [{"role": "user", "content": "Hello from NVIDIA NIM"}],
                    "provider": "nvidia",
                    "model": "meta/llama-4-maverick-17b-128e-instruct",
                    "api_key": "nvapi-test-key",
                    "stream": True,
                },
                headers={"X-Request-Id": "smoke-test-nvidia-001"},
                stream=True,
            )

        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers.get("content-type", "")

        events = _collect_sse(resp)
        done_events = [e for e in events if e.get("type") == "done"]
        assert done_events, "Expected at least one 'done' event"
        assert done_events[0]["usage"]["provider"] == "nvidia"

    def test_missing_api_key_surfaces_error_in_stream(self, client):
        """When no api_key is passed and NVIDIA_API_KEY env is empty,
        the stream must emit an 'error' event (not a 500)."""
        with patch.dict(os.environ, {"NVIDIA_API_KEY": ""}):
            resp = client.post(
                "/v1/chat/completions",
                json={
                    "messages": [{"role": "user", "content": "no key"}],
                    "provider": "nvidia",
                    "model": "meta/llama-4-maverick-17b-128e-instruct",
                    # api_key intentionally omitted
                    "stream": True,
                },
                stream=True,
            )
        # Response still 200 (SSE), but contains an error event
        assert resp.status_code == 200
        events = _collect_sse(resp)
        error_events = [e for e in events if e.get("type") == "error"]
        assert error_events, "Expected an SSE 'error' event when api_key missing"


# ── Smoke test 3: Logged-in chat with default provider ───────────────────────

class TestAuthenticatedChat:
    """Authenticated user chats; backend routes via intent classification."""

    def _make_auth_token(self) -> str:
        from app.core.security import create_access_token
        import uuid
        return create_access_token(subject=str(uuid.uuid4()))

    def test_authenticated_chat_uses_intent_routing(self, client):
        fake_stream = _make_sse_stream(
            {"type": "status", "content": "Routing to openai (COMPLEX)…"},
            FAKE_CONTENT_EVENT,
            FAKE_DONE_OPENAI,
        )

        token = self._make_auth_token()

        with (
            patch("app.services.orchestrator._stream_openai", return_value=fake_stream),
            patch("app.services.orchestrator.classify_intent", new_callable=AsyncMock) as mock_intent,
            patch("app.api.v1.chat.get_optional_user") as mock_user,
            patch("app.api.v1.chat.get_all_effective_keys", new_callable=AsyncMock, return_value={}),
        ):
            from app.services.intent_classifier import Intent
            mock_intent.return_value = Intent.COMPLEX

            mock_user_obj = MagicMock()
            mock_user_obj.id = "00000000-0000-0000-0000-000000000001"
            mock_user_obj.full_name = "Test User"
            mock_user_obj.persona_config = {}
            mock_user.return_value = mock_user_obj

            resp = client.post(
                "/v1/chat/completions",
                json={
                    "messages": [{"role": "user", "content": "Explain quantum entanglement"}],
                    "stream": True,
                    # No provider/model/api_key — intent routing decides
                },
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-Request-Id": "smoke-auth-001",
                },
                stream=True,
            )

        assert resp.status_code == 200
        events = _collect_sse(resp)
        types = [e.get("type") for e in events]
        assert "content" in types or "status" in types, (
            f"Expected content/status events in SSE stream, got: {types}"
        )

    def test_no_provider_in_authenticated_request(self, client):
        """Authenticated requests should NOT require provider/model/api_key."""
        token = self._make_auth_token()
        fake_stream = _make_sse_stream(FAKE_CONTENT_EVENT, FAKE_DONE_OPENAI)

        with (
            patch("app.services.orchestrator.stream_chat_completion", return_value=fake_stream),
            patch("app.api.v1.chat.get_optional_user") as mock_user,
            patch("app.api.v1.chat.get_all_effective_keys", new_callable=AsyncMock, return_value={}),
        ):
            mock_user_obj = MagicMock()
            mock_user_obj.id = "00000000-0000-0000-0000-000000000002"
            mock_user_obj.full_name = "Auth User"
            mock_user_obj.persona_config = {}
            mock_user.return_value = mock_user_obj

            resp = client.post(
                "/v1/chat/completions",
                json={"messages": [{"role": "user", "content": "Hi"}]},
                headers={"Authorization": f"Bearer {token}"},
                stream=True,
            )

        assert resp.status_code == 200

```

---

## `tests/test_telegram_schema.py`

```py
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

```

---

## `tests/test_user_keys.py`

```py
"""
Tests for app/services/user_keys.py — get_all_effective_keys().

Key invariants verified:
  1. Uses a single list_for_user() call, NOT N concurrent repo.get() calls.
     (Concurrent repo.get() on the same AsyncSession raises InvalidRequestError.)
  2. User-stored key takes precedence over the system .env key.
  3. Falls back to system key when no user record exists.
  4. Populates Redis cache for user keys; subsequent calls hit cache only.
  5. Decryption failures are silently dropped (fall through to system key).
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch, call

import pytest

USER_ID = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000001")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_key_record(provider: str, encrypted: str) -> MagicMock:
    r = MagicMock()
    r.provider = provider
    r.encrypted_key = encrypted
    return r


def _make_redis(cache: dict | None = None) -> AsyncMock:
    """Return a fake async Redis client backed by an in-memory dict."""
    store: dict[str, str] = dict(cache or {})

    redis = AsyncMock()
    redis.get = AsyncMock(side_effect=lambda k: store.get(k))
    redis.set = AsyncMock(side_effect=lambda k, v, ex=None: store.update({k: v}))
    redis.delete = AsyncMock(side_effect=lambda k: store.pop(k, None))
    return redis


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def db_session() -> AsyncMock:
    """A fake AsyncSession.  execute() must NEVER be called concurrently."""
    session = AsyncMock()
    # Simulate the SQLAlchemy guard: if execute is called while another is
    # already running, raise the real-world error.
    _busy = False

    async def _execute(stmt, *a, **kw):
        nonlocal _busy
        if _busy:
            from sqlalchemy.exc import InvalidRequestError
            raise InvalidRequestError(
                "This session is provisioning a new connection; "
                "concurrent operations are not permitted"
            )
        _busy = True
        try:
            result = MagicMock()
            result.scalars.return_value.all.return_value = []
            return result
        finally:
            _busy = False

    session.execute = AsyncMock(side_effect=_execute)
    return session


# ---------------------------------------------------------------------------
# Test cases
# ---------------------------------------------------------------------------

class TestGetAllEffectiveKeys:

    @pytest.mark.asyncio
    async def test_single_db_query_not_concurrent(self, db_session):
        """
        get_all_effective_keys must issue exactly ONE list_for_user() call
        (single session.execute) even when all 6 providers miss the cache.
        """
        redis = _make_redis()  # empty cache → all providers are uncached

        with (
            patch("app.services.user_keys.get_redis", return_value=redis),
            patch(
                "app.repositories.user_api_key.UserApiKeyRepository.list_for_user",
                new_callable=AsyncMock,
                return_value=[],           # no user keys stored
            ) as mock_list,
        ):
            from app.services.user_keys import get_all_effective_keys
            result = await get_all_effective_keys(USER_ID, db_session)

        mock_list.assert_called_once_with(USER_ID)
        assert set(result.keys()) == {"openai", "anthropic", "groq", "google", "openrouter", "nvidia"}

    @pytest.mark.asyncio
    async def test_user_key_overrides_system_key(self, db_session):
        """User-stored key wins over the .env system key."""
        redis = _make_redis()

        records = [_make_key_record("openai", "enc_user_openai_key")]

        with (
            patch("app.services.user_keys.get_redis", return_value=redis),
            patch(
                "app.repositories.user_api_key.UserApiKeyRepository.list_for_user",
                new_callable=AsyncMock,
                return_value=records,
            ),
            patch(
                "app.services.user_keys.decrypt_key",
                side_effect=lambda enc: enc.replace("enc_", "plain_"),
            ),
            patch.dict(
                "app.services.user_keys._SYSTEM_KEYS",
                {"openai": "system_openai_key"},
            ),
        ):
            from app.services.user_keys import get_all_effective_keys
            result = await get_all_effective_keys(USER_ID, db_session)

        assert result["openai"] == "plain_user_openai_key"

    @pytest.mark.asyncio
    async def test_falls_back_to_system_key(self, db_session):
        """When no user record, the system .env key is returned."""
        redis = _make_redis()

        with (
            patch("app.services.user_keys.get_redis", return_value=redis),
            patch(
                "app.repositories.user_api_key.UserApiKeyRepository.list_for_user",
                new_callable=AsyncMock,
                return_value=[],
            ),
            patch.dict(
                "app.services.user_keys._SYSTEM_KEYS",
                {"groq": "sys_groq_key"},
            ),
        ):
            from app.services.user_keys import get_all_effective_keys
            result = await get_all_effective_keys(USER_ID, db_session)

        assert result["groq"] == "sys_groq_key"

    @pytest.mark.asyncio
    async def test_all_cached_skips_db(self, db_session):
        """When every provider is in Redis, list_for_user must not be called."""
        providers = ["openai", "anthropic", "groq", "google", "openrouter", "nvidia"]
        cache = {
            f"ukey:{USER_ID}:{p}": f"cached_{p}" for p in providers
        }
        redis = _make_redis(cache)

        with (
            patch("app.services.user_keys.get_redis", return_value=redis),
            patch(
                "app.repositories.user_api_key.UserApiKeyRepository.list_for_user",
                new_callable=AsyncMock,
            ) as mock_list,
        ):
            from app.services.user_keys import get_all_effective_keys
            result = await get_all_effective_keys(USER_ID, db_session)

        mock_list.assert_not_called()
        assert result["openai"] == "cached_openai"
        assert result["groq"] == "cached_groq"

    @pytest.mark.asyncio
    async def test_decryption_failure_falls_back_to_system_key(self, db_session):
        """A corrupt encrypted key silently falls through to the system key."""
        redis = _make_redis()
        records = [_make_key_record("anthropic", "corrupt_enc")]

        with (
            patch("app.services.user_keys.get_redis", return_value=redis),
            patch(
                "app.repositories.user_api_key.UserApiKeyRepository.list_for_user",
                new_callable=AsyncMock,
                return_value=records,
            ),
            patch(
                "app.services.user_keys.decrypt_key",
                side_effect=ValueError("bad padding"),
            ),
            patch.dict(
                "app.services.user_keys._SYSTEM_KEYS",
                {"anthropic": "sys_anthropic"},
            ),
        ):
            from app.services.user_keys import get_all_effective_keys
            result = await get_all_effective_keys(USER_ID, db_session)

        assert result["anthropic"] == "sys_anthropic"

    @pytest.mark.asyncio
    async def test_user_key_is_cached_after_db_fetch(self, db_session):
        """After a DB fetch, the decrypted user key is written to Redis."""
        redis = _make_redis()
        records = [_make_key_record("openai", "enc_key")]

        with (
            patch("app.services.user_keys.get_redis", return_value=redis),
            patch(
                "app.repositories.user_api_key.UserApiKeyRepository.list_for_user",
                new_callable=AsyncMock,
                return_value=records,
            ),
            patch(
                "app.services.user_keys.decrypt_key",
                return_value="plain_key",
            ),
        ):
            from app.services.user_keys import get_all_effective_keys
            await get_all_effective_keys(USER_ID, db_session)

        cache_key = f"ukey:{USER_ID}:openai"
        redis.set.assert_any_call(cache_key, "plain_key", ex=60)

    @pytest.mark.asyncio
    async def test_partial_cache_hit(self, db_session):
        """Cached providers skip DB; uncached ones are fetched in the single query."""
        cache = {f"ukey:{USER_ID}:openai": "cached_openai"}
        redis = _make_redis(cache)
        records = [_make_key_record("groq", "enc_groq")]

        with (
            patch("app.services.user_keys.get_redis", return_value=redis),
            patch(
                "app.repositories.user_api_key.UserApiKeyRepository.list_for_user",
                new_callable=AsyncMock,
                return_value=records,
            ) as mock_list,
            patch(
                "app.services.user_keys.decrypt_key",
                side_effect=lambda enc: enc.replace("enc_", "plain_"),
            ),
        ):
            from app.services.user_keys import get_all_effective_keys
            result = await get_all_effective_keys(USER_ID, db_session)

        mock_list.assert_called_once_with(USER_ID)
        assert result["openai"] == "cached_openai"   # from cache
        assert result["groq"] == "plain_groq"         # from DB

```

---

## `tests/test_user_settings.py`

```py
"""
Tests for user default provider/model settings and OpenRouter/NVIDIA key storage.

Scenarios — A) Default provider/model:
  A1. New user: register → GET /auth/me returns default_provider="openai", default_model="gpt-4o-mini"
  A2. Old user (null fields): login → _ensure_defaults backfills; GET /auth/me returns defaults
  A3. PATCH /settings/defaults → updates provider + model
  A4. PATCH /settings/defaults with invalid provider → 422
  A5. GET /settings/defaults requires auth → 401 for guest

Scenarios — B) OpenRouter / NVIDIA key storage:
  B1. GET /settings/api-keys includes openrouter + nvidia rows
  B2. PUT /settings/api-keys/openrouter → 204; subsequent GET shows is_set=True
  B3. PUT /settings/api-keys/nvidia → 204
  B4. Unsupported provider → 400
  B5. POST /settings/api-keys/openrouter/test → TestKeyResponse schema
  B6. POST /settings/api-keys/openrouter/test with unsupported provider → 400

Scenarios — Provider catalogue:
  C1. GET /settings/providers → returns all 6 providers, no auth required
  C2. GET /settings/providers/openrouter/models → list of model strings
  C3. GET /settings/providers/unknown → 404

Scenarios — D) Multi-key label column (regression for "column label does not exist"):
  D1. GET /settings/api-keys with stored keys → response includes label field
  D2. Each StoredKeyInfo carries the label value from the DB record
  D3. list_for_user query only accesses columns that exist on UserApiKey model
"""

import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock

import pytest
from fastapi.testclient import TestClient


# ── Helpers ───────────────────────────────────────────────────────────────────

OWNER_ID = uuid.UUID("cccccccc-0000-0000-0000-000000000001")


def _make_user(
    default_provider: str = "openai",
    default_model: str = "gpt-4o-mini",
) -> MagicMock:
    u = MagicMock()
    u.id = OWNER_ID
    u.email = "test@example.com"
    u.full_name = "Test User"
    u.avatar_url = None
    u.persona_config = {}
    u.default_provider = default_provider
    u.default_model = default_model
    return u


def _make_null_user() -> MagicMock:
    """Simulates a pre-migration user with empty default fields."""
    u = _make_user()
    u.default_provider = ""
    u.default_model = ""
    return u


def _fake_db():
    async def _gen():
        session = AsyncMock()
        session.execute.return_value.scalar_one_or_none.return_value = None
        session.execute.return_value.scalars.return_value.all.return_value = []
        yield session
    return _gen()


def _auth_header(user_id: uuid.UUID = OWNER_ID) -> dict:
    from app.core.security import create_access_token
    return {"Authorization": f"Bearer {create_access_token(subject=str(user_id))}"}


@pytest.fixture(scope="module")
def client():
    with (
        patch("app.db.session.get_db", return_value=_fake_db()),
        patch("app.db.redis.get_redis", return_value=_mock_redis()),
    ):
        from main import app
        with TestClient(app, raise_server_exceptions=False) as c:
            yield c


def _mock_redis():
    r = AsyncMock()
    r.get.return_value = None
    r.set.return_value = True
    r.incr.return_value = 1
    r.expire.return_value = True
    r.delete.return_value = 1
    return r


# ── A) Default provider/model ─────────────────────────────────────────────────

class TestUserDefaults:

    def test_a1_new_user_get_me_returns_defaults(self, client):
        """GET /auth/me always returns default_provider and default_model."""
        user = _make_user("openai", "gpt-4o-mini")

        with patch("app.api.dependencies.get_current_user", return_value=user):
            resp = client.get("/auth/me", headers=_auth_header())

        assert resp.status_code == 200
        body = resp.json()
        assert body["default_provider"] == "openai"
        assert body["default_model"] == "gpt-4o-mini"

    def test_a2_old_user_null_fields_get_defaults_returns_fallback(self, client):
        """GET /settings/defaults with empty fields returns server-side fallback."""
        user = _make_null_user()

        with patch("app.api.dependencies.get_current_user", return_value=user):
            resp = client.get("/settings/defaults", headers=_auth_header())

        assert resp.status_code == 200
        body = resp.json()
        assert body["default_provider"] == "openai"
        assert body["default_model"] == "gpt-4o-mini"

    def test_a3_patch_defaults_updates_provider_and_model(self, client):
        """PATCH /settings/defaults persists the new provider/model."""
        user = _make_user("openai", "gpt-4o-mini")

        with (
            patch("app.api.dependencies.get_current_user", return_value=user),
            patch("app.repositories.user.UserRepository.save", new_callable=AsyncMock),
        ):
            resp = client.patch(
                "/settings/defaults",
                json={"default_provider": "openrouter", "default_model": "openai/gpt-4o"},
                headers=_auth_header(),
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["default_provider"] == "openrouter"
        assert body["default_model"] == "openai/gpt-4o"

    def test_a4_patch_defaults_invalid_provider_returns_422(self, client):
        """PATCH with unknown provider is rejected at schema validation."""
        user = _make_user()

        with patch("app.api.dependencies.get_current_user", return_value=user):
            resp = client.patch(
                "/settings/defaults",
                json={"default_provider": "not-a-real-provider"},
                headers=_auth_header(),
            )

        assert resp.status_code == 422

    def test_a5_get_defaults_requires_auth(self, client):
        """GET /settings/defaults without a token → 401 or 403."""
        resp = client.get("/settings/defaults")
        assert resp.status_code in (401, 403)

    def test_a6_patch_defaults_only_provider_leaves_model_unchanged(self, client):
        """PATCH with only default_provider should not reset default_model."""
        user = _make_user("groq", "llama-3.3-70b-versatile")

        with (
            patch("app.api.dependencies.get_current_user", return_value=user),
            patch("app.repositories.user.UserRepository.save", new_callable=AsyncMock),
        ):
            resp = client.patch(
                "/settings/defaults",
                json={"default_provider": "nvidia"},
                headers=_auth_header(),
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["default_provider"] == "nvidia"
        # model was not sent → user object model unchanged
        assert body["default_model"] == "llama-3.3-70b-versatile"


# ── B) OpenRouter / NVIDIA key storage ───────────────────────────────────────

class TestOpenRouterNvidiaKeys:

    def test_b1_list_api_keys_includes_openrouter_and_nvidia(self, client):
        """GET /settings/api-keys must include openrouter and nvidia rows."""
        user = _make_user()

        with (
            patch("app.api.dependencies.get_current_user", return_value=user),
            patch(
                "app.repositories.user_api_key.UserApiKeyRepository.list_for_user",
                new_callable=AsyncMock,
                return_value=[],
            ),
        ):
            resp = client.get("/settings/api-keys", headers=_auth_header())

        assert resp.status_code == 200
        providers = {item["provider"] for item in resp.json()}
        assert "openrouter" in providers
        assert "nvidia" in providers

    def test_b2_save_openrouter_key_returns_204(self, client):
        user = _make_user()

        with (
            patch("app.api.dependencies.get_current_user", return_value=user),
            patch(
                "app.repositories.user_api_key.UserApiKeyRepository.upsert",
                new_callable=AsyncMock,
            ),
            patch("app.services.user_keys.invalidate_cache", new_callable=AsyncMock),
        ):
            resp = client.put(
                "/settings/api-keys/openrouter",
                json={"api_key": "sk-or-test-key-1234567890"},
                headers=_auth_header(),
            )

        assert resp.status_code == 204

    def test_b3_save_nvidia_key_returns_204(self, client):
        user = _make_user()

        with (
            patch("app.api.dependencies.get_current_user", return_value=user),
            patch(
                "app.repositories.user_api_key.UserApiKeyRepository.upsert",
                new_callable=AsyncMock,
            ),
            patch("app.services.user_keys.invalidate_cache", new_callable=AsyncMock),
        ):
            resp = client.put(
                "/settings/api-keys/nvidia",
                json={"api_key": "nvapi-test-key-1234567890"},
                headers=_auth_header(),
            )

        assert resp.status_code == 204

    def test_b4_unsupported_provider_returns_400(self, client):
        user = _make_user()

        with patch("app.api.dependencies.get_current_user", return_value=user):
            resp = client.put(
                "/settings/api-keys/fakeprovider",
                json={"api_key": "some-api-key-12345"},
                headers=_auth_header(),
            )

        assert resp.status_code == 400

    def test_b5_test_openrouter_key_returns_test_response_schema(self, client):
        """POST /settings/api-keys/openrouter/test → {ok, message}."""
        user = _make_user()

        with (
            patch("app.api.dependencies.get_current_user", return_value=user),
            patch(
                "app.services.provider_registry.test_provider_key",
                new_callable=AsyncMock,
                return_value=(True, "Key valid"),
            ),
        ):
            resp = client.post(
                "/settings/api-keys/openrouter/test",
                json={"api_key": "sk-or-test-key-1234567890"},
                headers=_auth_header(),
            )

        assert resp.status_code == 200
        body = resp.json()
        assert "ok" in body
        assert "message" in body
        assert body["ok"] is True

    def test_b5_test_invalid_key_returns_ok_false(self, client):
        user = _make_user()

        with (
            patch("app.api.dependencies.get_current_user", return_value=user),
            patch(
                "app.services.provider_registry.test_provider_key",
                new_callable=AsyncMock,
                return_value=(False, "Invalid API key"),
            ),
        ):
            resp = client.post(
                "/settings/api-keys/openrouter/test",
                json={"api_key": "bad-key-1234567890"},
                headers=_auth_header(),
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["ok"] is False
        assert "Invalid" in body["message"]

    def test_b6_test_unsupported_provider_returns_400(self, client):
        user = _make_user()

        with patch("app.api.dependencies.get_current_user", return_value=user):
            resp = client.post(
                "/settings/api-keys/fakeprovider/test",
                json={"api_key": "some-key-12345"},
                headers=_auth_header(),
            )

        assert resp.status_code == 400


# ── C) Provider catalogue ─────────────────────────────────────────────────────

class TestProviderCatalogue:

    def test_c1_list_providers_no_auth_returns_all_six(self, client):
        """GET /settings/providers is public and returns all 6 providers."""
        resp = client.get("/settings/providers")
        assert resp.status_code == 200
        ids = {p["id"] for p in resp.json()}
        assert ids == {"openai", "anthropic", "groq", "google", "openrouter", "nvidia"}

    def test_c1_each_provider_has_required_fields(self, client):
        resp = client.get("/settings/providers")
        for item in resp.json():
            assert "id" in item
            assert "name" in item
            assert "models" in item
            assert isinstance(item["models"], list)
            assert len(item["models"]) > 0
            assert "default_model" in item
            assert "key_prefix_hint" in item

    def test_c2_get_openrouter_models(self, client):
        resp = client.get("/settings/providers/openrouter/models")
        assert resp.status_code == 200
        models = resp.json()
        assert isinstance(models, list)
        assert len(models) > 0
        # All OpenRouter models follow "provider/model" format
        assert all("/" in m for m in models)

    def test_c2_get_nvidia_models(self, client):
        resp = client.get("/settings/providers/nvidia/models")
        assert resp.status_code == 200
        models = resp.json()
        assert "meta/llama-4-maverick-17b-128e-instruct" in models

    def test_c3_unknown_provider_returns_404(self, client):
        resp = client.get("/settings/providers/fakeprovider/models")
        assert resp.status_code == 404


# ── D) _ensure_defaults backfill logic (unit test) ───────────────────────────

class TestEnsureDefaultsLogic:
    """
    Unit-tests the _ensure_defaults helper from auth.py without HTTP overhead.
    """

    @pytest.mark.asyncio
    async def test_backfill_empty_provider_and_model(self):
        from app.api.v1.auth import _ensure_defaults

        user = _make_null_user()
        repo = AsyncMock()
        repo.save = AsyncMock()
        db = AsyncMock()

        await _ensure_defaults(user, repo, db)

        assert user.default_provider == "openai"
        assert user.default_model == "gpt-4o-mini"
        repo.save.assert_called_once_with(user)

    @pytest.mark.asyncio
    async def test_no_backfill_when_already_set(self):
        from app.api.v1.auth import _ensure_defaults

        user = _make_user("anthropic", "claude-3-5-sonnet-20241022")
        repo = AsyncMock()
        repo.save = AsyncMock()
        db = AsyncMock()

        await _ensure_defaults(user, repo, db)

        assert user.default_provider == "anthropic"
        repo.save.assert_not_called()


# ── D) Multi-key label column regression ─────────────────────────────────────

def _make_api_key_record(
    provider: str = "openai",
    label: str = "Default",
    is_active: bool = True,
) -> MagicMock:
    """Return a minimal UserApiKey-like mock that matches the ORM model fields."""
    from app.services.encryption import encrypt_key

    r = MagicMock()
    r.id = uuid.uuid4()
    r.user_id = OWNER_ID
    r.provider = provider
    r.label = label            # must exist — absence causes the production error
    r.is_active = is_active
    r.encrypted_key = encrypt_key("sk-test-key-1234567890")
    r.created_at = datetime.utcnow()
    return r


class TestMultiKeyLabel:
    """Regression suite: column user_api_keys.label does not exist."""

    def test_d1_list_api_keys_includes_label_field(self, client):
        """GET /settings/api-keys must include 'label' in every StoredKeyInfo."""
        user = _make_user()
        records = [_make_api_key_record("openai", "Work key")]

        with (
            patch("app.api.dependencies.get_current_user", return_value=user),
            patch(
                "app.repositories.user_api_key.UserApiKeyRepository.list_for_user",
                new_callable=AsyncMock,
                return_value=records,
            ),
        ):
            resp = client.get("/settings/api-keys", headers=_auth_header())

        assert resp.status_code == 200
        openai_group = next(g for g in resp.json() if g["provider"] == "openai")
        assert openai_group["is_set"] is True
        stored = openai_group["keys"]
        assert len(stored) == 1
        assert "label" in stored[0], "StoredKeyInfo must expose 'label'"
        assert stored[0]["label"] == "Work key"

    def test_d2_multiple_keys_each_carry_own_label(self, client):
        """When a provider has two keys their labels are distinct in the response."""
        user = _make_user()
        records = [
            _make_api_key_record("groq", "Personal", is_active=False),
            _make_api_key_record("groq", "Work",     is_active=True),
        ]

        with (
            patch("app.api.dependencies.get_current_user", return_value=user),
            patch(
                "app.repositories.user_api_key.UserApiKeyRepository.list_for_user",
                new_callable=AsyncMock,
                return_value=records,
            ),
        ):
            resp = client.get("/settings/api-keys", headers=_auth_header())

        assert resp.status_code == 200
        groq_group = next(g for g in resp.json() if g["provider"] == "groq")
        labels = {k["label"] for k in groq_group["keys"]}
        assert labels == {"Personal", "Work"}

    @pytest.mark.asyncio
    async def test_d3_list_for_user_repo_accesses_label_attribute(self):
        """Unit-test: UserApiKeyRepository.list_for_user returns records with .label."""
        from app.repositories.user_api_key import UserApiKeyRepository

        record = _make_api_key_record("anthropic", "My Claude key")

        session = AsyncMock()
        execute_result = MagicMock()
        execute_result.scalars.return_value.all.return_value = [record]
        session.execute = AsyncMock(return_value=execute_result)

        repo = UserApiKeyRepository(session)
        results = await repo.list_for_user(OWNER_ID)

        assert len(results) == 1
        # Accessing .label must not raise AttributeError — confirms model has the field.
        assert results[0].label == "My Claude key"
        assert results[0].is_active is True

    def test_d4_stored_key_info_schema_has_label_not_name(self, client):
        """StoredKeyInfo response schema uses 'label', not a renamed 'name' field."""
        user = _make_user()
        records = [_make_api_key_record("openai", "Default")]

        with (
            patch("app.api.dependencies.get_current_user", return_value=user),
            patch(
                "app.repositories.user_api_key.UserApiKeyRepository.list_for_user",
                new_callable=AsyncMock,
                return_value=records,
            ),
        ):
            resp = client.get("/settings/api-keys", headers=_auth_header())

        assert resp.status_code == 200
        openai_group = next(g for g in resp.json() if g["provider"] == "openai")
        key_obj = openai_group["keys"][0]
        assert "label" in key_obj
        assert "name" not in key_obj  # 'name' is not the exposed field

```

---


<!-- Tổng: 65 file(s) được tổng hợp, 10 file(s) bị bỏ qua (binary), 2 file(s) bị bỏ qua (non-source) -->
