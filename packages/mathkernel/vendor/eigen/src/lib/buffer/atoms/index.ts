/**
 * Buffer Atoms
 *
 * Atom-based state management for the buffer/window/tab/frame system.
 * Follows the Atom-as-State doctrine: atoms are the primary state,
 * services mutate via registry.set(), React subscribes via useAtomValue().
 *
 * Uses overlayRegistry as the shared registry for consistency with
 * the rest of the TMNL overlay system.
 *
 * @module lib/buffer/atoms
 */

import { Atom } from '@effect-atom/atom'
import { overlayRegistry } from '@/lib/overlays/atoms'
import type {
  BufferId,
  BufferState,
  WindowId,
  WindowState,
  TabId,
  TabState,
  FrameId,
  FrameState,
} from '../schemas'

// =============================================================================
// Registry Export
// =============================================================================

/**
 * Buffer registry - alias for overlayRegistry
 *
 * Use this for synchronous mutations in React callbacks:
 * - bufferRegistry.set(atom, value)
 * - bufferRegistry.get(atom)
 *
 * For Effect contexts, use Atom.set/get which return Effects.
 */
export { overlayRegistry as bufferRegistry }

// =============================================================================
// Buffer Atoms
// =============================================================================

/**
 * All loaded buffers keyed by ID
 *
 * This is the source of truth for buffer state.
 * BufferService manages this via registry.set().
 */
export const buffersAtom = Atom.make<ReadonlyMap<BufferId, BufferState>>(new Map())

/**
 * Buffer by ID (Atom.family for per-buffer subscriptions)
 *
 * Usage:
 * ```ts
 * const buffer = useAtomValue(bufferAtom(bufferId))
 * ```
 */
export const bufferAtom = Atom.family((bufferId: BufferId) =>
  Atom.make((get) => get(buffersAtom).get(bufferId) ?? null)
)

/**
 * All buffer IDs (derived, for iteration)
 */
export const bufferIdsAtom = Atom.make((get) => Array.from(get(buffersAtom).keys()))

/**
 * Buffers with unsaved changes (derived)
 */
export const dirtyBuffersAtom = Atom.make((get) =>
  Array.from(get(buffersAtom).values()).filter((b) => b.isDirty || b.pendingChanges > 0)
)

/**
 * Buffer count (derived)
 */
export const bufferCountAtom = Atom.make((get) => get(buffersAtom).size)

// =============================================================================
// Window Atoms
// =============================================================================

/**
 * All windows keyed by ID
 *
 * Windows are per-user view state onto buffers.
 */
export const windowsAtom = Atom.make<ReadonlyMap<WindowId, WindowState>>(new Map())

/**
 * Window by ID (Atom.family)
 */
export const windowAtom = Atom.family((windowId: WindowId) =>
  Atom.make((get) => get(windowsAtom).get(windowId) ?? null)
)

/**
 * Windows for a specific buffer (derived)
 *
 * Returns all windows viewing the given buffer.
 */
export const windowsForBufferAtom = Atom.family((bufferId: BufferId) =>
  Atom.make((get) => {
    const windows = get(windowsAtom)
    return Array.from(windows.values()).filter((w) => w.bufferId === bufferId)
  })
)

/**
 * Currently focused window ID
 */
export const focusedWindowIdAtom = Atom.make<WindowId | null>(null)

/**
 * Focused window state (derived)
 */
export const focusedWindowAtom = Atom.make((get) => {
  const windowId = get(focusedWindowIdAtom)
  if (!windowId) return null
  return get(windowsAtom).get(windowId) ?? null
})

/**
 * Buffer of the focused window (derived)
 */
export const focusedBufferAtom = Atom.make((get) => {
  const window = get(focusedWindowAtom)
  if (!window) return null
  return get(buffersAtom).get(window.bufferId) ?? null
})

// =============================================================================
// Tab Atoms
// =============================================================================

/**
 * All tabs keyed by ID
 */
export const tabsAtom = Atom.make<ReadonlyMap<TabId, TabState>>(new Map())

/**
 * Tab by ID (Atom.family)
 */
export const tabAtom = Atom.family((tabId: TabId) =>
  Atom.make((get) => get(tabsAtom).get(tabId) ?? null)
)

/**
 * Sorted tabs (by order property)
 */
export const sortedTabsAtom = Atom.make((get) =>
  Array.from(get(tabsAtom).values()).sort((a, b) => a.order - b.order)
)

/**
 * Active tab ID
 */
export const activeTabIdAtom = Atom.make<TabId | null>(null)

/**
 * Active tab state (derived)
 */
export const activeTabAtom = Atom.make((get) => {
  const tabId = get(activeTabIdAtom)
  if (!tabId) return null
  return get(tabsAtom).get(tabId) ?? null
})

/**
 * Pinned tabs (derived)
 */
export const pinnedTabsAtom = Atom.make((get) =>
  Array.from(get(tabsAtom).values())
    .filter((t) => t.isPinned)
    .sort((a, b) => a.order - b.order)
)

/**
 * Tab count (derived)
 */
export const tabCountAtom = Atom.make((get) => get(tabsAtom).size)

// =============================================================================
// Frame Atoms
// =============================================================================

/**
 * Current frame ID
 *
 * In browser: typically single frame
 * In Tauri: multiple frames possible
 */
export const currentFrameIdAtom = Atom.make<FrameId | null>(null)

/**
 * Current frame state
 */
export const frameAtom = Atom.make<FrameState | null>(null)

/**
 * All frames (for multi-window support in Tauri)
 */
export const framesAtom = Atom.make<ReadonlyMap<FrameId, FrameState>>(new Map())

// =============================================================================
// Composite State Atoms
// =============================================================================

/**
 * Current workspace state (frame + active tab + focused window + buffer)
 *
 * Convenient for components that need the full context.
 */
export const workspaceStateAtom = Atom.make((get) => {
  const frame = get(frameAtom)
  const activeTab = get(activeTabAtom)
  const focusedWindow = get(focusedWindowAtom)
  const focusedBuffer = get(focusedBufferAtom)

  return {
    frame,
    activeTab,
    focusedWindow,
    focusedBuffer,
    hasFrame: frame !== null,
    hasActiveTab: activeTab !== null,
    hasFocusedWindow: focusedWindow !== null,
    hasFocusedBuffer: focusedBuffer !== null,
  }
})

/**
 * Buffer statistics (derived)
 */
export const bufferStatsAtom = Atom.make((get) => {
  const buffers = Array.from(get(buffersAtom).values())
  return {
    total: buffers.length,
    dirty: buffers.filter((b) => b.isDirty).length,
    synced: buffers.filter((b) => b.connectionState === 'synced').length,
    connecting: buffers.filter((b) => b.connectionState === 'connecting').length,
    error: buffers.filter((b) => b.connectionState === 'error').length,
    disconnected: buffers.filter((b) => b.connectionState === 'disconnected').length,
  }
})

// =============================================================================
// Mutation Helpers (for use with registry.set)
// =============================================================================

/**
 * Helper to update a buffer in the map
 */
export function updateBuffer(
  buffers: ReadonlyMap<BufferId, BufferState>,
  bufferId: BufferId,
  updater: (state: BufferState) => BufferState
): ReadonlyMap<BufferId, BufferState> {
  const existing = buffers.get(bufferId)
  if (!existing) return buffers
  const newMap = new Map(buffers)
  newMap.set(bufferId, updater(existing))
  return newMap
}

/**
 * Helper to add a buffer to the map
 */
export function addBuffer(
  buffers: ReadonlyMap<BufferId, BufferState>,
  state: BufferState
): ReadonlyMap<BufferId, BufferState> {
  const newMap = new Map(buffers)
  newMap.set(state.meta.id, state)
  return newMap
}

/**
 * Helper to remove a buffer from the map
 */
export function removeBuffer(
  buffers: ReadonlyMap<BufferId, BufferState>,
  bufferId: BufferId
): ReadonlyMap<BufferId, BufferState> {
  const newMap = new Map(buffers)
  newMap.delete(bufferId)
  return newMap
}

/**
 * Helper to update a window in the map
 */
export function updateWindow(
  windows: ReadonlyMap<WindowId, WindowState>,
  windowId: WindowId,
  updater: (state: WindowState) => WindowState
): ReadonlyMap<WindowId, WindowState> {
  const existing = windows.get(windowId)
  if (!existing) return windows
  const newMap = new Map(windows)
  newMap.set(windowId, updater(existing))
  return newMap
}

/**
 * Helper to add a window to the map
 */
export function addWindow(
  windows: ReadonlyMap<WindowId, WindowState>,
  state: WindowState
): ReadonlyMap<WindowId, WindowState> {
  const newMap = new Map(windows)
  newMap.set(state.id, state)
  return newMap
}

/**
 * Helper to remove a window from the map
 */
export function removeWindow(
  windows: ReadonlyMap<WindowId, WindowState>,
  windowId: WindowId
): ReadonlyMap<WindowId, WindowState> {
  const newMap = new Map(windows)
  newMap.delete(windowId)
  return newMap
}

/**
 * Helper to update a tab in the map
 */
export function updateTab(
  tabs: ReadonlyMap<TabId, TabState>,
  tabId: TabId,
  updater: (state: TabState) => TabState
): ReadonlyMap<TabId, TabState> {
  const existing = tabs.get(tabId)
  if (!existing) return tabs
  const newMap = new Map(tabs)
  newMap.set(tabId, updater(existing))
  return newMap
}

/**
 * Helper to add a tab to the map
 */
export function addTab(
  tabs: ReadonlyMap<TabId, TabState>,
  state: TabState
): ReadonlyMap<TabId, TabState> {
  const newMap = new Map(tabs)
  newMap.set(state.id, state)
  return newMap
}

/**
 * Helper to remove a tab from the map
 */
export function removeTab(
  tabs: ReadonlyMap<TabId, TabState>,
  tabId: TabId
): ReadonlyMap<TabId, TabState> {
  const newMap = new Map(tabs)
  newMap.delete(tabId)
  return newMap
}
