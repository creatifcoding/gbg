/**
 * Tabs Schema Definitions
 *
 * Effect.Schema-backed types for the tab/pane system.
 * Ported from infinitty with TMNL patterns.
 */

import { Schema } from 'effect'

// =============================================================================
// Enums as Schema.Literal
// =============================================================================

/** Split direction for pane splits */
export const SplitDirection = Schema.Literal('horizontal', 'vertical')
export type SplitDirection = typeof SplitDirection.Type

/** Terminal view mode */
export const TerminalViewMode = Schema.Literal('classic', 'blocks')
export type TerminalViewMode = typeof TerminalViewMode.Type

/** Pinned tab icon options */
export const PinnedTabIcon = Schema.Literal(
  'pin',
  'terminal',
  'code',
  'file',
  'folder',
  'star',
  'heart',
  'bookmark',
  'home',
  'settings',
  'globe',
  'zap'
)
export type PinnedTabIcon = typeof PinnedTabIcon.Type

/** Tab color options */
export const TabColor = Schema.Literal(
  'cyan',
  'green',
  'yellow',
  'orange',
  'red',
  'magenta',
  'blue',
  'white'
)
export type TabColor = typeof TabColor.Type

// =============================================================================
// Pane Types (TaggedStruct for discriminated unions)
// =============================================================================

/** Terminal pane - runs PTY sessions */
export const TerminalPane = Schema.TaggedStruct('TerminalPane', {
  id: Schema.String,
  title: Schema.String,
  cwd: Schema.optional(Schema.String),
  isActive: Schema.Boolean,
  viewMode: Schema.optional(TerminalViewMode),
})
export type TerminalPane = typeof TerminalPane.Type

/** WebView pane - embedded browser */
export const WebViewPane = Schema.TaggedStruct('WebViewPane', {
  id: Schema.String,
  title: Schema.String,
  url: Schema.String,
  isActive: Schema.Boolean,
})
export type WebViewPane = typeof WebViewPane.Type

/** Widget pane - custom widgets */
export const WidgetPane = Schema.TaggedStruct('WidgetPane', {
  id: Schema.String,
  title: Schema.String,
  widgetType: Schema.String,
  config: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  isActive: Schema.Boolean,
})
export type WidgetPane = typeof WidgetPane.Type

/** Editor pane - code editor */
export const EditorPane = Schema.TaggedStruct('EditorPane', {
  id: Schema.String,
  title: Schema.String,
  filePath: Schema.String,
  language: Schema.optional(Schema.String),
  isReadOnly: Schema.optional(Schema.Boolean),
  isActive: Schema.Boolean,
})
export type EditorPane = typeof EditorPane.Type

// Forward declaration for recursive SplitPane
interface SplitPaneType {
  readonly _tag: 'SplitPane'
  readonly id: string
  readonly direction: SplitDirection
  readonly ratio: number
  readonly first: PaneNode
  readonly second: PaneNode
}

/** Content panes (non-split) */
export const ContentPane = Schema.Union(TerminalPane, WebViewPane, WidgetPane, EditorPane)
export type ContentPane = typeof ContentPane.Type

/** All pane types including splits (recursive) */
export type PaneNode = ContentPane | SplitPaneType

// We'll define SplitPane as a plain interface since Schema doesn't support recursion directly
export interface SplitPane extends SplitPaneType {}

// =============================================================================
// Tab Schema
// =============================================================================

/** Tab - contains a pane tree */
export const Tab = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  // root is PaneNode but we can't express recursive types in Schema
  // We'll validate at runtime
  isActive: Schema.Boolean,
  order: Schema.Number,
  isPinned: Schema.Boolean,
  pinIcon: Schema.optional(PinnedTabIcon),
  pinColor: Schema.optional(TabColor),
  pinBackgroundColor: Schema.optional(TabColor),
  tabColor: Schema.optional(TabColor),
  tabBackgroundColor: Schema.optional(TabColor),
  resourcePath: Schema.optional(Schema.String),
})

// Full Tab type with root as PaneNode
export interface Tab extends Omit<typeof Tab.Type, 'root'> {
  readonly root: PaneNode
}

// =============================================================================
// Type Guards
// =============================================================================

export function isTerminalPane(node: PaneNode): node is TerminalPane {
  return node._tag === 'TerminalPane'
}

export function isWebViewPane(node: PaneNode): node is WebViewPane {
  return node._tag === 'WebViewPane'
}

export function isWidgetPane(node: PaneNode): node is WidgetPane {
  return node._tag === 'WidgetPane'
}

export function isEditorPane(node: PaneNode): node is EditorPane {
  return node._tag === 'EditorPane'
}

export function isSplitPane(node: PaneNode): node is SplitPane {
  return node._tag === 'SplitPane'
}

export function isContentPane(node: PaneNode): node is ContentPane {
  return (
    node._tag === 'TerminalPane' ||
    node._tag === 'WebViewPane' ||
    node._tag === 'WidgetPane' ||
    node._tag === 'EditorPane'
  )
}

// =============================================================================
// Factory Functions
// =============================================================================

let paneCounter = 0
let tabCounter = 0

export function generatePaneId(): string {
  return `pane-${++paneCounter}-${Date.now()}`
}

export function generateTabId(): string {
  return `tab-${++tabCounter}-${Date.now()}`
}

export function createTerminalPane(
  id: string,
  title: string,
  cwd?: string,
  viewMode: TerminalViewMode = 'classic'
): TerminalPane {
  return {
    _tag: 'TerminalPane',
    id,
    title,
    cwd,
    viewMode,
    isActive: true,
  }
}

export function createWebViewPane(id: string, title: string, url: string): WebViewPane {
  return {
    _tag: 'WebViewPane',
    id,
    title,
    url,
    isActive: true,
  }
}

export function createWidgetPane(
  id: string,
  title: string,
  widgetType: string,
  config?: Record<string, unknown>
): WidgetPane {
  return {
    _tag: 'WidgetPane',
    id,
    title,
    widgetType,
    config,
    isActive: true,
  }
}

export function createEditorPane(
  id: string,
  title: string,
  filePath: string,
  language?: string,
  isReadOnly?: boolean
): EditorPane {
  return {
    _tag: 'EditorPane',
    id,
    title,
    filePath,
    language,
    isReadOnly,
    isActive: true,
  }
}

export function createSplitPane(
  id: string,
  direction: SplitDirection,
  first: PaneNode,
  second: PaneNode,
  ratio = 0.5
): SplitPane {
  return {
    _tag: 'SplitPane',
    id,
    direction,
    ratio,
    first,
    second,
  }
}

export function createTab(id: string, title: string, cwd?: string): Tab {
  return {
    id,
    title,
    root: createTerminalPane(`${id}-pane-0`, title, cwd),
    isActive: true,
    order: 0,
    isPinned: false,
  }
}

// =============================================================================
// Tree Utilities
// =============================================================================

/** Find a pane by ID in the tree */
export function findPane(node: PaneNode, paneId: string): PaneNode | null {
  if (node.id === paneId) return node
  if (isSplitPane(node)) {
    const inFirst = findPane(node.first, paneId)
    if (inFirst) return inFirst
    return findPane(node.second, paneId)
  }
  return null
}

/** Get all terminal panes from a tree */
export function getAllTerminalPanes(node: PaneNode): TerminalPane[] {
  if (isTerminalPane(node)) return [node]
  if (isSplitPane(node)) {
    return [...getAllTerminalPanes(node.first), ...getAllTerminalPanes(node.second)]
  }
  return []
}

/** Get all content panes from a tree */
export function getAllContentPanes(node: PaneNode): ContentPane[] {
  if (isContentPane(node)) return [node]
  if (isSplitPane(node)) {
    return [...getAllContentPanes(node.first), ...getAllContentPanes(node.second)]
  }
  return []
}

/** Replace a pane in the tree with a new node */
export function replacePane(node: PaneNode, paneId: string, newNode: PaneNode): PaneNode {
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

/** Remove a pane and collapse its parent split */
export function removePane(node: PaneNode, paneId: string): PaneNode | null {
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
