/**
 * FloatingPanelProvider v2
 *
 * Context provider for draggable, resizable floating panels.
 * Uses stx (Legend-State + XState + Effect) as backbone.
 *
 * @pattern stx + @dnd-kit + localStorage persistence
 * @module
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core'
import {
  createSnapModifier,
} from '@dnd-kit/modifiers'
import type { ClientRect } from '@dnd-kit/core'

import { useSelector, batch } from '@/lib/stx'
import {
  getFloatingStx,
  registerPanel as stxRegisterPanel,
  unregisterPanel as stxUnregisterPanel,
  updatePanelPosition,
  bringPanelToFront,
  sendPanelToBack,
  setPanelVisibility,
  closePanel as stxClosePanel,
  togglePanelMode,
  setDragging,
  getPanel as stxGetPanel,
  restorePersistedState,
  updatePanelDimensions,
} from './floating-stx'
// NOTE: floating panel drag does not use drag-orchestrator visual effects.
// Keep drag pipeline single-source (dnd-kit + stx) to avoid competing actors.
import type {
  PanelState,
  PanelConfig,
  Position,
  Dimensions,
  PanelVisibility,
  UseFloatingPanelReturn,
  PanelStorage,
} from './types'
import {
  clampToViewport,
  type PanelRect,
} from './utils/position'
import { resolveDockLayout } from './dock'
import {
  FloatingPanelContext,
  useFloatingPanelContext,
  type FloatingPanelContextValue,
} from './context/FloatingPanelContext'
import { useWorkspaceBounds } from './hooks/useWorkspaceBounds'
import { useSnapGuides } from './hooks/useSnapGuides'
import { useDockPreview } from './hooks/useDockPreview'
import { useKeyboardNudge } from './hooks/useKeyboardNudge'
import {
  useRestrictToWorkspace,
  useMagneticSnapModifier,
  useDockPreviewModifier,
  type DragSnapState,
} from './modifiers'
import { DragGuideOverlay } from './components/DragGuideOverlay'


// =============================================================================
// Storage Key
// =============================================================================

const STORAGE_KEY = 'tmnl-floating-panels'

// Context type + createContext + hook imported from ./context/FloatingPanelContext

// =============================================================================
// Provider Props
// =============================================================================

export interface FloatingPanelProviderProps {
  children: ReactNode
  /** Disable persistence (panels reset on refresh) */
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
  const stx = getFloatingStx()

  // ─── Extracted hooks ───────────────────────────────────────────
  const { workspaceRectRef, getLocalViewport } = useWorkspaceBounds()
  const { guideVRef, guideHRef, hideSnapGuides, paintSnapGuides } = useSnapGuides()
  const {
    previewRef: dockPreviewRef,
    labelRef: dockPreviewLabelRef,
    hideDockPreview,
    paintDockPreview,
  } = useDockPreview()
  useKeyboardNudge({ getLocalViewport })

  const dragSnapRef = useRef<DragSnapState>({
    activeId: null,
    dimensions: null,
    siblings: [],
  })

  // ─── dnd-kit Modifiers (extracted) ─────────────────────────────
  const restrictToWorkspace = useRestrictToWorkspace(workspaceRectRef)
  const magneticSnap = useMagneticSnapModifier(workspaceRectRef, dragSnapRef, hideSnapGuides, paintSnapGuides)
  const dockPreviewModifier = useDockPreviewModifier(workspaceRectRef, dragSnapRef, hideDockPreview, paintDockPreview)

  // ─── Sensors ───────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )

  const snapGridSize = useSelector(() => stx.data.gridSize?.get?.() ?? 0)
  const snapEnabled = useSelector(() => stx.data.snapEnabled?.get?.() ?? false)

  const dndModifiers = useMemo<Modifier[]>(() => {
    const mods: Modifier[] = [restrictToWorkspace, dockPreviewModifier]
    if (snapEnabled) {
      mods.push(magneticSnap)
      if (snapGridSize > 0) mods.push(createSnapModifier(snapGridSize))
    }
    return mods
  }, [restrictToWorkspace, dockPreviewModifier, magneticSnap, snapEnabled, snapGridSize])

  useEffect(() => {
    if (!snapEnabled) hideSnapGuides()
  }, [snapEnabled, hideSnapGuides])

  // Domain-aware collision detection
  const collisionDetection = useCallback<typeof closestCenter>((args) => {
    const id = args.active.id as string
    if (stxGetPanel(id)) return []
    return closestCenter(args)
  }, [])

  // =============================================================================
  // Persistence
  // =============================================================================

  useEffect(() => {
    if (disablePersistence) return
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const storage = JSON.parse(stored) as PanelStorage
        restorePersistedState(storage)
      }
    } catch { /* Ignore parse errors */ }
  }, [disablePersistence])

  useEffect(() => {
    if (disablePersistence) return
    const disposer = stx.subscribe(() => {
      const panels = stx.data.panels.peek()
      const zOrder = stx.data.zOrder.peek()
      const storage: PanelStorage = { panels: {}, order: zOrder, version: 1 }
      panels.forEach((panel, id) => {
        storage.panels[id] = {
          position: panel.position,
          dimensions: panel.dimensions,
          visibility: panel.visibility,
          mode: panel.mode,
        }
      })
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(storage)) } catch { /* Storage full */ }
    })
    return disposer
  }, [disablePersistence, stx])

  // =============================================================================
  // Actions (wrapped for context)
  // =============================================================================

  const registerPanel = useCallback((config: PanelConfig) => {
    stxRegisterPanel(config)
  }, [])

  const unregisterPanel = useCallback((id: string) => {
    stxUnregisterPanel(id)
  }, [])

  const updatePosition = useCallback((id: string, position: Position) => {
    updatePanelPosition(id, position)
  }, [])

  const updateDimensions = useCallback((id: string, dimensions: Dimensions) => {
    updatePanelDimensions(id, dimensions)
  }, [])

  const bringToFront = useCallback((id: string) => {
    bringPanelToFront(id)
  }, [])

  const sendToBack = useCallback((id: string) => {
    sendPanelToBack(id)
  }, [])

  const closePanel = useCallback((id: string) => {
    stxClosePanel(id)
  }, [])

  const toggleMode = useCallback((id: string) => {
    togglePanelMode(id)
  }, [])

  const getPanel = useCallback((id: string) => {
    return stxGetPanel(id)
  }, [])

  const setVisibility = useCallback((id: string, visibility: PanelVisibility) => {
    setPanelVisibility(id, visibility)
  }, [])

  // =============================================================================
  // Drag Handlers
  // =============================================================================

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      hideSnapGuides()
      hideDockPreview()

      const id = event.active.id as string
      const panel = stxGetPanel(id)

      if (panel) {
        // PANEL DRAG: snapshot snap targets for this drag session (perf)
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

        // PANEL DRAG: bring to front + set dragging state
        bringPanelToFront(id)
        setDragging(id, true)

        stx.send?.({ type: 'START_DRAG', panelId: id, position: { x: 0, y: 0 } })
      } else {
        // SORTABLE DRAG: delegate to callback
        onSortableDragStart?.(event)
      }
    },
    [hideSnapGuides, hideDockPreview, stx, onSortableDragStart]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const id = event.active.id as string
      const panel = stxGetPanel(id)

      // Clear per-drag snap cache + guide overlay
      dragSnapRef.current = { activeId: null, dimensions: null, siblings: [] }
      hideSnapGuides()

      if (panel) {
        // PANEL DRAG: commit final position, optionally dock to workspace zones
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
        // SORTABLE DRAG: delegate to callback
        onSortableDragEnd?.(event)
      }
    },
    [getLocalViewport, hideSnapGuides, hideDockPreview, stx, onSortableDragEnd]
  )

  // =============================================================================
  // Context Value
  // =============================================================================

  const contextValue = useMemo<FloatingPanelContextValue>(
    () => ({
      registerPanel,
      unregisterPanel,
      updatePosition,
      updateDimensions,
      bringToFront,
      sendToBack,
      closePanel,
      toggleMode,
      getPanel,
      setVisibility,
    }),
    [
      registerPanel,
      unregisterPanel,
      updatePosition,
      updateDimensions,
      bringToFront,
      sendToBack,
      closePanel,
      toggleMode,
      getPanel,
      setVisibility,
    ]
  )

  return (
    <FloatingPanelContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        modifiers={dndModifiers}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {children}

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

// Hooks re-exported from context + hooks modules
// NOTE: useFloatingPanelContext is already imported above for internal use.
// Re-export from the context module directly in the barrel (index.ts), not here,
// to avoid duplicate declaration errors in babel/React Fast Refresh transforms.
export { useFloatingPanel } from './hooks/useFloatingPanel'

export default FloatingPanelProvider
