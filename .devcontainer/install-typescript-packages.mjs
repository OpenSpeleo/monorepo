import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Bun resolves Git protocols before overrides. Project local workspace metadata
// before invoking the installer so no shared Git dependency can be fetched.
const workspace = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
if (workspace === '/workspace' && existsSync('/.dockerenv')) {
    throw new Error('Run bun run install:local on the host. The web devcontainer bind-mounts host mobile/package node_modules; use an isolated container snapshot for verification and the web-specific installer for /app.');
}
const key = createHash('sha256').update(workspace).digest('hex').slice(0, 16);
const installation = process.env.SPELEODB_TYPESCRIPT_INSTALL_ROOT
    ?? join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'speleodb', `typescript-${process.platform}-${process.arch}-${key}`);
const refresh = process.argv.includes('--refresh-lock');
const ignoreScripts = process.argv.includes('--ignore-scripts');
const lockPath = join(workspace, 'bun.lock');
const installationLock = join(workspace, '.cache/typescript-install.lock');
mkdirSync(dirname(installationLock), { recursive: true });
if (!process.argv.includes('--install-locked')) {
    // Python's OS advisory lock is available on both supported developer hosts
    // (macOS/Linux) and is released even when an installer process fails.
    const locking = 'import fcntl, subprocess, sys\nwith open(sys.argv[1], "a") as lock:\n fcntl.flock(lock.fileno(), fcntl.LOCK_EX)\n sys.exit(subprocess.call(sys.argv[2:]))\n';
    const result = Bun.spawnSync(['python3', '-c', locking, installationLock,
        process.execPath, fileURLToPath(import.meta.url), ...process.argv.slice(2), '--install-locked'], {
        stdout: 'inherit', stderr: 'inherit',
    });
    process.exit(result.exitCode);
}

mkdirSync(installation, { recursive: true });

function writeChanged(path, content) {
    if (existsSync(path) && readFileSync(path, 'utf8') === content) return;
    const temporary = `${path}.${process.pid}.tmp`;
    writeFileSync(temporary, content);
    renameSync(temporary, path);
}

function link(path, target) {
    const previous = lstatSync(path, { throwIfNoEntry: false });
    if (previous?.isSymbolicLink() && readlinkSync(path) === target) return;
    if (previous && !previous.isSymbolicLink()) throw new Error(`Expected a symlink at ${path}; refusing to overwrite files.`);
    const temporary = `${path}.${process.pid}.tmp`;
    rmSync(temporary, { force: true });
    symlinkSync(target, temporary);
    renameSync(temporary, path);
}

const packageNames = ['map-core', 'map-viewer'];
const workspacePaths = ['apps/mobile', ...readdirSync(join(workspace, 'packages/typescript'), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && existsSync(join(workspace, 'packages/typescript', entry.name, 'package.json')))
    .map(entry => `packages/typescript/${entry.name}`)].sort();
for (const name of packageNames) {
    const source = join(workspace, 'packages/typescript', name);
    if (!existsSync(join(source, 'src/index.ts'))) {
        throw new Error(`Local ${name} source is missing: ${source}. No remote fallback is permitted.`);
    }
}
const canonical = JSON.parse(readFileSync(join(workspace, 'package.json'), 'utf8'));
const manifest = { ...canonical, workspaces: workspacePaths };
const projections = workspacePaths.map(relative => {
    const directory = join(workspace, relative);
    const original = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
    const projected = structuredClone(original);
    for (const group of ['dependencies', 'devDependencies', 'optionalDependencies']) {
        for (const name of packageNames) {
            if (projected[group]?.[`@speleodb/${name}`]) projected[group][`@speleodb/${name}`] = 'workspace:*';
        }
    }
    // Child overrides belong to standalone installs. Only the root overlay's
    // overrides apply to this graph, including viewer-to-core peer resolution.
    delete projected.overrides;
    projected.speleodbLocalSources = true;
    return { relative, directory, projected };
});
if (!refresh && (!existsSync(lockPath) || !readFileSync(lockPath, 'utf8').trim())) {
    throw new Error('The monorepo TypeScript lock is missing. Run bun run install:local --refresh-lock and review bun.lock.');
}
// Bun validates the projected dependency graph against the frozen lock below.
writeChanged(join(installation, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
writeChanged(join(installation, 'bunfig.toml'), readFileSync(join(workspace, 'bunfig.toml'), 'utf8'));
for (const projection of projections) {
    const target = join(installation, projection.relative);
    mkdirSync(target, { recursive: true });
    writeChanged(join(target, 'package.json'), `${JSON.stringify(projection.projected, null, 2)}\n`);
    for (const entry of readdirSync(projection.directory)) {
        if (['.git', 'node_modules', 'dist', 'package.json', 'bun.lock', '.speleodb-unreleased'].includes(entry)) continue;
        link(join(target, entry), join(projection.directory, entry));
    }
}
if (existsSync(lockPath)) writeChanged(join(installation, 'bun.lock'), readFileSync(lockPath, 'utf8'));
const install = (...args) => {
    const result = Bun.spawnSync([process.execPath, 'install', '--linker=isolated', ...args,
        ...(ignoreScripts ? ['--ignore-scripts'] : [])], { cwd: installation, stdout: 'inherit', stderr: 'inherit' });
    if (result.exitCode !== 0) process.exit(result.exitCode);
};
if (refresh) install('--lockfile-only', '--ignore-scripts');
install('--frozen-lockfile');
for (const relative of ['', ...workspacePaths]) {
    const target = join(installation, relative, 'node_modules');
    mkdirSync(target, { recursive: true });
    const destination = join(workspace, relative, 'node_modules');
    const previous = lstatSync(destination, { throwIfNoEntry: false });
    if (previous && !previous.isSymbolicLink()) {
        // Preserve an earlier native install on the same filesystem. A failed
        // rename leaves it intact; nothing in this installer deletes the backup.
        const backup = join(workspace, '.cache/speleodb-node-modules-backups', `${Date.now()}-${process.pid}`, relative || 'root');
        mkdirSync(dirname(backup), { recursive: true });
        renameSync(destination, backup);
        console.log(`Preserved previous dependency directory: ${backup}`);
    }
    link(destination, target);
}
if (refresh) {
    writeChanged(lockPath, readFileSync(join(installation, 'bun.lock'), 'utf8'));
}
console.log('SpeleoDB live local TypeScript workspace installed before shared Git resolution.');
