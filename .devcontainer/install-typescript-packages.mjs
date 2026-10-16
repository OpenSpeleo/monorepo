import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectTypeScriptWorkspace } from './typescript-projection.mjs';

// Keep the compatibility entrypoint, but install the full native Bun workspace.
// A second dependency tree outside the checkout breaks relative package links
// when developers subsequently run `bun ci` at the root.
const workspace = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
if (workspace === '/workspace' && existsSync('/.dockerenv')) {
    throw new Error('Run bun ci on the host. The web devcontainer bind-mounts host mobile/package node_modules; use an isolated container snapshot for verification and the web-specific installer for /app.');
}
const args = process.argv.slice(2);
if (args.some(arg => !['--refresh-lock', '--ignore-scripts', '--install-locked'].includes(arg))) {
    throw new Error('Usage: bun run install:local [--refresh-lock] [--ignore-scripts]');
}
const refresh = args.includes('--refresh-lock');
const ignoreScripts = args.includes('--ignore-scripts');
const lockPath = join(workspace, 'bun.lock');
const installationLock = join(workspace, '.cache/typescript-install.lock');
mkdirSync(dirname(installationLock), { recursive: true });
if (!args.includes('--install-locked')) {
    const locking = 'import fcntl, subprocess, sys\nwith open(sys.argv[1], "a") as lock:\n fcntl.flock(lock.fileno(), fcntl.LOCK_EX)\n sys.exit(subprocess.call(sys.argv[2:]))\n';
    const result = Bun.spawnSync(['python3', '-c', locking, installationLock,
        process.execPath, fileURLToPath(import.meta.url), ...args, '--install-locked'], {
        stdout: 'inherit', stderr: 'inherit',
    });
    process.exit(result.exitCode);
}

if (!refresh && (!existsSync(lockPath) || !readFileSync(lockPath, 'utf8').trim())) {
    throw new Error('The monorepo Bun lock is missing. Run bun run lock and review bun.lock.');
}
const { manifest, projections } = projectTypeScriptWorkspace(workspace);
const localPackages = new Map(projections.map(({ directory, projected }) => [projected.name, directory]));
const backupRoot = join(workspace, '.cache/speleodb-node-modules-backups', `${Date.now()}-${process.pid}`);
function preserve(destination, relative) {
    const backup = join(backupRoot, relative);
    mkdirSync(dirname(backup), { recursive: true });
    renameSync(destination, backup);
    console.log(`Preserved previous dependency installation: ${backup}`);
}
for (const { relative, projected } of [{ relative: '', projected: manifest }, ...projections]) {
    const destination = join(workspace, relative, 'node_modules');
    const previous = lstatSync(destination, { throwIfNoEntry: false });
    if (!previous) continue;
    if (previous.isSymbolicLink()) {
        preserve(destination, relative || 'root');
        continue;
    }
    const dependencies = { ...projected.dependencies, ...projected.devDependencies, ...projected.optionalDependencies };
    for (const name of Object.keys(dependencies)) {
        if (!localPackages.has(name)) continue;
        const installed = join(destination, name);
        if (!lstatSync(installed, { throwIfNoEntry: false })) continue;
        if (existsSync(installed) && realpathSync(installed) === realpathSync(localPackages.get(name))) continue;
        // Bun can retain a registry copy when its version already matches.
        // Preserve only that package, leaving the dependency directory intact.
        preserve(installed, join(relative || 'root', name));
    }
}
const install = (...installArgs) => {
    const result = Bun.spawnSync([process.execPath, ...installArgs], {
        cwd: workspace, stdout: 'inherit', stderr: 'inherit',
    });
    if (result.exitCode !== 0) process.exit(result.exitCode);
};
// Native lockfile-only installs serialize the standalone version declarations.
// Use the same root lock writer as postinstall, even when scripts are disabled.
if (refresh) install('run', 'lock');
install('ci', ...(ignoreScripts ? ['--ignore-scripts'] : []));
console.log('Installed all Bun workspaces: web, mobile, and TypeScript packages. Future installs can use bun ci.');
