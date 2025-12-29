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

// Atoms
export {
  cursorRuntimeAtom,
  messagesAtom,
  statusAtom,
  positionAtom,
  boundsAtom,
  currentCornerAtom,
  cursorStateAtom,
  sizeKeyAtom,
  hasBoundsAtom,
  cursorOps,
} from './atoms'

// Tools
export * from './tools'

// Components
export { Cursor } from './components/Cursor'
export { DynamicIsland, DynamicIslandProvider, useDynamicIsland } from './components/DynamicIsland'
export { ChatContent } from './components/ChatContent'
export { PillIndicator } from './components/PillIndicator'
