/**
 * useTerminalHotkeys — Terminal-scoped hotkey bindings
 *
 * Registers Ctrl+= (zoom in) and Ctrl+- (zoom out) hotkeys
 * that are only active when the terminal has focus.
 *
 * @module
 */

import { useEffect, useCallback, useRef } from 'react'
import { Scopes } from '@/lib/hotkeys'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UseTerminalHotkeysOptions {
  /** Current zoom level */
  zoom: number
  /** Set zoom level */
  setZoom: (zoom: number) => void
  /** Minimum zoom (default: 0.5) */
  minZoom?: number
  /** Maximum zoom (default: 2.5) */
  maxZoom?: number
  /** Zoom step (default: 0.1) */
  zoomStep?: number
  /** Whether hotkeys are enabled (default: true) */
  enabled?: boolean
  /** Container element ref for focus detection */
  containerRef?: React.RefObject<HTMLElement | null>
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registers terminal-scoped zoom hotkeys.
 *
 * - Ctrl+= or Ctrl++ : Zoom in
 * - Ctrl+- : Zoom out
 * - Ctrl+0 : Reset zoom to 100%
 *
 * Hotkeys only fire when the terminal container (or children) has focus.
 */
export function useTerminalHotkeys({
  zoom,
  setZoom,
  minZoom = 0.5,
  maxZoom = 2.5,
  zoomStep = 0.1,
  enabled = true,
  containerRef,
}: UseTerminalHotkeysOptions) {
  const isActiveRef = useRef(false)

  const zoomIn = useCallback(() => {
    setZoom(Math.min(maxZoom, zoom + zoomStep))
  }, [zoom, setZoom, maxZoom, zoomStep])

  const zoomOut = useCallback(() => {
    setZoom(Math.max(minZoom, zoom - zoomStep))
  }, [zoom, setZoom, minZoom, zoomStep])

  const resetZoom = useCallback(() => {
    setZoom(1.0)
  }, [setZoom])

  // Track focus state
  useEffect(() => {
    if (!containerRef?.current) return

    const container = containerRef.current

    const handleFocusIn = () => {
      isActiveRef.current = true
    }

    const handleFocusOut = (e: FocusEvent) => {
      // Check if focus is moving outside the container
      if (!container.contains(e.relatedTarget as Node)) {
        isActiveRef.current = false
      }
    }

    container.addEventListener('focusin', handleFocusIn)
    container.addEventListener('focusout', handleFocusOut)

    return () => {
      container.removeEventListener('focusin', handleFocusIn)
      container.removeEventListener('focusout', handleFocusOut)
    }
  }, [containerRef])

  // Keydown handler
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only process when terminal has focus (or if no containerRef, always process Ctrl combos)
      if (containerRef && !isActiveRef.current) return

      // Must have Ctrl (but not Alt/Meta for these shortcuts)
      if (!e.ctrlKey || e.altKey || e.metaKey) return

      // Normalize key
      const key = e.key.toLowerCase()

      // Ctrl++ or Ctrl+= : Zoom in
      if (key === '=' || key === '+') {
        e.preventDefault()
        e.stopPropagation()
        zoomIn()
        return
      }

      // Ctrl+- : Zoom out
      if (key === '-') {
        e.preventDefault()
        e.stopPropagation()
        zoomOut()
        return
      }

      // Ctrl+0 : Reset zoom
      if (key === '0') {
        e.preventDefault()
        e.stopPropagation()
        resetZoom()
        return
      }
    }

    // Capture phase to intercept before global handlers
    window.addEventListener('keydown', handleKeyDown, { capture: true })

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [enabled, zoomIn, zoomOut, resetZoom, containerRef])

  return {
    zoomIn,
    zoomOut,
    resetZoom,
    scope: Scopes.TERMINAL,
  }
}

export default useTerminalHotkeys
