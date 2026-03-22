/**
 * Buffer Schema Definitions
 *
 * Effect.Schema-backed types for the Emacs-inspired buffer/window/tab/frame system.
 *
 * Conceptual Model:
 * - Buffer: Durable CRDT content (Y.Doc, file, terminal session)
 * - Window: Per-user view onto a buffer (cursor, scroll, mode state)
 * - Tab: Named window configuration (layout snapshot)
 * - Frame: Top-level container (AppShell instance)
 *
 * @module lib/buffer/schemas
 */

import { Schema } from 'effect'

// =============================================================================
// Branded IDs
// =============================================================================

/**
 * Unique buffer identifier
 * Format: buf-{timestamp36}-{random6}
 */
export const BufferId = Schema.String.pipe(
  Schema.brand('BufferId'),
  Schema.filter((s) => s.startsWith('buf-'), {
    message: () => 'BufferId must start with "buf-"',
  })
)
export type BufferId = typeof BufferId.Type

/**
 * Window identifier (per-user view)
 * Format: win-{timestamp36}-{random6}
 */
export const WindowId = Schema.String.pipe(
  Schema.brand('WindowId'),
  Schema.filter((s) => s.startsWith('win-'), {
    message: () => 'WindowId must start with "win-"',
  })
)
export type WindowId = typeof WindowId.Type

/**
 * Tab identifier (layout snapshot)
 * Format: tab-{timestamp36}-{random6}
 */
export const TabId = Schema.String.pipe(
  Schema.brand('TabId'),
  Schema.filter((s) => s.startsWith('tab-'), {
    message: () => 'TabId must start with "tab-"',
  })
)
export type TabId = typeof TabId.Type

/**
 * Frame identifier (browser tab / Tauri window)
 * Format: frame-{timestamp36}-{random6}
 */
export const FrameId = Schema.String.pipe(
  Schema.brand('FrameId'),
  Schema.filter((s) => s.startsWith('frame-'), {
    message: () => 'FrameId must start with "frame-"',
  })
)
export type FrameId = typeof FrameId.Type

// =============================================================================
// Buffer Types
// =============================================================================

/**
 * Buffer content type discriminator
 *
 * - document: Y.Doc CRDT (rich text editor)
 * - terminal: PTY session (lightweight, ephemeral content)
 * - webview: Embedded browser (lightweight, URL state)
 * - widget: Custom widget (lightweight, config state)
 * - canvas: tldraw/ReactFlow (Y.Doc CRDT for collaboration)
 * - file: Local file mapping (read/write to filesystem)
 */
export const BufferType = Schema.Literal(
  'document',
  'terminal',
  'webview',
  'widget',
  'canvas',
  'file'
)
export type BufferType = typeof BufferType.Type

/**
 * Buffer connection state (for CRDT-backed buffers)
 */
export const BufferConnectionState = Schema.Literal(
  'disconnected',
  'connecting',
  'synced',
  'error'
)
export type BufferConnectionState = typeof BufferConnectionState.Type

/**
 * Buffer metadata - stored alongside Y.Doc
 */
export const BufferMeta = Schema.Struct({
  /** Unique buffer identifier */
  id: BufferId,
  /** Content type discriminator */
  type: BufferType,
  /** Human-readable name (filename, tab title, etc.) */
  name: Schema.String,
  /**
   * Universal resource identifier
   * - file:///path/to/file.ts
   * - ydoc://doc-id
   * - pty://session-id
   * - widget://widget-type/instance-id
   */
  uri: Schema.String,
  /** Y-Sweet document ID (for CRDT-backed buffers) */
  ysweetDocId: Schema.optional(Schema.String),
  /** Reference to DocumentRegistryService metadata (if applicable) */
  documentId: Schema.optional(Schema.String),
  /** File path (for file-backed buffers) */
  filePath: Schema.optional(Schema.String),
  /** MIME type or language identifier */
  mimeType: Schema.optional(Schema.String),
  /** Buffer creation timestamp */
  createdAt: Schema.DateFromString,
  /** Last modification timestamp */
  modifiedAt: Schema.DateFromString,
  /** Custom metadata (extensible) */
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export type BufferMeta = typeof BufferMeta.Type

/**
 * Runtime buffer state (in-memory only)
 */
export const BufferState = Schema.Struct({
  /** Buffer metadata */
  meta: BufferMeta,
  /** CRDT connection state */
  connectionState: BufferConnectionState,
  /** Number of windows referencing this buffer */
  refCount: Schema.Number,
  /** Pending changes count (for save indicator) */
  pendingChanges: Schema.Number,
  /** Last sync timestamp */
  lastSync: Schema.optional(Schema.Number),
  /** Error message if connectionState is 'error' */
  error: Schema.optional(Schema.String),
  /** Is buffer read-only? */
  isReadOnly: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** Is buffer modified since last save? */
  isDirty: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})
export type BufferState = typeof BufferState.Type

// =============================================================================
// Window Types (Per-User View State)
// =============================================================================

/**
 * Cursor position within buffer
 */
export const CursorPosition = Schema.Struct({
  /** Character offset from start */
  offset: Schema.Number,
  /** Line number (1-based, for editors) */
  line: Schema.optional(Schema.Number),
  /** Column number (1-based, for editors) */
  column: Schema.optional(Schema.Number),
})
export type CursorPosition = typeof CursorPosition.Type

/**
 * Scroll state
 */
export const ScrollState = Schema.Struct({
  /** Horizontal scroll offset */
  x: Schema.Number,
  /** Vertical scroll offset */
  y: Schema.Number,
  /** Viewport zoom level (for canvas/diagram buffers) */
  zoom: Schema.optionalWith(Schema.Number, { default: () => 1 }),
})
export type ScrollState = typeof ScrollState.Type

/**
 * Major/minor modes (Emacs concept)
 *
 * Major mode: Primary editing mode (markdown, typescript, shell)
 * Minor modes: Additional behaviors (readonly, preview, zen, vim-emulation)
 */
export const BufferMode = Schema.Struct({
  /** Primary editing mode */
  major: Schema.String,
  /** Additional minor modes */
  minor: Schema.Array(Schema.String),
})
export type BufferMode = typeof BufferMode.Type

/**
 * Text selection range
 */
export const SelectionRange = Schema.Struct({
  /** Selection start (anchor) */
  anchor: CursorPosition,
  /** Selection end (head/cursor) */
  head: CursorPosition,
})
export type SelectionRange = typeof SelectionRange.Type

/**
 * Window state - per-user view onto a buffer
 *
 * Windows are ephemeral (per-session) and hold view-specific state
 * that shouldn't be shared across users or persisted in the CRDT.
 */
export const WindowState = Schema.Struct({
  /** Unique window identifier */
  id: WindowId,
  /** Reference to buffer being viewed */
  bufferId: BufferId,
  /** Cursor position (local to this user) */
  cursor: Schema.optional(CursorPosition),
  /** Scroll position (local to this user) */
  scroll: ScrollState,
  /** Buffer modes */
  mode: BufferMode,
  /** Selection range (for editors) */
  selection: Schema.optional(SelectionRange),
  /** Window-specific configuration (e.g., split ratios, panel visibility) */
  config: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  /** Is this window focused? */
  isFocused: Schema.Boolean,
  /** Timestamp of last activity */
  lastActivity: Schema.Number,
})
export type WindowState = typeof WindowState.Type

// =============================================================================
// Tab Types (Layout Snapshots)
// =============================================================================

/**
 * Split direction for pane layouts
 */
export const SplitDirection = Schema.Literal('horizontal', 'vertical')
export type SplitDirection = typeof SplitDirection.Type

/**
 * Tab layout node (recursive structure)
 *
 * Layout is a tree where:
 * - Leaf nodes are WindowIds
 * - Split nodes contain direction, ratio, and two children
 *
 * Note: Recursive types need runtime handling since Effect Schema
 * doesn't directly support recursion. We use a discriminated union
 * approach with runtime tree traversal.
 */
export interface TabLayoutWindow {
  readonly _tag: 'window'
  readonly windowId: WindowId
  readonly weight: number
}

export interface TabLayoutSplit {
  readonly _tag: 'split'
  readonly direction: SplitDirection
  readonly ratio: number
  readonly first: TabLayoutNode
  readonly second: TabLayoutNode
}

export type TabLayoutNode = TabLayoutWindow | TabLayoutSplit

/**
 * Tab state - named window configuration
 *
 * Tabs save window layouts and can be restored to recreate a workspace.
 * Buffers are NOT owned by tabs - tabs reference windows which reference buffers.
 */
export const TabState = Schema.Struct({
  /** Unique tab identifier */
  id: TabId,
  /** Tab display name */
  name: Schema.String,
  /** Icon for tab (lucide icon name) */
  icon: Schema.optional(Schema.String),
  /**
   * Layout tree root (serialized as JSON string due to recursion)
   * Runtime: Parse with parseLayoutTree()
   */
  layoutJson: Schema.optional(Schema.String),
  /** Active window within this tab */
  activeWindowId: Schema.optional(WindowId),
  /** Windows in this tab (for quick lookup) */
  windowIds: Schema.Array(WindowId),
  /** Is this tab pinned? */
  isPinned: Schema.Boolean,
  /** Tab order (for sorting) */
  order: Schema.Number,
  /** Tab color (optional theming) */
  color: Schema.optional(Schema.String),
  /** Creation timestamp */
  createdAt: Schema.Number,
  /** Last accessed timestamp */
  lastAccessedAt: Schema.Number,
})
export type TabState = typeof TabState.Type

// =============================================================================
// Frame Types (Browser Tab / Tauri Window)
// =============================================================================

/**
 * Frame bounds (for window restore)
 */
export const FrameBounds = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  width: Schema.Number,
  height: Schema.Number,
})
export type FrameBounds = typeof FrameBounds.Type

/**
 * Frame state - top-level container
 *
 * In browser: One frame per browser tab
 * In Tauri: One frame per native window
 */
export const FrameState = Schema.Struct({
  /** Unique frame identifier */
  id: FrameId,
  /** Tabs in this frame */
  tabIds: Schema.Array(TabId),
  /** Active tab */
  activeTabId: Schema.optional(TabId),
  /** Frame dimensions (for session restore) */
  bounds: Schema.optional(FrameBounds),
  /** Is this frame focused? */
  isFocused: Schema.Boolean,
  /** Is frame maximized? */
  isMaximized: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** Is frame fullscreen? */
  isFullscreen: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})
export type FrameState = typeof FrameState.Type

// =============================================================================
// ID Generation
// =============================================================================

let idCounter = 0

function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8)
  const counter = (++idCounter).toString(36)
  return `${prefix}-${timestamp}-${random}${counter}`
}

export function generateBufferId(): BufferId {
  return generateId('buf') as BufferId
}

export function generateWindowId(): WindowId {
  return generateId('win') as WindowId
}

export function generateTabId(): TabId {
  return generateId('tab') as TabId
}

export function generateFrameId(): FrameId {
  return generateId('frame') as FrameId
}

// =============================================================================
// Layout Tree Utilities
// =============================================================================

/**
 * Create a window layout node
 */
export function createWindowNode(windowId: WindowId, weight = 1): TabLayoutWindow {
  return { _tag: 'window', windowId, weight }
}

/**
 * Create a split layout node
 */
export function createSplitNode(
  direction: SplitDirection,
  first: TabLayoutNode,
  second: TabLayoutNode,
  ratio = 0.5
): TabLayoutSplit {
  return { _tag: 'split', direction, ratio, first, second }
}

/**
 * Serialize layout tree to JSON string
 */
export function serializeLayoutTree(node: TabLayoutNode): string {
  return JSON.stringify(node)
}

/**
 * Parse layout tree from JSON string
 */
export function parseLayoutTree(json: string): TabLayoutNode | null {
  try {
    const parsed = JSON.parse(json)
    if (isValidLayoutNode(parsed)) {
      return parsed as TabLayoutNode
    }
    return null
  } catch {
    return null
  }
}

/**
 * Validate layout node structure
 */
function isValidLayoutNode(node: unknown): boolean {
  if (!node || typeof node !== 'object') return false
  const n = node as Record<string, unknown>

  if (n._tag === 'window') {
    return typeof n.windowId === 'string' && n.windowId.startsWith('win-')
  }

  if (n._tag === 'split') {
    return (
      (n.direction === 'horizontal' || n.direction === 'vertical') &&
      typeof n.ratio === 'number' &&
      isValidLayoutNode(n.first) &&
      isValidLayoutNode(n.second)
    )
  }

  return false
}

/**
 * Find all window IDs in a layout tree
 */
export function collectWindowIds(node: TabLayoutNode): WindowId[] {
  if (node._tag === 'window') {
    return [node.windowId]
  }
  return [...collectWindowIds(node.first), ...collectWindowIds(node.second)]
}

/**
 * Replace a window in the layout tree
 */
export function replaceWindowInLayout(
  node: TabLayoutNode,
  oldWindowId: WindowId,
  newNode: TabLayoutNode
): TabLayoutNode {
  if (node._tag === 'window') {
    return node.windowId === oldWindowId ? newNode : node
  }
  return {
    ...node,
    first: replaceWindowInLayout(node.first, oldWindowId, newNode),
    second: replaceWindowInLayout(node.second, oldWindowId, newNode),
  }
}

/**
 * Remove a window from the layout tree (collapses parent split)
 */
export function removeWindowFromLayout(
  node: TabLayoutNode,
  windowId: WindowId
): TabLayoutNode | null {
  if (node._tag === 'window') {
    return node.windowId === windowId ? null : node
  }

  // Check if either child is the target window
  if (node.first._tag === 'window' && node.first.windowId === windowId) {
    return node.second
  }
  if (node.second._tag === 'window' && node.second.windowId === windowId) {
    return node.first
  }

  // Recurse into children
  const newFirst = removeWindowFromLayout(node.first, windowId)
  const newSecond = removeWindowFromLayout(node.second, windowId)

  if (!newFirst) return newSecond
  if (!newSecond) return newFirst

  return { ...node, first: newFirst, second: newSecond }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create initial buffer metadata
 */
export function createBufferMeta(
  type: BufferType,
  name: string,
  uri: string,
  options?: Partial<Pick<BufferMeta, 'ysweetDocId' | 'documentId' | 'filePath' | 'mimeType' | 'metadata'>>
): BufferMeta {
  const now = new Date().toISOString()
  return {
    id: generateBufferId(),
    type,
    name,
    uri,
    ysweetDocId: options?.ysweetDocId,
    documentId: options?.documentId,
    filePath: options?.filePath,
    mimeType: options?.mimeType,
    createdAt: now as any,
    modifiedAt: now as any,
    metadata: options?.metadata,
  }
}

/**
 * Create initial buffer state
 */
export function createBufferState(meta: BufferMeta): BufferState {
  return {
    meta,
    connectionState: 'disconnected',
    refCount: 0,
    pendingChanges: 0,
    isReadOnly: false,
    isDirty: false,
  }
}

/**
 * Create initial window state
 */
export function createWindowState(
  bufferId: BufferId,
  majorMode = 'fundamental'
): WindowState {
  return {
    id: generateWindowId(),
    bufferId,
    scroll: { x: 0, y: 0, zoom: 1 },
    mode: { major: majorMode, minor: [] },
    isFocused: false,
    lastActivity: Date.now(),
  }
}

/**
 * Create initial tab state
 */
export function createTabState(name: string, windowIds: WindowId[] = []): TabState {
  const now = Date.now()
  return {
    id: generateTabId(),
    name,
    windowIds,
    isPinned: false,
    order: 0,
    createdAt: now,
    lastAccessedAt: now,
  }
}

/**
 * Create initial frame state
 */
export function createFrameState(): FrameState {
  return {
    id: generateFrameId(),
    tabIds: [],
    isFocused: true,
    isMaximized: false,
    isFullscreen: false,
  }
}
