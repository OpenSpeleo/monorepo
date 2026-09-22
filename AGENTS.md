# SpeleoDB Monorepo Agent Instructions

## Scope and instruction hierarchy

These instructions apply from the monorepo root. Each standalone submodule may
contain its own `AGENTS.md`. Before changing a repository, read its closest
instructions and obey both sets. Child instructions control implementation and
verification; this root file controls integration, Git, workspace, container,
and publication behavior. Run root orchestration commands from the root.

## Repository model

This integration repository contains nine Git submodules. `.gitmodules` is the
sole authoritative mapping of names, paths, original URLs, and tracking
branches. Each parent gitlink pins an exact commit; branch configuration does
not make normal checkout follow upstream automatically.

| Name                              | Path                              | Tracking branch |
| --------------------------------- | --------------------------------- | --------------- |
| `apps/ariane_plugin`              | `apps/ariane_plugin`              | `master`        |
| `apps/compass_sidecar`            | `apps/compass_sidecar`            | `master`        |
| `apps/mobile`                     | `apps/mobile`                     | `master`        |
| `apps/web`                        | `apps/web`                        | `master`        |
| `packages/python/ariane_lib`      | `packages/python/ariane_lib`      | `master`        |
| `packages/python/compass_lib`     | `packages/python/compass_lib`     | `master`        |
| `packages/python/mnemo_lib`       | `packages/python/mnemo_lib`       | `master`        |
| `packages/python/openspeleo_core` | `packages/python/openspeleo_core` | `master`        |
| `packages/python/openspeleo_lib`  | `packages/python/openspeleo_lib`  | `master`        |

Future JavaScript packages belong under `packages/typescript/`; the npm
workspace glob is `packages/typescript/*/` to match directories only.

Use native Git for submodule updates, branches, and publication. The small
`tools/workspace.mjs` helper provides only setup and doctor; do not add another
manifest or publishing abstraction.

## Non-negotiable rules

1. Preserve user work in the parent and every child repository. Never reset,
   overwrite, clean, stage, or reformat unrelated files or gitlinks.
2. Inspect staged and unstaged state separately before and after work.
3. Do not stage, commit, push, create a PR, merge, release, or deploy unless the
   user explicitly requests that action.
4. Product edits belong to their child repositories. Verify the child's origin
   against `.gitmodules` before publication; never use the parent's origin as a
   product deployment target.
5. Publish child commits before recording them in a parent commit. Every pinned
   revision must be fetchable from its configured upstream.
6. Preserve initialized branches, dirty state, and intentional pointer changes
   during setup. Never automatically stash or reset to make an update succeed.
7. Keep independent parent gitlink updates and root orchestration changes in
   separate commits when practical. Coupled updates may share a parent commit,
   but each child repository retains its own commits and PRs.
8. Preserve standalone manifests, locks, instructions, CI, and release behavior.
9. Do not create a root Cargo workspace; the Rust manifests remain independent.
10. Do not create a root uv workspace. Editable path sources must allow each
    package's `uv lock` to use its own project.
11. Do not create a root Gradle build; Ariane uses its own wrapper.
12. Do not install Android SDK or Apple signing tooling in the shared Linux
    devcontainer unless the user explicitly changes that policy.
13. Do not install or configure Git/pre-commit hooks. Never run `prek install`,
    `pre-commit install`, or set `core.hooksPath`.
14. Root CI validates only. Do not add deployment, release, publication, or
    PR-creation behavior without explicit authorization.

## Temporary agent files

Keep agent plans, task lists, TODO tracking, progress notes, review notes, and
scratch lessons outside the repository tree, including all submodules. Use a
unique task directory under `/tmp/` (for example, create one with
`mktemp -d /tmp/speleodb-task.XXXXXX`) or another OS temporary directory whose
resolved path is outside every checkout.

Never create or update these working files inside the checkout, even in ignored
directories such as `tasks/`, `todos/`, or `plans/`. Never stage or commit them.
Existing tracked task and lesson files are historical references; do not append
new work to them. Keep durable product and architecture documentation in
`docs/`, without embedding task checklists or linking to temporary files. Before
an authorized commit, inspect the staged filenames and exclude all agent working
files.

## Required initial inspection

Before editing, inspect the parent and each affected child:

```bash
git status --short
git diff --name-only
git diff --cached --name-only
git branch --show-current
git submodule status --recursive
```

- Identify root versus child ownership and read the closest `AGENTS.md`.
- Read `.gitmodules` before submodule operations and inspect affected child
  staged/unstaged state with `git -C <path> ...`.
- Use `make doctor` when environment or repository configuration matters.
- Record pre-existing staged files and pointer changes, and verify they remain
  intact after work. A dirty file does not automatically belong to this task.

## Ownership boundaries

Root-only orchestration includes `.devcontainer/`, root `.github/`, `.vscode/`,
`.gitmodules`, `.npmrc`, `.pre-commit-config.yaml`, `.prekignore`, root npm and
Python manifests/locks, `rust-toolchain.toml`, `Makefile`, `README.md`,
`AGENTS.md`, `scripts/run-precommit.sh`, and `tools/`. The reserved
`packages/typescript/README.md` also belongs to the parent.

Never copy root orchestration into an upstream product PR. Files below each
submodule path belong to that repository, including locks, nested `.gitmodules`,
and CI. Child changes must work in a standalone clone. A root integration
adjustment that needs child changes must be validated in both contexts; staging
a parent gitlink does not commit child files.

## Setup and environment behavior

Canonical initialization:

```bash
git clone --recurse-submodules <monorepo-url>
cd <checkout>
make setup
make doctor
```

`make setup` validates `.gitmodules`, synchronizes configured URLs, and
recursively initializes only missing submodules, preserving initialized
branches, dirty work, and gitlink differences. It then creates ignored
`apps/web/.envs/test.env` from its tracked template when absent, runs root
`npm ci`, and syncs the frozen root Python 3.14 environment into
`${UV_PROJECT_ENVIRONMENT}` or `.venv`.

Setup never installs hooks, advances existing repositories to upstream tips,
commits, publishes, or deploys. It must preserve initialized nested Ariane
checkouts as well as top-level repositories.

`make doctor` checks Git, Node, npm, uv, Cargo, Rust, Java, configured URLs,
actual repository roots, and recursive initialization. It reports pointer
changes without resetting them.

## Canonical root commands

```bash
make setup
make doctor
make pre-commit
make test-monorepo
make install-js
make install-python
make dev-web
make build-web
make build-mobile
make sync-mobile
make check-rust
make build-compass-ui
make build-compass-tauri
make build-core
make build-ariane
```

`make pre-commit` is an explicit validation command, never an installed hook.

## Tool contract and tests

| File                                | Contract                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------ |
| `tools/workspace.mjs`               | Dependency-free setup and diagnosis using `.gitmodules`                  |
| `tools/workspace.test.mjs`          | Configuration, Node-version consistency, and initialization safety tests |
| `tools/precommit-launcher.test.mjs` | Fake-binary tests for explicit repository dispatch                       |
| `tools/devcontainer.test.mjs`       | Git-trust propagation and merged Compose service coverage                |

Prefer Make targets. Direct `node tools/workspace.mjs setup` performs only Git
initialization; direct `doctor` performs diagnosis. `doctor --submodules-only`
checks repositories without requiring every application toolchain. Do not import
this helper from application code or add unrelated scripts/caches/binaries to
`tools/`. Construct Git calls with argument arrays, never interpolated shell
strings. Validate paths and reject unsafe or duplicate configuration before
mutations.

Run focused tests during development and the complete suite before handoff:

```bash
node --test tools/workspace.test.mjs
node --test tools/precommit-launcher.test.mjs
npm run test:monorepo
make test-monorepo
```

Workspace tests use disposable local repositories without network or real
publication. Cover fresh/partial/repeated initialization, initialized feature
branches, dirty work, and deliberate gitlink differences, including nested
submodules. Launcher tests use fake executables through `PREK_BIN` and
`MYPY_BIN`; cover default and selected dispatch, argument forwarding, missing
mypy, regular web mypy, repository boundaries, and failure propagation. They
must never install hooks or run real project hooks.

Tool behavior changes require focused tests, the root suite, non-publishing
smoke checks, and synchronized README/agent documentation. Devcontainer tests
validate repository trust, privilege-transition environment preservation, and
merged service contracts; Compose-dependent checks may skip when its CLI is
unavailable.

## Git workflow

The parent and child branches are independent. A detached child HEAD is normal
after pinned checkout; create a child branch before editing:

```bash
git -C apps/mobile switch -c feature/name
```

Inspect state with `git submodule status --recursive`,
`git diff --submodule=log`, and child-local status/diffs. A leading `+` means a
pointer difference, not permission to reset. Parent status alone does not
replace child staged/unstaged inspection.

To reproduce recorded commits, first confirm affected repositories are clean,
then run:

```bash
git submodule sync --recursive
git submodule update --init --recursive
```

To intentionally advance one repository to its configured branch:

```bash
git -C apps/mobile status --short
git -C apps/mobile fetch origin
git -C apps/mobile switch master
git -C apps/mobile pull --ff-only origin master
```

All nine currently use `master`. Prefer `master` when changing configuration;
fall back to `main` only after verifying `master` is absent upstream. Never
resolve a diverged branch by automatic reset, rebase, or stash. Refresh root
locks and validate integration when the selected upstream revision requires it.

When explicitly authorized, stage and commit product files inside their child
repository, push to its original upstream, then stage and commit the parent
gitlink. Verify the child revision is reachable upstream before the parent
commit. PRs belong to each affected upstream repository. Root publication never
publishes child commits automatically.

Before an authorized commit, run staged and unstaged whitespace checks and
inspect staged filenames inside the repository being committed:

```bash
git diff --check
git diff --cached --check
git diff --cached --name-only
```

## Adding or changing a submodule

1. Verify a unique name/path, original URL, and existing tracking branch.
2. Use native `git submodule add --name <name> -b <branch> <url> <path>`.
3. Preserve standalone instructions, locks, CI, and nested submodules.
4. Update npm/uv/editor/container/CI configuration only where needed.
5. Add the path to root hook exclusions and decide explicit launcher coverage.
6. Update workspace tests, README, and these instructions.
7. Validate recursive initialization and relevant standalone/integration builds.

Treat path, URL, and tracking-branch changes as migrations. Inspect existing
checkouts, local configuration, Git metadata, upstream refs, CI, and
documentation together. Never silently rename a path or discard its local data.

## JavaScript and WebNative rules

The root npm workspace contains:

- `apps/mobile`
- `apps/web`
- `packages/typescript/*/`

Node 26 is the repository version. The root package is private.

Keep `.node-version`, `apps/mobile/.node-version`, `apps/web/.node-version`, and
every future `.node-version` in the workspace or its submodules strictly
identical, including whitespace and the trailing newline. Update them together
when changing Node versions. The workspace test discovers tracked and
non-ignored untracked version files recursively through submodules and compares
their bytes against the root file; run `npm run test:monorepo` after changes.

`.npmrc` must retain `install-strategy=nested`. Capacitor dependencies and
postinstall patch scripts rely on `apps/mobile/node_modules`. Do not switch to a
hoisted strategy to reduce disk use. If source imports a package directly,
declare that package directly in the owning app.

Maintain all relevant locks:

- root `package-lock.json` for integration;
- `apps/mobile/package-lock.json` for standalone mobile;
- `apps/web/package-lock.json` for standalone web.

For a mobile manifest change:

```bash
npm install --prefix apps/mobile \
  --package-lock-only --ignore-scripts --workspaces=false
npm install --package-lock-only --ignore-scripts
```

Use `apps/web` for a web change. Validate standalone and root installs when
changing dependency topology.

The mobile lock pre-commit check must retain `--workspaces=false`, otherwise it
validates the root workspace instead of the standalone lock.

WebNative discovers mobile and web through the npm workspace. Preserve the
trailing slash in `packages/typescript/*/` so the reserved README is not
misidentified as another application. Do not add a second WebNative-specific
project registry unless required by an upstream change.

Relevant checks:

```bash
npm ci
npm run lint
npm run test:mobile
npm run test:web
npm run build
npm run cap:sync
test -d apps/mobile/node_modules/@capacitor/core
```

Capacitor sync must not introduce unexplained tracked Android/iOS path drift.

## Python and uv rules

The root uv project must remain a normal integration project, not a uv
workspace. It uses Python 3.14 and requires uv >=0.12.17 for the upstream web
metadata-style dependency overrides. Preserve `tool.uv.required-version` and
CI's uv 0.12.17 pin. Root development dependencies allow `prek>=0.5.3,<1` to
accommodate web's prek 0.5.3 pin. Editable path sources map:

- `ariane_lib`
- `compass_lib`
- `mnemo_lib`
- `openspeleo_core`
- `openspeleo_lib`

The root also depends on `speleodb_website[local]` through
`speleodb_website = { path = "./apps/web/", package = false }`. Preserve
`package = false`: uv must install the web dependency graph without attempting
to package the Django application. Application source remains live because it is
executed directly from `apps/web`; the three pure-Python web libraries remain
live because their root path sources are explicitly editable.

Root `.venv` and `uv.lock` are integration artifacts. Each package's own
`uv.lock` remains authoritative both inside the monorepo and in standalone
clones. Running `uv lock` from a package directory must update that package
lock, not redirect to the root.

When changing a package dependency, update and verify both its standalone lock
and the root integration lock:

```bash
cd packages/python/<package>
uv lock
cd ../../..
uv lock
uv sync --python 3.14 --all-extras --frozen
```

Do not discard or replace pre-existing staged lock updates.

`apps/web` retains its independent standalone environment and lock:

```bash
cd apps/web
uv sync --extra local --frozen
uv run pytest
```

Never add `../../packages/python/*` sources to `apps/web/pyproject.toml`. Its
standalone dependency declarations and lock must continue resolving PyPI in
standalone clones. The root virtual dependency is the monorepo-only overlay.

## Explicit prek and mypy policy

There is no installed Git hook. Keep it that way. Root checks exclude all
`.gitmodules` prefixes and validate only root orchestration. Root `.prekignore`
retains `apps/mobile/`, `apps/ariane_plugin/`, and `apps/compass_sidecar/`.

Prek skips submodules during workspace discovery. `make pre-commit` therefore
runs `scripts/run-precommit.sh --all-files`, which explicitly invokes root, web,
and all five Python repositories. Mobile, Ariane, and Compass remain manual:

```bash
(cd apps/mobile && prek run --all-files)
(cd apps/ariane_plugin/org.speleodb.ariane.plugin.speleodb && prek run --all-files)
(cd apps/compass_sidecar && prek run --all-files)
```

Launcher behavior:

- Resolve the monorepo from the script location, not a caller's Git root.
- Locate prek on `PATH` or in the supported local environments/node modules.
- Locate regular `mypy` on `PATH` or in the web virtual environment when web
  checks are selected; fail explicitly if it is missing. Never use `dmypy`.
- Accept one optional leading selector `[<project>[:<hook>]]`, followed by
  native options. `.` selects root; `.:hook` selects a root hook. Omitting the
  selector runs every eligible repository. Translate qualified selectors such as
  `apps/web:mypy` to the owning repository's local hook.
- Forward supported options and fail on any repository failure.
- Reject file/ref/config arguments with instructions to run the check inside its
  owning repository; paths and refs have repository-local meanings.

Never add `.githooks/`, modify `.git/hooks/`, or configure `core.hooksPath`.

## Rust rules

Do not create a root Cargo workspace.

rust-analyzer and root commands link these manifests independently:

- `apps/compass_sidecar/Cargo.toml`
- `packages/python/openspeleo_core/Cargo.toml`

The committed toolchain uses stable Rust with rustfmt, clippy, and
`wasm32-unknown-unknown`.

Minimum validation for Rust-affecting work:

```bash
make check-rust
```

Use these when relevant:

```bash
make build-compass-ui
make build-compass-tauri
make build-core
```

`build-compass-tauri` is intentionally `--no-bundle`. `build-core` uses maturin
from the standalone `openspeleo_core` project with its lock.

Preserve each Cargo lock and standalone build layout.

## Java, Gradle, and Ariane rules

Ariane uses:

- its own Gradle 9.4.1 wrapper;
- Java 25 toolchain/source/target;
- its own settings and build files;
- two nested API gitlinks.

Canonical verification:

```bash
make build-ariane
```

Do not use system Gradle in place of `./gradlew`. Do not add a root Gradle
project.

Root VS Code configuration must retain:

- `gradle.nestedProjects: ["apps/ariane_plugin"]`;
- Gradle wrapper import;
- Gradle build server;
- automatic Java build configuration.

The root `.gitmodules` declares only the nine top-level repositories. Ariane
owns its two API gitlinks in `apps/ariane_plugin/.gitmodules`, using paths
relative to Ariane. Do not duplicate those nested entries in the root.

When updating a gitlink, fetch a reachable upstream commit, check it out inside
the submodule, then commit and publish the pointer inside Ariane before
recording Ariane's new gitlink in the monorepo, only when authorized. A leading
`+` in `git submodule status` is a pointer difference, not permission to reset
it.

## VS Code rules

The monorepo root is the intended editor workspace.

Recommended host extensions cover WebNative, Java, Gradle, rust-analyzer, Tauri,
Python, Ruff, Docker, Makefile, YAML, and TOML. The web devcontainer installs
only its Python/web subset.

Root settings link both Cargo manifests rather than inventing a workspace. The
host Python interpreter is `.venv/bin/python`; the web devcontainer uses the
image-owned `/opt/speleodb-venv/bin/python`.

When changing editor configuration, verify that:

- WebNative still discovers mobile and web through npm workspaces;
- Gradle still imports Ariane and exposes tasks/shortcuts;
- rust-analyzer loads both independent manifests;
- host and Linux virtual environments do not collide.

## Devcontainer rules

Keep `/app` on the root devcontainer's `PYTHONPATH` alongside the shared library
overlays. Interactive shells start in `/workspace` and source `/entrypoint`,
which must import `compose.wait_for_postgres` regardless of the current
directory.

The root devcontainer layers on `apps/web/local.yml` through
`.devcontainer/compose.override.yml`.

Required invariants:

- VS Code service remains `django`;
- `.devcontainer/compose` remains a relative link to `../apps/web/compose` while
  supported Zed stable releases resolve Compose Dockerfiles relative to
  `.devcontainer`; never duplicate the web Dockerfile at the root;
- monorepo mount remains `/workspace`;
- web application mount remains `/app`;
- `/app/node_modules` remains a devcontainer-specific named volume whose name
  follows `COMPOSE_INSTANCE_PREFIX`, so Linux installs never contaminate either
  host-native npm dependencies or the standalone Compose volume;
- `django`, `django-webserver`, `celery-worker`, `celery-beat`, and `setup`
  mount that same volume at `/workspace/apps/web/node_modules`, because root
  prek runs web hooks from the monorepo path and every alias must resolve the
  same Linux-native packages;
- setup initializes the Node volume for `dev-user`; the `django` and
  `django-webserver` services run as `dev-user`, and no normal monorepo npm or
  Vite process writes dependencies as root;
- root `devcontainer.json` retains `updateRemoteUserUID: false`, preventing an
  editor from changing only the workspace container's `dev-user` UID and making
  the shared Node or Python build-cache volumes unwritable;
- the shared devcontainer environment sets Git's environment-backed explicit
  `safe.directory` entries for `/workspace`, all nine submodule roots, and
  Ariane's two nested APIs before lifecycle commands; preserve this trust when
  dropping privileges. Wildcard trust belongs only in the private test env;
- Git operations use `/workspace/...`, where relative submodule metadata
  resolves; `/app` remains the application/npm execution path. Initialize
  submodules on the host before opening the devcontainer;
- `.devcontainer/prepare-web-node-modules.sh` checks the volume root before any
  recursive ownership migration; do not replace it with an unconditional startup
  `chown -R`;
- `django`, `django-webserver`, `celery-worker`, `celery-beat`, and `setup`
  mount the monorepo at `/workspace` and prepend `mnemo_lib`, `compass_lib`,
  `openspeleo_lib`, and `openspeleo_core/src_python` source roots to
  `PYTHONPATH`;
- the three pure-Python source overlays remain live and must not be replaced
  with a startup `pip`/`uv` installation;
- the standalone web image remains Rust-free by default; only the root Compose
  override enables `DOCKER_INCLUDE_MONOREPO_RUST_TOOLCHAIN=1`;
- the opt-in Rust layer remains before the web Python dependency layer;
- `openspeleo_core` is installed PEP 660 editable with Maturin's explicit `dev`
  profile before application setup, and both its Python package and Linux
  extension must resolve below the bind-mounted submodule;
- its uv cache keys retain `pyproject.toml`, `Cargo.toml`, `Cargo.lock`, and
  `src_rust/**/*`; custom uv keys replace the defaults;
- Cargo, uv, and native target caches remain in the project-scoped
  `speleodb_local_monorepo_python_build_cache` volume;
- the monorepo uv cache remains the directory `/monorepo-python-build-cache/uv`;
  the standalone web runtime cache remains `/app/.uv/cache`;
- the web dependency environment remains `/opt/speleodb-venv`, outside the
  bind-mounted `/app` checkout, and is owned by `dev-user`;
- `.devcontainer/sync-openspeleo-core.sh` must retain its versioned one-time
  `dev-user` cache-ownership migration for empty or legacy volumes, drop
  privileges before invoking uv or Cargo, and perform every normal sync as
  `dev-user`;
- existing web image, `/entrypoint`, `/start`, environment files, PostgreSQL,
  Redis, and RustFS remain authoritative; the standalone stack retains host
  networking while the root devcontainer uses Compose networking for setup and
  publishes port 8000 on host loopback from the `django` workspace namespace
  shared by `django-webserver`;
- Django, Celery worker, and scheduler services remain gated on successful
  completion of the idempotent `setup` service;
- every long-running root devcontainer service uses `restart: unless-stopped`;
  `setup` retains `restart: "no"`, and exit code zero is its healthy completed
  state;
- devcontainer creation and reopening use the editor's normal Compose build/up
  path and complete `runServices` graph, matching standalone Compose lifecycle
  semantics; do not add a host-side `initializeCommand`, raw container restart
  path, or selected-service `--no-deps` path that can bypass configuration,
  dependency, health, or setup reconciliation;
- `setup` waits for healthy PostgreSQL, Redis, RustFS, and GitLab full
  readiness, then provisions separate development and test GitLab groups/tokens
  and RustFS buckets;
- on first run, `setup` copies tracked `apps/web/.env.dist` and
  `apps/web/.envs/test.env.dist` to their ignored counterparts; later runs
  preserve developer values and update only managed local-service keys;
- GitLab provisioning uses the web application's `python-gitlab` dependency; do
  not replace its resource managers with hand-written HTTP calls;
- local GitLab disables access-token expiration enforcement; its bootstrap and
  group tokens remain non-expiring local credentials, and setup replaces legacy
  expiring tokens independently for the development and test groups;
- dynamic development GitLab credentials and the development bucket remain in
  ignored `apps/web/.env`; independently provisioned test credentials and the
  test bucket remain in ignored `apps/web/.envs/test.env`; never share these
  namespaces, hard-code either GitLab group ID, or pass generated values through
  a new entrypoint path;
- after bucket setup, `setup` runs migrations and the DEBUG-only, idempotent
  `ensure_local_superuser` command; the local account is `contact@speleodb.org`
  / `contact`, has country USA (stored as `US`), and has a verified primary
  email;
- isolated clean-stack tests use both `docker compose -p <name>` and
  `COMPOSE_INSTANCE_PREFIX=<name>`; project-prefixed volumes replace volume
  renaming, and `docker compose down` must not receive `--volumes` when data is
  being preserved;
- the root override sets `name: speleodb-monorepo`; containers, locally built
  images, network, and volumes default to `speleodb-monorepo-*`. Use
  `COMPOSE_PROJECT_NAME` for project-scoped resource names and allow
  `COMPOSE_INSTANCE_PREFIX` to override container and Node-volume prefixes;
- changing the project name creates a separate stack and volumes; it does not
  rename or migrate the old `web` project. Preserve existing containers and
  volumes, and do not silently switch existing development data;
- `make dev-web` runs the existing `/start` from `/app` inside the container;
  its host path and `make dev-web-isolated` start Django, Celery worker/beat,
  and Kanchi through the standalone Compose stack;
- Django port 8000 and Kanchi port 8765 are published on host loopback;
  `forwardPorts` remains unset so Zed cannot add conflicting bindings. Preserve
  upstream dependency port mappings, including browser-facing GitLab and RustFS
  endpoints;
- test S3 presigned/browser URLs use `http://rustfs:9000` so container-local
  HTTP tests can reach storage; development browser URLs retain
  `http://localhost:9000`;
- the active service graph includes `celery-worker`, `celery-beat`, and
  `kanchi`; Celery services share the source overlays, Python/native
  environment, cache mounts, and Compose networking, and use Redis database 1
  for their broker;
- the image's `/opt/speleodb-venv/bin/python` and installed web dependencies
  remain the container Python environment;
- stable Rust and Cargo exist only for the editable `openspeleo_core` web
  dependency; Java, Gradle, Trunk, Tauri CLI, wasm-pack, mobile tooling, Android
  SDK, and Apple tooling remain outside the web devcontainer;
- post-create reuses `.devcontainer/sync-openspeleo-core.sh` to install the
  editable package into the workspace service and verifies all four overlaid
  imports, but never runs root `make setup`, root npm/uv synchronization,
  `cargo install`, or builds/checks for another application submodule;
- Django Debug Toolbar remains installed and visible in local development, with
  every canonical default panel listed in `DISABLE_PANELS`; do not remove the
  toolbar integration to avoid panel overhead.

The post-create script adds `/app/.devcontainer/bashrc.override.sh` to the
remote user's shell idempotently, matching the standalone web devcontainer's
shell behavior, synchronizes only `openspeleo_core`, and validates the four
Python source overlays. Toolchains belong in the image build, never in
post-create.

Do not modify `apps/web/local.yml` merely to simplify root composition when an
override can preserve standalone behavior.

Compose container names accept `COMPOSE_INSTANCE_PREFIX`. Never remove or
recreate existing developer containers or volumes without explicit permission.
Use both that prefix and `docker compose -p <name>` for isolated smoke testing.
The root override must explicitly override the base file's container and built
image names so they follow the monorepo Compose project. Changing only the
project name cannot override explicit names inherited from the standalone file.

Validation:

```bash
docker compose \
  -f apps/web/local.yml \
  -f .devcontainer/compose.override.yml \
  config --quiet
```

When testing runtime startup, verify migrations, Vite, `/start`, and an HTTP
response from Django at host port 8000. The root devcontainer must not depend on
editor-specific port forwarding for that response.

## Root CI contract

`.github/workflows/ci.yml` runs on pull requests and pushes to `master`.
Recursive submodule checkout is mandatory for every job.

Jobs:

1. `orchestration`: Node tool tests, submodule configuration validation,
   whitespace validation.
2. `javascript`: Node 26, root npm CI, app-local Capacitor assertion, both
   lints, mobile build/sync, mobile and web tests, both builds, clean diff.
3. `rust`: Ubuntu 24.04 Tauri libraries, stable Rust, Python 3.14, Trunk/Tauri
   tools, two Cargo checks, Compass UI/Tauri builds, maturin build, clean diff.
4. `ariane`: Temurin Java 25, Gradle wrapper build/tests, clean diff.
5. `web-mypy`: Python 3.14, root integration-lock freshness, generated test env,
   standalone web local environment, required `mypy`, authoritative mypy hook,
   clean diff.

CI must fail if hooks or generators modify tracked files. Check staged and
unstaged diffs in the parent and every initialized child. Do not weaken these
recursive checks to hide drift.

Root CI must not deploy, release, publish packages, push child repositories, or
open PRs. Those actions remain in standalone upstream repositories.

## Railway deployment boundary

Web, worker, and scheduler deployment sources remain the standalone
`OpenSpeleo/SpeleoDB` repository on `master`. Its `.railway/railway.ts`,
`railpack.json`, standalone dependency locks, and build/start commands remain
authoritative. Parent gitlink updates do not publish or deploy the web source.
Never point product services at the monorepo or put monorepo-only dependency
paths into standalone web configuration. Validate production dependency install,
frontend build, and Railway configuration type-checking when changes affect
these contracts. Deployment requires explicit authorization.

## Verification matrix

Choose checks proportional to the affected scope.

| Change                          | Required minimum verification                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| Submodule configuration/tooling | `npm run test:monorepo`, `make doctor`, recursive status                              |
| Root shell scripts              | `bash -n <scripts>`, `npm run test:monorepo` when launcher-related                    |
| Root JSON/editor config         | JSON parse plus relevant extension/import smoke check                                 |
| Root Compose/devcontainer       | merged Compose config; build or runtime smoke test when behavior changes              |
| Mobile source/dependencies      | standalone/root install as applicable, lint, tests, build, Capacitor sync drift check |
| Web JavaScript                  | lint, JS tests, production build                                                      |
| Web Python                      | standalone uv sync, focused/full pytest, mypy when relevant                           |
| Shared Python package           | package lock plus root lock, relevant tests, root uv sync                             |
| Compass Rust                    | `make check-rust`, Trunk and/or Tauri build when affected                             |
| `openspeleo_core`               | `make check-rust`, `make build-core`, relevant Python/Rust tests                      |
| Ariane                          | recursive submodules, Java 25, `make build-ariane`                                    |
| Documentation only              | command/config cross-check and `git diff --check`                                     |

Broad local integration validation:

```bash
make doctor
npm run test:monorepo
npm run lint
npm run test
npm run build
make check-rust
make build-compass-ui
make build-compass-tauri
make build-core
make build-ariane
make pre-commit
git diff --check
```

Do not claim a check passed unless it was actually run. Report platform or
dependency limitations precisely.

## Configuration synchronization checklist

When structure or tooling changes, update every applicable surface:

- `Makefile`
- root `package.json` and lock
- root `pyproject.toml` and lock
- standalone app/package locks
- `.vscode/settings.json` and recommendations
- `.devcontainer/` composition, features, lock, and setup
- root `.gitmodules` and nested `.gitmodules`
- `.github/workflows/ci.yml`
- `README.md`
- `AGENTS.md`
- unit tests for workspace initialization or launcher behavior

Do not leave documentation describing commands that the current Makefile or tool
implementation does not support.

## Completion and handoff

Before finishing:

1. Re-run `git status --short`.
2. Re-check cached and uncached diffs separately.
3. Confirm pre-existing staged files were preserved.
4. Run `git diff --check` and `git diff --cached --check`.
5. Confirm generated build/install output is ignored and no unintended native or
   lockfile drift remains.
6. Summarize changes by root versus child-repository scope.
7. List validation actually completed and any checks not run.
8. State explicitly whether anything was staged, committed, pushed, or opened as
   a PR.

Never imply that root validation deploys or releases a standalone project.
