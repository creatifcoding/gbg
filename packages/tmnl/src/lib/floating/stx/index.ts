/**
 * Floating STX barrel
 *
 * Re-exports everything from the decomposed stx modules.
 * Consumers import from here (or from the parent floating/index.ts barrel).
 *
 * @module
 */

// Instance lifecycle
export { getFloatingStx, resetFloatingStx, disposeFloatingStx } from './instance'

// Type
export type { FloatingStx } from './initial'

// Constants
export { STORAGE_KEY, DEFAULT_WIDTH, DEFAULT_HEIGHT, BASE_Z_INDEX, MAXIMIZED_Z_INDEX, WORKSPACE_CHROME_Z_INDEX } from './constants'

// Effects & Computed (for advanced consumers / testing)
export { floatingEffects } from './effects'
export { floatingComputed } from './computed'

// Actions — panel mutations
export {
  registerPanel,
  unregisterPanel,
  closePanel,
  getPanel,
  updatePanelPosition,
  updatePanelDimensions,
  bringPanelToFront,
  sendPanelToBack,
  setPanelVisibility,
  togglePanelMode,
  updateModifierKeys,
  setDragging,
  setResizing,
  setGridSize,
  toggleSnap,
  setSnapEnabled,
  restorePersistedState,
  maximizePanel,
  restorePanel,
  minimizePanel,
  restoreFromMinimize,
} from './actions'
