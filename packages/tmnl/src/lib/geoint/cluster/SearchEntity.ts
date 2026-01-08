/**
 * Search Entity - Effect Cluster for Distributed Search
 *
 * Implements distributed search processing across multiple data sources:
 * - Tracks (IntelClient)
 * - OSM/Overpass (OverpassClient)
 * - Flights/ADS-B (OpenSkyClient)
 * - Features (FeatureClient)
 *
 * Sharding strategy: By IntelSource type for source-specific workers.
 * Aggregation: Fan-out to source workers, fan-in for combined results.
 *
 * @see beads:tmnl-j5139 Effect Cluster: Distributed Search Processing
 * @module
 */

import { Schema } from 'effect'
import { Entity, ClusterSchema } from '@effect/cluster'
import { Rpc, RpcSchema } from '@effect/rpc'
import {
  SearchId,
  SearchQuery,
  SearchResponse,
  SearchResultItem,
  IntelSource,
  BBox,
  Position,
  SearchStarted,
  SearchPartialResults,
  SearchCompleted,
} from '../schemas'

// =============================================================================
// Error Types
// =============================================================================

/**
 * Search entity operation errors
 */
export class SearchEntityError extends Schema.TaggedError<SearchEntityError>()(
  'SearchEntityError',
  {
    operation: Schema.String,
    source: Schema.optional(IntelSource),
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

/**
 * Source unavailable error
 */
export class SourceUnavailableError extends Schema.TaggedError<SourceUnavailableError>()(
  'SourceUnavailableError',
  {
    source: IntelSource,
    reason: Schema.String,
  }
) {}

/**
 * Search timeout error
 */
export class SearchTimeoutError extends Schema.TaggedError<SearchTimeoutError>()(
  'SearchTimeoutError',
  {
    searchId: SearchId,
    source: Schema.optional(IntelSource),
    timeoutMs: Schema.Number,
  }
) {}

// =============================================================================
// Source-Specific RPCs (Sharded by source type)
// =============================================================================

/**
 * Search tracks payload
 */
export const SearchTracksPayload = Schema.Struct({
  searchId: SearchId,
  bounds: Schema.optional(BBox),
  center: Schema.optional(Position),
  radiusMeters: Schema.optional(Schema.Number),
  limit: Schema.optionalWith(Schema.Number, { default: () => 100 }),
})

/**
 * Search tracks (IntelClient source)
 */
export class SearchTracksRpc extends Rpc.make('SearchTracks', {
  payload: SearchTracksPayload,
  success: Schema.Array(SearchResultItem),
  error: SearchEntityError,
}) {}

/**
 * Search OSM payload
 */
export const SearchOsmPayload = Schema.Struct({
  searchId: SearchId,
  bounds: BBox,
  amenities: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  query: Schema.optional(Schema.String),
  limit: Schema.optionalWith(Schema.Number, { default: () => 100 }),
})

/**
 * Search OSM/Overpass features
 */
export class SearchOsmRpc extends Rpc.make('SearchOsm', {
  payload: SearchOsmPayload,
  success: Schema.Array(SearchResultItem),
  error: SearchEntityError,
}) {}

/**
 * Search flights payload
 */
export const SearchFlightsPayload = Schema.Struct({
  searchId: SearchId,
  bounds: Schema.optional(BBox),
  icao24: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  limit: Schema.optionalWith(Schema.Number, { default: () => 100 }),
})

/**
 * Search flights/ADS-B (OpenSky source)
 */
export class SearchFlightsRpc extends Rpc.make('SearchFlights', {
  payload: SearchFlightsPayload,
  success: Schema.Array(SearchResultItem),
  error: SearchEntityError,
}) {}

/**
 * Search features payload
 */
export const SearchFeaturesPayload = Schema.Struct({
  searchId: SearchId,
  bounds: Schema.optional(BBox),
  featureTypes: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  limit: Schema.optionalWith(Schema.Number, { default: () => 100 }),
})

/**
 * Search vector features (FeatureClient source)
 */
export class SearchFeaturesRpc extends Rpc.make('SearchFeatures', {
  payload: SearchFeaturesPayload,
  success: Schema.Array(SearchResultItem),
  error: SearchEntityError,
}) {}

// =============================================================================
// Aggregation RPCs (Coordinator operations)
// =============================================================================

/**
 * Aggregated search payload
 */
export const AggregatedSearchPayload = Schema.Struct({
  query: SearchQuery,
  parallelism: Schema.optionalWith(Schema.Number, { default: () => 4 }),
  timeoutMs: Schema.optionalWith(Schema.Number, { default: () => 30000 }),
})

/**
 * Execute multi-source search with aggregation
 * This is the main entry point - fans out to source workers, fans in results
 */
export class AggregatedSearchRpc extends Rpc.make('AggregatedSearch', {
  payload: AggregatedSearchPayload,
  success: SearchResponse,
  error: SearchEntityError,
}) {}

/**
 * Stream search payload
 */
export const StreamSearchPayload = Schema.Struct({
  query: SearchQuery,
  bufferSize: Schema.optionalWith(Schema.Number, { default: () => 100 }),
})

/**
 * Stream search results as they arrive from sources
 */
export class StreamSearchRpc extends Rpc.make('StreamSearch', {
  payload: StreamSearchPayload,
  success: RpcSchema.Stream({
    success: Schema.Union(SearchStarted, SearchPartialResults, SearchCompleted),
    failure: SearchEntityError,
  }),
  error: SearchEntityError,
}) {}

/**
 * Cancel search payload
 */
export const CancelSearchPayload = Schema.Struct({
  searchId: SearchId,
  reason: Schema.optional(Schema.String),
})

/**
 * Cancel an in-progress search
 */
export class CancelSearchRpc extends Rpc.make('CancelSearch', {
  payload: CancelSearchPayload,
  success: Schema.Void,
  error: SearchEntityError,
}) {}

// =============================================================================
// Health & Status RPCs
// =============================================================================

/**
 * Source health status
 */
export const SourceHealthStatus = Schema.Struct({
  source: IntelSource,
  available: Schema.Boolean,
  latencyMs: Schema.optional(Schema.Number),
  lastError: Schema.optional(Schema.String),
  lastChecked: Schema.Date,
})
export type SourceHealthStatus = typeof SourceHealthStatus.Type

/**
 * Get health status for all sources
 */
export class GetSourceHealthRpc extends Rpc.make('GetSourceHealth', {
  payload: Schema.Struct({}),
  success: Schema.Array(SourceHealthStatus),
  error: SearchEntityError,
}) {}

/**
 * Ping source payload
 */
export const PingSourcePayload = Schema.Struct({
  source: IntelSource,
})

/**
 * Ping a specific source
 */
export class PingSourceRpc extends Rpc.make('PingSource', {
  payload: PingSourcePayload,
  success: SourceHealthStatus,
  error: SourceUnavailableError,
}) {}

// =============================================================================
// Search Entity Definition
// =============================================================================

/**
 * Search Entity
 *
 * Distributed actor for search operations across ALLINT COP data sources.
 * Uses HashRing sharding for source-specific workers.
 *
 * Sharding Strategy:
 * - Source workers are sharded by IntelSource type
 * - Coordinator handles aggregation and fan-out/fan-in
 * - Health checks are broadcast to all workers
 */
export const SearchEntity = Entity.make('Search', [
  // Source-specific RPCs (sharded by source)
  SearchTracksRpc,
  SearchOsmRpc,
  SearchFlightsRpc,
  SearchFeaturesRpc,
  // Aggregation RPCs (coordinator)
  AggregatedSearchRpc,
  StreamSearchRpc,
  CancelSearchRpc,
  // Health & Status
  GetSourceHealthRpc,
  PingSourceRpc,
])
  // Annotate with shard group based on source type for distribution
  .annotate(ClusterSchema.ShardGroup, (entityId) => {
    // Entity IDs can be source-specific (e.g., "track", "osm", "flight")
    // or "coordinator" for aggregation operations
    const sourceGroups: Record<string, string> = {
      track: 'source-tracks',
      osm: 'source-osm',
      flight: 'source-flights',
      feature: 'source-features',
      coordinator: 'search-coordinator',
    }
    return sourceGroups[entityId] ?? 'search-default'
  })

/**
 * Type helper for Search Entity
 */
export type SearchEntity = typeof SearchEntity

// =============================================================================
// Entity Client Type (for use with Sharding.Client)
// =============================================================================

/**
 * Search entity type
 * Access client via: yield* SearchEntity.client
 */
export type SearchEntityType = typeof SearchEntity

// =============================================================================
// Shard Group Configuration
// =============================================================================

/**
 * Shard groups for search cluster runners
 */
export const SEARCH_SHARD_GROUPS = [
  'search-default',
  'search-coordinator',
  'source-tracks',
  'source-osm',
  'source-flights',
  'source-features',
] as const

/**
 * Type for search shard groups
 */
export type SearchShardGroup = (typeof SEARCH_SHARD_GROUPS)[number]
