/**
 * OsmIngester - POI data ingestion from OpenStreetMap via Overpass API
 *
 * Polls the Overpass API for POI data within configured regions,
 * transforms responses to PoiInput, and upserts into raw.osm_elements.
 *
 * Features:
 * - Configurable ingestion regions (bounding boxes)
 * - Configurable amenity/tag filters
 * - Cache-aware: respects TTL, only refreshes stale data
 * - Graceful error handling (logs failures, continues ingestion)
 *
 * Rate limits:
 * - Overpass: ~20 req/min (conservative, actual varies by server load)
 *
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
import { OverpassElement } from '../schemas'
import {
  OverpassClientService,
  type ExternalApiError,
  type RateLimitError,
  type TimeoutError,
} from '../api/ExternalApiClient'
import {
  PoiRepositoryTag,
  type PoiInput,
  type OsmType,
} from '../persistence/postgis/PoiRepository'
import { OsmStreamHandle } from '../services/OsmStreamHandle'
import { PoiPositionEvent, type PoiSource } from '../schemas/poi-events'
import type { PoiCategory } from '../schemas/search'

// =============================================================================
// Schemas
// =============================================================================

/**
 * OSM ingestion region configuration
 */
export const OsmIngestionRegion = Schema.Struct({
  /** Region name for logging */
  name: Schema.String,
  /** Bounding box [minLon, minLat, maxLon, maxLat] */
  bounds: Schema.Tuple(Schema.Number, Schema.Number, Schema.Number, Schema.Number),
  /** Amenity types to fetch (e.g., 'restaurant', 'hospital') */
  amenities: Schema.optionalWith(Schema.Array(Schema.String), {
    default: () => ['restaurant', 'cafe', 'hospital', 'pharmacy', 'fuel', 'bank'],
  }),
  /** Additional tags to filter (e.g., { shop: 'supermarket' }) */
  tags: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.String }), {
    default: () => ({}),
  }),
  /** TTL in days for cached POIs (default: 7) */
  ttlDays: Schema.optionalWith(Schema.Number, { default: () => 7 }),
})
export type OsmIngestionRegion = typeof OsmIngestionRegion.Type

/**
 * OsmIngester configuration
 */
export const OsmIngesterConfig = Schema.Struct({
  /** Regions to poll */
  regions: Schema.Array(OsmIngestionRegion),
  /** Polling interval in milliseconds (default: 300000 = 5 min) */
  intervalMs: Schema.optionalWith(Schema.Number, { default: () => 300000 }),
  /** Timeout per query in milliseconds */
  queryTimeoutMs: Schema.optionalWith(Schema.Number, { default: () => 60000 }),
  /** Enable ingestion logging */
  logIngestion: Schema.optionalWith(Schema.Boolean, { default: () => true }),
})
export type OsmIngesterConfig = typeof OsmIngesterConfig.Type

/**
 * Default ingestion regions
 */
export const DEFAULT_OSM_INGESTION_REGIONS: readonly OsmIngestionRegion[] = [
  {
    name: 'sf-bay-area',
    bounds: [-122.6, 37.3, -121.8, 37.9],
    amenities: ['restaurant', 'cafe', 'hospital', 'pharmacy', 'fuel', 'bank', 'atm'],
    tags: {},
    ttlDays: 7,
  },
]

/**
 * Default OsmIngester configuration
 */
export const DEFAULT_OSM_INGESTER_CONFIG: OsmIngesterConfig = {
  regions: [...DEFAULT_OSM_INGESTION_REGIONS],
  intervalMs: 300000, // 5 minutes
  queryTimeoutMs: 60000,
  logIngestion: true,
}

// =============================================================================
// Transformers
// =============================================================================

/**
 * Transform OverpassElement to PoiInput
 */
export const overpassElementToPoiInput = (
  element: OverpassElement,
  raw: unknown,
  queryBbox: readonly [number, number, number, number],
  ttlDays: number
): PoiInput | null => {
  // Get centroid coordinates
  let centroidLon: number | undefined
  let centroidLat: number | undefined

  if (element.lat !== undefined && element.lon !== undefined) {
    // Node with direct coordinates
    centroidLon = element.lon
    centroidLat = element.lat
  } else if (element.center) {
    // Way/relation with center
    centroidLon = element.center.lon
    centroidLat = element.center.lat
  }

  // Skip elements without any position
  if (centroidLon === undefined || centroidLat === undefined) {
    return null
  }

  // Build GeoJSON geometry
  const geometry = {
    type: 'Point' as const,
    coordinates: [centroidLon, centroidLat],
  }

  return {
    _tag: 'PoiInput',
    osmId: BigInt(element.id),
    osmType: element.type as OsmType,
    raw,
    geometry,
    centroidLon: Option.some(centroidLon),
    centroidLat: Option.some(centroidLat),
    tags: element.tags,
    queryBbox: Option.some(queryBbox),
    ttlDays: Option.some(ttlDays),
  }
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * OsmIngester error
 */
export class OsmIngesterError extends Schema.TaggedError<OsmIngesterError>()(
  'OsmIngesterError',
  {
    operation: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

// =============================================================================
// Ingestion Result
// =============================================================================

/**
 * Result of a single ingestion operation
 */
export interface OsmIngestionResult {
  readonly region: string
  readonly recordsIngested: number
  readonly latencyMs: number
  readonly error?: string
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * OsmIngester service interface
 */
export interface OsmIngester {
  /**
   * Ingest OSM POI data for a specific region
   */
  readonly ingestRegion: (
    region: OsmIngestionRegion
  ) => Effect.Effect<OsmIngestionResult, OsmIngesterError>

  /**
   * Start continuous ingestion for all configured regions
   * Returns fiber handle for the polling loop
   */
  readonly start: () => Effect.Effect<
    Fiber.RuntimeFiber<void, OsmIngesterError>,
    OsmIngesterError
  >

  /**
   * Stop the ingestion fiber
   */
  readonly stop: (
    fiber: Fiber.RuntimeFiber<void, OsmIngesterError>
  ) => Effect.Effect<void, never>

  /**
   * Get the current configuration
   */
  readonly config: OsmIngesterConfig
}

// =============================================================================
// Service Tag
// =============================================================================

/**
 * OsmIngester service tag
 */
export class OsmIngesterTag extends Context.Tag('geoint/OsmIngester')<
  OsmIngesterTag,
  OsmIngester
>() {}

/**
 * OsmIngester config tag
 */
export class OsmIngesterConfigTag extends Context.Tag('geoint/OsmIngesterConfig')<
  OsmIngesterConfigTag,
  OsmIngesterConfig
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Create OsmIngester service
 */
export const makeOsmIngester = Effect.gen(function* () {
  const config = yield* OsmIngesterConfigTag
  const poiRepo = yield* PoiRepositoryTag
  const overpassClient = yield* Effect.serviceOption(OverpassClientService)
  const osmStream = yield* Effect.serviceOption(OsmStreamHandle)
  const sql = yield* PgClient.PgClient

  /**
   * Map OSM tags to PoiCategory (OSM tag key type).
   * Returns 'amenity' for most POIs since that's the primary OSM tag.
   */
  const getPoiCategory = (tags: Record<string, string> | undefined): PoiCategory | undefined => {
    if (!tags) return undefined
    // Check for known tag keys in priority order
    if (tags['amenity']) return 'amenity'
    if (tags['shop']) return 'shop'
    if (tags['tourism']) return 'tourism'
    if (tags['leisure']) return 'leisure'
    if (tags['healthcare']) return 'healthcare'
    if (tags['office']) return 'office'
    if (tags['building']) return 'building'
    return undefined
  }

  /**
   * Transform PoiInput to PoiPositionEvent for stream publishing.
   */
  const toPoiEvent = (input: PoiInput): PoiPositionEvent => {
    const lon = Option.isSome(input.centroidLon) ? input.centroidLon.value : 0
    const lat = Option.isSome(input.centroidLat) ? input.centroidLat.value : 0

    return new PoiPositionEvent({
      osmId: input.osmId,
      osmType: input.osmType as 'node' | 'way' | 'relation',
      source: 'overpass' as PoiSource,
      position: [lon, lat],
      name: input.tags?.['name'],
      category: getPoiCategory(input.tags),
      tags: input.tags,
      queryBbox: Option.isSome(input.queryBbox) ? input.queryBbox.value : undefined,
      ingestedAt: new Date(),
    })
  }

  /**
   * Log ingestion result
   */
  const logIngestion = (result: OsmIngestionResult): Effect.Effect<void, never> => {
    if (!config.logIngestion) return Effect.void

    return pipe(
      sql`
        INSERT INTO raw.ingestion_log (time, source, operation, records_ingested, latency_ms, error)
        VALUES (
          NOW(),
          'overpass',
          ${'ingest:' + result.region},
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
   * Ingest OSM data for a region
   */
  const ingestRegion: OsmIngester['ingestRegion'] = (region) =>
    Effect.gen(function* () {
      const startTime = Date.now()

      if (Option.isNone(overpassClient)) {
        return {
          region: region.name,
          recordsIngested: 0,
          latencyMs: Date.now() - startTime,
          error: 'Overpass client not available',
        }
      }

      const client = overpassClient.value

      // Build query for this region
      const query = client.buildQuery({
        bounds: region.bounds,
        amenities: region.amenities,
        tags: region.tags,
      })

      // Execute query
      const fetchResult = yield* client.query(query, {
        timeout: config.queryTimeoutMs,
      }).pipe(
        Effect.map((response) => ({ _tag: 'success' as const, response })),
        Effect.catchAll((error: ExternalApiError | RateLimitError | TimeoutError) =>
          Effect.succeed({ _tag: 'error' as const, message: error.message })
        )
      )

      // Check for error in fetch
      if (fetchResult._tag === 'error') {
        const result: OsmIngestionResult = {
          region: region.name,
          recordsIngested: 0,
          latencyMs: Date.now() - startTime,
          error: fetchResult.message,
        }
        yield* logIngestion(result)
        return result
      }

      const response = fetchResult.response

      // Transform and collect POIs
      const pois: PoiInput[] = []
      for (const element of response.elements) {
        const poi = overpassElementToPoiInput(
          element,
          element,
          region.bounds,
          region.ttlDays
        )
        if (poi !== null) {
          pois.push(poi)
        }
      }

      // Transform POIs to events for stream publishing
      const events = pois.map(toPoiEvent)

      // Check if we have stream handle for transactional outbox
      if (Option.isSome(osmStream)) {
        const streamHandle = osmStream.value

        // TRANSACTIONAL OUTBOX: Upsert + Publish atomically
        const insertedCount = yield* sql.withTransaction(
          Effect.gen(function* () {
            // 1. Upsert into raw.osm_elements
            const count = yield* poiRepo.upsertPois(pois)

            // 2. Publish to DurableStream (within same transaction)
            yield* streamHandle.appendBatch(events)

            yield* Effect.logDebug(
              `[OsmIngester] Transactional commit: ${count} POIs + ${events.length} events for ${region.name}`
            )

            return count
          })
        ).pipe(
          Effect.catchAll((error) =>
            Effect.logWarning(`OSM transactional upsert failed: ${String(error)}`).pipe(
              Effect.as(0)
            )
          )
        )

        const result: OsmIngestionResult = {
          region: region.name,
          recordsIngested: insertedCount,
          latencyMs: Date.now() - startTime,
        }

        yield* logIngestion(result)
        yield* Effect.logDebug(`OSM ${region.name}: ${insertedCount} POIs ingested (with stream)`)

        return result
      }

      // Fallback: No stream handle - just upsert to database
      const insertedCount = yield* poiRepo.upsertPois(pois).pipe(
        Effect.catchAll((error) =>
          Effect.logWarning(`OSM upsert failed: ${error.message}`).pipe(
            Effect.as(0)
          )
        )
      )

      const result: OsmIngestionResult = {
        region: region.name,
        recordsIngested: insertedCount,
        latencyMs: Date.now() - startTime,
      }

      yield* logIngestion(result)
      yield* Effect.logDebug(`OSM ${region.name}: ${insertedCount} POIs ingested (no stream)`)

      return result
    })

  /**
   * Start continuous ingestion
   */
  const start: OsmIngester['start'] = () =>
    Effect.gen(function* () {
      yield* Effect.logInfo('Starting OSM ingestion service')
      yield* Effect.logInfo(`Regions: ${config.regions.map((r) => r.name).join(', ')}`)

      // Create polling loop
      const loop = pipe(
        Effect.forEach(
          config.regions,
          (region) =>
            ingestRegion(region).pipe(
              Effect.catchAll((error) =>
                Effect.logWarning(`OSM ingestion error: ${error.message}`)
              )
            ),
          { concurrency: 1 } // Sequential to be nice to Overpass
        ),
        Effect.repeat(Schedule.spaced(Duration.millis(config.intervalMs))),
        Effect.asVoid
      )

      // Fork the loop
      const fiber = yield* Effect.fork(loop)

      yield* Effect.logInfo('OSM ingestion started')

      return fiber
    })

  /**
   * Stop ingestion fiber
   */
  const stop: OsmIngester['stop'] = (fiber) =>
    Effect.gen(function* () {
      yield* Effect.logInfo('Stopping OSM ingestion service')
      yield* Fiber.interrupt(fiber)
      yield* Effect.logInfo('OSM ingestion stopped')
    })

  return {
    ingestRegion,
    start,
    stop,
    config,
  } satisfies OsmIngester
})

// =============================================================================
// Layers
// =============================================================================

/**
 * Default OsmIngester config layer
 */
export const OsmIngesterConfigDefault = Layer.succeed(
  OsmIngesterConfigTag,
  DEFAULT_OSM_INGESTER_CONFIG
)

/**
 * OsmIngester service layer
 *
 * Requires:
 * - OsmIngesterConfigTag
 * - PoiRepositoryTag
 * - PgClient.PgClient
 * - OverpassClientService (optional)
 */
export const OsmIngesterLive = Layer.effect(OsmIngesterTag, makeOsmIngester)

/**
 * OsmIngester with default config
 *
 * Requires:
 * - PoiRepositoryTag
 * - PgClient.PgClient
 * - OverpassClientService (optional)
 */
export const OsmIngesterDefault = OsmIngesterLive.pipe(
  Layer.provide(OsmIngesterConfigDefault)
)
