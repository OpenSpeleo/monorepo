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
| `pyproject.toml` / `uv.lock`         | Python 3.14 integration environment for virtual web plus editable shared libraries |
| `rust-toolchain.toml`                | Shared Rust channel, components, and WebAssembly target                            |
| `.vscode/`                           | Root editor recommendations and language-server settings                           |
| `.devcontainer/`                     | Web-only devcontainer layered on `apps/web/local.yml`                              |
| `.github/workflows/ci.yml`           | Root integration-only CI                                                           |
| `.gitmodules`                        | Fully prefixed paths for Ariane's two nested API gitlinks                          |
| `.pre-commit-config.yaml`            | Root-only sanity and Markdown checks plus the prek workspace anchor                |
| `.prekignore`                        | Root prek discovery exclusions for Mobile, Ariane, and Compass                     |
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
| Python     | Python 3.14 for the root integration project and `apps/web`                            |
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
7. Runs the frozen root Python 3.14 integration lock into `.venv`, or into the
   environment named by `UV_PROJECT_ENVIRONMENT`. This includes the virtual web
   application's local dependencies and all editable shared packages.

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
| `make pre-commit`    | Run root-discovered prek projects except Mobile, Ariane, and Compass  |
| `make test-monorepo` | Run the root Node orchestration and launcher tests                    |

### Application and package builds

| Command                                       | Effect                                                                                                         |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `make dev-web`                                | In the container, run `/start` from `/app`; on the host, start `django-webserver` through `apps/web/local.yml` |
| `make dev-web-isolated STACK=speleodb_fresh`  | Build and start a fresh project-prefixed web stack without using existing volumes                              |
| `make stop-web-isolated STACK=speleodb_fresh` | Stop that isolated stack while preserving all of its volumes                                                   |
| `make build-web`                              | Build the web Vite assets through the root npm workspace                                                       |
| `make build-mobile`                           | Type-check and build the mobile Vite application                                                               |
| `make sync-mobile`                            | Run Capacitor sync from the mobile workspace                                                                   |
| `make check-rust`                             | Cargo-check Compass and `openspeleo_core`, all targets and features, with locks                                |
| `make build-compass-ui`                       | Build the Compass Trunk frontend in release mode                                                               |
| `make build-compass-tauri`                    | Compile the Compass Tauri application in release mode without bundling                                         |
| `make build-core`                             | Build the `openspeleo_core` Python wheel with maturin                                                          |
| `make build-ariane`                           | Run Ariane's Gradle `build test` tasks                                                                         |

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
| `tools/precommit-launcher.test.mjs` | Unit tests for prek launcher forwarding and workspace policy                           |

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

The test creates temporary fake `prek` and `mypy` executables and invokes
`scripts/run-precommit.sh`. It covers argument forwarding, missing-mypy failure,
the non-daemon web mypy hook, and the committed Mobile/Ariane/Compass discovery
boundary. It also locks the shared Linux `node_modules` mount used by workspace
web hooks, the virtual-web root lock contract, and the devcontainer's live
Python source overlay. It installs no hook and does not run real project hooks.

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

The root uv project is deliberately **not** a uv workspace. It requires Python
3.14 and combines two integration roles:

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

`apps/web` still owns an independent standalone project and lock. Neither file
contains a path back to `packages/python`, so extraction continues to resolve
the published versions from PyPI:

```bash
cd apps/web
cp -n .envs/test.env.dist .envs/test.env
uv sync --extra local --frozen
uv run pytest
```

The `local` web environment provides `mypy`, which executes the authoritative
web type-checking hook.

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
- Existing Django image, `/entrypoint`, `/start`, PostgreSQL, Redis, RustFS,
  environment files, and host networking: preserved

The two mounts are intentional. Root tooling operates from `/workspace`, while
the existing web image and scripts continue to see the web application at
`/app`, exactly as in its standalone repository.

The `django`, `django-webserver`, and one-shot `setup` services also receive the
monorepo at `/workspace`. Their `PYTHONPATH` places these live source roots
ahead of the published packages installed in the standalone image:

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

The root override gives every service a `speleodb_devcontainer_*` container name
by default. This is separate from the standalone file's `speleodb_*` default, so
stopped standalone containers can remain preserved while VS Code creates its
`web` Compose project. Set `COMPOSE_INSTANCE_PREFIX` before invoking the Dev
Containers CLI only when a different devcontainer prefix is required.

Compose overlays `/app/node_modules` with a devcontainer-specific named volume,
`speleodb_devcontainer_local_web_node_modules` by default. Its name follows
`COMPOSE_INSTANCE_PREFIX`, so it never aliases the standalone Compose volume.
Linux native npm packages installed by `/start` therefore cannot overwrite a
macOS or Windows host installation or inherit root ownership from a standalone
webserver.

That same volume is mounted at `/workspace/apps/web/node_modules` in all three
monorepo application services. Prek executes the web project from the monorepo
path, so both paths must resolve to the same Linux dependencies. The setup job
initializes an empty or legacy volume for `dev-user`; the workspace and
webserver then run as `dev-user`, ensuring npm, Vite, prek, and editor terminals
share one ownership contract. The initialization checks the volume root first,
so a correctly owned dependency tree is not recursively scanned on every
startup.

### Automatic local-service setup

Both the `django` workspace and `django-webserver` wait for the one-shot `setup`
service. That job starts only after PostgreSQL, Redis, and RustFS pass their
health checks and GitLab passes `/-/readiness?all=1`. GitLab can take many
minutes on its first boot; the application containers remain pending rather than
starting with incomplete dependencies.

Before the application setup begins, `.devcontainer/sync-openspeleo-core.sh`
synchronizes the core package into `/opt/speleodb-venv` with
`uv sync --inexact`. The virtual environment is created with the image, remains
outside the application bind mount, and is writable by `dev-user`. The sync
preserves the web dependency graph, writes the platform-specific extension
beside the bind-mounted Python source, and verifies that both import origins are
below the monorepo package. The setup job is otherwise idempotent:

1. copy `apps/web/.env.dist` to the ignored `apps/web/.env` when the private
   file does not exist, without overwriting developer changes on later runs;
2. use the existing `python-gitlab` dependency to create or retrieve the local
   `speleodb` GitLab group;
3. read its real group ID rather than assuming one;
4. disable access-token expiration enforcement in the local GitLab instance,
   validate the existing non-expiring group token, and replace it when it is
   missing, invalid, or still has an expiration date;
5. populate the generated GitLab values and development RustFS bucket name in
   `apps/web/.env`, which Django already reads;
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
generated GitLab group token is private and is never committed. Resetting a
GitLab or RustFS volume is recovered on the next Compose start.

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

The root devcontainer starts only the web application. The existing
`apps/web/compose/Dockerfile` installs Python, Node, and the web application's
dependencies. Its monorepo-only build argument additionally installs the minimal
stable Rust toolchain required by the web application's editable
`openspeleo_core` dependency; it does not install Compass, Tauri, Trunk,
wasm-pack, Java, or mobile tooling. The Compose `setup` service prepares that
native dependency before web infrastructure, migrations, buckets, GitLab
provisioning, and local-superuser initialization.

Post-create adds `/app/.devcontainer/bashrc.override.sh` to the remote user's
shell configuration idempotently, installs `openspeleo_core` as editable into
the workspace container using the cached native build, and verifies that all
four web-library imports resolve below `/workspace/packages/python`. It does not
run root `make setup`, perform root npm installation, call `cargo install`, or
build Mobile, Compass, Tauri, or Ariane.

After changing Rust code, refresh the extension and restart the webserver:

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

The root devcontainer publishes this port on the host loopback interface through
Docker Compose. The standalone web Compose file retains host networking, while
the root override uses a shared workspace/webserver network namespace so editors
without `forwardPorts` support can still use `http://localhost:8000`.

All long-running root devcontainer services use `restart: unless-stopped`, so a
webserver or dependency terminated by resource pressure restarts without an
editor-driven Compose recreation. The `setup` container is intentionally a
one-shot job: `Exited (0)` is its healthy completed state. Remote UID rewriting
is disabled so the workspace, setup job, and webserver consistently use
`dev-user` UID/GID 1000 on their shared cache and Node volumes. Git receives
`safe.directory=/workspace` through the container environment, so Zed and
terminal Git commands trust the bind-mounted monorepo immediately, before any
post-create lifecycle command runs.

Reopening the devcontainer also runs the host-side
`.devcontainer/restart-existing-stack.sh` initialization command. For an
existing stack it restarts all four infrastructure services, waits for their
health checks, reruns the idempotent setup job, and then restarts the workspace
and webserver. For an initial creation it exits without action so `runServices`
remains the authoritative creation path.

### Starting and using the container

In VS Code, run **Dev Containers: Reopen in Container**. After the post-create
step completes:

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
devcontainer override defaults to `speleodb_devcontainer_*`. For any additional
isolated stack, always set both a Compose project name and
`COMPOSE_INSTANCE_PREFIX`, or use the documented `make dev-web-isolated` target.
Do not remove another developer's containers or volumes without their
permission.

The container intentionally omits Rust, Cargo, Tauri CLI, Trunk, wasm-pack,
Java, Gradle, mobile tooling, Android Studio/SDK, Xcode, signing credentials,
and device tooling.

## Explicit pre-commit and mypy policy

The root `.pre-commit-config.yaml` establishes the prek workspace and validates
root orchestration with generic sanity checks and Prettier for Markdown. Its
top-level `exclude` explicitly lists all nine subtree prefixes, preventing root
hooks from scanning files owned by nested projects or incorrectly treating their
VS Code and devcontainer JSONC files as strict JSON. Each subtree's nested
configuration remains authoritative after extraction. When adding a subtree, add
its prefix to this exclusion as well as the subtree manifest.

Root `.prekignore` additionally excludes `apps/mobile/`, `apps/ariane_plugin/`,
and `apps/compass_sidecar/` from workspace discovery. Root `prek` and
`make pre-commit` therefore never enter those projects. Mobile must use its own
Node environment, while Ariane and Compass depend on their own Java or Rust
toolchains. Run their hooks from inside the standalone directories:

```bash
(cd apps/mobile && prek run --all-files)
(cd apps/ariane_plugin/org.speleodb.ariane.plugin.speleodb && prek run --all-files)
(cd apps/compass_sidecar && prek run --all-files)
```

Mobile's and Compass's hook configurations are at their repository roots;
Ariane's belongs to its plugin module. Starting inside the respective
configuration directory finds the local `.pre-commit-config.yaml` before the
monorepo root, so root `.prekignore` does not disable any standalone command.

No hook is installed. Specifically, setup does not run `prek install`,
`pre-commit install`, or configure `core.hooksPath`.

Run validation explicitly:

```bash
make pre-commit
```

This invokes `scripts/run-precommit.sh --all-files` for root-discovered
projects. The launcher locates `prek` and `mypy`, including `mypy` from the web
virtual environment, then forwards the requested hook selectors and options
unchanged. A missing executable is an explicit environment error rather than a
local skip. CI installs the full web local environment and requires `mypy`
before running the hook.

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
| `web-mypy`      | Ubuntu, Python 3.14                    | Root integration-lock check, generated test env, standalone web sync, required `mypy`, authoritative mypy hook, clean tracked diff               |

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

Some commands are platform-specific or expensive. Root CI is the reference Linux
environment for Tauri, maturin, and Java; the devcontainer is scoped to web
development only.

## Troubleshooting

### `mypy` cannot be found

Install the web local environment, then rerun the hook:

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
