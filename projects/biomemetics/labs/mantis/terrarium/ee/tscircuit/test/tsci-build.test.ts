import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const circuitJsonPath = join(packageRoot, 'dist/index/circuit.json');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

test('tsci build writes Circuit JSON without a selected MPN', { timeout: 60_000 }, () => {
  const result = spawnSync('npx', ['tsci', 'build'], {
    cwd: packageRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${process.env.HOME ?? ''}/.bun/bin:${process.env.PATH ?? ''}`,
    },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.ok(existsSync(circuitJsonPath), circuitJsonPath);
  const parsed: unknown = JSON.parse(readFileSync(circuitJsonPath, 'utf8'));
  assert.ok(Array.isArray(parsed));
  assert.ok(parsed.length > 0);
  assert.ok(
    parsed.some((element) => isRecord(element) && String(element.type).includes('board')),
    'circuit JSON must contain a board',
  );
  const text = JSON.stringify(parsed);
  assert.equal(text.includes('C492423'), false);
  for (const element of parsed) {
    if (!isRecord(element)) {
      continue;
    }
    if (typeof element.manufacturer_part_number === 'string') {
      assert.equal(element.manufacturer_part_number, '');
    }
  }
});
