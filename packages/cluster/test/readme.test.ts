import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const readme = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../README.md'),
  'utf8',
);

describe('cluster README identity', () => {
  test('treats k3d-tmnl as a name; k3d hosts applets', () => {
    expect(readme).toContain('k3d hosts applets');
    expect(readme).toContain('k3d-tmnl');
    expect(readme).toContain('tmnl.gbg.dev');
    expect(readme).toContain('Those strings are names, not a claim that TMNL is');
    expect(readme).not.toContain('existing TMNL k3d default');
    expect(readme).not.toContain('TMNL k3d');
    expect(readme).not.toContain('the TMNL cluster');
    expect(readme).not.toContain('the one stack');
  });

  test('places Cosmo/WunderGraph at @gbg/nexus, not tmnl or plexus', () => {
    expect(readme).toContain('@gbg/nexus');
    expect(readme).toContain('packages/nexus');
    expect(readme).toContain('Not tmnl. Not');
    expect(readme).toContain('plexus');
    expect(readme).toContain('tmnl consumes nexus');
    expect(readme).toContain('Catalog stays Postgres off-cluster');
    expect(readme).toContain('packages/tmnl/nix/modules/nats/values.yaml');
    expect(readme).toContain('@tmnl/msh');
    expect(readme).toContain('Ship when CI is green on the lab branch');
    expect(readme).not.toContain('Hold deploy');
    expect(readme).not.toContain('from this land');
    expect(readme).not.toContain('I am not');
    expect(readme).not.toContain(
      'CosmoRouter and CosmoSubgraph stay GraphQL specializations in `packages/tmnl`',
    );
    expect(readme).not.toContain('stay GraphQL specializations in `packages/tmnl`');
    expect(readme).not.toContain('packages/plexus');
    expect(readme).not.toContain('@gbg/plexus');
  });
});
