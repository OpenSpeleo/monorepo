import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (name) => readFileSync(path.join(root, name), "utf8");
const devcontainer = JSON.parse(read(".devcontainer/devcontainer.json"));
const override = read(".devcontainer/compose.override.yml");

function repositoryPaths(directory = root) {
  const config = path.join(directory, ".gitmodules");
  if (!existsSync(config)) return [];
  const result = spawnSync(
    "git",
    ["config", "--null", "--file", config, "--get-regexp", "^submodule\\..*\\.path$"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout
    .split("\0")
    .filter(Boolean)
    .flatMap((entry) => {
      const relative = entry.slice(entry.indexOf("\n") + 1);
      const repository = path.join(directory, relative);
      return [repository, ...repositoryPaths(repository)];
    });
}

test("container Git trust covers every canonical repository without wildcard trust", () => {
  const trusted = [...override.matchAll(/^  GIT_CONFIG_VALUE_\d+: (.+)$/gm)]
    .map((match) => match[1]);
  const expected = [root, ...repositoryPaths()]
    .map((repository) => path.posix.join("/workspace", path.relative(root, repository)));
  assert.deepEqual(trusted.toSorted(), expected.toSorted());
  assert.equal(new Set(trusted).size, trusted.length);
  assert.match(override, new RegExp(`GIT_CONFIG_COUNT: "${trusted.length}"`));
  for (let index = 0; index < trusted.length; index += 1) {
    assert.match(override, new RegExp(`GIT_CONFIG_KEY_${index}: safe\\.directory`));
    assert.match(override, new RegExp(`GIT_CONFIG_VALUE_${index}: /workspace`));
  }
});

test("native build preserves Git trust through both sudo transitions", () => {
  const script = read(".devcontainer/sync-openspeleo-core.sh");
  const initialization = script.slice(0, script.indexOf('if [[ ! -d "${CORE_PROJECT}" ]]'));
  assert.ok(initialization.length > 0);
  const result = spawnSync(
    "bash",
    ["-c", `${initialization}\nprintf '%s' "$SUDO_PRESERVE_ENV"`],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_CONFIG_COUNT: "2",
        GIT_CONFIG_KEY_0: "safe.directory",
        GIT_CONFIG_VALUE_0: "/workspace",
        GIT_CONFIG_KEY_1: "safe.directory",
        GIT_CONFIG_VALUE_1: "/workspace/apps/web",
        GIT_CONFIG_SYSTEM: "/unrelated/config",
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const preserved = result.stdout.split(",");
  for (const name of [
    "CARGO_HOME", "CARGO_TARGET_DIR", "RUSTUP_HOME", "RUSTUP_TOOLCHAIN", "UV_CACHE_DIR",
    "GIT_CONFIG_COUNT", "GIT_CONFIG_KEY_0", "GIT_CONFIG_VALUE_0",
    "GIT_CONFIG_KEY_1", "GIT_CONFIG_VALUE_1",
  ]) assert.ok(preserved.includes(name), `${name} must survive sudo`);
  assert.ok(!preserved.includes("GIT_CONFIG_SYSTEM"));
  assert.equal(
    script.split('--preserve-env="${SUDO_PRESERVE_ENV}"').length - 1,
    2,
  );
});

const composeAvailable = spawnSync("docker", ["compose", "version"], {
  encoding: "utf8",
}).status === 0;

function composeConfig(files, { projectName, instancePrefix = "speleodb_config_test" } = {}) {
  const env = {
    ...process.env,
    KANCHI_CELERY_BROKER_URL: "redis://redis:6379/1",
  };
  delete env.COMPOSE_PROJECT_NAME;
  delete env.COMPOSE_INSTANCE_PREFIX;
  if (instancePrefix) env.COMPOSE_INSTANCE_PREFIX = instancePrefix;
  const result = spawnSync("docker", [
    "compose", "--env-file", "/dev/null", "--profile", "*",
    ...(projectName ? ["-p", projectName] : []),
    ...files.flatMap((filename) => ["-f", filename]),
    "config", "--format", "json", "--no-env-resolution",
  ], {
    cwd: root,
    encoding: "utf8",
    env,
    maxBuffer: 1024 * 1024,
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("merged devcontainer preserves the complete web service graph", {
  skip: composeAvailable ? false : "Docker Compose CLI is unavailable",
}, () => {
  const base = composeConfig(["apps/web/local.yml"]);
  const { services } = composeConfig([
    "apps/web/local.yml", ".devcontainer/compose.override.yml",
  ]);
  const active = Object.entries(services)
    .filter(([, service]) => !service.profiles?.length)
    .map(([name]) => name);
  assert.deepEqual(devcontainer.runServices.toSorted(), active.toSorted());
  assert.equal(devcontainer.forwardPorts, undefined);
  assert.equal(devcontainer.initializeCommand, undefined);
  assert.equal(devcontainer.updateRemoteUserUID, false);

  assert.deepEqual(services.django.ports.map((port) => [port.host_ip, port.published]),
    [["127.0.0.1", "8000"]]);
  assert.deepEqual(services.kanchi.ports.map((port) => [port.host_ip, port.published]),
    [["127.0.0.1", "8765"]]);
  for (const [name, service] of Object.entries(services)) {
    if (name !== "django") {
      assert.deepEqual(service.ports, base.services[name].ports, `${name} retains upstream ports`);
    }
    assert.equal(service.container_name, `speleodb_config_test-${name}`);
    if (active.includes(name)) {
      assert.equal(service.restart, name === "setup" ? "no" : "unless-stopped", name);
    }
  }

  for (const name of ["django", "django-webserver", "setup", "celery-worker", "celery-beat"]) {
    const service = services[name];
    assert.notEqual(service.network_mode, "host", name);
    assert.equal(service.user, name === "setup" ? "root" : "dev-user", name);
    assert.equal(service.build.args.DOCKER_INCLUDE_MONOREPO_RUST_TOOLCHAIN, "1", name);
    assert.equal(service.environment.CELERY_BROKER_URL, "redis://redis:6379/1", name);
    assert.equal(service.environment.REDIS_URL, "redis://redis:6379/0", name);
    assert.ok(service.environment.PYTHONPATH.split(":").includes("/app"),
      `${name} must import compose.wait_for_postgres when the shell starts in /workspace`);
    assert.equal(service.environment.AWS_S3_BROWSER_ENDPOINT_URL, "http://localhost:9000", name);
    if (name !== "setup") {
      assert.equal(service.environment.AWS_S3_TEST_ENDPOINT_URL, "http://rustfs:9000", name);
      assert.equal(service.environment.AWS_S3_TEST_BROWSER_ENDPOINT_URL, "http://rustfs:9000", name);
    }
    const mounts = Object.fromEntries(service.volumes.map((mount) => [mount.target, mount]));
    assert.equal(mounts["/workspace"].source, path.resolve(root), name);
    assert.equal(mounts["/app"].source, path.join(root, "apps/web"), name);
    assert.equal(mounts["/app/node_modules"].source,
      mounts["/workspace/apps/web/node_modules"].source, name);
    assert.equal(mounts["/monorepo-python-build-cache"].type, "volume", name);
  }

  for (const [name, entrypoint] of [
    ["celery-worker", "/start-celeryworker"], ["celery-beat", "/start-celerybeat"],
  ]) {
    assert.equal(services[name].depends_on.setup.condition, "service_completed_successfully");
    assert.equal(services[name].depends_on.redis.condition, "service_healthy");
    const command = services[name].command.join(" ");
    assert.ok(command.includes("sync-openspeleo-core.sh"));
    assert.ok(command.indexOf("sync-openspeleo-core.sh") < command.indexOf(`exec ${entrypoint}`));
    assert.ok(command.endsWith(`exec ${entrypoint}`));
  }
  assert.equal(services.kanchi.environment.CELERY_BROKER_URL, "redis://redis:6379/1");
  assert.equal(services.kanchi.volumes, undefined);
  assert.deepEqual(services["celery-test-redis"].profiles, ["integration-test"]);
});

test("Compose resource names follow the monorepo project and explicit project overrides", {
  skip: composeAvailable ? false : "Docker Compose CLI is unavailable",
}, () => {
  const files = ["apps/web/local.yml", ".devcontainer/compose.override.yml"];
  for (const projectName of [undefined, "speleodb-naming-test"]) {
    const config = composeConfig(files, { projectName, instancePrefix: null });
    const expected = projectName || "speleodb-monorepo";
    assert.equal(config.name, expected);
    for (const [name, service] of Object.entries(config.services)) {
      assert.equal(service.container_name, `${expected}-${name}`);
      if (service.build) assert.ok(service.image.startsWith(`${expected}-`), name);
    }
    for (const resource of [...Object.values(config.volumes), ...Object.values(config.networks)]) {
      assert.ok(resource.name.startsWith(`${expected}-`), resource.name);
    }
  }
  const custom = composeConfig(files, { projectName: "speleodb-naming-test", instancePrefix: "custom-instance" });
  assert.equal(custom.services.django.container_name, "custom-instance-django");
  assert.equal(custom.volumes.speleodb_local_web_node_modules.name, "custom-instance-web-node-modules");
  assert.equal(custom.volumes.speleodb_local_postgres_data.name, "speleodb-naming-test-postgres-data");
});
