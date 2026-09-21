#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function git(args, cwd = ROOT, allowFailure = false) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`git ${args.join(" ")}: ${(result.stderr || result.stdout).trim()}`);
  }
  return result;
}

function normalizeUrl(url) {
  return url.trim()
    .replace(/^git@github\.com:/, "github.com/")
    .replace(/^ssh:\/\/git@github\.com\//, "github.com/")
    .replace(/^https?:\/\/(?:www\.)?github\.com\//, "github.com/")
    .replace(/\/$/, "").replace(/\.git$/, "").toLowerCase();
}

export function readSubmodules(directory = ROOT, requireBranches = false) {
  if (!existsSync(path.join(directory, ".gitmodules"))) {
    if (requireBranches) throw new Error("missing root .gitmodules");
    return [];
  }
  const result = git(["config", "--file", ".gitmodules", "--null", "--list"], directory);
  const records = new Map();
  for (const entry of result.stdout.split("\0").filter(Boolean)) {
    const separator = entry.indexOf("\n");
    const key = separator < 0 ? entry : entry.slice(0, separator);
    const value = separator < 0 ? "" : entry.slice(separator + 1);
    const match = /^submodule\.(.+)\.(path|url|branch)$/.exec(key);
    if (!match) continue;
    const [, name, field] = match;
    const record = records.get(name) || { name };
    if (Object.hasOwn(record, field)) throw new Error(`duplicate ${field} for submodule ${name}`);
    record[field] = value;
    records.set(name, record);
  }
  const origin = git(["remote", "get-url", "origin"], directory, true).stdout.trim();
  const modules = [...records.values()];
  for (const module of modules) {
    const prefix = module.path;
    if (!prefix || path.isAbsolute(prefix) || /^[A-Za-z]:/.test(prefix) ||
        prefix.includes("\\") || prefix === "." || prefix === ".." ||
        prefix.startsWith("../") || path.normalize(prefix) !== prefix ||
        prefix.split("/").includes(".git")) {
      throw new Error(`unsafe submodule path: ${prefix}`);
    }
    if (!module.url || module.url.startsWith("-")) throw new Error(`missing or unsafe URL for ${prefix}`);
    if (origin && normalizeUrl(module.url) === normalizeUrl(origin)) {
      throw new Error(`submodule ${prefix} points to its parent origin`);
    }
    if (requireBranches && !module.branch) throw new Error(`missing branch for ${prefix}`);
    if (module.branch && module.branch !== "." &&
        git(["check-ref-format", "--branch", module.branch], directory, true).status !== 0) {
      throw new Error(`invalid branch for ${prefix}`);
    }
    for (const other of modules) {
      if (other !== module && (prefix === other.path || prefix.startsWith(`${other.path}/`))) {
        throw new Error(`overlapping submodule paths: ${other.path}, ${prefix}`);
      }
    }
  }
  if (requireBranches && modules.length === 0) throw new Error("root .gitmodules is empty");
  return modules;
}

function indexedCommit(directory, prefix) {
  const records = git(["ls-files", "--stage", "-z", "--", prefix], directory).stdout.split("\0");
  const entry = records.find((line) => line.endsWith(`\t${prefix}`));
  const match = entry && /^160000 ([a-f0-9]+) 0\t/.exec(entry);
  if (!match) throw new Error(`${prefix} is not an unconflicted indexed gitlink`);
  return match[1];
}

function initialized(directory) {
  if (!existsSync(path.join(directory, ".git"))) return false;
  const result = git(["rev-parse", "--show-toplevel"], directory, true);
  return result.status === 0 && realpathSync(result.stdout.trim()) === realpathSync(directory);
}

export function setupSubmodules(directory = ROOT, log = console.log, top = true) {
  for (const module of readSubmodules(directory, top)) {
    indexedCommit(directory, module.path);
    const checkout = path.join(directory, module.path);
    // Register renamed sections too; existing gitfiles can continue pointing
    // to their original Git directories without rewriting .gitmodules.
    git(["submodule", "init", "--", module.path], directory);
    git(["submodule", "sync", "--", module.path], directory);
    if (!initialized(checkout)) {
      git(["submodule", "update", "--init", "--", module.path], directory);
      log(`initialized ${checkout}`);
    } else {
      log(`preserved ${checkout}`);
    }
    // Visit one repository at a time: a recursive update here would reset
    // already-initialized descendants to their parent's recorded commits.
    setupSubmodules(checkout, log, false);
  }
}

export function inspectSubmodules(directory = ROOT) {
  const result = { modules: [], errors: [], warnings: [] };
  function visit(parent, top) {
    let modules;
    try { modules = readSubmodules(parent, top); }
    catch (error) { result.errors.push(error.message); return; }
    for (const module of modules) {
      const checkout = path.join(parent, module.path);
      const label = path.relative(directory, checkout);
      try {
        const expected = indexedCommit(parent, module.path);
        if (!initialized(checkout)) throw new Error(`${label} is not initialized; run make setup`);
        const url = git(["remote", "get-url", "origin"], checkout).stdout.trim();
        // Git resolves relative nested URLs when initializing them.
        const configured = git(["config", "--get", `submodule.${module.name}.url`], parent, true).stdout.trim();
        const wanted = module.url.startsWith(".") ? configured : module.url;
        if (!wanted || normalizeUrl(url) !== normalizeUrl(wanted)) {
          throw new Error(`${label} origin differs from .gitmodules; run make setup`);
        }
        const actual = git(["rev-parse", "HEAD"], checkout).stdout.trim();
        const dirty = git(["status", "--porcelain=v1", "--untracked-files=normal"], checkout).stdout.trim();
        if (actual !== expected) result.warnings.push(`${label} differs from its recorded commit (preserved)`);
        if (dirty) result.warnings.push(`${label} has local changes (preserved)`);
        result.modules.push({ ...module, path: label, commit: actual });
        visit(checkout, false);
      } catch (error) { result.errors.push(error.message); }
    }
  }
  visit(directory, true);
  return result;
}

function doctor(submodulesOnly) {
  let failed = false;
  if (!submodulesOnly) {
    for (const command of ["git", "node", "npm", "uv", "cargo", "rustc", "java"]) {
      const result = spawnSync(command, ["--version"], { encoding: "utf8" });
      const ok = result.status === 0;
      console.log(`${ok ? "ok  " : "FAIL"} command ${command}`);
      failed ||= !ok;
      if (command === "uv" && ok) {
        const match = /^uv (\d+)\.(\d+)\.(\d+)/.exec(result.stdout);
        const versionOk = match && (Number(match[1]) > 0 || Number(match[2]) > 12 ||
          (Number(match[2]) === 12 && Number(match[3]) >= 17));
        console.log(`${versionOk ? "ok  " : "FAIL"} uv >=0.12.17 (required by upstream web dependency overrides)`);
        failed ||= !versionOk;
      }
    }
    const nodeOk = Number(process.versions.node.split(".")[0]) === 26;
    console.log(`${nodeOk ? "ok  " : "FAIL"} Node 26 (running ${process.versions.node})`);
    failed ||= !nodeOk;
  }
  const result = inspectSubmodules();
  for (const module of result.modules) console.log(`ok   submodule ${module.path}`);
  for (const warning of result.warnings) console.log(`warn ${warning}`);
  for (const error of result.errors) console.error(`FAIL ${error}`);
  if (failed || result.errors.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, ...args] = process.argv.slice(2);
    if (!command || command === "--help") {
      console.log("Usage: node tools/workspace.mjs setup | doctor [--submodules-only]");
    } else {
      if (realpathSync(process.cwd()) !== realpathSync(ROOT)) throw new Error("run from the monorepo root");
      if (command === "setup" && args.length === 0) setupSubmodules();
      else if (command === "doctor" && (args.length === 0 || (args.length === 1 && args[0] === "--submodules-only"))) doctor(args.length === 1);
      else throw new Error("expected setup or doctor [--submodules-only]");
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
