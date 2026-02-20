/**
 * Conversation Thread Management — genifer conversation state
 *
 * Schemas for multi-turn LLM conversations that produce genifer UI trees.
 *
 * Aligned with harness:
 *   - MessageRole maps to morphchat ChatRole
 *   - MessageContent union matches ChatMessagePart types
 *   - Thread.messages is append-only (like HarnessEvent log)
 *
 * @module genifer/core/threads
 */

import { Schema } from 'effect'

// =============================================================================
// Message Content (tagged union matching morphchat ChatMessagePart)
// =============================================================================

export const TextContent = Schema.TaggedStruct('text', {
  text: Schema.String,
})
export type TextContent = typeof TextContent.Type

export const UITreeContent = Schema.TaggedStruct('ui-tree', {
  /** Serialized UITree JSON */
  treeJson: Schema.String,
  /** Number of components in the tree */
  componentCount: Schema.optional(Schema.Number),
})
export type UITreeContent = typeof UITreeContent.Type

export const ToolCallContent = Schema.TaggedStruct('tool-call', {
  toolCallId: Schema.String,
  toolName: Schema.String,
  args: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
})
export type ToolCallContent = typeof ToolCallContent.Type

export const ToolResultContent = Schema.TaggedStruct('tool-result', {
  toolCallId: Schema.String,
  toolName: Schema.String,
  content: Schema.String,
  isError: Schema.Boolean,
})
export type ToolResultContent = typeof ToolResultContent.Type

export const ThinkingContent = Schema.TaggedStruct('thinking', {
  text: Schema.String,
  durationMs: Schema.optional(Schema.Number),
})
export type ThinkingContent = typeof ThinkingContent.Type

export const MessageContent = Schema.Union(
  TextContent,
  UITreeContent,
  ToolCallContent,
  ToolResultContent,
  ThinkingContent,
)
export type MessageContent = typeof MessageContent.Type

// =============================================================================
// Message Role (aligned with morphchat ChatRole)
// =============================================================================

export const MessageRole = Schema.Literal('user', 'assistant', 'system', 'tool')
export type MessageRole = typeof MessageRole.Type

// =============================================================================
// Message
// =============================================================================

export class ThreadMessage extends Schema.Class<ThreadMessage>('ThreadMessage')({
  /** Unique message ID */
  id: Schema.String,
  /** Author role */
  role: MessageRole,
  /** Structured content blocks */
  content: Schema.Array(MessageContent),
  /** ISO timestamp */
  timestamp: Schema.String,
  /** Model that produced this message (for assistant messages) */
  model: Schema.optional(Schema.String),
  /** Token usage */
  tokenUsage: Schema.optional(Schema.Struct({
    prompt: Schema.Number,
    completion: Schema.Number,
    total: Schema.Number,
  })),
}) {
  /** Extract flat text from all text content blocks */
  get textContent(): string {
    return this.content
      .filter((c): c is TextContent => c._tag === 'text')
      .map((c) => c.text)
      .join('')
  }

  /** Check if message has UI tree content */
  get hasUITree(): boolean {
    return this.content.some((c) => c._tag === 'ui-tree')
  }
}

// =============================================================================
// Turn (user + assistant pair)
// =============================================================================

export class Turn extends Schema.Class<Turn>('Turn')({
  /** The user's message */
  userMessage: ThreadMessage,
  /** The assistant's response */
  assistantMessage: Schema.optional(ThreadMessage),
  /** Intermediate messages between user and assistant (tool calls, system, etc.) */
  intermediate: Schema.Array(ThreadMessage),
  /** Turn index (0-based) */
  index: Schema.Number,
}) {}

// =============================================================================
// Thread
// =============================================================================

export class Thread extends Schema.Class<Thread>('Thread')({
  /** Unique thread ID */
  id: Schema.String,
  /** Ordered messages (append-only) */
  messages: Schema.Array(ThreadMessage),
  /** Thread title (auto-generated or user-set) */
  title: Schema.optional(Schema.String),
  /** Creation timestamp */
  createdAt: Schema.String,
  /** Last activity timestamp */
  updatedAt: Schema.String,
  /** Metadata bag */
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  /** Parent thread ID (for forked threads) */
  parentThreadId: Schema.optional(Schema.String),
  /** Fork point: message index in parent where this thread branched */
  forkAtIndex: Schema.optional(Schema.Number),
}) {
  get messageCount(): number {
    return this.messages.length
  }

  get lastMessage(): ThreadMessage | undefined {
    return this.messages[this.messages.length - 1]
  }

  /**
   * Extract conversation turns with role-aware scanning.
   *
   * A turn starts with a 'user' message and extends until the next
   * 'assistant' message (inclusive). Tool/system messages between
   * user→assistant are captured as `intermediate`.
   *
   * Handles: interleaved tool calls, multiple system messages,
   * trailing user without response, consecutive assistant messages.
   */
  get turns(): Turn[] {
    const turns: Turn[] = []
    let turnIndex = 0
    let i = 0

    while (i < this.messages.length) {
      const msg = this.messages[i]

      if (msg.role === 'user') {
        const intermediate: ThreadMessage[] = []
        let assistantMessage: ThreadMessage | undefined

        // Scan forward for intermediate + assistant
        let j = i + 1
        while (j < this.messages.length) {
          const next = this.messages[j]
          if (next.role === 'assistant') {
            assistantMessage = next
            j++
            break
          }
          if (next.role === 'user') {
            // Next user message — this turn has no assistant response
            break
          }
          // tool / system — collect as intermediate
          intermediate.push(next)
          j++
        }

        turns.push(
          new Turn({
            userMessage: msg,
            assistantMessage,
            intermediate,
            index: turnIndex++,
          }),
        )
        i = j
      } else {
        // Skip non-user messages at the start (system preamble, etc.)
        i++
      }
    }
    return turns
  }
}
