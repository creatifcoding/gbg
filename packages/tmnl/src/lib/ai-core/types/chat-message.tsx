/**
 * ChatMessage Unified Type
 *
 * Unified message format for the chat UI layer that abstracts over
 * AI SDK UIMessage. This provides a clean interface for rendering
 * while the underlying data source can be swapped via dependency injection.
 *
 * Uses Effect Schema for runtime validation and type inference.
 *
 * @example
 * ```tsx
 * import { uiMessageToChatMessage } from '@/lib/ai-core/types/chat-message'
 * import type { UIMessage } from 'ai'
 *
 * function renderMessages(uiMessages: UIMessage[]) {
 *   const chatMessages = uiMessages.map(uiMessageToChatMessage)
 *   return chatMessages.map(msg => <MessageRenderer message={msg} />)
 * }
 * ```
 */

import { Schema } from 'effect'
import type { UIMessage, ToolUIPart } from 'ai'

// =============================================================================
// Branded Types
// =============================================================================

/**
 * Branded type for chat message IDs
 */
export const ChatMessageId = Schema.String.pipe(Schema.brand('ChatMessageId'))
export type ChatMessageId = typeof ChatMessageId.Type

/**
 * Branded type for tool call IDs
 */
export const ToolCallId = Schema.String.pipe(Schema.brand('ToolCallId'))
export type ToolCallId = typeof ToolCallId.Type

// =============================================================================
// Tool Call Info
// =============================================================================

/**
 * Tool call status derived from AI SDK ToolUIPart.state
 */
export const ToolCallStatus = Schema.Literal('pending', 'running', 'complete', 'error')
export type ToolCallStatus = typeof ToolCallStatus.Type

/**
 * Tool call information extracted from AI SDK ToolUIPart
 */
export class ToolCallInfo extends Schema.Class<ToolCallInfo>('ToolCallInfo')({
  /** Unique tool call ID */
  toolCallId: Schema.String,
  /** Tool name (without mcp__ prefix) */
  toolName: Schema.String,
  /** Tool arguments */
  args: Schema.Unknown,
  /** Current status */
  status: ToolCallStatus,
  /** Result when complete */
  result: Schema.NullOr(Schema.Unknown),
  /** Error text when failed */
  errorText: Schema.NullOr(Schema.String),
}) {
  /**
   * Get display name (strips mcp__ prefix)
   */
  get displayName(): string {
    if (this.toolName.startsWith('mcp__')) {
      return this.toolName.split('__').slice(-1)[0]
    }
    return this.toolName
  }

  /**
   * Whether this tool call is still in progress
   */
  get isInProgress(): boolean {
    return this.status === 'pending' || this.status === 'running'
  }

  /**
   * Whether this is a design-related tool
   */
  get isDesignTool(): boolean {
    const name = this.displayName.toLowerCase()
    return ['apply_style', 'suggest_prop', 'modify_style'].includes(name)
  }
}

// =============================================================================
// Chat Message Role
// =============================================================================

/**
 * Chat message role
 */
export const ChatMessageRole = Schema.Literal('user', 'assistant', 'system')
export type ChatMessageRole = typeof ChatMessageRole.Type

// =============================================================================
// Chat Message
// =============================================================================

/**
 * Unified chat message format for the UI layer.
 * Abstracts over AI SDK UIMessage for clean rendering.
 */
export class ChatMessage extends Schema.Class<ChatMessage>('ChatMessage')({
  /** Unique message ID */
  id: Schema.String,
  /** Message role */
  role: ChatMessageRole,
  /** Text content (user text or assistant response) */
  text: Schema.NullOr(Schema.String),
  /** AI thinking/reasoning (assistant only) */
  thinking: Schema.NullOr(Schema.String),
  /** Tool calls (assistant only) */
  toolCalls: Schema.Array(ToolCallInfo),
  /** Whether this message is currently streaming */
  isStreaming: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** Timestamp */
  createdAt: Schema.NullOr(Schema.Number),
}) {
  /**
   * Whether this message has any text content
   */
  get hasText(): boolean {
    return this.text !== null && this.text.length > 0
  }

  /**
   * Whether this message has any tool calls
   */
  get hasToolCalls(): boolean {
    return this.toolCalls.length > 0
  }

  /**
   * Whether this message has thinking/reasoning
   */
  get hasThinking(): boolean {
    return this.thinking !== null && this.thinking.length > 0
  }

  /**
   * Get completed tool calls
   */
  get completedToolCalls(): readonly ToolCallInfo[] {
    return this.toolCalls.filter((tc) => tc.status === 'complete')
  }

  /**
   * Get pending/running tool calls
   */
  get pendingToolCalls(): readonly ToolCallInfo[] {
    return this.toolCalls.filter((tc) => tc.isInProgress)
  }
}

// =============================================================================
// Conversion Functions
// =============================================================================

/**
 * Extract tool name from ToolUIPart type field.
 * AI SDK uses 'tool-{toolName}' format.
 */
function extractToolName(type: string): string {
  return type.replace(/^tool-/, '')
}

/**
 * Convert AI SDK ToolUIPart state to our status.
 * AI SDK states: 'input-streaming', 'input-available', 'approval-requested',
 * 'approval-responded', 'output-available', 'output-error', 'output-denied'
 */
function toolStateToStatus(state: string): ToolCallStatus {
  switch (state) {
    case 'input-streaming':
      return 'pending'
    case 'input-available':
    case 'approval-requested':
    case 'approval-responded':
      return 'running'
    case 'output-available':
      return 'complete'
    case 'output-error':
    case 'output-denied':
      return 'error'
    default:
      return 'running'
  }
}

/**
 * Convert AI SDK UIMessage to ChatMessage
 */
export function uiMessageToChatMessage(msg: UIMessage, isStreaming = false): ChatMessage {
  let text: string | null = null
  let thinking: string | null = null
  const toolCalls: ToolCallInfo[] = []

  // DEBUG: Log message structure to trace tool rendering issues
  if (process.env.NODE_ENV !== 'production') {
    const partTypes = (msg.parts ?? []).map((p) => p.type)
    if (partTypes.some((t) => t.startsWith('tool-') || t === 'dynamic-tool')) {
      console.log('[uiMessageToChatMessage] Message with tools:', {
        id: msg.id,
        role: msg.role,
        partTypes,
        parts: msg.parts,
      })
    }
  }

  // Handle messages that may have parts array or just content string
  // User messages from append() may only have content, not parts
  const parts = msg.parts ?? []

  // If no parts but has content (common for user messages), use content directly
  if (parts.length === 0 && 'content' in msg && typeof msg.content === 'string') {
    text = msg.content
  } else {
    // Process parts array
    for (const part of parts) {
      if (part.type === 'text') {
        // Concatenate text parts
        text = text ? text + part.text : part.text
      } else if (part.type === 'reasoning') {
        // AI SDK v6 reasoning has 'text' property
        const reasoningText = (part as { text?: string }).text ?? ''
        thinking = thinking ? thinking + reasoningText : reasoningText
      } else if (part.type === 'dynamic-tool') {
        // Dynamic tool part (for MCP and other dynamically typed tools)
        const dynamicPart = part as {
          type: 'dynamic-tool'
          toolName: string
          toolCallId: string
          input?: unknown
          state: string
          output?: unknown
          errorText?: string
        }
        toolCalls.push(
          new ToolCallInfo({
            toolCallId: dynamicPart.toolCallId,
            toolName: dynamicPart.toolName,
            args: dynamicPart.input,
            status: toolStateToStatus(dynamicPart.state),
            result: dynamicPart.state === 'output-available' ? dynamicPart.output : null,
            errorText: dynamicPart.state === 'output-error' ? dynamicPart.errorText ?? null : null,
          })
        )
      } else if (part.type.startsWith('tool-')) {
        // Static tool call part (tool-{name} format)
        const toolPart = part as ToolUIPart
        toolCalls.push(
          new ToolCallInfo({
            toolCallId: toolPart.toolCallId,
            toolName: extractToolName(part.type),
            args: toolPart.input,
            status: toolStateToStatus(toolPart.state),
            result: toolPart.state === 'output-available' ? toolPart.output : null,
            errorText: toolPart.state === 'output-error' ? (toolPart as { errorText?: string }).errorText ?? null : null,
          })
        )
      }
    }
  }

  return new ChatMessage({
    id: msg.id,
    role: msg.role as ChatMessageRole,
    text,
    thinking,
    toolCalls,
    isStreaming,
    createdAt: Date.now(),
  })
}

/**
 * Convert array of AI SDK UIMessage to ChatMessage array
 */
export function uiMessagesToChatMessages(
  messages: UIMessage[],
  streamingMessageId?: string
): ChatMessage[] {
  return messages.map((msg) => uiMessageToChatMessage(msg, msg.id === streamingMessageId))
}

/**
 * Create a user ChatMessage from text
 */
export function createUserMessage(text: string, id?: string): ChatMessage {
  return new ChatMessage({
    id: id ?? `user-${Date.now()}`,
    role: 'user',
    text,
    thinking: null,
    toolCalls: [],
    isStreaming: false,
    createdAt: Date.now(),
  })
}

/**
 * Create a system ChatMessage from text
 */
export function createSystemMessage(text: string, id?: string): ChatMessage {
  return new ChatMessage({
    id: id ?? `system-${Date.now()}`,
    role: 'system',
    text,
    thinking: null,
    toolCalls: [],
    isStreaming: false,
    createdAt: Date.now(),
  })
}
