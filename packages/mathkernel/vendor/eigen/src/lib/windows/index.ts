/**
 * Window System - Emacs-Inspired Pane Management
 *
 * Split panes, navigate between them, render different routes.
 * Uses Emacs-style hotkeys (C-x 2, C-x 3, C-x o, etc.)
 *
 * @module lib/windows
 */

// Schemas
export {
  type PaneId,
  type PaneNode,
  type ContentPane,
  type SplitPane,
  type SplitDirection,
  isContentPane,
  isSplitPane,
  createContentPane,
  createSplitPane,
  generatePaneId,
  findPane,
  getAllContentPanes,
  replacePane,
  removePane,
  getNextPane,
  getPrevPane,
} from './schemas'

// Atoms
export {
  rootPaneAtom,
  focusedPaneIdAtom,
  allPanesAtom,
  paneCountAtom,
  focusedPaneAtom,
  focusedRouteAtom,
  splitHorizontalOp,
  splitVerticalOp,
  nextPaneOp,
  prevPaneOp,
  closePaneOp,
  closeOtherPanesOp,
  setFocusedRouteOp,
  focusPaneOp,
  resizeSplitOp,
  windowActions,
} from './atoms'

// Components
export {
  WindowManager,
  WindowProvider,
  RoutePane,
  renderRoutePane,
  registerPaneRoute,
} from './components'

// Hotkeys
export { registerWindowHotkeys, unregisterWindowHotkeys, WINDOW_COMMANDS } from './hotkeys'
