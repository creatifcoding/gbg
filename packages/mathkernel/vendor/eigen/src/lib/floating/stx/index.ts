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
  // Panel Tree — tiled layout (SM Migration §14)
  getPanelTree,
  setPanelTree,
  addToTree,
  removeFromPanelTree,
  updateSplitRatio,
  movePanelSeparator,
  setFocusedPanel,
  moveFocusInDirection,
  getTiledPanelIds,
  setPanelCollapsed,
  togglePanelCollapsed,
  setPanelAccent,
  togglePanelHeader,
  stashFloatsToEdges,
  unstashFloats,
  // Tab management
  addTab,
  removeTab,
  setActiveTab,
  // Mode transitions (float ↔ tile)
  floatPanel,
  tilePanel,
  dockToEdge,
  dockToInnerEdge,
  // Split & Close (keyboard-driven panel management)
  splitPanelInDirection,
  closePanelFull,
  // Spawn (content registry integration)
  spawnPanel,
} from './actions'

// ── Strip mutations (Niri flat column model) ────────────────────────────────
export {
  // Read
  peekStrip,
  getFocusedColumn,
  getFocusedPanelId,
  findColumnIndex,
  getColumnCount,
  // Insert
  insertColumn,
  insertColumns,
  // Remove
  removeColumnAt,
  removeColumn,
  removeFocusedColumn,
  // Swap
  swapColumns,
  swapFocusedLeft,
  swapFocusedRight,
  // Move
  moveColumn,
  // Focus
  setFocusedIndex,
  focusLeft,
  focusRight,
  focusPanelInStrip,
  // Width
  cycleColumnWidth,
  cycleFocusedWidth,
  setColumnWidth,
  // Stack
  pushTreeColumn,
  popColumn,
  // Collapse
  toggleColumnCollapsed,
  toggleFocusedCollapsed,
  setColumnCollapsed,
  // Column tree ops
  splitInColumn,
  removeFromColumnTree,
  normalizeStrip,
  // Scroll
  setScrollOffset,
  // Bulk
  setStrip,
  clearStrip,
  // Types
  type InsertPosition,
} from './strip'
