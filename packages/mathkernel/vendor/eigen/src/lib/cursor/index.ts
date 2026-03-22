/**
 * Cursor System
 *
 * Global, AI-controlled Dynamic Island overlay with:
 * - AI SDK 6 + Claude Code Provider integration
 * - Position control via AI tools (move_to, minimize, expand)
 * - Pill ↔ Chat state transitions
 * - Drag physics with backpressure
 * - Bottom-right default positioning
 */

// Schemas
export * from './schemas/position'

// Services
export { PositionService, PositionServiceLive, PositionServiceDefault } from './services/PositionService'
export {
  IntentParser,
  IntentParserLive,
  IntentParserDefault,
  type PositionIntent,
  type VisibilityIntent,
  type Intent,
  parsePositionIntent,
  parseIntent,
} from './services/IntentParser'

// Machines
export {
  cursorMachine,
  type CursorMachineContext,
  type CursorMachineEvent,
  type CursorMachineSnapshot,
  type CursorMachineState,
  getCursorState,
  isCursorInteractive,
  isCursorExpanded,
} from './machines'

// Atoms
export {
  // Registry
  cursorRegistry,
  CursorRegistryProvider,
  // Runtime
  cursorRuntimeAtom,
  // State atoms
  messagesAtom,
  statusAtom,
  positionAtom,
  boundsAtom,
  currentCornerAtom,
  cursorStateAtom,
  sizeKeyAtom,
  customSizeAtom,
  isResizingAtom,
  RESIZE_CONSTRAINTS,
  // Derived atoms
  hasBoundsAtom,
  // XState bridge (stx pattern)
  cursorSnapshotAtom,
  machineStateAtom,
  machineContextAtom,
  isExpandedAtom,
  hasUnreadAtom,
  canExpandAtom,
  canCollapseAtom,
  // Operations
  cursorOps,
  cursorActorOps,
} from './atoms'

// Tools
export * from './tools'

// Hooks
export { useCursorPersistence } from './hooks'

// Components
export { Cursor } from './components/Cursor'
export { DynamicIsland, DynamicIslandProvider, useDynamicIsland } from './components/DynamicIsland'
export { ChatContent } from './components/ChatContent'
export { PillIndicator } from './components/PillIndicator'
export { ResizeHandles } from './components/ResizeHandles'
