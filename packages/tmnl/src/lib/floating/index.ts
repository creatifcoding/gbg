/**
 * Floating Panel System v2
 *
 * stx-powered draggable, resizable floating panels.
 *
 * Key features:
 * - stx backbone (Legend-State + XState + Effect)
 * - 8-direction resize handles
 * - Modifier key precision (Shift=0.1x, Ctrl+Shift=0.01x)
 * - Dock/undock toggle (button + double-click)
 * - CSS container queries + dimension context
 * - Position/size persistence
 *
 * @example
 * ```tsx
 * import {
 *   FloatingPanelProvider,
 *   FloatingPanel,
 *   FloatingDragOverlay,
 *   useFloatingPanel,
 * } from '@/lib/floating'
 *
 * function App() {
 *   return (
 *     <FloatingPanelProvider>
 *       <FloatingPanel id="settings" title="Settings">
 *         <SettingsContent />
 *       </FloatingPanel>
 *       <FloatingDragOverlay style="ghost" />
 *     </FloatingPanelProvider>
 *   )
 * }
 * ```
 *
 * @module
 */

// =============================================================================
// STX Instance
// =============================================================================

export {
  getFloatingStx,
  resetFloatingStx,
  disposeFloatingStx,
  // Direct operations
  registerPanel,
  unregisterPanel,
  updatePanelPosition,
  updatePanelDimensions,
  bringPanelToFront,
  sendPanelToBack,
  setPanelVisibility,
  closePanel,
  togglePanelMode,
  updateModifierKeys,
  setDragging,
  setResizing,
  getPanel,
  restorePersistedState,
  maximizePanel,
  restorePanel,
} from './floating-stx'

// =============================================================================
// Provider
// =============================================================================

export {
  FloatingPanelProvider,
  useFloatingPanelContext,
  useFloatingPanel,
  type FloatingPanelProviderProps,
} from './FloatingPanelProvider'

// =============================================================================
// Components
// =============================================================================

export { FloatingPanel, type FloatingPanelProps } from './FloatingPanel'
export { withDraggable, type DraggableConfig, type DraggableProps } from './withDraggable'
export { FloatingDragOverlay, type FloatingDragOverlayProps } from './FloatingDragOverlay'
export { ResizeHandles } from './ResizeHandles'
export {
  FloatingDimensionProvider,
  useFloatingDimensions,
  FloatingDimensionContext,
} from './FloatingDimensionContext'

// =============================================================================
// Hooks
// =============================================================================

export { useResize, type UseResizeOptions } from './hooks/useResize'
export { usePanelPersistence } from './hooks/usePanelPersistence'
export { usePanelById } from './hooks/useFloatingPanel'

// =============================================================================
// Types (Schema-based)
// =============================================================================

export {
  // Schemas
  Position,
  Dimensions,
  DimensionConstraints,
  PanelMode,
  PanelVisibility,
  ResizeEdge,
  PanelState,
  PanelConfig,
  PersistedPanelState,
  PanelStorage,
  ModifierKeys,
  // Interfaces
  type FloatingStxData,
  type PanelMachineContext,
  type PanelMachineEvent,
  type UseFloatingPanelReturn,
  type UseResizeReturn,
  type UseFloatingDimensionsReturn,
} from './types'

// =============================================================================
// Machine
// =============================================================================

export { panelMachine, type PanelMachine } from './machines/panel-machine'
