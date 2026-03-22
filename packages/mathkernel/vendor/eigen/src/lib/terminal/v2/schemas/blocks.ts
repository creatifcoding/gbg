/**
 * OpenWarp Block Schemas
 *
 * Effect Schema definitions for terminal blocks in OpenWarp mode.
 * Blocks represent discrete units of terminal interaction:
 * - CommandBlock: Shell command execution
 * - AIResponseBlock: AI assistant responses
 * - InteractiveBlock: Long-running processes (vim, htop, etc.)
 * - ErrorBlock: Error messages
 * - SystemBlock: System notifications
 */

import { Schema } from 'effect'

// =============================================================================
// Block Types
// =============================================================================

/**
 * Block type discriminator
 */
export const BlockType = Schema.Literal(
  'command',
  'ai-response',
  'interactive',
  'error',
  'system'
)
export type BlockType = typeof BlockType.Type

// =============================================================================
// Tool Call
// =============================================================================

/**
 * Tool call status
 */
export const ToolCallStatus = Schema.Literal('pending', 'running', 'completed', 'error')
export type ToolCallStatus = typeof ToolCallStatus.Type

/**
 * Tool call within an AI response
 */
export const ToolCall = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  input: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  output: Schema.optional(Schema.String),
  status: ToolCallStatus,
  startTime: Schema.optional(Schema.DateFromSelf),
  endTime: Schema.optional(Schema.DateFromSelf),
})
export type ToolCall = typeof ToolCall.Type

// =============================================================================
// Token Usage
// =============================================================================

export const TokenUsage = Schema.Struct({
  input: Schema.optional(Schema.Number),
  output: Schema.optional(Schema.Number),
  reasoning: Schema.optional(Schema.Number),
  cache: Schema.optional(
    Schema.Struct({
      read: Schema.optional(Schema.Number),
      write: Schema.optional(Schema.Number),
    })
  ),
})
export type TokenUsage = typeof TokenUsage.Type

// =============================================================================
// Block Variants (TaggedStruct for pattern matching)
// =============================================================================

/**
 * Command block - simple shell command execution
 */
export const CommandBlock = Schema.TaggedStruct('command', {
  id: Schema.String,
  command: Schema.String,
  output: Schema.String,
  exitCode: Schema.NullOr(Schema.Number),
  startTime: Schema.DateFromSelf,
  endTime: Schema.NullOr(Schema.DateFromSelf),
  isRunning: Schema.Boolean,
  cwd: Schema.String,
})
export type CommandBlock = typeof CommandBlock.Type

/**
 * AI response block - streaming AI responses with tool calls
 */
export const AIResponseBlock = Schema.TaggedStruct('ai-response', {
  id: Schema.String,
  prompt: Schema.String,
  response: Schema.String,
  model: Schema.String,
  provider: Schema.optional(Schema.String),
  isStreaming: Schema.Boolean,
  startTime: Schema.DateFromSelf,
  endTime: Schema.NullOr(Schema.DateFromSelf),
  tokens: Schema.optional(TokenUsage),
  cost: Schema.optional(Schema.Number),
  duration: Schema.optional(Schema.Number),
  toolCalls: Schema.optional(Schema.Array(ToolCall)),
  thinking: Schema.optional(Schema.String),
})
export type AIResponseBlock = typeof AIResponseBlock.Type

/**
 * Interactive block - long-running process with embedded terminal
 */
export const InteractiveBlock = Schema.TaggedStruct('interactive', {
  id: Schema.String,
  command: Schema.String,
  cwd: Schema.String,
  startTime: Schema.DateFromSelf,
  endTime: Schema.NullOr(Schema.DateFromSelf),
  isRunning: Schema.Boolean,
  exitCode: Schema.NullOr(Schema.Number),
  dismissed: Schema.optional(Schema.Boolean),
})
export type InteractiveBlock = typeof InteractiveBlock.Type

/**
 * Error block - error messages
 */
export const ErrorBlock = Schema.TaggedStruct('error', {
  id: Schema.String,
  message: Schema.String,
  timestamp: Schema.DateFromSelf,
})
export type ErrorBlock = typeof ErrorBlock.Type

/**
 * System block - system notifications
 */
export const SystemBlock = Schema.TaggedStruct('system', {
  id: Schema.String,
  message: Schema.String,
  timestamp: Schema.DateFromSelf,
})
export type SystemBlock = typeof SystemBlock.Type

// =============================================================================
// Block Union
// =============================================================================

/**
 * Union of all block types - enables pattern matching on _tag
 */
export const Block = Schema.Union(
  CommandBlock,
  AIResponseBlock,
  InteractiveBlock,
  ErrorBlock,
  SystemBlock
)
export type Block = typeof Block.Type

// =============================================================================
// Block Creation Helpers
// =============================================================================

/**
 * Simple commands that don't need a full interactive terminal
 */
const SIMPLE_OUTPUT_COMMANDS = [
  'ls',
  'pwd',
  'echo',
  'cat',
  'head',
  'tail',
  'wc',
  'date',
  'whoami',
  'hostname',
  'which',
  'env',
  'printenv',
  'cd',
]

/**
 * Check if a command should run in interactive mode
 */
export function isInteractiveCommand(command: string): boolean {
  const cmd = command.trim().split(/\s+/)[0]
  return !SIMPLE_OUTPUT_COMMANDS.includes(cmd)
}

/**
 * Create a new command block
 */
export function createCommandBlock(command: string, cwd: string): CommandBlock {
  return {
    _tag: 'command',
    id: crypto.randomUUID(),
    command,
    output: '',
    exitCode: null,
    startTime: new Date(),
    endTime: null,
    isRunning: true,
    cwd,
  }
}

/**
 * Create a new AI response block
 */
export function createAIResponseBlock(prompt: string, model: string): AIResponseBlock {
  return {
    _tag: 'ai-response',
    id: crypto.randomUUID(),
    prompt,
    response: '',
    model,
    isStreaming: true,
    startTime: new Date(),
    endTime: null,
  }
}

/**
 * Create a new interactive block
 */
export function createInteractiveBlock(command: string, cwd: string): InteractiveBlock {
  return {
    _tag: 'interactive',
    id: crypto.randomUUID(),
    command,
    cwd,
    startTime: new Date(),
    endTime: null,
    isRunning: true,
    exitCode: null,
  }
}

/**
 * Create an error block
 */
export function createErrorBlock(message: string): ErrorBlock {
  return {
    _tag: 'error',
    id: crypto.randomUUID(),
    message,
    timestamp: new Date(),
  }
}

/**
 * Create a system block
 */
export function createSystemBlock(message: string): SystemBlock {
  return {
    _tag: 'system',
    id: crypto.randomUUID(),
    message,
    timestamp: new Date(),
  }
}

// =============================================================================
// Block State
// =============================================================================

/**
 * OpenWarp block terminal state
 */
export const BlockTerminalState = Schema.Struct({
  blocks: Schema.Array(Block),
  cwd: Schema.String,
  maxBlocks: Schema.Number,
})
export type BlockTerminalState = typeof BlockTerminalState.Type

/**
 * Initial block terminal state
 */
export const INITIAL_BLOCK_STATE: BlockTerminalState = {
  blocks: [],
  cwd: '',
  maxBlocks: 500,
}

// =============================================================================
// Block Helpers
// =============================================================================

/**
 * Get block creation time for sorting
 */
export function getBlockTime(block: Block): Date {
  switch (block._tag) {
    case 'error':
    case 'system':
      return block.timestamp
    default:
      return block.startTime
  }
}

/**
 * Check if a block is still active/running
 */
export function isBlockActive(block: Block): boolean {
  switch (block._tag) {
    case 'command':
    case 'interactive':
      return block.isRunning
    case 'ai-response':
      return block.isStreaming
    default:
      return false
  }
}
