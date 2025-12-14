/**
 * useDrawer Hook
 *
 * Opens and manages drawer overlays.
 *
 * @example
 * ```tsx
 * const drawer = useDrawer()
 *
 * const open = () => {
 *   drawer.open({
 *     id: "settings",
 *     slot: "global",
 *     side: "right",
 *   }, <SettingsPanel />)
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
import type { DrawerConfig, VisualOverlayId, SlotId } from "../../schemas/visual"
import type { ReactNode } from "react"
import { GLOBAL_SLOT_ID } from "../constants"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface DrawerOpenOptions {
  /** Drawer ID (auto-generated if not provided) */
  id?: string
  /** Slot to render in (defaults to "global") */
  slot?: SlotId
  /** Side of slot (defaults to "right") */
  side?: "left" | "right"
  /** Width (defaults to 400) */
  width?: number
  /** Show backdrop (defaults to false) */
  showBackdrop?: boolean
  /** Close on backdrop click (defaults to true) */
  closeOnBackdropClick?: boolean
  /** Close on escape key (defaults to true) */
  closeOnEscape?: boolean
  /** Z-index offset from base tier */
  zIndexOffset?: number
  /** Persistence mode (defaults to "persist") */
  persistence?: "persist" | "route-scoped" | "ephemeral"
  /** Callback when drawer opens */
  onOpen?: () => void
  /** Callback when drawer closes */
  onClose?: () => void
}

export interface UseDrawerReturn {
  /** Open a drawer with content */
  open: (options: DrawerOpenOptions, content: ReactNode) => VisualOverlayId
  /** Close a drawer by ID */
  close: (id: VisualOverlayId) => void
  /** Toggle a drawer by ID - opens if closed, closes if open */
  toggle: (options: DrawerOpenOptions, content: ReactNode) => void
  /** Check if a specific drawer is open */
  isDrawerOpen: (id: VisualOverlayId) => boolean
  /** Close all drawers */
  closeAll: () => void
  /** Get top (frontmost) drawer */
  topDrawer: ReturnType<typeof topOverlayByTypeAtom> extends infer T ? T : never
  /** Count of open drawers */
  count: number
  /** Whether any drawer is open */
  isOpen: boolean
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

/**
 * Hook to manage drawer overlays.
 *
 * @throws Error if used outside VisualOverlayProvider
 */
export function useDrawer(): UseDrawerReturn {
  const ctx = useVisualOverlay()

  const topDrawer = useAtomValue(topOverlayByTypeAtom("drawer"))
  const count = useAtomValue(overlayCountByTypeAtom("drawer"))
  const overlays = useAtomValue(visualOverlaysAtom)

  const open = useCallback(
    (options: DrawerOpenOptions, content: ReactNode): VisualOverlayId => {
      const config: DrawerConfig = {
        _tag: "DrawerConfig",
        id: (options.id ?? "") as VisualOverlayId,
        slot: options.slot ?? GLOBAL_SLOT_ID,
        side: options.side ?? "right",
        width: options.width ?? 400,
        height: "50%",
        showBackdrop: options.showBackdrop ?? true,
        closeOnOverlayClick: options.closeOnBackdropClick ?? true,
        closeOnEscape: options.closeOnEscape ?? true,
        persistence: options.persistence ?? "persist",
        zIndexOffset: options.zIndexOffset ?? 0,
      }

      return ctx.open("drawer", { id: options.id, config, content })
    },
    [ctx]
  )

  const close = useCallback(
    (id: VisualOverlayId): void => {
      ctx.close(id)
    },
    [ctx]
  )

  const isDrawerOpen = useCallback(
    (id: VisualOverlayId): boolean => {
      const overlay = overlays.get(id)
      return overlay !== undefined && overlay.isVisible
    },
    [overlays]
  )

  const toggle = useCallback(
    (options: DrawerOpenOptions, content: ReactNode): void => {
      const id = (options.id ?? "") as VisualOverlayId
      if (isDrawerOpen(id)) {
        close(id)
      } else {
        open(options, content)
      }
    },
    [isDrawerOpen, close, open]
  )

  const closeAll = useCallback((): void => {
    ctx.closeAllOfType("drawer")
  }, [ctx])

  return useMemo(
    () => ({
      open,
      close,
      toggle,
      isDrawerOpen,
      closeAll,
      topDrawer,
      count,
      isOpen: count > 0,
    }),
    [open, close, toggle, isDrawerOpen, closeAll, topDrawer, count]
  )
}

/**
 * Safe version that returns null when no provider exists.
 */
export function useDrawerSafe(): UseDrawerReturn | null {
  const ctx = useVisualOverlaySafe()
  if (!ctx) return null

  // This is a simplified version — ideally hook rules require consistent calls
  // For truly safe usage, wrap the component in an error boundary instead
  return useDrawer()
}
