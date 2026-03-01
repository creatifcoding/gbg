/**
 * Shared surface-width measurement hook.
 *
 * ResizeObserver-based ChatWidthTier classification.
 * Used by surface-content to provide a single measurement
 * point for both thread and composer.
 *
 * @module chat/hooks/use-surface-width
 */

import { useState, useEffect, type RefObject } from 'react'
import type { ChatWidthTier } from '../tokens'

const COMPACT_PX = 350
const SQUEEZE_PX = 500

export function classifySurfaceWidth(w: number): ChatWidthTier {
  if (w < COMPACT_PX) return 'compact'
  if (w < SQUEEZE_PX) return 'squeeze'
  return 'full'
}

export function useSurfaceWidth(ref: RefObject<HTMLElement | null>): ChatWidthTier {
  const [tier, setTier] = useState<ChatWidthTier>('full')

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setTier(classifySurfaceWidth(entry.contentRect.width))
    })
    ro.observe(el)
    setTier(classifySurfaceWidth(el.clientWidth))
    return () => ro.disconnect()
  }, [ref])

  return tier
}
