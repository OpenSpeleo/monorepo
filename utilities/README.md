# SpeleoDB utilities

Small operational tools, with one directory and README per tool. These belong to
the monorepo; `tools/` remains reserved for workspace orchestration.

| Tool                                                       | Purpose                                                               |
| ---------------------------------------------------------- | --------------------------------------------------------------------- |
| [Compass project import](compass_project_import/README.md) | Create one SpeleoDB COMPASS project per DAT referenced by a MAK file. |

Python scripts declare their own dependencies inline and run with `uv run`. Keep
credentials in environment variables and local input/output files outside
version control. `data/`, `output/`, environment files and survey archives under
this directory are ignored.

New tools should follow the same layout and document their inputs, side effects,
configuration and recovery options. Share the checks in
`.pre-commit-config.yaml` and Ruff settings in `ruff.toml`.

Run checks explicitly from the monorepo root (no Git hooks are installed):

```bash
uv run prek run --config utilities/.pre-commit-config.yaml --all-files
```

`--all-files` checks tracked files. To also validate a new tool before staging
it:

```bash
uv run prek run --config utilities/.pre-commit-config.yaml --files \
  utilities/compass_project_import/import_projects.py
```

Utilities have their own checks and are excluded from root orchestration checks
and automatic prek discovery.
