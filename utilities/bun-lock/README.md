# Isolated Bun lock resolution

From the monorepo root, `apps/web`, `apps/mobile`,
`packages/typescript/map-core`, or `packages/typescript/map-viewer` inside this
monorepo:

```sh
bun run lock
bun run lock --upgrade
bun run lock --help
```

One shared utility resolves the calling package's graph outside the enclosing
Bun workspace and installed tree. From a child it resolves that package's
standalone graph. From the monorepo root it resolves the integration graph: web,
mobile, and TypeScript packages, with local map dependencies. The root command
uses `.devcontainer/typescript-projection.mjs` to snapshot workspace manifests
and set shared map dependencies to `workspace:*` only in the temporary copies.
Standalone overrides are removed from those copies so root overrides remain
authoritative. The root lock records workspace declarations and resolutions;
standalone app locks record their exact npm versions. Generated declarations and
resolutions are checked before publication. The temporary input lock receives
the same declaration normalization because Bun can retain old member metadata
when an overridden resolution is unchanged. Its package resolutions are
preserved. Canonical manifests remain unchanged. The lock and native `bun ci`
installation cover the same entire root workspace, including web. Ordinary
locking retains existing satisfied resolutions. `--upgrade`, like
`uv lock --upgrade`, starts a fresh resolution of direct and transitive
dependencies within the unchanged manifest constraints. Exact versions, semver
bounds, overrides, and pinned Git SHAs still apply. Upgrade mode ignores cached
registry metadata; it does not use `bun update --latest` or edit dependency
ranges.

The command requires the package's exact `.bun-version`. It stages
`package.json`, `bunfig.toml`, `.bun-version`, optional `.npmrc`, and the
existing `bun.lock` (except in upgrade mode). Bun runs with `--lockfile-only`
and `--ignore-scripts`, so no application dependencies are installed and no
lifecycle scripts run. Resolution can access the network and shared Bun cache.
Credentials remain in the existing environment or configuration and are not
printed by the utility; staged files are private to the user.

Only a successful, nonempty lock for the expected graph is published, using an
atomic rename. Resolver errors leave the existing lock intact. The helper
refuses publication if any input changed while resolving. Temporary files are
removed on normal completion or exceptions. Process termination or power loss
can leave temporary files behind. Only the calling directory's `bun.lock` is
updated. No manifest, installed tree, child lock (when run at root), parent lock
(when run in a child), or web overlay lock is updated. The root command
snapshots member manifests, checks for concurrent manifest or membership
changes, and publishes only the top-level lock. Use `bun ci` separately to
install web, mobile, and TypeScript packages.

## Install commands and lock ownership

Bun 1.4.2 serializes the dependency specifications from the app manifests when
writing the root lock, even though the root overrides resolve those packages to
local workspaces. Root `postinstall` runs `bun run lock` after native installs
to keep the root declarations at `workspace:*`. This also runs when native
`bun install` discovers the monorepo from an app directory. The resolver uses
`--ignore-scripts` internally, so its temporary install cannot recurse into
postinstall. Ordinary installs can still update dependencies.

| Command                                                 | Lock behavior                                                                                                                       |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Root or in-monorepo app `bun install`                   | Updates the root graph, then root postinstall writes canonical workspace declarations. Child locks stay untouched.                  |
| Root `bun ci`                                           | Installs the frozen root graph; postinstall leaves a canonical lock unchanged.                                                      |
| Root `bun run lock [--upgrade]`                         | Writes only the root workspace lock.                                                                                                |
| App `bun run lock [--upgrade]`                          | Writes only that app's standalone version lock.                                                                                     |
| `bun run install:local --refresh-lock`                  | Calls the root writer explicitly, then installs, even with `--ignore-scripts`.                                                      |
| Raw `bun install --lockfile-only` or `--ignore-scripts` | Bypasses postinstall normalization. Use `bun run lock` for lock-only updates or run it afterward to restore canonical declarations. |

The `version` of each workspace package remains its actual release version; only
dependency references in the root lock use `workspace:*`. This does not replace
version metadata or alter third-party resolutions.

## Scope

This is a monorepo convenience utility, not an upstream package dependency or a
replacement for each repository's independent lock check. All four children have
small launchers without extra dependencies or CI changes. The web launcher also
supports its `/app` container mount, using the helper under `/workspace`. When
the helper is missing, every launcher exits with a clear message and status 1
before touching files. Standalone clones use native
`bun install --lockfile-only --ignore-scripts`.

The current standalone manifests use registry and remote Git dependencies. In
child mode, workspace declarations, local dependencies (`file:`, `link:`,
relative paths), catalog references, local patches, and binary `bun.lockb`
inputs are rejected because their topology cannot be preserved by copying only
resolver inputs. Root mode permits the local workspace dependencies used by the
integration workspace; other local inputs remain unsupported.
Certificate/configuration file references must be absolute. `TMPDIR` must not be
inside a package: every ancestor is checked before creating staging. Unknown
arguments are errors; no arbitrary resolver flags are forwarded.

## Verification

Validate changes with disposable nested-workspace fixtures and real pinned Bun:
parent and installed-tree sentinels must remain unchanged on successful
resolution and failure. A local registry with two releases proves ordinary
locking retains satisfied versions while upgrade mode refreshes both direct and
transitive versions without crossing manifest bounds or changing manifests. Also
exercise missing locks, configuration forwarding, invalid arguments, runtime
mismatch, unsafe temporary roots, and edits during resolution. Exercise the root
and four child package-script entrypoints separately. Root fixtures must prove
web is included, map dependencies resolve locally, child locks and installed
trees are untouched, and the result passes native `bun ci` against the same
canonical manifests. Repeat root and app native installs, root lock-only and
refresh commands, and child standalone lock commands; assert byte-stable root
locks after normalization, unchanged child locks/manifests, and unchanged
third-party resolutions. Web launcher tests belong to the web frontend suite and
run in its existing container.

Run utility formatting checks explicitly from the monorepo root with
`uv run prek run --config utilities/.pre-commit-config.yaml --files` followed by
the changed utility filenames. No root test dispatcher or CI phase is added.
