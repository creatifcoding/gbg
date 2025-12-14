/**
 * useModal Hook
 *
 * Opens and manages modal overlays.
 *
 * @example
 * ```tsx
 * const modal = useModal()
 *
 * const confirm = () => {
 *   modal.open({
 *     id: "confirm-delete",
 *     size: "md",
 *   }, <ConfirmDialog onConfirm={handleDelete} />)
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
  topOverlayByTypeAtom,
  overlayCountByTypeAtom,
} from "../../atoms"
import type { ModalConfig, VisualOverlayId } from "../../schemas/visual"
import type { ReactNode } from "react"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ModalOpenOptions {
  /** Modal ID (auto-generated if not provided) */
  id?: string
  /** Size preset (defaults to "md") */
  size?: "sm" | "md" | "lg" | "xl" | "full"
  /** Show backdrop (defaults to true) */
  showBackdrop?: boolean
  /** Close on backdrop click (defaults to true) */
  closeOnBackdropClick?: boolean
  /** Close on escape key (defaults to true) */
  closeOnEscape?: boolean
  /** Z-index offset from base tier */
  zIndexOffset?: number
  /** Persistence mode (defaults to "route-scoped") */
  persistence?: "persist" | "route-scoped" | "ephemeral"
  /** Callback when modal opens */
  onOpen?: () => void
  /** Callback when modal closes */
  onClose?: () => void
}

export interface UseModalReturn {
  /** Open a modal with content */
  open: (options: ModalOpenOptions, content: ReactNode) => VisualOverlayId
  /** Close a modal by ID */
  close: (id: VisualOverlayId) => void
  /** Close all modals */
  closeAll: () => void
  /** Get top (frontmost) modal */
  topModal: ReturnType<typeof topOverlayByTypeAtom> extends infer T ? T : never
  /** Count of open modals */
  count: number
  /** Whether any modal is open */
  isOpen: boolean
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

/**
 * Hook to manage modal overlays.
 *
 * @throws Error if used outside VisualOverlayProvider
 */
export function useModal(): UseModalReturn {
  const ctx = useVisualOverlay()

  const topModal = useAtomValue(topOverlayByTypeAtom("modal"), {
    registry: overlayRegistry,
  })
  const count = useAtomValue(overlayCountByTypeAtom("modal"), {
    registry: overlayRegistry,
  })

  const open = useCallback(
    (options: ModalOpenOptions, content: ReactNode): VisualOverlayId => {
      const config: ModalConfig = {
        _tag: "ModalConfig",
        id: (options.id ?? "") as VisualOverlayId,
        size: options.size ?? "md",
        showBackdrop: options.showBackdrop ?? true,
        closeOnBackdropClick: options.closeOnBackdropClick ?? true,
        closeOnEscape: options.closeOnEscape ?? true,
        zIndexOffset: options.zIndexOffset ?? 0,
        persistence: options.persistence ?? "route-scoped",
        onOpen: options.onOpen,
        onClose: options.onClose,
      }

      return ctx.open("modal", { id: options.id, config, content })
    },
    [ctx]
  )

  const close = useCallback(
    (id: VisualOverlayId): void => {
      ctx.close(id)
    },
    [ctx]
  )

  const closeAll = useCallback((): void => {
    ctx.closeAllOfType("modal")
  }, [ctx])

  return useMemo(
    () => ({
      open,
      close,
      closeAll,
      topModal,
      count,
      isOpen: count > 0,
    }),
    [open, close, closeAll, topModal, count]
  )
}

/**
 * Safe version that returns null when no provider exists.
 */
export function useModalSafe(): UseModalReturn | null {
  const ctx = useVisualOverlaySafe()
  if (!ctx) return null
  return useModal()
}
