/**
 * IngestionOrchestrator - Coordinates all GEOINT data ingesters
 *
 * Provides unified lifecycle management for all ingestion services:
 * - FlightIngester (OpenSky + ADSB.lol)
 * - OsmIngester (Overpass API)
 * - WeatherIngester (Open-Meteo)
 * - ImageryIngester (Planet + Sentinel)
 *
 * Features:
 * - Start/stop all ingesters atomically
 * - Individual ingester control
 * - Combined health status
 * - Graceful shutdown with fiber cleanup
 *
 * @module
 */

import {
  Effect,
  Layer,
  Context,
  Option,
  Schema,
  Fiber,
  HashMap,
  Ref,
  pipe,
} from 'effect'
import { FlightIngesterTag, type FlightIngester } from './FlightIngester'
import { OsmIngesterTag, type OsmIngester } from './OsmIngester'
import { WeatherIngesterTag, type WeatherIngester } from './WeatherIngester'
import { ImageryIngesterTag, type ImageryIngester } from './ImageryIngester'

// =============================================================================
// Types
// =============================================================================

/**
 * Ingester names for individual control
 */
export type IngesterName = 'flight' | 'osm' | 'weather' | 'imagery'

/**
 * Status of an individual ingester
 */
export const IngesterStatus = Schema.Struct({
  name: Schema.String,
  running: Schema.Boolean,
  startedAt: Schema.optionalWith(Schema.DateFromSelf, { as: 'Option' }),
  error: Schema.optionalWith(Schema.String, { as: 'Option' }),
})
export type IngesterStatus = typeof IngesterStatus.Type

/**
 * Combined orchestrator status
 */
export const OrchestratorStatus = Schema.Struct({
  running: Schema.Boolean,
  ingesters: Schema.Array(IngesterStatus),
  startedAt: Schema.optionalWith(Schema.DateFromSelf, { as: 'Option' }),
})
export type OrchestratorStatus = typeof OrchestratorStatus.Type

/**
 * Configuration for which ingesters to enable
 */
export const OrchestratorConfig = Schema.Struct({
  enableFlight: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  enableOsm: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  enableWeather: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  enableImagery: Schema.optionalWith(Schema.Boolean, { default: () => true }),
})
export type OrchestratorConfig = typeof OrchestratorConfig.Type

// =============================================================================
// Error Types
// =============================================================================

export class IngestionOrchestratorError extends Schema.TaggedError<IngestionOrchestratorError>()(
  'IngestionOrchestratorError',
  {
    message: Schema.String,
    cause: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
  }
) {}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * IngestionOrchestrator service interface
 */
export interface IngestionOrchestrator {
  /**
   * Start all enabled ingesters
   * @returns Effect with void on success
   */
  readonly start: () => Effect.Effect<void, IngestionOrchestratorError>

  /**
   * Stop all running ingesters gracefully
   * @returns Effect with void on success
   */
  readonly stop: () => Effect.Effect<void, IngestionOrchestratorError>

  /**
   * Start a specific ingester by name
   * @param name - The ingester to start
   * @returns Effect with void on success
   */
  readonly startIngester: (
    name: IngesterName
  ) => Effect.Effect<void, IngestionOrchestratorError>

  /**
   * Stop a specific ingester by name
   * @param name - The ingester to stop
   * @returns Effect with void on success
   */
  readonly stopIngester: (
    name: IngesterName
  ) => Effect.Effect<void, IngestionOrchestratorError>

  /**
   * Get the current status of all ingesters
   * @returns Effect with orchestrator status
   */
  readonly status: () => Effect.Effect<OrchestratorStatus, never>

  /**
   * The configuration for this orchestrator
   */
  readonly config: OrchestratorConfig
}

// =============================================================================
// Context Tags
// =============================================================================

export class IngestionOrchestratorTag extends Context.Tag('geoint/IngestionOrchestrator')<
  IngestionOrchestratorTag,
  IngestionOrchestrator
>() {}

export class IngestionOrchestratorConfigTag extends Context.Tag('geoint/IngestionOrchestratorConfig')<
  IngestionOrchestratorConfigTag,
  OrchestratorConfig
>() {}

// =============================================================================
// Defaults
// =============================================================================

export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  enableFlight: true,
  enableOsm: true,
  enableWeather: true,
  enableImagery: true,
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Internal state for tracking running fibers
 */
interface FiberState {
  fiber: Fiber.RuntimeFiber<void, Error>
  startedAt: Date
}

/**
 * Create the IngestionOrchestrator service
 */
export const makeIngestionOrchestrator = Effect.gen(function* () {
  // Get configuration
  const config = yield* IngestionOrchestratorConfigTag

  // Get ingesters (optional - may not all be available)
  const flightIngester = yield* Effect.serviceOption(FlightIngesterTag)
  const osmIngester = yield* Effect.serviceOption(OsmIngesterTag)
  const weatherIngester = yield* Effect.serviceOption(WeatherIngesterTag)
  const imageryIngester = yield* Effect.serviceOption(ImageryIngesterTag)

  // State: map of running fibers
  const fibersRef = yield* Ref.make(HashMap.empty<IngesterName, FiberState>())
  const startedAtRef = yield* Ref.make<Option.Option<Date>>(Option.none())

  // Helper to start an ingester
  const startOne = (name: IngesterName): Effect.Effect<void, IngestionOrchestratorError> =>
    Effect.gen(function* () {
      const fibers = yield* Ref.get(fibersRef)

      // Skip if already running
      if (HashMap.has(fibers, name)) {
        yield* Effect.logDebug(`Ingester ${name} already running`)
        return
      }

      // Get the ingester for this name
      const ingester = name === 'flight'
        ? flightIngester
        : name === 'osm'
        ? osmIngester
        : name === 'weather'
        ? weatherIngester
        : imageryIngester

      if (Option.isNone(ingester)) {
        yield* Effect.logWarning(`Ingester ${name} not available`)
        return
      }

      // Start the ingester
      yield* Effect.logInfo(`Starting ${name} ingester`)
      const fiber = yield* ingester.value.start()

      // Store the fiber
      yield* Ref.update(fibersRef, (m) =>
        HashMap.set(m, name, { fiber, startedAt: new Date() })
      )
    }).pipe(
      Effect.catchAll((e) =>
        Effect.fail(
          new IngestionOrchestratorError({
            message: `Failed to start ${name} ingester: ${String(e)}`,
            cause: Option.some(e),
          })
        )
      )
    )

  // Helper to stop an ingester
  const stopOne = (name: IngesterName): Effect.Effect<void, IngestionOrchestratorError> =>
    Effect.gen(function* () {
      const fibers = yield* Ref.get(fibersRef)
      const state = HashMap.get(fibers, name)

      if (Option.isNone(state)) {
        yield* Effect.logDebug(`Ingester ${name} not running`)
        return
      }

      // Get the ingester for this name
      const ingester = name === 'flight'
        ? flightIngester
        : name === 'osm'
        ? osmIngester
        : name === 'weather'
        ? weatherIngester
        : imageryIngester

      if (Option.isNone(ingester)) {
        // Just interrupt the fiber
        yield* Fiber.interrupt(state.value.fiber)
      } else {
        // Use the ingester's stop method
        yield* ingester.value.stop(state.value.fiber)
      }

      // Remove from state
      yield* Ref.update(fibersRef, (m) => HashMap.remove(m, name))
      yield* Effect.logInfo(`Stopped ${name} ingester`)
    }).pipe(
      Effect.catchAll((e) =>
        Effect.fail(
          new IngestionOrchestratorError({
            message: `Failed to stop ${name} ingester: ${String(e)}`,
            cause: Option.some(e),
          })
        )
      )
    )

  // Service methods
  const start: IngestionOrchestrator['start'] = () =>
    Effect.gen(function* () {
      yield* Effect.logInfo('Starting ingestion orchestrator')

      const toStart: IngesterName[] = []
      if (config.enableFlight && Option.isSome(flightIngester)) toStart.push('flight')
      if (config.enableOsm && Option.isSome(osmIngester)) toStart.push('osm')
      if (config.enableWeather && Option.isSome(weatherIngester)) toStart.push('weather')
      if (config.enableImagery && Option.isSome(imageryIngester)) toStart.push('imagery')

      // Start all enabled ingesters
      yield* Effect.forEach(toStart, startOne, { concurrency: 'unbounded' })

      // Record start time
      yield* Ref.set(startedAtRef, Option.some(new Date()))

      yield* Effect.logInfo(
        `Ingestion orchestrator started with ${toStart.length} ingesters: ${toStart.join(', ')}`
      )
    })

  const stop: IngestionOrchestrator['stop'] = () =>
    Effect.gen(function* () {
      yield* Effect.logInfo('Stopping ingestion orchestrator')

      const fibers = yield* Ref.get(fibersRef)
      const running = Array.from(HashMap.keys(fibers))

      // Stop all running ingesters
      yield* Effect.forEach(running, stopOne, { concurrency: 'unbounded' })

      // Clear start time
      yield* Ref.set(startedAtRef, Option.none())

      yield* Effect.logInfo('Ingestion orchestrator stopped')
    })

  const startIngester: IngestionOrchestrator['startIngester'] = startOne
  const stopIngester: IngestionOrchestrator['stopIngester'] = stopOne

  const status: IngestionOrchestrator['status'] = () =>
    Effect.gen(function* () {
      const fibers = yield* Ref.get(fibersRef)
      const startedAt = yield* Ref.get(startedAtRef)

      const ingesters: IngesterStatus[] = (['flight', 'osm', 'weather', 'imagery'] as const).map(
        (name) => {
          const state = HashMap.get(fibers, name)
          return {
            name,
            running: Option.isSome(state),
            startedAt: Option.map(state, (s) => s.startedAt),
            error: Option.none(),
          }
        }
      )

      return {
        running: HashMap.size(fibers) > 0,
        ingesters,
        startedAt,
      }
    })

  return {
    start,
    stop,
    startIngester,
    stopIngester,
    status,
    config,
  } satisfies IngestionOrchestrator
})

// =============================================================================
// Layers
// =============================================================================

/**
 * Default configuration layer
 */
export const IngestionOrchestratorConfigDefault = Layer.succeed(
  IngestionOrchestratorConfigTag,
  DEFAULT_ORCHESTRATOR_CONFIG
)

/**
 * Live layer - requires all ingesters to be provided
 */
export const IngestionOrchestratorLive = Layer.effect(
  IngestionOrchestratorTag,
  makeIngestionOrchestrator
)

/**
 * Default layer with default configuration
 */
export const IngestionOrchestratorDefault = IngestionOrchestratorLive.pipe(
  Layer.provide(IngestionOrchestratorConfigDefault)
)
