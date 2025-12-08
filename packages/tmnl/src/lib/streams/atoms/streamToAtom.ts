/**
 * streamToAtom — Progressive Stream → Atom Subscription
 *
 * Bridges Effect Streams with effect-atom, enabling progressive updates
 * with accumulation, batching, and proper cleanup.
 *
 * Key differences from built-in Atom.make(stream):
 * - **Accumulation**: Combine previous value with new emission (not replace)
 * - **Batching**: Batch React updates to every N emissions (prevent thrashing)
 * - **maxItems**: Cap accumulated array length (memory management)
 * - **Callbacks**: onComplete/onError hooks for lifecycle awareness
 *
 * @module
 */

import { Atom } from "@effect-atom/atom"
import * as Registry from "@effect-atom/atom/Registry"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Fiber from "effect/Fiber"

// ============================================================================
// TYPES
// ============================================================================

/**
 * Configuration for streamToAtom behavior.
 *
 * @typeParam A - Stream element type
 * @typeParam B - Atom value type (often A[] but can be any accumulation)
 */
export interface StreamToAtomOptions<A, B> {
  /** Initial value before stream emits */
  readonly initialValue: B

  /**
   * How to combine previous value with new emission.
   *
   * @example Array accumulation
   * accumulate: (prev, next) => [...prev, next]
   *
   * @example Running sum
   * accumulate: (prev, next) => prev + next
   *
   * @example Latest-N window
   * accumulate: (prev, next) => [...prev, next].slice(-100)
   */
  readonly accumulate: (prev: B, next: A) => B

  /**
   * Batch React updates to every N emissions (default: 1).
   * Higher values reduce render frequency but increase latency.
   *
   * @example For high-frequency streams (1000+ events/sec):
   * batchEvery: 50 // Update UI every 50 items
   */
  readonly batchEvery?: number

  /**
   * Maximum items to retain (for array-like accumulators).
   * When exceeded, oldest items are dropped.
   *
   * Only applies when accumulator returns an array-like value.
   */
  readonly maxItems?: number

  /** Callback on stream completion */
  readonly onComplete?: (final: B) => void

  /** Callback on stream error */
  readonly onError?: (error: unknown) => void
}

/**
 * Status of the stream subscription
 */
export type StreamAtomStatus = "idle" | "running" | "complete" | "error"

/**
 * Internal state for the stream subscription
 */
interface StreamAtomState<B> {
  readonly value: B
  readonly status: StreamAtomStatus
  readonly emitCount: number
}

/**
 * Handle returned by streamToAtom for lifecycle control.
 */
export interface StreamAtomHandle<B> {
  /** The atom containing accumulated value (read-only view) */
  readonly atom: Atom.Atom<B>

  /** Status atom for monitoring subscription state */
  readonly statusAtom: Atom.Atom<StreamAtomStatus>

  /**
   * Writable atom to start the subscription.
   * Write `true` to start, `false` to stop.
   */
  readonly controlAtom: Atom.Writable<boolean, boolean>

  /**
   * Start the subscription.
   */
  readonly start: () => void

  /**
   * Stop the subscription.
   */
  readonly stop: () => void

  /**
   * Internal registry for imperative control.
   * Exposed for testing and advanced use cases.
   */
  readonly _registry: Registry.Registry
}

// ============================================================================
// CORE IMPLEMENTATION
// ============================================================================

/**
 * Create an atom that subscribes to a stream with progressive updates.
 *
 * @example Basic array accumulation
 * ```typescript
 * const handle = streamToAtom(eventStream, {
 *   initialValue: [],
 *   accumulate: (prev, next) => [...prev, next],
 * })
 *
 * // Start subscription
 * handle.start()
 *
 * // In React component:
 * const events = useAtomValue(handle.atom)
 * const status = useAtomValue(handle.statusAtom)
 *
 * // Stop subscription:
 * handle.stop()
 * ```
 *
 * @example High-frequency stream with batching
 * ```typescript
 * const handle = streamToAtom(sensorStream, {
 *   initialValue: [],
 *   accumulate: (prev, next) => [...prev, next],
 *   batchEvery: 50,        // Update UI every 50 items
 *   maxItems: 1000,        // Keep last 1000 readings
 *   onComplete: (final) => console.log(`Received ${final.length} readings`),
 * })
 * ```
 *
 * @param stream - The Effect Stream to subscribe to
 * @param options - Configuration for accumulation, batching, and lifecycle
 * @returns Handle with atom, status, and lifecycle controls
 */
export const streamToAtom = <A, B>(
  stream: Stream.Stream<A, unknown, never>,
  options: StreamToAtomOptions<A, B>
): StreamAtomHandle<B> => {
  const {
    initialValue,
    accumulate,
    batchEvery = 1,
    maxItems,
    onComplete,
    onError,
  } = options

  // Create internal registry FIRST (needed by fiber updates)
  const registry = Registry.make()

  // Single state atom for atomicity (similar to Animatable pattern)
  const stateAtom = Atom.make<StreamAtomState<B>>({
    value: initialValue,
    status: "idle",
    emitCount: 0,
  })

  // Track running fiber for cleanup
  let runningFiber: Fiber.RuntimeFiber<void, unknown> | null = null

  // Derived read-only atoms
  const valueAtom = Atom.make((get) => get(stateAtom).value)
  const statusAtom = Atom.make((get) => get(stateAtom).status)

  // Helper to update state via registry (safe from async contexts)
  const updateState = (state: StreamAtomState<B>) => {
    registry.set(stateAtom, state)
  }

  // Control atom: write true to start, false to stop
  const controlAtom: Atom.Writable<boolean, boolean> = Atom.writable(
    (get) => get(stateAtom).status === "running",
    (_ctx, shouldRun) => {
      const currentState = registry.get(stateAtom)

      if (shouldRun && currentState.status !== "running") {
        // Start subscription
        updateState({
          value: initialValue,
          status: "running",
          emitCount: 0,
        })

        // Fork the stream consumer
        let current: B = initialValue
        let emitCount = 0

        const fiber = Effect.runFork(
          stream.pipe(
            Stream.tap((value) =>
              Effect.sync(() => {
                // Accumulate
                current = accumulate(current, value)
                emitCount++

                // Apply maxItems cap for array-like values
                if (maxItems !== undefined && Array.isArray(current)) {
                  if (current.length > maxItems) {
                    current = current.slice(-maxItems) as unknown as B
                  }
                }

                // Batch: only update atom every N emissions
                if (emitCount % batchEvery === 0) {
                  updateState({
                    value: current,
                    status: "running",
                    emitCount,
                  })
                }
              })
            ),
            // Final update on completion
            Stream.ensuring(
              Effect.sync(() => {
                // Ensure final value is published
                updateState({
                  value: current,
                  status: "complete",
                  emitCount,
                })
                runningFiber = null
                onComplete?.(current)
              })
            ),
            Stream.runDrain,
            // Handle errors
            Effect.tapError((error) =>
              Effect.sync(() => {
                updateState({
                  value: current,
                  status: "error",
                  emitCount,
                })
                runningFiber = null
                onError?.(error)
              })
            ),
            Effect.catchAll(() => Effect.void) // Prevent unhandled errors
          )
        )

        runningFiber = fiber
      } else if (!shouldRun && currentState.status === "running") {
        // Stop subscription
        if (runningFiber !== null) {
          Effect.runFork(Fiber.interrupt(runningFiber))
          runningFiber = null
        }
        updateState({
          ...currentState,
          status: "idle",
        })
      }
    }
  )

  // Convenience methods using the internal registry
  const start = () => {
    registry.set(controlAtom, true)
  }

  const stop = () => {
    registry.set(controlAtom, false)
  }

  return {
    atom: valueAtom,
    statusAtom,
    controlAtom,
    start,
    stop,
    /** Internal registry for testing/advanced use */
    _registry: registry,
  }
}

// ============================================================================
// CONVENIENCE VARIANTS
// ============================================================================

/**
 * Create a stream-backed atom that auto-starts immediately.
 *
 * @example
 * ```typescript
 * const { atom, stop } = eagerStreamToAtom(heartbeat, {
 *   initialValue: [],
 *   accumulate: (prev, next) => [...prev, next].slice(-10),
 * })
 *
 * // Stream starts immediately
 * ```
 */
export const eagerStreamToAtom = <A, B>(
  stream: Stream.Stream<A, unknown, never>,
  options: StreamToAtomOptions<A, B>
): StreamAtomHandle<B> => {
  const handle = streamToAtom(stream, options)

  // Start immediately
  handle.start()

  return handle
}

// ============================================================================
// ARRAY HELPERS
// ============================================================================

/**
 * Standard array accumulator — append to end.
 */
export const appendAccumulator = <A>() =>
  (prev: readonly A[], next: A): readonly A[] => [...prev, next]

/**
 * Window accumulator — keep last N items.
 */
export const windowAccumulator =
  <A>(size: number) =>
  (prev: readonly A[], next: A): readonly A[] =>
    [...prev, next].slice(-size)

/**
 * Prepend accumulator — add to front (reverse order).
 */
export const prependAccumulator = <A>() =>
  (prev: readonly A[], next: A): readonly A[] => [next, ...prev]
