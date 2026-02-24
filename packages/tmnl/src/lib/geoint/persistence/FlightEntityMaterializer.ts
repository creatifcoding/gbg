/**
 * Flight Entity Materializer
 *
 * Subscribes to the flight-positions DurableStream and materializes
 * flight data into ECS entity tables for Electric sync.
 *
 * Data Flow:
 * DurableStream (flight-positions)
 *   → FlightEntityMaterializer
 *     → entity.entities (upsert by ICAO24)
 *     → entity.spatial (position trait)
 *     → entity.kinetic (heading/speed trait)
 *     → entity.identifiable (callsign trait)
 *   → Electric Sync
 *     → React hooks (useFlightEntities)
 *
 * Pattern: Effect.Service<>() with Stream consumption
 *
 * @module geoint/persistence/FlightEntityMaterializer
 */

import { Context, Effect, Layer, Stream, Schedule, Scope } from 'effect'
import { SqlClient } from '@effect/sql'
import { DurableStreamClient, type DurableStreamError } from '@/lib/durable-streams/service'
import { FlightPositionEvent } from '../schemas/flight-events'
import { toEcsIntelSource } from '../registry'

// =============================================================================
// Configuration
// =============================================================================

/**
 * Configuration for FlightEntityMaterializer.
 */
export interface FlightEntityMaterializerConfig {
  /** DurableStreams server URL */
  durableStreamsUrl: string
  /** Stream path for flight positions */
  flightStreamPath?: string
  /** Batch size for processing events */
  batchSize?: number
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean
}

/**
 * Configuration tag.
 */
export class FlightEntityMaterializerConfigTag extends Context.Tag(
  'geoint/FlightEntityMaterializerConfig'
)<FlightEntityMaterializerConfigTag, FlightEntityMaterializerConfig>() {}

/**
 * Default configuration.
 */
export const FlightEntityMaterializerConfigDefault = Layer.succeed(
  FlightEntityMaterializerConfigTag,
  {
    durableStreamsUrl: 'http://localhost:8787',
    flightStreamPath: '/flights',
    batchSize: 100,
    autoReconnect: true,
  }
)

// =============================================================================
// Service Interface
// =============================================================================

/**
 * FlightEntityMaterializer service interface.
 */
export interface FlightEntityMaterializerShape {
  /**
   * Start materializing flight events into ECS entities.
   * Returns a fiber that can be interrupted to stop.
   */
  readonly materialize: () => Effect.Effect<void, DurableStreamError | Error, Scope.Scope>

  /**
   * Process a single flight event (for testing/manual use).
   */
  readonly processEvent: (event: FlightPositionEvent) => Effect.Effect<void, Error>

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
 * FlightEntityMaterializer service tag.
 */
export class FlightEntityMaterializer extends Context.Tag('geoint/FlightEntityMaterializer')<
  FlightEntityMaterializer,
  FlightEntityMaterializerShape
>() {}

// =============================================================================
// Helper: Generate Entity ID from ICAO24
// =============================================================================

/**
 * Generate a deterministic entity ID from ICAO24.
 * Format: flight-{icao24}-{uuid based on icao24}
 */
const entityIdFromIcao24 = (icao24: string): string => {
  // Create a deterministic UUID-like ID from ICAO24
  // Pad to 6 chars and create fake UUID structure
  const hex = icao24.toLowerCase().padStart(6, '0')
  return `flight-${hex}00-0000-4000-8000-000000000000`
}

// =============================================================================
// Live Layer Implementation
// =============================================================================

/**
 * Live implementation of FlightEntityMaterializer.
 *
 * Subscribes to DurableStream and upserts entities transactionally.
 */
export const FlightEntityMaterializerLive = Layer.scoped(
  FlightEntityMaterializer,
  Effect.gen(function* () {
    const config = yield* FlightEntityMaterializerConfigTag
    const dsClient = yield* DurableStreamClient
    const sql = yield* SqlClient.SqlClient

    // Stats tracking
    let eventsProcessed = 0
    let entitiesCreated = 0
    let entitiesUpdated = 0
    let lastEventAt: Date | null = null

    /**
     * Normalize flight source IDs to ECS canonical IntelSource.
     */
    const sourceToIntelSource = (source: 'opensky' | 'adsb-lol') =>
      toEcsIntelSource(source)

    /**
     * Upsert a single flight event into ECS tables.
     */
    const upsertFlightEntity = (event: FlightPositionEvent) =>
      Effect.gen(function* () {
        const entityId = entityIdFromIcao24(event.icao24)
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
                  ${entityId}, 'flight', 0.8, false, 300,
                  ${JSON.stringify({
                    sources: [{ source: intelSource, observedAt: event.observedAt.toISOString() }],
                    primarySource: intelSource,
                  })},
                  ${JSON.stringify({ icao24: event.icao24 })},
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
                    is_stale = false
                WHERE id = ${dbId}
              `
              entitiesUpdated++
            }

            // 2. Upsert entity.spatial (PostGIS PointZ)
            const [lon, lat, alt] = event.position
            yield* sql`
              INSERT INTO entity.spatial (entity_id, position, updated_at)
              VALUES (
                ${dbId}::uuid,
                ST_SetSRID(ST_MakePoint(${lon}, ${lat}, ${alt}), 4326),
                ${now}
              )
              ON CONFLICT (entity_id)
              DO UPDATE SET
                position = ST_SetSRID(ST_MakePoint(${lon}, ${lat}, ${alt}), 4326),
                updated_at = ${now}
            `

            // 3. Upsert entity.kinetic
            const heading = event.heading ?? 0
            const speed = event.speed ?? 0
            const verticalRate = event.verticalRate ?? 0

            yield* sql`
              INSERT INTO entity.kinetic (entity_id, heading, speed, vertical_rate, updated_at)
              VALUES (${dbId}::uuid, ${heading}, ${speed}, ${verticalRate}, ${now})
              ON CONFLICT (entity_id)
              DO UPDATE SET
                heading = ${heading},
                speed = ${speed},
                vertical_rate = ${verticalRate},
                updated_at = ${now}
            `

            // 4. Upsert entity.identifiable
            const externalIds = JSON.stringify({
              icao24: event.icao24,
              ...(event.squawk ? { squawk: event.squawk } : {}),
            })
            const callsign = event.callsign ?? null

            yield* sql`
              INSERT INTO entity.identifiable (entity_id, external_ids, callsign, updated_at)
              VALUES (${dbId}::uuid, ${externalIds}::jsonb, ${callsign}, ${now})
              ON CONFLICT (entity_id)
              DO UPDATE SET
                external_ids = ${externalIds}::jsonb,
                callsign = COALESCE(${callsign}, entity.identifiable.callsign),
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
    const materialize: FlightEntityMaterializerShape['materialize'] = () =>
      Effect.gen(function* () {
        const streamUrl = `${config.durableStreamsUrl}${config.flightStreamPath ?? '/flights'}`

        yield* Effect.logInfo(`[FlightEntityMaterializer] Connecting to ${streamUrl}`)

        // Connect to the stream
        const handle = yield* dsClient.connect<FlightPositionEvent>({
          url: streamUrl,
        })

        yield* Effect.logInfo('[FlightEntityMaterializer] Connected, starting subscription')

        // Subscribe from the latest offset (live mode)
        const stream = yield* handle.subscribe({
          offset: '-1', // Start from end (live only)
          live: 'auto',
          json: true,
        })

        // Process batches from the stream
        yield* stream.pipe(
          Stream.tap((batch) =>
            Effect.logDebug(`[FlightEntityMaterializer] Received batch of ${batch.items.length} events`)
          ),
          Stream.mapEffect((batch) =>
            Effect.forEach(batch.items, (event) =>
              upsertFlightEntity(event as unknown as FlightPositionEvent).pipe(
                Effect.catchAll((error) =>
                  Effect.logWarning(`[FlightEntityMaterializer] Failed to process event: ${error}`)
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
    const processEvent: FlightEntityMaterializerShape['processEvent'] = (event) =>
      upsertFlightEntity(event).pipe(
        Effect.mapError((e) => new Error(String(e)))
      )

    /**
     * Get stats.
     */
    const stats: FlightEntityMaterializerShape['stats'] = () =>
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
    } satisfies FlightEntityMaterializerShape
  })
)

// =============================================================================
// Full Layer with Dependencies
// =============================================================================

/**
 * FlightEntityMaterializer with default config.
 *
 * Requires: DurableStreamClient, SqlClient
 */
export const FlightEntityMaterializerFullLive = FlightEntityMaterializerLive.pipe(
  Layer.provide(FlightEntityMaterializerConfigDefault)
)
