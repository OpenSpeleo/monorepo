import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_MANIFEST = path.join(ROOT, ".monorepo", "subtrees.json");

export function loadManifest(filename = DEFAULT_MANIFEST) {
  return validateManifest(JSON.parse(readFileSync(filename, "utf8")));
}

export function validateManifest(manifest) {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.subtrees)) {
    throw new Error("subtree manifest must use schemaVersion 1 and contain subtrees");
  }

  const seenIds = new Set();
  const seenPrefixes = new Set();
  const seenRemotes = new Set();
  for (const subtree of manifest.subtrees) {
    for (const key of ["id", "prefix", "remote", "url", "baseBranch"]) {
      if (typeof subtree[key] !== "string" || subtree[key].trim() === "") {
        throw new Error(`subtree entry is missing ${key}`);
      }
    }
    if (
      path.isAbsolute(subtree.prefix) ||
      path.normalize(subtree.prefix) !== subtree.prefix ||
      subtree.prefix.startsWith("..")
    ) {
      throw new Error(`unsafe subtree prefix: ${subtree.prefix}`);
    }
    if (subtree.remote === "origin") {
      throw new Error(`subtree ${subtree.id} may not use the monorepo origin`);
    }
    for (const [label, value, values] of [
      ["id", subtree.id, seenIds],
      ["prefix", subtree.prefix, seenPrefixes],
      ["remote", subtree.remote, seenRemotes],
    ]) {
      if (values.has(value)) {
        throw new Error(`duplicate subtree ${label}: ${value}`);
      }
      values.add(value);
    }
  }
  if (manifest.subtrees.length === 0) {
    throw new Error("subtree manifest may not be empty");
  }
  return manifest;
}

export function selectSubtrees(subtrees, selectors = []) {
  if (selectors.length === 0) return subtrees;
  const selected = [];
  for (const selector of selectors) {
    const matches = subtrees.filter(
      (subtree) =>
        subtree.id === selector ||
        subtree.prefix === selector ||
        path.basename(subtree.prefix) === selector,
    );
    if (matches.length === 0) throw new Error(`unknown subtree: ${selector}`);
    if (matches.length > 1) throw new Error(`ambiguous subtree: ${selector}`);
    if (!selected.includes(matches[0])) selected.push(matches[0]);
  }
  return selected;
}

export function normalizeGitUrl(url) {
  return url
    .trim()
    .replace(/^git@github\.com:/, "github.com/")
    .replace(/^ssh:\/\/git@github\.com\//, "github.com/")
    .replace(/^https?:\/\/(?:www\.)?github\.com\//, "github.com/")
    .replace(/\/$/, "")
    .replace(/\.git$/, "")
    .toLowerCase();
}

export function assertSafeRemote(subtree, originUrl = "") {
  if (subtree.remote === "origin") {
    throw new Error(`refusing to push ${subtree.id}: remote is origin`);
  }
  if (originUrl && normalizeGitUrl(subtree.url) === normalizeGitUrl(originUrl)) {
    throw new Error(`refusing to push ${subtree.id}: URL is the monorepo origin`);
  }
}

export function githubSlug(url) {
  const normalized = normalizeGitUrl(url);
  if (!normalized.startsWith("github.com/")) {
    throw new Error(`cannot derive a GitHub repository from ${url}`);
  }
  return normalized.slice("github.com/".length);
}

export function pathsForSubtree(paths, prefix) {
  return paths.filter((filename) => filename === prefix || filename.startsWith(`${prefix}/`));
}

export function pushCommand(subtree, branch) {
  return [
    "subtree",
    "push",
    `--prefix=${subtree.prefix}`,
    subtree.remote,
    branch,
  ];
}

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
    env: options.env ?? process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new Error(`${command} ${args.join(" ")} failed${detail ? `: ${detail}` : ""}`);
  }
  return {
    status: result.status ?? 1,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

export function git(args, options = {}) {
  return run("git", args, options);
}

export function gitConfig(key) {
  return git(["config", "--get", key], { allowFailure: true }).stdout;
}

export function currentBranch() {
  const branch = git(["branch", "--show-current"]).stdout;
  if (!branch) throw new Error("detached HEAD is not supported for subtree publishing");
  return branch;
}

export function effectivePushBranch(subtree, branch = currentBranch()) {
  return (
    gitConfig(`monorepo.subtree.${subtree.id}.pushBranch`) ||
    gitConfig(`unirepo.subtree.${subtree.prefix}.pushBranch`) ||
    gitConfig("monorepo.pushBranch") ||
    branch
  );
}

export function lastSubtreeCommit(prefix) {
  return git([
    "log",
    "-1",
    "--format=%H",
    "--fixed-strings",
    `--grep=git-subtree-dir: ${prefix}`,
  ]).stdout;
}

export function subtreeState(subtree) {
  const baseline = lastSubtreeCommit(subtree.prefix);
  const committed = baseline
    ? git(["diff", "--name-only", `${baseline}..HEAD`, "--", subtree.prefix]).stdout
    : "missing subtree history";
  const worktree = git([
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
    "--",
    subtree.prefix,
  ]).stdout;
  return {
    baseline,
    committed: Boolean(committed),
    dirty: Boolean(worktree),
    changed: Boolean(committed || worktree),
  };
}

export function commandExists(command) {
  try {
    execFileSync(command, ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
