import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { usedBetaImportPaths } from '../src/mastra-adapter.ts';

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });

test('beta Mastra/AG-UI/CopilotKit imports stay in mastra-adapter.ts', () => {
  const banned = [/@mastra\//, /@ag-ui\//, /@copilotkit\//];
  for (const file of walk(srcRoot)) {
    if (file.endsWith('mastra-adapter.ts')) continue;
    const source = readFileSync(file, 'utf8');
    for (const pattern of banned) {
      assert.equal(
        pattern.test(source),
        false,
        `${path.relative(srcRoot, file)} imports ${pattern}`,
      );
    }
  }
  assert.ok(usedBetaImportPaths.includes('@mastra/core/agent-controller'));
  assert.ok(usedBetaImportPaths.includes('@mastra/observability'));
  assert.ok(usedBetaImportPaths.includes('@ag-ui/mastra/copilotkit'));
});
