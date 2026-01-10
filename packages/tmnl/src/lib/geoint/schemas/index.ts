// =============================================================================
// GEOINT Schemas - Barrel Export
// =============================================================================

// Core types and primitives
export {
  // Branded IDs
  TrackId,
  FeatureId,
  LayerId,
  // Primitives
  Position,
  Position3D,
  BBox,
  // Enums
  Classification,
  ObjectType,
  SensorType,
  LayerType,
  // Colors
  RGBColor,
  RGBAColor,
  classificationColors
} from './core'
export type {
  TrackId as TrackIdType,
  FeatureId as FeatureIdType,
  LayerId as LayerIdType,
  Position as PositionType,
  Position3D as Position3DType,
  BBox as BBoxType,
  Classification as ClassificationType,
  ObjectType as ObjectTypeEnum,
  SensorType as SensorTypeEnum,
  LayerType as LayerTypeEnum,
  RGBColor as RGBColorType,
  RGBAColor as RGBAColorType
} from './core'

// Track schemas (TaggedClass)
export {
  TrackPosition,
  TrackMetadata,
  Track,
  TrackPositionUpdate,
  TrackClassificationUpdate,
  TrackQuery,
  TrackEvent
} from './tracks'
export type { TrackQuery as TrackQueryType, TrackEvent as TrackEventType } from './tracks'

// Feature schemas (TaggedClass)
export {
  // Geometries
  PointGeometry,
  LineStringGeometry,
  PolygonGeometry,
  Geometry,
  // Features
  FeatureProperties,
  Feature,
  GeoJsonFeature,
  FeatureCollection,
  // Layers
  Layer,
  LayerToggle,
  LayerOpacityChange,
  LayerEvent,
  // Queries
  FeatureQuery,
  FeatureQueryResponse
} from './features'
export type {
  PointGeometry as PointGeometryType,
  LineStringGeometry as LineStringGeometryType,
  PolygonGeometry as PolygonGeometryType,
  Geometry as GeometryType,
  FeatureProperties as FeaturePropertiesType,
  GeoJsonFeature as GeoJsonFeatureType,
  FeatureCollection as FeatureCollectionType,
  LayerEvent as LayerEventType,
  FeatureQuery as FeatureQueryType
} from './features'

// Analysis schemas (TaggedClass)
export {
  // Spatial operations
  BufferParams,
  SpatialOperation,
  SpatialAnalysisRequest,
  // Distance & proximity
  DistanceResult,
  ProximityQuery,
  // Tiles
  TileId,
  TileRequest,
  TileData,
  // Imagery
  ImageryMetadata,
  ImageryChunk,
  ImageryRequest,
  // Threat
  ThreatLevel,
  ThreatVolume
} from './analysis'
export type {
  SpatialOperation as SpatialOperationType,
  ThreatLevel as ThreatLevelType
} from './analysis'

// Search schemas (TaggedClass) - ALLINT COP Search System
export {
  // Branded IDs
  SearchId,
  SearchResultId,
  PoiId,
  Icao24,
  // Source & Category Enums
  IntelSource,
  PoiCategory,
  AircraftCategory,
  // Geographic Filters
  GeoFilterBounds,
  GeoFilterRadius,
  GeoFilterPolygon,
  GeoFilter,
  // Temporal Filters
  TemporalFilterRange,
  TemporalFilterRelative,
  TemporalFilter,
  // Source-Specific Filters
  TrackFilter,
  OsmFilter,
  FlightFilter,
  FeatureFilter,
  SourceFilter,
  // Search Query
  SearchQuery,
  // Search Results
  SearchResultTrack,
  SearchResultPoi,
  SearchResultFlight,
  SearchResultFeature,
  SearchResultWeather,
  SearchResultImagery,
  SearchResultItem,
  SearchResponse,
  // Streaming Events
  SearchStarted,
  SearchPartialResults,
  SearchSourceComplete,
  SearchSourceError,
  SearchCompleted,
  SearchEvent,
  // External API Schemas
  OpenSkyStateVector,
  OpenSkyResponse,
  OverpassElement,
  OverpassResponse,
  // ADSB.lol API (wire format + domain + transform)
  AdsbLolAircraftFromApi,
  AdsbLolAircraft,
  AdsbLolAircraftSchema,
  AdsbLolResponseFromApi,
  AdsbLolResponse,
  AdsbLolResponseSchema,
  // Planet Labs Data API (wire format + domain + transform)
  PlanetItemType,
  PlanetAssetType,
  PlanetFilterFromApi,
  PlanetItemPropertiesFromApi,
  PlanetItemFromApi,
  PlanetSearchResponseFromApi,
  PlanetItem,
  PlanetItemSchema,
  PlanetSearchResponse,
  PlanetSearchResponseSchema,
  // Sentinel Hub API (wire format + domain + transform)
  SentinelCollection,
  SentinelItemPropertiesFromApi,
  SentinelItemFromApi,
  SentinelSearchResponseFromApi,
  SentinelItem,
  SentinelItemSchema,
  SentinelSearchResponse,
  SentinelSearchResponseSchema,
  // Open-Meteo Weather API (wire format + domain + transform)
  WmoWeatherCode,
  CurrentWeatherFromApi,
  HourlyWeatherFromApi,
  DailyWeatherFromApi,
  OpenMeteoForecastFromApi,
  GeocodingResultFromApi,
  OpenMeteoGeocodingFromApi,
  CurrentWeather,
  HourlyForecast,
  DailyForecast,
  WeatherForecast,
  GeocodingLocation,
  GeocodingResponse,
  CurrentWeatherSchema,
  WeatherForecastSchema,
  GeocodingResponseSchema,
  // Saved Searches
  SavedSearch,
  SearchHistoryEntry
} from './search'
export type {
  SearchId as SearchIdType,
  SearchResultId as SearchResultIdType,
  PoiId as PoiIdType,
  Icao24 as Icao24Type,
  IntelSource as IntelSourceEnum,
  PoiCategory as PoiCategoryEnum,
  AircraftCategory as AircraftCategoryEnum,
  GeoFilter as GeoFilterType,
  TemporalFilter as TemporalFilterType,
  SourceFilter as SourceFilterType,
  SearchResultItem as SearchResultItemType,
  SearchEvent as SearchEventType
} from './search'

// Error schemas (TaggedError pattern) - Typed error handling
export {
  // Category enum
  SearchErrorCategory,
  isRecoverable,
  // Error classes
  SearchNetworkError,
  SearchTimeoutError,
  SearchRateLimitError,
  SearchServerError,
  SearchValidationError,
  SearchNotFoundError,
  SearchAuthError,
  SearchUnknownError,
  // Serializable data
  SearchErrorData,
  // Utilities
  toSearchErrorData,
  parseError,
  createErrorState,
  incrementRetry,
} from './errors'
export type {
  SearchErrorCategory as SearchErrorCategoryType,
  SearchError,
  SearchErrorState,
} from './errors'

// Ingestion schemas (TaggedRequest + TaggedError pattern) - Background data polling
export {
  // Ingester name
  IngesterNameSchema,
  // Error category enum
  IngestionErrorCategory,
  // Error classes
  IngestionNotConfiguredError,
  IngestionAlreadyRunningError,
  IngestionNotRunningError,
  IngestionStartError,
  IngestionStopError,
  IngesterNotFoundError,
  IngestionUnknownError,
  // Tagged requests
  StartIngestionRequest,
  StopIngestionRequest,
  GetIngestionStatusRequest,
  StartIngesterRequest,
  StopIngesterRequest,
  // Response schemas
  IngesterStatusSchema,
  OrchestratorStatusSchema,
  // Utilities
  parseIngestionError,
  notConfiguredStatus,
  ingesterNotFoundStatus,
} from './ingestion'
export type {
  IngesterName,
  IngestionErrorCategory as IngestionErrorCategoryType,
  IngestionError,
  IngesterStatus,
  OrchestratorStatus,
} from './ingestion'
