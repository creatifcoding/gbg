/**
 * AdapterManager — Hot-plug adapter lifecycle management.
 *
 * Effect.Service that manages source adapter registration, connection,
 * disconnection, and signal routing into the shared Effect.Queue that
 * feeds the d2ts ingest graph.
 *
 * Architecture (post-rewire):
 *
 *   Adapters are Effect.Service instances with scoped lifecycle.
 *   Each adapter is given its own Scope, so closing the scope = disconnect.
 *   AdapterManager creates the shared SignalQueue and provides it to all
 *   adapters via Context.
 *
 *   register(layer) → Scope.fork → Layer.buildWithScope → adapter running
 *   unregister(id) → Scope.close → adapter finalizers run → cleanup
 *
 * State: Atom.make() as primary state (Atom-as-State pattern per AGENTS.md).
 * React subscribes directly to adapterRegistryAtom, adapterHealthAtom, etc.
 *
 * Tagged errors: AdapterManagerError for structural failures.
 *
 * @see TSINGOU_FLOW_ARCHITECTURE.md §4.2
 * @see src/lib/streams/constructs/FeedsManager — similar orchestration pattern
 * @module tsingou-flow/services/AdapterManager
 */

import {
  Effect,
  Queue,
  Layer,
  Scope,
  Context,
  Data,
  Fiber,
  pipe,
} from 'effect'
import { Atom } from '@effect-atom/atom'
import type { BaseSignal } from '../schemas/base-signal'
import type { AdapterHealth, AdapterStatus } from '../schemas/adapter'
import {
  type SourceAdapterShape,
  SignalQueueTag,
} from '../adapters/types'

// =============================================================================
// Errors
// =============================================================================

export class AdapterManagerError extends Data.TaggedError('AdapterManagerError')<{
  readonly message: string
  readonly adapterId?: string
  readonly cause?: unknown
}> {}

// =============================================================================
// State Atoms (Atom-as-State pattern)
// =============================================================================

/**
 * Live registry of active adapters.
 * Key: adapterId, Value: RegisteredAdapter
 */
export interface RegisteredAdapter {
  readonly shape: SourceAdapterShape
  readonly scope: Scope.CloseableScope
  readonly registeredAt: Date
}

export const adapterRegistryAtom = Atom.make(
  new Map<string, RegisteredAdapter>(),
)

/**
 * Adapter health snapshots — derived from individual adapter healthAtoms.
 * Key: adapterId, Value: AdapterHealth
 */
export const adapterHealthAtom = Atom.make(
  new Map<string, AdapterHealth>(),
)

/**
 * Count of total signals ingested across all adapters.
 */
export const totalSignalCountAtom = Atom.make(0)

/**
 * Lifecycle events stream (for UI rendering).
 */
export const lifecycleEventsAtom = Atom.make<
  ReadonlyArray<{ type: string; adapterId: string; timestamp: Date; detail?: string }>
>([])

const appendLifecycleEvent = (
  type: string,
  adapterId: string,
  detail?: string,
) => {
  const events = Atom.unsafeGet(lifecycleEventsAtom)
  const capped = events.length > 200 ? events.slice(-100) : events
  Atom.set(lifecycleEventsAtom, [
    ...capped,
    { type, adapterId, timestamp: new Date(), detail },
  ])
}

// =============================================================================
// AdapterManager Service
// =============================================================================

export class AdapterManager extends Effect.Service<AdapterManager>()(
  'tsingou/AdapterManager',
  {
    scoped: Effect.gen(function* () {
      // Create the shared signal queue that all adapters push into
      const signalQueue = yield* Queue.bounded<BaseSignal>(4096)

      // The base layer that provides SignalQueueTag to all adapters
      const queueLayer = Layer.succeed(SignalQueueTag, signalQueue)

      // Signal counter fiber — periodically sums individual adapter counters
      const counterFiber = yield* pipe(
        Effect.forever(
          Effect.gen(function* () {
            const registry = Atom.unsafeGet(adapterRegistryAtom)
            let total = 0
            const healthMap = new Map<string, AdapterHealth>()
            for (const [id, entry] of registry) {
              const count = Atom.unsafeGet(entry.shape.signalCountAtom)
              total += count
              const health = Atom.unsafeGet(entry.shape.healthAtom)
              healthMap.set(id, health)
            }
            Atom.set(totalSignalCountAtom, total)
            Atom.set(adapterHealthAtom, healthMap)
            yield* Effect.sleep('500 millis')
          }),
        ),
        Effect.fork,
      )

      yield* Effect.log('[AdapterManager] Initialized with queue capacity 4096')
      appendLifecycleEvent('initialized', '*', 'queue capacity 4096')

      // ─── register ─────────────────────────────────────────────────────
      /**
       * Register and connect an adapter at runtime (hot-plug).
       *
       * The adapter layer should produce the adapter's Effect.Service tag.
       * We fork a Scope, build the layer within it, and extract the
       * SourceAdapterShape from the resulting context.
       *
       * @param adapterLayer - The Layer that produces the adapter service
       * @param serviceTag - The Context.Tag to extract the adapter from
       * @param baseLayer - Optional additional layer dependencies (e.g., Holonet)
       */
      const register = <S extends SourceAdapterShape>(
        adapterLayer: Layer.Layer<any, any, any>,
        extract: (ctx: Context.Context<any>) => S,
        baseLayer?: Layer.Layer<any, any, never>,
      ): Effect.Effect<S, AdapterManagerError> =>
        Effect.gen(function* () {
          // Fork a dedicated scope for this adapter
          const adapterScope = yield* Scope.make()

          // Compose: queueLayer + optional base + adapter
          const fullLayer = baseLayer
            ? pipe(
                Layer.merge(queueLayer, baseLayer),
                Layer.provideMerge(adapterLayer),
              )
            : pipe(queueLayer, Layer.provideMerge(adapterLayer))

          // Build the layer within the adapter's scope
          const ctx = yield* pipe(
            Layer.buildWithScope(fullLayer, adapterScope),
            Effect.catchAll((cause) =>
              new AdapterManagerError({
                message: `Failed to build adapter layer: ${cause}`,
                cause,
              }),
            ),
          )

          // Extract the adapter shape
          const shape = extract(ctx)

          // Check for duplicate
          const existing = Atom.unsafeGet(adapterRegistryAtom)
          if (existing.has(shape.adapterId)) {
            // Close the new scope — duplicate rejected
            yield* Scope.close(adapterScope, { _tag: 'Success', value: undefined } as any)
            return yield* new AdapterManagerError({
              message: `Adapter already registered: ${shape.adapterId}`,
              adapterId: shape.adapterId,
            })
          }

          // Register in atom
          const updated = new Map(existing)
          updated.set(shape.adapterId, {
            shape,
            scope: adapterScope,
            registeredAt: new Date(),
          })
          Atom.set(adapterRegistryAtom, updated)

          appendLifecycleEvent('registered', shape.adapterId, `kind: ${shape.kind}`)
          yield* Effect.log(
            `[AdapterManager] Registered: ${shape.adapterId} (${shape.kind})`,
          )

          return shape
        }).pipe(
          Effect.withSpan('adapter-manager.register'),
        )

      // ─── registerSimple ───────────────────────────────────────────────
      /**
       * Simplified registration for adapters that return SourceAdapterShape
       * directly from a scoped Effect.
       *
       * @param make - Scoped effect that produces the adapter shape
       * @param deps - Layer providing adapter's dependencies (minus SignalQueue)
       */
      const registerSimple = (
        make: Effect.Effect<SourceAdapterShape, any, any>,
        deps?: Layer.Layer<any, any, never>,
      ): Effect.Effect<SourceAdapterShape, AdapterManagerError> =>
        Effect.gen(function* () {
          const adapterScope = yield* Scope.make()

          // Provide SignalQueue + any deps, then run in the scope
          const provided = deps
            ? Effect.provide(make, Layer.merge(queueLayer, deps))
            : Effect.provide(make, queueLayer)

          const shape = yield* pipe(
            Effect.provideService(provided, Scope.Scope, adapterScope),
            Effect.catchAll((cause) =>
              new AdapterManagerError({
                message: `Failed to start adapter: ${cause}`,
                cause,
              }),
            ),
          )

          // Check for duplicate
          const existing = Atom.unsafeGet(adapterRegistryAtom)
          if (existing.has(shape.adapterId)) {
            yield* Scope.close(adapterScope, { _tag: 'Success', value: undefined } as any)
            return yield* new AdapterManagerError({
              message: `Adapter already registered: ${shape.adapterId}`,
              adapterId: shape.adapterId,
            })
          }

          const updated = new Map(existing)
          updated.set(shape.adapterId, {
            shape,
            scope: adapterScope,
            registeredAt: new Date(),
          })
          Atom.set(adapterRegistryAtom, updated)

          appendLifecycleEvent('registered', shape.adapterId, `kind: ${shape.kind}`)
          yield* Effect.log(
            `[AdapterManager] Registered: ${shape.adapterId} (${shape.kind})`,
          )

          return shape
        }).pipe(Effect.withSpan('adapter-manager.register-simple'))

      // ─── unregister ───────────────────────────────────────────────────
      const unregister = (adapterId: string): Effect.Effect<void, AdapterManagerError> =>
        Effect.gen(function* () {
          const registry = Atom.unsafeGet(adapterRegistryAtom)
          const entry = registry.get(adapterId)

          if (!entry) {
            return yield* new AdapterManagerError({
              message: `Adapter not found: ${adapterId}`,
              adapterId,
            })
          }

          // Close the adapter's scope — this triggers all finalizers
          // (stream interruption, connection close, cleanup)
          yield* Effect.uninterruptibleMask((_restore) =>
            Scope.close(entry.scope, { _tag: 'Success', value: undefined } as any).pipe(
              Effect.catchAll((err) =>
                Effect.log(`[AdapterManager] Scope close error for ${adapterId}: ${err}`),
              ),
            ),
          )

          // Remove from registry
          const updated = new Map(Atom.unsafeGet(adapterRegistryAtom))
          updated.delete(adapterId)
          Atom.set(adapterRegistryAtom, updated)

          // Remove from health
          const health = new Map(Atom.unsafeGet(adapterHealthAtom))
          health.delete(adapterId)
          Atom.set(adapterHealthAtom, health)

          appendLifecycleEvent('unregistered', adapterId)
          yield* Effect.log(`[AdapterManager] Unregistered: ${adapterId}`)
        }).pipe(
          Effect.withSpan('adapter-manager.unregister', { attributes: { adapterId } }),
        )

      // ─── pause / resume ───────────────────────────────────────────────
      const pauseAdapter = (adapterId: string): Effect.Effect<void, AdapterManagerError> =>
        Effect.gen(function* () {
          const registry = Atom.unsafeGet(adapterRegistryAtom)
          const entry = registry.get(adapterId)
          if (!entry) {
            return yield* new AdapterManagerError({
              message: `Adapter not found: ${adapterId}`,
              adapterId,
            })
          }
          yield* entry.shape.pause
          appendLifecycleEvent('paused', adapterId)
        })

      const resumeAdapter = (adapterId: string): Effect.Effect<void, AdapterManagerError> =>
        Effect.gen(function* () {
          const registry = Atom.unsafeGet(adapterRegistryAtom)
          const entry = registry.get(adapterId)
          if (!entry) {
            return yield* new AdapterManagerError({
              message: `Adapter not found: ${adapterId}`,
              adapterId,
            })
          }
          yield* entry.shape.resume
          appendLifecycleEvent('resumed', adapterId)
        })

      // ─── queries ──────────────────────────────────────────────────────
      const list: Effect.Effect<ReadonlyArray<SourceAdapterShape>> = Effect.sync(() =>
        Array.from(Atom.unsafeGet(adapterRegistryAtom).values()).map((e) => e.shape),
      )

      const getHealth = (adapterId: string): Effect.Effect<AdapterHealth | null> =>
        Effect.sync(() => {
          const registry = Atom.unsafeGet(adapterRegistryAtom)
          const entry = registry.get(adapterId)
          if (!entry) return null
          return Atom.unsafeGet(entry.shape.healthAtom)
        })

      const getAdapter = (adapterId: string): Effect.Effect<SourceAdapterShape | null> =>
        Effect.sync(() => {
          const registry = Atom.unsafeGet(adapterRegistryAtom)
          const entry = registry.get(adapterId)
          return entry?.shape ?? null
        })

      // ─── shutdown ─────────────────────────────────────────────────────
      const shutdownAll: Effect.Effect<void> = Effect.gen(function* () {
        const registry = Atom.unsafeGet(adapterRegistryAtom)
        const ids = Array.from(registry.keys())

        yield* Effect.log(`[AdapterManager] Shutting down ${ids.length} adapters`)

        // Unregister all (closes scopes)
        yield* Effect.forEach(ids, (id) =>
          unregister(id).pipe(
            Effect.catchAll((err) =>
              Effect.log(`[AdapterManager] Shutdown error for ${id}: ${err.message}`),
            ),
          ),
        )

        // Shutdown the signal queue
        yield* Queue.shutdown(signalQueue)
        // Interrupt counter fiber
        yield* Fiber.interrupt(counterFiber)

        appendLifecycleEvent('shutdown', '*')
        yield* Effect.log('[AdapterManager] Shutdown complete')
      }).pipe(Effect.withSpan('adapter-manager.shutdown'))

      // ─── cleanup on scope close ───────────────────────────────────────
      yield* Effect.addFinalizer(() => shutdownAll)

      return {
        register,
        registerSimple,
        unregister,
        pauseAdapter,
        resumeAdapter,
        list,
        getHealth,
        getAdapter,
        shutdownAll,
        signalQueue,
      }
    }),
  },
) {}

// =============================================================================
// Convenience Type
// =============================================================================

export type AdapterManagerShape = Effect.Effect.Success<typeof AdapterManager['scoped']>
