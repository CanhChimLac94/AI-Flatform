COMPOSE      = docker compose -f infrastructure/docker-compose.yml
COMPOSE_DEV  = $(COMPOSE) -f infrastructure/docker-compose.dev.yml
BACKEND_DIR  = apps/backend
FRONTEND_DIR = apps/frontend

.DEFAULT_GOAL := help

# ── Help ──────────────────────────────────────────────────────────────────────
.PHONY: help
help:
	@echo ""
	@echo "  Omni AI Chat — Docker deployment commands"
	@echo ""
	@echo "  PRODUCTION"
	@echo "    make build        Build all Docker images"
	@echo "    make up           Start full production stack (nginx on :80)"
	@echo "    make down         Stop and remove containers"
	@echo "    make restart      Rebuild images and restart all services"
	@echo "    make logs         Tail logs for all services"
	@echo "    make logs-backend Tail backend logs only"
	@echo "    make ps           Show running containers and health"
	@echo ""
	@echo "  DEVELOPMENT (hot reload)"
	@echo "    make dev          Start dev stack (frontend :3000, backend :8000)"
	@echo "    make dev-infra    Start only postgres + redis (run apps locally)"
	@echo "    make dev-down     Stop dev stack"
	@echo ""
	@echo "  DATABASE"
	@echo "    make migrate      Run Alembic migrations inside backend container"
	@echo "    make db-shell     Open psql inside the postgres container"
	@echo "    make redis-cli    Open redis-cli inside the redis container"
	@echo ""
	@echo "  TESTING"
	@echo "    make test         Run backend pytest suite"
	@echo "    make test-cov     Run tests with coverage report"
	@echo ""
	@echo "  UTILITIES"
	@echo "    make shell-backend  sh into the running backend container"
	@echo "    make shell-frontend sh into the running frontend container"
	@echo "    make clean          Remove all containers, volumes, and images"
	@echo ""

# ── Production ─────────────────────────────────────────────────────────────
.PHONY: build
build:
	$(COMPOSE) build --parallel

.PHONY: up
up:
	$(COMPOSE) up -d
	@echo ""
	@echo "  ✓ Stack is up. Access the app at http://localhost"
	@echo "  ✓ Use 'make logs' to watch service output."

.PHONY: down
down:
	$(COMPOSE) down

.PHONY: restart
restart: down build up

.PHONY: logs
logs:
	$(COMPOSE) logs -f

.PHONY: logs-backend
logs-backend:
	$(COMPOSE) logs -f backend

.PHONY: logs-frontend
logs-frontend:
	$(COMPOSE) logs -f frontend

.PHONY: ps
ps:
	$(COMPOSE) ps

# ── Development ────────────────────────────────────────────────────────────
.PHONY: dev
dev:
	$(COMPOSE_DEV) up -d
	@echo ""
	@echo "  ✓ Dev stack is up."
	@echo "  Frontend  → http://localhost:3000  (hot reload)"
	@echo "  Backend   → http://localhost:8000  (--reload)"
	@echo "  Postgres  → localhost:5432"
	@echo "  Redis     → localhost:6379"

.PHONY: dev-infra
dev-infra:
	$(COMPOSE) up -d postgres redis
	@echo ""
	@echo "  ✓ Infrastructure ready."
	@echo "  Run backend:  cd apps/backend && uvicorn main:app --reload"
	@echo "  Run frontend: cd apps/frontend && pnpm dev"

.PHONY: dev-down
dev-down:
	$(COMPOSE_DEV) down

# ── Database ───────────────────────────────────────────────────────────────
.PHONY: migrate
migrate:
	$(COMPOSE) exec backend alembic upgrade head

.PHONY: migrate-create
migrate-create:
	@read -p "Migration message: " msg; \
	$(COMPOSE) exec backend alembic revision --autogenerate -m "$$msg"

.PHONY: db-shell
db-shell:
	$(COMPOSE) exec postgres psql -U omni -d omni_ai

.PHONY: redis-cli
redis-cli:
	$(COMPOSE) exec redis redis-cli

# ── Testing ────────────────────────────────────────────────────────────────
.PHONY: test
test:
	cd $(BACKEND_DIR) && python -m pytest tests/ -v

.PHONY: test-cov
test-cov:
	cd $(BACKEND_DIR) && python -m pytest tests/ -v --cov=app --cov-report=term-missing

# ── Utilities ──────────────────────────────────────────────────────────────
.PHONY: shell-backend
shell-backend:
	$(COMPOSE) exec backend sh

.PHONY: shell-frontend
shell-frontend:
	$(COMPOSE) exec frontend sh

.PHONY: clean
clean:
	$(COMPOSE) down -v --rmi local
	@echo "  ✓ All containers, volumes, and local images removed."
