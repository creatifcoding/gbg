/**
 * useBuffer Hook
 *
 * React hooks for buffer system access.
 * Uses atom subscriptions for reactive state.
 *
 * @module lib/buffer/hooks/useBuffer
 */

import { useMemo, useCallback, useEffect } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { useBufferContext, useBufferReady } from '../components/BufferProvider'
import {
  buffersAtom,
  windowsAtom,
  bufferAtom,
  windowAtom,
  bufferIdsAtom,
  dirtyBuffersAtom,
  focusedWindowIdAtom,
  focusedWindowAtom,
  focusedBufferAtom,
  activeTabIdAtom,
  activeTabAtom,
  sortedTabsAtom,
  tabCountAtom,
  bufferCountAtom,
  bufferStatsAtom,
  workspaceStateAtom,
  windowsForBufferAtom,
} from '../atoms'
import type { BufferId, BufferState, WindowId, WindowState, TabId, BufferType } from '../schemas'

// =============================================================================
// Buffer Hooks
// =============================================================================

/**
 * Get a specific buffer by ID.
 *
 * @example
 * ```tsx
 * function BufferView({ bufferId }: { bufferId: BufferId }) {
 *   const buffer = useBuffer(bufferId)
 *   if (!buffer) return <div>Buffer not found</div>
 *   return <div>{buffer.meta.name}</div>
 * }
 * ```
 */
export function useBuffer(bufferId: BufferId): BufferState | null {
  return useAtomValue(bufferAtom(bufferId))
}

/**
 * Get all buffer IDs.
 */
export function useBufferIds(): readonly BufferId[] {
  return useAtomValue(bufferIdsAtom)
}

/**
 * Get all buffers.
 */
export function useBuffers(): ReadonlyMap<BufferId, BufferState> {
  return useAtomValue(buffersAtom)
}

/**
 * Get all dirty buffers (with unsaved changes).
 */
export function useDirtyBuffers(): readonly BufferState[] {
  return useAtomValue(dirtyBuffersAtom)
}

/**
 * Get buffer count.
 */
export function useBufferCount(): number {
  return useAtomValue(bufferCountAtom)
}

/**
 * Get buffer statistics.
 */
export function useBufferStats() {
  return useAtomValue(bufferStatsAtom)
}

// =============================================================================
// Window Hooks
// =============================================================================

/**
 * Get a specific window by ID.
 */
export function useWindow(windowId: WindowId): WindowState | null {
  return useAtomValue(windowAtom(windowId))
}

/**
 * Get all windows.
 */
export function useWindows(): ReadonlyMap<WindowId, WindowState> {
  return useAtomValue(windowsAtom)
}

/**
 * Get all windows for a specific buffer.
 */
export function useWindowsForBuffer(bufferId: BufferId): readonly WindowState[] {
  return useAtomValue(windowsForBufferAtom(bufferId))
}

/**
 * Get the currently focused window ID.
 */
export function useFocusedWindowId(): WindowId | null {
  return useAtomValue(focusedWindowIdAtom)
}

/**
 * Get the currently focused window.
 */
export function useFocusedWindow(): WindowState | null {
  return useAtomValue(focusedWindowAtom)
}

/**
 * Get the buffer of the currently focused window.
 */
export function useFocusedBuffer(): BufferState | null {
  return useAtomValue(focusedBufferAtom)
}

// =============================================================================
// Tab Hooks
// =============================================================================

/**
 * Get the active tab ID.
 */
export function useActiveTabId(): TabId | null {
  return useAtomValue(activeTabIdAtom)
}

/**
 * Get the active tab.
 */
export function useActiveTab() {
  return useAtomValue(activeTabAtom)
}

/**
 * Get all tabs sorted by order.
 */
export function useSortedTabs() {
  return useAtomValue(sortedTabsAtom)
}

/**
 * Get tab count.
 */
export function useTabCount(): number {
  return useAtomValue(tabCountAtom)
}

// =============================================================================
// Workspace Hooks
// =============================================================================

/**
 * Get full workspace state (frame, tab, window, buffer).
 */
export function useWorkspaceState() {
  return useAtomValue(workspaceStateAtom)
}

// =============================================================================
// Action Hooks
// =============================================================================

/**
 * Hook for buffer operations.
 *
 * @example
 * ```tsx
 * function CreateBufferButton() {
 *   const { create, isReady } = useBufferActions()
 *
 *   const handleClick = async () => {
 *     const buffer = await create('document', 'Untitled', 'ydoc://new')
 *     console.log('Created:', buffer.meta.id)
 *   }
 *
 *   return <button onClick={handleClick} disabled={!isReady}>Create</button>
 * }
 * ```
 */
export function useBufferActions() {
  const context = useBufferContext()
  const isReady = useBufferReady()

  return useMemo(
    () => ({
      isReady,
      create: context.createBuffer,
      getOrCreate: context.getOrCreateBuffer,
      open: context.openBuffer,
      close: context.closeBuffer,
      get: context.getBuffer,
      getByUri: context.getBufferByUri,
      markDirty: context.markDirty,
      markClean: context.markClean,
      gc: context.gc,
    }),
    [context, isReady]
  )
}

/**
 * Hook for window operations.
 */
export function useWindowActions() {
  const context = useBufferContext()
  const isReady = useBufferReady()

  return useMemo(
    () => ({
      isReady,
      create: context.createWindow,
      close: context.closeWindow,
    }),
    [context, isReady]
  )
}

// =============================================================================
// Lifecycle Hooks
// =============================================================================

/**
 * Open a buffer when component mounts, close when unmounts.
 *
 * @example
 * ```tsx
 * function BufferViewer({ uri }: { uri: string }) {
 *   const buffer = useBufferLifecycle('document', 'Untitled', uri)
 *
 *   if (!buffer) return <div>Loading...</div>
 *   return <div>{buffer.meta.name}</div>
 * }
 * ```
 */
export function useBufferLifecycle(
  type: BufferType,
  name: string,
  uri: string,
  options?: {
    ysweetDocId?: string
    documentId?: string
    filePath?: string
    mimeType?: string
    metadata?: Record<string, unknown>
  }
): BufferState | null {
  const context = useBufferContext()
  const isReady = useBufferReady()

  // Track buffer ID
  const [bufferId, setBufferId] = React.useState<BufferId | null>(null)

  // Get buffer state reactively
  const buffer = useBuffer(bufferId!)

  // Open buffer on mount
  useEffect(() => {
    if (!isReady) return

    let mounted = true

    context
      .getOrCreateBuffer(type, name, uri, options)
      .then((state) => {
        if (mounted) {
          setBufferId(state.meta.id)
        }
      })
      .catch((err) => {
        console.error('[useBufferLifecycle] Failed to open buffer:', err)
      })

    return () => {
      mounted = false
      // Close buffer on unmount
      if (bufferId) {
        context.closeBuffer(bufferId).catch(() => {
          // Ignore close errors
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, type, name, uri])

  return buffer
}

/**
 * Create a window for a buffer when component mounts, close when unmounts.
 */
export function useWindowLifecycle(bufferId: BufferId, majorMode?: string): WindowState | null {
  const context = useBufferContext()
  const isReady = useBufferReady()

  const [windowId, setWindowId] = React.useState<WindowId | null>(null)

  const window = useWindow(windowId!)

  useEffect(() => {
    if (!isReady) return

    let mounted = true

    context
      .createWindow(bufferId, majorMode)
      .then((state) => {
        if (mounted) {
          setWindowId(state.id)
        }
      })
      .catch((err) => {
        console.error('[useWindowLifecycle] Failed to create window:', err)
      })

    return () => {
      mounted = false
      if (windowId) {
        context.closeWindow(windowId).catch(() => {
          // Ignore close errors
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, bufferId, majorMode])

  return window
}

// Import React for useState
import * as React from 'react'
