/**
 * usePort Hook
 *
 * Subscribe to and publish on typed ports.
 */

import { useEffect, useState, useCallback, useRef } from "react"
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Stream from "effect/Stream"
import * as Fiber from "effect/Fiber"
import * as Runtime from "effect/Runtime"
import * as Scope from "effect/Scope"
import { type ContainerId, type PortId } from "../schemas"
import { PortHub } from "../services"
import { portOps, overlayRuntimeAtom } from "../atoms"

export interface UsePortOptions<T> {
  /** Container ID */
  containerId: ContainerId
  /** Port ID */
  portId: PortId
  /** Initial value before first message */
  initialValue?: T
  /** Subscribe to stream updates (default: true) */
  subscribe?: boolean
}

export interface UsePortResult<T> {
  /** Current port value */
  value: T | undefined
  /** Latest value as Option */
  latest: Option.Option<T>
  /** Whether port has received any messages */
  hasValue: boolean
  /** Publish a message to the port */
  publish: (payload: T) => void
  /** Clear the port (destroy and recreate) */
  clear: () => void
}

/**
 * Hook to subscribe to and publish on a typed port.
 *
 * @example
 * ```tsx
 * interface DragState {
 *   dragging: boolean
 *   position: { x: number; y: number }
 * }
 *
 * function DragIndicator({ containerId }: { containerId: ContainerId }) {
 *   const { value, publish } = usePort<DragState>({
 *     containerId,
 *     portId: "drag:state" as PortId,
 *     initialValue: { dragging: false, position: { x: 0, y: 0 } },
 *   })
 *
 *   return (
 *     <div>
 *       {value?.dragging && (
 *         <div style={{ left: value.position.x, top: value.position.y }}>
 *           Dragging...
 *         </div>
 *       )}
 *     </div>
 *   )
 * }
 * ```
 */
// DIAGNOSTIC: Track render count per port
const renderCounts = new Map<string, number>()

export function usePort<T>(options: UsePortOptions<T>): UsePortResult<T> {
  const { containerId, portId, initialValue, subscribe = true } = options

  // DIAGNOSTIC: Log every render
  const key = `${containerId}:${portId}`
  const count = (renderCounts.get(key) ?? 0) + 1
  renderCounts.set(key, count)
  console.log(`[DIAG:usePort] RENDER #${count} for ${key}`)

  // ─── State ───

  const [streamValue, setStreamValue] = useState<T | undefined>(initialValue)
  const fiberRef = useRef<Fiber.RuntimeFiber<void, never> | null>(null)

  // DIAGNOSTIC: Log before useAtomValue
  console.log(`[DIAG:usePort] ${key} - about to call useAtomValue(overlayRuntimeAtom)`)

  // Get the shared runtime from the atom
  const runtimeResult = useAtomValue(overlayRuntimeAtom)

  // DIAGNOSTIC: Log after useAtomValue
  console.log(`[DIAG:usePort] ${key} - runtimeResult.isSuccess=${Result.isSuccess(runtimeResult)}`)

  // Stabilize runtime reference to prevent useEffect re-runs
  // The runtime itself is stable once created; only the Result wrapper changes
  const runtimeRef = useRef<Runtime.Runtime<PortHub> | null>(null)

  // Track if runtime has been captured (for deps stability)
  const hasRuntime = Result.isSuccess(runtimeResult)
  if (hasRuntime && !runtimeRef.current) {
    runtimeRef.current = runtimeResult.value
    console.log(`[DIAG:usePort] ${key} - captured runtime to ref`)
  }

  // NOTE: We intentionally DO NOT use portAtom here.
  // The portAtom uses overlayRuntimeAtom.atom(Effect) which re-executes
  // on every read, returning a new Option object and causing infinite re-renders.
  // Stream subscription (below) handles all updates; atom read is redundant.

  const hasValue = streamValue !== undefined
  const latest = hasValue ? Option.some(streamValue as T) : Option.none<T>()
  const value = streamValue ?? initialValue

  // ─── Subscription ───

  useEffect(() => {
    if (!subscribe) return

    // Wait for runtime to be available (using stable ref)
    const runtime = runtimeRef.current
    if (!runtime) return

    // Subscribe to stream updates using the SHARED runtime
    // This ensures we use the same PortHub instance as the atoms
    const subscribeEffect = Effect.gen(function* () {
      const hub = yield* PortHub
      yield* Effect.log(`[usePort] subscribing ${containerId}:${portId} via SHARED runtime`)
      const stream = yield* hub.subscribe<T>(containerId, portId)

      // Run stream and update state
      yield* Stream.runForEach(stream, (payload) =>
        Effect.sync(() => {
          console.log(`[usePort] ${containerId}:${portId} received:`, payload)
          setStreamValue(payload)
        })
      )
    }).pipe(Effect.scoped)

    // Run in background fiber using the SHARED runtime
    const fiber = Runtime.runFork(runtime)(subscribeEffect)
    fiberRef.current = fiber

    return () => {
      // Interrupt fiber on cleanup
      if (fiberRef.current) {
        Effect.runPromise(Fiber.interrupt(fiberRef.current))
        fiberRef.current = null
      }
    }
    // hasRuntime transitions false→true once, triggering subscription start
    // runtimeRef.current is intentionally NOT in deps - only hasRuntime matters
  }, [containerId, portId, subscribe, hasRuntime])

  // ─── Operations (fn atoms consumed via useAtomSet) ───

  const doPublish = useAtomSet(portOps.publish)
  const doDestroy = useAtomSet(portOps.destroy)

  const publish = useCallback(
    (payload: T) => {
      doPublish({ containerId, portId: portId as string, payload })
    },
    [containerId, portId, doPublish]
  )

  const clear = useCallback(() => {
    doDestroy({ containerId, portId: portId as string })
    setStreamValue(initialValue)
  }, [containerId, portId, initialValue, doDestroy])

  return {
    value,
    latest,
    hasValue,
    publish,
    clear,
  }
}

/**
 * Hook to publish to a port without subscribing.
 *
 * @example
 * ```tsx
 * function PublishButton({ containerId }: { containerId: ContainerId }) {
 *   const publish = usePublish<{ action: string }>(containerId, "actions" as PortId)
 *
 *   return (
 *     <button onClick={() => publish({ action: "clicked" })}>
 *       Publish Action
 *     </button>
 *   )
 * }
 * ```
 */
export function usePublish<T>(
  containerId: ContainerId,
  portId: PortId
): (payload: T) => void {
  const doPublish = useAtomSet(portOps.publish)

  return useCallback(
    (payload: T) => {
      doPublish({ containerId, portId: portId as string, payload })
    },
    [containerId, portId, doPublish]
  )
}
