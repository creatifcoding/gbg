/**
 * FloatingPanelProvider v3 — Slim orchestration shell
 *
 * Pure composition root. Every concern is a dedicated hook:
 * - useFloatingActions    → context value (stx adapter)
 * - usePanelPersistence   → localStorage restore + subscribe
 * - useDragHandlers       → dragStart/dragEnd + collision detection
 * - useFloatingModifiers  → modifier chain assembly
 * - useWorkspaceBounds    → workspace rect + viewport
 * - useSnapGuides         → snap guide refs + paint/hide
 * - useDockPreview        → dock preview refs + paint/hide
 * - useKeyboardNudge      → arrow key panel nudging
 *
 * @module
 */

import { useRef, type ReactNode } from 'react'
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'

import { FloatingPanelContext } from './context/FloatingPanelContext'
import { useFloatingActions } from './hooks/useFloatingActions'
import { usePanelPersistence } from './hooks/usePanelPersistence'
import { useDragHandlers } from './hooks/useDragHandlers'
import { useFloatingModifiers } from './hooks/useFloatingModifiers'
import { useWorkspaceBounds } from './hooks/useWorkspaceBounds'
import { useSnapGuides } from './hooks/useSnapGuides'
import { useDockPreview } from './hooks/useDockPreview'
import { useKeyboardNudge } from './hooks/useKeyboardNudge'
import { DragGuideOverlay } from './components/DragGuideOverlay'
import { CollapsedStripStack } from './components/CollapsedStripStack'
import type { DragSnapState } from './modifiers'

// =============================================================================
// Props
// =============================================================================

export interface FloatingPanelProviderProps {
  children: ReactNode
  /** Disable localStorage persistence */
  disablePersistence?: boolean
  /** Callback when a non-panel drag starts (for sortables) */
  onSortableDragStart?: (event: DragStartEvent) => void
  /** Callback when a non-panel drag ends (for sortables) */
  onSortableDragEnd?: (event: DragEndEvent) => void
}

// =============================================================================
// Provider
// =============================================================================

export function FloatingPanelProvider({
  children,
  disablePersistence = false,
  onSortableDragStart,
  onSortableDragEnd,
}: FloatingPanelProviderProps) {
  // ─── Shared ref ────────────────────────────────────────────────
  const dragSnapRef = useRef<DragSnapState>({
    activeId: null,
    dimensions: null,
    siblings: [],
  })

  // ─── Hooks ─────────────────────────────────────────────────────
  const contextValue = useFloatingActions()
  const { workspaceRectRef, getLocalViewport } = useWorkspaceBounds()
  const { guideVRef, guideHRef, hideSnapGuides, paintSnapGuides } = useSnapGuides()
  const { previewRef: dockPreviewRef, labelRef: dockPreviewLabelRef, hideDockPreview, paintDockPreview } = useDockPreview()

  usePanelPersistence({ disabled: disablePersistence })
  useKeyboardNudge({ getLocalViewport })

  const modifiers = useFloatingModifiers({
    workspaceRectRef,
    dragSnapRef,
    hideSnapGuides,
    paintSnapGuides,
    hideDockPreview,
    paintDockPreview,
  })

  const { handleDragStart, handleDragEnd, collisionDetection } = useDragHandlers({
    dragSnapRef,
    getLocalViewport,
    hideSnapGuides,
    hideDockPreview,
    onSortableDragStart,
    onSortableDragEnd,
  })

  // ─── Sensors ───────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  // ─── Render ────────────────────────────────────────────────────
  return (
    <FloatingPanelContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        modifiers={modifiers}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {children}
        <CollapsedStripStack />
        <DragGuideOverlay
          dockPreviewRef={dockPreviewRef}
          dockPreviewLabelRef={dockPreviewLabelRef}
          guideVRef={guideVRef}
          guideHRef={guideHRef}
        />
      </DndContext>
    </FloatingPanelContext.Provider>
  )
}

export { useFloatingPanel } from './hooks/useFloatingPanel'

export default FloatingPanelProvider
