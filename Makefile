SHELL := /bin/bash

SUBTREE_FLAG = $(if $(strip $(SUBTREE)),--subtree $(SUBTREE),)

.PHONY: setup doctor pre-commit dev-web install-js install-python \
	build-web build-mobile sync-mobile check-rust build-compass-ui \
	build-compass-tauri build-core build-ariane test-monorepo \
	subtree-status subtree-pull subtree-push subtree-push-execute \
	subtree-branch subtree-pr

setup:
	node tools/subtree.mjs setup
	@test -f apps/web/.envs/test.env || cp apps/web/.envs/test.env.dist apps/web/.envs/test.env
	npm ci
	UV_PROJECT_ENVIRONMENT="$${UV_PROJECT_ENVIRONMENT:-$(CURDIR)/.venv}" uv sync --all-extras

doctor:
	node tools/subtree.mjs doctor

pre-commit:
	bash scripts/run-precommit.sh --all-files

dev-web:
	@if [[ -x /start && -d /app ]]; then cd /app && exec /start; else cd apps/web && docker compose -f local.yml up django-webserver; fi

install-js:
	npm ci

install-python:
	UV_PROJECT_ENVIRONMENT="$${UV_PROJECT_ENVIRONMENT:-$(CURDIR)/.venv}" uv sync --all-extras

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

subtree-status:
	node tools/subtree.mjs status $(SUBTREE_FLAG)

subtree-pull:
	node tools/subtree.mjs pull $(SUBTREE_FLAG)

subtree-push:
	node tools/subtree.mjs push $(SUBTREE_FLAG)

subtree-push-execute:
	node tools/subtree.mjs push --execute $(SUBTREE_FLAG)

subtree-branch:
	@test -n "$(BRANCH)" || { echo "BRANCH is required" >&2; exit 2; }
	node tools/subtree.mjs branch "$(BRANCH)"

subtree-pr:
	@test -n "$(TITLE)" || { echo "TITLE is required" >&2; exit 2; }
	node tools/subtree.mjs pr $(SUBTREE_FLAG) --title "$(TITLE)" $(if $(strip $(BODY)),--body "$(BODY)",)
