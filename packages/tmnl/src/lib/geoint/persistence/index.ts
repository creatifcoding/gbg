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
