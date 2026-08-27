/**
 * @gbg/nexus — Cosmo/WunderGraph federated GraphQL router home.
 *
 * Official local path: `wgc router compose -i graph.yaml -o router.json`.
 * tmnl consumes this package. Leftover Pepr Cosmo CRDs stay in tmnl.
 */

export {
  composeRouterExecutionConfig,
  loadGraphInput,
  loadRouterRuntimeConfig,
  type ComposeOptions,
} from './compose';
export {
  CONFIG_YAML,
  EXECUTION_CONFIG_CONTAINER_PATH,
  FIXTURE_SDL,
  GRAPH_YAML,
  NATS_HELM_VALUES_PATH,
  NATS_PROVIDER_ID,
  NATS_URL,
  PACKAGE_ROOT,
  ROUTER_EXECUTION_CONFIG_NAME,
  ROUTER_IMAGE,
  ROUTER_JSON,
  ROUTER_LISTEN_ADDR,
  WGC_VERSION,
  packageJson,
} from './paths';
export type {
  ComposeResult,
  GraphComposeInput,
  GraphSubgraphInput,
  NatsEventProvider,
  RouterExecutionConfig,
  RouterRuntimeConfig,
} from './types';
