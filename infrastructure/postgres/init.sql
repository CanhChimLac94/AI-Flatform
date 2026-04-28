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
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    full_name       VARCHAR(100),
    avatar_url      TEXT,
    hashed_password TEXT,                           -- null for OAuth-only users
    persona_config  JSONB        NOT NULL DEFAULT '{}'::jsonb,
    -- Default provider/model selectable per user (FR-Settings)
    default_provider  VARCHAR(50)  NOT NULL DEFAULT 'openai',
    default_model     VARCHAR(100) NOT NULL DEFAULT 'gpt-4o-mini',
    -- Language preference for UI/response language (vi, en, …)
    language_preference VARCHAR(10) NOT NULL DEFAULT 'vi',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    -- Telegram integration (FR-07, US05)
    telegram_id       BIGINT NULL UNIQUE,
    telegram_username VARCHAR(100) NULL
);

-- ── TABLE: agents ────────────────────────────────────────────────────────────
-- Defined before conversations so the FK in conversations is valid.
-- Custom agents created by users (B-Custom Agents feature)
CREATE TABLE IF NOT EXISTS agents (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id   UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(120) NOT NULL,
    description     TEXT,
    system_prompt   TEXT         NOT NULL DEFAULT '',
    model           VARCHAR(100),                   -- optional model override
    params          JSONB        NOT NULL DEFAULT '{}'::jsonb,
    tools           JSONB        NOT NULL DEFAULT '[]'::jsonb,
    is_public       BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_owner  ON agents(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_agents_public ON agents(is_public) WHERE is_public = TRUE;

-- ── TABLE: conversations ──────────────────────────────────────────────────────
-- Ref: Schema Group B | Soft Delete via deleted_at (Schema §4 Strategy #2)
CREATE TABLE IF NOT EXISTS conversations (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(255),
    model_id    VARCHAR(50),                        -- last model used (e.g. gpt-4o, llama3)
    agent_id    UUID        REFERENCES agents(id) ON DELETE SET NULL,
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
-- Multiple keys per provider supported; label distinguishes them (migration 0006)
CREATE TABLE IF NOT EXISTS user_api_keys (
    id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider      VARCHAR(50)  NOT NULL,      -- 'openai' | 'anthropic' | 'groq' | 'google'
    label         VARCHAR(100) NOT NULL DEFAULT 'Default',
    is_active     BOOLEAN      NOT NULL DEFAULT true,
    encrypted_key TEXT         NOT NULL,      -- Fernet-encrypted, decrypted at app layer
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_provider_label UNIQUE (user_id, provider, label)
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

CREATE OR REPLACE TRIGGER trg_agent_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE OR REPLACE TRIGGER trg_mem_updated_at
    BEFORE UPDATE ON user_memories
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ── SEED: default providers (keys injected by app on startup via env vars) ────
INSERT INTO api_providers (id, base_url, api_key, is_active, priority) VALUES
    ('openai',      'https://api.openai.com/v1',                    'placeholder', TRUE,  1),
    ('anthropic',   'https://api.anthropic.com',                    'placeholder', TRUE,  2),
    ('groq',        'https://api.groq.com/openai/v1',               'placeholder', TRUE,  3),
    ('google',      'https://generativelanguage.googleapis.com',     'placeholder', FALSE, 4),
    ('openrouter',  'https://openrouter.ai/api/v1',                  'placeholder', TRUE,  5),
    ('nvidia',      'https://integrate.api.nvidia.com/v1',           'placeholder', TRUE,  6)
ON CONFLICT (id) DO NOTHING;

-- ── SEED: default admin user ─────────────────────────────────────────────────
INSERT INTO users (id, email, full_name, hashed_password, persona_config, created_at)
VALUES (
    uuid_generate_v4(),
    'leonard@gmail.com',
    'leonard',
    '$2b$12$n4p47K2QtA/m3zDWTMgBWua3rFfah1LVseMzHDJBBfjlynHcs4Ixi',
    '{}'::jsonb,
    NOW()
)
ON CONFLICT (email) DO NOTHING;

-- ── Alembic version stamp ─────────────────────────────────────────────────────
-- Tells alembic upgrade head that a fresh DB from this file is already at 0006,
-- so it skips all migrations that are already baked into the schema above.
CREATE TABLE IF NOT EXISTS alembic_version (
    version_num VARCHAR(32) NOT NULL PRIMARY KEY
);
INSERT INTO alembic_version (version_num) VALUES ('0006') ON CONFLICT DO NOTHING;

SELECT 'Schema v1.2 applied — all tables, indexes, triggers, and alembic stamp created.' AS status;
