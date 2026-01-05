/**
 * Terminal v3 Block Schemas
 *
 * Reference-based blocks: AI blocks store streamRef pointing to ai-core state,
 * NOT copies of response text. This eliminates the dual-write problem.
 *
 * Content is derived via useAIBlockContent() hook, which reads from
 * ai-core's streamStateByIdAtom(block.streamRef.requestId)
 */

import { Schema } from 'effect'

// =============================================================================
// Stream Reference (links block to ai-core state)
// =============================================================================

/**
 * Reference to an ai-core stream state
 * Used by AIResponseBlockV3 to derive content instead of copying it
 */
export const StreamRef = Schema.Struct({
  /** Unique request ID from AICoreService.streamChat() */
  requestId: Schema.String,
  /** Model used for this stream (e.g., 'claude-sonnet-4-20250514') */
  modelId: Schema.String,
  /** Provider (e.g., 'anthropic', 'openai', 'claude-code') */
  provider: Schema.String,
})
export type StreamRef = typeof StreamRef.Type

// =============================================================================
// Block Schemas
// =============================================================================

/**
 * AI Response Block v3 - REFERENCES ai-core, doesn't copy content
 *
 * The block stores only:
 * - prompt: What the user asked
 * - streamRef: Reference to look up content from ai-core
 *
 * Content (text, thinking, toolCalls, status) is derived via:
 * useAIBlockContent(block) → streamStateByIdAtom(block.streamRef.requestId)
 */
export const AIResponseBlockV3 = Schema.TaggedStruct('ai-response', {
  id: Schema.String,
  /** User's original prompt */
  prompt: Schema.String,
  /** Reference to ai-core stream state - content derived from here */
  streamRef: StreamRef,
  /** When the block was created */
  createdAt: Schema.DateFromSelf,
})
export type AIResponseBlockV3 = typeof AIResponseBlockV3.Type

/**
 * Command Block - shell command execution
 * For simple (non-interactive) commands, stores output directly
 */
export const CommandBlockV3 = Schema.TaggedStruct('command', {
  id: Schema.String,
  /** The command that was executed */
  command: Schema.String,
  /** Working directory where command ran */
  cwd: Schema.String,
  /** PTY ID if running (null if completed) */
  ptyId: Schema.NullOr(Schema.String),
  /** Command output (captured for non-interactive commands) */
  output: Schema.String,
  /** Exit code (null if still running) */
  exitCode: Schema.NullOr(Schema.Number),
  /** When execution started */
  startTime: Schema.DateFromSelf,
  /** When execution ended (null if still running) */
  endTime: Schema.NullOr(Schema.DateFromSelf),
})
export type CommandBlockV3 = typeof CommandBlockV3.Type

/**
 * Interactive Block - long-running PTY process (vim, htop, etc.)
 */
export const InteractiveBlockV3 = Schema.TaggedStruct('interactive', {
  id: Schema.String,
  /** The command that spawned the interactive session */
  command: Schema.String,
  /** Working directory */
  cwd: Schema.String,
  /** PTY handle ID for interaction */
  ptyId: Schema.String,
  /** When the session started */
  startTime: Schema.DateFromSelf,
  /** When the session ended (null if still running) */
  endTime: Schema.NullOr(Schema.DateFromSelf),
  /** Whether the user dismissed this block */
  dismissed: Schema.optional(Schema.Boolean),
})
export type InteractiveBlockV3 = typeof InteractiveBlockV3.Type

/**
 * System Block - informational messages (cwd changes, etc.)
 */
export const SystemBlockV3 = Schema.TaggedStruct('system', {
  id: Schema.String,
  /** System message content */
  message: Schema.String,
  /** When the message was generated */
  timestamp: Schema.DateFromSelf,
})
export type SystemBlockV3 = typeof SystemBlockV3.Type

/**
 * Error Block - error messages
 */
export const ErrorBlockV3 = Schema.TaggedStruct('error', {
  id: Schema.String,
  /** Error message */
  message: Schema.String,
  /** When the error occurred */
  timestamp: Schema.DateFromSelf,
})
export type ErrorBlockV3 = typeof ErrorBlockV3.Type

// =============================================================================
// Block Union
// =============================================================================

/**
 * Block v3 discriminated union
 */
export const BlockV3 = Schema.Union(
  AIResponseBlockV3,
  CommandBlockV3,
  InteractiveBlockV3,
  SystemBlockV3,
  ErrorBlockV3,
)
export type BlockV3 = typeof BlockV3.Type

// =============================================================================
// Block Type Guards
// =============================================================================

export const isAIResponseBlock = (block: BlockV3): block is AIResponseBlockV3 =>
  block._tag === 'ai-response'

export const isCommandBlock = (block: BlockV3): block is CommandBlockV3 =>
  block._tag === 'command'

export const isInteractiveBlock = (block: BlockV3): block is InteractiveBlockV3 =>
  block._tag === 'interactive'

export const isSystemBlock = (block: BlockV3): block is SystemBlockV3 =>
  block._tag === 'system'

export const isErrorBlock = (block: BlockV3): block is ErrorBlockV3 =>
  block._tag === 'error'

/**
 * Check if block is active (running/streaming)
 */
export const isBlockActive = (block: BlockV3): boolean => {
  switch (block._tag) {
    case 'ai-response':
      // AI blocks check ai-core state, but we can infer from endTime being set
      // For full check, use isStreamActiveById(block.streamRef.requestId)
      return true // Caller should check ai-core state
    case 'command':
      return block.exitCode === null
    case 'interactive':
      return block.endTime === null && !block.dismissed
    default:
      return false
  }
}

// =============================================================================
// Block Factories
// =============================================================================

let blockCounter = 0

const generateBlockId = (): string => {
  blockCounter++
  return `block-${Date.now()}-${blockCounter.toString(36)}`
}

/**
 * Create an AI response block with stream reference
 */
export const createAIResponseBlock = (
  prompt: string,
  streamRef: StreamRef,
): AIResponseBlockV3 => ({
  _tag: 'ai-response',
  id: generateBlockId(),
  prompt,
  streamRef,
  createdAt: new Date(),
})

/**
 * Create a command block
 */
export const createCommandBlock = (
  command: string,
  cwd: string,
): CommandBlockV3 => ({
  _tag: 'command',
  id: generateBlockId(),
  command,
  cwd,
  ptyId: null,
  output: '',
  exitCode: null,
  startTime: new Date(),
  endTime: null,
})

/**
 * Create an interactive block
 */
export const createInteractiveBlock = (
  command: string,
  cwd: string,
  ptyId: string,
): InteractiveBlockV3 => ({
  _tag: 'interactive',
  id: generateBlockId(),
  command,
  cwd,
  ptyId,
  startTime: new Date(),
  endTime: null,
})

/**
 * Create a system block
 */
export const createSystemBlock = (message: string): SystemBlockV3 => ({
  _tag: 'system',
  id: generateBlockId(),
  message,
  timestamp: new Date(),
})

/**
 * Create an error block
 */
export const createErrorBlock = (message: string): ErrorBlockV3 => ({
  _tag: 'error',
  id: generateBlockId(),
  message,
  timestamp: new Date(),
})
