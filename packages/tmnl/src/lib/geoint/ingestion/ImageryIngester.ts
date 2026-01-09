/**
 * ImageryIngester - Continuous satellite imagery metadata ingestion service
 *
 * Polls Planet Labs and Sentinel Hub APIs on configurable intervals for regions,
 * transforms responses to ImageryItemInput, and inserts into raw.imagery_items.
 *
 * Features:
 * - Configurable ingestion regions (bounding boxes with provider selection)
 * - Independent polling intervals per region
 * - Cloud cover filtering (max percentage threshold)
 * - Lookback window for recent acquisitions
 * - Graceful error handling (logs failures, continues ingestion)
 * - Ingestion metrics logging to raw.ingestion_log
 *
 * Rate limits:
 * - Planet Labs: 30 req/min (API key required)
 * - Sentinel Hub: 30 req/min (OAuth2 required)
 *
 * @see beads:tmnl-imagery-ingester ImageryIngester service
 * @module
 */

import {
  Effect,
  Layer,
  Context,
  Schedule,
  Duration,
  Option,
  Schema,
  Fiber,
  pipe,
} from 'effect'
import { PgClient } from '@effect/sql-pg'
import { PlanetItem, SentinelItem } from '../schemas'
import {
  PlanetLabsClientService,
  SentinelHubClientService,
  type ExternalApiError,
  type RateLimitError,
  type TimeoutError,
} from '../api/ExternalApiClient'
import {
  ImageryRepositoryTag,
  type ImageryItemInput,
} from '../persistence/postgis/ImageryRepository'

// =============================================================================
// Schemas
// =============================================================================

/**
 * Imagery provider type
 */
export const ImageryProviderType = Schema.Literal('planet', 'sentinel')
export type ImageryProviderType = typeof ImageryProviderType.Type

/**
 * Imagery ingestion region configuration
 */
export const ImageryIngestionRegion = Schema.Struct({
  /** Region name for logging */
  name: Schema.String,
  /** Bounding box [minLon, minLat, maxLon, maxLat] */
  bounds: Schema.Tuple(Schema.Number, Schema.Number, Schema.Number, Schema.Number),
  /** Providers to poll for this region (default: both) */
  providers: Schema.optionalWith(
    Schema.Array(ImageryProviderType),
    { default: () => ['planet', 'sentinel'] as ImageryProviderType[] }
  ),
  /** Maximum cloud cover percentage (0-100, default: 30) */
  maxCloudCover: Schema.optionalWith(
    Schema.Number.pipe(Schema.between(0, 100)),
    { default: () => 30 }
  ),
  /** TTL for cached items in days (default: 90) */
  ttlDays: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { default: () => 90 }),
})
export type ImageryIngestionRegion = typeof ImageryIngestionRegion.Type

/**
 * ImageryIngester configuration
 */
export const ImageryIngesterConfig = Schema.Struct({
  /** Regions to poll */
  regions: Schema.Array(ImageryIngestionRegion),
  /** Polling interval in milliseconds (default: 3600000 = 1 hour) */
  intervalMs: Schema.optionalWith(Schema.Number, { default: () => 3600000 }),
  /** Query timeout in milliseconds (default: 60000 = 60 seconds) */
  queryTimeoutMs: Schema.optionalWith(Schema.Number, { default: () => 60000 }),
  /** Enable ingestion logging to raw.ingestion_log */
  logIngestion: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  /** Planet item types to search (default: ['PSScene']) */
  planetItemTypes: Schema.optionalWith(
    Schema.Array(Schema.String),
    { default: () => ['PSScene'] }
  ),
  /** Sentinel collections to search (default: ['sentinel-2-l2a']) */
  sentinelCollections: Schema.optionalWith(
    Schema.Array(Schema.String),
    { default: () => ['sentinel-2-l2a'] }
  ),
  /** Lookback days for recent acquisitions (default: 3) */
  lookbackDays: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), { default: () => 3 }),
})
export type ImageryIngesterConfig = typeof ImageryIngesterConfig.Type

/**
 * Default ingestion regions
 */
export const DEFAULT_IMAGERY_INGESTION_REGIONS: readonly ImageryIngestionRegion[] = [
  {
    name: 'sf-bay-area',
    bounds: [-122.6, 37.3, -121.8, 37.9],
    providers: ['planet', 'sentinel'],
    maxCloudCover: 30,
    ttlDays: 90,
  },
]

/**
 * Default ImageryIngester configuration
 */
export const DEFAULT_IMAGERY_INGESTER_CONFIG: ImageryIngesterConfig = {
  regions: [...DEFAULT_IMAGERY_INGESTION_REGIONS],
  intervalMs: 3600000, // 1 hour
  queryTimeoutMs: 60000,
  logIngestion: true,
  planetItemTypes: ['PSScene'],
  sentinelCollections: ['sentinel-2-l2a'],
  lookbackDays: 3,
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert Planet cloud cover (0-1 decimal) to percentage (0-100)
 */
export const convertPlanetCloudCover = (cloudCover: number): number =>
  Math.round(cloudCover * 100)

/**
 * Pass Sentinel cloud cover through (already percentage 0-100)
 */
export const convertSentinelCloudCover = (cloudCover: number): number =>
  cloudCover

/**
 * GeoJSON Polygon type for geometry extraction
 */
interface GeoJsonPolygon {
  type: 'Polygon'
  coordinates: readonly [readonly (readonly [number, number])[]]
}

/**
 * Compute bounding box from GeoJSON polygon
 * Returns [minLon, minLat, maxLon, maxLat]
 */
export const computeBboxFromPolygon = (
  polygon: GeoJsonPolygon
): readonly [number, number, number, number] => {
  const ring = polygon.coordinates[0]
  if (!ring || ring.length === 0) {
    return [0, 0, 0, 0]
  }

  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity

  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon
    if (lon > maxLon) maxLon = lon
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }

  return [minLon, minLat, maxLon, maxLat]
}

/**
 * Compute centroid from bounding box
 */
export const computeCentroidFromBbox = (
  bbox: readonly [number, number, number, number]
): { lon: number; lat: number } => ({
  lon: (bbox[0] + bbox[2]) / 2,
  lat: (bbox[1] + bbox[3]) / 2,
})

// =============================================================================
// Transformers
// =============================================================================

/**
 * Transform Planet item to ImageryItemInput
 */
export const planetItemToImageryInput = (
  item: PlanetItem,
  raw: unknown
): ImageryItemInput => {
  // Extract bbox from geometry if present
  let bbox: Option.Option<readonly [number, number, number, number]> = Option.none()
  let centroidLon: Option.Option<number> = Option.none()
  let centroidLat: Option.Option<number> = Option.none()

  if (item.geometry && typeof item.geometry === 'object') {
    const geo = item.geometry as { type?: string; coordinates?: unknown }
    if (geo.type === 'Polygon') {
      const polygon = geo as GeoJsonPolygon
      const computedBbox = computeBboxFromPolygon(polygon)
      bbox = Option.some(computedBbox)
      const centroid = computeCentroidFromBbox(computedBbox)
      centroidLon = Option.some(centroid.lon)
      centroidLat = Option.some(centroid.lat)
    }
  }

  // Convert cloud cover from decimal (0-1) to percentage (0-100)
  const cloudCover = item.cloudCover !== undefined
    ? Option.some(convertPlanetCloudCover(item.cloudCover))
    : Option.none()

  return {
    _tag: 'ImageryItemInput',
    itemId: item.id,
    provider: 'planet',
    raw,
    collection: Option.some(item.itemType),
    acquired: Option.some(item.acquired),
    published: Option.some(item.published),
    updated: Option.none(),
    cloudCover,
    gsd: item.gsd !== undefined ? Option.some(item.gsd) : Option.none(),
    sunAzimuth: item.sunAzimuth !== undefined ? Option.some(item.sunAzimuth) : Option.none(),
    sunElevation: item.sunElevation !== undefined ? Option.some(item.sunElevation) : Option.none(),
    bbox,
    centroidLon,
    centroidLat,
  }
}

/**
 * Transform Sentinel item to ImageryItemInput
 */
export const sentinelItemToImageryInput = (
  item: SentinelItem,
  raw: unknown
): ImageryItemInput => {
  // Use bbox directly if present
  let bbox: Option.Option<readonly [number, number, number, number]> = Option.none()
  let centroidLon: Option.Option<number> = Option.none()
  let centroidLat: Option.Option<number> = Option.none()

  if (item.bbox && item.bbox.length === 4) {
    bbox = Option.some([item.bbox[0], item.bbox[1], item.bbox[2], item.bbox[3]] as const)
    const centroid = computeCentroidFromBbox([item.bbox[0], item.bbox[1], item.bbox[2], item.bbox[3]])
    centroidLon = Option.some(centroid.lon)
    centroidLat = Option.some(centroid.lat)
  }

  // Sentinel cloud cover is already percentage (0-100)
  const cloudCover = item.cloudCover !== undefined
    ? Option.some(convertSentinelCloudCover(item.cloudCover))
    : Option.none()

  return {
    _tag: 'ImageryItemInput',
    itemId: item.id,
    provider: 'sentinel',
    raw,
    collection: item.collection !== undefined ? Option.some(item.collection) : Option.none(),
    acquired: Option.some(item.datetime),
    published: Option.none(),
    updated: Option.none(),
    cloudCover,
    gsd: item.gsd !== undefined ? Option.some(item.gsd) : Option.none(),
    sunAzimuth: item.sunAzimuth !== undefined ? Option.some(item.sunAzimuth) : Option.none(),
    sunElevation: item.sunElevation !== undefined ? Option.some(item.sunElevation) : Option.none(),
    bbox,
    centroidLon,
    centroidLat,
  }
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * ImageryIngester error
 */
export class ImageryIngesterError extends Schema.TaggedError<ImageryIngesterError>()(
  'ImageryIngesterError',
  {
    source: Schema.Literal('planet', 'sentinel', 'internal'),
    operation: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

// =============================================================================
// Ingestion Result
// =============================================================================

/**
 * Result of a single imagery ingestion operation
 */
export interface ImageryIngestionResult {
  readonly source: 'planet' | 'sentinel'
  readonly region: string
  readonly recordsIngested: number
  readonly recordsFiltered: number
  readonly latencyMs: number
  readonly error?: string
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * ImageryIngester service interface
 */
export interface ImageryIngester {
  /**
   * Ingest imagery data for a specific region from all configured providers
   */
  readonly ingestRegion: (
    region: ImageryIngestionRegion
  ) => Effect.Effect<readonly ImageryIngestionResult[], ImageryIngesterError>

  /**
   * Ingest imagery from Planet Labs for a region
   */
  readonly ingestPlanet: (
    region: ImageryIngestionRegion
  ) => Effect.Effect<ImageryIngestionResult, ImageryIngesterError>

  /**
   * Ingest imagery from Sentinel Hub for a region
   */
  readonly ingestSentinel: (
    region: ImageryIngestionRegion
  ) => Effect.Effect<ImageryIngestionResult, ImageryIngesterError>

  /**
   * Start continuous ingestion for all configured regions
   * Returns fiber handle for the polling loop
   */
  readonly start: () => Effect.Effect<
    Fiber.RuntimeFiber<void, ImageryIngesterError>,
    ImageryIngesterError
  >

  /**
   * Stop ingestion fiber
   */
  readonly stop: (
    fiber: Fiber.RuntimeFiber<void, ImageryIngesterError>
  ) => Effect.Effect<void, never>

  /**
   * Get the current configuration
   */
  readonly config: ImageryIngesterConfig
}

// =============================================================================
// Service Tag
// =============================================================================

/**
 * ImageryIngester service tag
 */
export class ImageryIngesterTag extends Context.Tag('geoint/ImageryIngester')<
  ImageryIngesterTag,
  ImageryIngester
>() {}

/**
 * ImageryIngester config tag
 */
export class ImageryIngesterConfigTag extends Context.Tag('geoint/ImageryIngesterConfig')<
  ImageryIngesterConfigTag,
  ImageryIngesterConfig
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Create ImageryIngester service
 */
export const makeImageryIngester = Effect.gen(function* () {
  const config = yield* ImageryIngesterConfigTag
  const imageryRepo = yield* ImageryRepositoryTag
  const planetClient = yield* Effect.serviceOption(PlanetLabsClientService)
  const sentinelClient = yield* Effect.serviceOption(SentinelHubClientService)
  const sql = yield* PgClient.PgClient

  /**
   * Log ingestion result to raw.ingestion_log
   */
  const logIngestion = (result: ImageryIngestionResult): Effect.Effect<void, never> => {
    if (!config.logIngestion) return Effect.void

    return pipe(
      sql`
        INSERT INTO raw.ingestion_log (time, source, operation, records_ingested, latency_ms, error)
        VALUES (
          NOW(),
          ${result.source},
          ${'ingest:imagery:' + result.region},
          ${result.recordsIngested},
          ${result.latencyMs},
          ${result.error ?? null}
        )
      `,
      Effect.asVoid,
      Effect.catchAll(() => Effect.void) // Don't fail ingestion if logging fails
    )
  }

  /**
   * Get lookback date for query
   */
  const getLookbackDate = (): string => {
    const date = new Date()
    date.setDate(date.getDate() - config.lookbackDays)
    return date.toISOString()
  }

  /**
   * Build bounding box GeoJSON polygon for Planet API
   */
  const boundsToGeoJson = (bounds: readonly [number, number, number, number]): unknown => ({
    type: 'Polygon',
    coordinates: [[
      [bounds[0], bounds[1]],
      [bounds[2], bounds[1]],
      [bounds[2], bounds[3]],
      [bounds[0], bounds[3]],
      [bounds[0], bounds[1]],
    ]],
  })

  /**
   * Ingest imagery from Planet Labs
   */
  const ingestPlanet: ImageryIngester['ingestPlanet'] = (region) =>
    Effect.gen(function* () {
      const startTime = Date.now()

      if (Option.isNone(planetClient)) {
        return {
          source: 'planet' as const,
          region: region.name,
          recordsIngested: 0,
          recordsFiltered: 0,
          latencyMs: Date.now() - startTime,
          error: 'Planet Labs client not available',
        }
      }

      const client = planetClient.value

      // Query Planet Labs
      const fetchResult = yield* client.quickSearch({
        geometry: boundsToGeoJson(region.bounds),
        itemTypes: config.planetItemTypes as readonly ('PSScene' | 'SkySatCollect' | 'SkySatScene' | 'SkySatVideo' | 'REOrthoTile' | 'REScene' | 'Landsat8L1G' | 'Sentinel2L1C' | 'PSOrthoTile')[],
        acquiredGte: getLookbackDate(),
        maxCloudCover: region.maxCloudCover / 100, // Convert percentage to decimal
      }).pipe(
        Effect.map((response) => ({ _tag: 'success' as const, response })),
        Effect.catchAll((error: ExternalApiError | RateLimitError | TimeoutError) =>
          Effect.succeed({ _tag: 'error' as const, message: error.message })
        )
      )

      if (fetchResult._tag === 'error') {
        yield* Effect.logWarning(`Planet fetch failed for ${region.name}: ${fetchResult.message}`)
        return {
          source: 'planet' as const,
          region: region.name,
          recordsIngested: 0,
          recordsFiltered: 0,
          latencyMs: Date.now() - startTime,
          error: fetchResult.message,
        }
      }

      // Transform to ImageryItemInput
      const items = fetchResult.response.items

      // Filter by cloud cover
      const filtered = items.filter((item) => {
        const cloudCover = item.cloudCover ?? 0
        const cloudCoverPct = convertPlanetCloudCover(cloudCover)
        return cloudCoverPct <= region.maxCloudCover
      })

      const inputs = filtered.map((item) =>
        planetItemToImageryInput(item, item)
      )

      // Insert into database
      const insertedCount = yield* imageryRepo.insertItems(inputs).pipe(
        Effect.catchAll((error) =>
          Effect.logWarning(`Planet insert failed: ${error.message}`).pipe(
            Effect.as(0)
          )
        )
      )

      const result: ImageryIngestionResult = {
        source: 'planet',
        region: region.name,
        recordsIngested: insertedCount,
        recordsFiltered: items.length - filtered.length,
        latencyMs: Date.now() - startTime,
      }

      yield* logIngestion(result)
      yield* Effect.logDebug(`Planet ${region.name}: ${insertedCount} items ingested, ${result.recordsFiltered} filtered`)

      return result
    })

  /**
   * Ingest imagery from Sentinel Hub
   */
  const ingestSentinel: ImageryIngester['ingestSentinel'] = (region) =>
    Effect.gen(function* () {
      const startTime = Date.now()

      if (Option.isNone(sentinelClient)) {
        return {
          source: 'sentinel' as const,
          region: region.name,
          recordsIngested: 0,
          recordsFiltered: 0,
          latencyMs: Date.now() - startTime,
          error: 'Sentinel Hub client not available',
        }
      }

      const client = sentinelClient.value

      // Query Sentinel Hub
      const fetchResult = yield* client.search({
        collections: config.sentinelCollections as readonly ('sentinel-1-grd' | 'sentinel-2-l1c' | 'sentinel-2-l2a' | 'landsat-ot-l1' | 'landsat-ot-l2' | 'dem' | 'modis' | 'byoc')[],
        bbox: region.bounds,
        datetimeGte: getLookbackDate(),
        limit: 100,
      }).pipe(
        Effect.map((response) => ({ _tag: 'success' as const, response })),
        Effect.catchAll((error: ExternalApiError | RateLimitError | TimeoutError) =>
          Effect.succeed({ _tag: 'error' as const, message: error.message })
        )
      )

      if (fetchResult._tag === 'error') {
        yield* Effect.logWarning(`Sentinel fetch failed for ${region.name}: ${fetchResult.message}`)
        return {
          source: 'sentinel' as const,
          region: region.name,
          recordsIngested: 0,
          recordsFiltered: 0,
          latencyMs: Date.now() - startTime,
          error: fetchResult.message,
        }
      }

      // Transform to ImageryItemInput
      const items = fetchResult.response.items

      // Filter by cloud cover
      const filtered = items.filter((item) => {
        const cloudCover = item.cloudCover ?? 0
        return cloudCover <= region.maxCloudCover
      })

      const inputs = filtered.map((item) =>
        sentinelItemToImageryInput(item, item)
      )

      // Insert into database
      const insertedCount = yield* imageryRepo.insertItems(inputs).pipe(
        Effect.catchAll((error) =>
          Effect.logWarning(`Sentinel insert failed: ${error.message}`).pipe(
            Effect.as(0)
          )
        )
      )

      const result: ImageryIngestionResult = {
        source: 'sentinel',
        region: region.name,
        recordsIngested: insertedCount,
        recordsFiltered: items.length - filtered.length,
        latencyMs: Date.now() - startTime,
      }

      yield* logIngestion(result)
      yield* Effect.logDebug(`Sentinel ${region.name}: ${insertedCount} items ingested, ${result.recordsFiltered} filtered`)

      return result
    })

  /**
   * Ingest imagery from all providers for a region
   */
  const ingestRegion: ImageryIngester['ingestRegion'] = (region) =>
    Effect.gen(function* () {
      const results: ImageryIngestionResult[] = []

      for (const provider of region.providers) {
        if (provider === 'planet') {
          const result = yield* ingestPlanet(region).pipe(
            Effect.catchAll((error) => Effect.succeed({
              source: 'planet' as const,
              region: region.name,
              recordsIngested: 0,
              recordsFiltered: 0,
              latencyMs: 0,
              error: error.message,
            }))
          )
          results.push(result)
        } else if (provider === 'sentinel') {
          const result = yield* ingestSentinel(region).pipe(
            Effect.catchAll((error) => Effect.succeed({
              source: 'sentinel' as const,
              region: region.name,
              recordsIngested: 0,
              recordsFiltered: 0,
              latencyMs: 0,
              error: error.message,
            }))
          )
          results.push(result)
        }
      }

      return results
    })

  /**
   * Start continuous ingestion
   */
  const start: ImageryIngester['start'] = () =>
    Effect.gen(function* () {
      yield* Effect.logInfo('Starting imagery ingestion service')
      yield* Effect.logInfo(`Regions: ${config.regions.map((r) => r.name).join(', ')}`)

      // Create polling loop
      const pollingLoop = pipe(
        Effect.forEach(
          config.regions,
          (region) =>
            ingestRegion(region).pipe(
              Effect.catchAll((error) => {
                return Effect.logWarning(`Imagery ingestion error: ${error.message}`)
              })
            ),
          { concurrency: 1 } // Sequential to respect rate limits
        ),
        Effect.repeat(Schedule.spaced(Duration.millis(config.intervalMs))),
        Effect.asVoid
      )

      // Fork the loop
      const fiber = yield* Effect.fork(pollingLoop)

      yield* Effect.logInfo('Imagery ingestion started')

      return fiber
    })

  /**
   * Stop ingestion fiber
   */
  const stop: ImageryIngester['stop'] = (fiber) =>
    Effect.gen(function* () {
      yield* Effect.logInfo('Stopping imagery ingestion service')
      yield* Fiber.interrupt(fiber)
      yield* Effect.logInfo('Imagery ingestion stopped')
    })

  return {
    ingestRegion,
    ingestPlanet,
    ingestSentinel,
    start,
    stop,
    config,
  } satisfies ImageryIngester
})

// =============================================================================
// Layers
// =============================================================================

/**
 * Default ImageryIngester config layer
 */
export const ImageryIngesterConfigDefault = Layer.succeed(
  ImageryIngesterConfigTag,
  DEFAULT_IMAGERY_INGESTER_CONFIG
)

/**
 * ImageryIngester service layer
 *
 * Requires:
 * - ImageryIngesterConfigTag
 * - ImageryRepositoryTag
 * - PgClient.PgClient
 * - PlanetLabsClientService (optional)
 * - SentinelHubClientService (optional)
 */
export const ImageryIngesterLive = Layer.effect(ImageryIngesterTag, makeImageryIngester)

/**
 * ImageryIngester with default config
 *
 * Requires:
 * - ImageryRepositoryTag
 * - PgClient.PgClient
 * - PlanetLabsClientService (optional)
 * - SentinelHubClientService (optional)
 */
export const ImageryIngesterDefault = ImageryIngesterLive.pipe(
  Layer.provide(ImageryIngesterConfigDefault)
)
