import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = 'src/lib/holonet/phoenix';
const FORBIDDEN_PATTERNS = [
  "from '@/lib/pi-orchestrator/client/PhoenixChannelClient'",
  "from '@/lib/pi-orchestrator/client/PhoenixChannelAuth'",
  "from '@/lib/pi-orchestrator/services/PhoenixEventDispatcher'",
  'pi-orchestrator/client/PhoenixChannel',
  'pi-orchestrator/services/PhoenixEventDispatcher',
];

const walk = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        return walk(fullPath);
      }
      if (!entry.isFile()) {
        return [];
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) {
        return [];
      }
      if (entry.name === 'NoLegacyPhoenixImports.test.ts') {
        return [];
      }
      return [fullPath];
    }),
  );

  return files.flat();
};

describe('holonet-phoenix hard-cut boundaries', () => {
  it('does not import legacy pi-orchestrator Phoenix client/auth/dispatcher paths', async () => {
    const files = await walk(ROOT);

    const violations: Array<{ file: string; pattern: string }> = [];

    for (const file of files) {
      const content = await readFile(file, 'utf8');
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (content.includes(pattern)) {
          violations.push({ file, pattern });
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
