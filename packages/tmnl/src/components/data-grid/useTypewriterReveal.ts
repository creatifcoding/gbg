/**
 * useTypewriterReveal
 *
 * Anime.js-powered typewriter reveal for AG-Grid rows.
 * Rows reveal left-to-right like terminal text.
 */

import { useRef, useCallback } from 'react'
import { animate, stagger } from 'animejs'
import { FUI_TIMING } from '@/lib/fui'

// =============================================================================
// TYPES
// =============================================================================

export interface UseTypewriterRevealOptions {
  /** Stagger delay between rows (ms) */
  staggerDelay?: number
  /** Duration for each row reveal (ms) */
  duration?: number
  /** Container selector or ref */
  containerRef?: React.RefObject<HTMLElement>
}

export interface UseTypewriterRevealResult {
  /** Trigger the typewriter reveal animation */
  triggerReveal: () => void
  /** Container ref to attach */
  containerRef: React.RefObject<HTMLDivElement>
}

// =============================================================================
// HOOK
// =============================================================================

export function useTypewriterReveal(
  options: UseTypewriterRevealOptions = {}
): UseTypewriterRevealResult {
  const {
    staggerDelay = FUI_TIMING.rowStagger,
    duration = FUI_TIMING.rowReveal,
  } = options

  const internalRef = useRef<HTMLDivElement>(null)
  const containerRef = options.containerRef ?? internalRef

  const triggerReveal = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    // Select all AG-Grid rows within the container
    const rows = container.querySelectorAll('.ag-row')
    if (rows.length === 0) return

    // Reset rows to hidden state
    rows.forEach((row) => {
      const el = row as HTMLElement
      el.style.clipPath = 'inset(0 100% 0 0)'
      el.style.opacity = '1'
    })

    // Animate with typewriter reveal
    animate(rows, {
      clipPath: ['inset(0 100% 0 0)', 'inset(0 0% 0 0)'],
      duration,
      delay: stagger(staggerDelay, { from: 'first' }),
      easing: 'linear',
    })
  }, [containerRef, staggerDelay, duration])

  return {
    triggerReveal,
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
  }
}
