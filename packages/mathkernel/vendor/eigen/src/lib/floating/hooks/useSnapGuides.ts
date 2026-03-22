/**
 * useSnapGuides
 *
 * Imperative snap guide overlay refs + paint/hide callbacks.
 * Refs are attached to invisible DOM elements; paint/hide mutate
 * style.opacity directly — zero React re-renders during drag.
 *
 * @module
 */

import { useRef, useCallback } from 'react'
import type { ClientRect } from '@dnd-kit/core'
import type { Position } from '../types'

export function useSnapGuides() {
  const guideVRef = useRef<HTMLDivElement | null>(null)
  const guideHRef = useRef<HTMLDivElement | null>(null)

  const hideSnapGuides = useCallback(() => {
    if (guideVRef.current) guideVRef.current.style.opacity = '0'
    if (guideHRef.current) guideHRef.current.style.opacity = '0'
  }, [])

  const paintSnapGuides = useCallback((
    nextLocal: Position,
    snappedLocal: Position,
    boundsRect: ClientRect,
    offsetX: number,
    offsetY: number,
  ) => {
    const snappedX = Math.abs(nextLocal.x - snappedLocal.x) > 0.5
    const snappedY = Math.abs(nextLocal.y - snappedLocal.y) > 0.5

    if (guideVRef.current) {
      guideVRef.current.style.opacity = snappedX ? '1' : '0'
      if (snappedX) {
        guideVRef.current.style.left = `${Math.round(snappedLocal.x + offsetX)}px`
        guideVRef.current.style.top = `${Math.round(offsetY)}px`
        guideVRef.current.style.height = `${Math.round(boundsRect.height)}px`
      }
    }

    if (guideHRef.current) {
      guideHRef.current.style.opacity = snappedY ? '1' : '0'
      if (snappedY) {
        guideHRef.current.style.left = `${Math.round(offsetX)}px`
        guideHRef.current.style.top = `${Math.round(snappedLocal.y + offsetY)}px`
        guideHRef.current.style.width = `${Math.round(boundsRect.width)}px`
      }
    }
  }, [])

  return { guideVRef, guideHRef, hideSnapGuides, paintSnapGuides }
}
