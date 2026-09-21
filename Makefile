SHELL := /bin/bash

STACK ?= speleodb_fresh
ROOT_PYTHON ?= 3.14

.PHONY: setup doctor pre-commit dev-web dev-web-isolated stop-web-isolated \
	install-js install-python \
	build-web build-mobile sync-mobile check-rust build-compass-ui \
	build-compass-tauri build-core build-ariane test-monorepo

setup:
	node tools/workspace.mjs setup
	@test -f apps/web/.envs/test.env || cp apps/web/.envs/test.env.dist apps/web/.envs/test.env
	npm ci
	UV_PROJECT_ENVIRONMENT="$${UV_PROJECT_ENVIRONMENT:-$(CURDIR)/.venv}" uv sync --python $(ROOT_PYTHON) --all-extras --frozen

doctor:
	node tools/workspace.mjs doctor

pre-commit:
	bash scripts/run-precommit.sh --all-files

dev-web:
	@if [[ -x /start && -d /app ]]; then cd /app && exec /start; else cd apps/web && docker compose -f local.yml up django-webserver celery-worker celery-beat kanchi; fi

dev-web-isolated:
	@[[ "$(STACK)" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$$ ]] || { echo "Invalid STACK: $(STACK)" >&2; exit 2; }
	COMPOSE_INSTANCE_PREFIX="$(STACK)" docker compose -p "$(STACK)" -f apps/web/local.yml up --build django-webserver celery-worker celery-beat kanchi

stop-web-isolated:
	@[[ "$(STACK)" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$$ ]] || { echo "Invalid STACK: $(STACK)" >&2; exit 2; }
	COMPOSE_INSTANCE_PREFIX="$(STACK)" docker compose -p "$(STACK)" -f apps/web/local.yml down

install-js:
	npm ci

install-python:
	UV_PROJECT_ENVIRONMENT="$${UV_PROJECT_ENVIRONMENT:-$(CURDIR)/.venv}" uv sync --python $(ROOT_PYTHON) --all-extras --frozen

build-web:
	npm run build:web

build-mobile:
	npm run build:mobile

sync-mobile:
	npm run cap:sync

check-rust:
	cargo check --manifest-path apps/compass_sidecar/Cargo.toml --locked --all-targets --all-features
	cargo check --manifest-path packages/python/openspeleo_core/Cargo.toml --locked --all-targets --all-features

build-compass-ui:
	cd apps/compass_sidecar/app && NO_COLOR=true trunk build --release

build-compass-tauri:
	cd apps/compass_sidecar/app && NO_COLOR=true cargo tauri build --no-bundle

build-core:
	cd packages/python/openspeleo_core && uv run --frozen maturin build

build-ariane:
	cd apps/ariane_plugin && ./gradlew build test

test-monorepo:
	npm run test:monorepo
