#!/usr/bin/env bash
set -euo pipefail

readonly CORE_PROJECT="/workspace/packages/python/openspeleo_core"
readonly CLOSURE_PROJECT="/workspace/packages/python/cave-closure"
readonly CACHE_ROOT="/monorepo-python-build-cache"
readonly CACHE_USER="dev-user"
readonly CACHE_OWNERSHIP_MARKER="${CACHE_ROOT}/.dev-user-venv-v1"
readonly VENV="/opt/speleodb-venv"

SUDO_PRESERVE_ENV="CARGO_HOME,CARGO_TARGET_DIR,RUSTUP_HOME,RUSTUP_TOOLCHAIN,UV_CACHE_DIR"
# Git must trust each bind-mounted submodule after either privilege transition.
for git_config_variable in ${!GIT_CONFIG_@}; do
    case "${git_config_variable}" in
        GIT_CONFIG_COUNT|GIT_CONFIG_KEY_*|GIT_CONFIG_VALUE_*)
            SUDO_PRESERVE_ENV+=",${git_config_variable}"
            ;;
    esac
done
readonly SUDO_PRESERVE_ENV

if [[ ! -d "${CLOSURE_PROJECT}" ]]; then
    printf 'cave_closure source is missing: %s\n' "${CLOSURE_PROJECT}" >&2
    exit 1
fi

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
        --preserve-env="${SUDO_PRESERVE_ENV}" \
        -u "${CACHE_USER}" "$0" "$@"
fi

if [[ ! -e "${CACHE_OWNERSHIP_MARKER}" ]]; then
    exec sudo --preserve-env="${SUDO_PRESERVE_ENV}" \
        "$0" "$@"
fi

if [[ "$(id -un)" != "${CACHE_USER}" ]]; then
    printf 'native Python sync must run as %s\n' "${CACHE_USER}" >&2
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

# Reject stale images or overrides before compiling either editable extension.
"${VENV}/bin/python" - "${CORE_PROJECT}" "${CLOSURE_PROJECT}" <<'PY'
import subprocess
import sys
import tomllib
from pathlib import Path

root = Path("/workspace")
expected = tomllib.loads((root / "rust-toolchain.toml").read_text())["toolchain"]
for project in (root, *(Path(path) for path in sys.argv[1:])):
    declared = tomllib.loads((project / "rust-toolchain.toml").read_text())["toolchain"]
    if declared != expected:
        raise SystemExit(f"{project}/rust-toolchain.toml must match the root pin")
    actual = subprocess.check_output(["rustc", "--version"], cwd=project, text=True)
    if actual.split()[1] != expected["channel"]:
        raise SystemExit(
            f"{project}: expected Rust {expected['channel']}, got {actual.strip()}. "
            "Rebuild the devcontainer and check RUSTUP_TOOLCHAIN."
        )
    print(f"{project}: {actual.strip()}", flush=True)
subprocess.run(["cargo", "clippy", "--version"], cwd=root, check=True)
subprocess.run(["cargo", "fmt", "--version"], cwd=root, check=True)
PY

# Both native projects use PEP 660 editable installs with Maturin's dev profile.
# Their own uv cache keys track Cargo inputs and Rust/Python sources.
uv sync \
    --project "${CORE_PROJECT}" \
    --python "${VENV}/bin/python" \
    --frozen \
    --no-dev \
    --inexact

uv sync \
    --project "${CLOSURE_PROJECT}" \
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

closure_source = Path("/workspace/packages/python/cave-closure/src_python").resolve()
for name in ("cave_closure", "cave_closure._native"):
    spec = find_spec(name)
    if spec is None or spec.origin is None:
        raise RuntimeError(f"{name} has no importable origin")
    origin = Path(spec.origin).resolve()
    if not origin.is_relative_to(closure_source):
        raise RuntimeError(f"{name} resolved to {origin}, expected {closure_source}")
    if name.endswith("._native") and origin.suffix != ".so":
        raise RuntimeError(f"{name} is not the Linux native extension: {origin}")
    print(f"{name}: {origin}")

print(f"openspeleo_core Python source: {origins['openspeleo_core']}")
print(f"openspeleo_core Rust extension: {origins['openspeleo_core._rust_lib']}")
PY
