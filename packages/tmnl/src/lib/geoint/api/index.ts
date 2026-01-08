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
