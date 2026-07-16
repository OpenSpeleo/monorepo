# SpeleoDB Monorepo Agent Instructions

## Scope and instruction hierarchy

These instructions apply from the monorepo root. Every imported standalone
repository may contain its own `AGENTS.md`. Before changing a subtree, read the
closest instructions inside that prefix and obey both sets. The closest file
controls subtree-specific implementation and verification; this root file
controls cross-repository, Git, workspace, container, and publication behavior.

Run all root orchestration commands from the repository root.

## Repository model

This is a Git-subtree integration repository containing nine standalone
repositories:

| ID                | Prefix                            | Base branch |
| ----------------- | --------------------------------- | ----------- |
| `mobile`          | `apps/mobile`                     | `main`      |
| `web`             | `apps/web`                        | `master`    |
| `compass_sidecar` | `apps/compass_sidecar`            | `main`      |
| `ariane_plugin`   | `apps/ariane_plugin`              | `master`    |
| `ariane_lib`      | `packages/python/ariane_lib`      | `master`    |
| `compass_lib`     | `packages/python/compass_lib`     | `master`    |
| `mnemo_lib`       | `packages/python/mnemo_lib`       | `master`    |
| `openspeleo_core` | `packages/python/openspeleo_core` | `master`    |
| `openspeleo_lib`  | `packages/python/openspeleo_lib`  | `master`    |

Future shared JavaScript packages belong under `packages/typescript/*`.

The authoritative mapping, including remote names and URLs, is
`.monorepo/subtrees.json`. The `.monorepo` directory is committed configuration,
not generated data, a cache, or another Git repository. It exists because
`unirepo` 0.6 cannot discover nested prefixes such as `apps/mobile` and
`packages/python/openspeleo_core`.

The local dependency-free subtree implementation is:

- `tools/subtree.mjs`
- `tools/subtree-lib.mjs`
- `tools/subtree.test.mjs`

Use it through the Make targets unless testing the CLI itself.

## Non-negotiable rules

1. Preserve user work. Never reset, overwrite, clean, stage, or reformat
   unrelated staged, unstaged, or untracked files.
2. Inspect staged and unstaged state separately before and after work.
3. Do not commit, push, create a PR, merge, release, or deploy unless the user
   explicitly requests that action.
4. Never use a regular product-repository push in place of a subtree push.
5. Never use the monorepo `origin` as a subtree remote or product deployment
   target.
6. Always inspect `make subtree-push` before any `make subtree-push-execute`.
7. Push only prefixes that actually changed and only after the selected prefix
   is clean.
8. Keep independent subtree changes in separate commits. Use a coupled commit
   only when the changes cannot be reviewed or used independently.
9. Keep root orchestration changes separate from subtree commits whenever
   practical. Root files cannot enter a subtree split.
10. Preserve standalone manifests, lockfiles, nested instructions, CI, and
    release behavior inside every subtree.
11. Do not create a root Cargo workspace; the two Rust manifests must remain
    independent.
12. Do not create a root uv workspace. The editable path-source model is
    required so every Python package can run its own `uv lock` from its own
    directory.
13. Do not create a root Gradle build; Ariane must continue using its wrapper.
14. Do not install Android SDK or Apple signing tooling in the shared Linux
    devcontainer unless the user explicitly changes that policy.
15. Do not install or configure any Git/pre-commit hook. Never run
    `prek install`, `pre-commit install`, or set `core.hooksPath` for this
    repository.
16. Root CI is validation-only. Do not add deployment, release, subtree push, or
    PR-creation behavior to it without explicit authorization.

## Required initial inspection

Before editing, run or inspect the equivalent of:

```bash
git status --short
git diff --name-only
git diff --cached --name-only
git branch --show-current
```

Then:

- identify whether the request affects root orchestration, one subtree, or
  multiple subtrees;
- read each affected subtree's closest `AGENTS.md`;
- inspect `.monorepo/subtrees.json` before any subtree operation;
- use `make doctor` when environment or remote configuration matters;
- record any pre-existing staged files and verify that they remain staged after
  the work.

Do not assume a dirty file belongs to the current task.

## Ownership boundaries

### Root-only orchestration

These paths belong only to the integration repository:

- `.monorepo/`
- `.devcontainer/`
- `.github/workflows/ci.yml`
- root `.vscode/`
- root `.gitmodules`
- root `.npmrc`
- root `.pre-commit-config.yaml` (root-only checks and prek workspace anchor)
- root `package.json` and `package-lock.json`
- root `pyproject.toml` and `uv.lock`
- `rust-toolchain.toml`
- `Makefile`
- `README.md`
- `AGENTS.md`
- `scripts/run-precommit.sh`
- `tools/subtree*.mjs`
- `tools/precommit-launcher.test.mjs`
- `packages/typescript/README.md` until an actual TypeScript subtree/package is
  added

Never copy these files into an upstream subtree PR. `git subtree push` naturally
excludes them; raw copying does not.

### Subtree-owned files

Files below a manifest prefix belong to that standalone repository. Changes must
continue to work after extracting that prefix. This includes task records,
app/package lockfiles, nested `.gitmodules`, and subtree CI.

When a root integration change requires a subtree adjustment, preserve this
boundary and validate both contexts.

## Setup and environment behavior

Canonical initialization:

```bash
make setup
make doctor
```

`make setup`:

1. validates all nine manifest records;
2. adds or updates their remotes;
3. records base-branch compatibility metadata in local Git config;
4. synchronizes Ariane submodule URLs and initializes only missing submodules;
5. creates ignored `apps/web/.envs/test.env` from its committed template when
   absent;
6. runs root `npm ci`;
7. syncs all root uv extras into `${UV_PROJECT_ENVIRONMENT}` or `.venv`.

Setup is idempotent and must preserve an already-initialized submodule checkout,
including a deliberate gitlink update that has not yet been staged.

Setup must never install a Git hook or configure `core.hooksPath`.

`make doctor` checks Git, Node, npm, uv, Cargo, Rust, Java, every exact remote
URL/prefix, and recursive Ariane submodules. A missing `gh` is a warning because
only PR creation requires it.

## Canonical root commands

### Installation and validation

```bash
make setup
make doctor
make pre-commit
make test-monorepo
make install-js
make install-python
```

`make pre-commit` is an explicit command, not an installed hook.

### Builds

```bash
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

### Subtrees

```bash
make subtree-status
make subtree-branch BRANCH=feature/name
make subtree-pull SUBTREE=mobile
make subtree-push SUBTREE=mobile
make subtree-push-execute SUBTREE=mobile
make subtree-pr SUBTREE=mobile TITLE="feat: ..." BODY="..."
```

`SUBTREE` may be a manifest ID, full prefix, or unique basename.

## `tools/` directory contract

Every file in `tools/` has a defined role:

| File                                | Contract                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `tools/subtree.mjs`                 | Only executable subtree-management entry point                                |
| `tools/subtree-lib.mjs`             | Internal shared implementation; not an application dependency or user command |
| `tools/subtree.test.mjs`            | Pure unit coverage for subtree manifest and safety behavior                   |
| `tools/precommit-launcher.test.mjs` | Isolated fake-binary coverage for the explicit prek launcher policy           |

Do not place generated files, caches, vendored binaries, or unrelated product
scripts in this directory.

### Direct subtree CLI usage

Prefer Make targets for normal operation. Use the direct CLI when developing or
debugging the tool itself:

```bash
node tools/subtree.mjs
node tools/subtree.mjs setup
node tools/subtree.mjs doctor
node tools/subtree.mjs status [--subtree <selector>]
node tools/subtree.mjs pull [--subtree <selector>]
node tools/subtree.mjs push [--subtree <selector>]
node tools/subtree.mjs push --execute [--subtree <selector>]
node tools/subtree.mjs branch <branch-name>
node tools/subtree.mjs pr --title <title> [--body <body>] [--subtree <selector>]
```

Invoking it with no command prints usage. Direct `setup` configures Git remotes,
branch metadata, and submodules only; it does not run the npm/uv and web-env
steps added by `make setup`.

Selector rules:

- repeat `--subtree` or use a comma-separated value for multiple selections;
- accept manifest ID, full prefix, or unique basename;
- no selector means all subtrees for `status` and `pull`;
- no selector means changed subtrees for `push` and `pr`.

Mutation rules remain identical in direct mode: pulls require the entire tree
clean, execution pushes require selected prefixes clean, push is dry-run by
default, and origin protection must remain enabled. Never call direct
`push --execute` or `pr` without the same explicit authorization required by
their Make targets.

### Internal library usage

`tools/subtree-lib.mjs` exports the primitives used by the CLI and tests:

- manifest loading/validation and selector resolution;
- Git URL normalization, GitHub slug derivation, and origin safety;
- prefix-boundary filtering and subtree-push argument construction;
- child-process/Git execution wrappers;
- Git config and effective push-branch resolution;
- subtree import baseline and changed/dirty state calculation;
- command discovery.

The module must remain shell-free when constructing Git/`gh` calls: use argument
arrays through `spawnSync`, not interpolated shell command strings. Preserve
these safety invariants when editing it:

- reject absolute, normalized-different, or parent-traversing prefixes;
- reject duplicate IDs, prefixes, and remotes;
- reject `origin` as a subtree remote;
- reject origin-equivalent URLs across SSH/HTTPS forms;
- match prefix boundaries rather than string lookalikes;
- retain push-branch precedence documented below.

Do not import this internal module from application or package source.

### Tool tests

Run tests individually while developing the relevant behavior:

```bash
node --test tools/subtree.test.mjs
node --test tools/precommit-launcher.test.mjs
```

Run the full tool suite before handoff:

```bash
node --test tools/*.test.mjs
npm run test:monorepo
make test-monorepo
```

`subtree.test.mjs` must remain unit-only: it must not fetch, pull, push, change
real remotes, or depend on network access.

`precommit-launcher.test.mjs` uses temporary fake executables through `PREK_BIN`
and `DMYPY_BIN`. It must cover all four policy states—local missing, local
installed, CI missing, and CI installed—plus the single-selected-hook skip case.
It must not install hooks or invoke real project hooks.

Any change to tool commands, selectors, safety checks, status semantics, branch
resolution, or launcher behavior requires:

1. focused test updates;
2. `npm run test:monorepo`;
3. direct command smoke checks that cannot publish;
4. synchronized `README.md` and `AGENTS.md` documentation.

## Branch policy

Use one named monorepo branch by default:

```bash
make subtree-branch BRANCH=feature/name
```

This command switches to or creates the local branch and records it as
`monorepo.pushBranch`.

Effective subtree push branch precedence is:

1. `monorepo.subtree.<id>.pushBranch`
2. `unirepo.subtree.<prefix>.pushBranch`
3. `monorepo.pushBranch`
4. current monorepo branch

The manifest base branch is used for subtree pulls and as the upstream PR base.
It is not the default push branch when a feature branch exists.

Do not publish from detached HEAD. Do not assume `main` or `master`; verify the
manifest and `make subtree-status`.

## Status semantics

`make subtree-status` reports:

- workspace branch;
- manifest base branch;
- effective push branch;
- prefix;
- `clean`, `changed`, or `uncommitted`.

`clean` means no differences under the prefix since the latest matching
`git-subtree-dir` import trailer. `changed` means committed differences exist.
`uncommitted` means the prefix currently contains staged, unstaged, or untracked
files.

Without selectors, push and PR commands automatically choose changed subtrees.
Use explicit selectors when preparing a specific upstream repository.

## Commit policy

### One subtree

```bash
git add apps/mobile/
git commit -m "feat(mobile): ..."
```

### Another independent subtree

```bash
git add packages/python/openspeleo_core/
git commit -m "fix(openspeleo_core): ..."
```

### Tightly coupled subtrees

```bash
git add packages/python/openspeleo_core/ apps/compass_sidecar/
git commit -m "feat: ..."
```

Do not combine independent subtrees merely to reduce commit count. Do not mix
root orchestration files into a subtree commit unless there is a strong reason;
even then, understand that the root portion disappears from an upstream split.

Before committing:

```bash
git diff --check
git diff --cached --check
git diff --cached --name-only
```

Only stage or commit when explicitly requested by the user.

## Pulling upstream updates

Pulls require the entire monorepo worktree to be clean, including root and
untracked files:

```bash
make subtree-pull SUBTREE=web
```

The CLI runs:

```bash
git subtree pull --prefix=<prefix> <remote> <base-branch> --squash
```

It creates a squash integration commit. Review that commit and rerun relevant
tests. Pulling without `SUBTREE` intentionally updates all manifest subtrees in
sequence.

If Ariane gitlinks change, run:

```bash
git submodule sync --recursive
git submodule update --init --recursive
```

Never hide a dirty worktree with an automatic stash unless the user explicitly
asks for that operation.

## Pushing subtree branches

Previewing is mandatory:

```bash
make subtree-status
make subtree-push SUBTREE=mobile
```

`make subtree-push` never publishes. It prints the exact `git subtree push`
command and reminds the operator to use the execute target.

Execution requires explicit user authorization:

```bash
make subtree-push-execute SUBTREE=mobile
```

The selected subtree must have no uncommitted files. Root or unrelated prefix
state does not enter the split, but must still be preserved.

The CLI refuses:

- a manifest remote named `origin`;
- a subtree URL that resolves to the same GitHub repository as `origin`;
- an execution against a dirty selected prefix.

Do not bypass these checks with raw Git unless the local CLI is genuinely
unavailable and the user has authorized publication.

## Upstream PRs

PR creation requires `gh`, authentication, a clean selected prefix, and a
previously pushed subtree branch:

```bash
make subtree-pr SUBTREE=mobile TITLE="feat: ..." BODY="..."
```

The CLI opens one PR per selected subtree repository, using the manifest base
branch and effective push branch. A coupled change spanning repositories still
requires separate upstream PRs.

Do not open a PR unless requested. Do not create product PRs against the
monorepo origin.

## Raw Git subtree fallback

Only when the local CLI cannot be used:

```bash
git subtree pull --prefix=<prefix> <remote-or-url> <base-branch> --squash
git subtree push --prefix=<prefix> <remote-or-url> <push-branch>
```

Verify `.monorepo/subtrees.json` first. Never substitute `origin` for the
subtree remote.

## Adding or changing a manifest subtree

For a new standalone repository:

1. Select a unique ID, nested prefix, remote, URL, and base branch.
2. Add it to `.monorepo/subtrees.json`.
3. Extend manifest/unit tests when validation behavior changes.
4. Run `node tools/subtree.mjs setup` to configure the remote.
5. Import it with
   `git subtree add --prefix=<prefix> <remote> <branch> --squash`.
6. Add it to npm/uv/editor/CI configuration only if its technology requires it.
7. Preserve its standalone instructions and lockfiles.
8. Update both `README.md` and this file.
9. Verify dry-run push safety before considering the integration complete.

Do not use `unirepo add`; nested discovery is the reason the local tool exists.

Changing an existing prefix, remote, or base branch is a migration. Inspect Git
history, remote refs, CI, workspace patterns, and documentation together. Do not
silently rename a prefix.

## JavaScript and WebNative rules

The root npm workspace contains:

- `apps/mobile`
- `apps/web`
- `packages/typescript/*`

Node 22 is the repository version. The root package is private.

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

WebNative discovers mobile and web through the npm workspace. Do not add a
second WebNative-specific project registry unless required by an upstream
change.

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
workspace. Editable path sources map:

- `ariane_lib`
- `compass_lib`
- `mnemo_lib`
- `openspeleo_core`
- `openspeleo_lib`

Root Python supports 3.11 or newer. Root `.venv` and `uv.lock` are integration
artifacts. Each package's own `uv.lock` remains authoritative both inside the
monorepo and after subtree extraction. Running `uv lock` from a package
directory must update that package lock, not redirect to the root.

When changing a package dependency, update and verify both its standalone lock
and the root integration lock:

```bash
cd packages/python/<package>
uv lock
cd ../../..
uv lock
uv sync --all-extras --frozen
```

Do not discard or replace pre-existing staged lock updates.

`apps/web` is independent of the root uv project. It requires Python 3.14 and
retains its own application environment and lock:

```bash
cd apps/web
uv sync --extra local --frozen
uv run pytest
```

Do not bind the web application to the root `.venv`.

## Explicit prek and mypy policy

There is no installed Git hook. Keep it that way.

The root `.pre-commit-config.yaml` establishes the prek workspace and defines
sanity and Markdown checks for root orchestration. Its top-level `exclude` must
list every prefix in `.monorepo/subtrees.json`, so nested subtree configurations
remain authoritative and root checks cannot misclassify their JSONC files as
strict JSON. Add every new subtree prefix to both places.

Use:

```bash
make pre-commit
```

This calls `scripts/run-precommit.sh --all-files`; the root config validates
orchestration files while prek discovers nested subtree configs as separate
projects.

Launcher behavior:

- locate prek on `PATH`, in `.venv-devcontainer`, root `.venv`, web `.venv`, or
  root `node_modules`;
- locate `dmypy` on `PATH` or in the web virtual environment;
- with local `dmypy`, run all requested hooks;
- without local `dmypy`, print an explicit `Skipped` status and pass
  `--skip apps/web:mypy` to prek;
- if only unavailable web mypy was selected, report the skip and exit zero;
- under non-empty `CI`, fail immediately when `dmypy` is missing.

Raw `prek run` bypasses this policy and can fail with `dmypy` missing. Do not
diagnose that as an installed hook; inspect the command path first.

Never add `.githooks/`, modify `.git/hooks/`, or configure `core.hooksPath` as a
solution.

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

The root `.gitmodules` uses fully prefixed paths. The nested
`apps/ariane_plugin/.gitmodules` uses paths relative to the standalone Ariane
checkout. Preserve both.

When updating a gitlink, fetch a reachable upstream commit, check it out inside
the submodule, then commit the pointer inside the Ariane subtree. A leading `+`
in `git submodule status` is a pointer difference, not permission to reset it.

## VS Code rules

The monorepo root is the intended editor workspace.

Recommended extensions cover WebNative, Java, Gradle, rust-analyzer, Tauri,
Python, Ruff, Docker, Makefile, YAML, and TOML.

Root settings link both Cargo manifests rather than inventing a workspace. The
host Python interpreter is `.venv/bin/python`; the devcontainer overrides it to
`.venv-devcontainer/bin/python`.

When changing editor configuration, verify that:

- WebNative still discovers mobile and web through npm workspaces;
- Gradle still imports Ariane and exposes tasks/shortcuts;
- rust-analyzer loads both independent manifests;
- host and Linux virtual environments do not collide.

## Devcontainer rules

The root devcontainer layers on `apps/web/local.yml` through
`.devcontainer/compose.override.yml`.

Required invariants:

- VS Code service remains `django`;
- monorepo mount remains `/workspace`;
- web subtree remains `/app`;
- existing web image, `/entrypoint`, `/start`, environment files, PostgreSQL,
  Redis, RustFS, and host networking remain authoritative;
- `make dev-web` runs the existing `/start` from `/app`;
- forwarded ports remain 8000, 8100, and 1420;
- Java comes from the Java 25 feature;
- Rust comes from the stable Rust feature;
- Gradle comes from Ariane's wrapper, not a feature-installed global Gradle;
- Linux root uv environment remains `/workspace/.venv-devcontainer`;
- Android SDK and Apple tooling remain omitted.

The post-create script installs Tauri/WebKit build dependencies, the wasm
target, Trunk, wasm-pack, and Tauri CLI, sources the web bash override, and runs
`make setup`.

Do not modify `apps/web/local.yml` merely to simplify root composition when an
override can preserve standalone behavior.

Compose uses fixed `speleodb_local_*` names. Never remove or recreate existing
developer containers or volumes without explicit permission. Use an isolated
override for smoke testing when names conflict.

Validation:

```bash
docker compose \
  -f apps/web/local.yml \
  -f .devcontainer/compose.override.yml \
  config --quiet
```

When testing runtime startup, verify migrations, Vite, `/start`, and an HTTP
response from Django. On Docker Desktop, inspect inside the service or use VS
Code port forwarding if host networking differs from native Linux.

## Root CI contract

`.github/workflows/ci.yml` runs on pull requests and pushes to `master`.
Recursive submodule checkout is mandatory for every job.

Jobs:

1. `orchestration`: Node tool tests, manifest parse, whitespace validation.
2. `javascript`: Node 22, root npm CI, app-local Capacitor assertion, both
   lints, mobile build/sync, mobile and web tests, both builds, clean diff.
3. `rust`: Ubuntu 24.04 Tauri libraries, stable Rust, Python 3.14, Trunk/Tauri
   tools, two Cargo checks, Compass UI/Tauri builds, maturin build, clean diff.
4. `ariane`: Temurin Java 25, Gradle wrapper build/tests, clean diff.
5. `web-mypy`: Python 3.14, generated test env, full web local environment,
   required `dmypy`, authoritative mypy hook, clean diff.

CI must fail if hooks or generators modify tracked files. Do not weaken the
final `git diff --exit-code` checks to hide drift.

Root CI must not deploy, release, publish packages, push subtree branches, or
open PRs. Those actions remain in standalone upstream repositories.

## Verification matrix

Choose checks proportional to the affected scope.

| Change                     | Required minimum verification                                                         |
| -------------------------- | ------------------------------------------------------------------------------------- |
| Manifest or subtree CLI    | `npm run test:monorepo`, `make doctor`, status and dry-run push                       |
| Root shell scripts         | `bash -n <scripts>`, `npm run test:monorepo` when launcher-related                    |
| Root JSON/editor config    | JSON parse plus relevant extension/import smoke check                                 |
| Root Compose/devcontainer  | merged Compose config; build or runtime smoke test when behavior changes              |
| Mobile source/dependencies | standalone/root install as applicable, lint, tests, build, Capacitor sync drift check |
| Web JavaScript             | lint, JS tests, production build                                                      |
| Web Python                 | standalone uv sync, focused/full pytest, mypy when relevant                           |
| Shared Python package      | package lock plus root lock, relevant tests, root uv sync                             |
| Compass Rust               | `make check-rust`, Trunk and/or Tauri build when affected                             |
| `openspeleo_core`          | `make check-rust`, `make build-core`, relevant Python/Rust tests                      |
| Ariane                     | recursive submodules, Java 25, `make build-ariane`                                    |
| Documentation only         | command/config cross-check and `git diff --check`                                     |

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

- `.monorepo/subtrees.json`
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
- unit tests for subtree or launcher behavior

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
6. Summarize changes by root versus subtree scope.
7. List validation actually completed and any checks not run.
8. State explicitly whether anything was staged, committed, pushed, or opened as
   a PR.

Never imply that root validation deploys or releases a standalone project.
