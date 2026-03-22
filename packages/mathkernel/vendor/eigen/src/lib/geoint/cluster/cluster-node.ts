/**
 * GEOINT Search Cluster Node - Effect Cluster Runner Entry Point
 *
 * This is the main entry point for a containerized Effect Cluster node
 * that processes distributed search operations.
 *
 * Architecture:
 * - HTTP transport for inter-runner communication (BunClusterHttp)
 * - PostgreSQL storage for RunnerStorage and MessageStorage (SQL storage)
 * - Configurable via environment variables
 * - Health checks via ping-based protocol
 *
 * Environment Variables:
 *   RUNNER_HOST             - Host for this runner (default: 0.0.0.0)
 *   RUNNER_PORT             - Port for this runner (default: 8000)
 *   SHARD_GROUPS            - Comma-separated shard groups to serve (default: search-default)
 *   DATABASE_URL            - PostgreSQL connection string
 *   DURABLE_STREAMS_URL     - DurableStreams HTTP API URL
 *   LOG_LEVEL               - Logging level (default: info)
 *
 * @module geoint/cluster/cluster-node
 */

import { Effect, Layer, Config, Console, Logger, LogLevel, Duration, Option } from 'effect'

// Effect Cluster (Bun Platform)
import * as BunClusterHttp from '@effect/platform-bun/BunClusterHttp'
import * as ShardingConfig from '@effect/cluster/ShardingConfig'
import { RunnerAddress } from '@effect/cluster/RunnerAddress'

// Effect SQL
import * as PgClient from '@effect/sql-pg/PgClient'

// Platform
import { FetchHttpClient } from '@effect/platform'

// Local
import { SEARCH_SHARD_GROUPS } from './SearchEntity'
import { INGESTION_SHARD_GROUPS } from './IngestionEntity'
import { SearchEntityHandlers } from './SearchEntityHandlers'
import { IngestionEntityHandlers } from './IngestionEntityHandlers'
import {
  OpenSkyClientLive,
  OverpassClientLive,
  OpenMeteoClientLive,
  AdsbLolClientLive,
} from '../api/ExternalApiClient'
import { CircuitBreakersLive } from '../api/circuit-breaker'
import {
  TrackPositionRepositoryLive,
  FeatureRepositoryLive,
  FlightRepositoryLive,
  PoiRepositoryLive,
  WeatherRepositoryLive,
  ImageryRepositoryLive,
} from '../persistence'
import { DurableStreamClientLive } from '../../durable-streams/service'

// =============================================================================
// Configuration
// =============================================================================

const ClusterConfig = {
  host: Config.string('RUNNER_HOST').pipe(Config.withDefault('0.0.0.0')),
  port: Config.number('RUNNER_PORT').pipe(Config.withDefault(8000)),
  shardGroups: Config.string('SHARD_GROUPS').pipe(
    Config.withDefault('search-default'),
    Config.map((s) => s.split(',').map((g) => g.trim()).filter((g) => g.length > 0))
  ),
  durableStreamsUrl: Config.string('DURABLE_STREAMS_URL').pipe(
    Config.withDefault('http://durable-streams:3030')
  ),
  logLevel: Config.literal('debug', 'info', 'warning', 'error')('LOG_LEVEL').pipe(
    Config.withDefault('info' as const)
  ),
}

// =============================================================================
// PostgreSQL Layer
// =============================================================================

const PostgresLayer = PgClient.layerConfig({
  url: Config.redacted('DATABASE_URL'),
})

// =============================================================================
// Repository Layers (PostGIS)
// =============================================================================

const RepositoriesLayer = Layer.mergeAll(
  TrackPositionRepositoryLive,
  FeatureRepositoryLive,
  FlightRepositoryLive,
  PoiRepositoryLive,
  WeatherRepositoryLive,
  ImageryRepositoryLive,
)

// =============================================================================
// External API Client Layers
// =============================================================================

const ExternalApiClientsLayer = Layer.mergeAll(
  OpenSkyClientLive,
  OverpassClientLive,
  OpenMeteoClientLive,
  AdsbLolClientLive,
  CircuitBreakersLive,
).pipe(
  Layer.provide(FetchHttpClient.layer)
)

// =============================================================================
// Entity Handlers with Dependencies
// =============================================================================

const SharedDepsLayer = Layer.mergeAll(
  ExternalApiClientsLayer,
  RepositoriesLayer,
).pipe(
  Layer.provideMerge(DurableStreamClientLive),
  Layer.provideMerge(PostgresLayer),
)

const SearchEntityHandlersWithDeps = SearchEntityHandlers.pipe(
  Layer.provide(SharedDepsLayer),
)

const IngestionEntityHandlersWithDeps = IngestionEntityHandlers.pipe(
  Layer.provide(SharedDepsLayer),
)

// =============================================================================
// Sharding Config Layer
// =============================================================================

// All valid shard groups (search + ingestion)
const ALL_SHARD_GROUPS = [
  ...SEARCH_SHARD_GROUPS,
  ...INGESTION_SHARD_GROUPS,
] as const

const ShardingConfigLayer = Layer.unwrapEffect(
  Effect.gen(function* () {
    const host = yield* ClusterConfig.host
    const port = yield* ClusterConfig.port
    const shardGroups = yield* ClusterConfig.shardGroups

    // Validate shard groups
    const validGroups = ALL_SHARD_GROUPS as readonly string[]
    for (const group of shardGroups) {
      if (!validGroups.includes(group)) {
        yield* Effect.die(
          new Error(`Invalid shard group: ${group}. Valid: ${validGroups.join(', ')}`)
        )
      }
    }

    return ShardingConfig.layer({
      runnerAddress: Option.some(RunnerAddress.make({ host, port })),
      shardGroups,
      shardsPerGroup: 300,
      entityMaxIdleTime: Duration.minutes(5),
    })
  })
)

// =============================================================================
// HTTP Runner Layer (provides Sharding)
// =============================================================================

// BunClusterHttp.layer provides:
// - HttpRunner (Sharding, Runners)
// - HTTP transport with Bun server
// - SqlMessageStorage and SqlRunnerStorage (when storage !== "local")
// - RunnerHealth.layerPing
// - RpcSerialization (msgpack)
const HttpRunnerLayer = BunClusterHttp.layer({
  transport: 'http',
  storage: 'sql',
  serialization: 'msgpack',
}).pipe(
  // Override default ShardingConfig
  Layer.provide(ShardingConfigLayer),
  // Provide SQL client for storage
  Layer.provide(PostgresLayer),
)

// =============================================================================
// Cluster Layer (Entity handlers OUTSIDE, consume Sharding from HttpRunner)
// =============================================================================

// Merge both entity handlers (Search + Ingestion)
const EntityHandlersLayer = Layer.mergeAll(
  SearchEntityHandlersWithDeps,
  IngestionEntityHandlersWithDeps,
)

const ClusterLayer = EntityHandlersLayer.pipe(
  Layer.provide(HttpRunnerLayer),
)

// =============================================================================
// Logger Configuration
// =============================================================================

const LoggerLayer = Layer.unwrapEffect(
  Effect.gen(function* () {
    const level = yield* ClusterConfig.logLevel
    const logLevel =
      level === 'debug' ? LogLevel.Debug :
      level === 'info' ? LogLevel.Info :
      level === 'warning' ? LogLevel.Warning :
      LogLevel.Error
    return Logger.minimumLogLevel(logLevel)
  })
)

// =============================================================================
// Main Program
// =============================================================================

const program = Effect.gen(function* () {
  const host = yield* ClusterConfig.host
  const port = yield* ClusterConfig.port
  const shardGroups = yield* ClusterConfig.shardGroups
  const logLevel = yield* ClusterConfig.logLevel

  yield* Console.log('═══════════════════════════════════════════════════════════════')
  yield* Console.log('                    GEOINT Search Cluster Node                  ')
  yield* Console.log('═══════════════════════════════════════════════════════════════')
  yield* Console.log(`  Host:            ${host}`)
  yield* Console.log(`  Port:            ${port}`)
  yield* Console.log(`  Shard Groups:    ${shardGroups.join(', ')}`)
  yield* Console.log(`  Log Level:       ${logLevel}`)
  yield* Console.log(`  Transport:       HTTP (Bun)`)
  yield* Console.log(`  Storage:         SQL (PostgreSQL)`)
  yield* Console.log('═══════════════════════════════════════════════════════════════')
  yield* Console.log('')
  yield* Console.log('Starting cluster node...')

  // The BunClusterHttp.layer starts the HTTP server and joins the cluster
  // The program just needs to keep running
  yield* Effect.never
})

const main = program.pipe(
  Effect.provide(ClusterLayer),
  Effect.provide(LoggerLayer),
  Effect.catchAllCause((cause) =>
    Effect.gen(function* () {
      yield* Console.error('Cluster node failed to start:')
      yield* Console.error(cause.toString())
      yield* Effect.fail(cause)
    })
  )
)

// =============================================================================
// Entry Point
// =============================================================================

Effect.runPromise(main).catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
