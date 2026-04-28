#!/usr/bin/env bash
# scripts/dev-local.sh
# Run backend and frontend locally with hot reload for high-debug development.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/apps/backend"
FRONTEND_DIR="${ROOT_DIR}/apps/frontend"

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

(
  cd "${BACKEND_DIR}"
  pip install -r requirements.txt
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
}

trap cleanup INT TERM EXIT

wait -n "${BACKEND_PID}" "${FRONTEND_PID}"
exit_code=$?
echo "A local dev process exited unexpectedly (code: ${exit_code})."
exit "${exit_code}"
