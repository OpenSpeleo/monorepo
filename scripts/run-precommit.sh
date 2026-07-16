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

DMYPY=""
if [[ -n "${DMYPY_BIN+x}" ]]; then
    if [[ -x "$DMYPY_BIN" ]]; then
        DMYPY="$DMYPY_BIN"
    fi
elif command -v dmypy >/dev/null 2>&1; then
    DMYPY="$(command -v dmypy)"
else
    for candidate in \
        "$ROOT/apps/web/.venv/bin/dmypy" \
        "$ROOT/apps/web/venv/bin/dmypy"; do
        if [[ -x "$candidate" ]]; then
            DMYPY="$candidate"
            break
        fi
    done
fi

if [[ -n "$DMYPY" ]]; then
    export PATH="$(dirname "$DMYPY"):$PATH"
    exec "$PREK" run "$@"
fi

if [[ -n "${CI:-}" ]]; then
    echo "dmypy is required in CI; install apps/web's full development environment" >&2
    exit 127
fi

printf '%-70s%s\n' \
    "apps/web:mypy (dmypy is not installed locally)" \
    "Skipped"

# If callers selected only the hook that was just skipped, there is nothing for
# prek to run. Avoid turning that intentional local skip into prek's "No hooks
# found after filtering" error. Normal hook and all-files runs still delegate
# to prek so every other project remains authoritative.
mypy_selected=false
other_selector=false
for argument in "$@"; do
    case "$argument" in
        apps/web:mypy)
            mypy_selected=true
            ;;
        -*)
            ;;
        *)
            other_selector=true
            ;;
    esac
done
if [[ "$mypy_selected" == true && "$other_selector" == false ]]; then
    exit 0
fi

exec "$PREK" run --skip apps/web:mypy "$@"
