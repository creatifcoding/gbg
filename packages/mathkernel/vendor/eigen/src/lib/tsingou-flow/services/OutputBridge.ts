/**
 * OutputBridge — d2ts output() → Effect.Queue → Atom.set() bridge.
 *
 * The final stage of the Tsingou signal pipeline. Takes derived state from
 * d2ts output operators and delivers it to effect-atoms that rendering
 * layers (R3F, p5, visx, DOM) subscribe to.
 *
 * Design decisions:
 * - Effect.Queue with backpressure (bounded) to prevent memory blow-up
 * - Consumer fiber drains queue and sets atoms
 * - Frame-aligned batching option for rendering targets
 * - Atom-as-State pattern: atoms are the primary state, not Effect.Ref
 *
 * @see TSINGOU_FLOW_ARCHITECTURE.md §7
 * @see src/lib/streams/atoms/streamToAtom.ts — similar Stream→Atom bridge
 * @module tsingou-flow/services/OutputBridge
 */

import { Effect, Queue, Fiber } from 'effect'
import { Atom } from '@effect-atom/atom'
import type { BaseSignal } from '../schemas/base-signal'

// =============================================================================
// Output State Atoms
// =============================================================================

/**
 * Active signals — latest signals from the derived graph.
 * All rendering layers can subscribe.
 */
export const activeSignalsAtom = Atom.make<ReadonlyArray<BaseSignal>>([])

/**
 * Total derived signal count.
 */
export const derivedSignalCountAtom = Atom.make(0)

/**
 * Pipeline latency (ms from signal ingestion to atom update).
 */
export const pipelineLatencyAtom = Atom.make(0)

// =============================================================================
// Output Bridge Configuration
// =============================================================================

export interface OutputBridgeConfig {
  /**
   * Max items in the output queue before backpressure.
   * @default 1024
   */
  readonly queueCapacity?: number

  /**
   * Max items to accumulate in the atom.
   * Older items are dropped when exceeded.
   * @default 10000
   */
  readonly maxAtomItems?: number

  /**
   * Batch size for atom updates.
   * The consumer fiber waits until this many items are queued
   * OR a timeout expires before updating the atom.
   * @default 1 (immediate)
   */
  readonly batchSize?: number

  /**
   * Max wait time (ms) before flushing a partial batch.
   * Only used when batchSize > 1.
   * @default 16 (~60fps frame time)
   */
  readonly batchTimeoutMs?: number
}

// =============================================================================
// Output Bridge Shape
// =============================================================================

export interface OutputBridgeShape {
  /**
   * Enqueue side — d2ts output operators push derived signals here.
   */
  readonly enqueue: Queue.Enqueue<BaseSignal>

  /**
   * Consumer fiber handle for lifecycle management.
   */
  readonly consumerFiber: Fiber.RuntimeFiber<void, never>

  /**
   * Shutdown the bridge (interrupt consumer, shutdown queue).
   */
  readonly shutdown: Effect.Effect<void>
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create an OutputBridge with a consumer fiber that drains the queue
 * and sets atoms.
 *
 * Must be called within an Effect context (uses Effect.fork).
 *
 * @example
 * ```typescript
 * const bridge = yield* makeOutputBridge({ queueCapacity: 2048, maxAtomItems: 5000 })
 *
 * // d2ts output operator pushes here:
 * yield* Queue.offer(bridge.enqueue, derivedSignal)
 *
 * // React components subscribe to activeSignalsAtom
 * const signals = useAtomValue(activeSignalsAtom)
 *
 * // Shutdown:
 * yield* bridge.shutdown
 * ```
 */
export const makeOutputBridge = (
  config: OutputBridgeConfig = {},
): Effect.Effect<OutputBridgeShape> =>
  Effect.gen(function* () {
    const {
      queueCapacity = 1024,
      maxAtomItems = 10_000,
      batchSize = 1,
    } = config

    const queue = yield* Queue.bounded<BaseSignal>(queueCapacity)

    // Consumer fiber: drain queue → batch → set atoms
    const consumer = yield* Effect.fork(
      Effect.forever(
        Effect.gen(function* () {
          // Take up to batchSize items (blocks until at least 1 is available)
          const first = yield* Queue.take(queue)
          const rest = yield* Queue.takeUpTo(queue, batchSize - 1)
          const batch = [first, ...Array.from(rest)]

          // Update atoms
          yield* Effect.sync(() => {
            const current = Atom.unsafeGet(activeSignalsAtom)
            const updated = [...current, ...batch]

            // Cap at maxAtomItems
            const capped = updated.length > maxAtomItems
              ? updated.slice(-maxAtomItems)
              : updated

            Atom.set(activeSignalsAtom, capped)
            Atom.set(derivedSignalCountAtom, Atom.unsafeGet(derivedSignalCountAtom) + batch.length)
          })
        }),
      ),
    )

    const shutdown = Effect.gen(function* () {
      yield* Fiber.interrupt(consumer)
      yield* Queue.shutdown(queue)
      yield* Effect.log('[OutputBridge] Shutdown complete')
    })

    return {
      enqueue: queue,
      consumerFiber: consumer,
      shutdown,
    } satisfies OutputBridgeShape
  }).pipe(Effect.withSpan('output-bridge.create'))
