/**
 * useEventDispatch Hook
 *
 * Hot path event dispatch for high-frequency events (pointer, keyboard).
 * Uses a cached runtime to avoid fiber-per-event overhead.
 *
 * Architecture:
 * - Gets runtime once from overlayRuntimeAtom
 * - Uses Runtime.runSync for synchronous dispatch
 * - Avoids atom machinery for each call (no useAtomSet)
 */

import { useCallback, useRef, useEffect } from "react"
import { useAtomValue } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import * as Effect from "effect/Effect"
import * as Runtime from "effect/Runtime"
import { type ContainerId, type OverlayEvent, type OverlayInstance } from "../schemas"
import { EventDispatcher, type DispatchResult } from "../services"
import { overlayRuntimeAtom, activeOverlaysAtom } from "../atoms"

export interface UseEventDispatchOptions {
  /** Container ID for event dispatch */
  containerId: ContainerId
}

export interface UseEventDispatchResult {
  /** Dispatch an event synchronously (hot path) */
  dispatch: (event: OverlayEvent) => DispatchResult | null
  /** Whether the runtime is ready */
  isReady: boolean
}

/**
 * Hook for high-frequency event dispatch.
 *
 * Unlike dispatchOps.dispatch (which spawns a fiber per call),
 * this hook caches the runtime and dispatches synchronously.
 *
 * @example
 * ```tsx
 * function InteractiveCanvas({ containerId }: { containerId: ContainerId }) {
 *   const { dispatch, isReady } = useEventDispatch({ containerId })
 *
 *   const handlePointerMove = (e: React.PointerEvent) => {
 *     if (!isReady) return
 *     dispatch(createPointerMove(containerId, e, x, y))
 *   }
 *
 *   return <div onPointerMove={handlePointerMove} />
 * }
 * ```
 */
export function useEventDispatch(
  options: UseEventDispatchOptions
): UseEventDispatchResult {
  const { containerId } = options

  // Get the shared runtime (Result-wrapped)
  const runtimeResult = useAtomValue(overlayRuntimeAtom)

  // Get active overlays for dispatch context
  const activeOverlays = useAtomValue(activeOverlaysAtom(containerId)) as ReadonlyArray<OverlayInstance>

  // Cache runtime in ref for stable access
  const runtimeRef = useRef<Runtime.Runtime<EventDispatcher> | null>(null)

  // Update cached runtime when available
  useEffect(() => {
    if (Result.isSuccess(runtimeResult)) {
      runtimeRef.current = runtimeResult.value
    }
  }, [runtimeResult])

  const isReady = Result.isSuccess(runtimeResult)

  // Hot path dispatch function - synchronous, no fiber spawning
  const dispatch = useCallback(
    (event: OverlayEvent): DispatchResult | null => {
      const runtime = runtimeRef.current
      if (!runtime) {
        console.warn("[useEventDispatch] Runtime not ready, dropping event")
        return null
      }

      // Create the dispatch effect
      const dispatchEffect = Effect.gen(function* () {
        const dispatcher = yield* EventDispatcher
        return yield* dispatcher.dispatch(containerId, event, activeOverlays)
      })

      try {
        // Run synchronously - no fiber overhead
        return Runtime.runSync(runtime)(dispatchEffect)
      } catch (err) {
        // If runSync fails (e.g., async operation inside), fall back to logging
        console.error("[useEventDispatch] Sync dispatch failed:", err)
        return null
      }
    },
    [containerId, activeOverlays]
  )

  return {
    dispatch,
    isReady,
  }
}
