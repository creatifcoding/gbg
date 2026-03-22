/**
 * useGeointFloatingPanel Hook
 *
 * Floating panel state management for Focus mode.
 * Provides reactive access to panel position, size, visibility.
 *
 * @module geoint/hooks/useGeointFloatingPanel
 */

import { useCallback, useMemo, useEffect, useRef } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import {
  type FloatingPanelId,
  type FloatingPanelPosition,
  type FloatingPanelSize,
  floatingPanelsAtom,
  activePanelAtom,
  maxPanelZIndexAtom,
  updateFloatingPanelPosition,
  updateFloatingPanelSize,
  toggleFloatingPanel,
  toggleFloatingPanelMinimize,
  bringPanelToFront,
} from '../atoms/layoutAtoms'
import { geointRegistry } from '../atoms'
import type { LayoutMachineRef } from '../machines/layoutMachine'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UseGeointFloatingPanelResult {
  readonly id: FloatingPanelId
  readonly visible: boolean
  readonly minimized: boolean
  readonly position: FloatingPanelPosition
  readonly size: FloatingPanelSize
  readonly zIndex: number
  readonly isActive: boolean

  readonly show: () => void
  readonly hide: () => void
  readonly toggle: () => void
  readonly minimize: () => void
  readonly restore: () => void
  readonly toggleMinimize: () => void
  readonly move: (position: FloatingPanelPosition) => void
  readonly resize: (size: Partial<FloatingPanelSize>) => void
  readonly focus: () => void
}

export interface UseGeointFloatingPanelsResult {
  readonly panels: Record<FloatingPanelId, UseGeointFloatingPanelResult>
  readonly activePanel: FloatingPanelId | null
  readonly visiblePanels: readonly FloatingPanelId[]

  readonly showAll: () => void
  readonly hideAll: () => void
  readonly minimizeAll: () => void
  readonly restoreAll: () => void
}

export interface UseGeointFloatingPanelOptions {
  readonly machineRef?: LayoutMachineRef
}

// ─────────────────────────────────────────────────────────────────────────────
// Single Panel Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook for a single floating panel.
 *
 * @example
 * ```tsx
 * function LayersPanel() {
 *   const panel = useGeointFloatingPanel('layers')
 *
 *   if (!panel.visible) return null
 *
 *   return (
 *     <FloatingPanel
 *       style={{
 *         position: 'absolute',
 *         left: panel.position.x,
 *         top: panel.position.y,
 *         width: panel.size.width,
 *         height: panel.minimized ? 32 : panel.size.height,
 *         zIndex: panel.zIndex,
 *       }}
 *       onMouseDown={panel.focus}
 *     >
 *       <PanelHeader>
 *         <button onClick={panel.toggleMinimize}>
 *           {panel.minimized ? '▼' : '▲'}
 *         </button>
 *         <button onClick={panel.hide}>×</button>
 *       </PanelHeader>
 *       {!panel.minimized && <PanelContent />}
 *     </FloatingPanel>
 *   )
 * }
 * ```
 */
export function useGeointFloatingPanel(
  id: FloatingPanelId,
  options?: UseGeointFloatingPanelOptions
): UseGeointFloatingPanelResult {
  const { machineRef } = options ?? {}

  const panels = useAtomValue(floatingPanelsAtom)
  const activePanel = useAtomValue(activePanelAtom)
  const panel = panels[id]

  const syncToMachine = useRef(false)

  // Bidirectional sync for this panel
  useEffect(() => {
    if (!machineRef) return

    const unsubscribe = geointRegistry.subscribe(floatingPanelsAtom, (newPanels) => {
      if (syncToMachine.current) {
        syncToMachine.current = false
        return
      }

      const newPanel = newPanels[id]
      const machinePanel = machineRef.getSnapshot().context.floatingPanels[id]

      if (!newPanel || !machinePanel) return

      // Sync visibility changes
      if (newPanel.visible !== machinePanel.visible) {
        machineRef.send({ type: 'TOGGLE_PANEL_VISIBILITY', id })
      }
      // Sync minimize changes
      if (newPanel.minimized !== machinePanel.minimized) {
        machineRef.send({ type: 'TOGGLE_PANEL_MINIMIZE', id })
      }
      // Sync position changes
      if (
        newPanel.position.x !== machinePanel.position.x ||
        newPanel.position.y !== machinePanel.position.y
      ) {
        machineRef.send({ type: 'MOVE_PANEL', id, position: newPanel.position })
      }
      // Sync size changes
      if (
        newPanel.size.width !== machinePanel.size.width ||
        newPanel.size.height !== machinePanel.size.height
      ) {
        machineRef.send({ type: 'RESIZE_PANEL', id, size: newPanel.size })
      }
    })

    return unsubscribe
  }, [machineRef, id])

  const show = useCallback(() => {
    if (machineRef) {
      syncToMachine.current = true
      if (!panel.visible) {
        machineRef.send({ type: 'TOGGLE_PANEL_VISIBILITY', id })
      }
    } else {
      const current = geointRegistry.get(floatingPanelsAtom)
      if (!current[id].visible) {
        geointRegistry.set(floatingPanelsAtom, {
          ...current,
          [id]: { ...current[id], visible: true },
        })
      }
    }
  }, [machineRef, id, panel.visible])

  const hide = useCallback(() => {
    if (machineRef) {
      syncToMachine.current = true
      if (panel.visible) {
        machineRef.send({ type: 'TOGGLE_PANEL_VISIBILITY', id })
      }
    } else {
      const current = geointRegistry.get(floatingPanelsAtom)
      if (current[id].visible) {
        geointRegistry.set(floatingPanelsAtom, {
          ...current,
          [id]: { ...current[id], visible: false },
        })
      }
    }
  }, [machineRef, id, panel.visible])

  const toggle = useCallback(() => {
    if (machineRef) {
      syncToMachine.current = true
      machineRef.send({ type: 'TOGGLE_PANEL_VISIBILITY', id })
    } else {
      toggleFloatingPanel(id)
    }
  }, [machineRef, id])

  const minimize = useCallback(() => {
    if (machineRef) {
      syncToMachine.current = true
      if (!panel.minimized) {
        machineRef.send({ type: 'TOGGLE_PANEL_MINIMIZE', id })
      }
    } else {
      const current = geointRegistry.get(floatingPanelsAtom)
      if (!current[id].minimized) {
        geointRegistry.set(floatingPanelsAtom, {
          ...current,
          [id]: { ...current[id], minimized: true },
        })
      }
    }
  }, [machineRef, id, panel.minimized])

  const restore = useCallback(() => {
    if (machineRef) {
      syncToMachine.current = true
      if (panel.minimized) {
        machineRef.send({ type: 'TOGGLE_PANEL_MINIMIZE', id })
      }
    } else {
      const current = geointRegistry.get(floatingPanelsAtom)
      if (current[id].minimized) {
        geointRegistry.set(floatingPanelsAtom, {
          ...current,
          [id]: { ...current[id], minimized: false },
        })
      }
    }
  }, [machineRef, id, panel.minimized])

  const toggleMinimizeAction = useCallback(() => {
    if (machineRef) {
      syncToMachine.current = true
      machineRef.send({ type: 'TOGGLE_PANEL_MINIMIZE', id })
    } else {
      toggleFloatingPanelMinimize(id)
    }
  }, [machineRef, id])

  const move = useCallback(
    (position: FloatingPanelPosition) => {
      if (machineRef) {
        syncToMachine.current = true
        machineRef.send({ type: 'MOVE_PANEL', id, position })
      } else {
        updateFloatingPanelPosition(id, position)
      }
    },
    [machineRef, id]
  )

  const resize = useCallback(
    (size: Partial<FloatingPanelSize>) => {
      if (machineRef) {
        syncToMachine.current = true
        machineRef.send({ type: 'RESIZE_PANEL', id, size })
      } else {
        updateFloatingPanelSize(id, size)
      }
    },
    [machineRef, id]
  )

  const focus = useCallback(() => {
    if (machineRef) {
      syncToMachine.current = true
      machineRef.send({ type: 'BRING_PANEL_TO_FRONT', id })
    } else {
      bringPanelToFront(id)
    }
  }, [machineRef, id])

  return useMemo(
    () => ({
      id,
      visible: panel.visible,
      minimized: panel.minimized,
      position: panel.position,
      size: panel.size,
      zIndex: panel.zIndex,
      isActive: activePanel === id,
      show,
      hide,
      toggle,
      minimize,
      restore,
      toggleMinimize: toggleMinimizeAction,
      move,
      resize,
      focus,
    }),
    [
      id,
      panel,
      activePanel,
      show,
      hide,
      toggle,
      minimize,
      restore,
      toggleMinimizeAction,
      move,
      resize,
      focus,
    ]
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// All Panels Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook for all floating panels.
 *
 * @example
 * ```tsx
 * function FocusMode() {
 *   const { panels, visiblePanels } = useGeointFloatingPanels()
 *
 *   return (
 *     <>
 *       {visiblePanels.map((id) => (
 *         <FloatingPanel key={id} {...panels[id]} />
 *       ))}
 *     </>
 *   )
 * }
 * ```
 */
export function useGeointFloatingPanels(
  options?: UseGeointFloatingPanelOptions
): UseGeointFloatingPanelsResult {
  const layersPanel = useGeointFloatingPanel('layers', options)
  const entityPanel = useGeointFloatingPanel('entity', options)
  const timelinePanel = useGeointFloatingPanel('timeline', options)
  const searchPanel = useGeointFloatingPanel('search', options)

  const activePanel = useAtomValue(activePanelAtom)

  const panels = useMemo(
    () => ({
      layers: layersPanel,
      entity: entityPanel,
      timeline: timelinePanel,
      search: searchPanel,
    }),
    [layersPanel, entityPanel, timelinePanel, searchPanel]
  )

  const visiblePanels = useMemo(
    () =>
      (['layers', 'entity', 'timeline', 'search'] as FloatingPanelId[]).filter(
        (id) => panels[id].visible
      ),
    [panels]
  )

  const showAll = useCallback(() => {
    layersPanel.show()
    entityPanel.show()
    timelinePanel.show()
    searchPanel.show()
  }, [layersPanel, entityPanel, timelinePanel, searchPanel])

  const hideAll = useCallback(() => {
    layersPanel.hide()
    entityPanel.hide()
    timelinePanel.hide()
    searchPanel.hide()
  }, [layersPanel, entityPanel, timelinePanel, searchPanel])

  const minimizeAll = useCallback(() => {
    layersPanel.minimize()
    entityPanel.minimize()
    timelinePanel.minimize()
    searchPanel.minimize()
  }, [layersPanel, entityPanel, timelinePanel, searchPanel])

  const restoreAll = useCallback(() => {
    layersPanel.restore()
    entityPanel.restore()
    timelinePanel.restore()
    searchPanel.restore()
  }, [layersPanel, entityPanel, timelinePanel, searchPanel])

  return useMemo(
    () => ({
      panels,
      activePanel,
      visiblePanels,
      showAll,
      hideAll,
      minimizeAll,
      restoreAll,
    }),
    [panels, activePanel, visiblePanels, showAll, hideAll, minimizeAll, restoreAll]
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight Variants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook for just the active panel ID.
 */
export function useGeointActivePanel(): FloatingPanelId | null {
  return useAtomValue(activePanelAtom)
}

/**
 * Hook for max z-index (for new panels).
 */
export function useGeointMaxPanelZIndex(): number {
  return useAtomValue(maxPanelZIndexAtom)
}
