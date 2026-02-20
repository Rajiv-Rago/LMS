# =============================================
# LMS Development Makefile
# =============================================

.PHONY: help dev db up down test test-watch test-coverage lint build clean logs restart

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

# --------------- Development ----------------

dev: ## Start dev server (app only, requires DB running)
	npm run dev

db: ## Start MongoDB in Docker
	docker compose up mongo -d
	@echo "MongoDB running at mongodb://localhost:27017"

up: ## Start MongoDB + dev server
	docker compose up mongo -d
	npm run dev

down: ## Stop all Docker containers
	docker compose down

restart: ## Restart all Docker containers
	docker compose down
	docker compose up mongo -d

logs: ## Show MongoDB container logs
	docker compose logs -f mongo

# --------------- Testing --------------------

test: ## Run all tests
	npm test

test-watch: ## Run tests in watch mode
	npm run test:watch

test-coverage: ## Run tests with coverage report
	npm run test:coverage

# --------------- Build & Deploy -------------

build: ## Build production Next.js app
	npm run build

build-docker: ## Build production Docker image
	docker compose build app

prod: ## Run full production stack in Docker
	docker compose --profile prod up -d --build

prod-down: ## Stop production stack
	docker compose --profile prod down

# --------------- Code Quality ---------------

lint: ## Run ESLint
	npm run lint

# --------------- Utilities ------------------

clean: ## Remove build artifacts and node_modules
	rm -rf .next node_modules coverage

install: ## Install dependencies
	npm install

seed: ## Placeholder for DB seeding (not yet implemented)
	@echo "TODO: Add seed script"
