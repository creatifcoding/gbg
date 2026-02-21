/**
 * magneticSnap modifier — Sticky Snap implementation
 *
 * Uses the sticky snap algorithm: panel moves freely until it touches
 * a snap edge, then sticks until the user drags past escape velocity.
 * Visual guides are painted imperatively for zero React re-renders.
 *
 * @module
 */

import { useCallback, useRef, type RefObject } from 'react'
import type { ClientRect, Modifier } from '@dnd-kit/core'
import {
  stickySnap,
  buildSnapGrid,
  createStickyState,
  type StickyState,
  type SnapEdge,
  type SnapRect,
  DEFAULT_SNAP_CONFIG,
} from '../utils/snap-engine'
import type { Dimensions, Position } from '../types'

export interface DragSnapState {
  activeId: string | null
  dimensions: Dimensions | null
  siblings: SnapRect[]
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
  // Sticky state persists across frames within one drag session
  const stickyRef = useRef<StickyState>(createStickyState())
  // Snap grid is built once per drag session (on first modifier call)
  const gridRef = useRef<SnapEdge[]>([])
  const lastActiveRef = useRef<string | null>(null)

  return useCallback<Modifier>(({ active, transform, draggingNodeRect, windowRect }) => {
    if (!active || !draggingNodeRect) return transform

    const activeId = String(active.id)

    // Not our drag — bail
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

    // Reset sticky state + rebuild grid on new drag session
    if (lastActiveRef.current !== activeId) {
      lastActiveRef.current = activeId
      stickyRef.current = createStickyState()

      const viewport: SnapRect = {
        x: 0, y: 0,
        width: boundsRect.width,
        height: boundsRect.height,
      }
      gridRef.current = buildSnapGrid(viewport, dragSnapRef.current.siblings)
    }

    const offsetX = workspaceRectRef.current ? boundsRect.left : 0
    const offsetY = workspaceRectRef.current ? boundsRect.top : 0

    // Panel position in local (workspace) coordinates
    const nextLocal: Position = {
      x: draggingNodeRect.left + transform.x - offsetX,
      y: draggingNodeRect.top + transform.y - offsetY,
    }

    // Apply sticky snap
    const result = stickySnap(
      nextLocal,
      panelDimensions,
      gridRef.current,
      stickyRef.current, // mutated in place
    )

    // Paint or hide guides
    paintSnapGuides(nextLocal, result.position, boundsRect, offsetX, offsetY)

    return {
      ...transform,
      x: result.position.x + offsetX - draggingNodeRect.left,
      y: result.position.y + offsetY - draggingNodeRect.top,
    }
  }, [workspaceRectRef, dragSnapRef, hideSnapGuides, paintSnapGuides])
}
