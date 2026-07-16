#!/usr/bin/env node

import { existsSync } from "node:fs";
import path from "node:path";
import {
  ROOT,
  assertSafeRemote,
  commandExists,
  currentBranch,
  effectivePushBranch,
  git,
  githubSlug,
  loadManifest,
  pushCommand,
  run,
  selectSubtrees,
  subtreeState,
} from "./subtree-lib.mjs";

function usage() {
  console.log(`Usage: node tools/subtree.mjs <command> [options]

Commands:
  setup                       Configure remotes, branches, and submodules
  doctor                      Validate the development environment
  status [--subtree NAME]     Show all subtree branches and changes
  pull [--subtree NAME]       Pull and squash upstream changes
  push [--subtree NAME]       Preview subtree pushes (safe default)
  push --execute [...]        Execute the selected subtree pushes
  branch NAME                 Create/switch the shared push branch
  pr --title TEXT [...]       Open one GitHub PR per selected subtree

Selectors accept a manifest id (mobile), prefix (apps/mobile), or unique basename.
Repeat --subtree or pass a comma-separated list to select more than one subtree.`);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { selectors: [], execute: false, title: "", body: "", positionals: [] };
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (value === "--execute") {
      options.execute = true;
    } else if (["--subtree", "--title", "--body"].includes(value)) {
      const next = rest[index + 1];
      if (!next) throw new Error(`${value} requires a value`);
      index += 1;
      if (value === "--subtree") options.selectors.push(...next.split(",").filter(Boolean));
      if (value === "--title") options.title = next;
      if (value === "--body") options.body = next;
    } else if (value === "--help" || value === "-h") {
      options.help = true;
    } else if (value.startsWith("--")) {
      throw new Error(`unknown option: ${value}`);
    } else {
      options.positionals.push(value);
    }
  }
  return { command, options };
}

function ensureRoot() {
  const actual = git(["rev-parse", "--show-toplevel"]).stdout;
  if (path.resolve(actual) !== ROOT) {
    throw new Error(`run this command from the monorepo root: ${ROOT}`);
  }
}

function originUrl() {
  return git(["remote", "get-url", "origin"], { allowFailure: true }).stdout;
}

function setup(subtrees) {
  for (const subtree of subtrees) {
    assertSafeRemote(subtree, originUrl());
    const currentUrl = git(["remote", "get-url", subtree.remote], { allowFailure: true }).stdout;
    if (!currentUrl) {
      git(["remote", "add", subtree.remote, subtree.url]);
      console.log(`added remote ${subtree.remote}`);
    } else if (currentUrl !== subtree.url) {
      git(["remote", "set-url", subtree.remote, subtree.url]);
      console.log(`updated remote ${subtree.remote}`);
    }
    git(["config", `monorepo.subtree.${subtree.id}.baseBranch`, subtree.baseBranch]);
    git(["config", `unirepo.subtree.${subtree.prefix}.branch`, subtree.baseBranch]);
  }
  if (existsSync(path.join(ROOT, ".gitmodules"))) {
    git(["submodule", "sync", "--recursive"], { stdio: "inherit" });
    const uninitialized = git(["submodule", "status", "--recursive"], {
      allowFailure: true,
    }).stdout
      .split("\n")
      .filter((line) => line.startsWith("-"))
      .map((line) => line.trim().split(/\s+/)[1])
      .filter(Boolean);
    if (uninitialized.length > 0) {
      git(["submodule", "update", "--init", "--recursive", "--", ...uninitialized], {
        stdio: "inherit",
      });
    } else {
      console.log("Ariane submodules already initialized");
    }
  }
  console.log(`setup complete (${subtrees.length} subtrees)`);
}

function doctor(subtrees) {
  let failed = false;
  for (const command of ["git", "node", "npm", "uv", "cargo", "rustc", "java"]) {
    const found = commandExists(command);
    console.log(`${found ? "ok  " : "FAIL"} command ${command}`);
    failed ||= !found;
  }
  console.log(`${commandExists("gh") ? "ok  " : "warn"} command gh (required only for subtree-pr)`);

  const origin = originUrl();
  for (const subtree of subtrees) {
    try {
      assertSafeRemote(subtree, origin);
      const url = git(["remote", "get-url", subtree.remote], { allowFailure: true }).stdout;
      const ok = url === subtree.url && existsSync(path.join(ROOT, subtree.prefix));
      console.log(`${ok ? "ok  " : "FAIL"} subtree ${subtree.id} (${subtree.prefix})`);
      failed ||= !ok;
    } catch (error) {
      console.log(`FAIL subtree ${subtree.id}: ${error.message}`);
      failed = true;
    }
  }

  const submodules = git(["submodule", "status", "--recursive"], { allowFailure: true });
  const submodulesOk = submodules.status === 0 && !submodules.stdout.split("\n").some((line) => line.startsWith("-"));
  console.log(`${submodulesOk ? "ok  " : "FAIL"} Ariane submodules initialized`);
  failed ||= !submodulesOk;
  if (failed) process.exitCode = 1;
}

function status(subtrees) {
  const workspaceBranch = currentBranch();
  console.log(`workspace branch: ${workspaceBranch}`);
  console.log("subtree             base    push branch         state       prefix");
  for (const subtree of subtrees) {
    const state = subtreeState(subtree);
    const label = state.dirty ? "uncommitted" : state.committed ? "changed" : "clean";
    console.log(
      `${subtree.id.padEnd(19)} ${subtree.baseBranch.padEnd(7)} ${effectivePushBranch(subtree, workspaceBranch).padEnd(19)} ${label.padEnd(11)} ${subtree.prefix}`,
    );
  }
}

function requireCleanWorktree(subtrees) {
  const dirty = subtrees.filter((subtree) => subtreeState(subtree).dirty);
  if (dirty.length > 0) {
    throw new Error(`commit or stash changes in: ${dirty.map((item) => item.prefix).join(", ")}`);
  }
}

function pull(subtrees) {
  const dirty = git(["status", "--porcelain=v1", "--untracked-files=all"]).stdout;
  if (dirty) throw new Error("subtree pull requires a completely clean worktree");
  for (const subtree of subtrees) {
    assertSafeRemote(subtree, originUrl());
    console.log(`pulling ${subtree.prefix} from ${subtree.remote}/${subtree.baseBranch}`);
    git(
      ["subtree", "pull", `--prefix=${subtree.prefix}`, subtree.remote, subtree.baseBranch, "--squash"],
      { stdio: "inherit" },
    );
  }
}

function changedOrSelected(subtrees, selectors) {
  if (selectors.length > 0) return selectSubtrees(subtrees, selectors);
  return subtrees.filter((subtree) => subtreeState(subtree).changed);
}

function push(subtrees, execute) {
  if (subtrees.length === 0) {
    console.log("no changed subtrees");
    return;
  }
  if (execute) requireCleanWorktree(subtrees);
  const origin = originUrl();
  for (const subtree of subtrees) {
    assertSafeRemote(subtree, origin);
    const branch = effectivePushBranch(subtree);
    const args = pushCommand(subtree, branch);
    if (!execute) {
      console.log(`[dry-run] git ${args.join(" ")}`);
    } else {
      console.log(`pushing ${subtree.prefix} to ${subtree.remote}/${branch}`);
      git(args, { stdio: "inherit" });
    }
  }
  if (!execute) console.log("dry run only; use --execute after reviewing this list");
}

function branch(name) {
  if (!name) throw new Error("branch requires a branch name");
  const exists = git(["show-ref", "--verify", `refs/heads/${name}`], { allowFailure: true }).status === 0;
  git(["switch", ...(exists ? [name] : ["-c", name])], { stdio: "inherit" });
  git(["config", "monorepo.pushBranch", name]);
  console.log(`default subtree push branch: ${name}`);
}

function pr(subtrees, title, body) {
  if (!title) throw new Error("pr requires --title");
  if (!commandExists("gh")) throw new Error("gh is required to create pull requests");
  if (subtrees.length === 0) {
    console.log("no changed subtrees");
    return;
  }
  requireCleanWorktree(subtrees);
  const origin = originUrl();
  for (const subtree of subtrees) {
    assertSafeRemote(subtree, origin);
    const args = [
      "pr",
      "create",
      "--repo",
      githubSlug(subtree.url),
      "--base",
      subtree.baseBranch,
      "--head",
      effectivePushBranch(subtree),
      "--title",
      title,
      "--body",
      body || "Created from the SpeleoDB monorepo subtree workflow.",
    ];
    run("gh", args, { stdio: "inherit" });
  }
}

function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (!command || options.help) {
    usage();
    return;
  }
  ensureRoot();
  const { subtrees } = loadManifest();
  const selected = selectSubtrees(subtrees, options.selectors);
  if (command === "setup") setup(subtrees);
  else if (command === "doctor") doctor(subtrees);
  else if (command === "status") status(selected);
  else if (command === "pull") pull(selected);
  else if (command === "push") push(changedOrSelected(subtrees, options.selectors), options.execute);
  else if (command === "branch") branch(options.positionals[0]);
  else if (command === "pr") pr(changedOrSelected(subtrees, options.selectors), options.title, options.body);
  else throw new Error(`unknown command: ${command}`);
}

try {
  main();
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exitCode = 1;
}
