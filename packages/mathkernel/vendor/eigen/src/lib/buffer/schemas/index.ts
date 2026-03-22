/**
 * Buffer Schemas - Public API
 *
 * @module lib/buffer/schemas
 */

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
} from './buffer'
