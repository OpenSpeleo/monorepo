import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const defaultPaths = [
  new URL('../../apps/web/OpenAPI.yaml', import.meta.url),
  new URL('../../packages/typescript/api/OpenAPI.yaml', import.meta.url),
  new URL('../../packages/typescript/api/openapi-source.json', import.meta.url),
].map((url) => fileURLToPath(url));

// Integration equality is local to this checkout; standalone SDK generation
// and release use only the SDK-owned snapshot and digest.
export function checkOpenApiSnapshots(paths = defaultPaths) {
  const [webPath, sdkPath, sourcePath] = paths;
  const webBytes = readFileSync(webPath);
  const sdkBytes = readFileSync(sdkPath);
  for (const [path, bytes] of [[webPath, webBytes], [sdkPath, sdkBytes]]) {
    if (!bytes.length) throw new Error(`OpenAPI contract is empty: ${path}`);
  }
  const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
  if (
    !source || typeof source !== 'object' || Array.isArray(source)
    || typeof source.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(source.sha256)
  ) {
    throw new Error(`Invalid SDK OpenAPI source record: ${sourcePath}`);
  }
  const webHash = createHash('sha256').update(webBytes).digest('hex');
  const sdkHash = createHash('sha256').update(sdkBytes).digest('hex');
  if (!webBytes.equals(sdkBytes) || webHash !== source.sha256 || sdkHash !== source.sha256) {
    throw new Error([
      'The monorepo web schema, SDK snapshot, and SDK digest must match.',
      `${webHash}  ${webPath}`,
      `${sdkHash}  ${sdkPath}`,
      `${source.sha256}  ${sourcePath}`,
      'Review and update the local SDK snapshot and digest, then regenerate the SDK.',
      'See packages/typescript/api/docs/maintenance.md.',
    ].join('\n'));
  }
  return webHash;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Usage: bun utilities/openapi-contract/check.mjs [WEB_SCHEMA SDK_SCHEMA SDK_SOURCE]');
  } else {
    try {
      if (args.length !== 0 && args.length !== 3) {
        throw new Error('Provide all three paths, or none to check the monorepo snapshots.');
      }
      const hash = checkOpenApiSnapshots(args.length ? args : defaultPaths);
      console.log(`Local OpenAPI snapshots and SDK digest match: ${hash}`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
