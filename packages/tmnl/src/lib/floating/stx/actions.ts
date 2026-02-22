/**
 * Floating STX actions — re-export barrel (decomposed).
 *
 * Original monolith decomposed into:
 *   helpers.ts    — internal utilities (reassignZIndices, getViewport, getMaxBounds)
 *   crud.ts       — registerPanel, unregisterPanel, closePanel, getPanel
 *   z-order.ts    — bringPanelToFront, sendPanelToBack, updatePanelPosition, updatePanelDimensions
 *   visibility.ts — visibility, minimize, maximize, stash, persist, header, mode toggle
 *   interaction.ts— drag/resize flags, modifiers, snap/grid, tabs
 *   tiling.ts     — tree ops, float↔tile transitions, docking, focus, collapse, accent
 *   spawn.ts      — spawnPanel, splitPanelInDirection, closePanelFull
 *
 * @module floating/stx/actions
 */

// ── CRUD ────────────────────────────────────────────────────────────────────
export {
  registerPanel,
  unregisterPanel,
  closePanel,
  getPanel,
} from './crud'

// ── Z-Order & Position ─────────────────────────────────────────────────────
export {
  bringPanelToFront,
  sendPanelToBack,
  updatePanelPosition,
  updatePanelDimensions,
} from './z-order'

// ── Visibility, Mode, Max/Min, Stash, Persist ──────────────────────────────
export {
  setPanelVisibility,
  minimizePanel,
  restoreFromMinimize,
  togglePanelMode,
  maximizePanel,
  restorePanel,
  stashFloatsToEdges,
  unstashFloats,
  togglePanelHeader,
  restorePersistedState,
} from './visibility'

// ── Interaction State ──────────────────────────────────────────────────────
export {
  updateModifierKeys,
  setDragging,
  setResizing,
  setGridSize,
  toggleSnap,
  setSnapEnabled,
  nestPanelAsTab,
  liftTabOut,
  transferTab,
  addTab,
  removeTab,
  setActiveTab,
  reorderTabs,
} from './interaction'

// ── Tiling (tree, float↔tile, dock, focus, collapse, accent) ──────────────
export {
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
  floatPanel,
  tilePanel,
  dockToEdge,
  dockToInnerEdge,
} from './tiling'

// ── Spawn & Close ──────────────────────────────────────────────────────────
export {
  splitPanelInDirection,
  closePanelFull,
  spawnPanel,
} from './spawn'

// ── Strip (Niri flat column model) ─────────────────────────────────────────
export {
  peekStrip,
  getFocusedColumn,
  getFocusedPanelId,
  findColumnIndex,
  getColumnCount,
  insertColumn,
  insertColumns,
  removeColumnAt,
  removeColumn,
  removeFocusedColumn,
  swapColumns,
  swapFocusedLeft,
  swapFocusedRight,
  moveColumn,
  setFocusedIndex,
  focusLeft,
  focusRight,
  focusPanelInStrip,
  cycleColumnWidth,
  cycleFocusedWidth,
  setColumnWidth,

  toggleColumnCollapsed,
  toggleFocusedCollapsed,
  setColumnCollapsed,
  pushTreeColumn,
  popColumn,
  splitInColumn,
  removeFromColumnTree,
  setScrollOffset,
  setStrip,
  clearStrip,
  type InsertPosition,
} from './strip'
