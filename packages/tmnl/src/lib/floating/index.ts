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
  minimizePanel,
  restoreFromMinimize,
  // Snap-to-grid configuration
  setGridSize,
  toggleSnap,
  setSnapEnabled,
} from './floating-stx'

// =============================================================================
// Provider
// =============================================================================

export {
  FloatingPanelProvider,
  useFloatingPanel,
  type FloatingPanelProviderProps,
} from './FloatingPanelProvider'
export { useFloatingPanelContext } from './context/FloatingPanelContext'

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
} from './context/FloatingDimensionContext'

// =============================================================================
// Hooks
// =============================================================================

export { useResize, type UseResizeOptions } from './hooks/useResize'

// =============================================================================
// Position Utilities
// =============================================================================

export {
  cascadePosition,
  findOpenSlot,
  snapToGrid,
  staggerOffset,
  clampToViewport,
  applyMagneticSnap,
  type Viewport,
  type PanelRect,
  type MagneticSnapOptions,
} from './utils/position'
export { usePanelById } from './hooks/useFloatingPanel'

// =============================================================================
// Dock Module
// =============================================================================

export {
  type DockZone,
  DOCK_THRESHOLD,
  approx,
  classifyDockZone,
  dockZoneLabel,
  resolveDockLayout,
} from './dock'

// =============================================================================
// Tokens
// =============================================================================

export { PANEL } from './tokens'

// =============================================================================
// Compound Components
// =============================================================================

export { PanelHeader, type PanelHeaderProps } from './components/PanelHeader'
export { PanelContent, type PanelContentProps } from './components/PanelContent'
export { DragGuideOverlay, type DragGuideOverlayProps } from './components/DragGuideOverlay'
export { ChromeBtn, type ChromeBtnProps } from './components/ChromeBtn'

// Atomic compound components
export {
  PanelTitle,
  PanelTabClose,
  PanelTitleTab,
  PanelModeToggle,
  PanelMaxToggle,
  PanelMinimize,
  PanelControls,
  PanelResize,
} from './components/atoms'

// Collapsed strip (minimize → horizontal stack)
export { CollapsedStrip, type CollapsedStripProps, STRIP_HEIGHT, STRIP_GAP, STRIP_BOTTOM_OFFSET } from './components/CollapsedStrip'
export { CollapsedStripStack } from './components/CollapsedStripStack'

// Accordion sub-panels (panel-hosting-panels)
export { AccordionPanel, type AccordionPanelProps, type AccordionSectionProps } from './components/AccordionPanel'

// Per-panel context
export {
  PanelContext,
  usePanelContext,
  type PanelContextValue,
  type PanelContextState,
  type PanelContextActions,
  type PanelContextMeta,
} from './context/PanelContext'

// Panel state hook
export { usePanelState } from './hooks/usePanelState'

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

// =============================================================================
// Panel Registry
// =============================================================================

export {
  PanelRegistryProvider,
  usePanelRegistry,
  registerPanelType,
  unregisterPanelType,
  getPanelEntry,
  getAllPanelEntries,
  openRegisteredPanel,
  getPanelProps,
  clearPanelProps,
  PanelContentRenderer,
  type PanelRegistryEntry,
} from './PanelRegistry'

// =============================================================================
// Bounds Context (for constraining panels to a container)
// =============================================================================

export {
  FloatingBoundsProvider,
  useFloatingBounds,
  getBounds,
  clampPosition,
  clampDimensions,
  clampResize,
  Bounds,
  type FloatingBoundsProviderProps,
} from './context/FloatingBoundsContext'
