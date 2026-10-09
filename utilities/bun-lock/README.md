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
shares `.devcontainer/typescript-projection.mjs` with the installer so
dependency rewriting stays consistent. The lock covers the entire root
workspace; the host installer excludes web because web installs separately.
Ordinary locking retains existing satisfied resolutions. `--upgrade`, like
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
snapshots and projects member manifests, checks for concurrent manifest or
membership changes, and publishes only the top-level lock. Use
`bun run install:local` separately to install mobile and TypeScript packages;
web retains its independent install.

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
integration projection; other local inputs remain unsupported.
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
trees are untouched, and the result passes a frozen install against the same
projection. Web launcher tests belong to the web frontend suite and run in its
existing container.

Run utility formatting checks explicitly from the monorepo root with
`uv run prek run --config utilities/.pre-commit-config.yaml --files` followed by
the changed utility filenames. No root test dispatcher or CI phase is added.
