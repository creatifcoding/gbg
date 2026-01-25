/**
 * Buffer Module - Public API
 *
 * Emacs-inspired buffer/window/tab/frame system for TMNL.
 *
 * ## Conceptual Model
 *
 * - **Buffer**: Durable CRDT content (Y.Doc, file, terminal session)
 * - **Window**: Per-user view onto a buffer (cursor, scroll, mode state)
 * - **Tab**: Named window configuration (layout snapshot)
 * - **Frame**: Top-level container (AppShell instance)
 *
 * ## Usage
 *
 * ```tsx
 * import { BufferProvider, useBuffer, useBufferActions } from '@/lib/buffer'
 *
 * // Wrap your app
 * function App() {
 *   return (
 *     <BufferProvider>
 *       <MyEditor />
 *     </BufferProvider>
 *   )
 * }
 *
 * // Use in components
 * function MyEditor() {
 *   const { create, isReady } = useBufferActions()
 *
 *   const handleNew = async () => {
 *     const buffer = await create('document', 'Untitled', 'ydoc://new')
 *     console.log('Created:', buffer.meta.id)
 *   }
 *
 *   return <button onClick={handleNew} disabled={!isReady}>New</button>
 * }
 * ```
 *
 * @module lib/buffer
 */

// =============================================================================
// Schemas
// =============================================================================

export {
  // Branded IDs
  BufferId,
  WindowId,
  TabId,
  FrameId,
  // Buffer types
  BufferType,
  BufferConnectionState,
  BufferMeta,
  BufferState,
  // Window types
  CursorPosition,
  ScrollState,
  BufferMode,
  SelectionRange,
  WindowState,
  // Tab types
  SplitDirection,
  TabState,
  // Frame types
  FrameBounds,
  FrameState,
  // Layout types
  type TabLayoutNode,
  type TabLayoutWindow,
  type TabLayoutSplit,
  // ID generation
  generateBufferId,
  generateWindowId,
  generateTabId,
  generateFrameId,
  // Layout utilities
  createWindowNode,
  createSplitNode,
  serializeLayoutTree,
  parseLayoutTree,
  collectWindowIds,
  replaceWindowInLayout,
  removeWindowFromLayout,
  // Factory functions
  createBufferMeta,
  createBufferState,
  createWindowState,
  createTabState,
  createFrameState,
} from './schemas'

// =============================================================================
// Atoms
// =============================================================================

export {
  // Registry
  bufferRegistry,
  // Buffer atoms
  buffersAtom,
  bufferAtom,
  bufferIdsAtom,
  dirtyBuffersAtom,
  bufferCountAtom,
  // Window atoms
  windowsAtom,
  windowAtom,
  windowsForBufferAtom,
  focusedWindowIdAtom,
  focusedWindowAtom,
  focusedBufferAtom,
  // Tab atoms
  tabsAtom,
  tabAtom,
  sortedTabsAtom,
  activeTabIdAtom,
  activeTabAtom,
  pinnedTabsAtom,
  tabCountAtom,
  // Frame atoms
  currentFrameIdAtom,
  frameAtom,
  framesAtom,
  // Composite atoms
  workspaceStateAtom,
  bufferStatsAtom,
  // Mutation helpers
  updateBuffer,
  addBuffer,
  removeBuffer,
  updateWindow,
  addWindow,
  removeWindow,
  updateTab,
  addTab,
  removeTab,
} from './atoms'

// =============================================================================
// Services
// =============================================================================

export {
  // Service
  BufferService,
  BufferServiceLive,
  BufferServiceCustom,
  // Config
  BufferServiceConfigTag,
  type BufferServiceConfig,
  type BufferServiceShape,
  // Errors
  BufferNotFoundError,
  BufferConnectionError,
  BufferAlreadyExistsError,
} from './services'

// =============================================================================
// Components
// =============================================================================

export {
  BufferProvider,
  useBufferContext,
  useBufferReady,
  type BufferProviderProps,
  type BufferProviderConfig,
  type BufferContextValue,
} from './components'

// =============================================================================
// Hooks
// =============================================================================

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
} from './hooks'
