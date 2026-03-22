/**
 * useFloatingModifiers — dnd-kit modifier chain assembly
 *
 * Constructs the modifier array from workspace bounds, snap state,
 * dock preview, and grid settings.
 *
 * @module
 */

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { type Modifier } from '@dnd-kit/core'
import { createSnapModifier } from '@dnd-kit/modifiers'

import { useSelector } from '@/lib/stx'
import { getFloatingStx } from '../floating-stx'
import {
  useRestrictToWorkspace,
  useMagneticSnapModifier,
  useDockPreviewModifier,
  type DragSnapState,
} from '../modifiers'

export interface UseFloatingModifiersOptions {
  workspaceRectRef: MutableRefObject<DOMRectReadOnly | null>
  dragSnapRef: MutableRefObject<DragSnapState>
  hideSnapGuides: () => void
  paintSnapGuides: (
    nextLocal: { x: number; y: number },
    snappedLocal: { x: number; y: number },
    boundsRect: { left: number; top: number; width: number; height: number },
    offsetX: number,
    offsetY: number,
  ) => void
  hideDockPreview: () => void
  paintDockPreview: (zone: string, rect: { x: number; y: number; width: number; height: number }, label: string) => void
}

export function useFloatingModifiers({
  workspaceRectRef,
  dragSnapRef,
  hideSnapGuides,
  paintSnapGuides,
  hideDockPreview,
  paintDockPreview,
}: UseFloatingModifiersOptions): Modifier[] {
  const stx = getFloatingStx()

  const restrictToWorkspace = useRestrictToWorkspace(workspaceRectRef)
  const magneticSnap = useMagneticSnapModifier(workspaceRectRef, dragSnapRef, hideSnapGuides, paintSnapGuides)
  const dockPreviewModifier = useDockPreviewModifier(workspaceRectRef, dragSnapRef, hideDockPreview, paintDockPreview)

  const snapGridSize = useSelector(() => stx.data.gridSize?.get?.() ?? 0)
  const snapEnabled = useSelector(() => stx.data.snapEnabled?.get?.() ?? false)

  const modifiers = useMemo<Modifier[]>(() => {
    const mods: Modifier[] = [restrictToWorkspace, dockPreviewModifier]
    if (snapEnabled) {
      mods.push(magneticSnap)
      if (snapGridSize > 0) mods.push(createSnapModifier(snapGridSize))
    }
    return mods
  }, [restrictToWorkspace, dockPreviewModifier, magneticSnap, snapEnabled, snapGridSize])

  // Hide guides when snap is disabled
  useEffect(() => {
    if (!snapEnabled) hideSnapGuides()
  }, [snapEnabled, hideSnapGuides])

  return modifiers
}
