/**
 * useTopBar Hook
 *
 * Mounts and manages the top bar overlay.
 *
 * @example
 * ```tsx
 * const topBar = useTopBar()
 *
 * useEffect(() => {
 *   topBar.mount({ id: "main" }, <TopBarContent />)
 *   return () => topBar.unmount()
 * }, [])
 * ```
 *
 * @module
 */

import { useCallback, useMemo, useRef, useEffect } from "react"
import { useAtomValue } from "@effect-atom/atom-react"
import { useVisualOverlay, useVisualOverlaySafe } from "../providers"
import {
  overlayRegistry,
  topOverlayByTypeAtom,
  overlayCountByTypeAtom,
} from "../../atoms"
import type { TopBarConfig, VisualOverlayId } from "../../schemas/visual"
import type { ReactNode } from "react"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface TopBarMountOptions {
  /** Top bar ID (auto-generated if not provided) */
  id?: string
  /** Height in pixels (defaults to 48) */
  height?: number
  /** Auto-hide on scroll (defaults to false) */
  autoHide?: boolean
  /** Show at startup (defaults to true) */
  initiallyVisible?: boolean
  /** Z-index offset from base tier */
  zIndexOffset?: number
  /** Callback when top bar mounts */
  onMount?: () => void
  /** Callback when top bar unmounts */
  onUnmount?: () => void
}

export interface UseTopBarReturn {
  /** Mount the top bar with content */
  mount: (options: TopBarMountOptions, content: ReactNode) => VisualOverlayId
  /** Unmount the top bar */
  unmount: () => void
  /** Show the top bar (if auto-hidden) */
  show: () => void
  /** Hide the top bar (if auto-hide enabled) */
  hide: () => void
  /** Toggle top bar visibility */
  toggle: () => void
  /** Current top bar instance (if mounted) */
  instance: ReturnType<typeof topOverlayByTypeAtom> extends infer T ? T : never
  /** Whether top bar is mounted */
  isMounted: boolean
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

/**
 * Hook to manage the top bar overlay.
 *
 * @throws Error if used outside VisualOverlayProvider
 */
export function useTopBar(): UseTopBarReturn {
  const ctx = useVisualOverlay()
  const mountedIdRef = useRef<VisualOverlayId | null>(null)

  const instance = useAtomValue(topOverlayByTypeAtom("top-bar"), {
    registry: overlayRegistry,
  })
  const count = useAtomValue(overlayCountByTypeAtom("top-bar"), {
    registry: overlayRegistry,
  })

  const mount = useCallback(
    (options: TopBarMountOptions, content: ReactNode): VisualOverlayId => {
      // Close existing if already mounted
      if (mountedIdRef.current) {
        ctx.close(mountedIdRef.current)
      }

      const config: TopBarConfig = {
        _tag: "TopBarConfig",
        id: (options.id ?? "") as VisualOverlayId,
        height: options.height ?? 48,
        autoHide: options.autoHide ?? false,
        initiallyVisible: options.initiallyVisible ?? true,
        zIndexOffset: options.zIndexOffset ?? 0,
        persistence: "persist", // Top bar always persists
        onOpen: options.onMount,
        onClose: options.onUnmount,
      }

      const id = ctx.open("top-bar", { id: options.id, config, content })
      mountedIdRef.current = id
      return id
    },
    [ctx]
  )

  const unmount = useCallback((): void => {
    if (mountedIdRef.current) {
      ctx.close(mountedIdRef.current)
      mountedIdRef.current = null
    }
  }, [ctx])

  const show = useCallback((): void => {
    if (mountedIdRef.current) {
      ctx.setAnimationState(mountedIdRef.current, "entering")
    }
  }, [ctx])

  const hide = useCallback((): void => {
    if (mountedIdRef.current) {
      ctx.setAnimationState(mountedIdRef.current, "exiting")
    }
  }, [ctx])

  const toggle = useCallback((): void => {
    if (instance?.isVisible) {
      hide()
    } else {
      show()
    }
  }, [instance, show, hide])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mountedIdRef.current) {
        ctx.close(mountedIdRef.current)
      }
    }
  }, [ctx])

  return useMemo(
    () => ({
      mount,
      unmount,
      show,
      hide,
      toggle,
      instance,
      isMounted: count > 0,
    }),
    [mount, unmount, show, hide, toggle, instance, count]
  )
}

/**
 * Safe version that returns null when no provider exists.
 */
export function useTopBarSafe(): UseTopBarReturn | null {
  const ctx = useVisualOverlaySafe()
  if (!ctx) return null
  return useTopBar()
}
