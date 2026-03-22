/**
 * TsingouFlow — Main pipeline lifecycle service.
 *
 * Effect.Service managing the full signal pipeline:
 *   1. AdapterManager drains signal queue (adapters push, this consumes)
 *   2. Signals feed into ingest D2 graph (stub until d2ts installed)
 *   3. Ingest output feeds derived D2 graph
 *   4. Derived output feeds OutputBridge → activeSignalsAtom → rendering
 *
 * Architecture (post-rewire):
 *   - Proper Effect.Service with scoped lifecycle
 *   - Layer composition for all Holonet + adapter dependencies
 *   - AdapterManager is a dependency (injected, not constructed)
 *   - OutputBridge is owned by this service
 *   - All operations traced via Effect.withSpan
 *   - Atom-as-State for all pipeline telemetry
 *
 * NOTE: d2ts graph construction is stubbed until @electric-sql/d2ts is installed.
 * The service contract and data flow are fully specified.
 *
 * @see TSINGOU_FLOW_ARCHITECTURE.md §5.4
 * @module tsingou-flow/services/TsingouFlow
 */

import {
  Effect,
  Queue,
  Fiber,
  Layer,
  pipe,
} from 'effect'
import { Atom } from '@effect-atom/atom'
import type { BaseSignal } from '../schemas/base-signal'
import { AdapterManager } from './AdapterManager'
import {
  type OutputBridgeShape,
  makeOutputBridge,
  activeSignalsAtom,
  derivedSignalCountAtom,
} from './OutputBridge'

// =============================================================================
// Pipeline State Atoms
// =============================================================================

/** Processing cycle counter (global tick). */
export const tickAtom = Atom.make(0)

/** Pipeline status. */
export const pipelineStatusAtom = Atom.make<
  'idle' | 'running' | 'paused' | 'error' | 'shutdown'
>('idle')

/** Signals processed in current tick. */
export const tickSignalCountAtom = Atom.make(0)

/** Processing cycle duration (ms). */
export const cycleDurationMsAtom = Atom.make(0)

/** Total signals processed across all ticks. */
export const totalProcessedAtom = Atom.make(0)

/** Drain loop throughput (signals/sec, rolling 5s window). */
export const throughputAtom = Atom.make(0)

// =============================================================================
// Service
// =============================================================================

export class TsingouFlow extends Effect.Service<TsingouFlow>()(
  'tsingou/TsingouFlow',
  {
    scoped: Effect.gen(function* () {
      const adapterManager = yield* AdapterManager

      // Create the output bridge (owned by this service)
      const outputBridge = yield* makeOutputBridge({
        queueCapacity: 1024,
        maxAtomItems: 10_000,
        batchSize: 8,
      })

      let processingFiber: Fiber.RuntimeFiber<void, never> | null = null
      let paused = false

      // Throughput tracking
      let recentCounts: Array<{ ts: number; count: number }> = []

      const updateThroughput = (count: number) => {
        const now = Date.now()
        recentCounts.push({ ts: now, count })
        // Keep only last 5 seconds
        recentCounts = recentCounts.filter((e) => now - e.ts < 5000)
        const total = recentCounts.reduce((sum, e) => sum + e.count, 0)
        const windowSec = Math.max(1, (now - (recentCounts[0]?.ts ?? now)) / 1000)
        Atom.set(throughputAtom, Math.round(total / windowSec))
      }

      // ─── Single processing cycle ──────────────────────────────────────
      const processCycle = Effect.gen(function* () {
        if (paused) {
          yield* Effect.sleep('10 millis')
          return 0
        }

        const cycleStart = Date.now()

        // Drain all available signals from adapter queue
        const signals = yield* Queue.takeAll(adapterManager.signalQueue)
        const signalArray = Array.from(signals) as BaseSignal[]

        if (signalArray.length > 0) {
          // Advance global tick
          const currentTick = Atom.unsafeGet(tickAtom) + 1
          Atom.set(tickAtom, currentTick)
          Atom.set(tickSignalCountAtom, signalArray.length)
          Atom.set(
            totalProcessedAtom,
            Atom.unsafeGet(totalProcessedAtom) + signalArray.length,
          )

          // =================================================================
          // d2ts GRAPH PROCESSING (stubbed until @electric-sql/d2ts installed)
          //
          // When d2ts is available, this section will:
          //   1. Create MultiSet from signalArray via fromBatch()
          //   2. Feed into ingest D2 graph input
          //   3. Send frontier advancement [tick, source_seq]
          //   4. Run ingest graph
          //   5. Ingest output feeds derived graph input
          //   6. Run derived graph
          //   7. Derived output() pushes to outputBridge.enqueue
          //
          // For now: pass-through (signals go directly to output bridge)
          // =================================================================

          for (const signal of signalArray) {
            yield* Queue.offer(outputBridge.enqueue, signal)
          }

          updateThroughput(signalArray.length)
        }

        const cycleDuration = Date.now() - cycleStart
        Atom.set(cycleDurationMsAtom, cycleDuration)

        // Yield to prevent busy-wait when no signals
        if (signalArray.length === 0) {
          yield* Effect.sleep('1 millis')
        }

        return signalArray.length
      }).pipe(Effect.withSpan('tsingou.flow.cycle'))

      // ─── Processing loop ──────────────────────────────────────────────
      const start: Effect.Effect<void> = Effect.gen(function* () {
        if (processingFiber !== null) {
          yield* Effect.log('[TsingouFlow] Already running')
          return
        }

        Atom.set(pipelineStatusAtom, 'running')
        paused = false

        processingFiber = yield* Effect.fork(
          Effect.forever(processCycle).pipe(
            Effect.catchAll((err) =>
              Effect.gen(function* () {
                Atom.set(pipelineStatusAtom, 'error')
                yield* Effect.logError(`[TsingouFlow] Processing error: ${err}`)
              }),
            ),
          ),
        )

        yield* Effect.log('[TsingouFlow] Processing loop started')
      }).pipe(Effect.withSpan('tsingou.flow.start'))

      const pause: Effect.Effect<void> = Effect.sync(() => {
        paused = true
        Atom.set(pipelineStatusAtom, 'paused')
      })

      const resume: Effect.Effect<void> = Effect.sync(() => {
        paused = false
        Atom.set(pipelineStatusAtom, 'running')
      })

      const step = processCycle

      const shutdown: Effect.Effect<void> = Effect.gen(function* () {
        if (processingFiber) {
          yield* Fiber.interrupt(processingFiber)
          processingFiber = null
        }
        yield* outputBridge.shutdown
        Atom.set(pipelineStatusAtom, 'shutdown')
        yield* Effect.log('[TsingouFlow] Shutdown complete')
      }).pipe(Effect.withSpan('tsingou.flow.shutdown'))

      // ─── cleanup on scope close ───────────────────────────────────────
      yield* Effect.addFinalizer(() => shutdown)

      yield* Effect.log('[TsingouFlow] Service initialized')

      return {
        /** Start the drain loop */
        start,
        /** Pause processing (queue accumulates) */
        pause,
        /** Resume processing */
        resume,
        /** Run a single cycle (for testing) */
        step,
        /** Shutdown pipeline */
        shutdown,
        /** Access to output bridge for direct enqueue */
        outputBridge,
        /** Access to adapter manager for hot-plug operations */
        adapterManager,
      }
    }),
    dependencies: [AdapterManager.Default],
  },
) {}

// =============================================================================
// Layer Composition
// =============================================================================

/**
 * Full Tsingou layer stack — composes all dependencies from Holonet down.
 *
 * Dependency tree:
 *   HolonetConfigTag.Default
 *     └── NatsConnectionService.Default
 *           └── NatsInnerService.Default
 *                 ├── NatsHubService.Default
 *                 │     └── NatsPubSubService.Default
 *                 ├── NatsStreamService.Default
 *                 └── NatsKVService.Default
 *
 *   AdapterManager.Default (scoped, creates SignalQueue)
 *     └── TsingouFlow.Default (scoped, creates OutputBridge)
 *
 * Usage:
 * ```typescript
 * import { TsingouFlowLive, TsingouFlow } from './services/TsingouFlow'
 *
 * // In an Effect program:
 * const program = Effect.gen(function* () {
 *   const flow = yield* TsingouFlow
 *   yield* flow.start
 *
 *   // Hot-plug an adapter
 *   const adapter = yield* flow.adapterManager.registerSimple(
 *     HttpSourceAdapter.scoped,
 *     Layer.succeed(HttpAdapterConfigTag, myConfig),
 *   )
 *
 *   // Subscribe to output
 *   const signals = Atom.unsafeGet(activeSignalsAtom)
 * })
 *
 * // Run with full layer stack:
 * Effect.runFork(program.pipe(Effect.provide(TsingouFlowLive)))
 * ```
 */
export const TsingouFlowLive = TsingouFlow.Default

// =============================================================================
// Convenience Type
// =============================================================================

export type TsingouFlowShape = Effect.Effect.Success<typeof TsingouFlow['scoped']>
