/**
 * AVA v2 Atoms Module
 *
 * Reactive state layer for AVA v2 NATS-based streaming.
 *
 * Follows Atom-as-State doctrine:
 * - Atoms ARE the primary state (not Effect.Ref bridges)
 * - Service methods mutate atoms directly via ctx.set()
 * - React subscribes via useAtomValue()
 *
 * Pattern hierarchy:
 * 1. avaV2RuntimeAtom - Effect runtime with AvaClientV2 layer
 * 2. State atoms - viewsAtom, artifactsAtom, deltasAtom, eventsAtom
 * 3. Operation atoms - avaV2Ops.* for commands
 * 4. Subscription atoms - avaV2Streams.* for NATS subscriptions
 *
 * @pattern Effect-Atom with Stream subscriptions
 * @see AvaClientV2 for NATS transport
 * @module
 */

import { Atom } from '@effect-atom/atom-react'
import { Effect, Layer, Stream, HashMap, Option, Fiber, FiberMap, pipe } from 'effect'

import {
  AvaClientV2,
  AvaClientV2Live,
  AvaClientV2ConfigTag,
  NatsClientLive,
  NatsConfigTag,
  type NatsConfig,
  type AvaClientV2Config,
} from '../../services'

import type {
  ViewId,
  ViewArtifact,
  ViewDelta,
  ReconcilerEvent,
} from '../../schemas/v2'

import {
  applyDeltaReducer,
  deltaToLogEntry,
} from '../../utils/delta-matching'

import {
  withAvaSpan,
  logAvaEvent,
} from '../../utils/traced'

import { overlayRegistry } from '@/lib/overlays/atoms'

// =============================================================================
// Types
// =============================================================================

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface ViewSubscription {
  readonly viewId: ViewId
  readonly subscribedAt: number
  readonly lastUpdate: number | null
  readonly artifact: ViewArtifact | null
  readonly deltaCount: number
}

export interface AvaV2Config {
  readonly natsUrl: string
  readonly subjectPrefix: string
}

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_CONFIG: AvaV2Config = {
  natsUrl: 'ws://localhost:9222',
  subjectPrefix: 'tmnl.ava',
}

/** Configuration atom */
export const avaV2ConfigAtom = Atom.make<AvaV2Config>(DEFAULT_CONFIG)

// =============================================================================
// Layer Factory
// =============================================================================

/**
 * Create full layer stack for AvaClientV2.
 * Composes NatsClient → AvaClientV2 with configuration.
 */
const createAvaV2Layer = (config: AvaV2Config) => {
  const natsConfig: NatsConfig = {
    serverUrl: config.natsUrl,
    subjectPrefix: config.subjectPrefix,
    timeout: 30000,
    maxReconnectAttempts: 10,
    reconnectDelayMs: 1000,
  }

  const clientConfig: AvaClientV2Config = {
    subjectPrefix: config.subjectPrefix,
    subscribeTimeout: 30000,
    bufferSize: 1000,
  }

  return pipe(
    AvaClientV2Live,
    Layer.provide(NatsClientLive),
    Layer.provide(Layer.succeed(NatsConfigTag, natsConfig)),
    Layer.provide(Layer.succeed(AvaClientV2ConfigTag, clientConfig))
  )
}

// =============================================================================
// Runtime Atom
// =============================================================================

/**
 * Effect runtime for AVA v2 operations.
 *
 * PATTERN: Module-level Atom.runtime with reactive layer derivation.
 *
 * RuntimeFactory accepts:
 * - Layer directly: Atom.runtime(MyServiceLive)
 * - Function: Atom.runtime((get) => Layer) for reactive config
 *
 * The runtime provides:
 * - runtime.atom(effect) - Create read atoms with service access
 * - runtime.fn<Input>()(effect) - Create function atoms with service access
 * - runtime.layer - The underlying layer atom (for testing/replacement)
 *
 * Benefits over fresh-layer-per-operation:
 * - FiberMap persists across operations (auto-cleanup on dispose)
 * - Single service instance shared across all operations
 * - Proper lifecycle management
 * - Reactive to config changes
 *
 * @see .edin/AVA_V2_STRATEGIC_ANALYSIS.md for migration rationale
 */
export const avaV2Runtime = Atom.runtime((get) => {
  const config = get(avaV2ConfigAtom)
  return createAvaV2Layer(config)
})

// =============================================================================
// Shared Registry Reference
// =============================================================================

/**
 * AVA v2 shares the overlay registry singleton.
 * This prevents context shadowing issues when nested providers exist.
 */
export const avaV2Registry = overlayRegistry

// =============================================================================
// State Atoms
// =============================================================================

/** Connection status */
export const connectionStatusAtom = Atom.make<ConnectionStatus>('disconnected')

/** Error message */
export const errorAtom = Atom.make<string | null>(null)

/** Active subscriptions map: viewId → ViewSubscription */
export const subscriptionsAtom = Atom.make<HashMap.HashMap<ViewId, ViewSubscription>>(
  HashMap.empty()
)

/** Latest artifacts by viewId */
export const artifactsAtom = Atom.make<HashMap.HashMap<ViewId, ViewArtifact>>(
  HashMap.empty()
)

/** Delta history (newest first, capped at 100) */
export const deltasAtom = Atom.make<readonly ViewDelta[]>([])

/** Reconciler event log (newest first, capped at 100) */
export const eventsAtom = Atom.make<readonly ReconcilerEvent[]>([])

// Mount state atoms
avaV2Registry.mount(connectionStatusAtom)
avaV2Registry.mount(errorAtom)
avaV2Registry.mount(subscriptionsAtom)
avaV2Registry.mount(artifactsAtom)
avaV2Registry.mount(deltasAtom)
avaV2Registry.mount(eventsAtom)

// =============================================================================
// Derived Atoms
// =============================================================================

/** List of subscribed view IDs */
export const subscribedViewIdsAtom = Atom.make((get) => {
  const subs = get(subscriptionsAtom)
  return Array.from(HashMap.keys(subs))
})

/** Count of active subscriptions */
export const subscriptionCountAtom = Atom.make((get) => {
  return HashMap.size(get(subscriptionsAtom))
})

/** Get subscription for a specific view */
export const subscriptionAtom = Atom.family((viewId: ViewId) =>
  Atom.make((get) => {
    const subs = get(subscriptionsAtom)
    return Option.getOrNull(HashMap.get(subs, viewId))
  })
)

/** Get artifact for a specific view */
export const artifactAtom = Atom.family((viewId: ViewId) =>
  Atom.make((get) => {
    const artifacts = get(artifactsAtom)
    return Option.getOrNull(HashMap.get(artifacts, viewId))
  })
)

/** Latest delta count */
export const deltaCountAtom = Atom.make((get) => get(deltasAtom).length)

/** Latest event count */
export const eventCountAtom = Atom.make((get) => get(eventsAtom).length)

/** Is connected */
export const isConnectedAtom = Atom.make((get) => get(connectionStatusAtom) === 'connected')

// =============================================================================
// Operation Atoms
// =============================================================================

/**
 * AVA v2 operations - all commands go through here.
 * Uses runtimeAtom pattern for Effect integration.
 */
export const avaV2Ops = {
  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  /** Update configuration */
  setConfig: (config: Partial<AvaV2Config>) => {
    const current = avaV2Registry.get(avaV2ConfigAtom)
    avaV2Registry.set(avaV2ConfigAtom, { ...current, ...config })
  },

  // ---------------------------------------------------------------------------
  // Subscription Management
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to a view's artifacts and deltas.
   * Creates long-running fibers that stream artifacts/deltas to state atoms.
   * Uses applyDeltaReducer for incremental artifact updates.
   *
   * @pattern Runtime.fn with FiberMap lifecycle management
   */
  subscribe: avaV2Runtime.fn<ViewId>()(
    (viewId, ctx) =>
      Effect.gen(function* () {
        const client = yield* AvaClientV2

        // Check if already subscribed via FiberMap (service-scoped)
        const hasExisting = yield* FiberMap.has(client.subscriptionFibers, viewId)
        if (hasExisting) {
          yield* logAvaEvent('subscription.already_subscribed', { viewId })
          return // Already subscribed
        }

        // Create subscription record
        const subscription: ViewSubscription = {
          viewId,
          subscribedAt: Date.now(),
          lastUpdate: null,
          artifact: null,
          deltaCount: 0,
        }

        ctx.set(subscriptionsAtom, HashMap.set(ctx(subscriptionsAtom), viewId, subscription))
        ctx.set(connectionStatusAtom, 'connecting')

        // Create stream processing program
        const streamProgram = Effect.gen(function* () {
          // Request subscription from backend
          yield* client.requestSubscribe(viewId)

          ctx.set(connectionStatusAtom, 'connected')
          ctx.set(errorAtom, null)

          yield* logAvaEvent('subscription.connected', { viewId })

          // Stream artifacts (full snapshots)
          const artifactFiber = yield* Effect.fork(
            client.subscribeArtifact(viewId).pipe(
              Stream.tap((artifact) =>
                Effect.sync(() => {
                  // Update artifact (full replacement)
                  ctx.set(artifactsAtom, HashMap.set(ctx(artifactsAtom), viewId, artifact))

                  // Update subscription record
                  const subs = ctx(subscriptionsAtom)
                  const sub = Option.getOrNull(HashMap.get(subs, viewId))
                  if (sub) {
                    ctx.set(
                      subscriptionsAtom,
                      HashMap.set(subs, viewId, {
                        ...sub,
                        lastUpdate: Date.now(),
                        artifact,
                      })
                    )
                  }
                })
              ),
              Stream.runDrain
            )
          )

          // Stream deltas (incremental updates)
          const deltaFiber = yield* Effect.fork(
            client.subscribeDelta(viewId).pipe(
              Stream.tap((delta) =>
                Effect.sync(() => {
                  // Add delta to history
                  const currentDeltas = ctx(deltasAtom)
                  ctx.set(deltasAtom, [delta, ...currentDeltas].slice(0, 100))

                  // Apply delta to artifact incrementally
                  const artifacts = ctx(artifactsAtom)
                  const currentArtifact = Option.getOrNull(HashMap.get(artifacts, viewId))
                  if (currentArtifact) {
                    const updatedArtifact = applyDeltaReducer(currentArtifact, delta.delta)
                    ctx.set(artifactsAtom, HashMap.set(artifacts, viewId, updatedArtifact))

                    // Log delta for debugging (warn levels only to reduce noise)
                    const logEntry = deltaToLogEntry(delta.delta)
                    if (logEntry.level === 'warn') {
                      console.warn(`[AVA Delta] ${logEntry.message}`)
                    }
                  }

                  // Update subscription delta count
                  const subs = ctx(subscriptionsAtom)
                  const sub = Option.getOrNull(HashMap.get(subs, viewId))
                  if (sub) {
                    ctx.set(
                      subscriptionsAtom,
                      HashMap.set(subs, viewId, {
                        ...sub,
                        lastUpdate: Date.now(),
                        deltaCount: sub.deltaCount + 1,
                      })
                    )
                  }
                })
              ),
              Stream.runDrain
            )
          )

          // Wait for both fibers (they run indefinitely until interrupted)
          yield* Fiber.joinAll([artifactFiber, deltaFiber])
        }).pipe(
          withAvaSpan('subscription', 'subscribe'),
          Effect.catchAll((error) =>
            Effect.gen(function* () {
              ctx.set(connectionStatusAtom, 'error')
              ctx.set(errorAtom, String(error))
              yield* logAvaEvent('subscription.error', { viewId, error: String(error) })
            })
          )
        )

        // Use FiberMap.run for managed subscription lifecycle
        // - Auto-removes fiber when it completes
        // - Auto-interrupts on Layer scope close
        // - onlyIfMissing prevents duplicate subscriptions
        yield* FiberMap.run(client.subscriptionFibers, viewId, streamProgram, {
          onlyIfMissing: true,
        })
      })
  ),

  /**
   * Unsubscribe from a view.
   * Interrupts the subscription fiber and cleans up state.
   *
   * @pattern Runtime.fn with FiberMap.remove for cleanup
   */
  unsubscribe: avaV2Runtime.fn<ViewId>()(
    (viewId, ctx) =>
      Effect.gen(function* () {
        yield* logAvaEvent('subscription.unsubscribe.start', { viewId })

        const client = yield* AvaClientV2

        // Remove fiber from FiberMap (auto-interrupts if running)
        yield* FiberMap.remove(client.subscriptionFibers, viewId)

        // Cleanup state atoms
        ctx.set(subscriptionsAtom, HashMap.remove(ctx(subscriptionsAtom), viewId))
        ctx.set(artifactsAtom, HashMap.remove(ctx(artifactsAtom), viewId))

        // Request unsubscribe from backend
        yield* client.requestUnsubscribe(viewId).pipe(
          withAvaSpan('subscription', 'unsubscribe'),
          Effect.ignore
        )

        yield* logAvaEvent('subscription.unsubscribe.complete', { viewId })
      })
  ),

  /**
   * Invalidate a view.
   * Triggers recompilation on the backend.
   *
   * @pattern Runtime.fn with direct service access
   */
  invalidate: avaV2Runtime.fn<{ viewId: ViewId; reason?: string }>()(
    ({ viewId, reason }, _ctx) =>
      Effect.gen(function* () {
        yield* logAvaEvent('subscription.invalidate.start', { viewId, reason })

        const client = yield* AvaClientV2
        yield* client.invalidate(viewId, reason).pipe(
          withAvaSpan('subscription', 'invalidate', { viewId, reason })
        )

        yield* logAvaEvent('subscription.invalidate.complete', { viewId })
      })
  ),

  /**
   * Unsubscribe from all views.
   * Cleanup for unmount.
   *
   * @pattern Runtime.fn with FiberMap.clear for bulk cleanup
   */
  unsubscribeAll: avaV2Runtime.fn()(
    (_, ctx) =>
      Effect.gen(function* () {
        const client = yield* AvaClientV2
        const count = yield* FiberMap.size(client.subscriptionFibers)

        yield* logAvaEvent('subscription.unsubscribe_all.start', { count })

        // Clear FiberMap (auto-interrupts all running fibers)
        yield* FiberMap.clear(client.subscriptionFibers)

        // Clear all state atoms
        ctx.set(subscriptionsAtom, HashMap.empty())
        ctx.set(artifactsAtom, HashMap.empty())
        ctx.set(deltasAtom, [])
        ctx.set(connectionStatusAtom, 'disconnected')

        yield* logAvaEvent('subscription.unsubscribe_all.complete', { count })
      })
  ),
}

// =============================================================================
// Event Stream Atoms
// =============================================================================

/**
 * AVA v2 stream subscriptions - for global event monitoring.
 * These are separate from view-specific subscriptions.
 *
 * @pattern Runtime.fn with forked streams
 */
export const avaV2Streams = {
  /**
   * Subscribe to all artifacts (multi-view).
   * Useful for debugging/monitoring.
   */
  subscribeAllArtifacts: avaV2Runtime.fn()(
    (_, ctx) =>
      Effect.gen(function* () {
        const client = yield* AvaClientV2

        const streamProgram = client.subscribeAllArtifacts().pipe(
          Stream.tap((tagged) =>
            Effect.sync(() => {
              ctx.set(
                artifactsAtom,
                HashMap.set(ctx(artifactsAtom), tagged.viewId, tagged.artifact)
              )
            })
          ),
          Stream.runDrain
        )

        return yield* Effect.fork(streamProgram)
      })
  ),

  /**
   * Subscribe to all deltas (multi-view).
   * Useful for debugging/monitoring.
   */
  subscribeAllDeltas: avaV2Runtime.fn()(
    (_, ctx) =>
      Effect.gen(function* () {
        const client = yield* AvaClientV2

        const streamProgram = client.subscribeAllDeltas().pipe(
          Stream.tap((tagged) =>
            Effect.sync(() => {
              // Add delta to history (capped at 100)
              const current = ctx(deltasAtom)
              ctx.set(deltasAtom, [tagged.delta, ...current].slice(0, 100))
            })
          ),
          Stream.runDrain
        )

        return yield* Effect.fork(streamProgram)
      })
  ),

  /**
   * Subscribe to reconciler events.
   * For lifecycle monitoring.
   */
  subscribeEvents: avaV2Runtime.fn()(
    (_, ctx) =>
      Effect.gen(function* () {
        const client = yield* AvaClientV2

        const streamProgram = client.subscribeEvents().pipe(
          Stream.tap((event) =>
            Effect.sync(() => {
              // Add event to log (capped at 100)
              const current = ctx(eventsAtom)
              ctx.set(eventsAtom, [event, ...current].slice(0, 100))
            })
          ),
          Stream.runDrain
        )

        return yield* Effect.fork(streamProgram)
      })
  ),
}

// =============================================================================
// Reset
// =============================================================================

/**
 * Reset all AVA v2 state to defaults.
 * Use for testing or full cleanup.
 *
 * Note: Does NOT clear FiberMap in AvaClientV2 service.
 * For full cleanup including fibers, use avaV2Ops.unsubscribeAll().
 */
export const resetAvaV2State = (): void => {
  avaV2Registry.set(connectionStatusAtom, 'disconnected')
  avaV2Registry.set(errorAtom, null)
  avaV2Registry.set(subscriptionsAtom, HashMap.empty())
  avaV2Registry.set(artifactsAtom, HashMap.empty())
  avaV2Registry.set(deltasAtom, [])
  avaV2Registry.set(eventsAtom, [])
  avaV2Registry.set(avaV2ConfigAtom, DEFAULT_CONFIG)
}
