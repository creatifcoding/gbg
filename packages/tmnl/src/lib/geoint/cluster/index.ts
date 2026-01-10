/**
 * GEOINT Cluster - Effect Cluster for Distributed Search
 *
 * Provides distributed search processing across ALLINT COP data sources:
 * - SearchEntity for sharded search operations
 * - Handlers with fan-out/fan-in aggregation pattern
 * - Health monitoring for source availability
 * - Containerized cluster nodes for horizontal scaling
 *
 * @see beads:tmnl-j5139 Effect Cluster: Distributed Search Processing
 * @module
 */

// Entity Definition
export {
  // Error Types
  SearchEntityError,
  SourceUnavailableError,
  SearchTimeoutError,
  // Payload Schemas
  SearchTracksPayload,
  SearchOsmPayload,
  SearchFlightsPayload,
  SearchFeaturesPayload,
  AggregatedSearchPayload,
  StreamSearchPayload,
  CancelSearchPayload,
  PingSourcePayload,
  // RPC Classes
  SearchTracksRpc,
  SearchOsmRpc,
  SearchFlightsRpc,
  SearchFeaturesRpc,
  AggregatedSearchRpc,
  StreamSearchRpc,
  CancelSearchRpc,
  GetSourceHealthRpc,
  PingSourceRpc,
  // Health Schema
  SourceHealthStatus,
  // Entity
  SearchEntity,
  type SearchEntityType,
  // Shard Groups
  SEARCH_SHARD_GROUPS,
  type SearchShardGroup,
} from './SearchEntity'

// Handlers
export {
  SearchEntityHandlers,
  SearchEntityLayer,
} from './SearchEntityHandlers'

// Cluster Node Entry Point (for containerized deployment)
// Import and run via: bun run src/lib/geoint/cluster/cluster-node.ts
// Or build with: bun build src/lib/geoint/cluster/cluster-node.ts --outdir dist --target bun
