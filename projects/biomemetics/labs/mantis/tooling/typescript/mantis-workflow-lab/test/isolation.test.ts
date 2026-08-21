import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

test('this package does not depend on A0 harness or Mastra', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  const deps = pkg.dependencies ?? {};
  assert.equal('@mastra/core' in deps, false);
  assert.equal('@tmnl/mantis-assistant' in deps, false);
});

test('A0 research-summary.v1 is not owned on this branch', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const definitions = path.resolve(
    here,
    '../../../../assistant/workflows/definitions/research-summary.v1.json',
  );
  const admissions = path.resolve(
    here,
    '../../../../assistant/workflows/admissions/research-summary.v1.json',
  );
  assert.equal(existsSync(definitions), false);
  assert.equal(existsSync(admissions), false);
});

test('source does not import mantis-assistant or mastra', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const src = path.resolve(here, '../src/index.ts');
  const text = readFileSync(src, 'utf8');
  assert.equal(text.includes('@tmnl/mantis-assistant'), false);
  assert.equal(text.includes('@mastra/core'), false);
});
