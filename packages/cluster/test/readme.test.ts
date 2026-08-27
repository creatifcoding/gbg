import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const readme = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../README.md'),
  'utf8',
);

describe('cluster README Cosmo home', () => {
  test('places Cosmo/WunderGraph at @gbg/nexus, not tmnl', () => {
    expect(readme).toContain('@gbg/nexus');
    expect(readme).toContain('packages/nexus');
    expect(readme).toContain('k3d-tmnl` is the kube context name, not');
    expect(readme).toContain('@tmnl/msh');
    expect(readme).not.toContain(
      'CosmoRouter and CosmoSubgraph stay GraphQL specializations in `packages/tmnl`',
    );
    expect(readme).not.toContain('stay GraphQL specializations in `packages/tmnl`');
    expect(readme).not.toContain('packages/plexus');
    expect(readme).not.toContain('@gbg/plexus');
  });
});
