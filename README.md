# SpeleoDB monorepo

This repository is the integration workspace for the SpeleoDB applications and
shared libraries. It combines nine standalone Git repositories under `apps/` and
`packages/python/` using Git submodules, then adds root-level tooling for
cross-project development, validation, editors, and containers.

Every submodule remains independently cloneable, buildable, releasable, and
deployable. The monorepo is an integration surface; it does not replace the
standalone repositories or their release pipelines.

## Core model and invariants

- Each product is an independent Git repository at its existing application or
  package path. The parent records its exact commit as a gitlink.
- `.gitmodules` is the authoritative mapping of names, paths, URLs, and tracking
  branches. There is no separate repository manifest or publishing wrapper.
- Normal recursive checkout uses recorded commits. Following a newer upstream
  branch is an explicit update, reviewed and recorded in the parent repository.
- Product edits are committed and published from their own repositories. Root
  orchestration changes and gitlink updates belong to the monorepo.
- The monorepo `origin` stores integration history; it is not a product
  deployment target. Each submodule's `origin` is its original upstream.
- Standalone manifests, locks, nested submodules, CI, and release configuration
  remain authoritative. Root npm and Python locks cover integration only.
- No Git or pre-commit hook is installed. Validation is invoked explicitly.
- Deployments and releases remain in the standalone repositories. Root CI only
  validates integration.

## Repository structure

### Applications

| Name                   | Path                   | Technology and purpose                               | Upstream base |
| ---------------------- | ---------------------- | ---------------------------------------------------- | ------------- |
| `apps/ariane_plugin`   | `apps/ariane_plugin`   | Java/JavaFX Ariane plugin                            | `master`      |
| `apps/compass_sidecar` | `apps/compass_sidecar` | Rust, Yew, Trunk, and Tauri Compass sidecar          | `master`      |
| `apps/mobile`          | `apps/mobile`          | React, Ionic, Vite, Capacitor mobile application     | `master`      |
| `apps/web`             | `apps/web`             | Django application with Vite-managed frontend assets | `master`      |

### Shared packages

| Name                              | Path                              | Purpose                                        | Upstream base |
| --------------------------------- | --------------------------------- | ---------------------------------------------- | ------------- |
| `packages/python/ariane_lib`      | `packages/python/ariane_lib`      | Ariane Python helpers                          | `master`      |
| `packages/python/compass_lib`     | `packages/python/compass_lib`     | Compass Python helpers                         | `master`      |
| `packages/python/mnemo_lib`       | `packages/python/mnemo_lib`       | Mnemo Python helpers                           | `master`      |
| `packages/python/openspeleo_core` | `packages/python/openspeleo_core` | Python package backed by a Rust/PyO3 extension | `master`      |
| `packages/python/openspeleo_lib`  | `packages/python/openspeleo_lib`  | Shared OpenSpeleo Python library               | `master`      |
| n/a                               | `packages/typescript/*`           | Reserved for future shared TypeScript packages | n/a           |

### Root orchestration files

| Path                                      | Role                                                     |
| ----------------------------------------- | -------------------------------------------------------- |
| `.devcontainer/`                          | Web devcontainer layered on `apps/web/local.yml`         |
| `.github/workflows/ci.yml`                | Integration validation only                              |
| `.gitmodules`                             | Authoritative mapping for the nine top-level submodules  |
| `.npmrc`                                  | Nested npm installation strategy                         |
| `.pre-commit-config.yaml` / `.prekignore` | Root checks and project boundaries                       |
| `.vscode/`                                | Root editor recommendations and language-server settings |
| `Makefile`                                | Canonical developer build and validation commands        |
| `package.json` / `package-lock.json`      | Root npm workspace and integration lock                  |
| `pyproject.toml` / `uv.lock`              | Python 3.14 integration environment                      |
| `rust-toolchain.toml`                     | Rust channel, components, and WebAssembly target         |
| `scripts/run-precommit.sh`                | Explicit root, web, and Python-package checks            |
| `tools/*.test.mjs`                        | Workspace safety and explicit pre-commit launcher tests  |
| `tools/workspace.mjs`                     | Dependency-free initialization and environment diagnosis |

## Upstream mapping

`.gitmodules` is authoritative. Each initialized submodule has its own `origin`.
All nine tracking branches are currently `master`.

| Name                              | Path                              | URL                                                      |
| --------------------------------- | --------------------------------- | -------------------------------------------------------- |
| `apps/ariane_plugin`              | `apps/ariane_plugin`              | `https://github.com/OpenSpeleo/SpeleoDB-Ariane-Plugin`   |
| `apps/compass_sidecar`            | `apps/compass_sidecar`            | `git@github.com:OpenSpeleo/speleodb_compass_sidecar.git` |
| `apps/mobile`                     | `apps/mobile`                     | `git@github.com:OpenSpeleo/SpeleoDB-App.git`             |
| `apps/web`                        | `apps/web`                        | `git@github.com:OpenSpeleo/SpeleoDB.git`                 |
| `packages/python/ariane_lib`      | `packages/python/ariane_lib`      | `git@github.com:OpenSpeleo/pytool_ariane_lib.git`        |
| `packages/python/compass_lib`     | `packages/python/compass_lib`     | `git@github.com:OpenSpeleo/pytool_compass_lib.git`       |
| `packages/python/mnemo_lib`       | `packages/python/mnemo_lib`       | `git@github.com:OpenSpeleo/pytool_mnemo_lib.git`         |
| `packages/python/openspeleo_core` | `packages/python/openspeleo_core` | `git@github.com:OpenSpeleo/openspeleo_core.git`          |
| `packages/python/openspeleo_lib`  | `packages/python/openspeleo_lib`  | `git@github.com:OpenSpeleo/pytool_openspeleo_lib.git`    |

## Prerequisites

| Tool       | Expected version or role                                                               |
| ---------- | -------------------------------------------------------------------------------------- |
| Git        | A version supporting recursive submodules                                              |
| Node.js    | Node 26, as recorded in `.node-version`                                                |
| npm        | Installed with Node and capable of npm workspaces                                      |
| uv         | Version 0.12.17 or newer; Python environment, project, and lock manager                |
| Python     | Python 3.14 for the root integration project and `apps/web`                            |
| Rust       | Stable; the committed toolchain adds `rustfmt`, `clippy`, and `wasm32-unknown-unknown` |
| Java       | JDK 25 for Ariane                                                                      |
| GitHub CLI | Optional; for upstream pull requests                                                   |
| Docker     | Optional on the host; required for the devcontainer and the host-side web stack        |
| VS Code    | Optional; required for the documented WebNative, Gradle, and devcontainer experience   |

All `.node-version` files, including the root, mobile, web, and any future
projects, must remain byte-for-byte identical. `npm run test:monorepo` checks
this invariant across the workspace and its submodules.

The SSH remotes and Ariane submodules require working GitHub SSH credentials.

## First-time setup

Clone recursively when possible:

```bash
git clone --recurse-submodules git@github.com:OpenSpeleo/monorepo.git
cd monorepo
make setup
make doctor
```

If the clone already exists, the same two Make targets are sufficient.

`make setup` is idempotent and performs these operations:

1. Reads and validates `.gitmodules`.
2. Synchronizes configured submodule URLs and initializes missing submodules
   recursively at their recorded commits. Existing branches, dirty worktrees,
   and intentional gitlink differences are preserved, including inside Ariane.
3. Creates ignored `apps/web/.envs/test.env` from its committed template when
   absent.
4. Runs root `npm ci`.
5. Syncs the frozen root Python 3.14 integration environment into `.venv`, or
   `UV_PROJECT_ENVIRONMENT` when set, including the virtual web dependency and
   editable shared libraries.

Setup does not install hooks, advance existing checkouts, commit, publish, or
start a deployment.

`make doctor` checks Git, Node, npm, uv, Cargo, Rust, and Java; configured URLs;
actual repository roots; and recursive submodule initialization. Checkout
changes are reported without resetting them.

## Environment files

All paths below are relative to the monorepo root. Each local environment file
is Git-ignored; its corresponding `.dist` template is committed. Copy the
template when the local file is missing, then fill in the values required by
that application or package. Preserve existing local files.

| Local environment file                                        | Committed template                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------ |
| `apps/ariane_plugin/org.speleodb.ariane.plugin.speleodb/.env` | `apps/ariane_plugin/org.speleodb.ariane.plugin.speleodb/.env.dist` |
| `apps/compass_sidecar/.env`                                   | `apps/compass_sidecar/.env.dist`                                   |
| `apps/mobile/.env`                                            | `apps/mobile/.env.dist`                                            |
| `apps/web/.env`                                               | `apps/web/.env.dist`                                               |
| `apps/web/.envs/test.env`                                     | `apps/web/.envs/test.env.dist`                                     |
| `packages/python/compass_lib/.env`                            | `packages/python/compass_lib/.env.dist`                            |
| `packages/python/openspeleo_lib/.env`                         | `packages/python/openspeleo_lib/.env.dist`                         |

The web Compose stack also loads these committed environment files directly;
they have no separate `.dist` templates:

| Environment file           | Purpose                                  |
| -------------------------- | ---------------------------------------- |
| `apps/web/.envs/.django`   | Local Django container configuration     |
| `apps/web/.envs/.postgres` | Local PostgreSQL container configuration |

`make setup` creates only the missing web test environment file. The
devcontainer's setup service creates both missing web environment files and
updates its managed local-service settings. Other applications and packages
require their own local environment configuration. There is no root `.env` file;
the devcontainer mounts `apps/web` at `/app`, so `apps/web/.env` is available
there as `/app/.env`.

## Command reference

### Setup and validation

| Command              | Effect                                                             |
| -------------------- | ------------------------------------------------------------------ |
| `make setup`         | Initialize missing submodules and install root npm/uv environments |
| `make doctor`        | Validate tools, URLs, repository roots, and submodules             |
| `make pre-commit`    | Run explicit root, web, and five Python-package prek checks        |
| `make test-monorepo` | Run the root Node orchestration and launcher tests                 |

### Application and package builds

| Command                                       | Effect                                                                                                                             |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `make dev-web`                                | In the container, run `/start` from `/app`; on the host, start Django, Celery worker/beat, and Kanchi through `apps/web/local.yml` |
| `make dev-web-isolated STACK=speleodb_fresh`  | Build and start a fresh project-prefixed web stack without using existing volumes                                                  |
| `make stop-web-isolated STACK=speleodb_fresh` | Stop that isolated stack while preserving all of its volumes                                                                       |
| `make build-web`                              | Build the web Vite assets through the root npm workspace                                                                           |
| `make build-mobile`                           | Type-check and build the mobile Vite application                                                                                   |
| `make sync-mobile`                            | Run Capacitor sync from the mobile workspace                                                                                       |
| `make check-rust`                             | Cargo-check Compass and `openspeleo_core`, all targets and features, with locks                                                    |
| `make build-compass-ui`                       | Build the Compass Trunk frontend in release mode                                                                                   |
| `make build-compass-tauri`                    | Compile the Compass Tauri application in release mode without bundling                                                             |
| `make build-core`                             | Build the `openspeleo_core` Python wheel with maturin                                                                              |
| `make build-ariane`                           | Run Ariane's Gradle `build test` tasks                                                                                             |

## Workspace tooling

`tools/workspace.mjs` provides only `setup` and `doctor`; prefer their Make
wrappers. Direct `node tools/workspace.mjs setup` initializes missing submodules
only, while `make setup` also performs the environment steps above. Git branch,
update, commit, and publication operations use native Git commands.
`node tools/workspace.mjs doctor --submodules-only` checks repository
configuration and initialization without requiring every application toolchain.

Run the focused tests or the complete suite:

```bash
node --test tools/workspace.test.mjs
node --test tools/precommit-launcher.test.mjs
make test-monorepo
```

Workspace tests use temporary local repositories and do not publish or depend on
network access. Launcher tests use fake binaries and never install hooks.
`tools/devcontainer.test.mjs` checks repository trust, privilege transitions,
and merged Compose service contracts; its Compose check skips when the CLI is
unavailable. Do not place generated files, caches, or downloaded executables in
`tools/`.

## Working with submodules

### Inspecting and reproducing a checkout

```bash
git status --short
git diff --submodule=log
git diff --cached --submodule=log
git submodule status --recursive
git submodule foreach --recursive 'git status --short'
```

A leading `-` in submodule status means uninitialized; `+` means its checkout
differs from the recorded gitlink. Neither is permission to discard work.

After checking that all affected repositories are clean, reproduce the commits
recorded by the parent with:

```bash
git submodule sync --recursive
git submodule update --init --recursive
```

This normally leaves submodules at detached HEADs. It does not follow their
configured branch tips. `make setup` is safer when existing development
checkouts must remain untouched: it initializes only missing repositories.

### Updating one repository from upstream

Review the child repository's state before switching branches or pulling:

```bash
git -C apps/mobile status --short
git -C apps/mobile fetch origin
git -C apps/mobile switch master
git -C apps/mobile pull --ff-only origin master
git diff --submodule=log -- apps/mobile
```

Use the branch configured in `.gitmodules`. All nine currently use `master`; use
`main` only after verifying that upstream no longer has `master` and updating
the configuration. Resolve diverged histories explicitly; do not reset or stash
automatically. Refresh integration locks and run relevant builds when upstream
manifests change. An updated checkout becomes reproducible only after the parent
records its gitlink.

### Developing and publishing changes

Create a branch inside each repository you intend to edit:

```bash
git -C apps/mobile switch -c feature/offline-map
```

The parent's branch and each child branch are independent. Inspect staged and
unstaged changes inside the child before committing. When publication is
explicitly requested, commit and push the child first, then record that
reachable commit in the parent:

```bash
git -C apps/mobile add <changed-files>
git -C apps/mobile commit -m "feat: add offline map recovery"
git -C apps/mobile push -u origin feature/offline-map
git add apps/mobile
git commit -m "chore: update mobile integration revision"
```

These examples are manual publication steps, not setup behavior. Never stage,
commit, push, open a PR, merge, or deploy without explicit authorization. Keep
independent parent gitlink updates and root orchestration changes separate when
practical. A coupled integration commit may record several child commits, but
each child retains its own history and upstream PR.

Before a parent commit, check that every recorded child commit is available from
its configured upstream; a local-only gitlink breaks other clones and CI. Use
Git inside the child for product pushes. The monorepo's `origin` is for
integration changes only.

### Adding another repository

Use native `git submodule add --name <name> -b <branch> <url> <path>` after
verifying the original upstream and branch. Update applicable npm/uv sources,
root hook exclusions, explicit launcher coverage, editor/container paths, tests,
CI, and documentation. Preserve standalone manifests, locks, and instructions. A
path or URL change requires a reviewed migration, including existing local
checkouts and nested Git metadata.

## Ariane's nested submodules

`apps/ariane_plugin` owns these two API gitlinks:

- `com.arianesline.ariane.plugin.api`
- `com.arianesline.cavelib.api`

They are declared only in `apps/ariane_plugin/.gitmodules`, with paths relative
to Ariane. The root `.gitmodules` declares Ariane itself; do not duplicate its
children there. Recursive initialization reaches both APIs through Ariane.

For an API update, fetch and check out the intended reachable commit inside the
API repository. Commit its pointer in Ariane, publish Ariane, then record
Ariane's new pointer in the monorepo, with explicit authorization for each
publication action. A deliberate pointer difference must never be reset by
setup.

## JavaScript workspace and WebNative

The private root npm workspace contains:

- `apps/mobile`
- `apps/web`
- future package directories matching `packages/typescript/*/`

The root package is not published. WebNative officially understands npm
workspaces, so opening the repository root lets the extension discover both
applications. Keep the trailing slash in the reserved TypeScript workspace glob:
it prevents the extension from treating `packages/typescript/README.md` as a
project. Select `mobile` in WebNative and use Build or Run → Web.

For a terminal-based mobile development server:

```bash
npm run dev --workspace=apps/mobile -- --host 0.0.0.0 --port 8100
```

### Nested installation strategy

`.npmrc` contains:

```ini
install-strategy=nested
```

This is intentional. Capacitor packages and mobile postinstall patches must
resolve through `apps/mobile/node_modules`; hoisting can break native Android
and iOS paths. Code imported directly by an application must also be declared
directly by that application rather than borrowed transitively.

The root `allowScripts` list permits only the known workspace install scripts
needed by Sentry, Core.js, and optional macOS filesystem support.

### Lockfile contracts

- `package-lock.json` is the integrated monorepo lock used by root `npm ci`.
- `apps/mobile/package-lock.json` is the standalone mobile lock.
- `apps/web/package-lock.json` is the standalone web lock.

Dependency changes must update the affected standalone lock and the root lock.
After editing an app manifest, refresh without executing lifecycle scripts:

```bash
npm install --prefix apps/mobile \
  --package-lock-only --ignore-scripts --workspaces=false
npm install --package-lock-only --ignore-scripts
```

Replace `apps/mobile` with `apps/web` for a web dependency. Use a normal
standalone `npm install --prefix ... --workspaces=false` when intentionally
running and testing application lifecycle scripts, then refresh the root lock.

Validate both contracts when changing dependency topology:

```bash
npm ci --prefix apps/mobile --workspaces=false
npm run build --prefix apps/mobile --workspaces=false
npm ci
npm run build:mobile
test -d apps/mobile/node_modules/@capacitor/core
```

The mobile lockfile prek check includes `--workspaces=false`, ensuring the
standalone lock is checked even when invoked from the enclosing workspace.

### Root npm scripts

```bash
npm run lint
npm run test
npm run build
npm run build:mobile
npm run build:web
npm run cap:sync
npm run test:mobile
npm run test:web
npm run test:monorepo
npm run install:mobile
npm run install:web
```

## Python integration project

The root uv project is deliberately **not** a uv workspace. It requires Python
3.14 and uv 0.12.17 or newer, enforced by `tool.uv.required-version`. The web
dependency uses metadata-style overrides that older uv releases cannot resolve.
Root CI pins uv 0.12.17. The project combines two integration roles:

- all five `packages/python/*` projects are editable path dependencies;
- `apps/web` is a virtual path dependency with its `local` extra enabled.

Virtual means uv installs the web dependency graph but does not attempt to
package the Django application. Run the application directly from `apps/web`;
edits to the application are therefore live. The four web dependencies
`mnemo-lib`, `compass-lib`, `openspeleo-lib`, and `openspeleo-core` resolve to
the root's editable sources, so edits below `packages/python/*` are also live.
Maturin builds the native `openspeleo_core._rust_lib` module with Cargo's `dev`
profile.

This preserves the ability to enter any package directory and run its standalone
`uv lock` without uv redirecting to a parent workspace.

The root `uv.lock` remains the integrated lock for exercising the packages
together, and root `.venv` is the default integration environment.

Install it with:

```bash
make install-python
# Equivalent:
UV_PROJECT_ENVIRONMENT=.venv uv sync --python 3.14 --all-extras --frozen
```

To run SpeleoDB from the root integration environment on the host:

```bash
source .venv/bin/activate
cd apps/web
python manage.py runserver
```

Each Python submodule retains its own `pyproject.toml` and `uv.lock` for
standalone use. Because there is no parent uv workspace, package-local commands
operate on the package's own lock. A shared-package dependency update therefore
requires both the package lock and the root integration lock:

```bash
cd packages/python/compass_lib
uv lock
cd ../../..
uv lock
uv sync --all-extras --frozen
```

`apps/web` still owns an independent standalone project and lock. Neither file
contains a path back to `packages/python`, so standalone clones continue to
resolve the published versions from PyPI:

```bash
cd apps/web
cp -n .envs/test.env.dist .envs/test.env
uv sync --extra local --frozen
uv run pytest
```

The `local` web environment provides `mypy`, which executes the authoritative
web type-checking hook. Root development dependencies allow `prek>=0.5.3,<1` to
remain compatible with the web repository's prek 0.5.3 pin.

## Rust and native builds

There is deliberately no root Cargo workspace. `apps/compass_sidecar` is already
a Cargo workspace, while `packages/python/openspeleo_core` is an independent
PyO3 crate. Nesting them in another Cargo workspace would be invalid and would
damage standalone behavior.

`rust-toolchain.toml` selects stable Rust with:

- `rustfmt`
- `clippy`
- `wasm32-unknown-unknown`

Use the linked build targets:

```bash
make check-rust
make build-compass-ui
make build-compass-tauri
make build-core
```

Compass UI builds require Trunk. Tauri compilation requires the Linux WebKit,
SSL, app-indicator, Clang, and pkg-config libraries installed by the Linux CI
job or separately on the host. `build-compass-tauri` compiles with
`--no-bundle`, so it validates the application without producing platform
installers.

`build-core` runs `uv run --frozen maturin build` from
`packages/python/openspeleo_core` and writes the wheel under that submodule's
ignored build output.

## Java and Gradle

Ariane remains a standalone Gradle project:

- wrapper: Gradle 9.4.1;
- toolchain/source/target: Java 25;
- root build: none;
- canonical build: `make build-ariane` or
  `cd apps/ariane_plugin && ./gradlew build test`.

Do not add a second root Gradle build or replace the wrapper with a system
Gradle installation. The VS Code Gradle extension imports Ariane as a nested
project and uses its wrapper/build server, which preserves its task tree and
run/debug shortcuts.

## VS Code configuration

Open the monorepo root, not an individual prefix, for integrated development.

Recommended extensions include WebNative, Java, the Java extension pack, Gradle,
rust-analyzer, Tauri, Python, Ruff, Docker, Makefile Tools, YAML, and Even
Better TOML.

Root settings provide:

- `gradle.nestedProjects: ["apps/ariane_plugin"]`;
- automatic Java/Gradle import, wrapper use, and Gradle build server;
- rust-analyzer linked directly to both existing Cargo manifests;
- all Cargo features, all targets, and Clippy checking;
- host Python interpreter `${workspaceFolder}/.venv/bin/python`;
- terminal startup at the monorepo root.

Inside the web devcontainer, Python comes from the image-owned virtual
environment at `/opt/speleodb-venv/bin/python`. The environment lives outside
the `/app` bind mount, so opening the container cannot create a Linux virtual
environment in the host checkout.

## Devcontainer operation

The root devcontainer composes directly on top of `apps/web/local.yml`; it does
not duplicate the web application's container definition.

### Composition

- Base Compose file: `apps/web/local.yml`
- Override: `.devcontainer/compose.override.yml`
- Zed compatibility link: `.devcontainer/compose` points to `apps/web/compose`
- VS Code service: `django`
- Root workspace: `/workspace`
- Standalone web mount: `/app`
- Remote user: `dev-user`
- Existing Django image, `/entrypoint`, `/start`, PostgreSQL, Redis, RustFS, and
  environment files: preserved; standalone host networking is replaced by
  Compose networking in the root devcontainer

The two mounts are intentional. Root tooling operates from `/workspace`, while
the existing web image and scripts continue to see the web application at
`/app`, exactly as in its standalone repository.

The devcontainer `PYTHONPATH` also includes `/app`, so shells opened at
`/workspace` can source `/entrypoint` and import `compose.wait_for_postgres`.

The `django`, `django-webserver`, `celery-worker`, `celery-beat`, and one-shot
`setup` services also receive the monorepo at `/workspace`. Their `PYTHONPATH`
places these live source roots ahead of the published packages installed in the
standalone image:

- `/workspace/packages/python/mnemo_lib`
- `/workspace/packages/python/compass_lib`
- `/workspace/packages/python/openspeleo_lib`
- `/workspace/packages/python/openspeleo_core/src_python`

The first three are direct source overlays and need no installation. The
PyO3-backed `openspeleo_core` additionally receives a monorepo-only PEP 660
editable install because Linux must compile its own native extension. The
standalone image still resolves the published wheel and remains Rust-free by
default; `.devcontainer/compose.override.yml` opts into the Rust toolchain only
for monorepo containers.

The opt-in toolchain layer appears before the Dockerfile's Python dependency
layer, so web dependency changes reuse the Rust layer. Maturin explicitly uses
the Cargo `dev` profile for editable builds. The core project's uv cache keys
include `pyproject.toml`, `Cargo.toml`, `Cargo.lock`, and every path below
`src_rust`; unchanged native sources reuse uv's cached build. Cargo, uv, and
native build artifacts use the project-scoped
`speleodb_local_monorepo_python_build_cache` volume instead of host caches. The
uv cache remains a real directory at `/monorepo-python-build-cache/uv` inside
that volume; Cargo uses sibling directories. The helper performs a versioned,
one-time ownership migration of an empty or legacy volume, then drops from root
to `dev-user` before invoking uv or Cargo. All later cache and virtual-
environment writes therefore use the same unprivileged account as prek and the
interactive terminal. Standalone web containers retain their separate runtime
cache directory at `/app/.uv/cache`.

The compatibility link exists for Zed 0.233.x's native devcontainer parser,
which resolves a Compose service's relative Dockerfile from the directory that
contains `devcontainer.json` instead of from the Compose build context. The link
keeps `apps/web/compose/Dockerfile` authoritative without duplicating it. Do not
replace the link with a copied Dockerfile; remove it only after the supported
Zed stable release correctly resolves Compose Dockerfile paths.

The root override sets the Compose project name to `speleodb-monorepo`. Its
containers, locally built images, network, and volumes use the
`speleodb-monorepo-` prefix. VS Code respects the explicit Compose project name.
An explicit `-p` or `COMPOSE_PROJECT_NAME` overrides the project name;
`COMPOSE_INSTANCE_PREFIX` can separately override container and Node-volume
prefixes. Standalone web resources retain their own names.

Changing the project name does not rename or migrate existing Docker resources.
An existing `web` project and its volumes remain intact; the new project uses
separate volumes. Migrate any existing development data deliberately before
switching projects if you need to retain it in the new stack. Rebuild/reopen the
devcontainer to use the new configuration after resolving any old port bindings.

Compose overlays `/app/node_modules` with a devcontainer-specific named volume,
`speleodb-monorepo-web-node-modules` by default. Its name follows
`COMPOSE_INSTANCE_PREFIX`, so it never aliases the standalone Compose volume.
Linux native npm packages installed by `/start` therefore cannot overwrite a
macOS or Windows host installation or inherit root ownership from a standalone
webserver.

That same volume is mounted at `/workspace/apps/web/node_modules` in the
monorepo application services. Prek executes the web project from the monorepo
path, so both paths must resolve to the same Linux dependencies. The setup job
initializes an empty or legacy volume for `dev-user`; the workspace and
webserver then run as `dev-user`, ensuring npm, Vite, prek, and editor terminals
share one ownership contract. The initialization checks the volume root first,
so a correctly owned dependency tree is not recursively scanned on every
startup.

### Automatic local-service setup

The Django workspace, webserver, Celery worker, and scheduler wait for the
one-shot `setup` service. That job starts only after PostgreSQL, Redis, and
RustFS pass their health checks and GitLab passes `/-/readiness?all=1`. GitLab
can take many minutes on its first boot; the application containers remain
pending rather than starting with incomplete dependencies.

Before the application setup begins, `.devcontainer/sync-openspeleo-core.sh`
synchronizes the core package into `/opt/speleodb-venv` with
`uv sync --inexact`. The virtual environment is created with the image, remains
outside the application bind mount, and is writable by `dev-user`. The sync
preserves the web dependency graph, writes the platform-specific extension
beside the bind-mounted Python source, and verifies that both import origins are
below the monorepo package. The setup job is otherwise idempotent:

1. copy `apps/web/.env.dist` and `apps/web/.envs/test.env.dist` to their ignored
   private counterparts when absent, without overwriting developer changes on
   later runs;
2. use the existing `python-gitlab` dependency to create or retrieve separate
   local `speleodb` development and `speleodb-test` test groups;
3. read both real group IDs rather than assuming either one;
4. disable access-token expiration enforcement in the local GitLab instance,
   validate the existing non-expiring group token, and replace it when it is
   missing, invalid, or still has an expiration date;
5. populate each private env with its own group token and RustFS bucket:
   development resources in `apps/web/.env` and isolated test resources in
   `apps/web/.envs/test.env`;
6. run Django's `create_s3_local_buckets` command to create both canonical
   buckets and apply their local policy/CORS configuration;
7. apply Django migrations;
8. create or repair the local superuser `contact@speleodb.org` with password
   `contact`, country USA (stored as `US`), full staff/superuser privileges, and
   a verified primary email.

The superuser command is restricted to `DEBUG` settings. It deliberately uses
`set_password` directly so local password validators do not reject the fixed
development credential. Repeated setup runs repair its country, flags, password,
and allauth email verification without creating duplicate users or email
records.

The GitLab root credentials, local bootstrap token, RustFS access key/secret,
and placeholder Mapbox token are fixed development-only values in Compose. The
generated development and test GitLab group tokens are private and are never
committed. Resetting a GitLab or RustFS volume is recovered on the next Compose
start.

### Isolated fresh Compose stack

Docker does not support renaming a volume in place. Compose project names solve
the problem safely: every project receives a separate set of prefixed volumes.
The container names in `apps/web/local.yml` also accept
`COMPOSE_INSTANCE_PREFIX`, avoiding collisions with stopped containers from the
normal stack.

Run a complete stack against new, empty volumes while preserving the old stack:

```bash
make dev-web-isolated STACK=speleodb_fresh
```

The standard host ports must be free, so stop the old stack first, but do not
remove it. The command creates volumes such as
`speleodb_fresh_speleodb_local_postgres_data` and
`speleodb_fresh_local_web_node_modules`; it never reads, renames, or deletes
volumes owned by another Compose project or devcontainer prefix.

On Linux, the preserved host-network configuration exposes Django directly on
port 8000. On Docker Desktop, this requires Docker's host-networking support.
The root devcontainer uses the separately documented published-port layout. An
inside-container health check remains available at `/api/health/details/`.

Stop the isolated containers while retaining their new volumes:

```bash
make stop-web-isolated STACK=speleodb_fresh
```

Do not add `--volumes` when the isolated data should be retained. The private
`apps/web/.env` is shared by the source checkout; the idempotent setup job
revalidates and refreshes its generated GitLab values when switching stacks.

### Container provisioning

The root devcontainer starts the web application, Celery worker and scheduler,
and Kanchi task monitoring. The existing `apps/web/compose/Dockerfile` installs
Python, Node, and the web application's dependencies. Its monorepo-only build
argument additionally installs the minimal stable Rust toolchain required by the
web application's editable `openspeleo_core` dependency; it does not install
Compass, Tauri, Trunk, wasm-pack, Java, or mobile tooling. The Compose `setup`
service prepares that native dependency before web infrastructure, migrations,
buckets, GitLab provisioning, and local-superuser initialization.

Post-create adds `/app/.devcontainer/bashrc.override.sh` to the remote user's
shell configuration idempotently, installs `openspeleo_core` as editable into
the workspace container using the cached native build, and verifies that all
four web-library imports resolve below `/workspace/packages/python`. It does not
run root `make setup`, perform root npm installation, call `cargo install`, or
build Mobile, Compass, Tauri, or Ariane.

After changing Rust code, refresh the extension and restart the webserver and
Celery services to load the new module:

```bash
/workspace/.devcontainer/sync-openspeleo-core.sh
```

Pure-Python changes require no synchronization.

If a cache volume was created by an older configuration and uv reports a
permission error, run the synchronization helper once from the workspace
container. It elevates only long enough to migrate the shared cache ownership,
then runs the editable installation as `dev-user`:

```bash
/workspace/.devcontainer/sync-openspeleo-core.sh
```

### Ports

| Port   | Use    |
| ------ | ------ |
| `8000` | Django |
| `8765` | Kanchi |

The root devcontainer publishes these ports on the host loopback interface
through Docker Compose. The standalone web Compose file retains host networking,
while the root override uses a shared workspace/webserver network namespace so
editors without `forwardPorts` support can still use `http://localhost:8000`.
Kanchi is available at `http://localhost:8765`. Upstream dependency mappings
remain in place for PostgreSQL, Redis, GitLab, RustFS, and optional test Redis;
browser-facing GitLab and artifact URLs depend on them. Test presigned artifact
URLs use `http://rustfs:9000` because tests make HTTP requests from inside
Compose; development browser artifact links continue using
`http://localhost:9000`. Celery uses Redis database 1 for its broker, while the
application cache uses database 0.

All long-running root devcontainer services use `restart: unless-stopped`, so a
webserver or dependency terminated by resource pressure restarts without an
editor-driven Compose recreation. The `setup` container is intentionally a
one-shot job: `Exited (0)` is its healthy completed state. Remote UID rewriting
is disabled so the workspace, setup job, and webserver consistently use
`dev-user` UID/GID 1000 on their shared cache and Node volumes. Git receives
explicit `safe.directory` entries for `/workspace`, all nine submodule roots,
and Ariane's nested API repositories through the container environment. This
trust is preserved when setup drops privileges. Run Git at `/workspace/...` so
relative submodule Git metadata resolves correctly; `/app` remains the
application and npm execution path. GitLab-backed tests create unpredictable
repository paths below `.workdir`; the private test env enables Git wildcard
trust only in pytest processes so those isolated bind-mounted clones work
without broadening trust for normal development commands.

Opening or reopening the devcontainer uses the editor's normal Compose build/up
path with the complete `runServices` graph. There is no separate host-side
restart path: Compose owns dependency ordering, health gates, setup completion,
and service reconciliation in both the standalone repository and monorepo. The
root override changes only monorepo mounts, networking, and toolchain additions;
it does not replace Compose lifecycle semantics. Named data volumes remain
persistent across service rebuilds and recreation.

### Starting and using the container

Initialize the submodules on the host with `make setup` before opening the
devcontainer. In VS Code, run **Dev Containers: Reopen in Container**. After the
post-create step completes:

```bash
make dev-web
```

`make dev-web` executes `/start` from `/app` and occupies that terminal. The
container does not start or build Mobile, Compass, Tauri, or Java projects. Its
Rust toolchain exists only to develop the web runtime's `openspeleo_core`
dependency. Editing SpeleoDB or any overlaid Python source affects the next
reload without rebuilding the container; Rust edits require the synchronization
command above.

### Local debug instrumentation

Django Debug Toolbar remains installed, rendered, and reachable at `__debug__/`
in the local runtime. Every default panel is listed in `DISABLE_PANELS`, so the
toolbar is visible but its diagnostic tools collect no panel data until a
developer enables one. Expensive panel sub-options such as template context,
stack traces, SQL prettification, and project-code profiling also default to
off.

Enable only the panel needed from the toolbar UI; the selection applies to the
next request and requires no settings edit or webserver restart. See
`apps/web/docs/local-debugging.md` for the exact contract and verification.

To validate or rebuild outside VS Code:

```bash
docker compose \
  -f apps/web/local.yml \
  -f .devcontainer/compose.override.yml \
  config

npx -y @devcontainers/cli build --workspace-folder .
```

The standalone Compose container names default to `speleodb_*`; the root
devcontainer override defaults to `speleodb-monorepo-*`. For any additional
isolated stack, always set both a Compose project name and
`COMPOSE_INSTANCE_PREFIX`, or use the documented `make dev-web-isolated` target.
Do not remove another developer's containers or volumes without their
permission.

The container intentionally omits Tauri CLI, Trunk, wasm-pack, Java, Gradle,
mobile tooling, Android Studio/SDK, Xcode, signing credentials, and device
tooling.

## Explicit pre-commit and mypy policy

Root `.pre-commit-config.yaml` validates only root orchestration. Its exclusions
cover all nine `.gitmodules` paths, and `.prekignore` retains the Mobile,
Ariane, and Compass boundaries. Each repository's configuration remains
authoritative. Prek does not discover submodules, so the explicit launcher runs
root, web, and each of the five Python repositories separately:

```bash
make pre-commit
```

The launcher finds the root from its own location, locates prek and regular mypy
(never dmypy), and fails if a required executable or repository is missing. Mypy
is required when selecting web checks. Options apply to the selected repository
invocations; `apps/web:mypy` is translated to the local `mypy` hook:

```bash
uv sync --project apps/web --extra local --frozen
bash scripts/run-precommit.sh apps/web:mypy --all-files
```

The optional leading selector is `[<project>[:<hook>]]`, followed by native
options. Use `.` for all root hooks or `.:check-json` for one root hook.
Omitting the selector runs all eligible repositories. File/ref/config arguments
are rejected because paths and commits are repository-specific; run those checks
inside the owning repository. Mobile, Ariane, and Compass checks remain manual:

```bash
(cd apps/mobile && prek run --all-files)
(cd apps/ariane_plugin/org.speleodb.ariane.plugin.speleodb && prek run --all-files)
(cd apps/compass_sidecar && prek run --all-files)
```

No command installs a Git hook or configures `core.hooksPath`.

## Root CI

`.github/workflows/ci.yml` runs for pull requests and pushes to `master`. Every
job checks out all submodules recursively. Root CI validates only; it does not
publish packages, deploy applications, create releases, push repositories, or
open PRs.

| Job             | Environment                            | Validation                                                                                                                                       |
| --------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `orchestration` | Ubuntu, Node from `.node-version`      | Root Node tests, submodule configuration validation, `git diff --check`                                                                          |
| `javascript`    | Ubuntu, Node 26, root npm cache        | Root `npm ci`, app-local Capacitor assertion, both app lints, mobile build and Capacitor sync, mobile/web tests, both builds, clean tracked diff |
| `rust`          | Ubuntu 24.04, stable Rust, Python 3.14 | Tauri system libraries, Trunk/Tauri CLI, both Cargo checks, Compass Trunk build, Tauri no-bundle compile, maturin wheel, clean tracked diff      |
| `ariane`        | Ubuntu, Temurin JDK 25                 | Ariane Gradle 9.4.1 `build test`, clean tracked diff                                                                                             |
| `web-mypy`      | Ubuntu, Python 3.14                    | Root integration-lock check, generated test env, standalone web sync, required `mypy`, authoritative mypy hook, clean tracked diff               |

The root and recursive child checks inspect both staged and unstaged diffs and
intentionally fail when formatting, lock, Capacitor sync, or build hooks modify
tracked files. Regenerate and commit those changes locally rather than allowing
CI to hide them.

## Local CI-equivalent checks

Run the portions relevant to your change. A broad validation pass is:

```bash
make doctor
npm run test:monorepo
npm ci
npm run lint
npm run build:mobile
npm run cap:sync
npm run test:mobile
npm run test:web
npm run build
make check-rust
make build-compass-ui
make build-compass-tauri
make build-core
make build-ariane
make pre-commit
git diff --check
git diff --exit-code
```

Some commands are platform-specific or expensive. Root CI is the reference Linux
environment for Tauri, maturin, and Java; the devcontainer is scoped to web
development only.

## Troubleshooting

### `mypy` cannot be found

Install the web local environment, then rerun the hook:

```bash
uv sync --project apps/web --extra local --frozen
```

### A submodule is missing or differs from its recorded commit

Run `git submodule status --recursive` and `make doctor`. Use `make setup` to
initialize missing checkouts while preserving initialized development state.
Only run `git submodule update --init --recursive` when you intentionally want
to reproduce the parent's recorded commits and affected checkouts are clean.

### Detached HEAD inside a submodule

A detached HEAD is normal after pinned checkout. Before editing, create a branch
in that repository:

```bash
git -C apps/mobile switch -c feature/name
```

Do not switch or reset a checkout until any existing work is understood.

### Capacitor dependency is not app-local

Confirm `.npmrc` still uses the nested strategy, remove only generated install
state when safe, and reinstall from the root lock:

```bash
npm ci
test -d apps/mobile/node_modules/@capacitor/core
```

### Gradle tasks are absent in VS Code

Open the monorepo root, install the recommended Java and Gradle extensions,
confirm Java 25 is available, and reload the window. Ariane must remain listed
under `gradle.nestedProjects`, with wrapper and build-server import enabled.

## Releases and deployment

Release, package publication, mobile signing, and application deployment follow
the standalone repositories' own documentation and CI. Root CI never performs
these actions. Publish a child commit before recording it in the parent so
clones can fetch every integration revision.

Railway web, worker, and scheduler deployments source
`OpenSpeleo/SpeleoDB:master`. Keep the web repository's `.railway/railway.ts`,
`railpack.json`, standalone locks, and build/start commands authoritative. The
monorepo is not their deployment source: parent gitlink changes do not deploy
them. Never add monorepo-only Python paths or root workspace assumptions to the
standalone deployment. Updating those services requires an explicitly requested
change in the web repository and its deployment workflow.
