/**
 * channelOutletAtom — Channel Outlet → Atom Subscription
 *
 * Bridges TMNL Channel outlets with effect-atom, providing:
 * - **ChannelService integration**: Gets outlet stream from service
 * - **Accumulation**: Same accumulator pattern as streamToAtom
 * - **Lifecycle**: Starts on subscription, stops on cleanup
 *
 * Two levels of abstraction:
 * 1. `channelOutletAtom` — Effect-based factory (requires ChannelService)
 * 2. `outletToAtom` — Pure function for when you have the stream
 *
 * @module
 */

import { Atom } from "@effect-atom/atom"
import * as Registry from "@effect-atom/atom/Registry"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Fiber from "effect/Fiber"
import type { OutletId, ChannelId } from "../constructs/Channel"
import { ChannelService, type ChannelServiceError } from "../constructs/ChannelService"

// ============================================================================
// TYPES
// ============================================================================

/**
 * Configuration for channel outlet atom behavior.
 *
 * @typeParam A - Outlet event type
 * @typeParam B - Atom value type (often A[] but can be any accumulation)
 */
export interface ChannelOutletAtomOptions<A, B> {
  /** Initial value before outlet emits */
  readonly initialValue: B

  /**
   * How to combine previous value with new emission.
   *
   * @example Array accumulation
   * accumulate: (prev, next) => [...prev, next]
   */
  readonly accumulate: (prev: B, next: A) => B

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
 * Status of the outlet subscription
 */
export type OutletAtomStatus = "idle" | "running" | "complete" | "error"

/**
 * Internal state for the outlet subscription
 */
interface OutletAtomState<B> {
  readonly value: B
  readonly status: OutletAtomStatus
  readonly emitCount: number
}

/**
 * Handle returned by channelOutletAtom for lifecycle control.
 */
export interface ChannelOutletAtomHandle<A, B> {
  /** The atom containing accumulated value (read-only view) */
  readonly atom: Atom.Atom<B>

  /** Status atom for monitoring subscription state */
  readonly statusAtom: Atom.Atom<OutletAtomStatus>

  /** Channel ID this handle subscribes to */
  readonly channelId: ChannelId

  /** Outlet ID this handle subscribes to */
  readonly outletId: OutletId

  /**
   * Start the outlet subscription. Idempotent.
   */
  readonly start: () => void

  /**
   * Stop the outlet subscription. Idempotent.
   */
  readonly stop: () => void

  /** Internal registry for testing/advanced use */
  readonly _registry: Registry.Registry
}

// ============================================================================
// PURE IMPLEMENTATION (takes a stream directly)
// ============================================================================

/**
 * Create an atom from a raw outlet stream.
 *
 * Use this when you already have the outlet stream.
 * For ChannelService integration, use `channelOutletAtom` instead.
 *
 * @example
 * ```typescript
 * const stream = yield* channelService.getOutletStream(channelId, outletId)
 * const handle = outletToAtom(stream, channelId, outletId, {
 *   initialValue: [],
 *   accumulate: (prev, next) => [...prev, next],
 * })
 * ```
 */
export const outletToAtom = <A, E = never, B = readonly A[]>(
  stream: Stream.Stream<A, E, never>,
  channelId: ChannelId,
  outletId: OutletId,
  options: ChannelOutletAtomOptions<A, B>
): ChannelOutletAtomHandle<A, B> => {
  const {
    initialValue,
    accumulate,
    batchEvery = 1,
    maxItems,
    onComplete,
    onError,
  } = options

  // Create internal registry
  const registry = Registry.make()

  // Single state atom for atomicity
  const stateAtom = Atom.make<OutletAtomState<B>>({
    value: initialValue,
    status: "idle",
    emitCount: 0,
  })

  // Track running fiber
  let runningFiber: Fiber.RuntimeFiber<void, unknown> | null = null

  // Derived read-only atoms
  const valueAtom = Atom.make((get) => get(stateAtom).value)
  const statusAtom = Atom.make((get) => get(stateAtom).status)

  // Helper to update state via registry
  const updateState = (
    update: Partial<OutletAtomState<B>> | ((prev: OutletAtomState<B>) => Partial<OutletAtomState<B>>)
  ) => {
    const currentState = registry.get(stateAtom)
    const patch = typeof update === "function" ? update(currentState) : update
    registry.set(stateAtom, { ...currentState, ...patch })
  }

  // Start the outlet stream subscription
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
        Stream.runDrain,
        // Handle success
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
        Effect.catchAll(() => Effect.void)
      )
    )

    runningFiber = fiber
  }

  // Stop the outlet stream subscription
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

  return {
    atom: valueAtom,
    statusAtom,
    channelId,
    outletId,
    start: startInternal,
    stop: stopInternal,
    _registry: registry,
  }
}

// ============================================================================
// CHANNEL SERVICE INTEGRATION
// ============================================================================

/**
 * Create a channel outlet atom with ChannelService integration.
 *
 * This Effect-based factory:
 * 1. Gets the outlet stream from ChannelService
 * 2. Creates an atom handle with accumulation
 * 3. Automatically wires lifecycle
 *
 * @example
 * ```typescript
 * const handle = yield* channelOutletAtom("sensor-hub", "validated-outlet", {
 *   initialValue: [],
 *   accumulate: (prev, next) => [...prev, next].slice(-100),
 * })
 *
 * handle.start()
 * // ... later
 * handle.stop()
 * ```
 *
 * @param channelId - Channel to subscribe to
 * @param outletId - Outlet within the channel
 * @param options - Accumulation and lifecycle options
 * @returns Effect that yields the atom handle
 */
export const channelOutletAtom = <A, B = readonly A[]>(
  channelId: ChannelId,
  outletId: OutletId,
  options: ChannelOutletAtomOptions<A, B>
): Effect.Effect<ChannelOutletAtomHandle<A, B>, ChannelServiceError, ChannelService> =>
  Effect.gen(function* () {
    const service = yield* ChannelService
    const stream = yield* service.getOutletStream(channelId, outletId)

    return outletToAtom(
      stream as Stream.Stream<A, unknown, never>,
      channelId,
      outletId,
      options
    )
  })

// ============================================================================
// CONVENIENCE FACTORIES
// ============================================================================

/**
 * Create a channel outlet atom with array accumulation defaults.
 *
 * @example
 * ```typescript
 * const handle = yield* channelOutletAtomArray("sensor-hub", "validated", {
 *   maxItems: 1000,
 * })
 * ```
 */
export const channelOutletAtomArray = <A>(
  channelId: ChannelId,
  outletId: OutletId,
  options?: Omit<ChannelOutletAtomOptions<A, readonly A[]>, "initialValue" | "accumulate"> & {
    readonly initialValue?: readonly A[]
  }
): Effect.Effect<ChannelOutletAtomHandle<A, readonly A[]>, ChannelServiceError, ChannelService> =>
  channelOutletAtom(channelId, outletId, {
    initialValue: options?.initialValue ?? [],
    accumulate: (prev, next) => [...prev, next],
    ...options,
  })

/**
 * Create a channel outlet atom that keeps only the latest value.
 *
 * @example
 * ```typescript
 * const handle = yield* channelOutletAtomLatest("heartbeat-channel", "pulse")
 * // handle.atom always contains the latest heartbeat
 * ```
 */
export const channelOutletAtomLatest = <A>(
  channelId: ChannelId,
  outletId: OutletId,
  options?: Omit<ChannelOutletAtomOptions<A, A | null>, "initialValue" | "accumulate" | "maxItems">
): Effect.Effect<ChannelOutletAtomHandle<A, A | null>, ChannelServiceError, ChannelService> =>
  channelOutletAtom(channelId, outletId, {
    initialValue: null,
    accumulate: (_prev, next) => next,
    ...options,
  })
