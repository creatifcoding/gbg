/**
 * useCommandPalette Hook
 *
 * Thin wrapper around useMinibuffer for M-x (execute-extended-command) behavior.
 * The minibuffer owns the I/O mechanics; this hook just requests command completion.
 *
 * Architecture:
 * - Minibuffer = generic prompt engine (drawer, input, completions UI)
 * - CommandPalette = specific use case (M-x with CommandProvider)
 *
 * @example
 * ```tsx
 * const palette = useCommandPalette()
 *
 * // Open command palette
 * <button onClick={palette.open}>Commands</button>
 *
 * // Or toggle
 * <button onClick={palette.toggle}>CMD</button>
 * ```
 *
 * @module
 */

import { useCallback, useMemo } from "react"
import { useMinibuffer } from "@/lib/minibuffer"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface UseCommandPaletteReturn {
  /** Open the command palette (M-x) */
  open: () => Promise<void>
  /** Toggle command palette - opens if closed, cancels if open */
  toggle: () => Promise<void>
  /** Whether command palette is currently active */
  isActive: boolean
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

/**
 * Hook for command palette (M-x) functionality.
 *
 * Delegates entirely to useMinibuffer — the minibuffer owns the UI,
 * this hook just triggers command selection mode.
 */
export function useCommandPalette(): UseCommandPaletteReturn {
  const minibuffer = useMinibuffer()

  const open = useCallback(async () => {
    await minibuffer.executeCommand()
  }, [minibuffer])

  const toggle = useCallback(async () => {
    if (minibuffer.isActive) {
      await minibuffer.cancel()
    } else {
      await minibuffer.executeCommand()
    }
  }, [minibuffer])

  return useMemo(
    () => ({
      open,
      toggle,
      isActive: minibuffer.isActive,
    }),
    [open, toggle, minibuffer.isActive]
  )
}

/**
 * @deprecated Use useCommandPalette() - safe version no longer needed
 * since minibuffer handles its own safety.
 */
export function useCommandPaletteSafe(): UseCommandPaletteReturn | null {
  return useCommandPalette()
}
