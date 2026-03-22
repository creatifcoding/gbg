/**
 * PoiRepository - Repository for raw.osm_elements (OSM POI cache)
 *
 * Provides CRUD operations for OpenStreetMap elements:
 * - raw.osm_elements: Cache table for OSM POIs with 7-day TTL
 * - Supports spatial queries, tag-based searches, and cache invalidation
 *
 * Uses Effect Schema with TaggedStruct for domain types.
 *
 * @see docker/postgres/init/03-raw-schema.sql
 * @module
 */

import {
  Effect,
  Layer,
  Context,
  Schema,
  Option,
  pipe,
  Array as Arr,
} from 'effect'
import { PgClient } from '@effect/sql-pg'
import type { BBox } from '../../schemas'

// =============================================================================
// Schemas for raw.osm_elements
// =============================================================================

/**
 * OSM element type
 */
export const OsmType = Schema.Literal('node', 'way', 'relation')
export type OsmType = typeof OsmType.Type

/**
 * POI input for insertion/upsert
 */
export const PoiInput = Schema.TaggedStruct('PoiInput', {
  /** OSM ID */
  osmId: Schema.BigInt,
  /** OSM type (node/way/relation) */
  osmType: OsmType,
  /** Raw API response JSONB */
  raw: Schema.Unknown,
  /** GeoJSON geometry (will be converted to PostGIS) */
  geometry: Schema.Unknown, // GeoJSON geometry object
  /** Centroid longitude */
  centroidLon: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  /** Centroid latitude */
  centroidLat: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  /** OSM tags as key-value pairs */
  tags: Schema.Record({ key: Schema.String, value: Schema.String }),
  /** Bounding box used in the query that fetched this element */
  queryBbox: Schema.optionalWith(
    Schema.Tuple(Schema.Number, Schema.Number, Schema.Number, Schema.Number),
    { as: 'Option' }
  ),
  /** Custom TTL in days (default: 7) */
  ttlDays: Schema.optionalWith(Schema.Number, { as: 'Option' }),
})
export type PoiInput = typeof PoiInput.Type

/**
 * POI row from database
 */
export const PoiRow = Schema.TaggedStruct('PoiRow', {
  osm_id: Schema.BigInt,
  osm_type: Schema.String,
  raw: Schema.Unknown,
  /** Geometry as GeoJSON (from ST_AsGeoJSON) */
  geometry_geojson: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Centroid longitude */
  centroid_lon: Schema.NullOr(Schema.Number),
  /** Centroid latitude */
  centroid_lat: Schema.NullOr(Schema.Number),
  /** OSM tags */
  tags: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  /** When fetched from API */
  fetched_at: Schema.DateTimeUtcFromDate,
  /** When cache expires */
  expires_at: Schema.DateTimeUtcFromDate,
  /** Query bounding box as string */
  query_bbox: Schema.NullOr(Schema.String),
  /** Denormalized name from tags */
  name: Schema.NullOr(Schema.String),
  /** Denormalized amenity from tags */
  amenity: Schema.NullOr(Schema.String),
  /** Denormalized shop from tags */
  shop: Schema.NullOr(Schema.String),
  /** Denormalized leisure from tags */
  leisure: Schema.NullOr(Schema.String),
  /** Denormalized tourism from tags */
  tourism: Schema.NullOr(Schema.String),
})
export type PoiRow = typeof PoiRow.Type

/**
 * Simplified POI for search results
 */
export const PoiSearchResult = Schema.TaggedStruct('PoiSearchResult', {
  osm_id: Schema.BigInt,
  osm_type: Schema.String,
  longitude: Schema.Number,
  latitude: Schema.Number,
  name: Schema.NullOr(Schema.String),
  amenity: Schema.NullOr(Schema.String),
  shop: Schema.NullOr(Schema.String),
  leisure: Schema.NullOr(Schema.String),
  tourism: Schema.NullOr(Schema.String),
  tags: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  /** Distance in meters (when using ST_Distance) */
  distance_m: Schema.optionalWith(Schema.Number, { as: 'Option' }),
})
export type PoiSearchResult = typeof PoiSearchResult.Type

// =============================================================================
// Repository Error
// =============================================================================

/**
 * POI repository error
 */
export class PoiRepositoryError extends Schema.TaggedError<PoiRepositoryError>()(
  'PoiRepositoryError',
  {
    operation: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

// =============================================================================
// Repository Interface
// =============================================================================

/**
 * Search options for POIs
 */
export interface PoiSearchOptions {
  /** Bounding box [minLon, minLat, maxLon, maxLat] */
  readonly bounds?: BBox
  /** Filter by amenity type */
  readonly amenity?: string | readonly string[]
  /** Filter by shop type */
  readonly shop?: string | readonly string[]
  /** Filter by leisure type */
  readonly leisure?: string | readonly string[]
  /** Filter by tourism type */
  readonly tourism?: string | readonly string[]
  /** Search by name (ILIKE) */
  readonly namePattern?: string
  /** Only include non-expired entries */
  readonly onlyFresh?: boolean
  /** Maximum results (default: 500) */
  readonly limit?: number
}

/**
 * Options for finding POIs near a point
 */
export interface PoiNearbyOptions {
  /** Center longitude */
  readonly longitude: number
  /** Center latitude */
  readonly latitude: number
  /** Radius in meters (default: 1000) */
  readonly radiusM?: number
  /** Filter by amenity type */
  readonly amenity?: string | readonly string[]
  /** Filter by shop type */
  readonly shop?: string | readonly string[]
  /** Maximum results (default: 50) */
  readonly limit?: number
}

/**
 * POI repository interface
 */
export interface PoiRepository {
  /**
   * Upsert a POI into raw.osm_elements
   */
  readonly upsertPoi: (input: PoiInput) => Effect.Effect<void, PoiRepositoryError>

  /**
   * Upsert multiple POIs (batch)
   */
  readonly upsertPois: (
    inputs: readonly PoiInput[]
  ) => Effect.Effect<number, PoiRepositoryError>

  /**
   * Find POIs by search options
   */
  readonly findPois: (
    options?: PoiSearchOptions
  ) => Effect.Effect<readonly PoiSearchResult[], PoiRepositoryError>

  /**
   * Find POIs near a point (with distance)
   */
  readonly findNearby: (
    options: PoiNearbyOptions
  ) => Effect.Effect<readonly PoiSearchResult[], PoiRepositoryError>

  /**
   * Get a single POI by OSM ID and type
   */
  readonly findPoi: (
    osmId: bigint,
    osmType: OsmType
  ) => Effect.Effect<Option.Option<PoiRow>, PoiRepositoryError>

  /**
   * Check if a POI is stale (expired or near expiration)
   */
  readonly isStale: (
    osmId: bigint,
    osmType: OsmType,
    thresholdMinutes?: number
  ) => Effect.Effect<boolean, PoiRepositoryError>

  /**
   * Delete expired POIs
   */
  readonly cleanupExpired: () => Effect.Effect<number, PoiRepositoryError>

  /**
   * Count POIs matching criteria
   */
  readonly countPois: (
    options?: PoiSearchOptions
  ) => Effect.Effect<number, PoiRepositoryError>

  /**
   * Refresh expiration for POIs in a bounding box
   */
  readonly refreshExpiration: (
    bounds: BBox,
    extendDays?: number
  ) => Effect.Effect<number, PoiRepositoryError>
}

// =============================================================================
// Repository Tag
// =============================================================================

/**
 * POI repository tag for dependency injection
 */
export class PoiRepositoryTag extends Context.Tag('geoint/PoiRepository')<
  PoiRepositoryTag,
  PoiRepository
>() {}

// =============================================================================
// Decode Helpers
// =============================================================================

/**
 * Decode a database row to PoiRow
 */
const decodePoiRow = (row: Record<string, unknown>): PoiRow =>
  Schema.decodeUnknownSync(PoiRow)({ ...row, _tag: 'PoiRow' })

/**
 * Decode a database row to PoiSearchResult
 */
const decodePoiSearchResult = (row: Record<string, unknown>): PoiSearchResult =>
  Schema.decodeUnknownSync(PoiSearchResult)({ ...row, _tag: 'PoiSearchResult' })

// =============================================================================
// Repository Implementation
// =============================================================================

/**
 * Create POI repository from SqlClient
 */
export const makePoiRepository = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  const mapError =
    (operation: string) =>
    (error: unknown): PoiRepositoryError =>
      new PoiRepositoryError({
        operation,
        message: String(error),
        cause: error,
      })

  // ---------------------------------------------------------------------------
  // Upsert Operations
  // ---------------------------------------------------------------------------

  const upsertPoi: PoiRepository['upsertPoi'] = (input) => {
    const ttlDays = Option.getOrElse(input.ttlDays, () => 7)
    const hasCentroid =
      Option.isSome(input.centroidLon) && Option.isSome(input.centroidLat)

    // Build centroid SQL
    const centroidSql = hasCentroid
      ? sql`ST_SetSRID(ST_MakePoint(
          ${Option.getOrNull(input.centroidLon)},
          ${Option.getOrNull(input.centroidLat)}
        ), 4326)`
      : sql`NULL`

    // Build query_bbox SQL
    const queryBboxSql = Option.match(input.queryBbox, {
      onNone: () => sql`NULL`,
      onSome: (bbox) =>
        sql`ST_MakeEnvelope(${bbox[0]}, ${bbox[1]}, ${bbox[2]}, ${bbox[3]}, 4326)::box2d`,
    })

    return pipe(
      sql`
        INSERT INTO raw.osm_elements (
          osm_id, osm_type, raw, geometry, centroid, tags,
          fetched_at, expires_at, query_bbox
        ) VALUES (
          ${input.osmId},
          ${input.osmType},
          ${input.raw}::jsonb,
          ST_GeomFromGeoJSON(${JSON.stringify(input.geometry)}::text),
          ${centroidSql},
          ${input.tags}::jsonb,
          NOW(),
          NOW() + (${ttlDays} || ' days')::interval,
          ${queryBboxSql}
        )
        ON CONFLICT (osm_id, osm_type) DO UPDATE SET
          raw = EXCLUDED.raw,
          geometry = EXCLUDED.geometry,
          centroid = EXCLUDED.centroid,
          tags = EXCLUDED.tags,
          fetched_at = EXCLUDED.fetched_at,
          expires_at = EXCLUDED.expires_at,
          query_bbox = COALESCE(EXCLUDED.query_bbox, raw.osm_elements.query_bbox)
      `,
      Effect.asVoid,
      Effect.mapError(mapError('upsertPoi'))
    )
  }

  const upsertPois: PoiRepository['upsertPois'] = (inputs) => {
    if (inputs.length === 0) return Effect.succeed(0)

    // Use batched upsert for efficiency
    return pipe(
      Effect.forEach(inputs, (input) => upsertPoi(input).pipe(Effect.as(1)), {
        concurrency: 10,
      }),
      Effect.map(Arr.reduce(0, (acc, n) => acc + n)),
      Effect.mapError(mapError('upsertPois'))
    )
  }

  // ---------------------------------------------------------------------------
  // Query Operations
  // ---------------------------------------------------------------------------

  const findPois: PoiRepository['findPois'] = (options = {}) => {
    const limit = options.limit ?? 500
    const onlyFresh = options.onlyFresh ?? true

    // Build filters
    const freshFilter = onlyFresh ? sql`AND expires_at > NOW()` : sql``

    const boundsFilter = options.bounds
      ? sql`AND geometry && ST_MakeEnvelope(
          ${options.bounds[0]}, ${options.bounds[1]},
          ${options.bounds[2]}, ${options.bounds[3]}, 4326
        )`
      : sql``

    const amenityFilter = options.amenity
      ? Array.isArray(options.amenity)
        ? sql`AND amenity = ANY(${options.amenity as unknown as string[]})`
        : sql`AND amenity = ${options.amenity}`
      : sql``

    const shopFilter = options.shop
      ? Array.isArray(options.shop)
        ? sql`AND shop = ANY(${options.shop as unknown as string[]})`
        : sql`AND shop = ${options.shop}`
      : sql``

    const leisureFilter = options.leisure
      ? Array.isArray(options.leisure)
        ? sql`AND leisure = ANY(${options.leisure as unknown as string[]})`
        : sql`AND leisure = ${options.leisure}`
      : sql``

    const tourismFilter = options.tourism
      ? Array.isArray(options.tourism)
        ? sql`AND tourism = ANY(${options.tourism as unknown as string[]})`
        : sql`AND tourism = ${options.tourism}`
      : sql``

    const nameFilter = options.namePattern
      ? sql`AND name ILIKE ${'%' + options.namePattern + '%'}`
      : sql``

    return pipe(
      sql<Record<string, unknown>>`
        SELECT
          osm_id,
          osm_type,
          ST_X(COALESCE(centroid, ST_Centroid(geometry)))::FLOAT AS longitude,
          ST_Y(COALESCE(centroid, ST_Centroid(geometry)))::FLOAT AS latitude,
          name,
          amenity,
          shop,
          leisure,
          tourism,
          tags
        FROM raw.osm_elements
        WHERE TRUE
          ${freshFilter}
          ${boundsFilter}
          ${amenityFilter}
          ${shopFilter}
          ${leisureFilter}
          ${tourismFilter}
          ${nameFilter}
        ORDER BY name NULLS LAST
        LIMIT ${limit}
      `,
      Effect.map((rows) => rows.map(decodePoiSearchResult)),
      Effect.mapError(mapError('findPois'))
    )
  }

  const findNearby: PoiRepository['findNearby'] = (options) => {
    const radiusM = options.radiusM ?? 1000
    const limit = options.limit ?? 50

    const amenityFilter = options.amenity
      ? Array.isArray(options.amenity)
        ? sql`AND amenity = ANY(${options.amenity as unknown as string[]})`
        : sql`AND amenity = ${options.amenity}`
      : sql``

    const shopFilter = options.shop
      ? Array.isArray(options.shop)
        ? sql`AND shop = ANY(${options.shop as unknown as string[]})`
        : sql`AND shop = ${options.shop}`
      : sql``

    const centerPoint = sql`ST_SetSRID(ST_MakePoint(${options.longitude}, ${options.latitude}), 4326)`

    return pipe(
      sql<Record<string, unknown>>`
        SELECT
          osm_id,
          osm_type,
          ST_X(COALESCE(centroid, ST_Centroid(geometry)))::FLOAT AS longitude,
          ST_Y(COALESCE(centroid, ST_Centroid(geometry)))::FLOAT AS latitude,
          name,
          amenity,
          shop,
          leisure,
          tourism,
          tags,
          ST_Distance(
            COALESCE(centroid, ST_Centroid(geometry))::geography,
            ${centerPoint}::geography
          )::FLOAT AS distance_m
        FROM raw.osm_elements
        WHERE expires_at > NOW()
          AND ST_DWithin(
            COALESCE(centroid, ST_Centroid(geometry))::geography,
            ${centerPoint}::geography,
            ${radiusM}
          )
          ${amenityFilter}
          ${shopFilter}
        ORDER BY distance_m
        LIMIT ${limit}
      `,
      Effect.map((rows) =>
        rows.map((row) => ({
          ...decodePoiSearchResult(row),
          distance_m: Option.some(row['distance_m'] as number),
        }))
      ),
      Effect.mapError(mapError('findNearby'))
    )
  }

  const findPoi: PoiRepository['findPoi'] = (osmId, osmType) =>
    pipe(
      sql<Record<string, unknown>>`
        SELECT
          osm_id,
          osm_type,
          raw,
          ST_AsGeoJSON(geometry)::TEXT AS geometry_geojson,
          ST_X(centroid)::FLOAT AS centroid_lon,
          ST_Y(centroid)::FLOAT AS centroid_lat,
          tags,
          fetched_at,
          expires_at,
          query_bbox::TEXT AS query_bbox,
          name,
          amenity,
          shop,
          leisure,
          tourism
        FROM raw.osm_elements
        WHERE osm_id = ${osmId}
          AND osm_type = ${osmType}
      `,
      Effect.map((rows) =>
        rows.length > 0 ? Option.some(decodePoiRow(rows[0])) : Option.none()
      ),
      Effect.mapError(mapError('findPoi'))
    )

  // ---------------------------------------------------------------------------
  // Cache Management
  // ---------------------------------------------------------------------------

  const isStale: PoiRepository['isStale'] = (
    osmId,
    osmType,
    thresholdMinutes = 60
  ) =>
    pipe(
      sql<{ is_stale: boolean }>`
        SELECT
          COALESCE(
            (
              SELECT expires_at < NOW() + (${thresholdMinutes} || ' minutes')::interval
              FROM raw.osm_elements
              WHERE osm_id = ${osmId} AND osm_type = ${osmType}
            ),
            TRUE
          ) AS is_stale
      `,
      Effect.map((rows) => rows[0]?.is_stale ?? true),
      Effect.mapError(mapError('isStale'))
    )

  const cleanupExpired: PoiRepository['cleanupExpired'] = () =>
    pipe(
      sql<{ count: string }>`
        WITH deleted AS (
          DELETE FROM raw.osm_elements
          WHERE expires_at < NOW()
          RETURNING osm_id
        )
        SELECT COUNT(*)::TEXT as count FROM deleted
      `,
      Effect.map((rows) => parseInt(rows[0]?.count ?? '0', 10)),
      Effect.mapError(mapError('cleanupExpired'))
    )

  const countPois: PoiRepository['countPois'] = (options = {}) => {
    const onlyFresh = options.onlyFresh ?? true

    const freshFilter = onlyFresh ? sql`AND expires_at > NOW()` : sql``

    const boundsFilter = options.bounds
      ? sql`AND geometry && ST_MakeEnvelope(
          ${options.bounds[0]}, ${options.bounds[1]},
          ${options.bounds[2]}, ${options.bounds[3]}, 4326
        )`
      : sql``

    const amenityFilter = options.amenity
      ? Array.isArray(options.amenity)
        ? sql`AND amenity = ANY(${options.amenity as unknown as string[]})`
        : sql`AND amenity = ${options.amenity}`
      : sql``

    return pipe(
      sql<{ count: string }>`
        SELECT COUNT(*)::TEXT as count
        FROM raw.osm_elements
        WHERE TRUE
          ${freshFilter}
          ${boundsFilter}
          ${amenityFilter}
      `,
      Effect.map((rows) => parseInt(rows[0]?.count ?? '0', 10)),
      Effect.mapError(mapError('countPois'))
    )
  }

  const refreshExpiration: PoiRepository['refreshExpiration'] = (
    bounds,
    extendDays = 7
  ) =>
    pipe(
      sql<{ count: string }>`
        WITH updated AS (
          UPDATE raw.osm_elements
          SET expires_at = NOW() + (${extendDays} || ' days')::interval
          WHERE geometry && ST_MakeEnvelope(
            ${bounds[0]}, ${bounds[1]},
            ${bounds[2]}, ${bounds[3]}, 4326
          )
          RETURNING osm_id
        )
        SELECT COUNT(*)::TEXT as count FROM updated
      `,
      Effect.map((rows) => parseInt(rows[0]?.count ?? '0', 10)),
      Effect.mapError(mapError('refreshExpiration'))
    )

  // ---------------------------------------------------------------------------
  // Return Repository
  // ---------------------------------------------------------------------------

  return {
    upsertPoi,
    upsertPois,
    findPois,
    findNearby,
    findPoi,
    isStale,
    cleanupExpired,
    countPois,
    refreshExpiration,
  } satisfies PoiRepository
})

// =============================================================================
// Layer
// =============================================================================

/**
 * POI repository layer
 */
export const PoiRepositoryLive = Layer.effect(PoiRepositoryTag, makePoiRepository)
