import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// This is a container lifecycle overlay, never a standalone app install path.
const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = process.env.SPELEODB_WEB_ROOT ?? '/app';
// Every service already mounts this persistent volume at the identical path.
const installation = process.env.SPELEODB_WEB_INSTALL_ROOT ?? '/monorepo-python-build-cache/web-packages';
const lockPath = join(workspace, '.devcontainer/web-packages.lock');
const refresh = process.argv.includes('--refresh-lock');
mkdirSync(installation, { recursive: true });
if (!process.argv.includes('--install-locked')) {
    // Linux flock serializes metadata, install and publication across containers.
    // The descriptor lives in the parent process until the complete child exits.
    const result = Bun.spawnSync(['flock', '--exclusive', join(installation, '.install.lock'),
        process.execPath, fileURLToPath(import.meta.url), ...process.argv.slice(2), '--install-locked'], {
        stdout: 'inherit', stderr: 'inherit',
    });
    process.exit(result.exitCode);
}

function writeChanged(path, content) {
    if (existsSync(path) && readFileSync(path, 'utf8') === content) return;
    const temporary = `${path}.${process.pid}.tmp`;
    writeFileSync(temporary, content);
    renameSync(temporary, path);
}

function linkDirectory(path, target) {
    const previous = lstatSync(path, { throwIfNoEntry: false });
    if (previous?.isSymbolicLink() && readlinkSync(path) === target) return;
    if (previous && !previous.isSymbolicLink()) {
        throw new Error(`Expected a directory symlink at ${path}; refusing to replace existing files.`);
    }
    const temporary = `${path}.${process.pid}.tmp`;
    rmSync(temporary, { force: true });
    symlinkSync(target, temporary, 'dir');
    renameSync(temporary, path);
}

const manifest = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'));
const packageNames = ['map-core', 'map-viewer'];
const projections = [];
manifest.overrides = { ...manifest.overrides };
manifest.workspaces = packageNames.map(name => `packages/${name}`);
for (const name of packageNames) {
    const directory = join(workspace, 'packages/typescript', name);
    if (!existsSync(join(directory, 'package.json')) || !existsSync(join(directory, 'src/index.ts'))) {
        throw new Error(`Local ${name} source is missing: ${directory}. No remote fallback is permitted.`);
    }
    const packageManifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
    if (packageManifest.name !== `@speleodb/${name}` || !existsSync(join(directory, 'src'))) {
        throw new Error(`Local ${name} source is missing or invalid: ${directory}. No remote fallback is permitted.`);
    }
    const { devDependencies: _developmentOnly, ...runtimeManifest } = packageManifest;
    for (const group of ['dependencies', 'optionalDependencies']) {
        if (!runtimeManifest[group]) continue;
        for (const sibling of packageNames) {
            if (runtimeManifest[group][`@speleodb/${sibling}`]) {
                runtimeManifest[group][`@speleodb/${sibling}`] = 'workspace:*';
            }
        }
    }
    projections.push({ name, directory, manifest: { ...runtimeManifest, speleodbLocalSources: true } });
    manifest.dependencies[packageManifest.name] = 'workspace:*';
    delete manifest.overrides[packageManifest.name];
}
// Bun validates the projected dependency graph against the frozen lock below.
for (const projection of projections) {
    const projected = join(installation, 'packages', projection.name);
    mkdirSync(projected, { recursive: true });
    writeChanged(join(projected, 'package.json'), `${JSON.stringify(projection.manifest, null, 2)}\n`);
    for (const entry of ['src', 'assets']) {
        linkDirectory(join(projected, entry), join(projection.directory, entry));
    }
}
writeChanged(join(installation, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const modules = join(installation, 'node_modules');
linkDirectory(modules, join(app, 'node_modules'));
if (realpathSync(modules) !== realpathSync(join(app, 'node_modules'))) {
    throw new Error('The local install must use the existing application dependency volume.');
}
if (refresh) {
    // Start with the canonical standalone graph, retaining existing third-party pins.
    writeChanged(join(installation, 'bun.lock'), readFileSync(join(app, 'bun.lock'), 'utf8'));
} else writeChanged(join(installation, 'bun.lock'), readFileSync(lockPath, 'utf8'));
const command = [process.execPath, 'install', '--linker=hoisted', ...(refresh ? ['--lockfile-only'] : ['--frozen-lockfile'])];
let result = Bun.spawnSync(command, { cwd: installation, stdout: 'inherit', stderr: 'inherit' });
if (result.exitCode !== 0) process.exit(result.exitCode);
if (refresh) {
    result = Bun.spawnSync([process.execPath, 'install', '--linker=hoisted', '--frozen-lockfile'], {
        cwd: installation, stdout: 'inherit', stderr: 'inherit',
    });
    if (result.exitCode !== 0) process.exit(result.exitCode);
}
if (realpathSync(modules) !== realpathSync(join(app, 'node_modules'))) {
    throw new Error('Bun replaced the dependency volume link; the application installation was not published.');
}
for (const name of packageNames) {
    // The same volume is mounted at /app and /workspace/apps/web. Bun's
    // relative workspace links depend on mount depth; absolute links work at
    // both aliases and retain live source without copying package code.
    const packageLink = join(app, 'node_modules/@speleodb', name);
    const projected = join(installation, 'packages', name);
    if (!lstatSync(packageLink).isSymbolicLink()) {
        throw new Error(`Bun did not install the local ${name} workspace.`);
    }
    linkDirectory(packageLink, projected);
    const installed = realpathSync(join(packageLink, 'src'));
    const expected = realpathSync(join(workspace, 'packages/typescript', name, 'src'));
    if (installed !== expected) throw new Error(`Local ${name} must resolve to live source: ${installed} != ${expected}`);
}
if (refresh) {
    writeChanged(lockPath, readFileSync(join(installation, 'bun.lock'), 'utf8'));
}
console.log('SpeleoDB live local TypeScript packages: OK (no shared Git dependency fetched)');
