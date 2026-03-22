/**
 * Weather Entity Materializer
 *
 * Subscribes to the weather DurableStream and materializes
 * weather observations into ECS entity tables for Electric sync.
 *
 * Data Flow:
 * DurableStream (weather)
 *   → WeatherEntityMaterializer
 *     → entity.entities (upsert by location ID)
 *     → entity.spatial (position trait)
 *     → entity.weather (weather trait - temperature, humidity, etc.)
 *   → Electric Sync
 *     → React hooks (useWeatherEntities)
 *
 * Pattern: Effect.Service<>() with Stream consumption
 *
 * @module geoint/persistence/WeatherEntityMaterializer
 */

import { Context, Effect, Layer, Stream, Schedule, Scope } from 'effect'
import { SqlClient } from '@effect/sql'
import { DurableStreamClient, type DurableStreamError } from '@/lib/durable-streams/service'
import { WeatherObservationEvent } from '../schemas/weather-events'
import { toEcsIntelSource } from '../registry'

// =============================================================================
// Configuration
// =============================================================================

/**
 * Configuration for WeatherEntityMaterializer.
 */
export interface WeatherEntityMaterializerConfig {
  /** DurableStreams server URL */
  durableStreamsUrl: string
  /** Stream path for weather observations */
  weatherStreamPath?: string
  /** Batch size for processing events */
  batchSize?: number
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean
}

/**
 * Configuration tag.
 */
export class WeatherEntityMaterializerConfigTag extends Context.Tag(
  'geoint/WeatherEntityMaterializerConfig'
)<WeatherEntityMaterializerConfigTag, WeatherEntityMaterializerConfig>() {}

/**
 * Default configuration.
 */
export const WeatherEntityMaterializerConfigDefault = Layer.succeed(
  WeatherEntityMaterializerConfigTag,
  {
    durableStreamsUrl: 'http://localhost:8787',
    weatherStreamPath: '/weather',
    batchSize: 100,
    autoReconnect: true,
  }
)

// =============================================================================
// Service Interface
// =============================================================================

/**
 * WeatherEntityMaterializer service interface.
 */
export interface WeatherEntityMaterializerShape {
  /**
   * Start materializing weather events into ECS entities.
   * Returns a fiber that can be interrupted to stop.
   */
  readonly materialize: () => Effect.Effect<void, DurableStreamError | Error, Scope.Scope>

  /**
   * Process a single weather event (for testing/manual use).
   */
  readonly processEvent: (event: WeatherObservationEvent) => Effect.Effect<void, Error>

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
 * WeatherEntityMaterializer service tag.
 */
export class WeatherEntityMaterializer extends Context.Tag('geoint/WeatherEntityMaterializer')<
  WeatherEntityMaterializer,
  WeatherEntityMaterializerShape
>() {}

// =============================================================================
// Helper: Generate Entity ID from Location ID
// =============================================================================

/**
 * Generate a deterministic entity ID from location ID.
 * Format: weather-{hash}-0000-4000-8000-000000000000
 */
const entityIdFromLocation = (locationId: string): string => {
  // Create a simple hash from location ID
  let hash = 0
  for (let i = 0; i < locationId.length; i++) {
    const char = locationId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  const hashHex = Math.abs(hash).toString(16).padStart(8, '0').slice(-8)
  return `weather-${hashHex}-0000-4000-8000-000000000000`
}

// =============================================================================
// Live Layer Implementation
// =============================================================================

/**
 * Live implementation of WeatherEntityMaterializer.
 *
 * Subscribes to DurableStream and upserts entities transactionally.
 */
export const WeatherEntityMaterializerLive = Layer.scoped(
  WeatherEntityMaterializer,
  Effect.gen(function* () {
    const config = yield* WeatherEntityMaterializerConfigTag
    const dsClient = yield* DurableStreamClient
    const sql = yield* SqlClient.SqlClient

    // Stats tracking
    let eventsProcessed = 0
    let entitiesCreated = 0
    let entitiesUpdated = 0
    let lastEventAt: Date | null = null

    /**
     * Normalize weather source IDs to ECS canonical IntelSource.
     */
    const sourceToIntelSource = (source: 'openmeteo' | 'noaa' | 'custom') =>
      toEcsIntelSource(source)

    /**
     * Upsert a single weather event into ECS tables.
     */
    const upsertWeatherEntity = (event: WeatherObservationEvent) =>
      Effect.gen(function* () {
        const entityId = entityIdFromLocation(event.locationId)
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
                  ${entityId}, 'weather', 0.95, false, 3600,
                  ${JSON.stringify({
                    sources: [{ source: intelSource, observedAt: event.observedAt.toISOString() }],
                    primarySource: intelSource,
                  })},
                  ${JSON.stringify({
                    locationId: event.locationId,
                    source: event.source,
                    weatherDesc: event.weatherDesc ?? null,
                    weatherCode: event.weatherCode ?? null,
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
                      locationId: event.locationId,
                      source: event.source,
                      weatherDesc: event.weatherDesc ?? null,
                      weatherCode: event.weatherCode ?? null,
                    })}
                WHERE id = ${dbId}
              `
              entitiesUpdated++
            }

            // 2. Upsert entity.spatial (PostGIS Point)
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

            // 3. Upsert entity.weather (weather-specific trait table)
            // Note: This assumes an entity.weather table exists - if not, store in metadata
            yield* sql`
              INSERT INTO entity.weather (
                entity_id, temperature, feels_like, humidity, pressure,
                weather_code, wind_speed, wind_dir, wind_gusts,
                precipitation, cloud_cover, visibility, observed_at, updated_at
              )
              VALUES (
                ${dbId}::uuid,
                ${event.temperature ?? null},
                ${event.feelsLike ?? null},
                ${event.humidity ?? null},
                ${event.pressure ?? null},
                ${event.weatherCode ?? null},
                ${event.windSpeed ?? null},
                ${event.windDir ?? null},
                ${event.windGusts ?? null},
                ${event.precipitation ?? null},
                ${event.cloudCover ?? null},
                ${event.visibility ?? null},
                ${event.observedAt},
                ${now}
              )
              ON CONFLICT (entity_id)
              DO UPDATE SET
                temperature = ${event.temperature ?? null},
                feels_like = ${event.feelsLike ?? null},
                humidity = ${event.humidity ?? null},
                pressure = ${event.pressure ?? null},
                weather_code = ${event.weatherCode ?? null},
                wind_speed = ${event.windSpeed ?? null},
                wind_dir = ${event.windDir ?? null},
                wind_gusts = ${event.windGusts ?? null},
                precipitation = ${event.precipitation ?? null},
                cloud_cover = ${event.cloudCover ?? null},
                visibility = ${event.visibility ?? null},
                observed_at = ${event.observedAt},
                updated_at = ${now}
            `.pipe(
              // Gracefully handle if weather table doesn't exist yet
              Effect.catchAll(() => Effect.void)
            )
          })
        )

        eventsProcessed++
        lastEventAt = now
      })

    /**
     * Start the materialization loop.
     */
    const materialize: WeatherEntityMaterializerShape['materialize'] = () =>
      Effect.gen(function* () {
        const streamUrl = `${config.durableStreamsUrl}${config.weatherStreamPath ?? '/weather'}`

        yield* Effect.logInfo(`[WeatherEntityMaterializer] Connecting to ${streamUrl}`)

        // Connect to the stream
        const handle = yield* dsClient.connect<WeatherObservationEvent>({
          url: streamUrl,
        })

        yield* Effect.logInfo('[WeatherEntityMaterializer] Connected, starting subscription')

        // Subscribe from the latest offset (live mode)
        const stream = yield* handle.subscribe({
          offset: '-1', // Start from end (live only)
          live: 'auto',
          json: true,
        })

        // Process batches from the stream
        yield* stream.pipe(
          Stream.tap((batch) =>
            Effect.logDebug(`[WeatherEntityMaterializer] Received batch of ${batch.items.length} events`)
          ),
          Stream.mapEffect((batch) =>
            Effect.forEach(batch.items, (event) =>
              upsertWeatherEntity(event as unknown as WeatherObservationEvent).pipe(
                Effect.catchAll((error) =>
                  Effect.logWarning(`[WeatherEntityMaterializer] Failed to process event: ${error}`)
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
    const processEvent: WeatherEntityMaterializerShape['processEvent'] = (event) =>
      upsertWeatherEntity(event).pipe(
        Effect.mapError((e) => new Error(String(e)))
      )

    /**
     * Get stats.
     */
    const stats: WeatherEntityMaterializerShape['stats'] = () =>
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
    } satisfies WeatherEntityMaterializerShape
  })
)

// =============================================================================
// Full Layer with Dependencies
// =============================================================================

/**
 * WeatherEntityMaterializer with default config.
 *
 * Requires: DurableStreamClient, SqlClient
 */
export const WeatherEntityMaterializerFullLive = WeatherEntityMaterializerLive.pipe(
  Layer.provide(WeatherEntityMaterializerConfigDefault)
)
