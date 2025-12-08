/**
 * useOverlay Hook
 *
 * Registers and manages a single overlay within a container.
 */

import { useEffect, useMemo, useCallback, useRef } from "react"
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react"
import * as Option from "effect/Option"
import { type ContainerId, type OverlayId, type OverlayInstance } from "../schemas"
import { Overlay, type OverlayConfig } from "../Overlay"
import { isOverlayActiveAtom, overlayInstanceAtom, overlayOps } from "../atoms"

export interface UseOverlayOptions {
  /** Container to register the overlay in */
  containerId: ContainerId
  /** Overlay definition (Overlay instance or config) */
  overlay: Overlay | OverlayConfig
  /** Auto-register on mount (default: true) */
  autoRegister?: boolean
  /** Auto-enable after registration (default: false) */
  autoEnable?: boolean
}

export interface UseOverlayResult {
  /** Overlay ID */
  overlayId: OverlayId
  /** Overlay instance (if registered and active) */
  instance: Option.Option<OverlayInstance>
  /** Whether overlay is currently active */
  isActive: boolean
  /** Enable the overlay */
  enable: () => void
  /** Disable the overlay */
  disable: () => void
  /** Toggle the overlay */
  toggle: () => void
  /** Suspend the overlay (pause without deactivating) */
  suspend: () => void
  /** Resume a suspended overlay */
  resume: () => void
}

/**
 * Hook to register and manage an overlay.
 *
 * @example
 * ```tsx
 * const DragOverlay = new Overlay({
 *   id: "drag" as OverlayId,
 *   name: "Drag Handler",
 *   handlers: {
 *     PointerDown: (event, ctx) => Effect.succeed("handled"),
 *   },
 * })
 *
 * function DragFeature({ containerId }: { containerId: ContainerId }) {
 *   const { isActive, toggle } = useOverlay({
 *     containerId,
 *     overlay: DragOverlay,
 *     autoEnable: true,
 *   })
 *
 *   return (
 *     <button onClick={toggle}>
 *       Drag Mode: {isActive ? "ON" : "OFF"}
 *     </button>
 *   )
 * }
 * ```
 */
export function useOverlay(options: UseOverlayOptions): UseOverlayResult {
  const { containerId, autoRegister = true, autoEnable = false } = options

  // Normalize to Overlay instance
  const overlay = useMemo(() => {
    return options.overlay instanceof Overlay
      ? options.overlay
      : new Overlay(options.overlay)
  }, [options.overlay])

  const overlayId = overlay.id

  // ─── State (direct values from pure atoms) ───

  const instance = useAtomValue(
    overlayInstanceAtom({ containerId, overlayId })
  ) as Option.Option<OverlayInstance>

  const isActive = useAtomValue(
    isOverlayActiveAtom({ containerId, overlayId })
  ) as boolean

  // ─── Operations (direct calls, not atoms) ───

  const enable = useCallback(() => {
    overlayOps.enable({ containerId, overlayId })
  }, [containerId, overlayId])

  const disable = useCallback(() => {
    overlayOps.disable({ containerId, overlayId })
  }, [containerId, overlayId])

  const toggle = useCallback(() => {
    overlayOps.toggle({ containerId, overlayId })
  }, [containerId, overlayId])

  const suspend = useCallback(() => {
    overlayOps.suspend({ containerId, overlayId })
  }, [containerId, overlayId])

  const resume = useCallback(() => {
    overlayOps.resume({ containerId, overlayId })
  }, [containerId, overlayId])

  // ─── Registration Lifecycle (via shared atom runtime) ───

  const doRegister = useAtomSet(overlayOps.register)
  const doUnregister = useAtomSet(overlayOps.unregister)
  const registeredRef = useRef(false)

  useEffect(() => {
    if (!autoRegister) return

    // Register through the shared atom runtime
    doRegister({
      containerId,
      overlayId,
      name: overlay.name,
      visualPriority: overlay.visualPriority,
      handlers: overlay.getWrappedHandlers(containerId),
    })
    registeredRef.current = true

    // Auto-enable if requested
    if (autoEnable) {
      overlayOps.enable({ containerId, overlayId })
    }

    return () => {
      // Unregister through the shared atom runtime
      if (registeredRef.current) {
        doUnregister({ containerId, overlayId })
        registeredRef.current = false
      }
    }
  }, [autoRegister, autoEnable, overlay, containerId, overlayId, doRegister, doUnregister])

  return {
    overlayId,
    instance,
    isActive,
    enable,
    disable,
    toggle,
    suspend,
    resume,
  }
}
