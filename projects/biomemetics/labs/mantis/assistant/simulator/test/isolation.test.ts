import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });

test('Mastra CopilotKit imports stay in copilot/bind.ts', () => {
  const banned = [/@mastra\//, /@ag-ui\//, /@copilotkit\//];
  for (const file of walk(srcRoot)) {
    if (file.endsWith(`${path.sep}copilot${path.sep}bind.ts`)) continue;
    const source = readFileSync(file, 'utf8');
    for (const pattern of banned) {
      assert.equal(pattern.test(source), false, `${path.relative(srcRoot, file)} imports ${pattern}`);
    }
  }
});

test('no actuator endpoint string in domain source', () => {
  for (const file of walk(srcRoot)) {
    if (file.endsWith(`${path.sep}copilot${path.sep}bind.ts`)) continue;
    if (file.endsWith(`${path.sep}refuse-write.ts`)) continue;
    const source = readFileSync(file, 'utf8');
    assert.equal(/device-command|ActuationCommand/.test(source), false, file);
  }
});
