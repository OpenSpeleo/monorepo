#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

if [[ -n "${PREK_BIN+x}" ]]; then
    PREK="$PREK_BIN"
elif command -v prek >/dev/null 2>&1; then
    PREK="$(command -v prek)"
elif [[ -x "$ROOT/.venv-devcontainer/bin/prek" ]]; then
    PREK="$ROOT/.venv-devcontainer/bin/prek"
elif [[ -x "$ROOT/.venv/bin/prek" ]]; then
    PREK="$ROOT/.venv/bin/prek"
elif [[ -x "$ROOT/apps/web/.venv/bin/prek" ]]; then
    PREK="$ROOT/apps/web/.venv/bin/prek"
elif [[ -x "$ROOT/node_modules/.bin/prek" ]]; then
    PREK="$ROOT/node_modules/.bin/prek"
else
    echo "prek is required; run 'make setup' first" >&2
    exit 127
fi

MYPY=""
if [[ -n "${MYPY_BIN+x}" ]]; then
    if [[ -x "$MYPY_BIN" ]]; then
        MYPY="$MYPY_BIN"
    fi
elif command -v mypy >/dev/null 2>&1; then
    MYPY="$(command -v mypy)"
else
    for candidate in \
        "$ROOT/apps/web/.venv/bin/mypy" \
        "$ROOT/apps/web/venv/bin/mypy"; do
        if [[ -x "$candidate" ]]; then
            MYPY="$candidate"
            break
        fi
    done
fi

if [[ -z "$MYPY" ]]; then
    echo "mypy is required; install apps/web's full development environment" >&2
    exit 127
fi

export PATH="$(dirname "$MYPY"):$PATH"
exec "$PREK" run "$@"
