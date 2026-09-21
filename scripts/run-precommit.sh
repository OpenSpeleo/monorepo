#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$ROOT"

# Git submodules are separate prek workspaces. Only one optional project
# selector is accepted; all remaining options retain their native prek meaning.
PROJECTS=(.)
module_paths="$(git config --file "$ROOT/.gitmodules" --get-regexp '^submodule\..*\.path$')"
if [[ -z "$module_paths" ]]; then
    echo "No submodules declared in .gitmodules" >&2
    exit 1
fi
while read -r key project; do
    if ! grep -Fxq "$project/" "$ROOT/.prekignore"; then
        PROJECTS+=("$project")
    fi
done <<< "$module_paths"

HOOK=""
if [[ $# -gt 0 && "$1" != -* ]]; then
    selector="$1"
    shift
    project="${selector%%:*}"
    project="${project%/}"
    if [[ "$selector" == *:* ]]; then HOOK="${selector#*:}"; fi
    found=false
    for candidate in "${PROJECTS[@]}"; do
        if [[ "$candidate" == "$project" ]]; then found=true; fi
    done
    if [[ "$found" != true ]]; then
        echo "Unknown or manual-only project: $project; use prek -C <repository> run directly" >&2
        exit 2
    fi
    PROJECTS=("$project")
fi

for argument in "$@"; do
    case "$argument" in
        --files|--files=*|--from-ref|--from-ref=*|--to-ref|--to-ref=*|--config|--config=*|-c|-c?*|--cd|--cd=*|-C|-C?*)
            echo "Repository-specific file/ref/config options require prek -C <repository> run directly" >&2
            exit 2
            ;;
    esac
done

needs_mypy=false
for project in "${PROJECTS[@]}"; do
    if [[ "$project" == "apps/web" ]]; then needs_mypy=true; fi
    if [[ "$project" != "." ]] && {
        [[ ! -e "$ROOT/$project/.git" ]] ||
        [[ "$(git -C "$ROOT/$project" rev-parse --show-toplevel 2>/dev/null)" != "$ROOT/$project" ]];
    }; then
        echo "Submodule $project is not initialized; run make setup" >&2
        exit 1
    fi
done

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

if [[ "$needs_mypy" == true && -z "$MYPY" ]]; then
    echo "mypy is required; install apps/web's full development environment" >&2
    exit 127
fi

if [[ -n "$MYPY" ]]; then export PATH="$(dirname "$MYPY"):$PATH"; fi
for project in "${PROJECTS[@]}"; do
    args=(run)
    if [[ -n "$HOOK" ]]; then args+=("$HOOK"); fi
    args+=("$@")
    (cd "$ROOT/$project" && "$PREK" "${args[@]}")
done
