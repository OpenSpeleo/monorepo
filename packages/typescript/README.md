# Shared TypeScript map packages

`map-core` owns shared map algorithms; `map-viewer` owns MapLibre specifications
and assets. Each is a registered Git submodule with a public upstream
repository:
[SpeleoDB-TS-MapCore](https://github.com/OpenSpeleo/SpeleoDB-TS-MapCore) and
[SpeleoDB-TS-MapViewer](https://github.com/OpenSpeleo/SpeleoDB-TS-MapViewer).
The parent owns this document and integration configuration only. Source,
algorithm tests, source exports, and package CI belong to the package
repository.

## Architecture and extraction rationale

The web viewer previously combined Mapbox rendering with imperative controllers;
mobile uses MapLibre through React. Both calculate geographic extents, validate
GIS geometry, enrich survey features, derive depth domains, group landmarks, and
generate equivalent styling and markers. Keeping duplicate implementations made
corrections and behavior comparisons expensive. MapLibre 6.10.0 provides a
common renderer vocabulary while app adapters retain their lifecycle owners.

| Owner        | Responsibilities                                                                                                                                                    | Retained boundaries                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `map-core`   | GIS contract and validation, geometry/geodesy, bounds, shared depth parsing mechanisms and domains, feature preparation, landmark grouping and visibility selectors | No renderer, browser globals, app storage, credentials, React or Django                                            |
| `map-viewer` | GL expressions and declarative layer specifications, marker/icon catalog and assets                                                                                 | No map instance, source registration, app state or network policy                                                  |
| Web          | Private/public initialization, permissions, tools and editors, providers, DOM UI, persistence and source lifecycle                                                  | Public geometry restrictions, country gates, stored model colors, linear depth ramp and no-depth fallback          |
| Mobile       | React source/layer ownership, session authority, offline/cache lifecycle, native recording, persistence and UI                                                      | React layers remain direct children of sources; mobile depth resolver, square-root ramp and project-color fallback |

Shared functions accept caller-owned IDs, filters, metadata, and policies
instead of application-name switches. Worker entrypoints stay in applications so
Vite continues owning their assets and policy functions remain on the correct
side of postMessage. Expensive preparation happens when source content changes,
while visibility and color changes reuse prepared data. Caches are
instance/policy scoped; they cannot leak one application's depth interpretation
into another.

The migration sequence preserves adapters while replacing duplicated algorithms,
then switches all web map entrypoints to MapLibre and common specifications.
Algorithm tests move with their implementation; app tests continue proving
permissions, initialization, worker transport, persistence, renderer ownership,
and native/offline behavior. Source/API parity comes before deleting superseded
implementations. Standalone source-package builds are verified separately from
live-source integration.

Web retains its Mapbox Satellite Streets provider and city labels through
MapLibre-compatible resource URLs, alongside existing ESRI choices. Removing the
Mapbox GL runtime does not remove provider credentials or attribution. Provider
failure handling, initial metadata concurrency, public precision limits, and
preserving overlays on basemap switches remain app-owned acceptance criteria.

## Local development

Run `bun run install:local` at the monorepo root on the host for mobile and
library development. Python 3 is required for the macOS/Linux installation lock.
Container checks use an isolated source snapshot; the installer rejects the web
devcontainer's `/workspace` bind mount to protect host-native dependencies. The
root-owned installer projects manifests into an external cache, replacing every
shared dependency with `workspace:*` before Bun resolves the graph. Bun 1.4.2
attempts Git fetches before applying native overrides; the projection is
necessary to guarantee local development never fetches a shared package
revision. Canonical app and package manifests stay unchanged. The frozen root
lock governs third-party dependencies; Bun's isolated linker retains app-local
dependency links. Source and assets stay live through links, and existing
dependency directories are retained as ignored backups when publishing the new
installation. There is no remote fallback for a missing local checkout.

The web application retains its independent Bun environment at `/app`. Root
Compose selects the automatic `.devcontainer/install-web-packages.mjs` overlay.
It projects the canonical web manifest and local package manifests into the
shared cache volume at `/monorepo-python-build-cache/web-packages`, installs
from the root-owned `.devcontainer/web-packages.lock`, and links the packages'
live source and assets. The existing Linux JavaScript dependency volume remains
separate from host modules. Bun `file:` installs copy packages, so the
projection uses Bun workspace links. An OS lock serializes installation and
publication across setup, editor lifecycle, and webserver processes. All
services mount both the projection cache and dependency volume at the same
paths; correct links are preserved across repeated startup.

Vite, Vitest, TypeScript and ESLint consume package TypeScript source in both
standalone and local installations. Packages export source and source types by
default. Applications retain `speleodb-source` for compatibility with older Git
pins that expose their shipped source under that condition. No package compile,
archive, manual link, commit or GitHub access is needed for local source edits.
Mobile uses its existing Vite development server; web keeps immutable disk asset
builds and full-page reload. Worker entrypoints use the same source resolution.
Editors and CLI checks see the same types. Local-package flags only validate the
workspace graph: installed mobile packages and viewer-to-core resolution must
resolve to the real local checkout; copied source is rejected in local mode.

After dependency manifests change, refresh the root web integration lock inside
the existing application container and review its diff:

```bash
docker exec -u dev-user -w /app speleodb-monorepo-django \
  bun /workspace/.devcontainer/install-web-packages.mjs --refresh-lock
```

Normal startup uses the frozen lock and rejects stale manifest inputs. Package
source edits do not change that lock. The overlay never modifies canonical web
manifests or locks. Refresh the root projection lock with
`bun run install:local --refresh-lock`; child standalone locks are resolved in
isolation from the parent workspace.

Bun is pinned by `.bun-version` and runs package scripts and their executable
children through `[run] bun = true`. Retain Vitest (`bun run test`) instead of
using Bun's separate test runner. Mobile uses Istanbul coverage with its
existing thresholds because Bun does not use V8. Node-compatible imports and
type declarations do not imply a Node runtime requirement.

## Standalone npm distribution

Both packages are configured for public npm publication. Mobile and web pin
`@speleodb/map-core` and `@speleodb/map-viewer` to exact version `0.1.0`.
Standalone preflight rejects missing versions, ranges, and Git dependencies;
frozen Bun locks record registry artifacts and their integrity hashes.

Each package ships TypeScript source, JSON data, assets and license. `types` and
runtime exports point to `src/*.ts`; Bun executes that source directly, while
Vite compiles it into each application's browser bundles. `dist/` is ignored in
both packages, excluded from package contents, and never required at install or
runtime. `bun run build` is an explicit Bun browser-compilation smoke check
whose output is disposable. There are no dependency installation build hooks.

Viewer depends on core `>=0.1.0 <1.0.0` and declares MapLibre 6.10.0 as a peer.
Apps explicitly depend on both packages and MapLibre 6.10.0. Both apps also pin
core in Bun `overrides`, matching their direct dependency, so the viewer
resolves the same core version. The monorepo projects these dependencies to live
local workspaces before resolution.

For updates, publish tested package versions, update both apps' npm versions,
regenerate standalone locks, and prove fresh frozen installs and source-based
app builds. Update parent gitlinks only to revisions already reachable upstream.
Every commit, push and deployment still requires its own authorization.

## CI and Railway

Package CI checks source and test types, unit tests, browser compilation, and
source archive contents. Applications keep integration, browser, permissions,
lifecycle, and native tests. Root CI validates orchestration only. No npm
publication job exists. Standalone checks compile source from pinned npm
releases; monorepo checks use the live source projections. Frozen installs
verify the registry artifacts against the committed locks.

Railway continues deploying the standalone web repository, with
`.railway/railway.ts` as the sole service authority and `railpack.json` as the
build recipe. The image checks npm version pins, performs its guarded frozen Bun
install, and builds assets before removing build dependencies. It does not mount
or clone the monorepo and compiles the installed package sources during its Vite
build. Database migration, background schedule installation, collectstatic, and
existing service sources remain unchanged.
