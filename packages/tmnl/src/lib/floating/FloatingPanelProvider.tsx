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
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
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
} from '@dnd-kit/core'

import { useSelector } from '@/lib/stx'
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
import type {
  PanelState,
  PanelConfig,
  Position,
  Dimensions,
  PanelVisibility,
  UseFloatingPanelReturn,
  PanelStorage,
} from './types'

// =============================================================================
// Storage Key
// =============================================================================

const STORAGE_KEY = 'tmnl-floating-panels'

// =============================================================================
// Context
// =============================================================================

interface FloatingPanelContextValue {
  /** Register a new panel */
  registerPanel: (config: PanelConfig) => void
  /** Unregister a panel */
  unregisterPanel: (id: string) => void
  /** Update panel position */
  updatePosition: (id: string, position: Position) => void
  /** Update panel dimensions */
  updateDimensions: (id: string, dimensions: Dimensions) => void
  /** Bring panel to front */
  bringToFront: (id: string) => void
  /** Send panel to back */
  sendToBack: (id: string) => void
  /** Close panel */
  closePanel: (id: string) => void
  /** Toggle panel mode (floating/docked) */
  toggleMode: (id: string) => void
  /** Get panel by ID */
  getPanel: (id: string) => PanelState | undefined
  /** Set panel visibility */
  setVisibility: (id: string, visibility: PanelVisibility) => void
}

const FloatingPanelContext = createContext<FloatingPanelContextValue | null>(null)

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

  // Sensors with activation constraints (mouse + touch only)
  // KeyboardSensor removed: was intercepting Enter from input elements
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  )

  // =============================================================================
  // Restore from persistence on mount
  // =============================================================================

  useEffect(() => {
    if (disablePersistence) return

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const storage = JSON.parse(stored) as PanelStorage
        restorePersistedState(storage)
      }
    } catch {
      // Ignore parse errors
    }
  }, [disablePersistence])

  // =============================================================================
  // Persist on changes
  // =============================================================================

  useEffect(() => {
    if (disablePersistence) return

    const disposer = stx.subscribe(() => {
      const panels = stx.data.panels.get()
      const zOrder = stx.data.zOrder.get()

      const storage: PanelStorage = {
        panels: {},
        order: zOrder,
        version: 1,
      }

      panels.forEach((panel, id) => {
        storage.panels[id] = {
          position: panel.position,
          dimensions: panel.dimensions,
          visibility: panel.visibility,
          mode: panel.mode,
        }
      })

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(storage))
      } catch {
        // Storage full or unavailable
      }
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
      const id = event.active.id as string
      const panel = stxGetPanel(id)

      if (panel) {
        // PANEL DRAG: bring to front, set dragging state, blur effect
        bringPanelToFront(id)
        setDragging(id, true)
        stx.send?.({ type: 'START_DRAG', panelId: id, position: { x: 0, y: 0 } })
      } else {
        // SORTABLE DRAG: delegate to callback
        onSortableDragStart?.(event)
      }
    },
    [stx, onSortableDragStart]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const id = event.active.id as string
      const panel = stxGetPanel(id)

      if (panel) {
        // PANEL DRAG: update position, clear dragging state
        const { delta } = event
        const newPosition: Position = {
          x: panel.position.x + delta.x,
          y: panel.position.y + delta.y,
        }
        updatePanelPosition(id, newPosition)
        setDragging(id, false)
        stx.send?.({ type: 'END_DRAG' })
      } else {
        // SORTABLE DRAG: delegate to callback
        onSortableDragEnd?.(event)
      }
    },
    [stx, onSortableDragEnd]
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
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {children}
      </DndContext>
    </FloatingPanelContext.Provider>
  )
}

// =============================================================================
// Hooks
// =============================================================================

export function useFloatingPanelContext(): FloatingPanelContextValue {
  const context = useContext(FloatingPanelContext)
  if (!context) {
    throw new Error(
      'useFloatingPanelContext must be used within a FloatingPanelProvider'
    )
  }
  return context
}

/**
 * Hook to access floating panel state and operations
 */
export function useFloatingPanel(): UseFloatingPanelReturn {
  const context = useFloatingPanelContext()
  const stx = getFloatingStx()

  // Subscribe to panels from stx
  const panelsMap = useSelector(stx.data.panels, (p) => p)
  const zOrder = useSelector(stx.data.zOrder, (z) => z)
  const activePanel = useSelector(stx.data.activePanel, (a) => a)
  const modifierKeys = useSelector(stx.data.modifierKeys, (m) => m)

  // Sort panels by z-order
  const panels = useMemo(() => {
    return zOrder
      .map((id) => panelsMap.get(id))
      .filter((p): p is PanelState => p !== undefined)
  }, [panelsMap, zOrder])

  // Calculate resize sensitivity
  const resizeSensitivity = useMemo(() => {
    if (modifierKeys.ctrl && modifierKeys.shift) return 0.01
    if (modifierKeys.shift) return 0.1
    return 1.0
  }, [modifierKeys])

  return {
    panels,
    activePanelId: activePanel,
    registerPanel: context.registerPanel,
    unregisterPanel: context.unregisterPanel,
    updatePosition: context.updatePosition,
    updateDimensions: context.updateDimensions,
    bringToFront: context.bringToFront,
    sendToBack: context.sendToBack,
    closePanel: context.closePanel,
    toggleMode: context.toggleMode,
    resizeSensitivity,
  }
}

// Legacy hook for backwards compat
export { useFloatingPanel as usePanelPersistence }

export default FloatingPanelProvider
