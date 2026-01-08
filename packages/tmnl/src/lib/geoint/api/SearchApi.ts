/**
 * ALLINT COP Search HttpApi
 *
 * Effect HttpApi definition for search operations including:
 * - Multi-source search endpoints
 * - External API proxies (OpenSky, Overpass)
 * - Rate limiting and error handling
 * - OpenAPI generation
 *
 * @see beads:tmnl-cds9q HttpApi: External API Integrations
 * @module
 */

import { Schema } from 'effect'
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  OpenApi,
} from '@effect/platform'
import {
  SearchId,
  SearchQuery,
  SearchResponse,
  IntelSource,
  BBox,
  Position,
  OpenSkyResponse,
  OverpassResponse,
  SavedSearch,
  SearchHistoryEntry,
} from '../schemas'

// =============================================================================
// Error Schemas
// =============================================================================

/**
 * Search query validation error (400)
 */
export class SearchValidationError extends Schema.TaggedError<SearchValidationError>()(
  'SearchValidationError',
  {
    message: Schema.String,
    field: Schema.optional(Schema.String),
  },
  HttpApiSchema.annotations({ status: 400 })
) {}

/**
 * Search not found error (404)
 */
export class SearchNotFound extends Schema.TaggedError<SearchNotFound>()(
  'SearchNotFound',
  {
    searchId: Schema.String,
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 404 })
) {}

/**
 * Rate limit exceeded error (429)
 */
export class RateLimitExceeded extends Schema.TaggedError<RateLimitExceeded>()(
  'RateLimitExceeded',
  {
    source: Schema.String,
    retryAfterSeconds: Schema.Number,
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 429 })
) {}

/**
 * External API error (502)
 */
export class ExternalApiError extends Schema.TaggedError<ExternalApiError>()(
  'ExternalApiError',
  {
    source: Schema.String,
    statusCode: Schema.Number,
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 502 })
) {}

/**
 * External API timeout error (504)
 */
export class ExternalApiTimeout extends Schema.TaggedError<ExternalApiTimeout>()(
  'ExternalApiTimeout',
  {
    source: Schema.String,
    timeoutMs: Schema.Number,
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 504 })
) {}

/**
 * Internal server error (500)
 */
export class InternalError extends Schema.TaggedError<InternalError>()(
  'InternalError',
  {
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 500 })
) {}

// =============================================================================
// Request/Response Schemas
// =============================================================================

/**
 * Nearby search request
 */
export const NearbySearchRequest = Schema.Struct({
  center: Position,
  radiusMeters: Schema.Number.pipe(Schema.positive()),
  sources: Schema.optionalWith(Schema.Array(IntelSource), { default: () => [] }),
  limit: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { default: () => 100 }),
})
export type NearbySearchRequest = typeof NearbySearchRequest.Type

/**
 * Bounds search request
 */
export const BoundsSearchRequest = Schema.Struct({
  bounds: BBox,
  sources: Schema.optionalWith(Schema.Array(IntelSource), { default: () => [] }),
  limit: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { default: () => 100 }),
})
export type BoundsSearchRequest = typeof BoundsSearchRequest.Type

/**
 * OpenSky query request
 */
export const OpenSkyQueryRequest = Schema.Struct({
  bounds: Schema.optional(BBox),
  icao24: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  time: Schema.optional(Schema.Number),
})
export type OpenSkyQueryRequest = typeof OpenSkyQueryRequest.Type

/**
 * Overpass query request
 */
export const OverpassQueryRequest = Schema.Struct({
  query: Schema.String,
  format: Schema.optionalWith(
    Schema.Literal('json', 'xml', 'csv'),
    { default: () => 'json' as const }
  ),
  timeout: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { default: () => 25 }),
})
export type OverpassQueryRequest = typeof OverpassQueryRequest.Type

/**
 * Overpass query builder request
 */
export const OverpassBuilderRequest = Schema.Struct({
  bounds: BBox,
  amenities: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  tags: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.String }),
    { default: () => ({}) }
  ),
})
export type OverpassBuilderRequest = typeof OverpassBuilderRequest.Type

/**
 * Save search request
 */
export const SaveSearchRequest = Schema.Struct({
  name: Schema.String,
  query: SearchQuery,
})
export type SaveSearchRequest = typeof SaveSearchRequest.Type

/**
 * Aggregation request
 */
export const AggregationRequest = Schema.Struct({
  query: SearchQuery,
  cellSize: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { default: () => 1000 }),
  aggregationType: Schema.optionalWith(
    Schema.Literal('count', 'density', 'heatmap'),
    { default: () => 'count' as const }
  ),
})
export type AggregationRequest = typeof AggregationRequest.Type

/**
 * Aggregation response
 */
export const AggregationResponse = Schema.Struct({
  cells: Schema.Array(Schema.Struct({
    bounds: BBox,
    count: Schema.Number,
    weight: Schema.Number.pipe(Schema.between(0, 1)),
  })),
  totalCount: Schema.Number,
})
export type AggregationResponse = typeof AggregationResponse.Type

// =============================================================================
// Path Parameters
// =============================================================================

const searchIdParam = HttpApiSchema.param('searchId', Schema.String)

// =============================================================================
// Search API Group
// =============================================================================

/**
 * Core search endpoints
 */
class SearchApiGroup extends HttpApiGroup.make('search')
  // POST /v1/search - Execute full search
  .add(
    HttpApiEndpoint.post('search', '/v1/search')
      .setPayload(SearchQuery)
      .addSuccess(SearchResponse)
      .addError(SearchValidationError)
      .addError(InternalError)
  )
  // POST /v1/search/nearby - Radius-based search
  .add(
    HttpApiEndpoint.post('searchNearby', '/v1/search/nearby')
      .setPayload(NearbySearchRequest)
      .addSuccess(SearchResponse)
      .addError(SearchValidationError)
      .addError(InternalError)
  )
  // POST /v1/search/bounds - Bounding box search
  .add(
    HttpApiEndpoint.post('searchInBounds', '/v1/search/bounds')
      .setPayload(BoundsSearchRequest)
      .addSuccess(SearchResponse)
      .addError(SearchValidationError)
      .addError(InternalError)
  )
  // POST /v1/search/aggregate - Aggregated results
  .add(
    HttpApiEndpoint.post('aggregate', '/v1/search/aggregate')
      .setPayload(AggregationRequest)
      .addSuccess(AggregationResponse)
      .addError(SearchValidationError)
      .addError(InternalError)
  )
  .annotateContext(OpenApi.annotations({
    title: 'Search API',
    description: 'Multi-source ALLINT COP search operations',
  }))
{}

// =============================================================================
// External API Proxy Group
// =============================================================================

/**
 * External API proxy endpoints (with rate limiting)
 */
class ExternalApiGroup extends HttpApiGroup.make('external')
  // POST /v1/external/opensky - Query OpenSky Network
  .add(
    HttpApiEndpoint.post('queryOpenSky', '/v1/external/opensky')
      .setPayload(OpenSkyQueryRequest)
      .addSuccess(OpenSkyResponse)
      .addError(RateLimitExceeded)
      .addError(ExternalApiError)
      .addError(ExternalApiTimeout)
  )
  // POST /v1/external/overpass - Query Overpass API
  .add(
    HttpApiEndpoint.post('queryOverpass', '/v1/external/overpass')
      .setPayload(OverpassQueryRequest)
      .addSuccess(OverpassResponse)
      .addError(RateLimitExceeded)
      .addError(ExternalApiError)
      .addError(ExternalApiTimeout)
  )
  // POST /v1/external/overpass/build - Build Overpass query
  .add(
    HttpApiEndpoint.post('buildOverpassQuery', '/v1/external/overpass/build')
      .setPayload(OverpassBuilderRequest)
      .addSuccess(Schema.String)
      .addError(SearchValidationError)
  )
  .annotateContext(OpenApi.annotations({
    title: 'External API Proxy',
    description: 'Rate-limited proxies for external GEOINT APIs',
  }))
{}

// =============================================================================
// Saved Searches Group
// =============================================================================

/**
 * Saved search management endpoints
 */
class SavedSearchGroup extends HttpApiGroup.make('saved')
  // POST /v1/saved - Save a search
  .add(
    HttpApiEndpoint.post('save', '/v1/saved')
      .setPayload(SaveSearchRequest)
      .addSuccess(SavedSearch)
      .addError(SearchValidationError)
      .addError(InternalError)
  )
  // GET /v1/saved - List saved searches
  .add(
    HttpApiEndpoint.get('list', '/v1/saved')
      .setUrlParams(Schema.Struct({
        limit: Schema.optionalWith(Schema.NumberFromString, { default: () => 50 }),
      }))
      .addSuccess(Schema.Array(SavedSearch))
      .addError(InternalError)
  )
  // GET /v1/saved/:searchId - Get saved search
  .add(
    HttpApiEndpoint.get('get')`/v1/saved/${searchIdParam}`
      .addSuccess(SavedSearch)
      .addError(SearchNotFound)
  )
  // DELETE /v1/saved/:searchId - Delete saved search
  .add(
    HttpApiEndpoint.del('delete')`/v1/saved/${searchIdParam}`
      .addSuccess(Schema.Void)
      .addError(SearchNotFound)
  )
  // POST /v1/saved/:searchId/execute - Execute saved search
  .add(
    HttpApiEndpoint.post('execute')`/v1/saved/${searchIdParam}/execute`
      .addSuccess(SearchResponse)
      .addError(SearchNotFound)
      .addError(InternalError)
  )
  .annotateContext(OpenApi.annotations({
    title: 'Saved Searches',
    description: 'Save and manage search queries',
  }))
{}

// =============================================================================
// History Group
// =============================================================================

/**
 * Search history endpoints
 */
class HistoryGroup extends HttpApiGroup.make('history')
  // GET /v1/history - Get search history
  .add(
    HttpApiEndpoint.get('list', '/v1/history')
      .setUrlParams(Schema.Struct({
        limit: Schema.optionalWith(Schema.NumberFromString, { default: () => 20 }),
      }))
      .addSuccess(Schema.Array(SearchHistoryEntry))
      .addError(InternalError)
  )
  // DELETE /v1/history - Clear search history
  .add(
    HttpApiEndpoint.del('clear', '/v1/history')
      .addSuccess(Schema.Void)
      .addError(InternalError)
  )
  .annotateContext(OpenApi.annotations({
    title: 'Search History',
    description: 'View and manage search history',
  }))
{}

// =============================================================================
// Health Group
// =============================================================================

/**
 * Health check response
 */
export const SearchHealthStatus = Schema.Struct({
  status: Schema.Literal('healthy', 'degraded', 'unhealthy'),
  timestamp: Schema.Date,
  sources: Schema.Record({
    key: Schema.String,
    value: Schema.Struct({
      available: Schema.Boolean,
      latencyMs: Schema.optional(Schema.Number),
      lastError: Schema.optional(Schema.String),
    }),
  }),
})
export type SearchHealthStatus = typeof SearchHealthStatus.Type

/**
 * Health check endpoints
 */
class HealthGroup extends HttpApiGroup.make('health', { topLevel: true })
  .add(
    HttpApiEndpoint.get('check', '/health')
      .addSuccess(SearchHealthStatus)
  )
  .annotateContext(OpenApi.annotations({
    title: 'Health',
    description: 'Service health checks',
  }))
{}

// =============================================================================
// Main API
// =============================================================================

/**
 * ALLINT COP Search API
 *
 * Complete API for search operations with external integrations.
 */
export class SearchApi extends HttpApi.make('geoint-search')
  .add(SearchApiGroup)
  .add(ExternalApiGroup)
  .add(SavedSearchGroup)
  .add(HistoryGroup)
  .add(HealthGroup)
  .annotateContext(OpenApi.annotations({
    title: 'ALLINT COP Search API',
    description: 'All-Source Intelligence Common Operating Picture search and query API',
    version: '1.0.0',
  }))
{}

// =============================================================================
// Exports
// =============================================================================

export {
  SearchApiGroup,
  ExternalApiGroup,
  SavedSearchGroup,
  HistoryGroup,
  HealthGroup,
}
