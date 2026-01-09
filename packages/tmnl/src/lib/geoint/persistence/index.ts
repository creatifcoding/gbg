// =============================================================================
// GEOINT Persistence - Barrel Export
// =============================================================================

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
