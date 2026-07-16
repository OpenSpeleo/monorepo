import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { ROOT } from "./subtree-lib.mjs";

function executable(filename, body) {
  writeFileSync(filename, `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`);
  chmodSync(filename, 0o755);
}

function runLauncher({ ci, dmypy, args = ["--all-files"] }) {
  const directory = mkdtempSync(path.join(tmpdir(), "speleodb-hook-"));
  const log = path.join(directory, "prek.log");
  const prek = path.join(directory, "prek");
  executable(prek, 'printf "%s\\n" "$@" > "$PREK_TEST_LOG"');
  const dmypyPath = path.join(directory, "dmypy");
  if (dmypy) executable(dmypyPath, "exit 0");

  const result = spawnSync("bash", ["scripts/run-precommit.sh", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      PREK_BIN: prek,
      DMYPY_BIN: dmypyPath,
      PREK_TEST_LOG: log,
      ...(ci ? { CI: "1" } : { CI: "" }),
    },
  });
  return {
    ...result,
    args:
      result.status === 0 && existsSync(log)
        ? readFileSync(log, "utf8").trim().split("\n")
        : [],
  };
}

test("root prek hooks exclude every subtree project", () => {
  const config = readFileSync(path.join(ROOT, ".pre-commit-config.yaml"), "utf8");
  const manifest = JSON.parse(
    readFileSync(path.join(ROOT, ".monorepo/subtrees.json"), "utf8"),
  );

  assert.match(config, /^repos:\s*$/m);
  assert.match(config, /^\s*- id: check-json$/m);
  assert.match(config, /^\s*- id: prettier$/m);
  for (const subtree of manifest.subtrees) {
    assert.ok(
      config.includes(`${subtree.prefix}/`),
      `root prek exclude must contain ${subtree.prefix}`,
    );
  }
});

test("local run reports the web mypy hook as skipped when dmypy is absent", () => {
  const result = runLauncher({ ci: false, dmypy: false });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.args, ["run", "--skip", "apps/web:mypy", "--all-files"]);
  assert.match(result.stdout, /apps\/web:mypy .*Skipped/);
  assert.doesNotMatch(result.stdout, /Passed/);
});

test("selecting only unavailable web mypy is a successful local skip", () => {
  const result = runLauncher({
    ci: false,
    dmypy: false,
    args: ["apps/web:mypy", "--all-files"],
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.args, []);
  assert.match(result.stdout, /apps\/web:mypy .*Skipped/);
});

test("local run executes normally when dmypy is installed", () => {
  const result = runLauncher({ ci: false, dmypy: true });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.args, ["run", "--all-files"]);
});

test("CI fails immediately when dmypy is absent", () => {
  const result = runLauncher({ ci: true, dmypy: false });
  assert.equal(result.status, 127);
  assert.match(result.stderr, /dmypy is required in CI/);
});

test("CI executes normally when dmypy is installed", () => {
  const result = runLauncher({ ci: true, dmypy: true });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.args, ["run", "--all-files"]);
});
