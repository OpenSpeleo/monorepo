import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, mkdirSync, copyFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { ROOT, readSubmodules } from "./workspace.mjs";

function runLauncher({ mypy = true, args = ["--all-files"], cwd = ROOT, failProject = "" } = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), "speleodb-hook-"));
  try {
    const log = path.join(directory, "prek.log");
    const prek = path.join(directory, "prek");
    writeFileSync(prek, `#!${process.execPath}\n` + String.raw`
const fs = require("node:fs");
fs.appendFileSync(process.env.PREK_TEST_LOG, JSON.stringify({cwd:process.cwd(),args:process.argv.slice(2)})+"\n");
if (process.env.PREK_FAIL_PROJECT && process.cwd().endsWith(process.env.PREK_FAIL_PROJECT)) process.exit(17);
`);
    chmodSync(prek, 0o755);
    const mypyPath = path.join(directory, "mypy");
    if (mypy) {
      writeFileSync(mypyPath, "#!/bin/sh\nexit 0\n");
      chmodSync(mypyPath, 0o755);
    }
    const result = spawnSync("bash", [path.join(ROOT, "scripts/run-precommit.sh"), ...args], {
      cwd, encoding: "utf8",
      env: { ...process.env, PREK_BIN: prek, MYPY_BIN: mypyPath, PREK_TEST_LOG: log, PREK_FAIL_PROJECT: failProject },
    });
    const invocations = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").map(JSON.parse) : [];
    return { ...result, invocations };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("root hooks exclude all submodules and manual application boundaries remain explicit", () => {
  const config = readFileSync(path.join(ROOT, ".pre-commit-config.yaml"), "utf8");
  for (const module of readSubmodules()) assert.ok(config.includes(`${module.path}/`));
  const excluded = readFileSync(path.join(ROOT, ".prekignore"), "utf8").split("\n")
    .map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
  assert.deepEqual(excluded, ["apps/mobile/", "apps/ariane_plugin/", "apps/compass_sidecar/"]);
});

test("root Python integration keeps web virtual and shared libraries editable", () => {
  const project = readFileSync(path.join(ROOT, "pyproject.toml"), "utf8");
  const lock = readFileSync(path.join(ROOT, "uv.lock"), "utf8");
  const standaloneWebProject = readFileSync(
    path.join(ROOT, "apps/web/pyproject.toml"),
    "utf8",
  );

  assert.match(project, /requires-python = ">=3\.14,<3\.15"/);
  assert.match(project, /"speleodb_website\[local\]"/);
  assert.match(
    project,
    /speleodb_website = \{ path = "\.\/apps\/web\/", package = false \}/,
  );
  assert.match(lock, /source = \{ virtual = "apps\/web" \}/);
  for (const library of [
    "compass_lib",
    "mnemo_lib",
    "openspeleo_core",
    "openspeleo_lib",
  ]) {
    assert.match(
      lock,
      new RegExp(`source = \\{ editable = "packages/python/${library}" \\}`),
    );
  }
  assert.doesNotMatch(standaloneWebProject, /packages\/python\//);
});

test("devcontainer imports all web libraries from live monorepo source", () => {
  const rootOverride = readFileSync(
    path.join(ROOT, ".devcontainer/compose.override.yml"),
    "utf8",
  );
  const postCreate = readFileSync(
    path.join(ROOT, ".devcontainer/setup.sh"),
    "utf8",
  );
  const coreSync = readFileSync(
    path.join(ROOT, ".devcontainer/sync-openspeleo-core.sh"),
    "utf8",
  );
  const webDockerfile = readFileSync(
    path.join(ROOT, "apps/web/compose/Dockerfile"),
    "utf8",
  );
  const coreProject = readFileSync(
    path.join(ROOT, "packages/python/openspeleo_core/pyproject.toml"),
    "utf8",
  );
  const rootDevcontainer = readFileSync(
    path.join(ROOT, ".devcontainer/devcontainer.json"),
    "utf8",
  );
  const standaloneDevcontainer = readFileSync(
    path.join(ROOT, "apps/web/.devcontainer/devcontainer.json"),
    "utf8",
  );

  for (const library of [
    "compass_lib",
    "mnemo_lib",
    "openspeleo_core",
    "openspeleo_lib",
  ]) {
    assert.ok(
      rootOverride.includes(`/workspace/packages/python/${library}`),
      `${library} must be present on the devcontainer PYTHONPATH`,
    );
    assert.match(postCreate, new RegExp(`import ${library}`));
  }
  assert.match(
    rootOverride,
    /django-webserver:[\s\S]*environment: \*monorepo_web_environment/,
  );
  assert.match(
    rootOverride,
    /setup:[\s\S]*environment: \*monorepo_setup_environment/,
  );
  assert.match(rootOverride, /DOCKER_INCLUDE_MONOREPO_RUST_TOOLCHAIN: "1"/);
  assert.match(postCreate, /sync-openspeleo-core\.sh/);
  assert.match(coreSync, /uv sync/);
  assert.match(coreSync, /--inexact/);
  assert.match(coreSync, /--no-dev/);
  assert.match(coreSync, /UV_LINK_MODE=.*copy/);
  assert.match(coreSync, /VENV="\/opt\/speleodb-venv"/);
  assert.match(coreSync, /sudo --set-home/);
  assert.match(coreSync, /-u "\$\{CACHE_USER\}"/);
  assert.match(coreSync, /chown -R "\$\{CACHE_USER\}:\$\{CACHE_USER\}"/);
  assert.match(coreSync, /chmod -R u\+rwX,g\+rwX/);
  assert.match(coreSync, /\.dev-user-venv-v1/);
  assert.doesNotMatch(coreSync, /maturin develop/);
  assert.doesNotMatch(coreSync, /cargo install/);
  assert.match(webDockerfile, /VIRTUAL_ENV="\/opt\/speleodb-venv"/);
  assert.match(webDockerfile, /UV_PROJECT_ENVIRONMENT="\$\{VIRTUAL_ENV\}"/);
  assert.match(webDockerfile, /UV_CACHE_DIR=\/app\/\.uv\/cache/);
  assert.match(rootOverride, /UV_CACHE_DIR: \/monorepo-python-build-cache\/uv/);
  assert.doesNotMatch(rootOverride, /UV_CACHE_DIR:.*speleodb-venv/);
  assert.doesNotMatch(rootOverride, /^\s+- -lc$/m);
  assert.match(
    rootDevcontainer,
    /"python\.defaultInterpreterPath": "\/opt\/speleodb-venv\/bin\/python"/,
  );
  assert.match(
    standaloneDevcontainer,
    /"defaultInterpreterPath": "\/opt\/speleodb-venv\/bin\/python"/,
  );
  assert.match(coreProject, /editable-profile = "dev"/);
  for (const cacheKey of [
    "pyproject.toml",
    "Cargo.toml",
    "Cargo.lock",
    "src_rust/**/*",
  ]) {
    assert.ok(
      coreProject.includes(`{ file = "${cacheKey}" }`),
      `openspeleo_core cache key must include ${cacheKey}`,
    );
  }

  const rustLayer = webDockerfile.indexOf(
    "ARG DOCKER_INCLUDE_MONOREPO_RUST_TOOLCHAIN=0",
  );
  const pythonLayer = webDockerfile.indexOf("# Install Project Dependencies");
  assert.ok(rustLayer >= 0, "web image must define an opt-in Rust layer");
  assert.ok(
    rustLayer < pythonLayer,
    "the opt-in Rust layer must precede Python dependency installation",
  );
});

test("default validation invokes root, web, and five libraries in their own Git roots", () => {
  const result = runLauncher();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.invocations.map((call) => path.relative(ROOT, call.cwd) || "."), [
    ".", "apps/web", "packages/python/ariane_lib", "packages/python/compass_lib",
    "packages/python/mnemo_lib", "packages/python/openspeleo_core", "packages/python/openspeleo_lib",
  ]);
  assert.ok(result.invocations.every((call) => JSON.stringify(call.args) === JSON.stringify(["run", "--all-files"])));
});

test("a qualified web hook is invoked locally with native options intact", () => {
  const result = runLauncher({ args: ["apps/web:mypy", "--all-files", "--hook-stage", "manual"], cwd: path.join(ROOT, "apps/web") });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.invocations, [{ cwd: path.join(ROOT, "apps/web"), args: ["run", "mypy", "--all-files", "--hook-stage", "manual"] }]);
});

test("validation fails fast without skipping an unsuccessful project", () => {
  const result = runLauncher({ failProject: "/apps/web" });
  assert.equal(result.status, 17);
  assert.equal(result.invocations.length, 2);
});

test("missing mypy fails web validation before running any hooks", () => {
  const result = runLauncher({ mypy: false });
  assert.equal(result.status, 127);
  assert.match(result.stderr, /mypy is required/);
  assert.deepEqual(result.invocations, []);
});

test("root-only checks do not require mypy", () => {
  const result = runLauncher({ mypy: false, args: [".:check-json", "--all-files"] });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.invocations, [{ cwd: ROOT, args: ["run", "check-json", "--all-files"] }]);
});

test("ambiguous file/ref arguments and manual-only applications fail explicitly", () => {
  for (const args of [["--files", "apps/web/manage.py"], ["--from-ref", "HEAD~1"], ["apps/mobile", "--all-files"]]) {
    const result = runLauncher({ args });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /prek -C/);
    assert.deepEqual(result.invocations, []);
  }
});

test("missing submodules fail with setup guidance instead of silently skipping checks", (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "speleodb-hook-missing-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(path.join(directory, "scripts"));
  copyFileSync(path.join(ROOT, "scripts/run-precommit.sh"), path.join(directory, "scripts/run-precommit.sh"));
  copyFileSync(path.join(ROOT, ".gitmodules"), path.join(directory, ".gitmodules"));
  copyFileSync(path.join(ROOT, ".prekignore"), path.join(directory, ".prekignore"));
  const result = spawnSync("bash", ["scripts/run-precommit.sh", "apps/web:mypy", "--all-files"], { cwd: directory, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not initialized; run make setup/);
});

test("malformed submodule configuration cannot silently reduce validation to root only", (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "speleodb-hook-config-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(path.join(directory, "scripts"));
  copyFileSync(path.join(ROOT, "scripts/run-precommit.sh"), path.join(directory, "scripts/run-precommit.sh"));
  copyFileSync(path.join(ROOT, ".prekignore"), path.join(directory, ".prekignore"));
  writeFileSync(path.join(directory, ".gitmodules"), "[broken\n");
  const result = spawnSync("bash", ["scripts/run-precommit.sh", "--all-files"], {
    cwd: directory, encoding: "utf8", env: { ...process.env, PREK_BIN: "/usr/bin/true", MYPY_BIN: "/usr/bin/true" },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /bad config/);
});

test("web type checking uses regular mypy", () => {
  const config = readFileSync(path.join(ROOT, "apps/web/.pre-commit-config.yaml"), "utf8");
  assert.match(config, /^\s+entry: mypy$/m);
  assert.doesNotMatch(config, /^\s+entry: dmypy$/m);
  assert.ok(config.includes('args: ["--config-file", "pyproject.toml", "."]'));
});
