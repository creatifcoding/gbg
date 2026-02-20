/**
 * useDockPreview
 *
 * Imperative dock preview overlay refs + paint/hide callbacks.
 * Shows dock zone rectangle + label when dragging near edges.
 *
 * @module
 */

import { useRef, useCallback } from 'react'
import type { Position, Dimensions } from '../types'
import type { Viewport } from '../utils/position'
import { classifyDockZone, dockZoneLabel } from '../dock'

export function useDockPreview() {
  const previewRef = useRef<HTMLDivElement | null>(null)
  const labelRef = useRef<HTMLDivElement | null>(null)

  const hideDockPreview = useCallback(() => {
    if (previewRef.current) previewRef.current.style.opacity = '0'
    if (labelRef.current) labelRef.current.style.opacity = '0'
  }, [])

  const paintDockPreview = useCallback((
    layout: { position: Position; dimensions: Dimensions } | null,
    viewport: Viewport,
    offsetX: number,
    offsetY: number,
  ) => {
    if (!previewRef.current) return

    if (!layout) {
      previewRef.current.style.opacity = '0'
      if (labelRef.current) labelRef.current.style.opacity = '0'
      return
    }

    previewRef.current.style.opacity = '1'
    previewRef.current.style.left = `${Math.round(layout.position.x + offsetX)}px`
    previewRef.current.style.top = `${Math.round(layout.position.y + offsetY)}px`
    previewRef.current.style.width = `${Math.round(layout.dimensions.width)}px`
    previewRef.current.style.height = `${Math.round(layout.dimensions.height)}px`

    if (labelRef.current) {
      const zone = classifyDockZone(layout, viewport)
      labelRef.current.textContent = dockZoneLabel(zone)
      labelRef.current.style.opacity = '1'
      labelRef.current.style.left = `${Math.round(layout.position.x + offsetX + 8)}px`
      labelRef.current.style.top = `${Math.round(layout.position.y + offsetY + 8)}px`
    }
  }, [])

  return { previewRef, labelRef, hideDockPreview, paintDockPreview }
}
