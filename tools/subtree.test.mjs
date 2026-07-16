import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSafeRemote,
  githubSlug,
  normalizeGitUrl,
  pathsForSubtree,
  pushCommand,
  selectSubtrees,
  validateManifest,
} from "./subtree-lib.mjs";

const valid = {
  schemaVersion: 1,
  subtrees: [
    {
      id: "mobile",
      prefix: "apps/mobile",
      remote: "apps/mobile",
      url: "git@github.com:OpenSpeleo/SpeleoDB-App.git",
      baseBranch: "main",
    },
    {
      id: "core",
      prefix: "packages/python/core",
      remote: "packages/python/core",
      url: "https://github.com/OpenSpeleo/core",
      baseBranch: "master",
    },
  ],
};

test("manifest accepts nested prefixes", () => {
  assert.equal(validateManifest(structuredClone(valid)).subtrees.length, 2);
});

test("manifest rejects duplicate prefixes and origin", () => {
  const duplicate = structuredClone(valid);
  duplicate.subtrees[1].prefix = "apps/mobile";
  assert.throws(() => validateManifest(duplicate), /duplicate subtree prefix/);

  const origin = structuredClone(valid);
  origin.subtrees[0].remote = "origin";
  assert.throws(() => validateManifest(origin), /may not use the monorepo origin/);
});

test("selectors accept id, full prefix, and basename", () => {
  assert.equal(selectSubtrees(valid.subtrees, ["mobile"])[0].prefix, "apps/mobile");
  assert.equal(selectSubtrees(valid.subtrees, ["packages/python/core"])[0].id, "core");
  assert.equal(selectSubtrees(valid.subtrees, ["core"])[0].prefix, "packages/python/core");
  assert.throws(() => selectSubtrees(valid.subtrees, ["missing"]), /unknown subtree/);
});

test("changed path detection respects prefix boundaries", () => {
  assert.deepEqual(
    pathsForSubtree(["apps/mobile/a.ts", "apps/mobile-old/a.ts", "README.md"], "apps/mobile"),
    ["apps/mobile/a.ts"],
  );
});

test("push command uses only the subtree remote", () => {
  assert.deepEqual(pushCommand(valid.subtrees[0], "codex/work"), [
    "subtree",
    "push",
    "--prefix=apps/mobile",
    "apps/mobile",
    "codex/work",
  ]);
  assert.throws(
    () => assertSafeRemote(valid.subtrees[0], "git@github.com:OpenSpeleo/SpeleoDB-App.git"),
    /monorepo origin/,
  );
});

test("GitHub URL normalization is protocol independent", () => {
  assert.equal(
    normalizeGitUrl("git@github.com:OpenSpeleo/SpeleoDB-App.git"),
    "github.com/openspeleo/speleodb-app",
  );
  assert.equal(githubSlug("https://github.com/OpenSpeleo/core.git"), "openspeleo/core");
});
