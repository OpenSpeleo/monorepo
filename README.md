# SpeleoDB monorepo

This repository combines the SpeleoDB applications and libraries using Git
submodules. Each child repository owns its source, tests, pre-commit checks,
builds, releases, and deployments. `.gitmodules` defines the upstream URLs and
tracking branches; parent gitlinks pin exact commits.

## Repository structure

### Applications

| Path                   | Upstream repository                                                                | Technology and purpose                                         |
| ---------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `apps/ariane_plugin`   | [SpeleoDB-Ariane-Plugin](https://github.com/OpenSpeleo/SpeleoDB-Ariane-Plugin)     | Java/JavaFX plugin connecting Ariane to SpeleoDB.              |
| `apps/compass_sidecar` | [speleodb_compass_sidecar](https://github.com/OpenSpeleo/speleodb_compass_sidecar) | Rust, React/TypeScript, and Tauri desktop sidecar for Compass. |
| `apps/mobile`          | [SpeleoDB-App](https://github.com/OpenSpeleo/SpeleoDB-App)                         | React, Ionic, Vite, and Capacitor mobile application.          |
| `apps/web`             | [SpeleoDB](https://github.com/OpenSpeleo/SpeleoDB)                                 | Django web application with Vite-managed frontend assets.      |

### Shared libraries

| Path                              | Upstream repository                                                          | Purpose                                                                                   |
| --------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `packages/python/ariane_lib`      | [pytool_ariane_lib](https://github.com/OpenSpeleo/pytool_ariane_lib)         | Python helpers for Ariane survey data.                                                    |
| `packages/python/compass_lib`     | [pytool_compass_lib](https://github.com/OpenSpeleo/pytool_compass_lib)       | Read and convert Compass cave-survey data, including GeoJSON export.                      |
| `packages/python/mnemo_lib`       | [pytool_mnemo_lib](https://github.com/OpenSpeleo/pytool_mnemo_lib)           | Read and convert Mnemo survey dump files.                                                 |
| `packages/python/openspeleo_core` | [openspeleo_core](https://github.com/OpenSpeleo/openspeleo_core)             | Rust/PyO3 native extension exposed as a Python package, including XML conversion helpers. |
| `packages/python/openspeleo_lib`  | [pytool_openspeleo_lib](https://github.com/OpenSpeleo/pytool_openspeleo_lib) | Shared Python library for reading, writing, validating, and converting cave-survey data.  |
| `packages/rust/compass_data`      | [compass_data](https://github.com/zheylmun/compass_data)                     | Rust library for Compass project (`.mak`) and survey (`.dat`) files.                      |
| `packages/typescript/map-core`    | [SpeleoDB-TS-MapCore](https://github.com/OpenSpeleo/SpeleoDB-TS-MapCore)     | Shared TypeScript map algorithms.                                                         |
| `packages/typescript/map-viewer`  | [SpeleoDB-TS-MapViewer](https://github.com/OpenSpeleo/SpeleoDB-TS-MapViewer) | Shared MapLibre specifications and assets.                                                |

### Operational services

| Path                           | Upstream repository                                                                      | Purpose                                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `utilities/git-backup-cronjob` | [SpeleoDB_Git_Backup_CronJob](https://github.com/OpenSpeleo/SpeleoDB_Git_Backup_CronJob) | Scheduled backup service mirroring GitLab group repositories, including subgroups, to GOGS. |

`packages/rust/compass_data` tracks `main`; the other top-level submodules track
`master`. `.gitmodules` remains authoritative for URLs and branches.

Ariane also owns two nested API submodules:

- `apps/ariane_plugin/com.arianesline.ariane.plugin.api`: Ariane plugin API.
- `apps/ariane_plugin/com.arianesline.cavelib.api`: Ariane cave library API.

Those are declared in `apps/ariane_plugin/.gitmodules` and initialized by a
recursive clone.

### Root configuration

| Path                                      | Role                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| `.gitmodules`                             | Submodule paths, upstream URLs, and tracking branches.                                  |
| `.devcontainer/`                          | Shared web development container layered on the web repository's Compose configuration. |
| `.github/workflows/ci.yml`                | Root checks, dependency-lock validation, and devcontainer build.                        |
| `.vscode/`                                | Editor settings and recommended extensions.                                             |
| `package.json` / `bun.lock`               | Bun workspace and its integration lock.                                                 |
| `bunfig.toml` / `.bun-version`            | Isolated dependency installation and pinned Bun runtime.                                |
| `pyproject.toml` / `uv.lock`              | Python integration environment and its lock.                                            |
| `rust-toolchain.toml`                     | Rust toolchain, components, and WebAssembly target.                                     |
| `.pre-commit-config.yaml` / `.prekignore` | Root pre-commit checks and repository boundaries.                                       |

## Setup

```bash
git clone --recurse-submodules git@github.com:OpenSpeleo/monorepo.git
cd monorepo
```

Use Bun from `.bun-version`, Python 3.14, and uv 0.12.17 or newer. Install the
shared dependency environments on the host when needed:

```bash
bun run install:local
uv sync --python 3.14 --all-extras --frozen
```

The root manifest controls workspace discovery. The installer separately
projects a dependency workspace containing only mobile and the TypeScript
packages. Web retains its standalone Bun installation; the devcontainer supplies
live local map packages through an automatic root-owned installation overlay.
Keep Bun's isolated linker so mobile dependencies remain app-local. The
installer rewrites shared dependencies to local workspaces before resolution
because Bun attempts Git fetches before applying overrides. Standalone manifests
stay unchanged. Container validation uses an isolated source snapshot; never
install Linux mobile/package modules into the host bind mount. The root Python
project uses editable library sources and a virtual web dependency; it is not a
uv workspace. Child locks remain independent. Bun also runs JavaScript builds,
tools and Vitest; no separate Node installation is required. Each `bunfig.toml`
keeps `[run] bun = true` to apply that runtime to child executables.

To resolve a child standalone Bun lock without touching the parent lock, run
`bun run lock` from `apps/web`, `apps/mobile`, `packages/typescript/map-core`,
or `packages/typescript/map-viewer`. Add `--upgrade` to refresh direct and
transitive versions within their declared constraints. All four commands use the
same [isolated lock utility](utilities/bun-lock/README.md); they do not install
packages or change manifests. This convenience command requires the monorepo.

From the monorepo root, the same `bun run lock [--upgrade]` command updates only
the top-level `bun.lock`, including web, mobile, and TypeScript packages with
local map dependencies. It shares dependency projection rules with
`install:local`, which installs only mobile and the TypeScript packages; web
retains its separate installation. Child locks and
`.devcontainer/web-packages.lock` remain separate. Run `bun run install:local`
afterward when installed dependencies need updating.

Copy application `.env.dist` templates only when their local files are missing.
Preserve existing environment files. Follow each child's README and `AGENTS.md`
for application commands and toolchains.

## Working with submodules

Inspect parent and child changes separately:

```bash
git status --short
git diff --submodule=log
git diff --cached --submodule=log
git submodule status --recursive
git submodule foreach --recursive 'git status --short'
```

On a clean checkout, initialize submodules at the recorded commits with:

```bash
git submodule sync --recursive
git submodule update --init --recursive
```

Do not run an update over intentional child branch or commit changes. Never
reset or stash developer work automatically. Publish child commits to their own
upstreams before recording their gitlinks in the parent repository.

Run each repository's checks directly inside that repository. Root `prek run -a`
checks root files only. No Git hooks are installed, and there is no root test or
build dispatcher.

## Devcontainer

Open the monorepo root in the editor and use `.devcontainer/devcontainer.json`.
It combines `apps/web/local.yml` with `.devcontainer/compose.override.yml`.
Initialize submodules on the host before opening the container.

The workspace mounts at `/workspace`, and the web application mounts at `/app`.
The container uses `/opt/speleodb-venv`, live shared Python sources, and an
editable `openspeleo_core` extension. Container dependencies and build caches
use separate named volumes. The `.devcontainer` scripts implement runtime setup
and ownership handling.

The stack includes Django, PostgreSQL, Redis, GitLab, RustFS, Celery, and
Kanchi. The setup service provisions local services and runs migrations before
dependent services start. Django is available at `http://localhost:8000`, and
Kanchi at `http://localhost:8765`.

The default Compose project is `speleodb-monorepo`. Preserve existing containers
and volumes. Use both a distinct Compose project and `COMPOSE_INSTANCE_PREFIX`
when intentionally starting an isolated stack. Do not delete volumes to solve a
configuration issue.

## CI

The workflow runs on pull requests and pushes to `master`, in this order:

1. `prek run -a` using the root configuration.
2. In parallel: `uv lock --check` and `bun run install:local --ignore-scripts`.
3. Build the devcontainer's Django image from the merged Compose configuration.
   Webserver, worker, scheduler, and setup services share the Django Dockerfile
   and build arguments. PostgreSQL uses a prebuilt image.

Every job checks out pinned submodules recursively. CI caches prek environments,
uv downloads, Bun downloads, and Docker build layers. It does not run child test
suites, start the devcontainer services, publish images, or deploy applications.

The Bun check validates the root lock without running lifecycle scripts. The uv
check validates the root lock without installing the project. The image build
uses Buildx with the Django GitHub Actions cache scope and the runner checkout,
including its initialized submodules.

## Operational utilities

Small root-owned operational tools live under `utilities/`, with their own
README and shared explicit checks. Submodules below `utilities/` retain their
own instructions and CI. See [utilities/README.md](utilities/README.md).
