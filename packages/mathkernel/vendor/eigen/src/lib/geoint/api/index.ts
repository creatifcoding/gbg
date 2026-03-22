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
  // ADSB.lol Client
  AdsbLolClientService,
  makeAdsbLolClient,
  AdsbLolClientLive,
  DEFAULT_ADSB_LOL_CONFIG,
  type AdsbLolConfig,
  type AdsbLolClient,
  // Planet Labs Client
  PlanetLabsClientService,
  makePlanetLabsClient,
  PlanetLabsClientLive,
  DEFAULT_PLANET_LABS_CONFIG,
  type PlanetLabsConfig,
  type PlanetLabsClient,
  type PlanetSearchOptions,
  // Sentinel Hub Client
  SentinelHubClientService,
  makeSentinelHubClient,
  SentinelHubClientLive,
  DEFAULT_SENTINEL_HUB_CONFIG,
  type SentinelHubConfig,
  type SentinelHubClient,
  type SentinelSearchOptions,
  // Open-Meteo Weather Client
  OpenMeteoClientService,
  makeOpenMeteoClient,
  OpenMeteoClientLive,
  DEFAULT_OPEN_METEO_CONFIG,
  type OpenMeteoConfig,
  type OpenMeteoClient,
  type WeatherForecastOptions,
  type GeocodingOptions,
  // Combined Layer
  ExternalApiClientsLive,
  // Result Transformers - Flights & POI
  openSkyToSearchResult,
  overpassToSearchResult,
  adsbLolToSearchResult,
  // Result Transformers - Satellite Imagery (Feature + Imagery types)
  planetItemToSearchResult,
  sentinelItemToSearchResult,
  planetItemToImageryResult,
  sentinelItemToImageryResult,
  // Result Transformers - Weather
  weatherForecastToSearchResult,
  geocodingLocationToSearchResult,
} from './ExternalApiClient'

// =============================================================================
// Tracing & Metrics
// =============================================================================

export {
  // Base Metrics
  apiLatencyHistogram,
  apiRequestCounter,
  apiErrorCounter,
  // Metric Update Helpers
  recordLatency,
  incrementRequests,
  incrementErrors,
  // Error Classification
  classifyError,
  // Higher-Order Tracing
  withApiTracing,
  withTiming,
  withTimedSpan,
  // Constants
  API_SOURCES,
  // Types
  type ApiSource,
  type ApiErrorType,
} from './tracing'

// =============================================================================
// Metrics Export Service
// =============================================================================

export {
  // Schemas
  ApiMetricsSnapshot,
  ApiMetricsHistory,
  // Effects
  takeMetricsSnapshot,
  takeSnapshot,
  getLatestSnapshot,
  getHistory,
  startPeriodicSnapshots,
  stopPeriodicSnapshots,
  clearHistory,
  // Service
  ApiMetricsService,
  type ApiMetrics,
  // Layers
  ApiMetricsLive,
  ApiMetricsConfigured,
  // Export Formats
  snapshotToPrometheus,
  snapshotToJson,
} from './metrics-export'

// =============================================================================
// Rate Limiting Service
// =============================================================================

export {
  ApiRateLimitersService,
  ApiRateLimitersLive,
  getRateLimiter,
  withRateLimit,
  type ApiRateLimiters,
} from './rate-limiting'

// =============================================================================
// Retry Logic
// =============================================================================

export {
  // Error Predicates
  isTransientError,
  // Retry Schedules
  apiRetrySchedule,
  // Retry Helpers
  withRetry,
  withRetryAndBackoff,
  retryApiCall,
  makeApiRetrySchedule,
} from './retry'

// =============================================================================
// Circuit Breaker
// =============================================================================

export {
  // Error Types
  CircuitOpenError,
  // State Types
  CircuitState,
  initialState,
  // Configuration
  CircuitBreakerConfigs,
  type CircuitBreakerConfig,
  type CircuitBreakerSource,
  // Circuit Breaker Instance
  make as makeCircuitBreaker,
  type CircuitBreaker,
  // Service Layer
  CircuitBreakersService,
  CircuitBreakersLive,
  type CircuitBreakers,
  // Convenience Helpers
  getCircuitBreaker,
  withCircuitBreaker,
  getAllStates,
  resetAll,
  // Error Guards
  shouldTripCircuit,
  // Metrics
  circuitStateTransitions,
  circuitRejections,
  circuitFailureCount,
} from './circuit-breaker'
