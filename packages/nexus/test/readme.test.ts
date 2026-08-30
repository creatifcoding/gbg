import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const readme = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../README.md'),
  'utf8',
);

describe('nexus README identity', () => {
  test('places Cosmo/WunderGraph home at @gbg/nexus', () => {
    expect(readme).toContain('@gbg/nexus');
    expect(readme).toContain('packages/nexus');
    expect(readme).toContain('tmnl consumes');
    expect(readme).toContain('Not tmnl. Not plexus');
    expect(readme).toContain('Leftover Pepr');
    expect(readme).toContain('packages/tmnl/src/infra/graph');
    expect(readme).toContain('Catalog stays Postgres off-cluster');
    expect(readme).toContain('packages/tmnl/nix/modules/nats/values.yaml');
    expect(readme).toContain('@tmnl/msh');
    expect(readme).toContain('Ship when CI is green on the lab branch');
    expect(readme).toContain('User corrects after the fact');
    expect(readme).not.toContain('Hold merge');
    expect(readme).not.toContain('Hold deploy');
    expect(readme).not.toContain('from this land');
    expect(readme).not.toContain('I am not');
    expect(readme).not.toContain('packages/plexus');
    expect(readme).not.toContain('@gbg/plexus');
  });

  test('names official compose files and wgc', () => {
    expect(readme).toContain('graph.yaml');
    expect(readme).toContain('config.yaml');
    expect(readme).toContain('router.json');
    expect(readme).toContain('wgc router compose -i graph.yaml -o router.json');
    expect(readme).toContain('wgc@0.130.1');
    expect(readme).toContain('ghcr.io/wundergraph/cosmo/router');
    expect(readme).toContain('fixture-demo');
  });
});
