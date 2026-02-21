/**
 * Floating Panel STX — re-export shim
 *
 * The stx logic has been decomposed into stx/ subdirectory:
 *   stx/constants.ts  — STORAGE_KEY, DEFAULT_WIDTH, etc.
 *   stx/initial.ts    — initialData, FloatingStx type
 *   stx/effects.ts    — Effect programs (persist, restore, spawnFromModal)
 *   stx/computed.ts   — Derived selectors (sorted, top, active, sensitivity)
 *   stx/instance.ts   — Singleton get/reset/dispose
 *   stx/actions.ts    — All 20 mutation functions
 *
 * This file re-exports everything for backward compatibility.
 * New code should import from './stx' or './stx/actions' directly.
 *
 * @module
 */

export {
  // Instance lifecycle
  getFloatingStx,
  resetFloatingStx,
  disposeFloatingStx,
  // Type
  type FloatingStx,
  // Constants
  STORAGE_KEY,
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  BASE_Z_INDEX,
  // Effects & Computed
  floatingEffects,
  floatingComputed,
  // Actions
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
} from './stx'
