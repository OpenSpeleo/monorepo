import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Resolve root locks with explicit local references in temporary manifests.
// Native installs still use the canonical manifests and their standalone pins.
export function projectTypeScriptWorkspace(workspace, {
    read = path => readFileSync(path, 'utf8'),
} = {}) {
    const manifest = JSON.parse(read(join(workspace, 'package.json')));
    const packageNames = ['api', 'map-core', 'map-viewer'];
    const workspacePaths = [...new Set(manifest.workspaces.flatMap(pattern =>
        [...new Bun.Glob(pattern).scanSync({ cwd: workspace, onlyFiles: false })]
            .filter(relative => existsSync(join(workspace, relative, 'package.json'))),
    ))].sort();
    for (const name of packageNames) {
        if (manifest.overrides?.[`@speleodb/${name}`] !== 'workspace:*') {
            throw new Error(`The root override for @speleodb/${name} must be workspace:*.`);
        }
        const source = join(workspace, 'packages/typescript', name);
        if (!existsSync(join(source, 'src/index.ts'))) {
            throw new Error(`Local ${name} source is missing: ${source}. No remote fallback is permitted.`);
        }
    }
    const projections = workspacePaths.map(relative => {
        const directory = join(workspace, relative);
        const projected = JSON.parse(read(join(directory, 'package.json')));
        for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
            for (const name of packageNames) {
                const dependency = `@speleodb/${name}`;
                if (projected[field]?.[dependency]) projected[field][dependency] = 'workspace:*';
            }
        }
        // Standalone overrides must not reintroduce registry pins into this
        // temporary graph; the monorepo's root overrides are authoritative.
        delete projected.overrides;
        return { relative, directory, projected };
    });
    return { manifest, projections, workspacePaths };
}
