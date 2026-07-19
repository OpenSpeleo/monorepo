#!/usr/bin/env bash
set -euo pipefail

readonly CORE_PROJECT="/workspace/packages/python/openspeleo_core"
readonly CORE_SOURCE="${CORE_PROJECT}/src_python"
readonly CACHE_ROOT="/monorepo-python-build-cache"
readonly CACHE_USER="dev-user"
readonly CACHE_OWNERSHIP_MARKER="${CACHE_ROOT}/.dev-user-venv-v1"
readonly VENV="/opt/speleodb-venv"

if [[ ! -d "${CORE_PROJECT}" ]]; then
    printf 'openspeleo_core source is missing: %s\n' "${CORE_PROJECT}" >&2
    exit 1
fi

prepare_shared_cache_as_root() {
    mkdir -p \
        "${CARGO_HOME:-${CACHE_ROOT}/cargo}" \
        "${CARGO_TARGET_DIR:-${CACHE_ROOT}/openspeleo-core-target}" \
        "${UV_CACHE_DIR:-${CACHE_ROOT}/uv}"

    if [[ ! -e "${CACHE_OWNERSHIP_MARKER}" ]]; then
        chown -R "${CACHE_USER}:${CACHE_USER}" "${CACHE_ROOT}"
        chmod -R u+rwX,g+rwX "${CACHE_ROOT}"
        touch "${CACHE_OWNERSHIP_MARKER}"
        chown "${CACHE_USER}:${CACHE_USER}" "${CACHE_OWNERSHIP_MARKER}"
    fi
}

if [[ "${EUID}" -eq 0 ]]; then
    prepare_shared_cache_as_root
    exec sudo --set-home \
        --preserve-env=CARGO_HOME,CARGO_TARGET_DIR,RUSTUP_HOME,RUSTUP_TOOLCHAIN,UV_CACHE_DIR \
        -u "${CACHE_USER}" "$0" "$@"
fi

if [[ ! -e "${CACHE_OWNERSHIP_MARKER}" ]]; then
    exec sudo --preserve-env=CARGO_HOME,CARGO_TARGET_DIR,RUSTUP_HOME,RUSTUP_TOOLCHAIN,UV_CACHE_DIR \
        "$0" "$@"
fi

if [[ "$(id -un)" != "${CACHE_USER}" ]]; then
    printf 'openspeleo_core sync must run as %s\n' "${CACHE_USER}" >&2
    exit 1
fi

export PATH="${VENV}/bin:/usr/local/cargo/bin:/usr/local/bin:/usr/bin:/bin"
export UV_LINK_MODE="${UV_LINK_MODE:-copy}"
export UV_PROJECT_ENVIRONMENT="${VENV}"
umask 0002

command -v cargo >/dev/null
command -v rustc >/dev/null
command -v uv >/dev/null
test -x "${VENV}/bin/python"

# uv performs a PEP 660 editable install. Maturin's editable-profile is `dev`,
# and tool.uv.cache-keys invalidates the cached native build whenever Cargo or
# any file below src_rust changes.
uv sync \
    --project "${CORE_PROJECT}" \
    --python "${VENV}/bin/python" \
    --frozen \
    --no-dev \
    --inexact

"${VENV}/bin/python" - <<'PY'
from importlib.util import find_spec
from pathlib import Path

source = Path("/workspace/packages/python/openspeleo_core/src_python").resolve()
origins = {}
for name in ("openspeleo_core", "openspeleo_core._rust_lib"):
    spec = find_spec(name)
    if spec is None or spec.origin is None:
        raise RuntimeError(f"{name} has no importable origin")
    origin = Path(spec.origin).resolve()
    if not origin.is_relative_to(source):
        raise RuntimeError(f"{name} resolved to {origin}, expected {source}")
    origins[name] = origin

if origins["openspeleo_core._rust_lib"].suffix != ".so":
    raise RuntimeError(
        "openspeleo_core._rust_lib is not the Linux native extension: "
        f"{origins['openspeleo_core._rust_lib']}"
    )

print(f"openspeleo_core Python source: {origins['openspeleo_core']}")
print(f"openspeleo_core Rust extension: {origins['openspeleo_core._rust_lib']}")
PY
