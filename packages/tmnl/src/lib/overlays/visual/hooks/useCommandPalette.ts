/**
 * useCommandPalette Hook
 *
 * Opens and manages command palette overlays.
 *
 * @example
 * ```tsx
 * const palette = useCommandPalette()
 *
 * // Toggle with keyboard shortcut
 * useEffect(() => {
 *   const handler = (e: KeyboardEvent) => {
 *     if ((e.metaKey || e.ctrlKey) && e.key === "k") {
 *       e.preventDefault()
 *       palette.toggle()
 *     }
 *   }
 *   window.addEventListener("keydown", handler)
 *   return () => window.removeEventListener("keydown", handler)
 * }, [palette])
 * ```
 *
 * @module
 */

import { useCallback, useMemo, useRef, useEffect } from "react"
import { useAtomValue } from "@effect-atom/atom-react"
import { useVisualOverlay, useVisualOverlaySafe } from "../providers"
import {
  topOverlayByTypeAtom,
  overlayCountByTypeAtom,
} from "../../atoms"
import type { CommandPaletteConfig, VisualOverlayId } from "../../schemas/visual"
import type { ReactNode } from "react"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface CommandPaletteOpenOptions {
  /** Palette ID (auto-generated if not provided) */
  id?: string
  /** Placeholder text (defaults to "Type a command...") */
  placeholder?: string
  /** Close on select (defaults to true) */
  closeOnSelect?: boolean
  /** Close on escape key (defaults to true) */
  closeOnEscape?: boolean
  /** Z-index offset from base tier */
  zIndexOffset?: number
  /** Callback when palette opens */
  onOpen?: () => void
  /** Callback when palette closes */
  onClose?: () => void
}

export interface UseCommandPaletteReturn {
  /** Open the command palette with content */
  open: (options: CommandPaletteOpenOptions, content: ReactNode) => VisualOverlayId
  /** Close the command palette */
  close: () => void
  /** Toggle command palette visibility */
  toggle: (options?: CommandPaletteOpenOptions, content?: ReactNode) => void
  /** Current palette instance (if open) */
  instance: ReturnType<typeof topOverlayByTypeAtom> extends infer T ? T : never
  /** Whether palette is open */
  isOpen: boolean
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

/**
 * Hook to manage command palette overlay.
 *
 * @throws Error if used outside VisualOverlayProvider
 */
export function useCommandPalette(): UseCommandPaletteReturn {
  const ctx = useVisualOverlay()
  const currentIdRef = useRef<VisualOverlayId | null>(null)
  const contentRef = useRef<ReactNode>(null)
  const optionsRef = useRef<CommandPaletteOpenOptions>({})

  const instance = useAtomValue(topOverlayByTypeAtom("command-palette"))
  const count = useAtomValue(overlayCountByTypeAtom("command-palette"))

  const open = useCallback(
    (options: CommandPaletteOpenOptions, content: ReactNode): VisualOverlayId => {
      // Close existing if already open
      if (currentIdRef.current) {
        ctx.close(currentIdRef.current)
      }

      const config: CommandPaletteConfig = {
        _tag: "CommandPaletteConfig",
        id: (options.id ?? "") as VisualOverlayId,
        placeholder: options.placeholder ?? "Type a command...",
        showRecent: true,
        closeOnEscape: options.closeOnEscape ?? true,
        persistence: "ephemeral", // Command palette is always ephemeral
        zIndexOffset: options.zIndexOffset ?? 0,
      }

      const id = ctx.open("command-palette", { id: options.id, config, content })
      currentIdRef.current = id
      contentRef.current = content
      optionsRef.current = options
      return id
    },
    [ctx]
  )

  const close = useCallback((): void => {
    if (currentIdRef.current) {
      ctx.close(currentIdRef.current)
      currentIdRef.current = null
    }
  }, [ctx])

  const toggle = useCallback(
    (options?: CommandPaletteOpenOptions, content?: ReactNode): void => {
      if (count > 0) {
        close()
      } else {
        // Use provided content/options or fall back to stored refs
        const finalOptions = options ?? optionsRef.current
        const finalContent = content ?? contentRef.current
        if (finalContent) {
          open(finalOptions, finalContent)
        }
      }
    },
    [count, open, close]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentIdRef.current) {
        ctx.close(currentIdRef.current)
      }
    }
  }, [ctx])

  return useMemo(
    () => ({
      open,
      close,
      toggle,
      instance,
      isOpen: count > 0,
    }),
    [open, close, toggle, instance, count]
  )
}

/**
 * Safe version that returns null when no provider exists.
 */
export function useCommandPaletteSafe(): UseCommandPaletteReturn | null {
  const ctx = useVisualOverlaySafe()
  if (!ctx) return null
  return useCommandPalette()
}
