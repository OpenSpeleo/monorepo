# Monorepo OpenAPI snapshot equality

Web owns `apps/web/OpenAPI.yaml`. The SDK owns its independent
`packages/typescript/api/OpenAPI.yaml` snapshot and records that snapshot's
SHA-256 in `openapi-source.json`. Each standalone repository generates and
validates its own files without requiring the other repository or a published
backend revision.

This monorepo integration check requires its selected local schemas to be
byte-identical and their SHA-256 hashes to equal the SDK's recorded digest.
Missing or empty schemas and malformed source records fail. Whitespace,
ordering, line endings, and trailing newlines count. The checker only reads
local files: it never fetches a schema, consults an upstream revision, regenerates
files, or dispatches child checks.

Run the focused unit test from the monorepo root with the pinned Bun runtime:

```sh
bun test ./utilities/openapi-contract/check.test.mjs
```

The test checks the actual checked-out schemas and metadata, then verifies that
the checker rejects drift, empty or missing input, and invalid digest records.
It uses Bun's built-in test runner without installing package dependencies.
Temporary negative-case fixtures stay outside the checkout.

Root CI runs this test after recursive checkout. The root prek hook also checks
local equality, including on gitlink-only changes. Run its checker directly or
through prek:

```sh
bun utilities/openapi-contract/check.mjs
prek run openapi-contract-match --all-files
```

For an isolated comparison, provide all three paths:

```sh
bun utilities/openapi-contract/check.mjs /path/to/web/OpenAPI.yaml /path/to/api/OpenAPI.yaml /path/to/api/openapi-source.json
```

A mismatch prints the hashes and filenames. Review the backend export, update
the SDK snapshot and its local digest deliberately, and regenerate the SDK as
described in its [maintenance guide](../../packages/typescript/api/docs/maintenance.md).
This gate validates the monorepo's chosen integration state. It must not be
copied into standalone backend or SDK CI, hooks, or release workflows.
