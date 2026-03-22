/**
 * Buffer Hooks - Public API
 *
 * @module lib/buffer/hooks
 */

export {
  // Buffer hooks
  useBuffer,
  useBufferIds,
  useBuffers,
  useDirtyBuffers,
  useBufferCount,
  useBufferStats,
  // Window hooks
  useWindow,
  useWindows,
  useWindowsForBuffer,
  useFocusedWindowId,
  useFocusedWindow,
  useFocusedBuffer,
  // Tab hooks
  useActiveTabId,
  useActiveTab,
  useSortedTabs,
  useTabCount,
  // Workspace hooks
  useWorkspaceState,
  // Action hooks
  useBufferActions,
  useWindowActions,
  // Lifecycle hooks
  useBufferLifecycle,
  useWindowLifecycle,
} from './useBuffer'
