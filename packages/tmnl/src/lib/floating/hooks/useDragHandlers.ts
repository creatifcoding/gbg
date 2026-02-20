/**
 * useDragHandlers — dnd-kit drag start/end logic for floating panels
 *
 * Encapsulates snap target caching, drag state management,
 * clamp-on-drop, dock resolution, and sortable delegation.
 *
 * @module
 */

import { useCallback, type MutableRefObject } from 'react'
import {
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'

import { batch } from '@/lib/stx'
import {
  getFloatingStx,
  updatePanelPosition,
  updatePanelDimensions,
  bringPanelToFront,
  setDragging,
  getPanel as stxGetPanel,
} from '../floating-stx'
import type { Position } from '../types'
import { clampToViewport, type PanelRect, type Viewport } from '../utils/position'
import { resolveDockLayout } from '../dock'
import type { DragSnapState } from '../modifiers'

export interface UseDragHandlersOptions {
  dragSnapRef: MutableRefObject<DragSnapState>
  getLocalViewport: () => Viewport
  hideSnapGuides: () => void
  hideDockPreview: () => void
  onSortableDragStart?: (event: DragStartEvent) => void
  onSortableDragEnd?: (event: DragEndEvent) => void
}

export interface UseDragHandlersReturn {
  handleDragStart: (event: DragStartEvent) => void
  handleDragEnd: (event: DragEndEvent) => void
  collisionDetection: typeof closestCenter
}

export function useDragHandlers({
  dragSnapRef,
  getLocalViewport,
  hideSnapGuides,
  hideDockPreview,
  onSortableDragStart,
  onSortableDragEnd,
}: UseDragHandlersOptions): UseDragHandlersReturn {
  const stx = getFloatingStx()

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      hideSnapGuides()
      hideDockPreview()

      const id = event.active.id as string
      const panel = stxGetPanel(id)

      if (panel) {
        // Snapshot snap targets for this drag session (perf)
        const siblings: PanelRect[] = []
        stx.data.panels.peek().forEach((p, pid) => {
          if (pid === id) return
          if (p.visibility !== 'visible') return
          if (p.mode !== 'floating') return
          siblings.push({
            x: p.position.x,
            y: p.position.y,
            width: p.dimensions.width,
            height: p.dimensions.height,
          })
        })
        dragSnapRef.current = {
          activeId: id,
          dimensions: panel.dimensions,
          siblings,
        }

        bringPanelToFront(id)
        setDragging(id, true)
        stx.send?.({ type: 'START_DRAG', panelId: id, position: { x: 0, y: 0 } })
      } else {
        onSortableDragStart?.(event)
      }
    },
    [hideSnapGuides, hideDockPreview, stx, dragSnapRef, onSortableDragStart]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const id = event.active.id as string
      const panel = stxGetPanel(id)

      // Clear per-drag snap cache + guide overlay
      dragSnapRef.current = { activeId: null, dimensions: null, siblings: [] }
      hideSnapGuides()

      if (panel) {
        const { delta } = event
        const droppedPosition: Position = {
          x: panel.position.x + delta.x,
          y: panel.position.y + delta.y,
        }

        const viewport = getLocalViewport()
        const clamped = clampToViewport(droppedPosition, panel.dimensions, viewport)
        const docked = resolveDockLayout(clamped, panel.dimensions, viewport)

        batch(() => {
          if (docked) {
            updatePanelPosition(id, docked.position)
            updatePanelDimensions(id, docked.dimensions)
          } else {
            updatePanelPosition(id, clamped)
          }
          setDragging(id, false)
        })

        stx.send?.({ type: 'END_DRAG' })
      } else {
        onSortableDragEnd?.(event)
      }
    },
    [getLocalViewport, hideSnapGuides, hideDockPreview, stx, dragSnapRef, onSortableDragEnd]
  )

  // Domain-aware collision detection: floating panels get [] (free drag)
  const collisionDetection = useCallback<typeof closestCenter>((args) => {
    const id = args.active.id as string
    if (stxGetPanel(id)) return []
    return closestCenter(args)
  }, [])

  return { handleDragStart, handleDragEnd, collisionDetection }
}
