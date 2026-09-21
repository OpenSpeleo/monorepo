import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { ROOT, inspectSubmodules, readSubmodules, setupSubmodules } from "./workspace.mjs";

// All Git operations below use disposable local repositories. No network or
// changes to the developer's Git configuration are needed.
process.env.GIT_ALLOW_PROTOCOL = "file";
process.env.GIT_AUTHOR_NAME = "Workspace test";
process.env.GIT_AUTHOR_EMAIL = "test@example.invalid";
process.env.GIT_COMMITTER_NAME = "Workspace test";
process.env.GIT_COMMITTER_EMAIL = "test@example.invalid";

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function temporary(t) {
  const directory = mkdtempSync(path.join(tmpdir(), "speleodb-workspace-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function repository(directory) {
  mkdirSync(directory, { recursive: true });
  git(directory, "init", "-b", "master");
  writeFileSync(path.join(directory, "source.txt"), "initial\n");
  git(directory, "add", "source.txt");
  git(directory, "-c", "commit.gpgsign=false", "commit", "-m", "initial fixture");
  return directory;
}

function commit(directory, message) {
  git(directory, "add", ".");
  git(directory, "-c", "commit.gpgsign=false", "commit", "-m", message);
}

function fixture(t) {
  const directory = temporary(t);
  const leaf = repository(path.join(directory, "leaf"));
  const app = repository(path.join(directory, "app"));
  git(app, "submodule", "add", "--name", "api", leaf, "vendor/api");
  commit(app, "nested fixture");
  const parent = repository(path.join(directory, "parent"));
  git(parent, "submodule", "add", "--name", "app", "-b", "master", app, "apps/app");
  commit(parent, "parent fixture");
  const clone = path.join(directory, "clone");
  git(directory, "clone", "--no-recurse-submodules", parent, clone);
  return { directory, leaf, app, parent, clone };
}

test("fresh setup initializes recursive pinned commits without following newer master", (t) => {
  const { app, clone } = fixture(t);
  const pin = git(app, "rev-parse", "HEAD");
  writeFileSync(path.join(app, "source.txt"), "new upstream\n");
  commit(app, "new upstream fixture");
  setupSubmodules(clone, () => {});
  assert.equal(git(path.join(clone, "apps/app"), "rev-parse", "HEAD"), pin);
  const state = inspectSubmodules(clone);
  assert.deepEqual(state.errors, []);
  assert.deepEqual(state.warnings, []);
  assert.deepEqual(state.modules.map((module) => module.path), ["apps/app", "apps/app/vendor/api"]);
  assert.equal(git(clone, "status", "--porcelain"), "");
  assert.equal(git(clone, "config", "--local", "--get-regexp", "^submodule\\..*\\.url$").includes("app"), true);
});

test("repeated setup preserves branches, local commits, staged changes, and nested dirty work", (t) => {
  const { clone } = fixture(t);
  setupSubmodules(clone, () => {});
  const app = path.join(clone, "apps/app");
  const leaf = path.join(app, "vendor/api");
  git(app, "switch", "-c", "feature/local");
  writeFileSync(path.join(app, "source.txt"), "local commit\n");
  commit(app, "local fixture change");
  writeFileSync(path.join(app, "staged.txt"), "staged\n");
  git(app, "add", "staged.txt");
  git(leaf, "switch", "-c", "feature/nested");
  writeFileSync(path.join(leaf, "source.txt"), "dirty nested\n");
  writeFileSync(path.join(leaf, "untracked.txt"), "keep\n");
  const snapshots = [clone, app, leaf].map((cwd) => git(cwd, "status", "--porcelain"));
  setupSubmodules(clone, () => {});
  setupSubmodules(clone, () => {});
  assert.deepEqual([clone, app, leaf].map((cwd) => git(cwd, "status", "--porcelain")), snapshots);
  assert.equal(git(app, "branch", "--show-current"), "feature/local");
  assert.equal(git(leaf, "branch", "--show-current"), "feature/nested");
  assert.equal(readFileSync(path.join(leaf, "untracked.txt"), "utf8"), "keep\n");
  assert.deepEqual(inspectSubmodules(clone).errors, []);
  assert.ok(inspectSubmodules(clone).warnings.length >= 2);
});

test("partial setup initializes a missing descendant without moving its parent", (t) => {
  const { clone } = fixture(t);
  git(clone, "submodule", "update", "--init", "--", "apps/app");
  const app = path.join(clone, "apps/app");
  git(app, "switch", "-c", "feature/parent");
  writeFileSync(path.join(app, "source.txt"), "preserved\n");
  assert.match(inspectSubmodules(clone).errors.join("\n"), /not initialized/);
  setupSubmodules(clone, () => {});
  assert.equal(git(app, "branch", "--show-current"), "feature/parent");
  assert.equal(readFileSync(path.join(app, "source.txt"), "utf8"), "preserved\n");
  assert.deepEqual(inspectSubmodules(clone).errors, []);
});

test("setup preserves user-renamed sections and registers existing checkouts under their new names", (t) => {
  const { clone } = fixture(t);
  setupSubmodules(clone, () => {});
  git(clone, "config", "--file", ".gitmodules", "--rename-section", "submodule.app", "submodule.apps/app");
  const configuration = readFileSync(path.join(clone, ".gitmodules"), "utf8");
  const staged = git(clone, "diff", "--cached");
  setupSubmodules(clone, () => {});
  assert.equal(readFileSync(path.join(clone, ".gitmodules"), "utf8"), configuration);
  assert.equal(git(clone, "diff", "--cached"), staged);
  assert.ok(!git(clone, "submodule", "status").startsWith("-"));
  assert.deepEqual(inspectSubmodules(clone).errors, []);
});

test("configuration rejects unsafe paths, duplicates, overlapping entries, and parent origin", (t) => {
  const directory = repository(temporary(t));
  const config = (body) => writeFileSync(path.join(directory, ".gitmodules"), body);
  const entry = (name, prefix, url = "https://github.com/example/product.git") =>
    `[submodule "${name}"]\npath = ${prefix}\nurl = ${url}\nbranch = master\n`;
  for (const prefix of ["../escape", "/absolute", "apps/../escape", ".git/module", "."]) {
    config(entry("app", prefix));
    assert.throws(() => readSubmodules(directory, true), /unsafe submodule path/);
  }
  config(entry("app", "apps/app") + entry("other", "apps/app"));
  assert.throws(() => readSubmodules(directory, true), /overlapping/);
  config(entry("app", "apps/app") + entry("other", "apps/app/nested"));
  assert.throws(() => readSubmodules(directory, true), /overlapping/);
  config(entry("app", "apps/app") + entry("app", "apps/other"));
  assert.throws(() => readSubmodules(directory, true), /duplicate/);
  git(directory, "remote", "add", "origin", "git@github.com:example/product.git");
  config(entry("app", "apps/app"));
  assert.throws(() => readSubmodules(directory, true), /parent origin/);
});

test("doctor reports incorrect origin and setup repairs only configured URLs", (t) => {
  const { clone, app: upstream } = fixture(t);
  setupSubmodules(clone, () => {});
  const app = path.join(clone, "apps/app");
  git(app, "remote", "set-url", "origin", "/wrong/repository");
  assert.match(inspectSubmodules(clone).errors.join("\n"), /origin differs/);
  const head = git(app, "rev-parse", "HEAD");
  setupSubmodules(clone, () => {});
  assert.equal(git(app, "remote", "get-url", "origin"), upstream);
  assert.equal(git(app, "rev-parse", "HEAD"), head);
  assert.deepEqual(inspectSubmodules(clone).errors, []);
});

test("workspace records exactly nine root modules and recursively validates their gitlinks", () => {
  const modules = readSubmodules(ROOT, true);
  assert.equal(modules.length, 9);
  assert.deepEqual(modules.map((module) => path.basename(module.path)).sort(), [
    "ariane_lib", "ariane_plugin", "compass_lib", "compass_sidecar", "mnemo_lib",
    "mobile", "openspeleo_core", "openspeleo_lib", "web",
  ]);
  assert.ok(modules.every((module) => ["master", "main"].includes(module.branch)));
  const state = inspectSubmodules(ROOT);
  assert.deepEqual(state.errors, []);
  assert.equal(state.modules.length, 11);
});

test("all workspace .node-version files are byte-for-byte identical", () => {
  function versionFiles(directory) {
    const files = git(directory, "ls-files", "--cached", "--others", "--exclude-standard", "-z",
      "--", ".node-version", ":(glob)**/.node-version")
      .split("\0").filter(Boolean).map((file) => path.join(directory, file));
    return files.concat(readSubmodules(directory).flatMap((module) =>
      versionFiles(path.join(directory, module.path))));
  }

  const files = new Set(versionFiles(ROOT));
  for (const required of [".node-version", "apps/mobile/.node-version", "apps/web/.node-version"]) {
    assert.ok(files.has(path.join(ROOT, required)), `Missing required ${required}`);
  }
  const expected = readFileSync(path.join(ROOT, ".node-version"));
  assert.ok(expected.length > 0, "Root .node-version must not be empty");
  for (const file of files) {
    assert.deepEqual(readFileSync(file), expected,
      `${path.relative(ROOT, file)} must be byte-for-byte identical to root .node-version`);
  }
});
