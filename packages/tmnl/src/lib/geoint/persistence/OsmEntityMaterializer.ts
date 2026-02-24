/**
 * OSM Entity Materializer
 *
 * Subscribes to the poi-positions DurableStream and materializes
 * POI data into ECS entity tables for Electric sync.
 *
 * Data Flow:
 * DurableStream (poi-positions)
 *   → OsmEntityMaterializer
 *     → entity.entities (upsert by OSM ID)
 *     → entity.spatial (position trait)
 *     → entity.identifiable (OSM ID, name trait)
 *   → Electric Sync
 *     → React hooks (usePoiEntities)
 *
 * Pattern: Effect.Service<>() with Stream consumption
 *
 * @module geoint/persistence/OsmEntityMaterializer
 */

import { Context, Effect, Layer, Stream, Schedule, Scope } from 'effect'
import { SqlClient } from '@effect/sql'
import { DurableStreamClient, type DurableStreamError } from '@/lib/durable-streams/service'
import { PoiPositionEvent } from '../schemas/poi-events'
import { toEcsIntelSource } from '../registry'

// =============================================================================
// Configuration
// =============================================================================

/**
 * Configuration for OsmEntityMaterializer.
 */
export interface OsmEntityMaterializerConfig {
  /** DurableStreams server URL */
  durableStreamsUrl: string
  /** Stream path for POI positions */
  poiStreamPath?: string
  /** Batch size for processing events */
  batchSize?: number
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean
}

/**
 * Configuration tag.
 */
export class OsmEntityMaterializerConfigTag extends Context.Tag(
  'geoint/OsmEntityMaterializerConfig'
)<OsmEntityMaterializerConfigTag, OsmEntityMaterializerConfig>() {}

/**
 * Default configuration.
 */
export const OsmEntityMaterializerConfigDefault = Layer.succeed(
  OsmEntityMaterializerConfigTag,
  {
    durableStreamsUrl: 'http://localhost:8787',
    poiStreamPath: '/pois',
    batchSize: 100,
    autoReconnect: true,
  }
)

// =============================================================================
// Service Interface
// =============================================================================

/**
 * OsmEntityMaterializer service interface.
 */
export interface OsmEntityMaterializerShape {
  /**
   * Start materializing POI events into ECS entities.
   * Returns a fiber that can be interrupted to stop.
   */
  readonly materialize: () => Effect.Effect<void, DurableStreamError | Error, Scope.Scope>

  /**
   * Process a single POI event (for testing/manual use).
   */
  readonly processEvent: (event: PoiPositionEvent) => Effect.Effect<void, Error>

  /**
   * Get current materializer stats.
   */
  readonly stats: () => Effect.Effect<{
    eventsProcessed: number
    entitiesCreated: number
    entitiesUpdated: number
    lastEventAt: Date | null
  }>
}

// =============================================================================
// Service Tag
// =============================================================================

/**
 * OsmEntityMaterializer service tag.
 */
export class OsmEntityMaterializer extends Context.Tag('geoint/OsmEntityMaterializer')<
  OsmEntityMaterializer,
  OsmEntityMaterializerShape
>() {}

// =============================================================================
// Helper: Generate Entity ID from OSM ID
// =============================================================================

/**
 * Generate a deterministic entity ID from OSM type and ID.
 * Format: poi-{type}-{osmId}-{uuid structure}
 */
const entityIdFromOsm = (osmType: string, osmId: bigint): string => {
  // Create a deterministic UUID-like ID from OSM ID
  const idHex = osmId.toString(16).padStart(12, '0').slice(-12)
  const typePrefix = osmType.charAt(0) // n, w, or r
  return `poi-${typePrefix}${idHex}-0000-4000-8000-000000000000`
}

// =============================================================================
// Live Layer Implementation
// =============================================================================

/**
 * Live implementation of OsmEntityMaterializer.
 *
 * Subscribes to DurableStream and upserts entities transactionally.
 */
export const OsmEntityMaterializerLive = Layer.scoped(
  OsmEntityMaterializer,
  Effect.gen(function* () {
    const config = yield* OsmEntityMaterializerConfigTag
    const dsClient = yield* DurableStreamClient
    const sql = yield* SqlClient.SqlClient

    // Stats tracking
    let eventsProcessed = 0
    let entitiesCreated = 0
    let entitiesUpdated = 0
    let lastEventAt: Date | null = null

    /**
     * Normalize POI source IDs to ECS canonical IntelSource.
     */
    const sourceToIntelSource = (source: 'overpass' | 'nominatim' | 'custom') =>
      toEcsIntelSource(source)

    /**
     * Upsert a single POI event into ECS tables.
     */
    const upsertPoiEntity = (event: PoiPositionEvent) =>
      Effect.gen(function* () {
        const entityId = entityIdFromOsm(event.osmType, event.osmId)
        const intelSource = sourceToIntelSource(event.source)
        const now = new Date()

        // TRANSACTION: Upsert entity + all traits atomically
        yield* sql.withTransaction(
          Effect.gen(function* () {
            // 1. Upsert entity.entities
            const existingRows = yield* sql`
              SELECT id FROM entity.entities WHERE entity_id = ${entityId}
            `

            let dbId: string

            if (existingRows.length === 0) {
              // Insert new entity
              const insertedRows = yield* sql`
                INSERT INTO entity.entities (
                  entity_id, entity_type, confidence, is_stale, ttl_seconds,
                  provenance, metadata, created_at, updated_at
                ) VALUES (
                  ${entityId}, 'poi', 0.9, false, 86400,
                  ${JSON.stringify({
                    sources: [{ source: intelSource, observedAt: event.ingestedAt.toISOString() }],
                    primarySource: intelSource,
                  })},
                  ${JSON.stringify({
                    osmId: event.osmId.toString(),
                    osmType: event.osmType,
                    name: event.name ?? null,
                    category: event.category ?? null,
                    tags: event.tags ?? {},
                  })},
                  ${now}, ${now}
                )
                RETURNING id
              `
              dbId = String(insertedRows[0]?.['id'] ?? '')
              entitiesCreated++
            } else {
              // Update existing entity
              dbId = String(existingRows[0]?.['id'] ?? '')
              yield* sql`
                UPDATE entity.entities
                SET updated_at = ${now},
                    revision = revision + 1,
                    is_stale = false,
                    metadata = ${JSON.stringify({
                      osmId: event.osmId.toString(),
                      osmType: event.osmType,
                      name: event.name ?? null,
                      category: event.category ?? null,
                      tags: event.tags ?? {},
                    })}
                WHERE id = ${dbId}
              `
              entitiesUpdated++
            }

            // 2. Upsert entity.spatial (PostGIS Point, no altitude for POIs)
            const [lon, lat] = event.position
            yield* sql`
              INSERT INTO entity.spatial (entity_id, position, updated_at)
              VALUES (
                ${dbId}::uuid,
                ST_SetSRID(ST_MakePoint(${lon}, ${lat}, 0), 4326),
                ${now}
              )
              ON CONFLICT (entity_id)
              DO UPDATE SET
                position = ST_SetSRID(ST_MakePoint(${lon}, ${lat}, 0), 4326),
                updated_at = ${now}
            `

            // 3. Upsert entity.identifiable
            const externalIds = JSON.stringify({
              osmId: event.osmId.toString(),
              osmType: event.osmType,
            })
            const displayName = event.name ?? null

            yield* sql`
              INSERT INTO entity.identifiable (entity_id, external_ids, callsign, updated_at)
              VALUES (${dbId}::uuid, ${externalIds}::jsonb, ${displayName}, ${now})
              ON CONFLICT (entity_id)
              DO UPDATE SET
                external_ids = ${externalIds}::jsonb,
                callsign = COALESCE(${displayName}, entity.identifiable.callsign),
                updated_at = ${now}
            `
          })
        )

        eventsProcessed++
        lastEventAt = now
      })

    /**
     * Start the materialization loop.
     */
    const materialize: OsmEntityMaterializerShape['materialize'] = () =>
      Effect.gen(function* () {
        const streamUrl = `${config.durableStreamsUrl}${config.poiStreamPath ?? '/pois'}`

        yield* Effect.logInfo(`[OsmEntityMaterializer] Connecting to ${streamUrl}`)

        // Connect to the stream
        const handle = yield* dsClient.connect<PoiPositionEvent>({
          url: streamUrl,
        })

        yield* Effect.logInfo('[OsmEntityMaterializer] Connected, starting subscription')

        // Subscribe from the latest offset (live mode)
        const stream = yield* handle.subscribe({
          offset: '-1', // Start from end (live only)
          live: 'auto',
          json: true,
        })

        // Process batches from the stream
        yield* stream.pipe(
          Stream.tap((batch) =>
            Effect.logDebug(`[OsmEntityMaterializer] Received batch of ${batch.items.length} events`)
          ),
          Stream.mapEffect((batch) =>
            Effect.forEach(batch.items, (event) =>
              upsertPoiEntity(event as unknown as PoiPositionEvent).pipe(
                Effect.catchAll((error) =>
                  Effect.logWarning(`[OsmEntityMaterializer] Failed to process event: ${error}`)
                )
              )
            )
          ),
          Stream.runDrain
        )
      }).pipe(
        // Auto-retry on disconnect
        config.autoReconnect
          ? Effect.retry(Schedule.exponential('1 second', 2).pipe(Schedule.upTo('30 seconds')))
          : (effect) => effect
      )

    /**
     * Process a single event (for testing).
     */
    const processEvent: OsmEntityMaterializerShape['processEvent'] = (event) =>
      upsertPoiEntity(event).pipe(
        Effect.mapError((e) => new Error(String(e)))
      )

    /**
     * Get stats.
     */
    const stats: OsmEntityMaterializerShape['stats'] = () =>
      Effect.succeed({
        eventsProcessed,
        entitiesCreated,
        entitiesUpdated,
        lastEventAt,
      })

    return {
      materialize,
      processEvent,
      stats,
    } satisfies OsmEntityMaterializerShape
  })
)

// =============================================================================
// Full Layer with Dependencies
// =============================================================================

/**
 * OsmEntityMaterializer with default config.
 *
 * Requires: DurableStreamClient, SqlClient
 */
export const OsmEntityMaterializerFullLive = OsmEntityMaterializerLive.pipe(
  Layer.provide(OsmEntityMaterializerConfigDefault)
)
