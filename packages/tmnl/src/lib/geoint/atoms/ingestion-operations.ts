/**
 * GEOINT Ingestion Operations - Effect Operations with Atom State
 *
 * Integrates IngestionOrchestrator with effect-atom for reactive ingestion state.
 * Uses Effect.runPromise with layer composition for service dependencies.
 * Updates atoms via geointRegistry.set() for sync mutations.
 *
 * IMPORTANT: This module uses dynamic imports for Node.js-only dependencies
 * (like @effect/sql-pg) to prevent browser bundle errors. The actual Effect
 * programs run in a Node.js environment (Tauri backend or separate server).
 *
 * Key patterns:
 * - geointRegistry.set(atom, value) for sync writes (triggers React re-renders)
 * - Dynamic imports for Node.js deps (prevents browser bundling issues)
 * - Layer composition for service dependencies
 *
 * @module geoint/atoms/ingestion-operations
 */

import { Atom } from '@effect-atom/atom'
import { Effect, Layer, Fiber, Option, Redacted } from 'effect'
import { geointRegistry } from './index'

// =============================================================================
// Type-only imports (safe for browser)
// IMPORTANT: Import from types.ts NOT from IngestionOrchestrator.ts
// to avoid pulling in @effect/sql-pg via the ingester dependencies.
// =============================================================================

import type {
  OrchestratorStatus,
  IngesterName,
} from '../ingestion/types'

// FlightEntityMaterializerConfig is only used in server-side code
// Define a compatible interface here for browser safety
export interface PgConfig {
  readonly host: string
  readonly port: number
  readonly database: string
  readonly username: string
  readonly password: string
}

// Re-export types for consumers
export type { OrchestratorStatus, IngesterName }

// =============================================================================
// BROWSER CHECK - Skip Node.js operations in browser
// =============================================================================

const isNodeEnvironment = (): boolean => {
  return typeof process !== 'undefined' && process.versions?.node !== undefined
}

// =============================================================================
// INGESTION STATE ATOMS
// =============================================================================

/**
 * Current ingestion orchestrator status.
 */
export const ingestionStatusAtom = Atom.make<OrchestratorStatus | null>(null)

/**
 * Fiber for the status polling loop.
 */
export const statusPollingFiberAtom = Atom.make<Fiber.RuntimeFiber<void, unknown> | null>(null)

/**
 * Whether ingestion operations are in flight.
 */
export const ingestionLoadingAtom = Atom.make<{
  starting: boolean
  stopping: boolean
  togglingIngester: IngesterName | null
}>({
  starting: false,
  stopping: false,
  togglingIngester: null,
})

/**
 * Last ingestion error if any.
 */
export const ingestionErrorAtom = Atom.make<string | null>(null)

// =============================================================================
// MATERIALIZER STATE ATOMS
// =============================================================================

/**
 * Materializer stats from FlightEntityMaterializer.
 */
export interface MaterializerStats {
  eventsProcessed: number
  entitiesCreated: number
  entitiesUpdated: number
  lastEventAt: Date | null
}

/**
 * Current materializer stats.
 */
export const materializerStatsAtom = Atom.make<MaterializerStats>({
  eventsProcessed: 0,
  entitiesCreated: 0,
  entitiesUpdated: 0,
  lastEventAt: null,
})

/**
 * Materializer running state.
 */
export const materializerRunningAtom = Atom.make<boolean>(false)

/**
 * Materializer fiber for cleanup.
 */
export const materializerFiberAtom = Atom.make<Fiber.RuntimeFiber<void, unknown> | null>(null)

/**
 * Last materializer error if any.
 */
export const materializerErrorAtom = Atom.make<string | null>(null)

// =============================================================================
// LAYER COMPOSITION (Dynamic imports to prevent browser bundle issues)
// =============================================================================

/**
 * Create the full ingestion layer with all dependencies.
 * Uses dynamic imports to prevent Node.js-only deps from being bundled for browser.
 */
export async function createIngestionLayer(pgConfig: PgConfig) {
  if (!isNodeEnvironment()) {
    throw new Error('[IngestionOps] Ingestion requires Node.js environment. Cannot run in browser.')
  }

  // Dynamic imports for Node.js-only dependencies
  // Using @vite-ignore to prevent bundler from resolving these
  const { PgClient } = await import(/* @vite-ignore */ '@effect/sql-pg')
  const { FetchHttpClient } = await import(/* @vite-ignore */ '@effect/platform')
  const {
    IngestionOrchestratorLive,
    IngestionOrchestratorConfigDefault,
  } = await import(/* @vite-ignore */ '../ingestion/IngestionOrchestrator')
  const {
    FlightIngesterLive,
    FlightIngesterConfigDefault,
  } = await import(/* @vite-ignore */ '../ingestion/FlightIngester')
  const { FlightRepositoryLive } = await import(/* @vite-ignore */ '../persistence/postgis/FlightRepository')
  const {
    OpenSkyClientLive,
    AdsbLolClientLive,
  } = await import(/* @vite-ignore */ '../api/ExternalApiClient')

  // Base layers
  const PgLive = PgClient.layer({
    host: pgConfig.host,
    port: pgConfig.port,
    database: pgConfig.database,
    username: pgConfig.username,
    password: Redacted.make(pgConfig.password),
  })
  const HttpLive = FetchHttpClient.layer

  // API clients layer (needs HttpClient)
  const ApiClientsLive = Layer.mergeAll(OpenSkyClientLive, AdsbLolClientLive).pipe(
    Layer.provide(HttpLive)
  )

  // Repository layer (needs PgClient)
  const FlightRepoLive = FlightRepositoryLive.pipe(Layer.provide(PgLive))

  // FlightIngester dependencies (needs PgClient, FlightRepository, API clients, config)
  const FlightIngesterDeps = Layer.mergeAll(
    FlightRepoLive,
    ApiClientsLive,
    FlightIngesterConfigDefault,
    PgLive // FlightIngester also needs PgClient directly for batch inserts
  )

  // FlightIngester layer
  const FlightIngesterFullLive = FlightIngesterLive.pipe(
    Layer.provide(FlightIngesterDeps)
  )

  // Orchestrator dependencies
  const OrchestratorDeps = Layer.mergeAll(
    IngestionOrchestratorConfigDefault,
    FlightIngesterFullLive
  )

  // Full orchestrator layer
  const OrchestratorLive = IngestionOrchestratorLive.pipe(
    Layer.provide(OrchestratorDeps)
  )

  return OrchestratorLive
}

/**
 * Create the materializer layer with all dependencies.
 * Uses dynamic imports to prevent Node.js-only deps from being bundled for browser.
 */
export async function createMaterializerLayer(
  pgConfig: PgConfig,
  durableStreamsUrl: string
) {
  if (!isNodeEnvironment()) {
    throw new Error('[IngestionOps] Materializer requires Node.js environment. Cannot run in browser.')
  }

  // Dynamic imports for Node.js-only dependencies
  // Using @vite-ignore to prevent bundler from resolving these
  const { PgClient } = await import(/* @vite-ignore */ '@effect/sql-pg')
  const {
    FlightEntityMaterializer,
    FlightEntityMaterializerLive,
    FlightEntityMaterializerConfigTag,
  } = await import(/* @vite-ignore */ '../persistence/FlightEntityMaterializer')
  const {
    DurableStreamClientLive,
    DurableStreamClientConfigTag,
  } = await import(/* @vite-ignore */ '@/lib/durable-streams/service')

  // Base Postgres layer
  const PgLive = PgClient.layer({
    host: pgConfig.host,
    port: pgConfig.port,
    database: pgConfig.database,
    username: pgConfig.username,
    password: Redacted.make(pgConfig.password),
  })

  // DurableStreams config
  const DsConfigLive = Layer.succeed(DurableStreamClientConfigTag, {
    baseUrl: durableStreamsUrl,
  })

  // DurableStream client with config
  const DsClientLive = DurableStreamClientLive.pipe(Layer.provide(DsConfigLive))

  // Materializer config - type inferred from FlightEntityMaterializerConfigTag
  const MaterializerConfigLive = Layer.succeed(FlightEntityMaterializerConfigTag, {
    durableStreamsUrl,
    flightStreamPath: '/flights',
    batchSize: 100,
    autoReconnect: true,
  })

  // Full materializer layer
  const MaterializerDeps = Layer.mergeAll(
    PgLive,
    DsClientLive,
    MaterializerConfigLive
  )

  return { layer: FlightEntityMaterializerLive.pipe(Layer.provide(MaterializerDeps)), FlightEntityMaterializer }
}

// =============================================================================
// START INGESTION
// =============================================================================

/**
 * Start all enabled ingesters via IngestionOrchestrator.
 * Updates atoms via geointRegistry.set().
 *
 * NOTE: This requires Node.js environment. Will fail gracefully in browser.
 */
export async function startIngestion(pgConfig: PgConfig): Promise<void> {
  // Set loading state
  geointRegistry.set(ingestionLoadingAtom, {
    starting: true,
    stopping: false,
    togglingIngester: null,
  })
  geointRegistry.set(ingestionErrorAtom, null)

  try {
    // Dynamic import for orchestrator tag
    const { IngestionOrchestratorTag } = await import(/* @vite-ignore */ '../ingestion/IngestionOrchestrator')

    // Create layer (async with dynamic imports)
    const ingestionLayer = await createIngestionLayer(pgConfig)

    const startEffect = Effect.gen(function* () {
      yield* Effect.logInfo('[IngestionOps] Starting ingestion orchestrator')

      // Get orchestrator from context
      const orchestrator = yield* IngestionOrchestratorTag

      // Start all ingesters
      yield* orchestrator.start()

      // Get initial status
      const status = yield* orchestrator.status()

      yield* Effect.logInfo('[IngestionOps] Ingestion started successfully')

      return status
    })

    const status = await Effect.runPromise(
      startEffect.pipe(Effect.provide(ingestionLayer))
    )

    geointRegistry.set(ingestionStatusAtom, status)
    geointRegistry.set(ingestionLoadingAtom, {
      starting: false,
      stopping: false,
      togglingIngester: null,
    })
  } catch (error) {
    console.error('[IngestionOps] Start failed:', error)
    geointRegistry.set(ingestionErrorAtom, String(error))
    geointRegistry.set(ingestionLoadingAtom, {
      starting: false,
      stopping: false,
      togglingIngester: null,
    })
  }
}

// =============================================================================
// STOP INGESTION
// =============================================================================

/**
 * Stop all running ingesters via IngestionOrchestrator.
 * Updates atoms via geointRegistry.set().
 */
export async function stopIngestion(pgConfig: PgConfig): Promise<void> {
  // Set loading state
  geointRegistry.set(ingestionLoadingAtom, {
    starting: false,
    stopping: true,
    togglingIngester: null,
  })
  geointRegistry.set(ingestionErrorAtom, null)

  try {
    // Dynamic import for orchestrator tag
    const { IngestionOrchestratorTag } = await import(/* @vite-ignore */ '../ingestion/IngestionOrchestrator')

    // Create layer (async with dynamic imports)
    const ingestionLayer = await createIngestionLayer(pgConfig)

    const stopEffect = Effect.gen(function* () {
      yield* Effect.logInfo('[IngestionOps] Stopping ingestion orchestrator')

      // Get orchestrator from context
      const orchestrator = yield* IngestionOrchestratorTag

      // Stop all ingesters
      yield* orchestrator.stop()

      // Get final status
      const status = yield* orchestrator.status()

      yield* Effect.logInfo('[IngestionOps] Ingestion stopped successfully')

      return status
    })

    const status = await Effect.runPromise(
      stopEffect.pipe(Effect.provide(ingestionLayer))
    )

    geointRegistry.set(ingestionStatusAtom, status)
    geointRegistry.set(ingestionLoadingAtom, {
      starting: false,
      stopping: false,
      togglingIngester: null,
    })
  } catch (error) {
    console.error('[IngestionOps] Stop failed:', error)
    geointRegistry.set(ingestionErrorAtom, String(error))
    geointRegistry.set(ingestionLoadingAtom, {
      starting: false,
      stopping: false,
      togglingIngester: null,
    })
  }
}

// =============================================================================
// START MATERIALIZER
// =============================================================================

/**
 * Start the FlightEntityMaterializer to stream events into ECS tables.
 * Forks the materializer loop as a fiber for background processing.
 */
export async function startMaterializer(
  pgConfig: PgConfig,
  durableStreamsUrl: string
): Promise<void> {
  geointRegistry.set(materializerErrorAtom, null)

  try {
    // Create layer (async with dynamic imports) - returns { layer, FlightEntityMaterializer }
    const { layer: materializerLayer, FlightEntityMaterializer } = await createMaterializerLayer(
      pgConfig,
      durableStreamsUrl
    )

    const startEffect = Effect.gen(function* () {
      yield* Effect.logInfo('[IngestionOps] Starting flight entity materializer')

      const materializer = yield* FlightEntityMaterializer

      // Fork the materialization loop
      const fiber = yield* Effect.fork(materializer.materialize())

      yield* Effect.logInfo('[IngestionOps] Materializer started successfully')

      return fiber
    })

    // Run scoped effect to get the fiber
    const fiber = await Effect.runPromise(
      startEffect.pipe(
        Effect.scoped,
        Effect.provide(materializerLayer)
      )
    )

    geointRegistry.set(materializerFiberAtom, fiber)
    geointRegistry.set(materializerRunningAtom, true)
  } catch (error) {
    console.error('[IngestionOps] Materializer start failed:', error)
    geointRegistry.set(materializerErrorAtom, String(error))
    geointRegistry.set(materializerRunningAtom, false)
  }
}

// =============================================================================
// STOP MATERIALIZER
// =============================================================================

/**
 * Stop the FlightEntityMaterializer by interrupting its fiber.
 */
export async function stopMaterializer(): Promise<void> {
  try {
    const fiber = geointRegistry.get(materializerFiberAtom)

    if (fiber) {
      console.log('[IngestionOps] Interrupting materializer fiber...')

      // Interrupt the fiber
      await Effect.runPromise(Fiber.interrupt(fiber))

      geointRegistry.set(materializerFiberAtom, null)
      console.log('[IngestionOps] Materializer stopped')
    }

    geointRegistry.set(materializerRunningAtom, false)
  } catch (error) {
    console.error('[IngestionOps] Materializer stop failed:', error)
    geointRegistry.set(materializerErrorAtom, String(error))
  }
}

// =============================================================================
// GET MATERIALIZER STATS
// =============================================================================

/**
 * Poll the materializer for current stats.
 */
export async function getMaterializerStats(
  pgConfig: PgConfig,
  durableStreamsUrl: string
): Promise<void> {
  try {
    // Create layer (async with dynamic imports) - returns { layer, FlightEntityMaterializer }
    const { layer: materializerLayer, FlightEntityMaterializer } = await createMaterializerLayer(
      pgConfig,
      durableStreamsUrl
    )

    const statsEffect = Effect.gen(function* () {
      const materializer = yield* FlightEntityMaterializer
      return yield* materializer.stats()
    })

    const stats = await Effect.runPromise(
      statsEffect.pipe(Effect.provide(materializerLayer))
    )

    geointRegistry.set(materializerStatsAtom, stats)
  } catch (error) {
    console.error('[IngestionOps] Stats fetch failed:', error)
  }
}

// =============================================================================
// TOGGLE INDIVIDUAL INGESTER
// =============================================================================

/**
 * Start or stop a specific ingester.
 * Updates atoms via geointRegistry.set().
 */
export async function toggleIngester(
  name: IngesterName,
  pgConfig: PgConfig
): Promise<void> {
  // Set loading state
  const loadingState = geointRegistry.get(ingestionLoadingAtom)
  geointRegistry.set(ingestionLoadingAtom, { ...loadingState, togglingIngester: name })
  geointRegistry.set(ingestionErrorAtom, null)

  try {
    // Dynamic import for orchestrator tag
    const { IngestionOrchestratorTag } = await import(/* @vite-ignore */ '../ingestion/IngestionOrchestrator')

    // Create layer (async with dynamic imports)
    const ingestionLayer = await createIngestionLayer(pgConfig)

    const toggleEffect = Effect.gen(function* () {
      yield* Effect.logInfo(`[IngestionOps] Toggling ${name} ingester`)

      // Get orchestrator and current status
      const orchestrator = yield* IngestionOrchestratorTag
      const status = yield* orchestrator.status()

      // Find the ingester's current state
      const ingesterStatus = status.ingesters.find((i) => i.name === name)
      const isRunning = ingesterStatus?.running ?? false

      // Toggle
      if (isRunning) {
        yield* orchestrator.stopIngester(name)
        yield* Effect.logInfo(`[IngestionOps] Stopped ${name}`)
      } else {
        yield* orchestrator.startIngester(name)
        yield* Effect.logInfo(`[IngestionOps] Started ${name}`)
      }

      // Return updated status
      return yield* orchestrator.status()
    })

    const status = await Effect.runPromise(
      toggleEffect.pipe(Effect.provide(ingestionLayer))
    )

    geointRegistry.set(ingestionStatusAtom, status)
    geointRegistry.set(ingestionLoadingAtom, {
      starting: false,
      stopping: false,
      togglingIngester: null,
    })
  } catch (error) {
    console.error(`[IngestionOps] Toggle ${name} failed:`, error)
    geointRegistry.set(ingestionErrorAtom, String(error))
    geointRegistry.set(ingestionLoadingAtom, {
      starting: false,
      stopping: false,
      togglingIngester: null,
    })
  }
}

// =============================================================================
// GET STATUS
// =============================================================================

/**
 * Get current ingestion status (one-shot, not polling).
 * Updates atoms via geointRegistry.set().
 */
export async function getIngestionStatus(pgConfig: PgConfig): Promise<void> {
  try {
    // Dynamic import for orchestrator tag
    const { IngestionOrchestratorTag } = await import(/* @vite-ignore */ '../ingestion/IngestionOrchestrator')

    // Create layer (async with dynamic imports)
    const ingestionLayer = await createIngestionLayer(pgConfig)

    const statusEffect = Effect.gen(function* () {
      yield* Effect.logInfo('[IngestionOps] Fetching ingestion status')

      const orchestrator = yield* IngestionOrchestratorTag
      const status = yield* orchestrator.status()

      yield* Effect.logInfo(`[IngestionOps] Status: ${status.running ? 'running' : 'stopped'}`)

      return status
    })

    const status = await Effect.runPromise(
      statusEffect.pipe(Effect.provide(ingestionLayer))
    )

    geointRegistry.set(ingestionStatusAtom, status)
  } catch (error) {
    console.error('[IngestionOps] Status fetch failed:', error)
    // Set default stopped status on error
    geointRegistry.set(ingestionStatusAtom, {
      running: false,
      ingesters: [
        {
          name: 'flight',
          running: false,
          startedAt: Option.none(),
          error: Option.some(String(error)),
        },
        { name: 'osm', running: false, startedAt: Option.none(), error: Option.none() },
        { name: 'weather', running: false, startedAt: Option.none(), error: Option.none() },
        { name: 'imagery', running: false, startedAt: Option.none(), error: Option.none() },
      ],
      materializers: {
        flight: {
          name: 'flight',
          running: false,
          startedAt: Option.none(),
          eventsProcessed: 0,
          entitiesCreated: 0,
          entitiesUpdated: 0,
        },
        osm: {
          name: 'osm',
          running: false,
          startedAt: Option.none(),
          eventsProcessed: 0,
          entitiesCreated: 0,
          entitiesUpdated: 0,
        },
        weather: {
          name: 'weather',
          running: false,
          startedAt: Option.none(),
          eventsProcessed: 0,
          entitiesCreated: 0,
          entitiesUpdated: 0,
        },
      },
      startedAt: Option.none(),
    })
  }
}

// =============================================================================
// INITIALIZE STATUS (for testbed mount)
// =============================================================================

/**
 * Initialize ingestion status atom with default stopped state.
 * Call this on testbed mount before any operations.
 */
export function initializeIngestionStatus(): void {
  geointRegistry.set(ingestionStatusAtom, {
    running: false,
    ingesters: [
      { name: 'flight', running: false, startedAt: Option.none(), error: Option.none() },
      { name: 'osm', running: false, startedAt: Option.none(), error: Option.none() },
      { name: 'weather', running: false, startedAt: Option.none(), error: Option.none() },
      { name: 'imagery', running: false, startedAt: Option.none(), error: Option.none() },
    ],
    materializers: {
      flight: {
        name: 'flight',
        running: false,
        startedAt: Option.none(),
        eventsProcessed: 0,
        entitiesCreated: 0,
        entitiesUpdated: 0,
      },
      osm: {
        name: 'osm',
        running: false,
        startedAt: Option.none(),
        eventsProcessed: 0,
        entitiesCreated: 0,
        entitiesUpdated: 0,
      },
      weather: {
        name: 'weather',
        running: false,
        startedAt: Option.none(),
        eventsProcessed: 0,
        entitiesCreated: 0,
        entitiesUpdated: 0,
      },
    },
    startedAt: Option.none(),
  })
}

// =============================================================================
// DURABLE STREAMS STATE ATOMS
// =============================================================================

/**
 * Stream connection status.
 */
export const streamConnectionStatusAtom = Atom.make<'connected' | 'disconnected' | 'error'>(
  'disconnected'
)

/**
 * Count of events received from the flight stream.
 */
export const streamEventsCountAtom = Atom.make<number>(0)

/**
 * Last stream offset for reconnection.
 */
export const streamOffsetAtom = Atom.make<string>('0')

/**
 * Active stream subscription fiber.
 */
export const streamSubscriptionFiberAtom = Atom.make<Fiber.RuntimeFiber<void, unknown> | null>(null)

// =============================================================================
// DURABLE STREAMS SUBSCRIPTION (Placeholder - requires running server)
// =============================================================================

/**
 * Subscribe to the flight-positions DurableStream.
 *
 * This function would connect to the DurableStreams server and subscribe
 * to live flight position events. For now, it logs the intent since
 * the DurableStreams server needs to be running.
 *
 * @param baseUrl - DurableStreams server base URL
 */
export async function subscribeToFlightStream(baseUrl: string): Promise<void> {
  console.log('[IngestionOps] Subscribing to flight stream at:', baseUrl)
  geointRegistry.set(streamConnectionStatusAtom, 'disconnected')

  // NOTE: Real implementation would:
  // 1. Connect to DurableStreamClient
  // 2. Subscribe to /flights stream
  // 3. Process FlightPositionEvent messages
  // 4. Update atoms with received events
  //
  // For now, we log the intent and update status
  try {
    // Check if server is reachable
    const response = await fetch(`${baseUrl}/health`, { method: 'HEAD' }).catch(() => null)

    if (response?.ok) {
      geointRegistry.set(streamConnectionStatusAtom, 'connected')
      console.log('[IngestionOps] DurableStreams server is reachable')
    } else {
      geointRegistry.set(streamConnectionStatusAtom, 'disconnected')
      console.log('[IngestionOps] DurableStreams server not reachable')
    }
  } catch (error) {
    console.error('[IngestionOps] Failed to connect to DurableStreams:', error)
    geointRegistry.set(streamConnectionStatusAtom, 'error')
  }
}

/**
 * Unsubscribe from the flight stream.
 */
export function unsubscribeFromFlightStream(): void {
  const fiber = geointRegistry.get(streamSubscriptionFiberAtom)
  if (fiber) {
    console.log('[IngestionOps] Unsubscribing from flight stream...')
    // In real implementation, would interrupt the fiber
    geointRegistry.set(streamSubscriptionFiberAtom, null)
  }
  geointRegistry.set(streamConnectionStatusAtom, 'disconnected')
}

// =============================================================================
// EXPORTED REGISTRY FOR SYNC MUTATIONS
// =============================================================================

export { geointRegistry }
