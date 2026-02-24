// =============================================================================
// GEOINT Persistence - Barrel Export
// =============================================================================

// Flight Entity Materializer - DurableStream → ECS entities
export {
  FlightEntityMaterializer,
  FlightEntityMaterializerLive,
  FlightEntityMaterializerFullLive,
  FlightEntityMaterializerConfigTag,
  FlightEntityMaterializerConfigDefault,
  type FlightEntityMaterializerConfig,
  type FlightEntityMaterializerShape,
} from './FlightEntityMaterializer'

// OSM Entity Materializer - DurableStream → ECS entities (POIs)
export {
  OsmEntityMaterializer,
  OsmEntityMaterializerLive,
  OsmEntityMaterializerFullLive,
  OsmEntityMaterializerConfigTag,
  OsmEntityMaterializerConfigDefault,
  type OsmEntityMaterializerConfig,
  type OsmEntityMaterializerShape,
} from './OsmEntityMaterializer'

// Weather Entity Materializer - DurableStream → ECS entities (weather observations)
export {
  WeatherEntityMaterializer,
  WeatherEntityMaterializerLive,
  WeatherEntityMaterializerFullLive,
  WeatherEntityMaterializerConfigTag,
  WeatherEntityMaterializerConfigDefault,
  type WeatherEntityMaterializerConfig,
  type WeatherEntityMaterializerShape,
} from './WeatherEntityMaterializer'

export {
  TrackStore,
  TrackStoreError,
  TrackStoreLive,
  TrackStoreConfigured,
  TrackStoreDev,
  TrackStoreConfigTag,
  type TrackStoreConfig,
} from './TrackStore'

// PostGIS Client
export {
  // GeoJSON Schemas
  GeoJSONPoint,
  GeoJSONPoint3D,
  GeoJSONLineString,
  GeoJSONPolygon,
  GeoJSONGeometry,
  // Config
  DEFAULT_POSTGIS_CONFIG,
  type PostGISConfig,
  // Client Layers
  makePostGISClient,
  PostGISClientLive,
  // Spatial Query Builder
  spatialQuery,
  type SpatialQueryBuilder,
  // Service
  PostGISError,
  PostGISServiceTag,
  makePostGISService,
  PostGISServiceLive,
  type PostGISService,
  // Health Check
  checkDatabaseHealth,
  type DatabaseHealthStatus,
} from './postgis/PostGISClient'

// PostGIS Schemas - Effect Model definitions for database persistence
// NOTE: Model classes (TrackPosition, Feature, SavedSearch) are NOT exported
// to avoid conflicts with domain types in geoint/schemas. Use repositories instead.
export {
  // Row IDs (for reference/typing)
  TrackPositionRowId,
  FeatureRowId,
  SavedSearchRowId,
  // Geometry Types (PostGIS-specific)
  GeometryPoint,
  GeometryLineString,
  GeometryPolygon,
  FeatureGeometry,
  StoredGeoFilter,
  // Migration SQL (for database setup)
  MIGRATION_SQL,
  VERIFY_POSTGIS_SQL,
} from './postgis/schemas'

// Re-export Model classes with Db prefix to avoid conflicts
export {
  TrackPosition as DbTrackPosition,
  Feature as DbFeature,
  SavedSearch as DbSavedSearch,
} from './postgis/schemas'

// PostGIS Repositories - CRUD with spatial queries
export {
  // Error
  RepositoryError,
  // Track Position Repository
  type InsertTrackPositionInput,
  type TrackPositionSearchOptions,
  type TrackPositionRepository,
  TrackPositionRepositoryTag,
  makeTrackPositionRepository,
  TrackPositionRepositoryLive,
  // Feature Repository
  type InsertFeatureInput,
  type FeatureSearchOptions,
  type FeatureRepository,
  FeatureRepositoryTag,
  makeFeatureRepository,
  FeatureRepositoryLive,
  // Migration
  runMigrations,
} from './postgis/repositories'

// Flight Repository - raw.flight_positions and entity.flights_current
export {
  // Types
  type FlightPositionInput,
  type FlightPositionRow,
  type CurrentFlight,
  type FlightTrackSummary,
  type CurrentFlightSearchOptions,
  type FlightPositionSearchOptions,
  type IngestionHealthRow,
  // Error
  FlightRepositoryError,
  // Repository
  type FlightRepository,
  FlightRepositoryTag,
  makeFlightRepository,
  FlightRepositoryLive,
} from './postgis/FlightRepository'

// POI Repository - raw.osm_elements (OSM cache)
export {
  // Types
  OsmType,
  type PoiInput,
  type PoiRow,
  type PoiSearchResult,
  type PoiSearchOptions,
  type PoiNearbyOptions,
  // Error
  PoiRepositoryError,
  // Repository
  type PoiRepository,
  PoiRepositoryTag,
  makePoiRepository,
  PoiRepositoryLive,
} from './postgis/PoiRepository'

// Weather Repository - raw.weather_observations
export {
  // Types
  type WeatherObservationInput,
  type WeatherObservationRow,
  type WeatherSearchResult,
  type CurrentWeather,
  type WeatherSearchOptions,
  type WeatherNearbyOptions,
  // Error
  WeatherRepositoryError,
  // Repository
  type WeatherRepository,
  WeatherRepositoryTag,
  makeWeatherRepository,
  WeatherRepositoryLive,
  // Utility
  makeLocationId,
} from './postgis/WeatherRepository'

// Imagery Repository - raw.imagery_items
export {
  // Types
  ImageryProvider,
  type ImageryItemInput,
  type ImageryItemRow,
  type ImagerySearchResult as ImagerySearchResultRow,
  type ImagerySearchOptions,
  type ImageryNearbyOptions,
  // Error
  ImageryRepositoryError,
  // Repository
  type ImageryRepository,
  ImageryRepositoryTag,
  makeImageryRepository,
  ImageryRepositoryLive,
} from './postgis/ImageryRepository'

// GEOINT Registry Source Repository - geoint_registry read model
export {
  RegistrySourceRepositoryError,
  RegistryTaxonomyRow,
  type RegistryTaxonomyRow as RegistryTaxonomyRowType,
  RegistrySourceRow,
  type RegistrySourceRow as RegistrySourceRowType,
  RegistryAliasRow,
  type RegistryAliasRow as RegistryAliasRowType,
  buildSourceRegistryEntries,
  type RegistrySourceRepository,
  RegistrySourceRepositoryTag,
  makeRegistrySourceRepository,
  RegistrySourceRepositoryLive,
} from './postgis/RegistrySourceRepository'

// GEOINT Repository Facade - Unified access to all domain repositories
export {
  // Error
  GeointRepositoryError,
  // Types
  type UnifiedSearchOptions,
  type UnifiedSearchResult,
  type RepositoryHealth,
  // Repository
  type GeointRepository,
  GeointRepositoryTag,
  makeGeointRepository,
  GeointRepositoryLive,
  // Combined Layer
  AllRepositoriesLive,
} from './postgis/GeointRepository'

// PostGIS Materializer - Event Stream to PostGIS Bridge
export {
  // Event Schemas
  TrackPositionEvent,
  FeatureUpsertEvent,
  FeatureDeleteEvent,
  MaterializableEvent,
  // Config
  type MaterializerStreamConfig,
  type MaterializerConfig,
  MaterializerConfigTag,
  // Error
  MaterializerError,
  // Service
  type PostGISMaterializerShape,
  PostGISMaterializer,
  PostGISMaterializerLive,
  PostGISMaterializerConfigured,
} from './postgis/materializer'
