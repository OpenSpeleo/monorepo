import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectTypeScriptWorkspace } from './typescript-projection.mjs';

// This is a container lifecycle overlay, never a standalone app install path.
const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const app = process.env.SPELEODB_WEB_ROOT ?? '/app';
// Every service already mounts this persistent volume at the identical path.
const installation = process.env.SPELEODB_WEB_INSTALL_ROOT ?? '/monorepo-python-build-cache/web-packages';
if (process.argv.slice(2).some(arg => arg !== '--install-locked')) {
    throw new Error('This installer consumes root bun.lock. Update it with bun run lock on the host.');
}
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
        throw new Error(`Expected a symlink at ${path}; refusing to replace existing files.`);
    }
    const temporary = `${path}.${process.pid}.tmp`;
    rmSync(temporary, { force: true });
    symlinkSync(target, temporary, 'dir');
    renameSync(temporary, path);
}

// Use exactly the graph used to generate the root lock. Keep the old cache
// layout intact during migration; only this directory receives Linux installs.
const root = join(installation, 'workspace');
const { manifest, projections } = projectTypeScriptWorkspace(workspace);
for (const { relative, projected, directory } of [
    { relative: '', projected: manifest, directory: workspace }, ...projections,
]) {
    const destination = join(root, relative);
    mkdirSync(destination, { recursive: true });
    // This is a dependency installation, not an application checkout. In
    // particular, do not run root lock generation or mobile native patches.
    const { scripts: _scripts, ...dependencies } = projected;
    writeChanged(join(destination, 'package.json'), `${JSON.stringify(dependencies, null, 2)}\n`);
    if (relative.startsWith('packages/typescript/')) {
        for (const entry of ['src', 'assets', 'openapi-source.json']) {
            if (existsSync(join(directory, entry))) {
                linkDirectory(join(destination, entry), join(directory, entry));
            }
        }
    }
}
writeChanged(join(root, 'bunfig.toml'), readFileSync(join(workspace, 'bunfig.toml'), 'utf8'));
writeChanged(join(root, 'bun.lock'), readFileSync(join(workspace, 'bun.lock'), 'utf8'));
const result = Bun.spawnSync([process.execPath, 'install', '--frozen-lockfile'], {
    cwd: root, stdout: 'inherit', stderr: 'inherit',
});
if (result.exitCode !== 0) process.exit(result.exitCode);

// Publish web's isolated dependency links through its existing volume. Absolute
// targets work at both /app and /workspace/apps/web, regardless of mount depth.
// Preserve directories from the previous hoisted installation as local backups.
const modules = join(app, 'node_modules');
function publish(source, destination) {
    const previous = lstatSync(destination, { throwIfNoEntry: false });
    if (previous && !previous.isSymbolicLink()) {
        renameSync(destination, `${destination}.before-workspace-${Date.now()}`);
    }
    linkDirectory(destination, realpathSync(source));
}
const webModules = join(root, 'apps/web/node_modules');
for (const entry of readdirSync(webModules)) {
    if (entry.startsWith('@')) {
        mkdirSync(join(modules, entry), { recursive: true });
        for (const name of readdirSync(join(webModules, entry))) {
            publish(join(webModules, entry, name), join(modules, entry, name));
        }
    } else {
        publish(join(webModules, entry), join(modules, entry));
    }
}
for (const name of ['api', 'map-core', 'map-viewer']) {
    const installed = realpathSync(join(modules, '@speleodb', name, 'src'));
    const expected = realpathSync(join(workspace, 'packages/typescript', name, 'src'));
    if (installed !== expected) throw new Error(`Local ${name} must resolve to live source: ${installed} != ${expected}`);
}
const web = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'));
if (web.scripts?.postinstall) {
    const lifecycle = Bun.spawnSync([process.execPath, 'run', 'postinstall'], {
        cwd: app, stdout: 'inherit', stderr: 'inherit',
    });
    if (lifecycle.exitCode !== 0) process.exit(lifecycle.exitCode);
}
console.log('SpeleoDB Linux workspace dependencies: OK (root bun.lock, live local TypeScript sources)');
