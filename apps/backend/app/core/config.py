from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://omni:omni_secret@localhost:5432/omni_ai"
    REDIS_URL: str = "redis://localhost:6379/0"

    # Auth
    JWT_SECRET_KEY: str = "insecure-dev-secret"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_EXPIRE_DAYS: int = 7
    REFRESH_COOKIE_NAME: str = "omni_refresh"
    # Deprecated — use JWT_ACCESS_EXPIRE_MINUTES
    JWT_EXPIRE_MINUTES: int | None = None

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
    GOOGLE_CSE_ID: str = ""  # Google Custom Search Engine ID

    # Telegram
    TELEGRAM_BOT_TOKEN: str = ""

    # App
    ENVIRONMENT: str = "development"
    # Optional path to JSON file listing default system agents (see app/data/default_system_agents.json)
    DEFAULT_SYSTEM_AGENTS_FILE: str = ""

    # Flow scheduler
    FLOW_SCHEDULER_ENABLED: bool = True
    FLOW_SCHEDULER_POLL_SECONDS: int = 30

    # Rate limiting (EX-05): max messages per minute per account
    RATE_LIMIT_MESSAGES_PER_MINUTE: int = 10
    # Daily free token quota per user (FR-04, Business Rule #1)
    DAILY_FREE_TOKEN_QUOTA: int = 50_000


settings = Settings()
