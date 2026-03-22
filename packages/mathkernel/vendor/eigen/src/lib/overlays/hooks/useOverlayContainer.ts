/**
 * useOverlayContainer Hook
 *
 * Creates and manages an overlay container.
 * Containers scope overlays and ports to a specific region.
 *
 * Architecture:
 * - Uses atom-based state (no Effect.Ref)
 * - Automatic reactivity via effect-atom subscriptions
 * - Synchronous create/destroy operations
 */

import { useEffect, useCallback } from "react"
import { useAtomValue } from "@effect-atom/atom-react"
import { type ContainerId, type OverlayInstance } from "../schemas"
import {
  containerAtom,
  activeOverlaysAtom,
  containerExistsAtom,
  containerOps,
  overlayOps,
} from "../atoms"

export interface UseOverlayContainerOptions {
  /** Container ID (will be created if doesn't exist) */
  containerId: ContainerId
  /** Auto-create container on mount (default: true) */
  autoCreate?: boolean
  /** Auto-destroy container on unmount (default: true) */
  autoDestroy?: boolean
}

export interface UseOverlayContainerResult {
  /** Container ID */
  containerId: ContainerId
  /** Whether container exists */
  exists: boolean
  /** Active overlays in LIFO order */
  activeOverlays: ReadonlyArray<OverlayInstance>
  /** Enable an overlay */
  enable: (overlayId: string) => void
  /** Disable an overlay */
  disable: (overlayId: string) => void
  /** Toggle an overlay */
  toggle: (overlayId: string) => void
  /** Manually create the container */
  create: () => void
  /** Manually destroy the container */
  destroy: () => void
}

/**
 * Hook to create and manage an overlay container.
 *
 * @example
 * ```tsx
 * function Canvas() {
 *   const container = useOverlayContainer({
 *     containerId: "main-canvas" as ContainerId,
 *   })
 *
 *   return (
 *     <div data-container-id={container.containerId}>
 *       {container.activeOverlays.map(overlay => (
 *         <span key={overlay.id}>{overlay.name}</span>
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */
export function useOverlayContainer(
  options: UseOverlayContainerOptions
): UseOverlayContainerResult {
  const { containerId, autoCreate = true, autoDestroy = true } = options

  // ─── Reactive State (from atoms) ───

  const exists = useAtomValue(containerExistsAtom(containerId))
  const activeOverlays = useAtomValue(activeOverlaysAtom(containerId))

  // ─── Operations (synchronous, direct atom mutations) ───

  const create = useCallback(() => {
    containerOps.create(containerId)
  }, [containerId])

  const destroy = useCallback(() => {
    containerOps.destroy(containerId)
  }, [containerId])

  const enable = useCallback(
    (overlayId: string) => {
      overlayOps.enable({ containerId, overlayId: overlayId as any })
    },
    [containerId]
  )

  const disable = useCallback(
    (overlayId: string) => {
      overlayOps.disable({ containerId, overlayId: overlayId as any })
    },
    [containerId]
  )

  const toggle = useCallback(
    (overlayId: string) => {
      overlayOps.toggle({ containerId, overlayId: overlayId as any })
    },
    [containerId]
  )

  // ─── Lifecycle ───

  useEffect(() => {
    if (autoCreate) {
      create()
    }

    return () => {
      if (autoDestroy) {
        destroy()
      }
    }
  }, [autoCreate, autoDestroy, create, destroy])

  return {
    containerId,
    exists,
    activeOverlays,
    enable,
    disable,
    toggle,
    create,
    destroy,
  }
}
