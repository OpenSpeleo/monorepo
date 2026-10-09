import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Share local dependency rewriting between lock resolution and installation.
// The root lock includes web; the host installer leaves web installation separate.
export function projectTypeScriptWorkspace(workspace, {
    includeWeb = false,
    read = path => readFileSync(path, 'utf8'),
} = {}) {
    const packageNames = ['map-core', 'map-viewer'];
    const workspacePaths = ['apps/mobile', ...(includeWeb ? ['apps/web'] : []), ...readdirSync(join(workspace, 'packages/typescript'), { withFileTypes: true })
        .filter(entry => entry.isDirectory() && existsSync(join(workspace, 'packages/typescript', entry.name, 'package.json')))
        .map(entry => `packages/typescript/${entry.name}`)].sort();
    for (const name of packageNames) {
        const source = join(workspace, 'packages/typescript', name);
        if (!existsSync(join(source, 'src/index.ts'))) {
            throw new Error(`Local ${name} source is missing: ${source}. No remote fallback is permitted.`);
        }
    }
    const canonical = JSON.parse(read(join(workspace, 'package.json')));
    const manifest = { ...canonical, workspaces: workspacePaths };
    const projections = workspacePaths.map(relative => {
        const directory = join(workspace, relative);
        const original = JSON.parse(read(join(directory, 'package.json')));
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
    return { manifest, projections, workspacePaths };
}
