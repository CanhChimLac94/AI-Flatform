#!/usr/bin/env bash
# scripts/dev-infra.sh
# Manage dev infrastructure services running in Docker (postgres, redis, adminer).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/infrastructure/docker-compose.local-dev.yml"

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "ERROR: compose file not found: ${COMPOSE_FILE}"
  exit 1
fi

cmd="${1:-up}"

case "${cmd}" in
  up)
    docker compose -f "${COMPOSE_FILE}" up -d
    echo "Dev infra is running:"
    echo "  - Postgres: localhost:5432"
    echo "  - Redis:    localhost:6379"
    echo "  - Adminer:  http://localhost:8080"
    ;;
  down)
    docker compose -f "${COMPOSE_FILE}" down
    ;;
  restart)
    docker compose -f "${COMPOSE_FILE}" down
    docker compose -f "${COMPOSE_FILE}" up -d
    ;;
  logs)
    docker compose -f "${COMPOSE_FILE}" logs -f "${2:-}"
    ;;
  ps)
    docker compose -f "${COMPOSE_FILE}" ps
    ;;
  *)
    echo "Usage: $0 {up|down|restart|logs [service]|ps}"
    exit 1
    ;;
esac
