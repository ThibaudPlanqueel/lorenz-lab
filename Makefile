.PHONY: help up down logs build test test-frontend test-api lint format fix clean

help:
	@echo "Commandes disponibles :"
	@echo "  make up            — lance frontend + api via docker-compose"
	@echo "  make down          — arrête et nettoie les containers"
	@echo "  make logs          — affiche les logs des services"
	@echo "  make build         — (re)build les images Docker"
	@echo "  make test          — lance tous les tests (frontend + api)"
	@echo "  make test-frontend — tests Vitest côté TypeScript"
	@echo "  make test-api      — tests pytest côté Python"
	@echo "  make lint          — lint Python (ruff check)"
	@echo "  make format        — formate Python (ruff format)"
	@echo "  make fix           — lint + format avec auto-corrections"
	@echo "  make clean         — supprime dist/, node_modules/, __pycache__/"

up:
	docker compose up -d --build
	@echo ""
	@echo "  Frontend  →  http://localhost:8080"
	@echo "  API       →  http://localhost:8080/api/health"

down:
	docker compose down

logs:
	docker compose logs -f

build:
	docker compose build

test: test-frontend test-api

test-frontend:
	cd frontend && npm install --no-audit --no-fund && npm test

test-api:
	cd api && pip install -r requirements-dev.txt && pytest

lint:
	cd api && ruff check src tests

format:
	cd api && ruff format src tests

fix:
	cd api && ruff check --fix src tests && ruff format src tests

clean:
	rm -rf frontend/dist frontend/node_modules
	find api -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find api -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
