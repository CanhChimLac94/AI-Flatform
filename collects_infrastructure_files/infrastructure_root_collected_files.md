# Collected Files - infrastructure (root)

> **Nguồn:** `/mnt/d/01.WORKS/WWW/AI-Projects/AIChat/infrastructure`
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
    # depends_on:
    #   backend:
    #     condition: service_healthy

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


<!-- Tổng: 2 file(s) được tổng hợp, 0 file(s) bị bỏ qua (binary), 0 file(s) bị bỏ qua (non-source) -->
