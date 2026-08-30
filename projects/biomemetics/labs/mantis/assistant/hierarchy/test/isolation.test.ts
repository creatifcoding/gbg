import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, '../src');
const ROOT = path.resolve(here, '..');

const SKIP_DIRS = new Set(['node_modules']);

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
      continue;
    }
    yield full;
  }
}

test('hierarchy source stays off sibling write-sets and live model calls', () => {
  const patterns: ReadonlyArray<{ readonly name: string; readonly re: RegExp }> = [
    { name: 'mantis-assistant-pkg', re: /@tmnl\/mantis-assistant['"]/ },
    { name: 'mastra', re: /from ['"]@mastra\// },
    { name: 'copilotkit', re: /from ['"]@copilotkit\// },
    { name: 'ag-ui', re: /from ['"]@ag-ui\// },
    { name: 'specimendb-pkg', re: /@tmnl\/specimendb/ },
    { name: 'pglite', re: /pglite/i },
    { name: 'runtimeUrl-bind', re: /runtimeUrl/ },
    { name: 'agent-generate', re: /agent\.generate/ },
    { name: 'OPENROUTER', re: /OPENROUTER_API_KEY/ },
  ];
  const hits: string[] = [];
  for (const file of walk(SRC)) {
    const text = readFileSync(file, 'utf8');
    for (const pattern of patterns) {
      if (pattern.re.test(text)) {
        hits.push(`${pattern.name}: ${path.relative(ROOT, file)}`);
      }
    }
  }
  assert.deepEqual(hits, []);
});
