# Collected Files

> **Nguồn:** `/mnt/d/01.WORKS/WWW/AI-Projects/AIChat/infrastructure`
> **Ngày tạo:** 2026-04-22 15:59:12
> **Bộ lọc:** chỉ collect source/config/script text; bỏ qua dependency, env, build cache, media và binary

---

## `docker-compose.dev.yml`

```yaml
# Development overrides — hot reload for both backend and frontend.
# Usage: docker compose -f docker-compose.yml -f docker-compose.dev.yml up
#
# Differences from production:
#   • backend: uses --reload (uvicorn), source mounted as volume
#   • frontend: runs `pnpm dev` with full HMR, source mounted as volume
#   • postgres + redis: ports exposed to host for local tooling (psql, redis-cli)
#   • nginx: NOT included — access frontend on :3000 and backend on :8000 directly

services:
  postgres:
    ports:
      - "5432:5432"

  redis:
    ports:
      - "6379:6379"

  backend:
    build:
      context: ../apps/backend
      dockerfile: Dockerfile
      target: builder       # Stop at builder stage (has dev deps)
    container_name: omni_backend_dev
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
    volumes:
      - ../apps/backend:/app   # Live source mount for hot reload
    ports:
      - "8000:8000"
    environment:
      ENVIRONMENT: development
    # Override healthcheck for faster dev feedback
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:8000/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 5s

  frontend:
    image: node:20-alpine
    container_name: omni_frontend_dev
    working_dir: /app
    command: sh -c "npm install -g pnpm@9 --quiet && pnpm install --no-frozen-lockfile && pnpm dev"
    volumes:
      - ../apps/frontend:/app
      - frontend_node_modules:/app/node_modules   # Prevent host/container conflict
    ports:
      - "3000:3000"
    environment:
      BACKEND_URL: http://backend:8000
      NEXT_TELEMETRY_DISABLED: "1"
    depends_on:
      backend:
        condition: service_healthy

  # nginx is not used in dev — access services directly on their ports
  nginx:
    profiles:
      - disabled   # Effectively disables the nginx service in dev mode

volumes:
  frontend_node_modules:

```

---

## `docker-compose.yml`

```yaml
services:
  # ─── PostgreSQL with pgvector ─────────────────────────────────────────────
  postgres:
    image: pgvector/pgvector:pg16
    container_name: omni_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: omni
      POSTGRES_PASSWORD: omni_secret
      POSTGRES_DB: omni_ai
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U omni -d omni_ai"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─── Redis ────────────────────────────────────────────────────────────────
  redis:
    image: redis:7.2-alpine
    container_name: omni_redis
    restart: unless-stopped
    command: redis-server --save 60 1 --loglevel warning
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─── FastAPI Backend ──────────────────────────────────────────────────────
  backend:
    build:
      context: ../apps/backend
      dockerfile: Dockerfile
    container_name: omni_backend
    restart: unless-stopped
    env_file:
      - ../.env
    environment:
      DATABASE_URL: postgresql+asyncpg://omni:omni_secret@postgres:5432/omni_ai
      REDIS_URL: redis://redis:6379/0
      ENVIRONMENT: production
    # Not exposed publicly — nginx proxies through Next.js rewrites
    expose:
      - "8000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:8000/health || exit 1"]
      interval: 20s
      timeout: 10s
      retries: 5
      start_period: 15s

  # ─── Next.js Frontend ─────────────────────────────────────────────────────
  frontend:
    build:
      context: ../apps/frontend
      dockerfile: Dockerfile
      args:
        BACKEND_URL: http://backend:8000
    container_name: omni_frontend
    restart: unless-stopped
    environment:
      # Server-only: used by Next.js rewrites to reach backend inside Docker network
      BACKEND_URL: http://backend:8000
    expose:
      - "3000"
    ports:
      - "3000:3000"
    depends_on:
      backend:
        condition: service_healthy

  # ─── nginx — single public entry point ───────────────────────────────────
  nginx:
    image: nginx:1.27-alpine
    container_name: omni_nginx
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - frontend
      - backend
    healthcheck:
      test: ["CMD", "nginx", "-t"]
      interval: 30s
      timeout: 5s
      retries: 3

  # ─── DB Admin (dev profile only) ─────────────────────────────────────────
  adminer:
    image: adminer:4.8.1
    container_name: omni_adminer
    restart: unless-stopped
    ports:
      - "8080:8080"
    depends_on:
      postgres:
        condition: service_healthy
    profiles:
      - dev

volumes:
  postgres_data:
  redis_data:

networks:
  default:
    name: omni_network

```

---

## `nginx/nginx.conf`

```conf
# Omni AI Chat — nginx reverse proxy
# Single public entry point on port 80.
# Traffic flow:
#   Browser → nginx:80 → frontend:3000 (Next.js)
#   Next.js server rewrites /api/* → backend:8000/v1/* internally

upstream frontend {
    server frontend:3000;
}

# Expose backend directly only within the Docker network (not to the internet)
upstream backend {
    server backend:8000;
}

server {
    listen 80;
    server_name _;

    client_max_body_size 25M;   # Covers the 20MB file upload limit (R01)

    # ── Health check (for load balancers / k8s probes) ─────────────────────
    location = /health {
        proxy_pass http://backend/health;
        proxy_set_header Host $host;
        access_log off;
    }

    # ── Next.js app (handles /api/* rewrites server-side) ──────────────────
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;

        # WebSocket upgrade (Next.js HMR in dev, future WS features)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE / streaming: disable buffering so chunks reach the browser immediately
        proxy_buffering    off;
        proxy_cache        off;
        proxy_read_timeout 300s;   # Covers max LLM response time (NFR-05: 30s + buffer)
    }
}

```

---

## `postgres/init.sql`

```sql
-- ============================================================
-- Omni AI Chat Platform — PostgreSQL Schema
-- Ref: AiChat-Database-Schema.md
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ── ENUM ──────────────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── TABLE: users ──────────────────────────────────────────────────────────────
-- Ref: Schema Group A
CREATE TABLE IF NOT EXISTS users (
    id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    email          VARCHAR(255) NOT NULL UNIQUE,
    full_name      VARCHAR(100),
    avatar_url     TEXT,
    hashed_password TEXT,                           -- null for OAuth-only users
    persona_config JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    -- Telegram integration (FR-07, US05)
    telegram_id       BIGINT      UNIQUE,
    telegram_username VARCHAR(100)
);

-- ── TABLE: conversations ──────────────────────────────────────────────────────
-- Ref: Schema Group B | Soft Delete via deleted_at (Schema §4 Strategy #2)
CREATE TABLE IF NOT EXISTS conversations (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(255),
    model_id    VARCHAR(50),                        -- last model used (e.g. gpt-4o, llama3)
    is_archived BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ                         -- Soft delete
);

-- Index: fast sidebar load (user's recent chats — Schema §4 Strategy #1)
CREATE INDEX IF NOT EXISTS idx_conv_user_id
    ON conversations(user_id, updated_at DESC)
    WHERE deleted_at IS NULL;

-- ── TABLE: messages ───────────────────────────────────────────────────────────
-- Ref: Schema Group B | metadata JSONB stores attachments, search results (Schema §4 Strategy #3)
CREATE TABLE IF NOT EXISTS messages (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    conv_id     UUID         NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role        message_role NOT NULL,
    content     TEXT         NOT NULL,
    metadata    JSONB        NOT NULL DEFAULT '{}'::jsonb,
    tokens_used INTEGER      NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ                         -- Soft delete
);

-- Index: fast message thread load (Schema §4 Strategy #1)
CREATE INDEX IF NOT EXISTS idx_msg_conv_id
    ON messages(conv_id, created_at ASC)
    WHERE deleted_at IS NULL;

-- ── TABLE: user_memories ──────────────────────────────────────────────────────
-- Ref: Schema Group C | Hybrid: relational fact + pgvector embedding (FR-05, FR-06)
-- embedding dim=1536 matches OpenAI text-embedding-3-small
CREATE TABLE IF NOT EXISTS user_memories (
    id               UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fact_content     TEXT    NOT NULL,
    vector_id        VARCHAR(255),                  -- external ID when using Pinecone
    embedding        vector(1536),                  -- pgvector column for local ANN search
    importance_score FLOAT   NOT NULL DEFAULT 0.5
        CHECK (importance_score BETWEEN 0.0 AND 1.0),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mem_user_id ON user_memories(user_id);

-- HNSW index for sub-millisecond ANN cosine similarity search (FR-06)
CREATE INDEX IF NOT EXISTS idx_mem_embedding_hnsw
    ON user_memories USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ── TABLE: api_providers ──────────────────────────────────────────────────────
-- Ref: Schema Group D | api_key encrypted at application layer (NFR-02)
-- priority drives failover order (EX-01)
CREATE TABLE IF NOT EXISTS api_providers (
    id        VARCHAR(50) PRIMARY KEY,              -- 'openai' | 'anthropic' | 'groq' | 'google'
    base_url  TEXT        NOT NULL,
    api_key   TEXT        NOT NULL DEFAULT 'placeholder',
    is_active BOOLEAN     NOT NULL DEFAULT TRUE,
    priority  SMALLINT    NOT NULL DEFAULT 1        -- lower = preferred (EX-01 failover order)
);

-- ── TABLE: daily_usage ────────────────────────────────────────────────────────
-- Ref: Schema Group D | checked via Redis before each request (R03 / EX-05)
CREATE TABLE IF NOT EXISTS daily_usage (
    user_id      UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    usage_date   DATE    NOT NULL DEFAULT CURRENT_DATE,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, usage_date)
);

-- ── TABLE: user_api_keys ─────────────────────────────────────────────────────
-- Stores per-user API keys encrypted at rest (NFR-02, BYOK feature)
-- User key takes precedence over system .env key in the orchestrator
CREATE TABLE IF NOT EXISTS user_api_keys (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider      VARCHAR(50) NOT NULL,      -- 'openai' | 'anthropic' | 'groq' | 'google'
    encrypted_key TEXT        NOT NULL,      -- Fernet-encrypted, decrypted at app layer
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_provider UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);

-- ── TRIGGERS: auto-update updated_at ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_conv_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE OR REPLACE TRIGGER trg_mem_updated_at
    BEFORE UPDATE ON user_memories
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── SEED: default providers (keys injected by app on startup via env vars) ────
INSERT INTO api_providers (id, base_url, api_key, is_active, priority) VALUES
    ('openai',    'https://api.openai.com/v1',                'placeholder', TRUE,  1),
    ('anthropic', 'https://api.anthropic.com',                'placeholder', TRUE,  2),
    ('groq',      'https://api.groq.com/openai/v1',           'placeholder', TRUE,  3),
    ('google',    'https://generativelanguage.googleapis.com', 'placeholder', FALSE, 4)
ON CONFLICT (id) DO NOTHING;

SELECT 'Schema v1.0 applied — all tables, indexes, and triggers created.' AS status;

```

---


<!-- Tổng: 4 file(s) được tổng hợp, 0 file(s) bị bỏ qua (binary), 0 file(s) bị bỏ qua (non-source) -->
