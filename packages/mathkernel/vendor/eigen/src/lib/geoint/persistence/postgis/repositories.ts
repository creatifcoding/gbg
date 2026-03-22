/**
 * PostGIS Repositories - Effect SQL Repository Layer
 *
 * Provides CRUD operations with spatial queries for:
 * - TrackPositionRepository: Track position persistence with spatial search
 * - FeatureRepository: Feature persistence with geometry queries
 * - SavedSearchRepository: Saved search persistence
 *
 * Uses Effect SQL with PostGIS spatial functions.
 *
 * @see beads:tmnl-fb8kt GEOINT Layering System Epic
 * @module
 */

import {
  Effect,
  Layer,
  Context,
  Schema,
  Option,
  pipe,
  ParseResult,
} from 'effect'
import { PgClient } from '@effect/sql-pg'
import { SqlError } from '@effect/sql/SqlError'
import {
  TrackPosition,
  Feature,
  type FeatureGeometry,
  MIGRATION_SQL,
  VERIFY_POSTGIS_SQL,
} from './schemas'
import {
  TrackId,
  FeatureId,
  IntelSource,
  Classification,
  type Position,
  type BBox,
} from '../../schemas'

// Type alias for encoded track position row from database
type TrackPositionRow = {
  readonly id: bigint
  readonly track_id: string
  readonly longitude: number
  readonly latitude: number
  readonly altitude: number | null
  readonly heading: number | null
  readonly speed: number | null
  readonly classification: string | null
  readonly source: string | null
  readonly timestamp: Date
  readonly geom: unknown | null
  readonly created_at: Date
}

// Type alias for encoded feature row from database
type FeatureRow = {
  readonly id: bigint
  readonly feature_id: string
  readonly name: string | null
  readonly feature_type: string | null
  readonly layer: string | null
  readonly source: string | null
  readonly properties: unknown | null
  readonly geom: unknown | null
  readonly bbox: string | null
  readonly created_at: Date
  readonly updated_at: Date
}

// =============================================================================
// Repository Error
// =============================================================================

/**
 * Repository operation error
 */
export class RepositoryError extends Schema.TaggedError<RepositoryError>()(
  'RepositoryError',
  {
    repository: Schema.String,
    operation: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

// =============================================================================
// Track Position Repository
// =============================================================================

/**
 * Input for inserting a track position
 */
export interface InsertTrackPositionInput {
  readonly trackId: TrackId
  readonly longitude: number
  readonly latitude: number
  readonly altitude?: number
  readonly heading?: number
  readonly speed?: number
  readonly classification?: typeof Classification.Type
  readonly source?: IntelSource
  readonly timestamp: Date
}

/**
 * Spatial search options for track positions
 */
export interface TrackPositionSearchOptions {
  /** Bounding box [minLon, minLat, maxLon, maxLat] */
  readonly bounds?: BBox
  /** Center point [lon, lat] */
  readonly center?: Position
  /** Radius in meters (requires center) */
  readonly radiusMeters?: number
  /** Filter by track IDs */
  readonly trackIds?: readonly TrackId[]
  /** Filter by classification */
  readonly classification?: typeof Classification.Type
  /** Filter by source */
  readonly source?: IntelSource
  /** Time range start */
  readonly fromTime?: Date
  /** Time range end */
  readonly toTime?: Date
  /** Maximum results */
  readonly limit?: number
  /** Order by timestamp (default: DESC) */
  readonly orderAsc?: boolean
}

/**
 * Track Position Repository interface
 */
export interface TrackPositionRepository {
  /**
   * Insert a new track position
   */
  readonly insert: (
    input: InsertTrackPositionInput
  ) => Effect.Effect<TrackPosition, RepositoryError>

  /**
   * Insert multiple track positions (batch)
   */
  readonly insertBatch: (
    inputs: readonly InsertTrackPositionInput[]
  ) => Effect.Effect<readonly TrackPosition[], RepositoryError>

  /**
   * Get latest position for a track
   */
  readonly getLatest: (
    trackId: TrackId
  ) => Effect.Effect<Option.Option<TrackPosition>, RepositoryError>

  /**
   * Get position history for a track
   */
  readonly getHistory: (
    trackId: TrackId,
    options?: { limit?: number; fromTime?: Date; toTime?: Date }
  ) => Effect.Effect<readonly TrackPosition[], RepositoryError>

  /**
   * Search positions with spatial filtering
   */
  readonly search: (
    options: TrackPositionSearchOptions
  ) => Effect.Effect<readonly TrackPosition[], RepositoryError>

  /**
   * Count positions matching criteria
   */
  readonly count: (
    options?: Omit<TrackPositionSearchOptions, 'limit' | 'orderAsc'>
  ) => Effect.Effect<number, RepositoryError>

  /**
   * Delete positions older than a timestamp
   */
  readonly deleteOlderThan: (
    timestamp: Date
  ) => Effect.Effect<number, RepositoryError>
}

/**
 * Track Position Repository Tag
 */
export class TrackPositionRepositoryTag extends Context.Tag(
  'geoint/TrackPositionRepository'
)<TrackPositionRepositoryTag, TrackPositionRepository>() {}

/**
 * Create Track Position Repository
 */
export const makeTrackPositionRepository = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  const mapError = (operation: string) => (error: SqlError | ParseResult.ParseError) =>
    new RepositoryError({
      repository: 'TrackPositionRepository',
      operation,
      message: String(error),
      cause: error,
    })

  const insert = (
    input: InsertTrackPositionInput
  ): Effect.Effect<TrackPosition, RepositoryError> =>
    pipe(
      sql<TrackPositionRow>`
        INSERT INTO track_positions (
          track_id, longitude, latitude, altitude, heading, speed,
          classification, source, timestamp
        ) VALUES (
          ${input.trackId},
          ${input.longitude},
          ${input.latitude},
          ${input.altitude ?? null},
          ${input.heading ?? null},
          ${input.speed ?? null},
          ${input.classification ?? null},
          ${input.source ?? null},
          ${input.timestamp}
        )
        RETURNING id, track_id, longitude, latitude, altitude, heading, speed,
          classification, source, timestamp, ST_AsGeoJSON(geom)::json as geom, created_at
      `,
      Effect.map((rows) => rows[0]),
      Effect.flatMap((row) =>
        Schema.decodeUnknown(TrackPosition)(row as unknown)
      ),
      Effect.mapError(mapError('insert'))
    )

  const insertBatch = (
    inputs: readonly InsertTrackPositionInput[]
  ): Effect.Effect<readonly TrackPosition[], RepositoryError> => {
    if (inputs.length === 0) return Effect.succeed([])

    // Build batch insert with individual insert statements for better compatibility
    // Errors already mapped to RepositoryError by individual insert calls
    return Effect.all(inputs.map((input) => insert(input)))
  }

  const getLatest = (
    trackId: TrackId
  ): Effect.Effect<Option.Option<TrackPosition>, RepositoryError> =>
    pipe(
      sql<TrackPositionRow>`
        SELECT id, track_id, longitude, latitude, altitude, heading, speed,
          classification, source, timestamp, ST_AsGeoJSON(geom)::json as geom, created_at
        FROM track_positions
        WHERE track_id = ${trackId}
        ORDER BY timestamp DESC
        LIMIT 1
      `,
      Effect.map((rows) =>
        rows.length > 0 ? Option.some(rows[0]) : Option.none()
      ),
      Effect.flatMap((opt) =>
        Option.match(opt, {
          onNone: () => Effect.succeed(Option.none()),
          onSome: (row) =>
            pipe(
              Schema.decodeUnknown(TrackPosition)(row as unknown),
              Effect.map(Option.some)
            ),
        })
      ),
      Effect.mapError(mapError('getLatest'))
    )

  const getHistory = (
    trackId: TrackId,
    options?: { limit?: number; fromTime?: Date; toTime?: Date }
  ): Effect.Effect<readonly TrackPosition[], RepositoryError> => {
    const limit = options?.limit ?? 1000

    return pipe(
      sql<TrackPositionRow>`
        SELECT id, track_id, longitude, latitude, altitude, heading, speed,
          classification, source, timestamp, ST_AsGeoJSON(geom)::json as geom, created_at
        FROM track_positions
        WHERE track_id = ${trackId}
          ${options?.fromTime ? sql`AND timestamp >= ${options.fromTime}` : sql``}
          ${options?.toTime ? sql`AND timestamp <= ${options.toTime}` : sql``}
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `,
      Effect.flatMap((rows) =>
        Effect.all(
          rows.map((row) =>
            Schema.decodeUnknown(TrackPosition)(row as unknown as TrackPositionRow)
          )
        )
      ),
      Effect.mapError(mapError('getHistory'))
    )
  }

  const search = (
    options: TrackPositionSearchOptions
  ): Effect.Effect<readonly TrackPosition[], RepositoryError> => {
    const limit = options.limit ?? 100

    // Build spatial filter
    let spatialFilter = sql``
    if (options.center && options.radiusMeters) {
      const [lon, lat] = options.center
      spatialFilter = sql`AND ST_DWithin(
        geom::geography,
        ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography,
        ${options.radiusMeters}
      )`
    } else if (options.bounds) {
      const [minLon, minLat, maxLon, maxLat] = options.bounds
      spatialFilter = sql`AND ST_Within(
        geom,
        ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}, 4326)
      )`
    }

    return pipe(
      sql<TrackPositionRow>`
        SELECT id, track_id, longitude, latitude, altitude, heading, speed,
          classification, source, timestamp, ST_AsGeoJSON(geom)::json as geom, created_at
        FROM track_positions
        WHERE 1=1
          ${spatialFilter}
          ${options.trackIds && options.trackIds.length > 0
            ? sql`AND track_id = ANY(${options.trackIds as unknown as string[]})`
            : sql``}
          ${options.classification ? sql`AND classification = ${options.classification}` : sql``}
          ${options.source ? sql`AND source = ${options.source}` : sql``}
          ${options.fromTime ? sql`AND timestamp >= ${options.fromTime}` : sql``}
          ${options.toTime ? sql`AND timestamp <= ${options.toTime}` : sql``}
        ORDER BY timestamp ${options.orderAsc ? sql`ASC` : sql`DESC`}
        LIMIT ${limit}
      `,
      Effect.flatMap((rows) =>
        Effect.all(
          rows.map((row) =>
            Schema.decodeUnknown(TrackPosition)(row as unknown as TrackPositionRow)
          )
        )
      ),
      Effect.mapError(mapError('search'))
    )
  }

  const count = (
    options?: Omit<TrackPositionSearchOptions, 'limit' | 'orderAsc'>
  ): Effect.Effect<number, RepositoryError> => {
    let spatialFilter = sql``
    if (options?.center && options?.radiusMeters) {
      const [lon, lat] = options.center
      spatialFilter = sql`AND ST_DWithin(
        geom::geography,
        ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography,
        ${options.radiusMeters}
      )`
    } else if (options?.bounds) {
      const [minLon, minLat, maxLon, maxLat] = options.bounds
      spatialFilter = sql`AND ST_Within(
        geom,
        ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}, 4326)
      )`
    }

    return pipe(
      sql<{ count: string }>`
        SELECT COUNT(*) as count
        FROM track_positions
        WHERE 1=1
          ${spatialFilter}
          ${options?.trackIds && options.trackIds.length > 0
            ? sql`AND track_id = ANY(${options.trackIds as unknown as string[]})`
            : sql``}
          ${options?.classification ? sql`AND classification = ${options.classification}` : sql``}
          ${options?.source ? sql`AND source = ${options.source}` : sql``}
          ${options?.fromTime ? sql`AND timestamp >= ${options.fromTime}` : sql``}
          ${options?.toTime ? sql`AND timestamp <= ${options.toTime}` : sql``}
      `,
      Effect.map((rows) => parseInt(rows[0]?.count ?? '0', 10)),
      Effect.mapError(mapError('count'))
    )
  }

  const deleteOlderThan = (
    timestamp: Date
  ): Effect.Effect<number, RepositoryError> =>
    pipe(
      sql`
        DELETE FROM track_positions
        WHERE timestamp < ${timestamp}
      `,
      Effect.map((result) => (Array.isArray(result) ? result.length : 0)),
      Effect.mapError(mapError('deleteOlderThan'))
    )

  return {
    insert,
    insertBatch,
    getLatest,
    getHistory,
    search,
    count,
    deleteOlderThan,
  } satisfies TrackPositionRepository
})

/**
 * Track Position Repository layer
 */
export const TrackPositionRepositoryLive = Layer.effect(
  TrackPositionRepositoryTag,
  makeTrackPositionRepository
)

// =============================================================================
// Feature Repository
// =============================================================================

/**
 * Input for inserting a feature
 */
export interface InsertFeatureInput {
  readonly featureId: FeatureId
  readonly name?: string
  readonly featureType?: string
  readonly layer?: string
  readonly source?: IntelSource
  readonly properties?: Record<string, unknown>
  /** GeoJSON geometry object */
  readonly geometry: FeatureGeometry
}

/**
 * Spatial search options for features
 */
export interface FeatureSearchOptions {
  /** Bounding box [minLon, minLat, maxLon, maxLat] */
  readonly bounds?: BBox
  /** Filter by feature IDs */
  readonly featureIds?: readonly FeatureId[]
  /** Filter by feature type */
  readonly featureType?: string
  /** Filter by layer */
  readonly layer?: string
  /** Filter by source */
  readonly source?: IntelSource
  /** Maximum results */
  readonly limit?: number
}

/**
 * Feature Repository interface
 */
export interface FeatureRepository {
  /**
   * Insert or update a feature (upsert)
   */
  readonly upsert: (
    input: InsertFeatureInput
  ) => Effect.Effect<Feature, RepositoryError>

  /**
   * Insert multiple features (batch upsert)
   */
  readonly upsertBatch: (
    inputs: readonly InsertFeatureInput[]
  ) => Effect.Effect<readonly Feature[], RepositoryError>

  /**
   * Get feature by ID
   */
  readonly getById: (
    featureId: FeatureId
  ) => Effect.Effect<Option.Option<Feature>, RepositoryError>

  /**
   * Search features with spatial filtering
   */
  readonly search: (
    options: FeatureSearchOptions
  ) => Effect.Effect<readonly Feature[], RepositoryError>

  /**
   * Delete feature by ID
   */
  readonly delete: (featureId: FeatureId) => Effect.Effect<boolean, RepositoryError>
}

/**
 * Feature Repository Tag
 */
export class FeatureRepositoryTag extends Context.Tag('geoint/FeatureRepository')<
  FeatureRepositoryTag,
  FeatureRepository
>() {}

/**
 * Create Feature Repository
 */
export const makeFeatureRepository = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  const mapError = (operation: string) => (error: SqlError | ParseResult.ParseError) =>
    new RepositoryError({
      repository: 'FeatureRepository',
      operation,
      message: String(error),
      cause: error,
    })

  /**
   * Convert geometry to PostGIS WKT
   */
  const geometryToWkt = (geom: FeatureGeometry): string => {
    switch (geom.type) {
      case 'Point': {
        const coords = geom.coordinates
        if (coords.length === 3) {
          return `POINT Z(${coords[0]} ${coords[1]} ${coords[2]})`
        }
        return `POINT(${coords[0]} ${coords[1]})`
      }
      case 'LineString': {
        const points = geom.coordinates.map((c) => `${c[0]} ${c[1]}`).join(', ')
        return `LINESTRING(${points})`
      }
      case 'Polygon': {
        const rings = geom.coordinates
          .map((ring) => `(${ring.map((c) => `${c[0]} ${c[1]}`).join(', ')})`)
          .join(', ')
        return `POLYGON(${rings})`
      }
    }
  }

  const upsert = (
    input: InsertFeatureInput
  ): Effect.Effect<Feature, RepositoryError> => {
    const wkt = geometryToWkt(input.geometry)

    return pipe(
      sql<FeatureRow>`
        INSERT INTO features (
          feature_id, name, feature_type, layer, source, properties, geom
        ) VALUES (
          ${input.featureId},
          ${input.name ?? null},
          ${input.featureType ?? null},
          ${input.layer ?? null},
          ${input.source ?? null},
          ${input.properties ? JSON.stringify(input.properties) : null}::jsonb,
          ST_SetSRID(ST_GeomFromText(${wkt}), 4326)
        )
        ON CONFLICT (feature_id) DO UPDATE SET
          name = EXCLUDED.name,
          feature_type = EXCLUDED.feature_type,
          layer = EXCLUDED.layer,
          source = EXCLUDED.source,
          properties = EXCLUDED.properties,
          geom = EXCLUDED.geom
        RETURNING id, feature_id, name, feature_type, layer, source, properties,
          ST_AsGeoJSON(geom)::json as geom, bbox::text, created_at, updated_at
      `,
      Effect.map((rows) => rows[0]),
      Effect.flatMap((row) =>
        Schema.decodeUnknown(Feature)(row as unknown as FeatureRow)
      ),
      Effect.mapError(mapError('upsert'))
    )
  }

  const upsertBatch = (
    inputs: readonly InsertFeatureInput[]
  ): Effect.Effect<readonly Feature[], RepositoryError> => {
    if (inputs.length === 0) return Effect.succeed([])

    // Use sequential upserts for now (can optimize with CTE later)
    // Errors already mapped to RepositoryError by individual upsert calls
    return Effect.all(inputs.map((input) => upsert(input)))
  }

  const getById = (
    featureId: FeatureId
  ): Effect.Effect<Option.Option<Feature>, RepositoryError> =>
    pipe(
      sql<FeatureRow>`
        SELECT id, feature_id, name, feature_type, layer, source, properties,
          ST_AsGeoJSON(geom)::json as geom, bbox::text, created_at, updated_at
        FROM features
        WHERE feature_id = ${featureId}
      `,
      Effect.map((rows) =>
        rows.length > 0 ? Option.some(rows[0]) : Option.none()
      ),
      Effect.flatMap((opt) =>
        Option.match(opt, {
          onNone: () => Effect.succeed(Option.none()),
          onSome: (row) =>
            pipe(
              Schema.decodeUnknown(Feature)(row as unknown as FeatureRow),
              Effect.map(Option.some)
            ),
        })
      ),
      Effect.mapError(mapError('getById'))
    )

  const search = (
    options: FeatureSearchOptions
  ): Effect.Effect<readonly Feature[], RepositoryError> => {
    const limit = options.limit ?? 100

    let spatialFilter = sql``
    if (options.bounds) {
      const [minLon, minLat, maxLon, maxLat] = options.bounds
      spatialFilter = sql`AND ST_Intersects(
        geom,
        ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}, 4326)
      )`
    }

    return pipe(
      sql<FeatureRow>`
        SELECT id, feature_id, name, feature_type, layer, source, properties,
          ST_AsGeoJSON(geom)::json as geom, bbox::text, created_at, updated_at
        FROM features
        WHERE 1=1
          ${spatialFilter}
          ${options.featureIds && options.featureIds.length > 0
            ? sql`AND feature_id = ANY(${options.featureIds as unknown as string[]})`
            : sql``}
          ${options.featureType ? sql`AND feature_type = ${options.featureType}` : sql``}
          ${options.layer ? sql`AND layer = ${options.layer}` : sql``}
          ${options.source ? sql`AND source = ${options.source}` : sql``}
        LIMIT ${limit}
      `,
      Effect.flatMap((rows) =>
        Effect.all(
          rows.map((row) =>
            Schema.decodeUnknown(Feature)(row as unknown as FeatureRow)
          )
        )
      ),
      Effect.mapError(mapError('search'))
    )
  }

  const deleteFeature = (
    featureId: FeatureId
  ): Effect.Effect<boolean, RepositoryError> =>
    pipe(
      sql`
        DELETE FROM features
        WHERE feature_id = ${featureId}
      `,
      Effect.map((result) => (Array.isArray(result) ? result.length > 0 : false)),
      Effect.mapError(mapError('delete'))
    )

  return {
    upsert,
    upsertBatch,
    getById,
    search,
    delete: deleteFeature,
  } satisfies FeatureRepository
})

/**
 * Feature Repository layer
 */
export const FeatureRepositoryLive = Layer.effect(
  FeatureRepositoryTag,
  makeFeatureRepository
)

// =============================================================================
// Migration Runner
// =============================================================================

/**
 * Run PostGIS migrations
 */
export const runMigrations = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  yield* Effect.logInfo('Running PostGIS migrations...')

  // Run migration SQL
  yield* sql.unsafe(MIGRATION_SQL).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logError(`Migration failed: ${error}`)
        return yield* Effect.fail(
          new RepositoryError({
            repository: 'Migration',
            operation: 'runMigrations',
            message: `Migration failed: ${error}`,
            cause: error,
          })
        )
      })
    )
  )

  // Verify PostGIS
  const version = yield* sql.unsafe<{ version: string }>(VERIFY_POSTGIS_SQL).pipe(
    Effect.map((rows) => rows[0]?.version ?? 'unknown'),
    Effect.catchAll(() => Effect.succeed('unknown'))
  )

  yield* Effect.logInfo(`PostGIS migrations complete. Version: ${version}`)

  return version
})
