/**
 * ClusterClientLayer - Client-side Layer for CardEntity operations
 *
 * Provides CardEntity.client for use in React components (browser).
 * Connects to the cluster runner at configurable host/port.
 *
 * NOTE: Effect Cluster's client protocol requires knowing the runner address
 * at RPC call time. The `layerClientProtocolHttp` creates a protocol factory
 * that builds URLs dynamically from RunnerAddress.
 *
 * @module cursor/cluster/ClusterClientLayer
 */

import { Layer, Config, Effect, Option } from 'effect'
import * as HttpRunner from '@effect/cluster/HttpRunner'
import * as RunnerServer from '@effect/cluster/RunnerServer'
import * as MessageStorage from '@effect/cluster/MessageStorage'
import * as RunnerStorage from '@effect/cluster/RunnerStorage'
import * as RunnerHealth from '@effect/cluster/RunnerHealth'
import * as ShardingConfig from '@effect/cluster/ShardingConfig'
import * as RpcSerialization from '@effect/rpc/RpcSerialization'
import { FetchHttpClient } from '@effect/platform'
import type { Sharding } from '@effect/cluster/Sharding'

import { CARD_SHARD_GROUPS } from './CardEntity'

// =============================================================================
// Configuration
// =============================================================================

/**
 * Configuration for cluster client connection
 */
export interface ClusterClientConfig {
  /** Cluster runner host (default: localhost) */
  readonly host: string
  /** Cluster runner port (default: 8100) */
  readonly port: number
  /** RPC endpoint path (default: /rpc) */
  readonly path?: string
  /** Whether to use HTTPS (default: false) */
  readonly https?: boolean
}

/**
 * Default configuration for local development
 */
export const DEFAULT_CONFIG: ClusterClientConfig = {
  host: 'localhost',
  port: 8100,
  path: '/',  // Default path used by HttpRunner.layerHttp
  https: false,
}

// =============================================================================
// Environment Config Layer
// =============================================================================

/**
 * Load configuration from environment variables
 */
const ClusterClientEnvConfig = {
  host: Config.string('CLUSTER_HOST').pipe(
    Config.withDefault(DEFAULT_CONFIG.host)
  ),
  port: Config.number('CLUSTER_PORT').pipe(
    Config.withDefault(DEFAULT_CONFIG.port)
  ),
}

// =============================================================================
// Client Layer Factory
// =============================================================================

/**
 * Create a cluster client layer for browser use
 *
 * This layer provides:
 * - Sharding (client-only mode - no runner registration)
 * - HTTP RPC client protocol
 * - MessagePack serialization
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const makeClient = yield* CardEntity.client
 *   const client = makeClient('card-123')
 *   const stream = yield* client.send(new StreamUIGenerateRpc({ ... }))
 * }).pipe(Effect.provide(ClusterClientLayer({ host: 'localhost', port: 8100 })))
 * ```
 */
export const ClusterClientLayer = (config: ClusterClientConfig = DEFAULT_CONFIG): Layer.Layer<Sharding> => {
  const { path = '/rpc', https = false } = config

  // Sharding config for client-only mode
  const shardingConfigLayer = ShardingConfig.layer({
    runnerAddress: Option.none(), // Client-only, no runner registration
    shardGroups: [...CARD_SHARD_GROUPS],
    shardsPerGroup: 100,
  })

  // RPC client protocol layer (HTTP)
  // The protocol factory receives RunnerAddress dynamically and builds URLs
  const rpcProtocolLayer = HttpRunner.layerClientProtocolHttp({
    path,
    https,
  })

  // Build the full client layer
  return RunnerServer.layerClientOnly.pipe(
    Layer.provide(rpcProtocolLayer),
    Layer.provide(RpcSerialization.layerMsgPack),
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(MessageStorage.layerNoop),
    Layer.provide(RunnerStorage.layerMemory),
    Layer.provide(RunnerHealth.layerNoop),
    Layer.provide(shardingConfigLayer)
  )
}

// =============================================================================
// Pre-configured Layers
// =============================================================================

/**
 * Pre-configured layer for local development (localhost:8100)
 */
export const ClusterClientLayerLocal = ClusterClientLayer(DEFAULT_CONFIG)

/**
 * Layer that reads configuration from environment variables
 */
export const ClusterClientLayerFromEnv = Layer.unwrapEffect(
  Effect.gen(function* () {
    const host = yield* ClusterClientEnvConfig.host
    const port = yield* ClusterClientEnvConfig.port
    return ClusterClientLayer({ host, port })
  })
)

// =============================================================================
// Type Exports
// =============================================================================

export type { Sharding }
