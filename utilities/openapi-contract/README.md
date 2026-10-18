# OpenAPI contract equality

This read-only integration check hashes the sole canonical schema,
`apps/web/OpenAPI.yaml`, and requires its SHA-256 to equal the generator input
hash recorded in `packages/typescript/api/openapi-source.json`. The SDK keeps
the source revision and digest, not a second schema. Missing or empty schemas
and malformed source records fail. Whitespace, ordering, line endings, and
trailing newlines all count; the tool never parses or reformats YAML, downloads
the input, or regenerates files.

Run from the monorepo root with the pinned Bun runtime:

```sh
bun utilities/openapi-contract/check.mjs
prek run openapi-contract-match --all-files
```

The root prek hook runs even when no normal root file matches its filters,
because changes inside a submodule are represented by its gitlink. The root CI
also invokes this check after recursive checkout. The two checked-out revisions
must therefore identify the same contract before their pointers are integrated.
No network or application services are needed for equality checking.

For an isolated comparison, provide two paths:

```sh
bun utilities/openapi-contract/check.mjs /path/to/web/OpenAPI.yaml /path/to/api/openapi-source.json
```

A mismatch prints both hashes. Regenerate and review the web export using the
web-owned export command, update the SDK's source revision and digest,
regenerate its TypeScript output, and run the package and application checks.
See the
[API maintenance guide](../../packages/typescript/api/docs/maintenance.md) for
the complete procedure. Equal digests establish that the SDK records the exact
backend bytes; backend contract tests and SDK regeneration checks separately
verify endpoint behavior and generated output. SDK default regeneration must
also retrieve the recorded immutable revision successfully before release.
