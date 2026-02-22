/**
 * useWorkspaceBounds
 *
 * Caches workspace bounding rect via ResizeObserver.
 * Avoids querySelector/getBoundingClientRect on every drag frame.
 *
 * @module
 */

import { useEffect, useRef, useCallback } from 'react'
import type { ClientRect } from '@dnd-kit/core'
import type { Viewport } from '../utils/position'
import { getFloatingStx } from '../floating-stx'
import { updatePanelPosition } from '../stx/actions'
import type { PanelState } from '../types'

/**
 * Clamp all floating windows to fit within the workspace bounds.
 * SM §5.5: clampAllFloatingWindows — called on viewport resize.
 *
 * Ensures no floating panel is positioned outside the visible workspace.
 * Panels wider/taller than viewport are pinned to top-left.
 */
function clampAllFloatingWindows(bounds: { width: number; height: number }): void {
  const stx = getFloatingStx()
  const panels = stx.data.panels.peek()
  const zOrder = stx.data.zOrder.peek()

  for (const id of zOrder) {
    const panel = panels.get(id)
    if (!panel || panel.mode !== 'floating' || panel.visibility === 'hidden') continue

    let { x, y } = panel.position
    const { width, height } = panel.dimensions
    let clamped = false

    // Clamp right edge (ensure at least 48px visible from left)
    if (x + width > bounds.width) {
      x = Math.max(0, bounds.width - width)
      clamped = true
    }
    // Clamp bottom edge (ensure at least header visible)
    if (y + height > bounds.height) {
      y = Math.max(0, bounds.height - height)
      clamped = true
    }
    // Clamp left/top (don't go negative)
    if (x < 0) { x = 0; clamped = true }
    if (y < 0) { y = 0; clamped = true }

    if (clamped) {
      updatePanelPosition(id, { x, y })
    }
  }
}

export function useWorkspaceBounds() {
  const workspaceRectRef = useRef<ClientRect | null>(null)

  useEffect(() => {
    const workspace = document.querySelector('[data-shell-workspace]')
    if (!workspace) {
      workspaceRectRef.current = null
      return
    }

    const updateRect = () => {
      const r = workspace.getBoundingClientRect()
      workspaceRectRef.current = {
        top: r.top,
        left: r.left,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      }
      // SM §5.5: clamp floating panels on resize
      clampAllFloatingWindows({ width: r.width, height: r.height })
    }

    updateRect()

    const observer = new ResizeObserver(updateRect)
    observer.observe(workspace)
    window.addEventListener('resize', updateRect)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateRect)
    }
  }, [])

  const getLocalViewport = useCallback((): Viewport => {
    const boundsRect = workspaceRectRef.current
    if (boundsRect) {
      return { x: 0, y: 0, width: boundsRect.width, height: boundsRect.height }
    }
    return {
      x: 0,
      y: 0,
      width: typeof window !== 'undefined' ? window.innerWidth : 1920,
      height: typeof window !== 'undefined' ? window.innerHeight : 1080,
    }
  }, [])

  return { workspaceRectRef, getLocalViewport }
}
