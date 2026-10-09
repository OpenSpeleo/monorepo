import { spawnSync } from 'node:child_process';
import {
    existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync,
    rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectTypeScriptWorkspace } from '../../.devcontainer/typescript-projection.mjs';

const args = process.argv.slice(2);
if (args[0] === '--') args.shift();
if (args.some((arg) => !['--upgrade', '--help', '-h'].includes(arg))) {
    throw new Error('Usage: bun run lock [--upgrade]');
}
if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: bun run lock [--upgrade]\nResolve only the current package’s bun.lock (the integration graph at the monorepo root). --upgrade refreshes all resolutions within package.json constraints.');
    process.exit(0);
}

const root = realpathSync(process.cwd());
const integration = root === realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
const upgrade = args.includes('--upgrade');
const inputs = new Map(['package.json', '.bun-version', 'bunfig.toml', '.npmrc', 'bun.lock']
    .map((name) => [name, existsSync(join(root, name)) ? readFileSync(join(root, name)) : null]));
const version = inputs.get('.bun-version')?.toString().trim();
if (!version || process.versions.bun !== version) {
    throw new Error(`bun run lock requires Bun ${version || 'from .bun-version'}; running ${process.versions.bun ?? 'without Bun'}.`);
}
const manifest = JSON.parse(inputs.get('package.json')?.toString() ?? '{}');
if (!inputs.get('package.json')) throw new Error('Run this command from a package directory.');
if ((!integration && manifest.workspaces) || manifest.patchedDependencies || existsSync(join(root, 'bun.lockb'))) {
    throw new Error('Isolated locking supports a single package with a text bun.lock, without workspaces or local patches.');
}
// Relative/local inputs cannot be relocated safely into a temporary project.
function checkSpecs(value, localNames = new Set()) {
    for (const [name, spec] of Object.entries(value ?? {})) {
        if (spec && typeof spec === 'object') checkSpecs(spec, localNames);
        else if (spec === 'workspace:*' && localNames.has(name)) continue;
        else if (typeof spec === 'string' && /^(?:file:|link:|workspace:|catalog:|\.\.?\/|\/|~\/)/.test(spec)) {
            throw new Error(`Isolated locking does not support local dependency ${spec}. Use standalone remote dependency specifications.`);
        }
    }
}
const graph = integration ? projectTypeScriptWorkspace(root, { includeWeb: true, read: path => {
    const name = relative(root, path);
    if (!inputs.has(name)) inputs.set(name, readFileSync(path));
    return inputs.get(name).toString();
} }) : { manifest, projections: [], workspacePaths: [] };
const localNames = new Set(graph.projections.map(({ projected }) => projected.name));
for (const entry of [graph.manifest, ...graph.projections.map(({ projected }) => projected)]) {
    if (entry.patchedDependencies || (entry !== graph.manifest && entry.workspaces)) {
        throw new Error('Isolated locking does not support local patches or nested workspaces.');
    }
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'overrides', 'resolutions']) {
        checkSpecs(entry[field], localNames);
    }
}

const config = inputs.get('bunfig.toml');
if (config) {
    const install = Bun.TOML.parse(config.toString()).install;
    // Bun resolves file-based configuration relative to the staged project too.
    if (install?.cafile && !isAbsolute(install.cafile)) {
        throw new Error('Isolated locking requires an absolute install.cafile path.');
    }
}
const npmrc = inputs.get('.npmrc')?.toString() ?? '';
if (/^\s*(?:cafile|userconfig)\s*=\s*[^/\s]/m.test(npmrc)) {
    throw new Error('Isolated locking requires absolute .npmrc cafile/userconfig paths.');
}

// os.tmpdir() is configurable. Refuse a location where Bun could find another
// project above staging, even when TMPDIR points back inside this checkout.
const temporaryRoot = realpathSync(tmpdir());
for (let parent = temporaryRoot; ; parent = dirname(parent)) {
    if (existsSync(join(parent, 'package.json'))) {
        throw new Error(`Temporary directory is inside a package (${parent}). Set TMPDIR to an external directory.`);
    }
    if (dirname(parent) === parent) break;
}

const staging = mkdtempSync(join(temporaryRoot, 'speleodb-lock-'));
let publication;
try {
    const stagedManifests = new Map([
        ['package.json', integration ? Buffer.from(`${JSON.stringify(graph.manifest, null, 2)}\n`) : inputs.get('package.json')],
        ...graph.projections.map(({ relative: path, projected }) => [
            `${path}/package.json`, Buffer.from(`${JSON.stringify(projected, null, 2)}\n`),
        ]),
    ]);
    for (const [name, content] of inputs) {
        // A fresh solve unlocks transitives as well as direct dependencies while
        // keeping exact versions, ranges, overrides and Git SHAs authoritative.
        if (content !== null && !(upgrade && name === 'bun.lock')) {
            mkdirSync(dirname(join(staging, name)), { recursive: true });
            writeFileSync(join(staging, name), stagedManifests.get(name) ?? content, { mode: 0o600 });
        }
    }
    const result = spawnSync(process.execPath, [
        'install', '--lockfile-only', '--ignore-scripts', '--save-text-lockfile',
        ...(upgrade ? ['--no-cache'] : []),
    ], { cwd: staging, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) {
        process.exitCode = result.status ?? 1;
    } else {
        const lock = readFileSync(join(staging, 'bun.lock'));
        if (!lock.toString().trim()) throw new Error('Bun generated an empty lockfile.');
        const parsed = Bun.JSONC.parse(lock.toString());
        const expected = ['', ...graph.workspacePaths].sort();
        if (JSON.stringify(Object.keys(parsed.workspaces ?? {}).sort()) !== JSON.stringify(expected)) {
            throw new Error('Bun generated a lockfile for an unexpected workspace graph.');
        }
        for (const [name, content] of stagedManifests) {
            if (!readFileSync(join(staging, name)).equals(content)) {
                throw new Error('Bun changed a staged manifest; refusing to publish its lock.');
            }
        }
        if (integration && JSON.stringify(projectTypeScriptWorkspace(root, { includeWeb: true }).workspacePaths) !== JSON.stringify(graph.workspacePaths)) {
            throw new Error('Workspace membership changed during resolution; rerun bun run lock.');
        }
        // Do not overwrite edits made while the resolver was running.
        for (const [name, original] of inputs) {
            const current = existsSync(join(root, name)) ? readFileSync(join(root, name)) : null;
            if (original === null ? current !== null : current === null || !original.equals(current)) {
                throw new Error(`${name} changed during resolution; rerun bun run lock.`);
            }
        }
        if (!inputs.get('bun.lock')?.equals(lock)) {
            // Same-filesystem rename publishes the complete file atomically.
            publication = mkdtempSync(join(root, '.bun-lock-'));
            writeFileSync(join(publication, 'bun.lock'), lock);
            renameSync(join(publication, 'bun.lock'), resolve(root, 'bun.lock'));
        }
        console.log(`${upgrade ? 'Upgraded' : 'Resolved'} bun.lock for ${manifest.name ?? root}.`);
    }
} finally {
    if (publication) rmSync(publication, { recursive: true, force: true });
    rmSync(staging, { recursive: true, force: true });
}
