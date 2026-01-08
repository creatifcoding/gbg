/**
 * GEOINT API - Barrel Export
 *
 * HttpApi definitions and external API clients for the ALLINT COP search system.
 *
 * @module geoint/api
 */

// =============================================================================
// Search API (HttpApi definitions)
// =============================================================================

export {
  // Error Schemas
  SearchValidationError,
  SearchNotFound,
  RateLimitExceeded,
  ExternalApiError as HttpExternalApiError,
  ExternalApiTimeout,
  InternalError,
  // Request/Response Schemas
  NearbySearchRequest,
  BoundsSearchRequest,
  OpenSkyQueryRequest,
  OverpassQueryRequest,
  OverpassBuilderRequest,
  SaveSearchRequest,
  AggregationRequest,
  AggregationResponse,
  SearchHealthStatus,
  // API Groups
  SearchApiGroup,
  ExternalApiGroup,
  SavedSearchGroup,
  HistoryGroup,
  HealthGroup,
  // Main API
  SearchApi,
} from './SearchApi'
export type {
  NearbySearchRequest as NearbySearchRequestType,
  BoundsSearchRequest as BoundsSearchRequestType,
  OpenSkyQueryRequest as OpenSkyQueryRequestType,
  OverpassQueryRequest as OverpassQueryRequestType,
  OverpassBuilderRequest as OverpassBuilderRequestType,
  SaveSearchRequest as SaveSearchRequestType,
  AggregationRequest as AggregationRequestType,
  AggregationResponse as AggregationResponseType,
  SearchHealthStatus as SearchHealthStatusType,
} from './SearchApi'

// =============================================================================
// External API Clients
// =============================================================================

export {
  // Error Types
  ExternalApiError,
  RateLimitError,
  TimeoutError,
  // Rate Limiter
  makeRateLimiter,
  type RateLimiter,
  // OpenSky Client
  OpenSkyClientService,
  makeOpenSkyClient,
  OpenSkyClientLive,
  DEFAULT_OPENSKY_CONFIG,
  type OpenSkyConfig,
  type OpenSkyClient,
  // Overpass Client
  OverpassClientService,
  makeOverpassClient,
  OverpassClientLive,
  DEFAULT_OVERPASS_CONFIG,
  type OverpassConfig,
  type OverpassClient,
  // Combined Layer
  ExternalApiClientsLive,
  // Result Transformers
  openSkyToSearchResult,
  overpassToSearchResult,
} from './ExternalApiClient'
