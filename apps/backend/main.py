from contextlib import asynccontextmanager
import asyncio
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from redis.exceptions import ConnectionError as RedisConnectionError
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError, OperationalError

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.redis import close_redis, get_redis
from app.db.session import AsyncSessionLocal, engine
from app.services.seed_system_agents import ensure_default_system_agents
from app.services.flow_scheduler import flow_scheduler_loop

logger = logging.getLogger(__name__)


async def _wait_for_dependencies(max_attempts: int = 30, delay: float = 1.0) -> None:
    last_err: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            redis = get_redis()
            await redis.ping()
            logger.info("Database and Redis are ready.")
            return
        except Exception as exc:
            last_err = exc
            logger.warning(
                "Waiting for Postgres/Redis (%s/%s): %s",
                attempt,
                max_attempts,
                exc,
            )
            await asyncio.sleep(delay)
    raise RuntimeError("Postgres or Redis is unavailable") from last_err


@asynccontextmanager
async def lifespan(app: FastAPI):
    max_attempts = 30 if settings.ENVIRONMENT == "development" else 5
    await _wait_for_dependencies(max_attempts=max_attempts)
    try:
        async with AsyncSessionLocal() as session:
            await ensure_default_system_agents(session)
    except Exception:
        logger.exception("Failed to seed default system agents")

    scheduler_task: asyncio.Task | None = None
    if settings.FLOW_SCHEDULER_ENABLED:
        scheduler_task = asyncio.create_task(flow_scheduler_loop())

    yield

    if scheduler_task is not None:
        scheduler_task.cancel()
        try:
            await scheduler_task
        except asyncio.CancelledError:
            pass
    await close_redis()


app = FastAPI(
    title="AI Hub – Orchestrator API",
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


@app.exception_handler(IntegrityError)
async def integrity_error_handler(_request: Request, exc: IntegrityError):
    logger.warning("Database integrity error: %s", exc.orig)
    return JSONResponse(
        status_code=409,
        content={"detail": "Data conflict. Please refresh and try again."},
    )


@app.exception_handler(OperationalError)
@app.exception_handler(DBAPIError)
async def database_unavailable_handler(_request: Request, exc: Exception):
    logger.warning("Database unavailable: %s", exc)
    return JSONResponse(
        status_code=503,
        content={"detail": "Database temporarily unavailable. Please retry shortly."},
    )


@app.exception_handler(RedisConnectionError)
async def redis_unavailable_handler(_request: Request, _exc: RedisConnectionError):
    return JSONResponse(
        status_code=503,
        content={"detail": "Redis temporarily unavailable. Please retry shortly."},
    )


app.include_router(api_router, prefix="/v1")


@app.get("/health")
async def health_check():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        redis = get_redis()
        await redis.ping()
        return {"status": "ok", "env": settings.ENVIRONMENT, "postgres": "ok", "redis": "ok"}
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={
                "status": "degraded",
                "env": settings.ENVIRONMENT,
                "detail": str(exc),
            },
        )
