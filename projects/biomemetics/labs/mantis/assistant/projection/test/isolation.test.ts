import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const here = path.dirname(fileURLToPath(import.meta.url));

const SRC_ROOTS = [
  path.resolve(here, '../../evidence/src'),
  path.resolve(here, '../src'),
];

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

test('write-set source has no store driver, leftover specimens table, or attach invocation', () => {
  const patterns: ReadonlyArray<{ readonly name: string; readonly re: RegExp }> =
    [
      { name: 'pglite', re: /pglite/i },
      {
        name: 'postgres-driver',
        re: /from ['"]postgres['"]|require\(['"]postgres['"]\)/,
      },
      { name: 'sql-pglite', re: /sql-pglite/i },
      { name: 'specimens-table', re: /create\s+table\s+specimens\b/i },
      { name: 'specimendb-repos', re: /@tmnl\/specimendb\/repos/ },
      { name: 'specimendb-pkg', re: /@tmnl\/specimendb['"]/ },
      { name: 'mantis-lab-pkg', re: /@tmnl\/mantis-lab|mantis-lab\/src/ },
      { name: 'specimendb-path', re: /packages\/specimendb/ },
      {
        name: 'attach-call',
        re: /\b(?:attach|Attach|Intake|List|Promote|Get)\s*\(/,
      },
    ];
  const hits: string[] = [];
  for (const root of SRC_ROOTS) {
    for (const file of walk(root)) {
      const text = readFileSync(file, 'utf8');
      for (const pattern of patterns) {
        if (pattern.re.test(text)) {
          hits.push(
            `${pattern.name}: ${path.relative(path.resolve(here, '../..'), file)}`,
          );
        }
      }
    }
  }
  assert.deepEqual(hits, []);
});
