/**
 * Window Atoms - Emacs-Inspired Pane State
 *
 * Atom-as-State pattern for window/pane management.
 * Uses overlayRegistry for synchronous React operations.
 *
 * @module lib/windows/atoms
 */

import { Atom } from '@effect-atom/atom-react'
import { Effect } from 'effect'
import { overlayRegistry } from '@/lib/overlays'
import type { PaneId, PaneNode, ContentPane, SplitDirection } from '../schemas'
import {
  createContentPane,
  createSplitPane,
  getAllContentPanes,
  getNextPane,
  getPrevPane,
  replacePane,
  removePane,
  findPane,
  isContentPane,
  isSplitPane,
} from '../schemas'

// =============================================================================
// Core State Atoms
// =============================================================================

/** Root pane tree - defaults to single pane showing home */
export const rootPaneAtom = Atom.make<PaneNode>(createContentPane('/'))

/** Currently focused pane ID */
export const focusedPaneIdAtom = Atom.make<PaneId | null>(null)

// =============================================================================
// Registry Initialization
// =============================================================================

// Initialize atoms in overlayRegistry with current URL path (sync with browser)
// This ensures navigating directly to a route (e.g., /testbed/geoint)
// shows the correct component instead of always defaulting to home
const getInitialRoute = (): string => {
  if (typeof window !== 'undefined') {
    return window.location.pathname || '/'
  }
  return '/'
}

const initialRoute = getInitialRoute()
const initialRoot = createContentPane(initialRoute)
overlayRegistry.set(rootPaneAtom, initialRoot)
overlayRegistry.set(focusedPaneIdAtom, initialRoot.id)

// =============================================================================
// Derived Atoms
// =============================================================================

/** All content panes in order */
export const allPanesAtom = Atom.make((get) => {
  const root = get(rootPaneAtom)
  return getAllContentPanes(root)
})

/** Number of panes */
export const paneCountAtom = Atom.make((get) => {
  return get(allPanesAtom).length
})

/** Currently focused pane */
export const focusedPaneAtom = Atom.make((get) => {
  const root = get(rootPaneAtom)
  const focusedId = get(focusedPaneIdAtom)
  if (!focusedId) return null
  const pane = findPane(root, focusedId)
  return pane && isContentPane(pane) ? pane : null
})

/** Route of focused pane */
export const focusedRouteAtom = Atom.make((get) => {
  const pane = get(focusedPaneAtom)
  return pane?.route ?? '/'
})

// =============================================================================
// Effect Operations
// =============================================================================

/**
 * Split the focused pane horizontally (C-x 2)
 * Creates a new pane below the current one
 */
export const splitHorizontalOp: Effect.Effect<void> = Effect.sync(() => {
  const root = overlayRegistry.get(rootPaneAtom)
  const focusedId = overlayRegistry.get(focusedPaneIdAtom)
  if (!focusedId) return

  const focused = findPane(root, focusedId)
  if (!focused || !isContentPane(focused)) return

  // Create new pane with same route
  const newPane = createContentPane(focused.route)

  // Create split with focused on top, new on bottom
  const split = createSplitPane('horizontal', focused, newPane)

  // Replace focused pane with split
  const newRoot = replacePane(root, focusedId, split)
  overlayRegistry.set(rootPaneAtom, newRoot)

  // Focus the new pane
  overlayRegistry.set(focusedPaneIdAtom, newPane.id)
})

/**
 * Split the focused pane vertically (C-x 3)
 * Creates a new pane to the right of the current one
 */
export const splitVerticalOp: Effect.Effect<void> = Effect.sync(() => {
  const root = overlayRegistry.get(rootPaneAtom)
  const focusedId = overlayRegistry.get(focusedPaneIdAtom)
  if (!focusedId) return

  const focused = findPane(root, focusedId)
  if (!focused || !isContentPane(focused)) return

  // Create new pane with same route
  const newPane = createContentPane(focused.route)

  // Create split with focused on left, new on right
  const split = createSplitPane('vertical', focused, newPane)

  // Replace focused pane with split
  const newRoot = replacePane(root, focusedId, split)
  overlayRegistry.set(rootPaneAtom, newRoot)

  // Focus the new pane
  overlayRegistry.set(focusedPaneIdAtom, newPane.id)
})

/**
 * Navigate to next pane (C-x o)
 */
export const nextPaneOp: Effect.Effect<void> = Effect.sync(() => {
  const root = overlayRegistry.get(rootPaneAtom)
  const focusedId = overlayRegistry.get(focusedPaneIdAtom)
  if (!focusedId) return

  const nextPane = getNextPane(root, focusedId)
  if (nextPane) {
    overlayRegistry.set(focusedPaneIdAtom, nextPane.id)
  }
})

/**
 * Navigate to previous pane (C-x O or C-u C-x o)
 */
export const prevPaneOp: Effect.Effect<void> = Effect.sync(() => {
  const root = overlayRegistry.get(rootPaneAtom)
  const focusedId = overlayRegistry.get(focusedPaneIdAtom)
  if (!focusedId) return

  const prevPane = getPrevPane(root, focusedId)
  if (prevPane) {
    overlayRegistry.set(focusedPaneIdAtom, prevPane.id)
  }
})

/**
 * Close the focused pane (C-x 0)
 */
export const closePaneOp: Effect.Effect<void> = Effect.sync(() => {
  const root = overlayRegistry.get(rootPaneAtom)
  const focusedId = overlayRegistry.get(focusedPaneIdAtom)
  if (!focusedId) return

  const allPanes = getAllContentPanes(root)
  if (allPanes.length <= 1) {
    // Can't close the last pane
    return
  }

  // Get next pane before removing
  const nextPane = getNextPane(root, focusedId)
  const newRoot = removePane(root, focusedId)

  if (newRoot) {
    overlayRegistry.set(rootPaneAtom, newRoot)
    if (nextPane && nextPane.id !== focusedId) {
      overlayRegistry.set(focusedPaneIdAtom, nextPane.id)
    } else {
      // Focus first available pane
      const remaining = getAllContentPanes(newRoot)
      if (remaining[0]) {
        overlayRegistry.set(focusedPaneIdAtom, remaining[0].id)
      }
    }
  }
})

/**
 * Close all other panes, keep only focused (C-x 1)
 */
export const closeOtherPanesOp: Effect.Effect<void> = Effect.sync(() => {
  const focusedId = overlayRegistry.get(focusedPaneIdAtom)
  const root = overlayRegistry.get(rootPaneAtom)
  if (!focusedId) return

  const focused = findPane(root, focusedId)
  if (!focused || !isContentPane(focused)) return

  // Replace entire tree with just the focused pane
  overlayRegistry.set(rootPaneAtom, focused)
})

/**
 * Set the route for the focused pane
 */
export const setFocusedRouteOp = (route: string): Effect.Effect<void> =>
  Effect.sync(() => {
    const root = overlayRegistry.get(rootPaneAtom)
    const focusedId = overlayRegistry.get(focusedPaneIdAtom)
    if (!focusedId) return

    const focused = findPane(root, focusedId)
    if (!focused || !isContentPane(focused)) return

    const newPane: ContentPane = { ...focused, route }
    const newRoot = replacePane(root, focusedId, newPane)
    overlayRegistry.set(rootPaneAtom, newRoot)
  })

/**
 * Focus a specific pane by ID
 */
export const focusPaneOp = (paneId: PaneId): Effect.Effect<void> =>
  Effect.sync(() => {
    overlayRegistry.set(focusedPaneIdAtom, paneId)
  })

/**
 * Resize a split pane
 */
export const resizeSplitOp = (
  splitId: PaneId,
  ratio: number
): Effect.Effect<void> =>
  Effect.sync(() => {
    const root = overlayRegistry.get(rootPaneAtom)

    const updateRatio = (node: PaneNode): PaneNode => {
      if (isSplitPane(node)) {
        if (node.id === splitId) {
          return { ...node, ratio: Math.max(0.1, Math.min(0.9, ratio)) }
        }
        return {
          ...node,
          first: updateRatio(node.first),
          second: updateRatio(node.second),
        }
      }
      return node
    }

    overlayRegistry.set(rootPaneAtom, updateRatio(root))
  })

// =============================================================================
// Window Actions (Registry-aware, for use in callbacks)
// =============================================================================

export const windowActions = {
  splitHorizontal: () => Effect.runSync(splitHorizontalOp),
  splitVertical: () => Effect.runSync(splitVerticalOp),
  nextPane: () => Effect.runSync(nextPaneOp),
  prevPane: () => Effect.runSync(prevPaneOp),
  closePane: () => Effect.runSync(closePaneOp),
  closeOtherPanes: () => Effect.runSync(closeOtherPanesOp),
  setFocusedRoute: (route: string) => Effect.runSync(setFocusedRouteOp(route)),
  focusPane: (paneId: PaneId) => Effect.runSync(focusPaneOp(paneId)),
  resizeSplit: (splitId: PaneId, ratio: number) =>
    Effect.runSync(resizeSplitOp(splitId, ratio)),
}
