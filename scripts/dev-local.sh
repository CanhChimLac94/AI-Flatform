#!/usr/bin/env bash
# scripts/dev-local.sh
# Run backend and frontend locally with hot reload for high-debug development.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/apps/backend"
FRONTEND_DIR="${ROOT_DIR}/apps/frontend"
INFRA_SCRIPT="./scripts/dev-infra.sh"

# echo "*********Root directory: ${ROOT_DIR} **************"
# exit 0;

initialize() {
  echo "Initializing local development environment..."

  # Add any setup steps here, e.g., checking for required tools, setting up virtualenv, etc.
  cd "$BACKEND_DIR"
  py -3.12 -m venv .venv
  # source .venv/bin/activate
  source .venv/scripts/activate # for Windows in Git Bash

  pip install --no-cache-dir --force-reinstall -r requirements.txt # --only-binary asyncpg
  cd "$FRONTEND_DIR"
  npm install
}

if [[ ! -d "${BACKEND_DIR}" || ! -d "${FRONTEND_DIR}" ]]; then
  echo "ERROR: apps/backend or apps/frontend not found."
  exit 1
fi

echo "Starting local development processes..."
echo "Backend:  uvicorn main:app --reload --host 0.0.0.0 --port 8000"
echo "Frontend: pnpm dev --port 3000"
echo ""

# Ensure backend picks up root .env defaults when app-local .env is missing.
if [[ -f "${ROOT_DIR}/.env" && ! -f "${BACKEND_DIR}/.env" ]]; then
  echo "INFO: backend .env not found, using root .env by exporting it for this shell."
  set -a
  # shellcheck disable=SC1090
  source "${ROOT_DIR}/.env"
  set +a
fi

# Start dev infrastructure (Docker: postgres, redis, adminer) via WSL
run_infra() {
  local cmd="${1:-up}"
  if [[ ! -f "${INFRA_SCRIPT}" ]]; then
    echo "WARNING: dev-infra.sh not found, skipping."
    return
  fi
  if grep -qiE "microsoft|wsl" /proc/version 2>/dev/null; then
    # Already inside WSL — run directly
    bash "${INFRA_SCRIPT}" "${cmd}"
  elif command -v wsl &>/dev/null; then
    # Running on Windows (Git Bash) — convert path and delegate to WSL
    local wsl_path
    wsl_path=$(printf '%s' "${INFRA_SCRIPT}" | sed 's|^\([A-Za-z]\):|/mnt/\L\1|;s|\\|/|g')
    wsl bash "${wsl_path}" "${cmd}"
  else
    echo "WARNING: WSL not available; skipping dev-infra ${cmd}."
  fi
}

echo "Starting dev infrastructure..."
run_infra up
echo ""

(
  cd "${BACKEND_DIR}"
  uvicorn main:app --reload --host 0.0.0.0 --port 8000
) &
BACKEND_PID=$!

(
  cd "${FRONTEND_DIR}"
  npm  install
  pnpm dev --port 3000
) &
FRONTEND_PID=$!

cleanup() {
  echo ""
  echo "Stopping local processes..."
  kill "${BACKEND_PID}" "${FRONTEND_PID}" 2>/dev/null || true
  wait "${BACKEND_PID}" "${FRONTEND_PID}" 2>/dev/null || true
  echo "Stopping dev infrastructure..."
  run_infra down
}

trap cleanup INT TERM EXIT

wait -n "${BACKEND_PID}" "${FRONTEND_PID}"
exit_code=$?
echo "A local dev process exited unexpectedly (code: ${exit_code})."
exit "${exit_code}"
