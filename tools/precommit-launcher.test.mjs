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

test("root prek hooks exclude every subtree prefix", () => {
  const config = readFileSync(
    path.join(ROOT, ".pre-commit-config.yaml"),
    "utf8",
  );
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

test("root prek discovery excludes standalone application projects", () => {
  const ignoredProjects = readFileSync(path.join(ROOT, ".prekignore"), "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  assert.deepEqual(ignoredProjects, [
    "apps/mobile/",
    "apps/ariane_plugin/",
    "apps/compass_sidecar/",
  ]);
});

test("web services share a dev-user-owned monorepo node_modules volume", () => {
  const baseCompose = readFileSync(
    path.join(ROOT, "apps/web/local.yml"),
    "utf8",
  );
  const rootOverride = readFileSync(
    path.join(ROOT, ".devcontainer/compose.override.yml"),
    "utf8",
  );
  const nodeModulesSetup = readFileSync(
    path.join(ROOT, ".devcontainer/prepare-web-node-modules.sh"),
    "utf8",
  );
  const postCreate = readFileSync(
    path.join(ROOT, ".devcontainer/setup.sh"),
    "utf8",
  );
  const volume = "speleodb_local_web_node_modules";
  const workspaceMount = `${volume}:/workspace/apps/web/node_modules`;

  assert.ok(baseCompose.includes(`${volume}:/app/node_modules`));
  assert.equal(
    rootOverride.split(workspaceMount).length - 1,
    3,
    "every monorepo web service must mount the same workspace alias",
  );
  assert.match(
    rootOverride,
    /name: "\$\{COMPOSE_INSTANCE_PREFIX:-speleodb_devcontainer\}_local_web_node_modules"/,
  );
  assert.match(rootOverride, /django:\n\s+user: dev-user/);
  assert.match(rootOverride, /django-webserver:\n\s+user: dev-user/);
  assert.match(rootOverride, /setup:\n\s+user: root/);
  assert.equal(
    [...rootOverride.matchAll(/prepare-web-node-modules\.sh/g)].length,
    2,
  );
  assert.match(postCreate, /prepare-web-node-modules\.sh/);
  assert.match(nodeModulesSetup, /stat -c %u/);
  assert.match(nodeModulesSetup, /chown -R/);
  assert.match(nodeModulesSetup, /-ef "\$\{WORKSPACE_NODE_MODULES_DIR\}"/);
});

test("root Python integration keeps web virtual and shared libraries editable", () => {
  const project = readFileSync(path.join(ROOT, "pyproject.toml"), "utf8");
  const lock = readFileSync(path.join(ROOT, "uv.lock"), "utf8");
  const standaloneWebProject = readFileSync(
    path.join(ROOT, "apps/web/pyproject.toml"),
    "utf8",
  );

  assert.match(project, /requires-python = ">=3\.14,<3\.15"/);
  assert.match(project, /"SpeleoDB_Repo\[local\]"/);
  assert.match(
    project,
    /SpeleoDB_Repo = \{ path = "\.\/apps\/web\/", package = false \}/,
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
    /django-webserver:[\s\S]*environment: \*monorepo_python_environment/,
  );
  assert.match(
    rootOverride,
    /setup:[\s\S]*environment: \*monorepo_python_environment/,
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

test("local run reports the web mypy hook as skipped when dmypy is absent", () => {
  const result = runLauncher({ ci: false, dmypy: false });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.args, [
    "run",
    "--skip",
    "apps/web:mypy",
    "--all-files",
  ]);
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
