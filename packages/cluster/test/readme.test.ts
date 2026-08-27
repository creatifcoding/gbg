import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const readme = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../README.md'),
  'utf8',
);

describe('cluster README identity', () => {
  test('is the gbg / lab cluster, not TMNL as a product', () => {
    expect(readme).toContain('gbg / lab cluster');
    expect(readme).toContain('k3d is the local kube runtime');
    expect(readme).toContain('k3d-tmnl');
    expect(readme).toContain('tmnl.gbg.dev');
    expect(readme).not.toContain('existing TMNL k3d default');
    expect(readme).not.toContain('TMNL k3d');
    expect(readme).not.toContain('the TMNL cluster');
  });

  test('places Cosmo/WunderGraph at @gbg/nexus, not tmnl', () => {
    expect(readme).toContain('@gbg/nexus');
    expect(readme).toContain('packages/nexus');
    expect(readme).toContain('tmnl consumes nexus');
    expect(readme).toContain('packages/tmnl/nix/modules/nats/values.yaml');
    expect(readme).toContain('@tmnl/msh');
    expect(readme).not.toContain(
      'CosmoRouter and CosmoSubgraph stay GraphQL specializations in `packages/tmnl`',
    );
    expect(readme).not.toContain('stay GraphQL specializations in `packages/tmnl`');
    expect(readme).not.toContain('packages/plexus');
    expect(readme).not.toContain('@gbg/plexus');
  });
});
