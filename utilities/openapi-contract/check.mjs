import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const defaults = [
  new URL('../../apps/web/OpenAPI.yaml', import.meta.url),
  new URL('../../packages/typescript/api/openapi-source.json', import.meta.url),
].map((url) => fileURLToPath(url));
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Usage: bun utilities/openapi-contract/check.mjs [WEB_SCHEMA SDK_SOURCE]');
  process.exit(0);
}
if (args.length !== 0 && args.length !== 2) {
  throw new Error('Provide both paths, or neither to check the monorepo contract.');
}

try {
  const [schemaPath, sourcePath] = args.length ? args : defaults;
  const bytes = readFileSync(schemaPath);
  if (!bytes.length) throw new Error(`OpenAPI contract is empty: ${schemaPath}`);
  const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
  if (
    !source || typeof source !== 'object' || Array.isArray(source)
    || typeof source.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(source.sha256)
    || (source.revision !== null && (
      typeof source.revision !== 'string' || !/^[a-f0-9]{40}$/.test(source.revision)
    ))
  ) {
    throw new Error(`Invalid SDK OpenAPI source record: ${sourcePath}`);
  }
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== source.sha256) {
    throw new Error([
      'The web OpenAPI contract differs from the input recorded by @speleodb/api.',
      `${hash}  ${schemaPath}`,
      `${source.sha256}  ${sourcePath}`,
      'Review the backend export, update the SDK source pin, and regenerate the SDK.',
      'See packages/typescript/api/docs/maintenance.md.',
    ].join('\n'));
  }
  console.log(`OpenAPI.yaml SHA-256 matches the SDK source record: ${hash}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
