/**
 * Strict runtime-boundary guardrails.
 *
 * These tests prevent the two failures that are easiest to reintroduce during
 * migration pressure: importing Effect v3 inside MSH, and bridging v3 TMNL
 * consumers directly into @tmnl/msh.
 */

import { describe, expect, it } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const testDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(testDir, '..');
const repoRoot = resolve(packageRoot, '../..');

const sourceExtensions = new Set(['.ts', '.tsx', '.mts', '.cts']);
const ignoredSegments = new Set(['dist', 'node_modules', '.git']);

const walk = async (root: string): Promise<string[]> => {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (ignoredSegments.has(entry.name)) continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(path));
    } else if (sourceExtensions.has(path.slice(path.lastIndexOf('.')))) {
      files.push(path);
    }
  }

  return files;
};

const actualEffectV3Import = /^\s*(?:import(?:\s+type)?\s+.*\s+from\s+['"]effect(?:\/|['"])|import\s*\(\s*['"]effect(?:\/|['"])|(?:const|let|var)\s+.*=\s*require\(\s*['"]effect(?:\/|['"]))/;
const effectServiceUsage = /\bEffect\.Service\b/;
const directMshImport = /^\s*import(?:\s+type)?\s+.*\s+from\s+['"]@tmnl\/msh(?:\/|['"])/;

describe('strict Effect v4 package guardrails', () => {
  it('does not import Effect v3 from MSH source or tests', async () => {
    const files = await walk(packageRoot);
    const violations: string[] = [];

    for (const file of files) {
      const lines = (await readFile(file, 'utf8')).split('\n');
      for (let index = 0; index < lines.length; index += 1) {
        if (actualEffectV3Import.test(lines[index])) {
          violations.push(`${relative(packageRoot, file)}:${index + 1}: ${lines[index].trim()}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('uses Context.Service rather than Effect.Service in MSH source', async () => {
    const files = await walk(join(packageRoot, 'src'));
    const violations: string[] = [];

    for (const file of files) {
      const lines = (await readFile(file, 'utf8')).split('\n');
      for (let index = 0; index < lines.length; index += 1) {
        if (effectServiceUsage.test(lines[index])) {
          violations.push(`${relative(packageRoot, file)}:${index + 1}: ${lines[index].trim()}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('does not bridge legacy NEX v3 services directly to @tmnl/msh', async () => {
    const nexRoot = join(repoRoot, 'packages/tmnl/src/lib/nex');
    const files = await walk(nexRoot);
    const violations: string[] = [];

    for (const file of files) {
      const lines = (await readFile(file, 'utf8')).split('\n');
      for (let index = 0; index < lines.length; index += 1) {
        if (directMshImport.test(lines[index])) {
          violations.push(`${relative(repoRoot, file)}:${index + 1}: ${lines[index].trim()}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
