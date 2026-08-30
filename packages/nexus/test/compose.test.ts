import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  composeRouterExecutionConfig,
  loadGraphInput,
  loadRouterRuntimeConfig,
  NATS_HELM_VALUES_PATH,
  NATS_URL,
  packageJson,
  ROUTER_EXECUTION_CONFIG_NAME,
  ROUTER_LISTEN_ADDR,
  WGC_VERSION,
} from '../src/index';

describe('@gbg/nexus package', () => {
  test('is @gbg/nexus and pins wgc 0.130.1', () => {
    const pkg = packageJson();
    expect(pkg.name).toBe('@gbg/nexus');
    expect(pkg.dependencies.wgc).toBe(WGC_VERSION);
    expect(WGC_VERSION).toBe('0.130.1');
  });
});

describe('graph.yaml', () => {
  test('is official Cosmo compose input with a fixture subgraph', () => {
    const graph = loadGraphInput();
    expect(graph.version).toBe(1);
    expect(graph.subgraphs.length).toBeGreaterThan(0);
    const fixture = graph.subgraphs.find((s) => s.name === 'fixture-demo');
    expect(fixture).toBeDefined();
    expect(fixture?.schema?.file).toContain('fixture-demo.graphql');
    expect(fixture?.routing_url).toMatch(/^https?:\/\//);
  });
});

describe('config.yaml', () => {
  test('points execution config at router.json and EDFS at helm NATS', () => {
    const runtime = loadRouterRuntimeConfig();
    expect(runtime.execution_config.file.path).toBe(
      ROUTER_EXECUTION_CONFIG_NAME,
    );
    expect(runtime.listen_addr).toBe(ROUTER_LISTEN_ADDR);
    const nats = runtime.events.providers.nats[0];
    expect(nats?.id).toBe('default');
    expect(nats?.url).toBe(NATS_URL);
    expect(NATS_HELM_VALUES_PATH).toBe(
      'packages/tmnl/nix/modules/nats/values.yaml',
    );
  });
});

describe('wgc router compose', () => {
  test('emits router execution config from the fixture subgraph', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gbg-nexus-compose-'));
    const out = join(dir, ROUTER_EXECUTION_CONFIG_NAME);
    try {
      const result = composeRouterExecutionConfig({ out });
      expect(result.path).toBe(out);
      expect(result.stdout).toContain(
        'Router execution config successfully written',
      );

      const parsed = result.config;
      expect(parsed.engineConfig).toBeTypeOf('object');
      expect(parsed.compatibilityVersion).toMatch(/^1:/);
      expect(parsed.subgraphs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'fixture-demo',
            routingUrl: 'http://localhost:4001/graphql',
          }),
        ]),
      );

      const schema = parsed.engineConfig?.graphqlSchema ?? '';
      expect(schema).toContain('fixtureHealth');
      expect(schema).toContain('FixtureDemo');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
