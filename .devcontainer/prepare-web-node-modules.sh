#!/usr/bin/env bash
set -euo pipefail

readonly NODE_MODULES_DIR="${WEB_NODE_MODULES_DIR:-/app/node_modules}"
readonly WORKSPACE_NODE_MODULES_DIR="${WORKSPACE_WEB_NODE_MODULES_DIR:-/workspace/apps/web/node_modules}"
readonly TARGET_USER="${WEB_RUNTIME_USER:-dev-user}"

if ! id "${TARGET_USER}" >/dev/null 2>&1; then
    printf 'Web runtime user does not exist: %s\n' "${TARGET_USER}" >&2
    exit 1
fi

if [[ "${EUID}" -eq 0 ]]; then
    mkdir -p "${NODE_MODULES_DIR}"

    readonly target_uid="$(id -u "${TARGET_USER}")"
    readonly current_uid="$(stat -c %u "${NODE_MODULES_DIR}")"
    if [[ "${current_uid}" != "${target_uid}" ]]; then
        chown -R "${TARGET_USER}:${TARGET_USER}" "${NODE_MODULES_DIR}"
    fi
else
    if [[ ! -d "${NODE_MODULES_DIR}" || ! -w "${NODE_MODULES_DIR}" ]]; then
        printf '%s must be writable by %s before web tooling starts\n' \
            "${NODE_MODULES_DIR}" "${TARGET_USER}" >&2
        exit 1
    fi
fi

if [[ -d "${WORKSPACE_NODE_MODULES_DIR}" ]] \
    && [[ ! "${NODE_MODULES_DIR}" -ef "${WORKSPACE_NODE_MODULES_DIR}" ]]; then
    printf '%s and %s must mount the same Node dependency volume\n' \
        "${NODE_MODULES_DIR}" "${WORKSPACE_NODE_MODULES_DIR}" >&2
    exit 1
fi
