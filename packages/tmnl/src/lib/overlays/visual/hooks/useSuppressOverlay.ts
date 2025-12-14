/**
 * useSuppressOverlay Hook
 *
 * Suppresses overlay visibility programmatically.
 *
 * @example
 * ```tsx
 * // Suppress all modals in this component tree
 * useSuppressOverlay("modal")
 *
 * // Suppress specific drawer instance
 * useSuppressOverlay("drawer:settings")
 *
 * // Conditional suppression
 * const { suppress, unsuppress } = useSuppressOverlayControls()
 * useEffect(() => {
 *   if (fullscreenMode) suppress("modal")
 *   else unsuppress("modal")
 * }, [fullscreenMode])
 * ```
 *
 * @module
 */

import { useEffect, useCallback, useMemo } from "react"
import { useAtomValue } from "@effect-atom/atom-react"
import { useVisualOverlay, useVisualOverlaySafe } from "../providers"
import {
  overlayRegistry,
  suppressionsAtom,
  isSuppressedAtom,
  isTypeSuppressedAtom,
  activeSuppressionKeysAtom,
  suppressionCountAtom,
} from "../../atoms"
import {
  type SuppressionKey,
  type VisualOverlayType,
  type VisualOverlayId,
  typeSuppressionKey,
  instanceSuppressionKey,
} from "../../schemas/visual"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface UseSuppressOverlayControlsReturn {
  /** Add suppression (type-level or instance-level) */
  suppress: (key: SuppressionKey) => void
  /** Remove suppression */
  unsuppress: (key: SuppressionKey) => void
  /** Toggle suppression */
  toggle: (key: SuppressionKey) => void
  /** Suppress all overlays of a type */
  suppressType: (type: VisualOverlayType) => void
  /** Unsuppress all overlays of a type */
  unsuppressType: (type: VisualOverlayType) => void
  /** Suppress a specific instance */
  suppressInstance: (type: VisualOverlayType, id: string) => void
  /** Unsuppress a specific instance */
  unsuppressInstance: (type: VisualOverlayType, id: string) => void
  /** Clear all suppressions */
  clearAll: () => void
  /** Clear suppressions for a type */
  clearType: (type: VisualOverlayType) => void
  /** All active suppression keys */
  activeKeys: SuppressionKey[]
  /** Count of active suppressions */
  count: number
}

// ─────────────────────────────────────────────────────────────
// Auto-suppress Hook
// ─────────────────────────────────────────────────────────────

/**
 * Auto-suppress an overlay type or instance while this component is mounted.
 *
 * @param key - Suppression key: "type" (e.g., "modal") or "type:instance" (e.g., "modal:settings")
 *
 * @example
 * ```tsx
 * function FullscreenMode() {
 *   // All modals suppressed while this component is mounted
 *   useSuppressOverlay("modal")
 *   return <FullscreenContent />
 * }
 * ```
 */
export function useSuppressOverlay(key: SuppressionKey | `${VisualOverlayType}`): void {
  const ctx = useVisualOverlaySafe()

  useEffect(() => {
    if (!ctx) return

    // Add suppression on mount
    ctx.suppress(key as SuppressionKey)

    // Remove suppression on unmount
    return () => {
      ctx.unsuppress(key as SuppressionKey)
    }
  }, [ctx, key])
}

/**
 * Auto-suppress an overlay type while this component is mounted.
 *
 * @param type - Overlay type to suppress
 */
export function useSuppressOverlayType(type: VisualOverlayType): void {
  useSuppressOverlay(typeSuppressionKey(type))
}

/**
 * Auto-suppress a specific overlay instance while this component is mounted.
 *
 * @param type - Overlay type
 * @param id - Instance ID
 */
export function useSuppressOverlayInstance(type: VisualOverlayType, id: string): void {
  useSuppressOverlay(instanceSuppressionKey(type, id))
}

// ─────────────────────────────────────────────────────────────
// Control Hook
// ─────────────────────────────────────────────────────────────

/**
 * Get suppression control functions without auto-suppressing.
 * Use this for conditional or user-triggered suppression.
 *
 * @throws Error if used outside VisualOverlayProvider
 */
export function useSuppressOverlayControls(): UseSuppressOverlayControlsReturn {
  const ctx = useVisualOverlay()

  const activeKeys = useAtomValue(activeSuppressionKeysAtom, {
    registry: overlayRegistry,
  })
  const count = useAtomValue(suppressionCountAtom, {
    registry: overlayRegistry,
  })

  const suppress = useCallback(
    (key: SuppressionKey): void => {
      ctx.suppress(key)
    },
    [ctx]
  )

  const unsuppress = useCallback(
    (key: SuppressionKey): void => {
      ctx.unsuppress(key)
    },
    [ctx]
  )

  const toggle = useCallback(
    (key: SuppressionKey): void => {
      ctx.toggleSuppress(key)
    },
    [ctx]
  )

  const suppressType = useCallback(
    (type: VisualOverlayType): void => {
      ctx.suppressType(type)
    },
    [ctx]
  )

  const unsuppressType = useCallback(
    (type: VisualOverlayType): void => {
      ctx.unsuppressType(type)
    },
    [ctx]
  )

  const suppressInstance = useCallback(
    (type: VisualOverlayType, id: string): void => {
      ctx.suppressInstance(type, id)
    },
    [ctx]
  )

  const unsuppressInstance = useCallback(
    (type: VisualOverlayType, id: string): void => {
      ctx.unsuppressInstance(type, id)
    },
    [ctx]
  )

  const clearAll = useCallback((): void => {
    ctx.clearSuppressions()
  }, [ctx])

  const clearType = useCallback(
    (type: VisualOverlayType): void => {
      ctx.clearTypeSuppressions(type)
    },
    [ctx]
  )

  return useMemo(
    () => ({
      suppress,
      unsuppress,
      toggle,
      suppressType,
      unsuppressType,
      suppressInstance,
      unsuppressInstance,
      clearAll,
      clearType,
      activeKeys,
      count,
    }),
    [
      suppress,
      unsuppress,
      toggle,
      suppressType,
      unsuppressType,
      suppressInstance,
      unsuppressInstance,
      clearAll,
      clearType,
      activeKeys,
      count,
    ]
  )
}

/**
 * Safe version that returns null when no provider exists.
 */
export function useSuppressOverlayControlsSafe(): UseSuppressOverlayControlsReturn | null {
  const ctx = useVisualOverlaySafe()
  if (!ctx) return null
  return useSuppressOverlayControls()
}

// ─────────────────────────────────────────────────────────────
// Query Hooks
// ─────────────────────────────────────────────────────────────

/**
 * Check if an overlay is suppressed.
 *
 * @param type - Overlay type
 * @param id - Instance ID
 * @returns Whether the overlay is suppressed (type-level OR instance-level)
 */
export function useIsSuppressed(
  type: VisualOverlayType,
  id: VisualOverlayId
): boolean {
  return useAtomValue(isSuppressedAtom({ type, id }), {
    registry: overlayRegistry,
  })
}

/**
 * Check if all overlays of a type are suppressed.
 *
 * @param type - Overlay type
 * @returns Whether the type is suppressed
 */
export function useIsTypeSuppressed(type: VisualOverlayType): boolean {
  return useAtomValue(isTypeSuppressedAtom(type), {
    registry: overlayRegistry,
  })
}
