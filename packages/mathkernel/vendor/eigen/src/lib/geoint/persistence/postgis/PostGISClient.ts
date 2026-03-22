/**
 * PostGIS Client - Effect SQL layer with PostGIS extensions
 *
 * Provides:
 * - PgClient configuration with PostGIS geometry type parsers
 * - Spatial query helpers (ST_Within, ST_DWithin, ST_Intersects, ST_MakeEnvelope)
 * - Schema-based result mapping for geometry types
 * - GeoJSON serialization/deserialization
 *
 * @see beads:tmnl-94cyl PostGIS Persistence Layer
 * @module
 */

import {
  Effect,
  Layer,
  Context,
  Schema,
  Config,
  Option,
  pipe,
  Redacted,
} from 'effect'
import { PgClient } from '@effect/sql-pg'
import { BBox, Position, Position3D } from '../../schemas'

// =============================================================================
// PostGIS Type OIDs (standard PostgreSQL OIDs for PostGIS types)
// =============================================================================

/**
 * PostGIS geometry type OID
 * Note: The actual OID may vary by PostgreSQL installation
 * Use `SELECT oid FROM pg_type WHERE typname = 'geometry'` to verify
 */
const GEOMETRY_OID = 16391

/**
 * PostGIS geography type OID
 */
const GEOGRAPHY_OID = 16402

// =============================================================================
// GeoJSON Types (following RFC 7946)
// =============================================================================

/**
 * GeoJSON Point schema
 */
export const GeoJSONPoint = Schema.Struct({
  type: Schema.Literal('Point'),
  coordinates: Schema.Tuple(Schema.Number, Schema.Number),
})
export type GeoJSONPoint = typeof GeoJSONPoint.Type

/**
 * GeoJSON Point 3D schema
 */
export const GeoJSONPoint3D = Schema.Struct({
  type: Schema.Literal('Point'),
  coordinates: Schema.Tuple(Schema.Number, Schema.Number, Schema.Number),
})
export type GeoJSONPoint3D = typeof GeoJSONPoint3D.Type

/**
 * GeoJSON LineString schema
 */
export const GeoJSONLineString = Schema.Struct({
  type: Schema.Literal('LineString'),
  coordinates: Schema.Array(Schema.Tuple(Schema.Number, Schema.Number)),
})
export type GeoJSONLineString = typeof GeoJSONLineString.Type

/**
 * GeoJSON Polygon schema
 */
export const GeoJSONPolygon = Schema.Struct({
  type: Schema.Literal('Polygon'),
  coordinates: Schema.Array(Schema.Array(Schema.Tuple(Schema.Number, Schema.Number))),
})
export type GeoJSONPolygon = typeof GeoJSONPolygon.Type

/**
 * GeoJSON Geometry union
 */
export const GeoJSONGeometry = Schema.Union(
  GeoJSONPoint,
  GeoJSONLineString,
  GeoJSONPolygon
)
export type GeoJSONGeometry = typeof GeoJSONGeometry.Type

// =============================================================================
// PostGIS Client Configuration
// =============================================================================

/**
 * PostGIS client configuration
 */
export interface PostGISConfig {
  readonly host: string
  readonly port: number
  readonly database: string
  readonly username: string
  readonly password: string
  readonly ssl?: boolean
  readonly poolSize?: number
}

/**
 * Default PostGIS configuration (for development)
 * @see docker/docker-compose.yml postgres service
 */
export const DEFAULT_POSTGIS_CONFIG: PostGISConfig = {
  host: 'localhost',
  port: 5432,
  database: 'tmnl',
  username: 'tmnl',
  password: 'tmnl_dev_password',
  ssl: false,
  poolSize: 10,
}

/**
 * Parse GeoJSON string from PostGIS ST_AsGeoJSON output
 */
const parseGeoJSON = (value: string): GeoJSONGeometry | null => {
  try {
    const parsed = JSON.parse(value)
    // Validate it has the required GeoJSON structure
    if (parsed && typeof parsed === 'object' && 'type' in parsed && 'coordinates' in parsed) {
      return parsed as GeoJSONGeometry
    }
    return null
  } catch {
    return null
  }
}

/**
 * Create PostGIS client layer with custom geometry type parsers
 */
export const makePostGISClient = (
  config: PostGISConfig = DEFAULT_POSTGIS_CONFIG
) =>
  PgClient.layer({
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: Redacted.make(config.password),
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    maxConnections: config.poolSize,
    // Custom type parsers for PostGIS geometry types
    types: {
      getTypeParser: (oid: number) => {
        // Parse geometry as GeoJSON string (requires ST_AsGeoJSON in query)
        if (oid === GEOMETRY_OID || oid === GEOGRAPHY_OID) {
          return (value: string) => parseGeoJSON(value)
        }
        return undefined
      },
    },
  })

/**
 * PostGIS client layer from environment configuration
 *
 * Environment variables (with defaults matching docker-compose.yml):
 * - POSTGRES_HOST (default: localhost)
 * - POSTGRES_PORT (default: 5432)
 * - POSTGRES_DB (default: tmnl)
 * - POSTGRES_USER (default: tmnl)
 * - POSTGRES_PASSWORD (default: tmnl_dev_password)
 * - POSTGRES_SSL (default: false)
 * - POSTGRES_POOL_SIZE (default: 10)
 */
export const PostGISClientLive = PgClient.layerConfig({
  host: Config.string('POSTGRES_HOST').pipe(Config.withDefault('localhost')),
  port: Config.number('POSTGRES_PORT').pipe(Config.withDefault(5432)),
  database: Config.string('POSTGRES_DB').pipe(Config.withDefault('tmnl')),
  username: Config.string('POSTGRES_USER').pipe(Config.withDefault('tmnl')),
  password: Config.redacted('POSTGRES_PASSWORD').pipe(
    Config.withDefault(Redacted.make('tmnl_dev_password'))
  ),
  ssl: Config.boolean('POSTGRES_SSL').pipe(Config.withDefault(false)),
  maxConnections: Config.number('POSTGRES_POOL_SIZE').pipe(Config.withDefault(10)),
})

// =============================================================================
// Spatial Query Helpers
// =============================================================================

/**
 * Spatial query builder interface
 */
export interface SpatialQueryBuilder {
  /**
   * Build ST_MakeEnvelope for bounding box queries
   * @param bbox [minLon, minLat, maxLon, maxLat]
   * @param srid SRID (default 4326 for WGS84)
   */
  readonly makeEnvelope: (bbox: BBox, srid?: number) => string

  /**
   * Build ST_MakePoint for point insertion
   * @param position [lon, lat] or [lon, lat, altitude]
   * @param srid SRID (default 4326 for WGS84)
   */
  readonly makePoint: (position: Position | Position3D, srid?: number) => string

  /**
   * Build ST_DWithin for radius queries (in meters)
   * @param geomColumn Column name containing geometry
   * @param center Center point [lon, lat]
   * @param radiusMeters Radius in meters
   */
  readonly dwithin: (
    geomColumn: string,
    center: Position,
    radiusMeters: number
  ) => string

  /**
   * Build ST_Within for containment queries
   * @param geomColumn Column name containing geometry
   * @param bbox Bounding box to check containment within
   */
  readonly within: (geomColumn: string, bbox: BBox) => string

  /**
   * Build ST_Intersects for intersection queries
   * @param geomColumn Column name containing geometry
   * @param bbox Bounding box to check intersection with
   */
  readonly intersects: (geomColumn: string, bbox: BBox) => string

  /**
   * Build ST_AsGeoJSON for geometry output
   * @param geomColumn Column name containing geometry
   * @param precision Decimal precision (default 6)
   */
  readonly asGeoJSON: (geomColumn: string, precision?: number) => string

  /**
   * Build ST_Distance in meters between a column and a point
   * @param geomColumn Column name containing geometry
   * @param point Reference point [lon, lat]
   */
  readonly distance: (geomColumn: string, point: Position) => string
}

/**
 * Spatial query builder implementation
 */
export const spatialQuery: SpatialQueryBuilder = {
  makeEnvelope: (bbox, srid = 4326) => {
    const [minLon, minLat, maxLon, maxLat] = bbox
    return `ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}, ${srid})`
  },

  makePoint: (position, srid = 4326) => {
    if (position.length === 3) {
      const [lon, lat, alt] = position
      return `ST_SetSRID(ST_MakePoint(${lon}, ${lat}, ${alt}), ${srid})`
    }
    const [lon, lat] = position
    return `ST_SetSRID(ST_MakePoint(${lon}, ${lat}), ${srid})`
  },

  dwithin: (geomColumn, center, radiusMeters) => {
    const [lon, lat] = center
    // Use ST_DWithin with geography cast for accurate meter distances
    return `ST_DWithin(
      ${geomColumn}::geography,
      ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography,
      ${radiusMeters}
    )`
  },

  within: (geomColumn, bbox) => {
    const envelope = spatialQuery.makeEnvelope(bbox)
    return `ST_Within(${geomColumn}, ${envelope})`
  },

  intersects: (geomColumn, bbox) => {
    const envelope = spatialQuery.makeEnvelope(bbox)
    return `ST_Intersects(${geomColumn}, ${envelope})`
  },

  asGeoJSON: (geomColumn, precision = 6) =>
    `ST_AsGeoJSON(${geomColumn}, ${precision})`,

  distance: (geomColumn, point) => {
    const [lon, lat] = point
    // Returns distance in meters using geography cast
    return `ST_Distance(
      ${geomColumn}::geography,
      ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography
    )`
  },
}

// =============================================================================
// PostGIS Service Interface
// =============================================================================

/**
 * Error from PostGIS operations
 */
export class PostGISError extends Schema.TaggedError<PostGISError>()(
  'PostGISError',
  {
    operation: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

/**
 * PostGIS service interface
 */
export interface PostGISService {
  /**
   * Execute raw SQL query
   */
  readonly query: <A extends object>(
    sql: string,
    params?: readonly unknown[]
  ) => Effect.Effect<readonly A[], PostGISError>

  /**
   * Execute SQL and return single result
   */
  readonly queryOne: <A extends object>(
    sql: string,
    params?: readonly unknown[]
  ) => Effect.Effect<Option.Option<A>, PostGISError>

  /**
   * Execute SQL for side effects (INSERT, UPDATE, DELETE)
   */
  readonly execute: (
    sql: string,
    params?: readonly unknown[]
  ) => Effect.Effect<number, PostGISError>

  /**
   * Check if PostGIS extension is available
   */
  readonly checkPostGIS: () => Effect.Effect<boolean, PostGISError>

  /**
   * Initialize PostGIS extension
   */
  readonly initPostGIS: () => Effect.Effect<void, PostGISError>

  /**
   * Spatial query builder
   */
  readonly spatial: SpatialQueryBuilder
}

/**
 * PostGIS service tag
 */
export class PostGISServiceTag extends Context.Tag('geoint/PostGISService')<
  PostGISServiceTag,
  PostGISService
>() {}

/**
 * Create PostGIS service from SqlClient
 */
export const makePostGISService = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  const query = <A extends object>(
    sqlQuery: string,
    params: readonly unknown[] = []
  ): Effect.Effect<readonly A[], PostGISError> =>
    pipe(
      sql.unsafe<A>(sqlQuery, params as unknown[]),
      Effect.mapError((error) =>
        new PostGISError({
          operation: 'query',
          message: `Query failed: ${String(error)}`,
          cause: error,
        })
      )
    )

  const queryOne = <A extends object>(
    sqlQuery: string,
    params: readonly unknown[] = []
  ): Effect.Effect<Option.Option<A>, PostGISError> =>
    pipe(
      query<A>(sqlQuery, params),
      Effect.map((rows) =>
        rows.length > 0 ? Option.some(rows[0]) : Option.none()
      )
    )

  const execute = (
    sqlQuery: string,
    params: readonly unknown[] = []
  ): Effect.Effect<number, PostGISError> =>
    pipe(
      sql.unsafe(sqlQuery, params as unknown[]),
      Effect.map((result) => (Array.isArray(result) ? result.length : 0)),
      Effect.mapError((error) =>
        new PostGISError({
          operation: 'execute',
          message: `Execute failed: ${String(error)}`,
          cause: error,
        })
      )
    )

  const checkPostGIS = (): Effect.Effect<boolean, PostGISError> =>
    pipe(
      query<{ extname: string }>(
        `SELECT extname FROM pg_extension WHERE extname = 'postgis'`
      ),
      Effect.map((rows) => rows.length > 0)
    )

  const initPostGIS = (): Effect.Effect<void, PostGISError> =>
    pipe(
      execute(`CREATE EXTENSION IF NOT EXISTS postgis`),
      Effect.asVoid
    )

  return {
    query,
    queryOne,
    execute,
    checkPostGIS,
    initPostGIS,
    spatial: spatialQuery,
  } satisfies PostGISService
})

/**
 * PostGIS service layer
 */
export const PostGISServiceLive = Layer.effect(
  PostGISServiceTag,
  makePostGISService
)

// =============================================================================
// Health Check
// =============================================================================

/**
 * Database health status
 */
export interface DatabaseHealthStatus {
  readonly healthy: boolean
  readonly connection: boolean
  readonly postgis: string | null
  readonly timescaledb: string | null
  readonly schemas: {
    readonly raw: boolean
    readonly entity: boolean
    readonly geoint: boolean
  }
  readonly tables: {
    readonly flightPositions: boolean
    readonly osmElements: boolean
    readonly weatherObservations: boolean
  }
  readonly continuousAggregates: {
    readonly flightsCurrent: boolean
    readonly flightTracks: boolean
    readonly weatherCurrent: boolean
  }
}

/**
 * Check database health - verifies connection, extensions, schemas, and tables
 *
 * @example
 * ```typescript
 * const program = checkDatabaseHealth.pipe(
 *   Effect.provide(PostGISClientLive),
 *   Effect.map((status) => {
 *     if (!status.healthy) {
 *       console.error('Database not ready:', status)
 *     }
 *   })
 * )
 * ```
 */
export const checkDatabaseHealth = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  // Check connection
  const connection = yield* sql<{ test: number }>`SELECT 1 as test`.pipe(
    Effect.map(() => true),
    Effect.catchAll(() => Effect.succeed(false))
  )

  // Check PostGIS version
  const postgis = yield* sql<{ version: string }>`
    SELECT PostGIS_Version() as version
  `.pipe(
    Effect.map((rows) => rows[0]?.version ?? null),
    Effect.catchAll(() => Effect.succeed(null))
  )

  // Check TimescaleDB version
  const timescaledb = yield* sql<{ extversion: string }>`
    SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'
  `.pipe(
    Effect.map((rows) => rows[0]?.extversion ?? null),
    Effect.catchAll(() => Effect.succeed(null))
  )

  // Check schemas
  const checkSchema = (name: string) =>
    sql<{ exists: boolean }>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.schemata WHERE schema_name = ${name}
      ) as exists
    `.pipe(
      Effect.map((rows) => rows[0]?.exists ?? false),
      Effect.catchAll(() => Effect.succeed(false))
    )

  const rawSchema = yield* checkSchema('raw')
  const entitySchema = yield* checkSchema('entity')
  const geointSchema = yield* checkSchema('geoint')

  // Check raw tables
  const checkTable = (schema: string, table: string) =>
    sql<{ exists: boolean }>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = ${schema} AND table_name = ${table}
      ) as exists
    `.pipe(
      Effect.map((rows) => rows[0]?.exists ?? false),
      Effect.catchAll(() => Effect.succeed(false))
    )

  const flightPositions = yield* checkTable('raw', 'flight_positions')
  const osmElements = yield* checkTable('raw', 'osm_elements')
  const weatherObservations = yield* checkTable('raw', 'weather_observations')

  // Check continuous aggregates
  const checkContinuousAggregate = (name: string) =>
    sql<{ exists: boolean }>`
      SELECT EXISTS (
        SELECT 1 FROM timescaledb_information.continuous_aggregates
        WHERE view_name = ${name}
      ) as exists
    `.pipe(
      Effect.map((rows) => rows[0]?.exists ?? false),
      Effect.catchAll(() => Effect.succeed(false))
    )

  const flightsCurrent = yield* checkContinuousAggregate('flights_current')
  const flightTracks = yield* checkContinuousAggregate('flight_tracks')
  const weatherCurrent = yield* checkContinuousAggregate('weather_current')

  const healthy =
    connection &&
    postgis !== null &&
    timescaledb !== null &&
    rawSchema &&
    entitySchema &&
    flightPositions

  return {
    healthy,
    connection,
    postgis,
    timescaledb,
    schemas: {
      raw: rawSchema,
      entity: entitySchema,
      geoint: geointSchema,
    },
    tables: {
      flightPositions,
      osmElements,
      weatherObservations,
    },
    continuousAggregates: {
      flightsCurrent,
      flightTracks,
      weatherCurrent,
    },
  } satisfies DatabaseHealthStatus
})
