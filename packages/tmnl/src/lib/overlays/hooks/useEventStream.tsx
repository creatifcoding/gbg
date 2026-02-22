/**
 * useEventStream Hook
 *
 * Stream-based event dispatch for high-frequency events (pointer, keyboard).
 * Uses a single long-lived fiber consuming a Queue, eliminating fiber-per-event overhead.
 *
 * Architecture:
 * - React events flow into an unbounded Queue via unsafeOffer (no fiber allocation)
 * - Single fiber runs Stream.fromQueue → dispatch → runDrain
 * - Fiber lifetime: mount to unmount (component lifecycle)
 * - Fiber count: ONE per container, regardless of event volume
 *
 * Trade-offs:
 * - Async: events are queued, not processed inline (microsecond latency)
 * - Backpressure: unbounded queue means no backpressure (drops not possible)
 * - Ordering: FIFO within container (consistent event ordering)
 */

import { useEffect, useRef, useCallback, useState } from "react"
import { useAtomValue } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Queue from "effect/Queue"
import * as Runtime from "effect/Runtime"
import * as Stream from "effect/Stream"
import {
  type ContainerId,
  type OverlayEvent,
  type OverlayInstance,
} from "../schemas"
import { EventDispatcher, type DispatchResult } from "../services"
import { overlayRuntimeAtom, activeOverlaysAtom } from "../atoms"

export interface UseEventStreamOptions {
  /** Container ID for event dispatch */
  containerId: ContainerId
  /** Optional callback when events are processed */
  onDispatch?: (result: DispatchResult) => void
  /** Enable debug logging */
  debug?: boolean
}

export interface UseEventStreamResult {
  /** Queue an event for dispatch (fire-and-forget, no fiber allocation) */
  enqueue: (event: OverlayEvent) => void
  /** Whether the stream fiber is running */
  isRunning: boolean
  /** Number of events currently queued (for debugging) */
  queueSize: number
}

/**
 * Hook for stream-based event dispatch.
 *
 * Unlike useEventDispatch (which still allocates a FiberRuntime per call),
 * this hook uses a single long-lived fiber consuming a Queue.
 *
 * Performance characteristics:
 * - enqueue(): ~0 allocations (Queue.unsafeOffer is O(1) append)
 * - Fiber count: 1 per container (regardless of event rate)
 * - Latency: async (microseconds), not synchronous
 *
 * @example
 * ```tsx
 * function InteractiveCanvas({ containerId }: { containerId: ContainerId }) {
 *   const { enqueue, isRunning } = useEventStream({ containerId })
 *
 *   const handlePointerMove = (e: React.PointerEvent) => {
 *     if (!isRunning) return
 *     enqueue(createPointerMove(containerId, e, x, y))
 *   }
 *
 *   return <div onPointerMove={handlePointerMove} />
 * }
 * ```
 */
export function useEventStream(
  options: UseEventStreamOptions
): UseEventStreamResult {
  const { containerId, onDispatch, debug = false } = options

  // Get the shared runtime (Result-wrapped)
  const runtimeResult = useAtomValue(overlayRuntimeAtom)

  // Get active overlays for dispatch context
  const activeOverlays = useAtomValue(
    activeOverlaysAtom(containerId)
  ) as ReadonlyArray<OverlayInstance>

  // Refs for stable access across renders
  const queueRef = useRef<Queue.Queue<OverlayEvent> | null>(null)
  const fiberRef = useRef<Fiber.RuntimeFiber<void, never> | null>(null)
  const queueSizeRef = useRef(0)

  // Use state for isRunning to trigger re-renders when stream starts
  const [isRunning, setIsRunning] = useState(false)

  // Keep activeOverlays accessible to the stream without recreating it
  const activeOverlaysRef = useRef(activeOverlays)
  useEffect(() => {
    activeOverlaysRef.current = activeOverlays
  }, [activeOverlays])

  // Keep onDispatch accessible
  const onDispatchRef = useRef(onDispatch)
  useEffect(() => {
    onDispatchRef.current = onDispatch
  }, [onDispatch])

  // Initialize queue and start stream fiber
  useEffect(() => {
    if (!Result.isSuccess(runtimeResult)) return

    const runtime = runtimeResult.value

    // Create the event stream program
    const program = Effect.gen(function* () {
      const dispatcher = yield* EventDispatcher

      // Create unbounded queue for events
      const queue = yield* Queue.unbounded<OverlayEvent>()
      queueRef.current = queue

      if (debug) {
        yield* Effect.log(`[EventStream] Started for container: ${containerId}`)
      }

      // Create stream from queue and process events
      const eventStream = Stream.fromQueue(queue).pipe(
        Stream.tap((event) =>
          Effect.gen(function* () {
            // Get current active overlays (may have changed since mount)
            const currentOverlays = activeOverlaysRef.current

            // Dispatch through overlay stack
            const result = yield* dispatcher.dispatch(
              containerId,
              event,
              currentOverlays
            )

            // Update queue size tracking
            queueSizeRef.current = yield* Queue.size(queue)

            // Notify callback if provided
            if (onDispatchRef.current) {
              onDispatchRef.current(result)
            }

            if (debug) {
              yield* Effect.log(
                `[EventStream] Processed ${event._tag} → ${result.result}`
              )
            }
          })
        )
      )

      // Run the stream until shutdown (drains queue continuously)
      yield* Stream.runDrain(eventStream)

      // Cleanup (only reached on shutdown)
      if (debug) {
        yield* Effect.log(`[EventStream] Stopped for container: ${containerId}`)
      }
    })

    // Use Runtime.runFork to start the fiber (async-safe, returns immediately)
    const fiber = Runtime.runFork(runtime)(program)
    fiberRef.current = fiber
    setIsRunning(true)

    if (debug) {
      console.log(`[EventStream] Fiber started for ${containerId}`)
    }

    // Cleanup: interrupt fiber on unmount
    return () => {
      if (debug) {
        console.log(`[EventStream] Cleanup for ${containerId}`)
      }

      // Shutdown queue first (this will end the stream gracefully)
      if (queueRef.current) {
        // Use runFork for shutdown too (it's async)
        Runtime.runFork(runtime)(Queue.shutdown(queueRef.current))
        queueRef.current = null
      }

      // Interrupt fiber
      if (fiberRef.current) {
        Runtime.runFork(runtime)(Fiber.interrupt(fiberRef.current))
        fiberRef.current = null
      }

      setIsRunning(false)
    }
  }, [runtimeResult, containerId, debug])

  // Fire-and-forget event queueing — TRUE hot path, zero fiber allocation
  const enqueue = useCallback(
    (event: OverlayEvent): void => {
      const queue = queueRef.current
      if (!queue) {
        if (debug) {
          console.warn("[EventStream] Queue not ready, dropping event")
        }
        return
      }

      // unsafeOffer is the TRUE hot path:
      // - Returns boolean directly (not Effect)
      // - No fiber allocation
      // - No Effect runtime overhead
      // - Pure synchronous queue append
      const success = Queue.unsafeOffer(queue, event)

      if (success) {
        queueSizeRef.current++
      } else if (debug) {
        // This should never happen with unbounded queue
        console.warn("[EventStream] Queue offer rejected (queue full?)")
      }
    },
    [debug]
  )

  return {
    enqueue,
    isRunning,
    queueSize: queueSizeRef.current,
  }
}
