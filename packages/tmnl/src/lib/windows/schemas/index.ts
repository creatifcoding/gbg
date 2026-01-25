/**
 * Window Schemas - Emacs-Inspired Pane System
 *
 * Simple recursive pane tree for Emacs-style window management.
 * - Split horizontal (C-x 2) or vertical (C-x 3)
 * - Navigate between panes (C-x o)
 * - Each pane shows a route
 *
 * @module lib/windows/schemas
 */

import { Schema } from 'effect'

// =============================================================================
// IDs
// =============================================================================

export const PaneId = Schema.String.pipe(Schema.brand('PaneId'))
export type PaneId = typeof PaneId.Type

// =============================================================================
// Split Direction
// =============================================================================

export const SplitDirection = Schema.Literal('horizontal', 'vertical')
export type SplitDirection = typeof SplitDirection.Type

// =============================================================================
// Pane Types (Recursive)
// =============================================================================

/**
 * Content pane - displays a route
 */
export interface ContentPane {
  readonly _tag: 'ContentPane'
  readonly id: PaneId
  readonly route: string // e.g., '/', '/playground', '/testbed'
}

/**
 * Split pane - contains two child panes
 */
export interface SplitPane {
  readonly _tag: 'SplitPane'
  readonly id: PaneId
  readonly direction: SplitDirection
  readonly ratio: number // 0-1, position of divider
  readonly first: PaneNode
  readonly second: PaneNode
}

/**
 * Pane tree node - either content or split
 */
export type PaneNode = ContentPane | SplitPane

// =============================================================================
// Type Guards
// =============================================================================

export function isContentPane(node: PaneNode): node is ContentPane {
  return node._tag === 'ContentPane'
}

export function isSplitPane(node: PaneNode): node is SplitPane {
  return node._tag === 'SplitPane'
}

// =============================================================================
// Factory Functions
// =============================================================================

let paneCounter = 0

export function generatePaneId(): PaneId {
  return `pane-${++paneCounter}-${Date.now()}` as PaneId
}

export function createContentPane(route: string): ContentPane {
  return {
    _tag: 'ContentPane',
    id: generatePaneId(),
    route,
  }
}

export function createSplitPane(
  direction: SplitDirection,
  first: PaneNode,
  second: PaneNode,
  ratio = 0.5
): SplitPane {
  return {
    _tag: 'SplitPane',
    id: generatePaneId(),
    direction,
    ratio,
    first,
    second,
  }
}

// =============================================================================
// Tree Utilities
// =============================================================================

/**
 * Find a pane by ID in the tree
 */
export function findPane(node: PaneNode, paneId: PaneId): PaneNode | null {
  if (node.id === paneId) return node
  if (isSplitPane(node)) {
    const inFirst = findPane(node.first, paneId)
    if (inFirst) return inFirst
    return findPane(node.second, paneId)
  }
  return null
}

/**
 * Get all content panes from tree (left-to-right, top-to-bottom order)
 */
export function getAllContentPanes(node: PaneNode): ContentPane[] {
  if (isContentPane(node)) return [node]
  return [...getAllContentPanes(node.first), ...getAllContentPanes(node.second)]
}

/**
 * Replace a pane in the tree
 */
export function replacePane(
  node: PaneNode,
  paneId: PaneId,
  newNode: PaneNode
): PaneNode {
  if (node.id === paneId) return newNode
  if (isSplitPane(node)) {
    return {
      ...node,
      first: replacePane(node.first, paneId, newNode),
      second: replacePane(node.second, paneId, newNode),
    }
  }
  return node
}

/**
 * Remove a pane and collapse its parent split
 */
export function removePane(node: PaneNode, paneId: PaneId): PaneNode | null {
  if (node.id === paneId) return null
  if (isSplitPane(node)) {
    if (node.first.id === paneId) return node.second
    if (node.second.id === paneId) return node.first
    const newFirst = removePane(node.first, paneId)
    const newSecond = removePane(node.second, paneId)
    if (!newFirst) return newSecond
    if (!newSecond) return newFirst
    return { ...node, first: newFirst, second: newSecond }
  }
  return node
}

/**
 * Get next pane in tree (for C-x o navigation)
 */
export function getNextPane(
  root: PaneNode,
  currentId: PaneId
): ContentPane | null {
  const panes = getAllContentPanes(root)
  const currentIndex = panes.findIndex((p) => p.id === currentId)
  if (currentIndex === -1) return panes[0] ?? null
  return panes[(currentIndex + 1) % panes.length] ?? null
}

/**
 * Get previous pane in tree
 */
export function getPrevPane(
  root: PaneNode,
  currentId: PaneId
): ContentPane | null {
  const panes = getAllContentPanes(root)
  const currentIndex = panes.findIndex((p) => p.id === currentId)
  if (currentIndex === -1) return panes[panes.length - 1] ?? null
  return panes[(currentIndex - 1 + panes.length) % panes.length] ?? null
}
