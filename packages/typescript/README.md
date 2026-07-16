# Shared TypeScript packages

JavaScript or TypeScript packages shared by multiple applications in this
directory.

Each package must have its own `package.json`; the root npm workspace will
discover it through `packages/typescript/*`.

Application-specific code remains in the owning subtree under `apps/`.
