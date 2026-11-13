#!/usr/bin/env bash
set -euo pipefail

BASHRC_LINE="source /app/.devcontainer/bashrc.override.sh"
touch "${HOME}/.bashrc"
if ! grep -Fqx "$BASHRC_LINE" "$HOME/.bashrc"; then
    printf '%s\n' "$BASHRC_LINE" >> "$HOME/.bashrc"
fi

/workspace/.devcontainer/prepare-web-node-modules.sh
/workspace/.devcontainer/sync-openspeleo-core.sh
bun /workspace/.devcontainer/install-web-packages.mjs

python - <<'PY'
from pathlib import Path

import cave_closure
import compass_lib
import mnemo_lib
import openspeleo_core
import openspeleo_lib
import stalagmight_lib

workspace = Path("/workspace").resolve()
expected_sources = {
    "cave_closure": workspace / "packages/rust/cave-closure",
    "compass_lib": workspace / "packages/python/compass_lib",
    "mnemo_lib": workspace / "packages/python/mnemo_lib",
    "openspeleo_core": workspace / "packages/python/openspeleo_core",
    "openspeleo_lib": workspace / "packages/python/openspeleo_lib",
    "stalagmight_lib": workspace / "packages/python/stalagmight_lib",
}

for module in (
    cave_closure, compass_lib, mnemo_lib, openspeleo_core, openspeleo_lib, stalagmight_lib
):
    module_path = Path(module.__file__).resolve()
    expected_source = expected_sources[module.__name__]
    if not module_path.is_relative_to(expected_source):
        raise RuntimeError(
            f"{module.__name__} resolved to {module_path}, expected {expected_source}"
        )

print("SpeleoDB editable local Python libraries: OK")
PY
