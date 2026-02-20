/**
 * useKeyboardNudge
 *
 * Arrow key panel nudging (desktop-window behavior).
 * Shift=1px fine, default=8px, Alt=24px coarse.
 * Magnetic snap applied when enabled.
 *
 * Side-effect-only hook — no return value.
 *
 * @module
 */

import { useEffect, type RefObject } from 'react'
import type { ClientRect } from '@dnd-kit/core'
import {
  getFloatingStx,
  getPanel as stxGetPanel,
  updatePanelPosition,
  bringPanelToFront,
} from '../floating-stx'
import { applyMagneticSnap, clampToViewport, type Viewport, type PanelRect } from '../utils/position'

interface UseKeyboardNudgeOptions {
  getLocalViewport: () => Viewport
}

export function useKeyboardNudge({ getLocalViewport }: UseKeyboardNudgeOptions) {
  const stx = getFloatingStx()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
        return
      }

      const activeId = stx.data.activePanel.peek()
      if (!activeId) return

      const panel = stxGetPanel(activeId)
      if (!panel) return
      if (panel.visibility !== 'visible') return
      if (panel.isDragging || panel.isResizing || panel.isMaximized) return

      const baseStep = e.shiftKey ? 1 : e.altKey ? 24 : 8
      let dx = 0
      let dy = 0

      switch (e.key) {
        case 'ArrowLeft':  dx = -baseStep; break
        case 'ArrowRight': dx = baseStep; break
        case 'ArrowUp':    dy = -baseStep; break
        case 'ArrowDown':  dy = baseStep; break
        default: return
      }

      e.preventDefault()

      const viewport = getLocalViewport()
      const unclamped = { x: panel.position.x + dx, y: panel.position.y + dy }
      const next = clampToViewport(unclamped, panel.dimensions, viewport)

      // Reuse magnetic snap when enabled for keyboard moves too
      const siblings: PanelRect[] = []
      if (stx.data.snapEnabled.peek()) {
        stx.data.panels.peek().forEach((p, id) => {
          if (id === activeId) return
          if (p.visibility !== 'visible' || p.mode !== 'floating') return
          siblings.push({
            x: p.position.x, y: p.position.y,
            width: p.dimensions.width, height: p.dimensions.height,
          })
        })
      }

      const finalPos = stx.data.snapEnabled.peek()
        ? applyMagneticSnap(next, panel.dimensions, viewport, siblings, {
            threshold: 8,
            includeViewportCenter: true,
            includePanelAlign: true,
          })
        : next

      updatePanelPosition(activeId, finalPos)
      bringPanelToFront(activeId)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [getLocalViewport, stx])
}
