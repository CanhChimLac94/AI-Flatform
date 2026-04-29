#!/usr/bin/env bash
# deploy.sh — Production deployment script for Omni AI Chat
# Usage: ./scripts/deploy.sh [--env-file PATH]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

# ── Parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --env-file) ENV_FILE="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# ── Guard: .env must exist ────────────────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: env file not found at $ENV_FILE"
  echo "       Copy .env.example to .env and fill in your API keys."
  exit 1
fi

# ── Guard: required keys ──────────────────────────────────────────────────────
REQUIRED_KEYS=(JWT_SECRET_KEY)
for key in "${REQUIRED_KEYS[@]}"; do
  if ! grep -qE "^${key}=.+" "$ENV_FILE"; then
    echo "ERROR: $key is not set in $ENV_FILE"
    exit 1
  fi
done

cd "$ROOT_DIR"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Omni AI Chat — Production Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Pull latest images ────────────────────────────────────────────────────────
echo "▸ Pulling base images…"
docker compose -f infrastructure/docker-compose.yml pull postgres redis nginx --ignore-buildable

# ── Build application images ──────────────────────────────────────────────────
echo "▸ Building backend and frontend images…"
docker compose -f infrastructure/docker-compose.yml build --parallel --no-cache

# ── Start infrastructure first ────────────────────────────────────────────────
echo "▸ Starting postgres and redis…"
docker compose -f infrastructure/docker-compose.yml up -d postgres redis

echo "▸ Waiting for postgres to be healthy…"
until docker compose -f infrastructure/docker-compose.yml exec -T postgres pg_isready -U omni -d omni_ai &>/dev/null; do
  sleep 2
done

# ── Run migrations ────────────────────────────────────────────────────────────
echo "▸ Running database migrations…"
docker compose -f infrastructure/docker-compose.yml run --rm \
  -e DATABASE_URL="postgresql+asyncpg://omni:omni_secret@postgres:5432/omni_ai" \
  backend alembic upgrade head

# ── Start remaining services ──────────────────────────────────────────────────
echo "▸ Starting backend, frontend, and nginx…"
docker compose -f infrastructure/docker-compose.yml up -d backend frontend nginx

# ── Health check ──────────────────────────────────────────────────────────────
echo "▸ Waiting for backend health…"
RETRIES=20
until curl -sf http://localhost:8000/health &>/dev/null || [[ $RETRIES -eq 0 ]]; do
  RETRIES=$((RETRIES-1))
  sleep 3
done

if [[ $RETRIES -eq 0 ]]; then
  echo "ERROR: Backend did not become healthy. Check: docker compose -f infrastructure/docker-compose.yml logs backend"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ Deploy complete!"
echo "  App   → http://localhost:88"
echo "  Logs  → make logs"
echo "  Stop  → make down"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
