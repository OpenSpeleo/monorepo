# SpeleoDB monorepo

This repository is the integration workspace for the SpeleoDB applications and
shared libraries. It combines nine standalone Git repositories under `apps/` and
`packages/python/` using Git subtrees, then adds root-level tooling for
cross-project development, validation, editors, and containers.

Every subtree remains independently cloneable, buildable, releasable, and
deployable. The monorepo is an integration surface; it does not replace the
standalone repositories or their release pipelines.

## Core model and invariants

- Product source lives inside a subtree prefix. Root orchestration files are
  monorepo-only and never appear in a subtree split.
- The monorepo `origin` stores integration history. It is not a product
  deployment target.
- Product branches are published with `git subtree push`, normally through the
  safe subtree Make targets.
- Pulls from upstream subtree repositories are squashed into the monorepo.
- Independent subtree changes should use separate commits. A genuinely coupled
  change may span multiple subtrees in one commit.
- Each subtree keeps its standalone manifests, lockfiles, nested `.gitmodules`,
  CI, and release configuration.
- Root npm and Python integration locks are additional contracts; they do not
  replace subtree locks.
- No Git hook or pre-commit hook is installed or configured by this repository.
  Validation is always invoked explicitly.
- Deployments and releases remain in the standalone repositories. Root CI only
  validates integration.

## Repository structure

### Applications

| ID                | Prefix                 | Technology and purpose                               | Upstream base |
| ----------------- | ---------------------- | ---------------------------------------------------- | ------------- |
| `mobile`          | `apps/mobile`          | React, Ionic, Vite, Capacitor mobile application     | `main`        |
| `web`             | `apps/web`             | Django application with Vite-managed frontend assets | `master`      |
| `compass_sidecar` | `apps/compass_sidecar` | Rust, Yew, Trunk, and Tauri Compass sidecar          | `main`        |
| `ariane_plugin`   | `apps/ariane_plugin`   | Java/JavaFX Ariane plugin                            | `master`      |

### Shared packages

| ID                | Prefix                            | Purpose                                        | Upstream base |
| ----------------- | --------------------------------- | ---------------------------------------------- | ------------- |
| `ariane_lib`      | `packages/python/ariane_lib`      | Ariane Python helpers                          | `master`      |
| `compass_lib`     | `packages/python/compass_lib`     | Compass Python helpers                         | `master`      |
| `mnemo_lib`       | `packages/python/mnemo_lib`       | Mnemo Python helpers                           | `master`      |
| `openspeleo_core` | `packages/python/openspeleo_core` | Python package backed by a Rust/PyO3 extension | `master`      |
| `openspeleo_lib`  | `packages/python/openspeleo_lib`  | Shared OpenSpeleo Python library               | `master`      |
| n/a               | `packages/typescript/*`           | Reserved for future shared TypeScript packages | n/a           |

### Root orchestration files

| Path                                 | Role                                                                               |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| `.monorepo/subtrees.json`            | Committed manifest for the nine subtree prefixes, remotes, URLs, and base branches |
| `tools/subtree.mjs`                  | Dependency-free subtree setup, status, pull, push, branch, and PR CLI              |
| `tools/subtree-lib.mjs`              | Manifest validation, selector, branch, and Git safety helpers                      |
| `tools/*.test.mjs`                   | Unit tests for subtree safety and pre-commit policy                                |
| `Makefile`                           | Canonical developer commands                                                       |
| `package.json` / `package-lock.json` | Root npm workspace and integrated JavaScript lock                                  |
| `.npmrc`                             | Nested npm installation strategy                                                   |
| `pyproject.toml` / `uv.lock`         | Root Python integration project using editable path sources and its lock           |
| `rust-toolchain.toml`                | Shared Rust channel, components, and WebAssembly target                            |
| `.vscode/`                           | Root editor recommendations and language-server settings                           |
| `.devcontainer/`                     | Monorepo devcontainer layered on `apps/web/local.yml`                              |
| `.github/workflows/ci.yml`           | Root integration-only CI                                                           |
| `.gitmodules`                        | Fully prefixed paths for Ariane's two nested API gitlinks                          |
| `.pre-commit-config.yaml`            | Root-only sanity and Markdown checks plus the prek workspace anchor                |
| `scripts/run-precommit.sh`           | Explicit prek launcher with local/CI mypy policy                                   |

`.monorepo/` is not a second repository, a cache, or generated state. It is a
normal committed configuration directory containing one manifest. `unirepo` 0.6
cannot discover nested prefixes such as `apps/mobile`, so the local CLI reads
this manifest instead.

## Upstream mapping

The manifest is authoritative. `make setup` creates remote names equal to the
prefixes shown below.

| ID                | Remote                            | URL                                                      |
| ----------------- | --------------------------------- | -------------------------------------------------------- |
| `mobile`          | `apps/mobile`                     | `git@github.com:OpenSpeleo/SpeleoDB-App.git`             |
| `web`             | `apps/web`                        | `git@github.com:OpenSpeleo/SpeleoDB.git`                 |
| `compass_sidecar` | `apps/compass_sidecar`            | `git@github.com:OpenSpeleo/speleodb_compass_sidecar.git` |
| `ariane_plugin`   | `apps/ariane_plugin`              | `https://github.com/OpenSpeleo/SpeleoDB-Ariane-Plugin`   |
| `ariane_lib`      | `packages/python/ariane_lib`      | `git@github.com:OpenSpeleo/pytool_ariane_lib.git`        |
| `compass_lib`     | `packages/python/compass_lib`     | `git@github.com:OpenSpeleo/pytool_compass_lib.git`       |
| `mnemo_lib`       | `packages/python/mnemo_lib`       | `git@github.com:OpenSpeleo/pytool_mnemo_lib.git`         |
| `openspeleo_core` | `packages/python/openspeleo_core` | `git@github.com:OpenSpeleo/openspeleo_core.git`          |
| `openspeleo_lib`  | `packages/python/openspeleo_lib`  | `git@github.com:OpenSpeleo/pytool_openspeleo_lib.git`    |

## Prerequisites

| Tool       | Expected version or role                                                               |
| ---------- | -------------------------------------------------------------------------------------- |
| Git        | A version containing `git subtree`                                                     |
| Node.js    | Node 22; `.node-version` contains `22`, and the root package requires at least 22.12   |
| npm        | Installed with Node and capable of npm workspaces                                      |
| uv         | Python environment, project, and lock manager                                          |
| Python     | At least 3.11 for the root integration project; Python 3.14 for `apps/web`             |
| Rust       | Stable; the committed toolchain adds `rustfmt`, `clippy`, and `wasm32-unknown-unknown` |
| Java       | JDK 25 for Ariane                                                                      |
| GitHub CLI | Optional; required only by `make subtree-pr`                                           |
| Docker     | Optional on the host; required for the devcontainer and the host-side web stack        |
| VS Code    | Optional; required for the documented WebNative, Gradle, and devcontainer experience   |

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

1. Validates `.monorepo/subtrees.json`.
2. Adds missing subtree remotes and corrects URLs that differ from the manifest.
3. Records subtree base-branch metadata in local Git configuration.
4. Synchronizes Ariane submodule URLs and initializes only missing submodules.
   An already-initialized checkout is not reset to the indexed gitlink.
5. Creates ignored `apps/web/.envs/test.env` from `apps/web/.envs/test.env.dist`
   when it does not exist.
6. Runs root `npm ci`.
7. Runs root `uv sync --all-extras` into `.venv`, or into the environment named
   by `UV_PROJECT_ENVIRONMENT`.

`make setup` does **not** install a Git hook, change `core.hooksPath`, commit,
pull subtree history, push anything, or deploy anything.

`make doctor` checks:

- `git`, `node`, `npm`, `uv`, `cargo`, `rustc`, and `java`;
- the exact remote URL and local directory for every manifest entry;
- initialization of Ariane's recursive submodules;
- `gh` as a non-fatal warning because it is needed only for PR creation.

## Command reference

### Setup and validation

| Command              | Effect                                                                |
| -------------------- | --------------------------------------------------------------------- |
| `make setup`         | Configure remotes/submodules and install the root npm/uv environments |
| `make doctor`        | Validate tools, remotes, prefixes, and submodules                     |
| `make pre-commit`    | Explicitly run all discovered prek projects; no hook is installed     |
| `make test-monorepo` | Run the root Node orchestration and launcher tests                    |

### Application and package builds

| Command                    | Effect                                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `make dev-web`             | In the container, run `/start` from `/app`; on the host, start `django-webserver` through `apps/web/local.yml` |
| `make build-web`           | Build the web Vite assets through the root npm workspace                                                       |
| `make build-mobile`        | Type-check and build the mobile Vite application                                                               |
| `make sync-mobile`         | Run Capacitor sync from the mobile workspace                                                                   |
| `make check-rust`          | Cargo-check Compass and `openspeleo_core`, all targets and features, with locks                                |
| `make build-compass-ui`    | Build the Compass Trunk frontend in release mode                                                               |
| `make build-compass-tauri` | Compile the Compass Tauri application in release mode without bundling                                         |
| `make build-core`          | Build the `openspeleo_core` Python wheel with maturin                                                          |
| `make build-ariane`        | Run Ariane's Gradle `build test` tasks                                                                         |

### Subtree operations

| Command                                            | Effect                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `make subtree-status`                              | Show base branch, effective push branch, state, and prefix for all subtrees                |
| `make subtree-status SUBTREE=mobile`               | Show one selected subtree                                                                  |
| `make subtree-branch BRANCH=feature/name`          | Create/switch the monorepo branch and record it as the default subtree push branch         |
| `make subtree-pull SUBTREE=mobile`                 | Squash-pull `mobile` from its configured base branch; requires a completely clean worktree |
| `make subtree-pull`                                | Squash-pull every manifest subtree; requires a completely clean worktree                   |
| `make subtree-push SUBTREE=mobile`                 | Print the exact `git subtree push` command without executing it                            |
| `make subtree-push`                                | Dry-run all changed subtrees                                                               |
| `make subtree-push-execute SUBTREE=mobile`         | Push the selected clean subtree to its effective branch                                    |
| `make subtree-pr SUBTREE=mobile TITLE="feat: ..."` | Open the upstream PR after its subtree branch has been pushed                              |

`SUBTREE` accepts the manifest ID (`mobile`), full prefix (`apps/mobile`), or a
unique basename. The Node CLI also accepts repeated or comma-separated
`--subtree` selectors.

## Complete `tools/` reference

`tools/` is intentionally small and contains exactly four files. It is not a
location for generated output or downloaded executables.

| File                                | Intended use                                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| `tools/subtree.mjs`                 | Executable repository-local subtree CLI                                                |
| `tools/subtree-lib.mjs`             | Internal JavaScript module used by the CLI and its unit tests                          |
| `tools/subtree.test.mjs`            | Unit tests for manifest, selection, prefix, branch-command, and remote safety behavior |
| `tools/precommit-launcher.test.mjs` | Unit tests for local/CI `dmypy` detection and skip behavior                            |

### `tools/subtree.mjs`

Run it with Node from the repository root. Invoking it without a command prints
its usage text:

```bash
node tools/subtree.mjs
```

The direct interface is:

```bash
node tools/subtree.mjs setup
node tools/subtree.mjs doctor
node tools/subtree.mjs status [--subtree <selector>]
node tools/subtree.mjs pull [--subtree <selector>]
node tools/subtree.mjs push [--subtree <selector>]
node tools/subtree.mjs push --execute [--subtree <selector>]
node tools/subtree.mjs branch <branch-name>
node tools/subtree.mjs pr --title <title> [--body <body>] [--subtree <selector>]
```

Options and selection behavior:

- repeat `--subtree` to select several repositories;
- pass comma-separated selectors to one `--subtree` option;
- selectors accept a manifest ID, complete prefix, or unique basename;
- `status` and `pull` select all subtrees when no selector is supplied;
- `push` and `pr` select only changed subtrees when no selector is supplied;
- `push` is a dry run unless `--execute` is explicitly present;
- `branch` takes its branch name as a positional argument;
- `pr` requires `--title`, accepts an optional `--body`, and requires `gh`;
- invalid manifests, selectors, remotes, dirty-state violations, detached HEAD,
  and failed child commands produce a non-zero exit.

The Make targets are preferred because they provide stable, memorable command
names. One distinction matters: direct `node tools/subtree.mjs setup` performs
only Git remote/config/submodule setup, while `make setup` additionally creates
the web test environment, installs the root npm workspace, and syncs the root
Python integration environment.

Direct and Make equivalents:

| Direct CLI                                                       | Preferred interface                                |
| ---------------------------------------------------------------- | -------------------------------------------------- |
| `node tools/subtree.mjs setup`                                   | Git portion of `make setup`                        |
| `node tools/subtree.mjs doctor`                                  | `make doctor`                                      |
| `node tools/subtree.mjs status --subtree mobile`                 | `make subtree-status SUBTREE=mobile`               |
| `node tools/subtree.mjs pull --subtree mobile`                   | `make subtree-pull SUBTREE=mobile`                 |
| `node tools/subtree.mjs push --subtree mobile`                   | `make subtree-push SUBTREE=mobile`                 |
| `node tools/subtree.mjs push --execute --subtree mobile`         | `make subtree-push-execute SUBTREE=mobile`         |
| `node tools/subtree.mjs branch feature/name`                     | `make subtree-branch BRANCH=feature/name`          |
| `node tools/subtree.mjs pr --subtree mobile --title "feat: ..."` | `make subtree-pr SUBTREE=mobile TITLE="feat: ..."` |

### `tools/subtree-lib.mjs`

This file is an internal ES module, not a shell command. It provides:

- repository and manifest paths;
- manifest loading and validation;
- ID/prefix/basename selector resolution;
- GitHub URL normalization and repository-slug extraction;
- protection against `origin` and origin-equivalent URLs;
- subtree path-boundary filtering and push-argument construction;
- shell-free child-process and Git execution helpers;
- Git config, current-branch, and effective-push-branch resolution;
- last-import and changed/dirty subtree state calculation;
- executable discovery for `doctor` and PR support.

Tooling code and tests may import it directly:

```js
import { loadManifest, selectSubtrees } from "./tools/subtree-lib.mjs";

const { subtrees } = loadManifest();
const [mobile] = selectSubtrees(subtrees, ["mobile"]);
```

It is an internal API: application and package code must not depend on it. Any
behavioral change requires matching CLI tests and documentation updates.

### `tools/subtree.test.mjs`

Run only the subtree unit tests with:

```bash
node --test tools/subtree.test.mjs
```

They verify nested-prefix manifest acceptance, duplicate and `origin` rejection,
selector forms, prefix-boundary detection, safe subtree-push arguments, origin
URL protection, and protocol-independent GitHub URL handling. They do not fetch,
pull, push, or mutate real remotes.

### `tools/precommit-launcher.test.mjs`

Run only the launcher-policy tests with:

```bash
node --test tools/precommit-launcher.test.mjs
```

The test creates temporary fake `prek` and `dmypy` executables and invokes
`scripts/run-precommit.sh`. It covers local missing-`dmypy` skip reporting,
selecting only the skipped hook, local installed-`dmypy` execution, CI failure
without `dmypy`, and CI execution with it. It installs no hook and does not run
the real nested project hooks.

Run every file under `tools/` that has the `.test.mjs` suffix with either:

```bash
node --test tools/*.test.mjs
npm run test:monorepo
make test-monorepo
```

The latter two commands are the canonical aggregate interface.

## Complete Git subtree workflow

### Branches

Start product work on a named branch rather than pushing from `master`:

```bash
make subtree-branch BRANCH=feature/offline-map
```

This switches to an existing branch or creates it, then writes
`monorepo.pushBranch=feature/offline-map` in local Git configuration. The same
branch name can be split and pushed to more than one upstream repository for a
coupled change.

The effective push branch is chosen in this order:

1. `monorepo.subtree.<id>.pushBranch`
2. `unirepo.subtree.<prefix>.pushBranch` for compatibility
3. `monorepo.pushBranch`
4. the current monorepo branch

Override a single subtree when necessary:

```bash
git config monorepo.subtree.mobile.pushBranch feature/mobile-only-name
```

The manifest's `baseBranch` is used for pulls and as the PR base. It is not
automatically the push branch.

### Understanding subtree status

```bash
make subtree-status
```

The state column means:

- `clean`: no committed or uncommitted changes since the most recent subtree
  import trailer;
- `changed`: committed changes exist under the prefix;
- `uncommitted`: staged, unstaged, or untracked changes currently exist under
  the prefix.

When no selector is passed, push and PR commands automatically select subtrees
reported as changed or uncommitted. Explicit selection is safer when preparing a
single upstream PR.

### Commit boundaries

Keep independent histories understandable:

```bash
# One subtree
git add apps/mobile/
git commit -m "feat(mobile): add offline map recovery"

# A different independent subtree gets a different commit
git add packages/python/openspeleo_core/
git commit -m "fix(openspeleo_core): validate station identifiers"

# Only when two subtree changes are inseparable
git add packages/python/openspeleo_core/ apps/compass_sidecar/
git commit -m "feat: expose and consume normalized survey data"
```

Keep root orchestration changes such as `Makefile`, `.github/`,
`.devcontainer/`, `.vscode/`, `.monorepo/`, and this README in separate monorepo
commits whenever practical. They cannot be included in a subtree PR because
subtree splitting contains only the selected prefix.

Before committing, inspect both staged and unstaged scope:

```bash
git status --short
git diff --check
git diff --cached --check
git diff --cached --name-only
```

### Pulling upstream changes

Subtree pulls require the entire worktree to be clean because each pull creates
a squash integration commit:

```bash
git status --short
make subtree-pull SUBTREE=web
```

Review the resulting history and tree:

```bash
git show --stat --oneline HEAD
make subtree-status SUBTREE=web
```

Pull all nine only when intentionally updating the whole integration tree:

```bash
make subtree-pull
```

If Ariane changed either gitlink, synchronize and initialize it afterward:

```bash
git submodule sync --recursive
git submodule update --init --recursive
```

### Pushing subtree branches

Always preview first:

```bash
make subtree-status
make subtree-push SUBTREE=mobile
```

The preview prints a command shaped like:

```bash
git subtree push --prefix=apps/mobile apps/mobile feature/offline-map
```

Execute only after the selected subtree has no uncommitted files:

```bash
make subtree-push-execute SUBTREE=mobile
```

The execute target refuses a dirty selected subtree. The CLI rejects a remote
named `origin` and also rejects any subtree URL that normalizes to the monorepo
origin URL. It cannot publish root orchestration files because `git subtree`
splits only the selected prefix.

### Opening upstream PRs

Authenticate the GitHub CLI, push the subtree branch, then create the PR:

```bash
gh auth status
make subtree-push-execute SUBTREE=mobile
make subtree-pr SUBTREE=mobile \
  TITLE="feat: add offline map recovery" \
  BODY="Builds and tests pass from the monorepo integration workspace."
```

The PR targets the manifest base branch and uses the effective push branch as
its head. One command is run per selected subtree, producing one upstream PR per
standalone repository. The branch must already exist in that repository.

### Monorepo origin versus product upstreams

Normal Git operations against `origin` are for collaborating on the integration
repository and its root orchestration. They do not publish an application or
package release. Product source reaches its standalone repository through the
subtree workflow above; deployments and releases then run there.

Never substitute `origin` into a raw subtree push.

### Raw Git fallback

If the local CLI cannot be used, verify the mapping in the manifest first:

```bash
git subtree pull --prefix=<prefix> <remote-or-url> <base-branch> --squash
git subtree push --prefix=<prefix> <remote-or-url> <push-branch>
```

The pull still requires a clean worktree, and the push remote must not be the
monorepo `origin`.

### Adding another standalone repository

1. Choose a unique ID, nested prefix, remote name, URL, and base branch.
2. Add the entry to `.monorepo/subtrees.json`.
3. Run `node tools/subtree.mjs setup` to create the remote.
4. Import the repository:

   ```bash
   git subtree add --prefix=<prefix> <remote> <base-branch> --squash
   ```

5. Add the prefix to the npm workspace or root editable uv sources if
   applicable.
6. Preserve the imported repository's standalone lockfiles and instructions.
7. Extend `tools/subtree.test.mjs`, CI, the repository tables, and build targets
   as needed.

Do not use `unirepo add` for nested prefixes in this repository.

## Ariane gitlinks and submodules

`apps/ariane_plugin` contains two gitlinks:

- `com.arianesline.ariane.plugin.api`
- `com.arianesline.cavelib.api`

The root `.gitmodules` uses fully prefixed paths so recursive checkout works
from the monorepo root. `apps/ariane_plugin/.gitmodules` deliberately keeps
paths relative to the standalone Ariane repository. Both files are necessary; do
not replace one with the other.

To update a gitlink, fetch and check out the intended reachable commit inside
the submodule, then commit the gitlink as an Ariane subtree change:

```bash
git -C apps/ariane_plugin/com.arianesline.ariane.plugin.api fetch origin
git -C apps/ariane_plugin/com.arianesline.ariane.plugin.api checkout <commit>
git add apps/ariane_plugin/com.arianesline.ariane.plugin.api
git commit -m "chore(ariane_plugin): update plugin API gitlink"
```

A leading `+` in `git submodule status` means the checked-out submodule commit
differs from the gitlink recorded in the index. Commit the intended pointer; do
not reset it casually.

## JavaScript workspace and WebNative

The private root npm workspace contains:

- `apps/mobile`
- `apps/web`
- future packages matching `packages/typescript/*`

The root package is not published. WebNative officially understands npm
workspaces, so opening the repository root lets the extension discover both
applications. Select `mobile` in WebNative and use Build or Run → Web.

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

The root uv project is deliberately **not** a uv workspace. It depends on the
five `packages/python/*` projects through editable path sources in
`[tool.uv.sources]`. This preserves the ability to enter any package directory
and run its standalone `uv lock` without uv redirecting to a parent workspace.

The root `uv.lock` remains the integrated lock for exercising the packages
together, and root `.venv` is the default integration environment.

Install or refresh it with:

```bash
make install-python
# Equivalent:
uv sync --all-extras
```

Each Python subtree retains its own `pyproject.toml` and `uv.lock` for
standalone extraction. Because there is no parent uv workspace, package-local
commands operate on the package's own lock. A shared-package dependency update
therefore requires both the package lock and the root integration lock:

```bash
cd packages/python/compass_lib
uv lock
cd ../../..
uv lock
uv sync --all-extras --frozen
```

`apps/web` is also independent of the root uv project. It requires Python 3.14
and has its own application environment and lock:

```bash
cd apps/web
cp -n .envs/test.env.dist .envs/test.env
uv sync --extra local --frozen
uv run pytest
```

The `local` web environment provides `dmypy`, which is needed to execute the web
mypy hook rather than skip it.

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
SSL, app-indicator, Clang, and pkg-config libraries installed by the
devcontainer. `build-compass-tauri` compiles with `--no-bundle`, so it validates
the application without producing platform installers.

`build-core` runs `uv run --frozen maturin build` from
`packages/python/openspeleo_core` and writes the wheel under that subtree's
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

Inside the devcontainer, the Python interpreter is overridden to
`/workspace/.venv-devcontainer/bin/python`.

## Devcontainer operation

The root devcontainer composes directly on top of `apps/web/local.yml`; it does
not duplicate the web application's container definition.

### Composition

- Base Compose file: `apps/web/local.yml`
- Override: `.devcontainer/compose.override.yml`
- VS Code service: `django`
- Root workspace: `/workspace`
- Standalone web mount: `/app`
- Remote user: `dev-user`
- Existing Django image, `/entrypoint`, `/start`, PostgreSQL, Redis, RustFS,
  environment files, and host networking: preserved

The two mounts are intentional. Root tooling operates from `/workspace`, while
the existing web image and scripts continue to see the web application at
`/app`, exactly as in its standalone repository.

### Container provisioning

Devcontainer features install Java 25 and stable Rust. Feature resolutions are
pinned in `.devcontainer/devcontainer-lock.json`.

The idempotent post-create script then:

1. selects `/workspace/.venv-devcontainer` as the root uv environment;
2. installs build-essential, Clang, CMake, WebKitGTK, app-indicator, SVG, SSL,
   patchelf, and pkg-config dependencies;
3. installs the WebAssembly Rust target;
4. installs Trunk, wasm-pack, and Tauri CLI if missing;
5. sources the existing `/app/.devcontainer/bashrc.override.sh` from the user
   shell configuration;
6. runs `make setup` from `/workspace`.

The separate `.venv-devcontainer` prevents Linux binaries from colliding with a
macOS or Windows host `.venv` in the bind-mounted repository.

### Ports

| Port   | Use                          |
| ------ | ---------------------------- |
| `8000` | Django                       |
| `8100` | Mobile Vite/WebNative        |
| `1420` | Compass Trunk/Tauri frontend |

VS Code forwards these ports. The underlying web Compose file retains host
networking. On Docker Desktop, use VS Code's forwarded-port URL if the host
network does not expose the service exactly like native Linux.

### Starting and using the container

In VS Code, run **Dev Containers: Reopen in Container**. After the post-create
step completes:

```bash
make doctor
make dev-web
```

`make dev-web` executes `/start` from `/app` and occupies that terminal. Use
other terminals for mobile, Rust, or Java commands:

```bash
npm run dev --workspace=apps/mobile -- --host 0.0.0.0 --port 8100
make check-rust
make build-compass-ui
make build-compass-tauri
make build-core
make build-ariane
```

To validate or rebuild outside VS Code:

```bash
docker compose \
  -f apps/web/local.yml \
  -f .devcontainer/compose.override.yml \
  config

npx -y @devcontainers/cli build --workspace-folder .
```

The Compose file uses fixed `speleodb_local_*` container names. Stop an existing
standalone stack before trying to create another stack with the same names. Do
not remove another developer's containers or volumes without their permission.

The container intentionally omits Android SDK, Android Studio, Xcode, signing
credentials, and device tooling. Mobile web builds and Capacitor preparation
work in Linux; signed Android/iOS builds remain host workflows.

## Explicit pre-commit and mypy policy

The root `.pre-commit-config.yaml` establishes the prek workspace and validates
root orchestration with generic sanity checks and Prettier for Markdown. Its
top-level `exclude` explicitly lists all nine subtree prefixes, preventing root
hooks from scanning files owned by nested projects or incorrectly treating their
VS Code and devcontainer JSONC files as strict JSON. Each subtree's nested
configuration remains authoritative after extraction. When adding a subtree, add
its prefix to this exclusion as well as the subtree manifest.

No hook is installed. Specifically, setup does not run `prek install`,
`pre-commit install`, or configure `core.hooksPath`.

Run validation explicitly:

```bash
make pre-commit
```

This invokes `scripts/run-precommit.sh --all-files`:

- if `dmypy` is on `PATH` or in `apps/web/.venv`, all hooks run normally;
- if `dmypy` is missing locally, the launcher prints `apps/web:mypy ... Skipped`
  and invokes prek with `--skip apps/web:mypy`;
- if only `apps/web:mypy` was requested locally and it is unavailable, the
  launcher reports the skip and exits successfully;
- if `CI` is non-empty and `dmypy` is missing, the launcher exits with failure;
- CI installs the full web local environment and therefore executes mypy.

Running raw `prek run` bypasses this wrapper and will fail with
`dmypy: No such file or directory` when the binary is absent. Either use
`make pre-commit` or explicitly skip it:

```bash
prek run --skip apps/web:mypy --all-files
```

To execute only web mypy:

```bash
uv sync --project apps/web --extra local --frozen
bash scripts/run-precommit.sh apps/web:mypy --all-files
```

## Root CI

`.github/workflows/ci.yml` runs for pull requests and pushes to `master`. Every
job checks out Ariane submodules recursively. Root CI validates only; it does
not publish packages, deploy applications, create releases, push subtrees, or
open PRs.

| Job             | Environment                            | Validation                                                                                                                                       |
| --------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `orchestration` | Ubuntu, Node from `.node-version`      | Root Node tests, manifest JSON parsing, `git diff --check`                                                                                       |
| `javascript`    | Ubuntu, Node 22, root npm cache        | Root `npm ci`, app-local Capacitor assertion, both app lints, mobile build and Capacitor sync, mobile/web tests, both builds, clean tracked diff |
| `rust`          | Ubuntu 24.04, stable Rust, Python 3.14 | Tauri system libraries, Trunk/Tauri CLI, both Cargo checks, Compass Trunk build, Tauri no-bundle compile, maturin wheel, clean tracked diff      |
| `ariane`        | Ubuntu, Temurin JDK 25                 | Ariane Gradle 9.4.1 `build test`, clean tracked diff                                                                                             |
| `web-mypy`      | Ubuntu, Python 3.14                    | Generated test env, full web local uv environment, required `dmypy`, authoritative mypy hook, clean tracked diff                                 |

The `git diff --exit-code` steps intentionally fail when formatting, lock,
Capacitor sync, or build hooks modify tracked files. Regenerate and commit those
changes locally rather than allowing CI to hide them.

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

Some commands are platform-specific or expensive. The devcontainer is the
reference Linux environment for Tauri, maturin, Java, and web integration.

## Troubleshooting

### `dmypy` cannot be found

You invoked raw prek or do not have the web local environment. Use
`make pre-commit` to get the local skip policy, or install it:

```bash
uv sync --project apps/web --extra local --frozen
```

### Subtree pull refuses to run

Pull requires a completely clean worktree, including root files and untracked
files. Commit, intentionally stash, or remove only your own generated files,
then retry.

### Subtree push uses the wrong branch

Inspect the effective branch:

```bash
make subtree-status SUBTREE=mobile
git config --get monorepo.subtree.mobile.pushBranch
git config --get monorepo.pushBranch
git branch --show-current
```

Set the shared branch with `make subtree-branch`, or configure the subtree
override explicitly.

### Detached HEAD

Subtree publication requires a named branch. Switch or create one before status,
push, or PR operations:

```bash
make subtree-branch BRANCH=feature/name
```

### Ariane submodule is missing

```bash
git submodule sync --recursive
git submodule update --init --recursive
make doctor
```

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

The monorepo workflow ends after validation, subtree branch publication, and
upstream PR creation. Merge, release, package publication, mobile signing, and
application deployment follow the standalone repository's own documentation and
CI. Root CI never performs these actions.
