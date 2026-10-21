import { afterEach, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { checkOpenApiSnapshots, defaultPaths } from './check.mjs';

const temporaryDirectories = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function fixturePaths() {
  const directory = mkdtempSync(join(tmpdir(), 'speleodb-openapi-contract-'));
  temporaryDirectories.push(directory);
  const bytes = 'openapi: 3.0.3\n';
  const digest = createHash('sha256').update(bytes).digest('hex');
  const paths = ['web.yaml', 'sdk.yaml', 'source.json'].map((name) => join(directory, name));
  writeFileSync(paths[0], bytes);
  writeFileSync(paths[1], bytes);
  writeFileSync(paths[2], JSON.stringify({ sha256: digest }));
  return { paths, digest };
}

test('the checked-out backend and SDK schemas are byte-identical and match the SDK digest', () => {
  const [webPath, sdkPath, sourcePath] = defaultPaths;
  const webBytes = readFileSync(webPath);
  const sdkBytes = readFileSync(sdkPath);
  const source = JSON.parse(readFileSync(sourcePath, 'utf8'));

  expect(webBytes.length).toBeGreaterThan(0);
  expect(sdkBytes.equals(webBytes)).toBe(true);
  expect(createHash('sha256').update(webBytes).digest('hex')).toBe(source.sha256);
  expect(createHash('sha256').update(sdkBytes).digest('hex')).toBe(source.sha256);
  expect(checkOpenApiSnapshots()).toBe(source.sha256);
});

test('matching snapshots need only a digest, without an upstream revision', () => {
  const { paths, digest } = fixturePaths();
  expect(checkOpenApiSnapshots(paths)).toBe(digest);
});

test.each([0, 1])('rejects different bytes in schema %s, including whitespace', (index) => {
  const { paths } = fixturePaths();
  writeFileSync(paths[index], 'openapi: 3.0.3\n\n');
  expect(() => checkOpenApiSnapshots(paths)).toThrow('must match');
});

test('rejects a stale recorded digest even when both schemas match', () => {
  const { paths } = fixturePaths();
  writeFileSync(paths[2], JSON.stringify({ sha256: '0'.repeat(64) }));
  expect(() => checkOpenApiSnapshots(paths)).toThrow('must match');
});

test.each([0, 1])('rejects empty schema %s', (index) => {
  const { paths } = fixturePaths();
  writeFileSync(paths[index], '');
  expect(() => checkOpenApiSnapshots(paths)).toThrow('OpenAPI contract is empty');
});

test('rejects missing schema files', () => {
  const { paths } = fixturePaths();
  rmSync(paths[1]);
  expect(() => checkOpenApiSnapshots(paths)).toThrow();
});

test.each([null, [], {}, { sha256: 'invalid' }].map((source) => [source]))('rejects invalid SDK digest metadata %j', (source) => {
  const { paths } = fixturePaths();
  writeFileSync(paths[2], JSON.stringify(source));
  expect(() => checkOpenApiSnapshots(paths)).toThrow('Invalid SDK OpenAPI source record');
});
