/**
 * Strict runtime-boundary guardrails for @tmnl/specimendb.
 */

import { describe, expect, it } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(testDir, '..');

const sourceExtensions = new Set(['.ts', '.tsx', '.mts', '.cts']);
const ignoredSegments = new Set(['dist', 'node_modules', '.git']);

const walk = async (root: string): Promise<string[]> => {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (ignoredSegments.has(entry.name)) continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(path)));
    } else if (sourceExtensions.has(path.slice(path.lastIndexOf('.')))) {
      files.push(path);
    }
  }
  return files;
};

const bannedImport =
  /^\s*(?:import(?:\s+type)?\s+.*\s+from\s+['"](?:effect-v[34]|@gbg\/tmnl|@tmnl\/tmnl)(?:\/|['"])|import\s*\(\s*['"](?:effect-v[34]|@gbg\/tmnl)(?:\/|['"]))/;

describe('strict Effect v4 package guardrails', () => {
  it('does not import tmnl, effect-v3, or the retired effect-v4 alias', async () => {
    const files = await walk(packageRoot);
    const violations: string[] = [];
    for (const file of files) {
      const lines = (await readFile(file, 'utf8')).split('\n');
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index]!;
        if (bannedImport.test(line)) {
          violations.push(`${relative(packageRoot, file)}:${index + 1}: ${line.trim()}`);
        }
        if (line.includes("from '" + "@gbg/tmnl") || line.includes('from "' + "@gbg/tmnl")) {
          violations.push(`${relative(packageRoot, file)}:${index + 1}: ${line.trim()}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('pins Effect to the msh / effect-smol v4 beta', async () => {
    const pkg = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(pkg.dependencies.effect).toBe('4.0.0-beta.93');
    expect(pkg.devDependencies['@effect/vitest']).toBe('4.0.0-beta.93');
    expect(pkg.dependencies.effect?.startsWith('3.')).toBe(false);
  });
});
