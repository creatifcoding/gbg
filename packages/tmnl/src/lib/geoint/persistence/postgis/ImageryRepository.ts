/**
 * ImageryRepository - Repository for raw.imagery_items
 *
 * Provides CRUD operations for satellite imagery metadata:
 * - raw.imagery_items: Stores metadata for Planet Labs and Sentinel Hub imagery
 * - Supports spatial queries, cloud cover filtering, and acquisition time queries
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
  DateTime,
} from 'effect'
import { PgClient } from '@effect/sql-pg'
import type { BBox } from '../../schemas'

// =============================================================================
// Schemas for raw.imagery_items
// =============================================================================

/**
 * Imagery provider type
 */
export const ImageryProvider = Schema.Literal('planet', 'sentinel')
export type ImageryProvider = typeof ImageryProvider.Type

/**
 * Imagery item input for insertion/upsert
 */
export const ImageryItemInput = Schema.TaggedStruct('ImageryItemInput', {
  /** Unique item ID from provider */
  itemId: Schema.String,
  /** Provider name */
  provider: ImageryProvider,
  /** Raw API response JSONB */
  raw: Schema.Unknown,
  /** Collection name (e.g., 'PSScene', 'sentinel-2-l2a') */
  collection: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Acquisition timestamp */
  acquired: Schema.optionalWith(Schema.DateFromSelf, { as: 'Option' }),
  /** Publication timestamp */
  published: Schema.optionalWith(Schema.DateFromSelf, { as: 'Option' }),
  /** Last update timestamp */
  updated: Schema.optionalWith(Schema.DateFromSelf, { as: 'Option' }),
  /** Cloud cover percentage (0-100) */
  cloudCover: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  /** Ground sample distance in meters */
  gsd: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  /** Sun azimuth angle in degrees */
  sunAzimuth: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  /** Sun elevation angle in degrees */
  sunElevation: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  /** Bounding box [minLon, minLat, maxLon, maxLat] */
  bbox: Schema.optionalWith(
    Schema.Tuple(Schema.Number, Schema.Number, Schema.Number, Schema.Number),
    { as: 'Option' }
  ),
  /** Centroid longitude */
  centroidLon: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  /** Centroid latitude */
  centroidLat: Schema.optionalWith(Schema.Number, { as: 'Option' }),
})
export type ImageryItemInput = typeof ImageryItemInput.Type

/**
 * Imagery item row from database
 */
export const ImageryItemRow = Schema.TaggedStruct('ImageryItemRow', {
  item_id: Schema.String,
  provider: Schema.String,
  raw: Schema.Unknown,
  collection: Schema.NullOr(Schema.String),
  acquired: Schema.NullOr(Schema.DateTimeUtcFromDate),
  published: Schema.NullOr(Schema.DateTimeUtcFromDate),
  updated: Schema.NullOr(Schema.DateTimeUtcFromDate),
  cloud_cover: Schema.NullOr(Schema.Number),
  gsd: Schema.NullOr(Schema.Number),
  sun_azimuth: Schema.NullOr(Schema.Number),
  sun_elevation: Schema.NullOr(Schema.Number),
  centroid_lon: Schema.NullOr(Schema.Number),
  centroid_lat: Schema.NullOr(Schema.Number),
  fetched_at: Schema.DateTimeUtcFromDate,
})
export type ImageryItemRow = typeof ImageryItemRow.Type

/**
 * Imagery search result with distance
 */
export const ImagerySearchResult = Schema.TaggedStruct('ImagerySearchResult', {
  item_id: Schema.String,
  provider: Schema.String,
  collection: Schema.NullOr(Schema.String),
  acquired: Schema.NullOr(Schema.DateTimeUtcFromDate),
  cloud_cover: Schema.NullOr(Schema.Number),
  gsd: Schema.NullOr(Schema.Number),
  centroid_lon: Schema.NullOr(Schema.Number),
  centroid_lat: Schema.NullOr(Schema.Number),
  /** Distance in meters from search center (when applicable) */
  distance_m: Schema.optionalWith(Schema.Number, { as: 'Option' }),
})
export type ImagerySearchResult = typeof ImagerySearchResult.Type

// =============================================================================
// Repository Error
// =============================================================================

/**
 * Imagery repository error
 */
export class ImageryRepositoryError extends Schema.TaggedError<ImageryRepositoryError>()(
  'ImageryRepositoryError',
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
 * Search options for imagery items
 */
export interface ImagerySearchOptions {
  /** Bounding box [minLon, minLat, maxLon, maxLat] */
  readonly bounds?: BBox
  /** Provider filter */
  readonly provider?: ImageryProvider
  /** Collection filter */
  readonly collection?: string
  /** Acquired from time */
  readonly acquiredFrom?: Date
  /** Acquired to time */
  readonly acquiredTo?: Date
  /** Maximum cloud cover percentage */
  readonly maxCloudCover?: number
  /** Maximum GSD in meters */
  readonly maxGsd?: number
  /** Max number of results */
  readonly limit?: number
}

/**
 * Nearby imagery search options
 */
export interface ImageryNearbyOptions {
  /** Center longitude */
  readonly longitude: number
  /** Center latitude */
  readonly latitude: number
  /** Search radius in meters */
  readonly radiusM: number
  /** Provider filter */
  readonly provider?: ImageryProvider
  /** Maximum cloud cover percentage */
  readonly maxCloudCover?: number
  /** Acquired within this many days */
  readonly withinDays?: number
  /** Max number of results */
  readonly limit?: number
}

/**
 * Imagery repository interface
 */
export interface ImageryRepository {
  // ---------------------------------------------------------------------------
  // Upsert Operations
  // ---------------------------------------------------------------------------

  /**
   * Insert or update a single imagery item
   */
  readonly insertItem: (
    input: ImageryItemInput
  ) => Effect.Effect<void, ImageryRepositoryError>

  /**
   * Batch insert/update imagery items
   */
  readonly insertItems: (
    inputs: readonly ImageryItemInput[]
  ) => Effect.Effect<number, ImageryRepositoryError>

  // ---------------------------------------------------------------------------
  // Query Operations
  // ---------------------------------------------------------------------------

  /**
   * Find imagery items matching search options
   */
  readonly findItems: (
    options: ImagerySearchOptions
  ) => Effect.Effect<readonly ImageryItemRow[], ImageryRepositoryError>

  /**
   * Find imagery items near a point
   */
  readonly findNearby: (
    options: ImageryNearbyOptions
  ) => Effect.Effect<readonly ImagerySearchResult[], ImageryRepositoryError>

  /**
   * Find a single imagery item by ID and provider
   */
  readonly findItem: (
    itemId: string,
    provider: ImageryProvider
  ) => Effect.Effect<Option.Option<ImageryItemRow>, ImageryRepositoryError>

  /**
   * Find recent imagery (ordered by acquisition time)
   */
  readonly findRecent: (options?: {
    readonly provider?: ImageryProvider
    readonly collection?: string
    readonly limit?: number
  }) => Effect.Effect<readonly ImageryItemRow[], ImageryRepositoryError>

  // ---------------------------------------------------------------------------
  // Analytics
  // ---------------------------------------------------------------------------

  /**
   * Count imagery items matching criteria
   */
  readonly countItems: (
    options?: ImagerySearchOptions
  ) => Effect.Effect<number, ImageryRepositoryError>

  /**
   * Get collection statistics
   */
  readonly getCollectionStats: (provider?: ImageryProvider) => Effect.Effect<
    readonly {
      readonly provider: string
      readonly collection: string
      readonly item_count: number
      readonly avg_cloud_cover: number | null
      readonly avg_gsd: number | null
      readonly oldest_acquired: DateTime.Utc | null
      readonly newest_acquired: DateTime.Utc | null
    }[],
    ImageryRepositoryError
  >

  /**
   * Delete old items (cleanup utility)
   */
  readonly deleteOlderThan: (
    days: number
  ) => Effect.Effect<number, ImageryRepositoryError>
}

// =============================================================================
// Repository Tag
// =============================================================================

export class ImageryRepositoryTag extends Context.Tag('geoint/ImageryRepository')<
  ImageryRepositoryTag,
  ImageryRepository
>() {}

// =============================================================================
// Repository Implementation
// =============================================================================

/**
 * Create Imagery repository from SqlClient
 */
export const makeImageryRepository = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  const mapError =
    (operation: string) =>
    (error: unknown): ImageryRepositoryError =>
      new ImageryRepositoryError({
        operation,
        message: String(error),
        cause: error,
      })

  // ---------------------------------------------------------------------------
  // Upsert Operations
  // ---------------------------------------------------------------------------

  const insertItem: ImageryRepository['insertItem'] = (input) => {
    const hasBbox = Option.isSome(input.bbox)
    const hasCentroid =
      Option.isSome(input.centroidLon) && Option.isSome(input.centroidLat)

    return pipe(
      sql`
        INSERT INTO raw.imagery_items (
          item_id, provider, raw, collection,
          acquired, published, updated,
          cloud_cover, gsd, sun_azimuth, sun_elevation,
          bbox, geometry, centroid, fetched_at
        ) VALUES (
          ${input.itemId},
          ${input.provider},
          ${input.raw}::jsonb,
          ${Option.getOrNull(input.collection)},
          ${Option.getOrNull(input.acquired)},
          ${Option.getOrNull(input.published)},
          ${Option.getOrNull(input.updated)},
          ${Option.getOrNull(input.cloudCover)},
          ${Option.getOrNull(input.gsd)},
          ${Option.getOrNull(input.sunAzimuth)},
          ${Option.getOrNull(input.sunElevation)},
          ${
            hasBbox
              ? sql`ST_MakeEnvelope(
                  ${Option.getOrNull(input.bbox)?.[0] ?? 0},
                  ${Option.getOrNull(input.bbox)?.[1] ?? 0},
                  ${Option.getOrNull(input.bbox)?.[2] ?? 0},
                  ${Option.getOrNull(input.bbox)?.[3] ?? 0},
                  4326
                )::box2d`
              : sql`NULL`
          },
          ${
            hasBbox
              ? sql`ST_MakeEnvelope(
                  ${Option.getOrNull(input.bbox)?.[0] ?? 0},
                  ${Option.getOrNull(input.bbox)?.[1] ?? 0},
                  ${Option.getOrNull(input.bbox)?.[2] ?? 0},
                  ${Option.getOrNull(input.bbox)?.[3] ?? 0},
                  4326
                )`
              : sql`NULL`
          },
          ${
            hasCentroid
              ? sql`ST_SetSRID(ST_MakePoint(
                  ${Option.getOrElse(input.centroidLon, () => 0)},
                  ${Option.getOrElse(input.centroidLat, () => 0)}
                ), 4326)`
              : sql`NULL`
          },
          NOW()
        )
        ON CONFLICT (item_id, provider) DO UPDATE SET
          raw = EXCLUDED.raw,
          collection = EXCLUDED.collection,
          acquired = EXCLUDED.acquired,
          published = EXCLUDED.published,
          updated = EXCLUDED.updated,
          cloud_cover = EXCLUDED.cloud_cover,
          gsd = EXCLUDED.gsd,
          sun_azimuth = EXCLUDED.sun_azimuth,
          sun_elevation = EXCLUDED.sun_elevation,
          bbox = EXCLUDED.bbox,
          geometry = EXCLUDED.geometry,
          centroid = EXCLUDED.centroid,
          fetched_at = NOW()
      `,
      Effect.asVoid,
      Effect.mapError(mapError('insertItem'))
    )
  }

  const insertItems: ImageryRepository['insertItems'] = (inputs) => {
    if (inputs.length === 0) {
      return Effect.succeed(0)
    }

    return pipe(
      Effect.forEach(inputs, (input) => insertItem(input), { concurrency: 10 }),
      Effect.map((results) => results.length),
      Effect.mapError(mapError('insertItems'))
    )
  }

  // ---------------------------------------------------------------------------
  // Query Operations
  // ---------------------------------------------------------------------------

  const findItems: ImageryRepository['findItems'] = (options) => {
    const limit = options.limit ?? 100

    return pipe(
      options.bounds
        ? sql<{
            item_id: string
            provider: string
            raw: unknown
            collection: string | null
            acquired: Date | null
            published: Date | null
            updated: Date | null
            cloud_cover: number | null
            gsd: number | null
            sun_azimuth: number | null
            sun_elevation: number | null
            centroid_lon: number | null
            centroid_lat: number | null
            fetched_at: Date
          }>`
            SELECT
              item_id, provider, raw, collection,
              acquired, published, updated,
              cloud_cover, gsd, sun_azimuth, sun_elevation,
              ST_X(centroid) AS centroid_lon,
              ST_Y(centroid) AS centroid_lat,
              fetched_at
            FROM raw.imagery_items
            WHERE centroid && ST_MakeEnvelope(
              ${options.bounds[0]}, ${options.bounds[1]},
              ${options.bounds[2]}, ${options.bounds[3]}, 4326
            )
            ${options.provider ? sql`AND provider = ${options.provider}` : sql``}
            ${options.collection ? sql`AND collection = ${options.collection}` : sql``}
            ${options.acquiredFrom ? sql`AND acquired >= ${options.acquiredFrom}` : sql``}
            ${options.acquiredTo ? sql`AND acquired <= ${options.acquiredTo}` : sql``}
            ${options.maxCloudCover !== undefined ? sql`AND cloud_cover <= ${options.maxCloudCover}` : sql``}
            ${options.maxGsd !== undefined ? sql`AND gsd <= ${options.maxGsd}` : sql``}
            ORDER BY acquired DESC NULLS LAST
            LIMIT ${limit}
          `
        : sql<{
            item_id: string
            provider: string
            raw: unknown
            collection: string | null
            acquired: Date | null
            published: Date | null
            updated: Date | null
            cloud_cover: number | null
            gsd: number | null
            sun_azimuth: number | null
            sun_elevation: number | null
            centroid_lon: number | null
            centroid_lat: number | null
            fetched_at: Date
          }>`
            SELECT
              item_id, provider, raw, collection,
              acquired, published, updated,
              cloud_cover, gsd, sun_azimuth, sun_elevation,
              ST_X(centroid) AS centroid_lon,
              ST_Y(centroid) AS centroid_lat,
              fetched_at
            FROM raw.imagery_items
            WHERE 1=1
            ${options.provider ? sql`AND provider = ${options.provider}` : sql``}
            ${options.collection ? sql`AND collection = ${options.collection}` : sql``}
            ${options.acquiredFrom ? sql`AND acquired >= ${options.acquiredFrom}` : sql``}
            ${options.acquiredTo ? sql`AND acquired <= ${options.acquiredTo}` : sql``}
            ${options.maxCloudCover !== undefined ? sql`AND cloud_cover <= ${options.maxCloudCover}` : sql``}
            ${options.maxGsd !== undefined ? sql`AND gsd <= ${options.maxGsd}` : sql``}
            ORDER BY acquired DESC NULLS LAST
            LIMIT ${limit}
          `,
      Effect.map((rows) =>
        rows.map(
          (row): ImageryItemRow => ({
            _tag: 'ImageryItemRow',
            item_id: row.item_id,
            provider: row.provider,
            raw: row.raw,
            collection: row.collection,
            acquired: row.acquired ? DateTime.unsafeMake(row.acquired) : null,
            published: row.published
              ? DateTime.unsafeMake(row.published)
              : null,
            updated: row.updated ? DateTime.unsafeMake(row.updated) : null,
            cloud_cover: row.cloud_cover,
            gsd: row.gsd,
            sun_azimuth: row.sun_azimuth,
            sun_elevation: row.sun_elevation,
            centroid_lon: row.centroid_lon,
            centroid_lat: row.centroid_lat,
            fetched_at: DateTime.unsafeMake(row.fetched_at),
          })
        )
      ),
      Effect.mapError(mapError('findItems'))
    )
  }

  const findNearby: ImageryRepository['findNearby'] = (options) => {
    const limit = options.limit ?? 10
    const withinDays = options.withinDays ?? 30

    return pipe(
      sql<{
        item_id: string
        provider: string
        collection: string | null
        acquired: Date | null
        cloud_cover: number | null
        gsd: number | null
        centroid_lon: number | null
        centroid_lat: number | null
        distance_m: number
      }>`
        SELECT
          item_id, provider, collection, acquired,
          cloud_cover, gsd,
          ST_X(centroid) AS centroid_lon,
          ST_Y(centroid) AS centroid_lat,
          ST_Distance(
            centroid::geography,
            ST_SetSRID(ST_MakePoint(${options.longitude}, ${options.latitude}), 4326)::geography
          ) AS distance_m
        FROM raw.imagery_items
        WHERE ST_DWithin(
          centroid::geography,
          ST_SetSRID(ST_MakePoint(${options.longitude}, ${options.latitude}), 4326)::geography,
          ${options.radiusM}
        )
        AND acquired >= NOW() - (${withinDays} || ' days')::interval
        ${options.provider ? sql`AND provider = ${options.provider}` : sql``}
        ${options.maxCloudCover !== undefined ? sql`AND cloud_cover <= ${options.maxCloudCover}` : sql``}
        ORDER BY distance_m ASC, acquired DESC
        LIMIT ${limit}
      `,
      Effect.map((rows) =>
        rows.map(
          (row): ImagerySearchResult => ({
            _tag: 'ImagerySearchResult',
            item_id: row.item_id,
            provider: row.provider,
            collection: row.collection,
            acquired: row.acquired ? DateTime.unsafeMake(row.acquired) : null,
            cloud_cover: row.cloud_cover,
            gsd: row.gsd,
            centroid_lon: row.centroid_lon,
            centroid_lat: row.centroid_lat,
            distance_m: Option.some(row.distance_m),
          })
        )
      ),
      Effect.mapError(mapError('findNearby'))
    )
  }

  const findItem: ImageryRepository['findItem'] = (itemId, provider) =>
    pipe(
      sql<{
        item_id: string
        provider: string
        raw: unknown
        collection: string | null
        acquired: Date | null
        published: Date | null
        updated: Date | null
        cloud_cover: number | null
        gsd: number | null
        sun_azimuth: number | null
        sun_elevation: number | null
        centroid_lon: number | null
        centroid_lat: number | null
        fetched_at: Date
      }>`
        SELECT
          item_id, provider, raw, collection,
          acquired, published, updated,
          cloud_cover, gsd, sun_azimuth, sun_elevation,
          ST_X(centroid) AS centroid_lon,
          ST_Y(centroid) AS centroid_lat,
          fetched_at
        FROM raw.imagery_items
        WHERE item_id = ${itemId} AND provider = ${provider}
        LIMIT 1
      `,
      Effect.map((rows) =>
        rows.length > 0
          ? Option.some<ImageryItemRow>({
              _tag: 'ImageryItemRow',
              item_id: rows[0].item_id,
              provider: rows[0].provider,
              raw: rows[0].raw,
              collection: rows[0].collection,
              acquired: rows[0].acquired
                ? DateTime.unsafeMake(rows[0].acquired)
                : null,
              published: rows[0].published
                ? DateTime.unsafeMake(rows[0].published)
                : null,
              updated: rows[0].updated
                ? DateTime.unsafeMake(rows[0].updated)
                : null,
              cloud_cover: rows[0].cloud_cover,
              gsd: rows[0].gsd,
              sun_azimuth: rows[0].sun_azimuth,
              sun_elevation: rows[0].sun_elevation,
              centroid_lon: rows[0].centroid_lon,
              centroid_lat: rows[0].centroid_lat,
              fetched_at: DateTime.unsafeMake(rows[0].fetched_at),
            })
          : Option.none()
      ),
      Effect.mapError(mapError('findItem'))
    )

  const findRecent: ImageryRepository['findRecent'] = (options = {}) => {
    const limit = options.limit ?? 20

    return pipe(
      sql<{
        item_id: string
        provider: string
        raw: unknown
        collection: string | null
        acquired: Date | null
        published: Date | null
        updated: Date | null
        cloud_cover: number | null
        gsd: number | null
        sun_azimuth: number | null
        sun_elevation: number | null
        centroid_lon: number | null
        centroid_lat: number | null
        fetched_at: Date
      }>`
        SELECT
          item_id, provider, raw, collection,
          acquired, published, updated,
          cloud_cover, gsd, sun_azimuth, sun_elevation,
          ST_X(centroid) AS centroid_lon,
          ST_Y(centroid) AS centroid_lat,
          fetched_at
        FROM raw.imagery_items
        WHERE acquired IS NOT NULL
        ${options.provider ? sql`AND provider = ${options.provider}` : sql``}
        ${options.collection ? sql`AND collection = ${options.collection}` : sql``}
        ORDER BY acquired DESC
        LIMIT ${limit}
      `,
      Effect.map((rows) =>
        rows.map(
          (row): ImageryItemRow => ({
            _tag: 'ImageryItemRow',
            item_id: row.item_id,
            provider: row.provider,
            raw: row.raw,
            collection: row.collection,
            acquired: row.acquired ? DateTime.unsafeMake(row.acquired) : null,
            published: row.published
              ? DateTime.unsafeMake(row.published)
              : null,
            updated: row.updated ? DateTime.unsafeMake(row.updated) : null,
            cloud_cover: row.cloud_cover,
            gsd: row.gsd,
            sun_azimuth: row.sun_azimuth,
            sun_elevation: row.sun_elevation,
            centroid_lon: row.centroid_lon,
            centroid_lat: row.centroid_lat,
            fetched_at: DateTime.unsafeMake(row.fetched_at),
          })
        )
      ),
      Effect.mapError(mapError('findRecent'))
    )
  }

  // ---------------------------------------------------------------------------
  // Analytics
  // ---------------------------------------------------------------------------

  const countItems: ImageryRepository['countItems'] = (options = {}) =>
    pipe(
      options.bounds
        ? sql<{ count: string }>`
            SELECT COUNT(*)::text AS count
            FROM raw.imagery_items
            WHERE centroid && ST_MakeEnvelope(
              ${options.bounds[0]}, ${options.bounds[1]},
              ${options.bounds[2]}, ${options.bounds[3]}, 4326
            )
            ${options.provider ? sql`AND provider = ${options.provider}` : sql``}
            ${options.collection ? sql`AND collection = ${options.collection}` : sql``}
            ${options.acquiredFrom ? sql`AND acquired >= ${options.acquiredFrom}` : sql``}
            ${options.acquiredTo ? sql`AND acquired <= ${options.acquiredTo}` : sql``}
            ${options.maxCloudCover !== undefined ? sql`AND cloud_cover <= ${options.maxCloudCover}` : sql``}
          `
        : sql<{ count: string }>`
            SELECT COUNT(*)::text AS count
            FROM raw.imagery_items
            WHERE 1=1
            ${options.provider ? sql`AND provider = ${options.provider}` : sql``}
            ${options.collection ? sql`AND collection = ${options.collection}` : sql``}
            ${options.acquiredFrom ? sql`AND acquired >= ${options.acquiredFrom}` : sql``}
            ${options.acquiredTo ? sql`AND acquired <= ${options.acquiredTo}` : sql``}
            ${options.maxCloudCover !== undefined ? sql`AND cloud_cover <= ${options.maxCloudCover}` : sql``}
          `,
      Effect.map((rows) => parseInt(rows[0]?.count ?? '0', 10)),
      Effect.mapError(mapError('countItems'))
    )

  const getCollectionStats: ImageryRepository['getCollectionStats'] = (
    provider
  ) =>
    pipe(
      sql<{
        provider: string
        collection: string
        item_count: string
        avg_cloud_cover: number | null
        avg_gsd: number | null
        oldest_acquired: Date | null
        newest_acquired: Date | null
      }>`
        SELECT
          provider,
          COALESCE(collection, 'unknown') AS collection,
          COUNT(*)::text AS item_count,
          AVG(cloud_cover) AS avg_cloud_cover,
          AVG(gsd) AS avg_gsd,
          MIN(acquired) AS oldest_acquired,
          MAX(acquired) AS newest_acquired
        FROM raw.imagery_items
        WHERE 1=1
        ${provider ? sql`AND provider = ${provider}` : sql``}
        GROUP BY provider, collection
        ORDER BY provider, item_count DESC
      `,
      Effect.map((rows) =>
        rows.map((row) => ({
          provider: row.provider,
          collection: row.collection,
          item_count: parseInt(row.item_count, 10),
          avg_cloud_cover: row.avg_cloud_cover,
          avg_gsd: row.avg_gsd,
          oldest_acquired: row.oldest_acquired
            ? DateTime.unsafeMake(row.oldest_acquired)
            : null,
          newest_acquired: row.newest_acquired
            ? DateTime.unsafeMake(row.newest_acquired)
            : null,
        }))
      ),
      Effect.mapError(mapError('getCollectionStats'))
    )

  const deleteOlderThan: ImageryRepository['deleteOlderThan'] = (days) =>
    pipe(
      sql<{ count: string }>`
        WITH deleted AS (
          DELETE FROM raw.imagery_items
          WHERE fetched_at < NOW() - (${days} || ' days')::interval
          RETURNING item_id
        )
        SELECT COUNT(*)::text AS count FROM deleted
      `,
      Effect.map((rows) => parseInt(rows[0]?.count ?? '0', 10)),
      Effect.mapError(mapError('deleteOlderThan'))
    )

  // ---------------------------------------------------------------------------
  // Return Repository
  // ---------------------------------------------------------------------------

  return {
    insertItem,
    insertItems,
    findItems,
    findNearby,
    findItem,
    findRecent,
    countItems,
    getCollectionStats,
    deleteOlderThan,
  } satisfies ImageryRepository
})

// =============================================================================
// Repository Layer
// =============================================================================

/**
 * Live layer for ImageryRepository
 * Requires PgClient.PgClient
 */
export const ImageryRepositoryLive = Layer.effect(
  ImageryRepositoryTag,
  makeImageryRepository
)
