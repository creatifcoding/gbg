/**
 * useSidebar Hook
 *
 * Opens and manages sidebar overlays.
 * Sidebars are persistent navigation panels that can collapse to icon-only mode.
 *
 * @example
 * ```tsx
 * const sidebar = useSidebar()
 *
 * const mount = () => {
 *   sidebar.mount({
 *     id: "main-nav",
 *     side: "left",
 *   }, <SidebarContent />)
 * }
 * ```
 *
 * @module
 */

import { useCallback, useMemo } from "react"
import { useAtomValue } from "@effect-atom/atom-react"
import { useVisualOverlay, useVisualOverlaySafe } from "../providers"
import {
  topOverlayByTypeAtom,
  overlayCountByTypeAtom,
  visualOverlaysAtom,
} from "../../atoms"
import type { SidebarConfig, VisualOverlayId, SlotId, SidebarCollapseMode } from "../../schemas/visual"
import type { ReactNode } from "react"
import { GLOBAL_SLOT_ID } from "../constants"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface SidebarMountOptions {
  /** Sidebar ID (auto-generated if not provided) */
  id?: string
  /** Slot to render in (defaults to "global") */
  slot?: SlotId
  /** Side of slot (defaults to "left") */
  side?: "left" | "right"
  /** Collapsed width in pixels (defaults to 48) */
  collapsedWidth?: number
  /** Expanded width in pixels (defaults to 256) */
  expandedWidth?: number
  /** Collapsible mode (defaults to "offcanvas") */
  collapsible?: SidebarCollapseMode
  /** Start collapsed (defaults to false) */
  initiallyCollapsed?: boolean
  /** Z-index offset from base tier */
  zIndexOffset?: number
  /** Callback when sidebar mounts */
  onMount?: () => void
  /** Callback when sidebar unmounts */
  onUnmount?: () => void
}

export interface UseSidebarReturn {
  /** Mount a sidebar with content */
  mount: (options: SidebarMountOptions, content: ReactNode) => VisualOverlayId
  /** Unmount a sidebar by ID */
  unmount: (id: VisualOverlayId) => void
  /** Check if a specific sidebar is mounted */
  isMounted: (id: VisualOverlayId) => boolean
  /** Get top (frontmost) sidebar */
  topSidebar: ReturnType<typeof topOverlayByTypeAtom> extends infer T ? T : never
  /** Count of mounted sidebars */
  count: number
  /** Whether any sidebar is mounted */
  hasSidebar: boolean
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

/**
 * Hook to manage sidebar overlays.
 *
 * @throws Error if used outside VisualOverlayProvider
 */
export function useSidebar(): UseSidebarReturn {
  const ctx = useVisualOverlay()

  const topSidebar = useAtomValue(topOverlayByTypeAtom("sidebar"))
  const count = useAtomValue(overlayCountByTypeAtom("sidebar"))
  const overlays = useAtomValue(visualOverlaysAtom)

  const mount = useCallback(
    (options: SidebarMountOptions, content: ReactNode): VisualOverlayId => {
      const id = (options.id ?? "main-sidebar") as VisualOverlayId
      const config: SidebarConfig = {
        _tag: "SidebarConfig",
        id,
        slot: options.slot ?? GLOBAL_SLOT_ID,
        side: options.side ?? "left",
        collapsedWidth: options.collapsedWidth ?? 48,
        expandedWidth: options.expandedWidth ?? 256,
        collapsible: options.collapsible ?? "offcanvas",
        closeOnEscape: false,
        persistence: "persist",
        zIndexOffset: options.zIndexOffset ?? 0,
      }

      return ctx.open("sidebar", { id: options.id ?? "main-sidebar", config, content })
    },
    [ctx]
  )

  const unmount = useCallback(
    (id: VisualOverlayId): void => {
      ctx.close(id)
    },
    [ctx]
  )

  const isMounted = useCallback(
    (id: VisualOverlayId): boolean => {
      const overlay = overlays.get(id)
      return overlay !== undefined && overlay.isVisible
    },
    [overlays]
  )

  return useMemo(
    () => ({
      mount,
      unmount,
      isMounted,
      topSidebar,
      count,
      hasSidebar: count > 0,
    }),
    [mount, unmount, isMounted, topSidebar, count]
  )
}

/**
 * Safe version that returns null when no provider exists.
 */
export function useSidebarSafe(): UseSidebarReturn | null {
  const ctx = useVisualOverlaySafe()
  if (!ctx) return null

  return useSidebar()
}
