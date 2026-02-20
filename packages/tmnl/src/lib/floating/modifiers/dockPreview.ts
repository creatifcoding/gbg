/**
 * dockPreview modifier
 *
 * Shows dock zone preview overlay when dragging near viewport edges.
 * Paints dock preview rectangle + label imperatively.
 *
 * @module
 */

import { useCallback, type RefObject } from 'react'
import type { ClientRect, Modifier } from '@dnd-kit/core'
import { clampToViewport, type Viewport } from '../utils/position'
import { resolveDockLayout } from '../dock'
import type { Position, Dimensions } from '../types'
import type { DragSnapState } from './magneticSnap'

export function useDockPreviewModifier(
  workspaceRectRef: RefObject<ClientRect | null>,
  dragSnapRef: RefObject<DragSnapState>,
  hideDockPreview: () => void,
  paintDockPreview: (
    layout: { position: Position; dimensions: Dimensions } | null,
    viewport: Viewport,
    offsetX: number,
    offsetY: number,
  ) => void,
) {
  return useCallback<Modifier>(({ active, transform, draggingNodeRect, windowRect }) => {
    if (!active || !draggingNodeRect) {
      hideDockPreview()
      return transform
    }

    const activeId = String(active.id)
    if (dragSnapRef.current.activeId !== activeId) {
      hideDockPreview()
      return transform
    }

    const panelDimensions = dragSnapRef.current.dimensions
    if (!panelDimensions) {
      hideDockPreview()
      return transform
    }

    const boundsRect = workspaceRectRef.current ?? windowRect
    if (!boundsRect) {
      hideDockPreview()
      return transform
    }

    const offsetX = workspaceRectRef.current ? boundsRect.left : 0
    const offsetY = workspaceRectRef.current ? boundsRect.top : 0
    const viewport: Viewport = { x: 0, y: 0, width: boundsRect.width, height: boundsRect.height }

    const nextLocal = {
      x: draggingNodeRect.left + transform.x - offsetX,
      y: draggingNodeRect.top + transform.y - offsetY,
    }

    const clamped = clampToViewport(nextLocal, panelDimensions, viewport)
    const layout = resolveDockLayout(clamped, panelDimensions, viewport)
    paintDockPreview(layout, viewport, offsetX, offsetY)

    return transform
  }, [workspaceRectRef, dragSnapRef, hideDockPreview, paintDockPreview])
}
