/**
 * PostGIS Table Schemas - Effect SQL Model Definitions
 *
 * Defines table schemas for ALLINT COP persistence:
 * - TrackPosition: Individual track positions with geometry
 * - Feature: Vector features with geometry
 * - SavedSearch: Persisted search queries
 *
 * Uses Effect Model.Class for schema-driven table definitions.
 *
 * @see beads:tmnl-fb8kt GEOINT Layering System Epic
 * @module
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import {
  TrackId,
  FeatureId,
  SearchId,
  IntelSource,
  Classification,
  Position,
  BBox,
} from '../../schemas'
import type { Position3D } from '../../schemas'

// =============================================================================
// Branded IDs for Table Primary Keys
// =============================================================================

/**
 * Track Position row ID (auto-generated)
 */
export const TrackPositionRowId = Schema.BigInt.pipe(Schema.brand('TrackPositionRowId'))
export type TrackPositionRowId = typeof TrackPositionRowId.Type

/**
 * Feature row ID (auto-generated)
 */
export const FeatureRowId = Schema.BigInt.pipe(Schema.brand('FeatureRowId'))
export type FeatureRowId = typeof FeatureRowId.Type

/**
 * Saved Search row ID (auto-generated)
 */
export const SavedSearchRowId = Schema.BigInt.pipe(Schema.brand('SavedSearchRowId'))
export type SavedSearchRowId = typeof SavedSearchRowId.Type

// =============================================================================
// Track Position Table
// =============================================================================

/**
 * PostGIS geometry point representation (from ST_AsGeoJSON)
 */
export const GeometryPoint = Schema.Struct({
  type: Schema.Literal('Point'),
  coordinates: Schema.Union(
    Schema.Tuple(Schema.Number, Schema.Number),
    Schema.Tuple(Schema.Number, Schema.Number, Schema.Number)
  ),
})
export type GeometryPoint = typeof GeometryPoint.Type

/**
 * Track Position table schema
 *
 * Stores individual position updates for tracks with PostGIS geometry.
 * Each row is a point-in-time position for a track entity.
 *
 * Table: track_positions
 * Primary Key: id (bigserial)
 * Indexes:
 *   - track_positions_track_id_idx ON track_id
 *   - track_positions_geom_idx ON geom USING GIST
 *   - track_positions_timestamp_idx ON timestamp
 *   - track_positions_track_time_idx ON (track_id, timestamp DESC)
 */
export class TrackPosition extends Model.Class<TrackPosition>('TrackPosition')({
  // Auto-generated primary key
  id: Model.Generated(TrackPositionRowId),

  // Foreign key to track entity
  track_id: TrackId,

  // Position as lon/lat/alt
  longitude: Schema.Number,
  latitude: Schema.Number,
  altitude: Schema.optionalWith(Schema.Number, { nullable: true }),

  // Heading in degrees (0-360)
  heading: Schema.optionalWith(Schema.Number, { nullable: true }),

  // Speed in m/s
  speed: Schema.optionalWith(Schema.Number, { nullable: true }),

  // Classification for COP visualization
  classification: Schema.optionalWith(Classification, { nullable: true }),

  // Source intel type
  source: Schema.optionalWith(IntelSource, { nullable: true }),

  // Event timestamp
  timestamp: Schema.Date,

  // PostGIS geometry (populated by trigger or computed column)
  // Read via ST_AsGeoJSON(geom) -> parsed as GeometryPoint
  geom: Schema.optionalWith(GeometryPoint, { nullable: true }),

  // Metadata timestamps - using snake_case to match DB column names
  created_at: Model.DateTimeInsertFromDate,
}) {
  /**
   * Convert to [lon, lat] position tuple
   */
  toPosition(): Position {
    return [this.longitude, this.latitude]
  }

  /**
   * Convert to [lon, lat, alt] position tuple (if altitude present)
   */
  toPosition3D(): Position3D | null {
    if (this.altitude === null || this.altitude === undefined) return null
    return [this.longitude, this.latitude, this.altitude]
  }
}

// =============================================================================
// Feature Table
// =============================================================================

/**
 * PostGIS geometry types for features
 */
export const GeometryLineString = Schema.Struct({
  type: Schema.Literal('LineString'),
  coordinates: Schema.Array(Schema.Tuple(Schema.Number, Schema.Number)),
})

export const GeometryPolygon = Schema.Struct({
  type: Schema.Literal('Polygon'),
  coordinates: Schema.Array(Schema.Array(Schema.Tuple(Schema.Number, Schema.Number))),
})

export const FeatureGeometry = Schema.Union(
  GeometryPoint,
  GeometryLineString,
  GeometryPolygon
)
export type FeatureGeometry = typeof FeatureGeometry.Type

/**
 * Feature table schema
 *
 * Stores vector features (points, lines, polygons) with PostGIS geometry.
 * Supports GeoJSON properties as JSONB.
 *
 * Table: features
 * Primary Key: id (bigserial)
 * Indexes:
 *   - features_feature_id_idx ON feature_id (UNIQUE)
 *   - features_geom_idx ON geom USING GIST
 *   - features_layer_idx ON layer
 *   - features_source_idx ON source
 */
export class Feature extends Model.Class<Feature>('Feature')({
  // Auto-generated primary key
  id: Model.Generated(FeatureRowId),

  // Unique feature ID (from external source or generated)
  feature_id: FeatureId,

  // Display name
  name: Schema.optionalWith(Schema.String, { nullable: true }),

  // Feature type (e.g., 'building', 'road', 'boundary')
  feature_type: Schema.optionalWith(Schema.String, { nullable: true }),

  // Layer for grouping (e.g., 'infrastructure', 'terrain')
  layer: Schema.optionalWith(Schema.String, { nullable: true }),

  // Source intel type
  source: Schema.optionalWith(IntelSource, { nullable: true }),

  // GeoJSON properties as JSONB
  properties: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), { nullable: true }),

  // PostGIS geometry (read via ST_AsGeoJSON)
  geom: Schema.optionalWith(FeatureGeometry, { nullable: true }),

  // Bounding box for fast filtering (stored as BOX2D)
  // Format: 'BOX(minX minY, maxX maxY)'
  bbox: Schema.optionalWith(Schema.String, { nullable: true }),

  // Metadata timestamps - using snake_case to match DB column names
  created_at: Model.DateTimeInsertFromDate,
  updated_at: Model.DateTimeUpdateFromDate,
}) {}

// =============================================================================
// Saved Search Table
// =============================================================================

/**
 * Geographic filter stored as JSONB
 */
export const StoredGeoFilter = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('bounds'),
    bounds: BBox,
  }),
  Schema.Struct({
    _tag: Schema.Literal('radius'),
    center: Position,
    radiusMeters: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('polygon'),
    coordinates: Schema.Array(Position),
  })
)
export type StoredGeoFilter = typeof StoredGeoFilter.Type

/**
 * Saved Search table schema
 *
 * Persists user-saved search queries for reuse.
 *
 * Table: saved_searches
 * Primary Key: id (bigserial)
 * Indexes:
 *   - saved_searches_search_id_idx ON search_id (UNIQUE)
 *   - saved_searches_user_id_idx ON user_id
 *   - saved_searches_last_used_idx ON last_used_at
 */
export class SavedSearch extends Model.Class<SavedSearch>('SavedSearch')({
  // Auto-generated primary key
  id: Model.Generated(SavedSearchRowId),

  // Unique search ID
  search_id: SearchId,

  // User-provided name
  name: Schema.NonEmptyTrimmedString,

  // User ID (for multi-tenant)
  user_id: Schema.optionalWith(Schema.String, { nullable: true }),

  // Free-text query terms
  text_query: Schema.optionalWith(Schema.String, { nullable: true }),

  // Geographic filter as JSONB
  geo_filter: Schema.optionalWith(StoredGeoFilter, { nullable: true }),

  // Sources to query
  sources: Schema.Array(IntelSource),

  // Limit per source
  limit_per_source: Schema.optionalWith(Schema.Number, { nullable: true }),

  // Usage tracking
  use_count: Schema.Number,

  // Timestamps - using snake_case to match DB column names
  created_at: Model.DateTimeInsertFromDate,
  last_used_at: Model.DateTimeUpdateFromDate,
}) {}

// =============================================================================
// SQL Migration Scripts
// =============================================================================

/**
 * SQL migration to create PostGIS tables
 *
 * Run this in PostgreSQL with PostGIS extension enabled.
 */
export const MIGRATION_SQL = `
-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Track Positions table
CREATE TABLE IF NOT EXISTS track_positions (
  id BIGSERIAL PRIMARY KEY,
  track_id VARCHAR(64) NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  altitude DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  classification VARCHAR(32),
  source VARCHAR(32),
  timestamp TIMESTAMPTZ NOT NULL,
  geom GEOMETRY(POINTZ, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-populate geom from lon/lat/alt
CREATE OR REPLACE FUNCTION track_positions_update_geom()
RETURNS TRIGGER AS $$
BEGIN
  NEW.geom := ST_SetSRID(
    ST_MakePoint(NEW.longitude, NEW.latitude, COALESCE(NEW.altitude, 0)),
    4326
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS track_positions_geom_trigger ON track_positions;
CREATE TRIGGER track_positions_geom_trigger
  BEFORE INSERT OR UPDATE ON track_positions
  FOR EACH ROW EXECUTE FUNCTION track_positions_update_geom();

-- Track Positions indexes
CREATE INDEX IF NOT EXISTS track_positions_track_id_idx ON track_positions(track_id);
CREATE INDEX IF NOT EXISTS track_positions_geom_idx ON track_positions USING GIST(geom);
CREATE INDEX IF NOT EXISTS track_positions_timestamp_idx ON track_positions(timestamp);
CREATE INDEX IF NOT EXISTS track_positions_track_time_idx ON track_positions(track_id, timestamp DESC);

-- Features table
CREATE TABLE IF NOT EXISTS features (
  id BIGSERIAL PRIMARY KEY,
  feature_id VARCHAR(128) NOT NULL UNIQUE,
  name TEXT,
  feature_type VARCHAR(64),
  layer VARCHAR(64),
  source VARCHAR(32),
  properties JSONB,
  geom GEOMETRY(GEOMETRY, 4326),
  bbox BOX2D,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update bbox from geom
CREATE OR REPLACE FUNCTION features_update_bbox()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.geom IS NOT NULL THEN
    NEW.bbox := Box2D(NEW.geom);
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS features_bbox_trigger ON features;
CREATE TRIGGER features_bbox_trigger
  BEFORE INSERT OR UPDATE ON features
  FOR EACH ROW EXECUTE FUNCTION features_update_bbox();

-- Features indexes
CREATE INDEX IF NOT EXISTS features_geom_idx ON features USING GIST(geom);
CREATE INDEX IF NOT EXISTS features_layer_idx ON features(layer);
CREATE INDEX IF NOT EXISTS features_source_idx ON features(source);
CREATE INDEX IF NOT EXISTS features_feature_type_idx ON features(feature_type);

-- Saved Searches table
CREATE TABLE IF NOT EXISTS saved_searches (
  id BIGSERIAL PRIMARY KEY,
  search_id VARCHAR(64) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  user_id VARCHAR(128),
  text_query TEXT,
  geo_filter JSONB,
  sources JSONB NOT NULL DEFAULT '[]',
  limit_per_source INTEGER,
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Saved Searches indexes
CREATE INDEX IF NOT EXISTS saved_searches_user_id_idx ON saved_searches(user_id);
CREATE INDEX IF NOT EXISTS saved_searches_last_used_idx ON saved_searches(last_used_at);
`

/**
 * SQL to verify PostGIS installation
 */
export const VERIFY_POSTGIS_SQL = `
SELECT PostGIS_Version() as version, PostGIS_Full_Version() as full_version;
`
