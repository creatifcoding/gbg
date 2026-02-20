/**
 * magneticSnap modifier
 *
 * Applies magnetic snapping to nearby viewport edges, centers, and sibling
 * panel alignment lines during drag. Paints snap guides imperatively.
 *
 * @module
 */

import { useCallback, type RefObject } from 'react'
import type { ClientRect, Modifier } from '@dnd-kit/core'
import { applyMagneticSnap, type Viewport, type PanelRect } from '../utils/position'
import type { Dimensions, Position } from '../types'

export interface DragSnapState {
  activeId: string | null
  dimensions: Dimensions | null
  siblings: PanelRect[]
}

export function useMagneticSnapModifier(
  workspaceRectRef: RefObject<ClientRect | null>,
  dragSnapRef: RefObject<DragSnapState>,
  hideSnapGuides: () => void,
  paintSnapGuides: (
    nextLocal: Position,
    snappedLocal: Position,
    boundsRect: ClientRect,
    offsetX: number,
    offsetY: number,
  ) => void,
) {
  return useCallback<Modifier>(({ active, transform, draggingNodeRect, windowRect }) => {
    if (!active || !draggingNodeRect) return transform

    const activeId = String(active.id)
    if (dragSnapRef.current.activeId !== activeId) {
      hideSnapGuides()
      return transform
    }

    const panelDimensions = dragSnapRef.current.dimensions
    if (!panelDimensions) {
      hideSnapGuides()
      return transform
    }

    const boundsRect = workspaceRectRef.current ?? windowRect
    if (!boundsRect) {
      hideSnapGuides()
      return transform
    }

    const offsetX = workspaceRectRef.current ? boundsRect.left : 0
    const offsetY = workspaceRectRef.current ? boundsRect.top : 0
    const viewport: Viewport = { x: 0, y: 0, width: boundsRect.width, height: boundsRect.height }

    const nextLocal = {
      x: draggingNodeRect.left + transform.x - offsetX,
      y: draggingNodeRect.top + transform.y - offsetY,
    }

    const snapped = applyMagneticSnap(
      nextLocal, panelDimensions, viewport, dragSnapRef.current.siblings,
      { threshold: 10, includeViewportCenter: true, includePanelAlign: true },
    )

    paintSnapGuides(nextLocal, snapped, boundsRect, offsetX, offsetY)

    return {
      ...transform,
      x: snapped.x + offsetX - draggingNodeRect.left,
      y: snapped.y + offsetY - draggingNodeRect.top,
    }
  }, [workspaceRectRef, dragSnapRef, hideSnapGuides, paintSnapGuides])
}
