# Compass project import

Creates one SpeleoDB COMPASS project for each DAT referenced by a MAK file, in
the original MAK order. The DAT filename stem supplies both the project name and
description, normalized to ASCII. Country is currently fixed to Mexico (`MX`).

The importer preserves preceding MAK settings and each selected DAT's bytes.
Each upload contains a filtered `project.mak`, a single `survey.dat`, and the
required `compass.toml`. It acquires the project lock before uploading and
attempts to release it afterward, including on upload failure. Source files are
never changed.

## Run

Requires Python 3.10+ and uv. `uv run` installs the script's inline `requests`
dependency in an isolated environment.

From the monorepo root, preview all projects without credentials or API calls:

```bash
uv run utilities/compass_project_import/import_projects.py \
  --mak-file=/path/to/survey.mak --dry-run
```

Configure credentials through the environment. The default instance is
`https://www.speleodb.org`; local HTTP is also supported:

```bash
export SPELEODB_INSTANCE=http://localhost:8000
export OAUTH_TOKEN='your-token'
uv run utilities/compass_project_import/import_projects.py \
  --mak-file=/path/to/survey.mak
```

The `SPELEODB_INSTANCE` and `OAUTH_TOKEN` globals near the top read these
variables. Never put real tokens in the script or commit them. Environment files
are not loaded automatically.

## Ranges and retries

Positions start at **1**. `--start` is inclusive (default 1); `--stop` is
exclusive (default: continue through the end). For positions 10 through 19:

```bash
uv run utilities/compass_project_import/import_projects.py \
  --mak-file=/path/to/survey.mak --start=10 --stop=20
```

The importer stops on the first failure and prints retry arguments. If it
already created the project, reuse that ID to avoid creating another project:

```bash
uv run utilities/compass_project_import/import_projects.py \
  --mak-file=/path/to/survey.mak --start=10 --stop=20 \
  --project-id=00000000-0000-4000-8000-000000000001
```

Replace the example UUID with the ID printed by the importer. It is reused only
at `--start`, after checking project metadata; later positions create new
projects. An uncertain create response (for example, a timeout) requires
checking SpeleoDB for the project before retrying. Rerunning completed positions
creates duplicate projects. Keep the MAK order unchanged when resuming.

## Input scope

This is a simple importer for classic MAK files whose DAT references are
filenames in the same directory as the MAK. Paths supplied to `--mak-file` are
relative to the current working directory, or absolute. Subdirectory references
and folder directives are not supported. DATs must be independently usable; the
importer does not resolve dependencies on stations in other DATs.

The MAK is decoded as UTF-8, falling back to Windows-1252. Filename matching
ignores case and handles decomposed Unicode accents. Titles lose accents;
station identifiers and coordinates must remain ASCII. DAT contents are not
re-encoded. A dry run validates selection and ZIP creation, but does not perform
server-side survey validation.

See [shared checks](../README.md) for formatting and lint commands.
