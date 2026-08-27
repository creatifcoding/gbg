import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_DIR = dirname(fileURLToPath(import.meta.url));

/** Package root: Cosmo router home (`packages/nexus`). */
export const PACKAGE_ROOT = join(SRC_DIR, '..');

/** Official wgc compose input. */
export const GRAPH_YAML = join(PACKAGE_ROOT, 'graph.yaml');

/** Official Cosmo router runtime config. */
export const CONFIG_YAML = join(PACKAGE_ROOT, 'config.yaml');

/** Compose output filename used everywhere in this package. */
export const ROUTER_EXECUTION_CONFIG_NAME = 'router.json';

/** Local compose output (`wgc router compose -i graph.yaml -o router.json`). */
export const ROUTER_JSON = join(PACKAGE_ROOT, ROUTER_EXECUTION_CONFIG_NAME);

/** Federation v2 fixture SDL referenced by graph.yaml. */
export const FIXTURE_SDL = join(
  PACKAGE_ROOT,
  'fixtures',
  'fixture-demo.graphql',
);

/** Pinned Cosmo CLI. tmnl has `wgc`; current npm is 0.130.1. */
export const WGC_VERSION = '0.130.1';

/** Official Cosmo router image. */
export const ROUTER_IMAGE = 'ghcr.io/wundergraph/cosmo/router';

/** Router default listen (cosmo-demo docker + leftover CRDs). */
export const ROUTER_LISTEN_ADDR = '0.0.0.0:3002';

/**
 * In-container execution-config path already cited by leftover tmnl Cosmo CRDs
 * (`EXECUTION_CONFIG_FILE=/config/router.json`). Official router env is
 * `EXECUTION_CONFIG_FILE_PATH`.
 */
export const EXECUTION_CONFIG_CONTAINER_PATH = '/config/router.json';

/**
 * Existing helm NATS. One broker: Cosmo EDFS and `@tmnl/msh` share this.
 * Release `nats`, namespace `nats` (`packages/tmnl/nix/modules/nats/default.nix`).
 */
export const NATS_HELM_VALUES_PATH =
  'packages/tmnl/nix/modules/nats/values.yaml';

export const NATS_PROVIDER_ID = 'default';

export const NATS_URL = 'nats://nats.nats.svc.cluster.local:4222';

export function packageJson(): { name: string; dependencies: { wgc: string } } {
  return JSON.parse(
    readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8'),
  ) as { name: string; dependencies: { wgc: string } };
}
