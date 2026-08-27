/**
 * Official Cosmo compose input and router runtime types.
 * Shape matches https://cosmo-docs.wundergraph.com/cli/router/compose
 * and the local-development tutorial's config.yaml.
 */

export type GraphSubgraphInput = {
  name: string;
  routing_url: string;
  schema?: {
    file: string;
  };
  introspection?: {
    url: string;
    headers?: Record<string, string>;
  };
  subscription?: {
    url?: string;
    protocol?: string;
    websocket_subprotocol?: string;
  };
};

export type GraphComposeInput = {
  version: number;
  subgraphs: GraphSubgraphInput[];
};

export type NatsEventProvider = {
  id: string;
  url: string;
};

export type RouterRuntimeConfig = {
  version?: string;
  dev_mode?: boolean;
  listen_addr?: string;
  execution_config: {
    file: {
      path: string;
      watch?: boolean;
    };
  };
  events: {
    providers: {
      nats: NatsEventProvider[];
    };
  };
};

/**
 * Router execution config produced by `wgc router compose`.
 * Observed from wgc@0.130.1 / @wundergraph/composition@0.63.3:
 * engineConfig, subgraphs[], version, compatibilityVersion, featureFlagConfigs.
 */
export type RouterExecutionConfig = {
  version?: string;
  compatibilityVersion?: string;
  engineConfig?: {
    graphqlSchema?: string;
    datasourceConfigurations?: unknown;
    stringStorage?: unknown;
    defaultFlushInterval?: unknown;
  };
  subgraphs?: Array<{
    id?: string;
    name?: string;
    routingUrl?: string;
  }>;
  featureFlagConfigs?: unknown;
} & Record<string, unknown>;

export type ComposeResult = {
  path: string;
  stdout: string;
  config: RouterExecutionConfig;
};
