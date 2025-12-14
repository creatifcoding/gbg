/**
 * useToast Hook
 *
 * Shows toast notification overlays.
 *
 * @example
 * ```tsx
 * const toast = useToast()
 *
 * const notify = () => {
 *   toast.success("Changes saved!")
 *   toast.error("Failed to save")
 *   toast.info("Processing...")
 * }
 * ```
 *
 * @module
 */

import { useCallback, useMemo } from "react"
import { useAtomValue } from "@effect-atom/atom-react"
import { useVisualOverlay, useVisualOverlaySafe } from "../providers"
import {
  overlayRegistry,
  overlaysByTypeAtom,
  overlayCountByTypeAtom,
} from "../../atoms"
import type { ToastConfig, VisualOverlayId } from "../../schemas/visual"
import type { ReactNode } from "react"
import { getAnimationDuration } from "../constants"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type ToastVariant = "info" | "success" | "warning" | "error"
export type ToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"

export interface ToastOpenOptions {
  /** Toast ID (auto-generated if not provided) */
  id?: string
  /** Visual variant (defaults to "info") */
  variant?: ToastVariant
  /** Screen position (defaults to "bottom-right") */
  position?: ToastPosition
  /** Auto-dismiss duration in ms (defaults to 5000, 0 = no auto-dismiss) */
  duration?: number
  /** Show close button (defaults to true) */
  dismissible?: boolean
  /** Z-index offset from base tier */
  zIndexOffset?: number
  /** Callback when toast opens */
  onOpen?: () => void
  /** Callback when toast closes */
  onClose?: () => void
}

export interface UseToastReturn {
  /** Open a toast with content */
  open: (options: ToastOpenOptions, content: ReactNode) => VisualOverlayId
  /** Open a success toast */
  success: (message: ReactNode, options?: Omit<ToastOpenOptions, "variant">) => VisualOverlayId
  /** Open an error toast */
  error: (message: ReactNode, options?: Omit<ToastOpenOptions, "variant">) => VisualOverlayId
  /** Open a warning toast */
  warning: (message: ReactNode, options?: Omit<ToastOpenOptions, "variant">) => VisualOverlayId
  /** Open an info toast */
  info: (message: ReactNode, options?: Omit<ToastOpenOptions, "variant">) => VisualOverlayId
  /** Close a toast by ID */
  close: (id: VisualOverlayId) => void
  /** Close all toasts */
  closeAll: () => void
  /** All visible toasts */
  toasts: ReturnType<typeof overlaysByTypeAtom> extends infer T ? T : never
  /** Count of visible toasts */
  count: number
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

/**
 * Hook to show toast notifications.
 *
 * @throws Error if used outside VisualOverlayProvider
 */
export function useToast(): UseToastReturn {
  const ctx = useVisualOverlay()

  const toasts = useAtomValue(overlaysByTypeAtom("toast"), {
    registry: overlayRegistry,
  })
  const count = useAtomValue(overlayCountByTypeAtom("toast"), {
    registry: overlayRegistry,
  })

  const open = useCallback(
    (options: ToastOpenOptions, content: ReactNode): VisualOverlayId => {
      const config: ToastConfig = {
        _tag: "ToastConfig",
        id: (options.id ?? "") as VisualOverlayId,
        variant: options.variant ?? "info",
        position: options.position ?? "bottom-right",
        duration: options.duration ?? 5000,
        dismissible: options.dismissible ?? true,
        zIndexOffset: options.zIndexOffset ?? 0,
        persistence: "ephemeral", // Toasts are always ephemeral
        onOpen: options.onOpen,
        onClose: options.onClose,
      }

      const id = ctx.open("toast", { id: options.id, config, content })

      // Auto-dismiss after duration (if not 0)
      if (config.duration && config.duration > 0) {
        const totalDuration = config.duration + getAnimationDuration("toast")
        setTimeout(() => ctx.close(id), totalDuration)
      }

      return id
    },
    [ctx]
  )

  const success = useCallback(
    (message: ReactNode, options?: Omit<ToastOpenOptions, "variant">): VisualOverlayId => {
      return open({ ...options, variant: "success" }, message)
    },
    [open]
  )

  const error = useCallback(
    (message: ReactNode, options?: Omit<ToastOpenOptions, "variant">): VisualOverlayId => {
      return open({ ...options, variant: "error", duration: 0 }, message) // Errors don't auto-dismiss
    },
    [open]
  )

  const warning = useCallback(
    (message: ReactNode, options?: Omit<ToastOpenOptions, "variant">): VisualOverlayId => {
      return open({ ...options, variant: "warning" }, message)
    },
    [open]
  )

  const info = useCallback(
    (message: ReactNode, options?: Omit<ToastOpenOptions, "variant">): VisualOverlayId => {
      return open({ ...options, variant: "info" }, message)
    },
    [open]
  )

  const close = useCallback(
    (id: VisualOverlayId): void => {
      ctx.close(id)
    },
    [ctx]
  )

  const closeAll = useCallback((): void => {
    ctx.closeAllOfType("toast")
  }, [ctx])

  return useMemo(
    () => ({
      open,
      success,
      error,
      warning,
      info,
      close,
      closeAll,
      toasts,
      count,
    }),
    [open, success, error, warning, info, close, closeAll, toasts, count]
  )
}

/**
 * Safe version that returns null when no provider exists.
 */
export function useToastSafe(): UseToastReturn | null {
  const ctx = useVisualOverlaySafe()
  if (!ctx) return null
  return useToast()
}
