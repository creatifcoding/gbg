/**
 * useReducedMotion — auto-detect OS-level reduced motion preference
 *
 * Reads `prefers-reduced-motion: reduce` media query and updates reactively.
 * Wire into Renderer and StreamingRenderer to auto-disable animations
 * without requiring manual prop passing.
 *
 * @module genifer/react/useReducedMotion
 */

import { useState, useEffect } from 'react'

const MEDIA_QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Returns true when the user has enabled reduced motion in their OS settings.
 *
 * Usage:
 * ```tsx
 * const reducedMotion = useReducedMotion()
 * return <Renderer tree={tree} disableAnimations={reducedMotion} />
 * ```
 */
export function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(MEDIA_QUERY).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mql = window.matchMedia(MEDIA_QUERY)
    const handler = (event: MediaQueryListEvent) => {
      setPrefersReduced(event.matches)
    }

    mql.addEventListener('change', handler)
    // Sync initial value (SSR hydration safety)
    setPrefersReduced(mql.matches)

    return () => mql.removeEventListener('change', handler)
  }, [])

  return prefersReduced
}
