/**
 * feedToAtom — Feed → Atom Lifecycle Bridge
 *
 * Bridges TMNL Feed constructs with effect-atom, providing:
 * - **Auto-start**: Optional start on first subscription
 * - **Auto-stop**: Optional stop when no subscribers
 * - **Accumulation**: Same accumulator pattern as streamToAtom
 * - **Status tracking**: Idle/running/complete/error
 *
 * Key difference from streamToAtom:
 * - Feed has explicit lifecycle (start/stop/pause)
 * - feedToAtom manages that lifecycle based on atom subscriptions
 *
 * @module
 */

import { Atom } from "@effect-atom/atom"
import * as Registry from "@effect-atom/atom/Registry"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Stream from "effect/Stream"
import { Feed } from "../constructs/Feed"

// ============================================================================
// TYPES
// ============================================================================

/**
 * Configuration for feedToAtom behavior.
 *
 * @typeParam A - Feed event type
 * @typeParam B - Atom value type (often A[] but can be any accumulation)
 */
export interface FeedToAtomOptions<A, B> {
  /** Initial value before feed starts */
  readonly initialValue: B

  /**
   * How to combine previous value with new emission.
   *
   * @example Array accumulation
   * accumulate: (prev, next) => [...prev, next]
   */
  readonly accumulate: (prev: B, next: A) => B

  /**
   * Auto-start feed on first subscription? (default: true)
   * If false, must call handle.start() manually.
   */
  readonly autoStart?: boolean

  /**
   * Auto-stop feed when atom has no subscribers? (default: true)
   * If false, feed continues running even without subscribers.
   */
  readonly autoStop?: boolean

  /**
   * Batch React updates to every N emissions (default: 1).
   */
  readonly batchEvery?: number

  /**
   * Maximum items to retain (for array-like accumulators).
   */
  readonly maxItems?: number

  /** Callback on stream completion */
  readonly onComplete?: (final: B) => void

  /** Callback on stream error */
  readonly onError?: (error: unknown) => void
}

/**
 * Status of the feed subscription
 */
export type FeedAtomStatus = "idle" | "running" | "complete" | "error"

/**
 * Internal state for the feed subscription
 */
interface FeedAtomState<B> {
  readonly value: B
  readonly status: FeedAtomStatus
  readonly emitCount: number
  readonly subscriberCount: number
}

/**
 * Handle returned by feedToAtom for lifecycle control.
 */
export interface FeedAtomHandle<A, B, E, R> {
  /** The atom containing accumulated value (read-only view) */
  readonly atom: Atom.Atom<B>

  /** Status atom for monitoring subscription state */
  readonly statusAtom: Atom.Atom<FeedAtomStatus>

  /** Reference to the underlying feed */
  readonly feed: Feed<A, E, R>

  /**
   * Start the feed. Idempotent.
   */
  readonly start: () => void

  /**
   * Stop the feed. Idempotent.
   */
  readonly stop: () => void

  /**
   * Subscribe to atom updates. Returns unsubscribe function.
   * If autoStart is true, starts feed on first subscription.
   * If autoStop is true, stops feed when last subscriber leaves.
   */
  readonly subscribe: (callback: (value: B) => void) => () => void

  /** Internal registry for testing/advanced use */
  readonly _registry: Registry.Registry
}

// ============================================================================
// CORE IMPLEMENTATION
// ============================================================================

/**
 * Create an atom that subscribes to a Feed with lifecycle management.
 *
 * @example Basic usage
 * ```typescript
 * const sensorFeed = Feed.make({
 *   id: "sensor-1",
 *   producer: readSensor,
 *   interval: "100ms",
 * })
 *
 * const handle = feedToAtom(sensorFeed, {
 *   initialValue: [],
 *   accumulate: (prev, next) => [...prev, next].slice(-100),
 * })
 *
 * // Subscribe triggers auto-start
 * const unsub = handle.subscribe((readings) => {
 *   console.log(`Got ${readings.length} readings`)
 * })
 *
 * // Later: unsubscribe triggers auto-stop
 * unsub()
 * ```
 *
 * @example Manual lifecycle control
 * ```typescript
 * const handle = feedToAtom(sensorFeed, {
 *   initialValue: [],
 *   accumulate: (prev, next) => [...prev, next],
 *   autoStart: false,
 *   autoStop: false,
 * })
 *
 * handle.start()
 * // ... use handle.subscribe() ...
 * handle.stop()
 * ```
 *
 * @param feed - The Feed to subscribe to
 * @param options - Configuration for accumulation, batching, and lifecycle
 * @returns Handle with atom, lifecycle controls, and subscribe method
 */
export const feedToAtom = <A, E = never, R = never, B = readonly A[]>(
  feed: Feed<A, E, R>,
  options: FeedToAtomOptions<A, B>
): FeedAtomHandle<A, B, E, R> => {
  const {
    initialValue,
    accumulate,
    autoStart = true,
    autoStop = true,
    batchEvery = 1,
    maxItems,
    onComplete,
    onError,
  } = options

  // Create internal registry
  const registry = Registry.make()

  // Single state atom for atomicity
  const stateAtom = Atom.make<FeedAtomState<B>>({
    value: initialValue,
    status: "idle",
    emitCount: 0,
    subscriberCount: 0,
  })

  // Track running fiber
  let runningFiber: Fiber.RuntimeFiber<void, unknown> | null = null

  // Derived read-only atoms
  const valueAtom = Atom.make((get) => get(stateAtom).value)
  const statusAtom = Atom.make((get) => get(stateAtom).status)

  // Helper to update state via registry
  const updateState = (
    update: Partial<FeedAtomState<B>> | ((prev: FeedAtomState<B>) => Partial<FeedAtomState<B>>)
  ) => {
    const currentState = registry.get(stateAtom)
    const patch = typeof update === "function" ? update(currentState) : update
    registry.set(stateAtom, { ...currentState, ...patch })
  }

  // Start the feed stream subscription
  const startInternal = () => {
    const currentState = registry.get(stateAtom)
    if (currentState.status === "running") {
      return // Already running
    }

    updateState({
      value: initialValue,
      status: "running",
      emitCount: 0,
    })

    let current: B = initialValue
    let emitCount = 0

    const fiber = Effect.runFork(
      feed.stream.pipe(
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
        Stream.runDrain,
        // Handle success: Effect.tap runs only when Effect succeeds
        Effect.tap(() =>
          Effect.sync(() => {
            updateState({
              value: current,
              status: "complete",
              emitCount,
            })
            runningFiber = null
            onComplete?.(current)
          })
        ),
        // Handle errors: Effect.tapError runs only on error
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
        Effect.catchAll(() => Effect.void)
      )
    )

    runningFiber = fiber
  }

  // Stop the feed stream subscription
  const stopInternal = () => {
    const currentState = registry.get(stateAtom)
    if (currentState.status !== "running") {
      return // Not running
    }

    if (runningFiber !== null) {
      Effect.runFork(Fiber.interrupt(runningFiber))
      runningFiber = null
    }

    updateState({ status: "idle" })
  }

  // Public start - just starts the stream subscription
  // Note: We don't call feed.start() because feed.stream is independent
  // of the Feed's PubSub lifecycle. The stream directly repeats the producer.
  const start = () => {
    startInternal()
  }

  // Public stop - just stops the stream subscription
  const stop = () => {
    stopInternal()
  }

  // Subscribe with auto-start/auto-stop behavior
  const subscribe = (callback: (value: B) => void): (() => void) => {
    // Increment subscriber count
    updateState((state) => ({
      subscriberCount: state.subscriberCount + 1,
    }))

    // Auto-start if configured and first subscriber
    const currentState = registry.get(stateAtom)
    if (autoStart && currentState.subscriberCount === 1 && currentState.status === "idle") {
      start()
    }

    // Subscribe to value changes
    const unsub = registry.subscribe(valueAtom, callback, { immediate: true })

    // Return unsubscribe function
    return () => {
      unsub()

      // Decrement subscriber count
      updateState((state) => ({
        subscriberCount: Math.max(0, state.subscriberCount - 1),
      }))

      // Auto-stop if configured and no subscribers left
      const newState = registry.get(stateAtom)
      if (autoStop && newState.subscriberCount === 0 && newState.status === "running") {
        stop()
      }
    }
  }

  return {
    atom: valueAtom,
    statusAtom,
    feed,
    start,
    stop,
    subscribe,
    _registry: registry,
  }
}

// ============================================================================
// CONVENIENCE FACTORIES
// ============================================================================

/**
 * Create a feedToAtom with array accumulation defaults.
 *
 * @example
 * ```typescript
 * const handle = feedToAtomArray(sensorFeed, { maxItems: 1000 })
 * ```
 */
export const feedToAtomArray = <A, E = never, R = never>(
  feed: Feed<A, E, R>,
  options?: Omit<FeedToAtomOptions<A, readonly A[]>, "initialValue" | "accumulate"> & {
    readonly initialValue?: readonly A[]
  }
): FeedAtomHandle<A, readonly A[], E, R> =>
  feedToAtom(feed, {
    initialValue: options?.initialValue ?? [],
    accumulate: (prev, next) => [...prev, next],
    ...options,
  })

/**
 * Create a feedToAtom that keeps only the latest value.
 *
 * @example
 * ```typescript
 * const handle = feedToAtomLatest(heartbeatFeed)
 * // handle.atom always contains the latest heartbeat
 * ```
 */
export const feedToAtomLatest = <A, E = never, R = never>(
  feed: Feed<A, E, R>,
  options?: Omit<FeedToAtomOptions<A, A | null>, "initialValue" | "accumulate" | "maxItems">
): FeedAtomHandle<A, A | null, E, R> =>
  feedToAtom(feed, {
    initialValue: null,
    accumulate: (_prev, next) => next,
    ...options,
  })
