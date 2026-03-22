/**
 * useFloatingPanel Hook v2
 *
 * Hook for accessing floating panel state and operations via stx.
 * Uses Legend-State useSelector for reactive subscriptions.
 *
 * @pattern stx consumer hook
 * @module
 */

import { useMemo, useCallback } from 'react'
import { useSelector } from '@/lib/stx'
import {
  getFloatingStx,
  registerPanel as stxRegisterPanel,
  unregisterPanel as stxUnregisterPanel,
  updatePanelPosition,
  updatePanelDimensions,
  bringPanelToFront,
  sendPanelToBack,
  setPanelVisibility,
  closePanel as stxClosePanel,
  togglePanelMode,
  getPanel,
} from '../floating-stx'
import type {
  PanelState,
  PanelConfig,
  Position,
  Dimensions,
  PanelVisibility,
  UseFloatingPanelReturn,
} from '../types'

// =============================================================================
// Main Hook
// =============================================================================

/**
 * Hook for consuming floating panel state and actions.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { panels, registerPanel, bringToFront, resizeSensitivity } = useFloatingPanel()
 *
 *   useEffect(() => {
 *     registerPanel({
 *       id: 'my-panel',
 *       title: 'Settings',
 *       initialPosition: { x: 100, y: 100 },
 *     })
 *   }, [])
 *
 *   return (
 *     <button onClick={() => bringToFront('my-panel')}>
 *       Focus Settings
 *     </button>
 *   )
 * }
 * ```
 */
export function useFloatingPanel(): UseFloatingPanelReturn {
  const stx = getFloatingStx()

  // Subscribe to state from stx (function-form selectors for correct unwrapping)
  const panelsMap = useSelector(() => stx.data.panels.get())
  const zOrder = useSelector(() => stx.data.zOrder.get())
  const activePanel = useSelector(() => stx.data.activePanel.get())
  const modifierKeys = useSelector(() => stx.data.modifierKeys.get())

  // Sort panels by z-order
  const panels = useMemo(() => {
    return zOrder
      .map((id) => panelsMap.get(id))
      .filter((p): p is PanelState => p !== undefined)
  }, [panelsMap, zOrder])

  // Calculate resize sensitivity based on modifier keys
  const resizeSensitivity = useMemo(() => {
    if (modifierKeys.ctrl && modifierKeys.shift) return 0.01
    if (modifierKeys.shift) return 0.1
    return 1.0
  }, [modifierKeys])

  // Memoized actions
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

  return {
    panels,
    activePanelId: activePanel,
    registerPanel,
    unregisterPanel,
    updatePosition,
    updateDimensions,
    bringToFront,
    sendToBack,
    closePanel,
    toggleMode,
    resizeSensitivity,
  }
}

// =============================================================================
// Panel-specific Hook
// =============================================================================

/**
 * Hook for a specific panel by ID.
 *
 * @example
 * ```tsx
 * function PanelControls({ panelId }: { panelId: string }) {
 *   const { panel, bringToFront, close, toggleMode } = usePanelById(panelId)
 *
 *   if (!panel) return null
 *
 *   return (
 *     <div>
 *       <span>{panel.title} ({panel.mode})</span>
 *       <button onClick={bringToFront}>Focus</button>
 *       <button onClick={toggleMode}>
 *         {panel.mode === 'floating' ? 'Dock' : 'Float'}
 *       </button>
 *       <button onClick={close}>Close</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function usePanelById(panelId: string) {
  const stx = getFloatingStx()

  // Fine-grained: subscribe to THIS panel only (not entire Map)
  const panel = useSelector(() => stx.data.panels.get(panelId)?.get()) as PanelState | undefined
  const activePanel = useSelector(() => stx.data.activePanel.get())

  return useMemo(
    () => ({
      panel,
      isActive: activePanel === panelId,
      bringToFront: () => bringPanelToFront(panelId),
      sendToBack: () => sendPanelToBack(panelId),
      close: () => stxClosePanel(panelId),
      setVisibility: (visibility: PanelVisibility) =>
        setPanelVisibility(panelId, visibility),
      toggleMode: () => togglePanelMode(panelId),
      updatePosition: (position: Position) =>
        updatePanelPosition(panelId, position),
      updateDimensions: (dimensions: Dimensions) =>
        updatePanelDimensions(panelId, dimensions),
    }),
    [panel, activePanel, panelId]
  )
}

export default useFloatingPanel
