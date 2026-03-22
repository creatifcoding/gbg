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
import { FlightEntityMaterializer } from '../persistence/FlightEntityMaterializer'
import { OsmEntityMaterializer } from '../persistence/OsmEntityMaterializer'
import { WeatherEntityMaterializer } from '../persistence/WeatherEntityMaterializer'

// =============================================================================
// Types
// =============================================================================

/**
 * Ingester names for individual control
 */
export type IngesterName = 'flight' | 'osm' | 'weather' | 'imagery'

/**
 * Processor names (stream consumers like materializers)
 */
export type ProcessorName = 'flightMaterializer' | 'osmMaterializer' | 'weatherMaterializer'

/**
 * Combined component name for lifecycle management
 */
export type ComponentName = IngesterName | ProcessorName

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
 * Status of a single materializer
 */
export const MaterializerStatus = Schema.Struct({
  name: Schema.String,
  running: Schema.Boolean,
  startedAt: Schema.optionalWith(Schema.DateFromSelf, { as: 'Option' }),
  eventsProcessed: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  entitiesCreated: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  entitiesUpdated: Schema.optionalWith(Schema.Number, { default: () => 0 }),
})
export type MaterializerStatus = typeof MaterializerStatus.Type

/**
 * Combined materializer status for all materializers
 */
export const MaterializersStatus = Schema.Struct({
  flight: MaterializerStatus,
  osm: MaterializerStatus,
  weather: MaterializerStatus,
})
export type MaterializersStatus = typeof MaterializersStatus.Type

/**
 * Combined orchestrator status
 */
export const OrchestratorStatus = Schema.Struct({
  running: Schema.Boolean,
  ingesters: Schema.Array(IngesterStatus),
  materializers: MaterializersStatus,
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
  /** Enable FlightEntityMaterializer (DurableStream → ECS entities) */
  enableFlightMaterializer: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  /** Enable OsmEntityMaterializer (DurableStream → ECS entities) */
  enableOsmMaterializer: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  /** Enable WeatherEntityMaterializer (DurableStream → ECS entities) */
  enableWeatherMaterializer: Schema.optionalWith(Schema.Boolean, { default: () => true }),
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
  enableFlightMaterializer: true,
  enableOsmMaterializer: true,
  enableWeatherMaterializer: true,
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

  // Get materializers (optional - for DurableStream → ECS entity sync)
  const flightEntityMaterializer = yield* Effect.serviceOption(FlightEntityMaterializer)
  const osmEntityMaterializer = yield* Effect.serviceOption(OsmEntityMaterializer)
  const weatherEntityMaterializer = yield* Effect.serviceOption(WeatherEntityMaterializer)

  // State: map of running fibers
  const fibersRef = yield* Ref.make(HashMap.empty<IngesterName, FiberState>())
  const flightMaterializerFiberRef = yield* Ref.make<Option.Option<Fiber.RuntimeFiber<void, Error>>>(Option.none())
  const osmMaterializerFiberRef = yield* Ref.make<Option.Option<Fiber.RuntimeFiber<void, Error>>>(Option.none())
  const weatherMaterializerFiberRef = yield* Ref.make<Option.Option<Fiber.RuntimeFiber<void, Error>>>(Option.none())
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

  // Helper to start the flight materializer
  const startFlightMaterializer = (): Effect.Effect<void, IngestionOrchestratorError> =>
    Effect.gen(function* () {
      const currentFiber = yield* Ref.get(flightMaterializerFiberRef)
      if (Option.isSome(currentFiber)) {
        yield* Effect.logDebug('Flight materializer already running')
        return
      }

      if (Option.isNone(flightEntityMaterializer)) {
        yield* Effect.logWarning('FlightEntityMaterializer not available')
        return
      }

      yield* Effect.logInfo('Starting FlightEntityMaterializer')
      const fiber = yield* flightEntityMaterializer.value.materialize().pipe(
        Effect.scoped,
        Effect.catchAll((e) =>
          Effect.logError(`Flight materializer error: ${String(e)}`)
        ),
        Effect.forkDaemon
      )
      yield* Ref.set(flightMaterializerFiberRef, Option.some(fiber as unknown as Fiber.RuntimeFiber<void, Error>))
      yield* Effect.logInfo('FlightEntityMaterializer started')
    }).pipe(
      Effect.catchAll((e) =>
        Effect.fail(
          new IngestionOrchestratorError({
            message: `Failed to start flight materializer: ${String(e)}`,
            cause: Option.some(e),
          })
        )
      )
    )

  // Helper to stop the flight materializer
  const stopFlightMaterializer = (): Effect.Effect<void, IngestionOrchestratorError> =>
    Effect.gen(function* () {
      const currentFiber = yield* Ref.get(flightMaterializerFiberRef)
      if (Option.isNone(currentFiber)) {
        yield* Effect.logDebug('Flight materializer not running')
        return
      }

      yield* Effect.logInfo('Stopping FlightEntityMaterializer')
      yield* Fiber.interrupt(currentFiber.value)
      yield* Ref.set(flightMaterializerFiberRef, Option.none())
      yield* Effect.logInfo('FlightEntityMaterializer stopped')
    }).pipe(
      Effect.catchAll((e) =>
        Effect.fail(
          new IngestionOrchestratorError({
            message: `Failed to stop flight materializer: ${String(e)}`,
            cause: Option.some(e),
          })
        )
      )
    )

  // Helper to start the OSM materializer
  const startOsmMaterializer = (): Effect.Effect<void, IngestionOrchestratorError> =>
    Effect.gen(function* () {
      const currentFiber = yield* Ref.get(osmMaterializerFiberRef)
      if (Option.isSome(currentFiber)) {
        yield* Effect.logDebug('OSM materializer already running')
        return
      }

      if (Option.isNone(osmEntityMaterializer)) {
        yield* Effect.logWarning('OsmEntityMaterializer not available')
        return
      }

      yield* Effect.logInfo('Starting OsmEntityMaterializer')
      const fiber = yield* osmEntityMaterializer.value.materialize().pipe(
        Effect.scoped,
        Effect.catchAll((e) =>
          Effect.logError(`OSM materializer error: ${String(e)}`)
        ),
        Effect.forkDaemon
      )
      yield* Ref.set(osmMaterializerFiberRef, Option.some(fiber as unknown as Fiber.RuntimeFiber<void, Error>))
      yield* Effect.logInfo('OsmEntityMaterializer started')
    }).pipe(
      Effect.catchAll((e) =>
        Effect.fail(
          new IngestionOrchestratorError({
            message: `Failed to start OSM materializer: ${String(e)}`,
            cause: Option.some(e),
          })
        )
      )
    )

  // Helper to stop the OSM materializer
  const stopOsmMaterializer = (): Effect.Effect<void, IngestionOrchestratorError> =>
    Effect.gen(function* () {
      const currentFiber = yield* Ref.get(osmMaterializerFiberRef)
      if (Option.isNone(currentFiber)) {
        yield* Effect.logDebug('OSM materializer not running')
        return
      }

      yield* Effect.logInfo('Stopping OsmEntityMaterializer')
      yield* Fiber.interrupt(currentFiber.value)
      yield* Ref.set(osmMaterializerFiberRef, Option.none())
      yield* Effect.logInfo('OsmEntityMaterializer stopped')
    }).pipe(
      Effect.catchAll((e) =>
        Effect.fail(
          new IngestionOrchestratorError({
            message: `Failed to stop OSM materializer: ${String(e)}`,
            cause: Option.some(e),
          })
        )
      )
    )

  // Helper to start the weather materializer
  const startWeatherMaterializer = (): Effect.Effect<void, IngestionOrchestratorError> =>
    Effect.gen(function* () {
      const currentFiber = yield* Ref.get(weatherMaterializerFiberRef)
      if (Option.isSome(currentFiber)) {
        yield* Effect.logDebug('Weather materializer already running')
        return
      }

      if (Option.isNone(weatherEntityMaterializer)) {
        yield* Effect.logWarning('WeatherEntityMaterializer not available')
        return
      }

      yield* Effect.logInfo('Starting WeatherEntityMaterializer')
      const fiber = yield* weatherEntityMaterializer.value.materialize().pipe(
        Effect.scoped,
        Effect.catchAll((e) =>
          Effect.logError(`Weather materializer error: ${String(e)}`)
        ),
        Effect.forkDaemon
      )
      yield* Ref.set(weatherMaterializerFiberRef, Option.some(fiber as unknown as Fiber.RuntimeFiber<void, Error>))
      yield* Effect.logInfo('WeatherEntityMaterializer started')
    }).pipe(
      Effect.catchAll((e) =>
        Effect.fail(
          new IngestionOrchestratorError({
            message: `Failed to start weather materializer: ${String(e)}`,
            cause: Option.some(e),
          })
        )
      )
    )

  // Helper to stop the weather materializer
  const stopWeatherMaterializer = (): Effect.Effect<void, IngestionOrchestratorError> =>
    Effect.gen(function* () {
      const currentFiber = yield* Ref.get(weatherMaterializerFiberRef)
      if (Option.isNone(currentFiber)) {
        yield* Effect.logDebug('Weather materializer not running')
        return
      }

      yield* Effect.logInfo('Stopping WeatherEntityMaterializer')
      yield* Fiber.interrupt(currentFiber.value)
      yield* Ref.set(weatherMaterializerFiberRef, Option.none())
      yield* Effect.logInfo('WeatherEntityMaterializer stopped')
    }).pipe(
      Effect.catchAll((e) =>
        Effect.fail(
          new IngestionOrchestratorError({
            message: `Failed to stop weather materializer: ${String(e)}`,
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

      // Start materializers if enabled (consumes DurableStream → ECS entities)
      const materializerNames: string[] = []
      if (config.enableFlightMaterializer && Option.isSome(flightEntityMaterializer)) {
        yield* startFlightMaterializer()
        materializerNames.push('flightMaterializer')
      }
      if (config.enableOsmMaterializer && Option.isSome(osmEntityMaterializer)) {
        yield* startOsmMaterializer()
        materializerNames.push('osmMaterializer')
      }
      if (config.enableWeatherMaterializer && Option.isSome(weatherEntityMaterializer)) {
        yield* startWeatherMaterializer()
        materializerNames.push('weatherMaterializer')
      }

      // Record start time
      yield* Ref.set(startedAtRef, Option.some(new Date()))

      const components = [...toStart, ...materializerNames]
      yield* Effect.logInfo(
        `Ingestion orchestrator started with ${components.length} components: ${components.join(', ')}`
      )
    })

  const stop: IngestionOrchestrator['stop'] = () =>
    Effect.gen(function* () {
      yield* Effect.logInfo('Stopping ingestion orchestrator')

      const fibers = yield* Ref.get(fibersRef)
      const running = Array.from(HashMap.keys(fibers))

      // Stop all running ingesters
      yield* Effect.forEach(running, stopOne, { concurrency: 'unbounded' })

      // Stop all materializers
      yield* stopFlightMaterializer()
      yield* stopOsmMaterializer()
      yield* stopWeatherMaterializer()

      // Clear start time
      yield* Ref.set(startedAtRef, Option.none())

      yield* Effect.logInfo('Ingestion orchestrator stopped')
    })

  const startIngester: IngestionOrchestrator['startIngester'] = startOne
  const stopIngester: IngestionOrchestrator['stopIngester'] = stopOne

  const status: IngestionOrchestrator['status'] = () =>
    Effect.gen(function* () {
      const fibers = yield* Ref.get(fibersRef)
      const flightMaterializerFiber = yield* Ref.get(flightMaterializerFiberRef)
      const osmMaterializerFiber = yield* Ref.get(osmMaterializerFiberRef)
      const weatherMaterializerFiber = yield* Ref.get(weatherMaterializerFiberRef)
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

      // Get flight materializer stats if available
      let flightMaterializerStats = { eventsProcessed: 0, entitiesCreated: 0, entitiesUpdated: 0 }
      if (Option.isSome(flightEntityMaterializer) && Option.isSome(flightMaterializerFiber)) {
        const stats = yield* flightEntityMaterializer.value.stats()
        flightMaterializerStats = {
          eventsProcessed: stats.eventsProcessed,
          entitiesCreated: stats.entitiesCreated,
          entitiesUpdated: stats.entitiesUpdated,
        }
      }

      // Get OSM materializer stats if available
      let osmMaterializerStats = { eventsProcessed: 0, entitiesCreated: 0, entitiesUpdated: 0 }
      if (Option.isSome(osmEntityMaterializer) && Option.isSome(osmMaterializerFiber)) {
        const stats = yield* osmEntityMaterializer.value.stats()
        osmMaterializerStats = {
          eventsProcessed: stats.eventsProcessed,
          entitiesCreated: stats.entitiesCreated,
          entitiesUpdated: stats.entitiesUpdated,
        }
      }

      // Get weather materializer stats if available
      let weatherMaterializerStats = { eventsProcessed: 0, entitiesCreated: 0, entitiesUpdated: 0 }
      if (Option.isSome(weatherEntityMaterializer) && Option.isSome(weatherMaterializerFiber)) {
        const stats = yield* weatherEntityMaterializer.value.stats()
        weatherMaterializerStats = {
          eventsProcessed: stats.eventsProcessed,
          entitiesCreated: stats.entitiesCreated,
          entitiesUpdated: stats.entitiesUpdated,
        }
      }

      const flightMaterializer: MaterializerStatus = {
        name: 'flight',
        running: Option.isSome(flightMaterializerFiber),
        startedAt: Option.isSome(flightMaterializerFiber) ? startedAt : Option.none(),
        ...flightMaterializerStats,
      }

      const osmMaterializer: MaterializerStatus = {
        name: 'osm',
        running: Option.isSome(osmMaterializerFiber),
        startedAt: Option.isSome(osmMaterializerFiber) ? startedAt : Option.none(),
        ...osmMaterializerStats,
      }

      const weatherMaterializer: MaterializerStatus = {
        name: 'weather',
        running: Option.isSome(weatherMaterializerFiber),
        startedAt: Option.isSome(weatherMaterializerFiber) ? startedAt : Option.none(),
        ...weatherMaterializerStats,
      }

      const anyMaterializerRunning =
        Option.isSome(flightMaterializerFiber) ||
        Option.isSome(osmMaterializerFiber) ||
        Option.isSome(weatherMaterializerFiber)

      return {
        running: HashMap.size(fibers) > 0 || anyMaterializerRunning,
        ingesters,
        materializers: {
          flight: flightMaterializer,
          osm: osmMaterializer,
          weather: weatherMaterializer,
        },
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
