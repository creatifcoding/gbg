/**
 * AI Core Message Schemas
 *
 * Message types compatible with AI SDK 5.0+ format.
 * Uses Effect Schema for runtime validation and type inference.
 *
 * Message format follows AI SDK UIMessage structure:
 * - role: user | assistant | system
 * - parts: array of content parts (text, tool calls, tool results)
 */

import { Schema } from 'effect'

// =============================================================================
// Message Roles
// =============================================================================

/**
 * Message role in conversation
 */
export const MessageRole = Schema.Literal('user', 'assistant', 'system')
export type MessageRole = typeof MessageRole.Type

// =============================================================================
// Content Parts (AI SDK 5.0+ format)
// =============================================================================

/**
 * Text content part
 */
export class TextPart extends Schema.TaggedClass<TextPart>()('text', {
  text: Schema.String,
}) {}

/**
 * Image content part (base64 or URL)
 */
export class ImagePart extends Schema.TaggedClass<ImagePart>()('image', {
  /** Base64 encoded image data */
  image: Schema.String,
  /** MIME type (e.g., image/png, image/jpeg) */
  mimeType: Schema.NullOr(Schema.String),
}) {}

/**
 * File content part (for document attachments)
 */
export class FilePart extends Schema.TaggedClass<FilePart>()('file', {
  /** Base64 encoded file data */
  data: Schema.String,
  /** MIME type */
  mimeType: Schema.String,
  /** Original filename */
  filename: Schema.NullOr(Schema.String),
}) {}

/**
 * Tool call part (assistant requesting tool execution)
 */
export class ToolCallPart extends Schema.TaggedClass<ToolCallPart>()('tool-call', {
  toolCallId: Schema.String,
  toolName: Schema.String,
  args: Schema.Unknown,
}) {}

/**
 * Tool result part (user providing tool execution result)
 */
export class ToolResultPart extends Schema.TaggedClass<ToolResultPart>()('tool-result', {
  toolCallId: Schema.String,
  toolName: Schema.String,
  result: Schema.Unknown,
  isError: Schema.optionalWith(Schema.Boolean, { default: () => false }),
}) {}

/**
 * Union of all content part types
 */
export const ContentPart = Schema.Union(TextPart, ImagePart, FilePart, ToolCallPart, ToolResultPart)
export type ContentPart = typeof ContentPart.Type

// =============================================================================
// Message Types
// =============================================================================

/**
 * Base message fields
 */
const MessageBase = {
  /** Unique message ID */
  id: Schema.String,
  /** Timestamp when message was created */
  createdAt: Schema.NullOr(Schema.Number),
}

/**
 * User message
 */
export class UserMessage extends Schema.TaggedClass<UserMessage>()('UserMessage', {
  ...MessageBase,
  role: Schema.Literal('user'),
  parts: Schema.Array(Schema.Union(TextPart, ImagePart, FilePart, ToolResultPart)),
}) {}

/**
 * Assistant message
 */
export class AssistantMessage extends Schema.TaggedClass<AssistantMessage>()('AssistantMessage', {
  ...MessageBase,
  role: Schema.Literal('assistant'),
  parts: Schema.Array(Schema.Union(TextPart, ToolCallPart)),
}) {}

/**
 * System message
 */
export class SystemMessage extends Schema.TaggedClass<SystemMessage>()('SystemMessage', {
  ...MessageBase,
  role: Schema.Literal('system'),
  parts: Schema.Array(TextPart),
}) {}

/**
 * Union of all message types
 */
export const Message = Schema.Union(UserMessage, AssistantMessage, SystemMessage)
export type Message = typeof Message.Type

// =============================================================================
// Conversation
// =============================================================================

/**
 * A conversation is an ordered list of messages
 */
export const Conversation = Schema.Array(Message)
export type Conversation = typeof Conversation.Type

// =============================================================================
// Message Factories
// =============================================================================

let messageCounter = 0

/**
 * Generate a unique message ID
 */
const generateMessageId = (): string => `msg-${Date.now()}-${++messageCounter}`

/**
 * Create a user message with text content
 */
export const userMessage = (text: string, id?: string): UserMessage =>
  new UserMessage({
    id: id ?? generateMessageId(),
    role: 'user',
    parts: [new TextPart({ text })],
    createdAt: Date.now(),
  })

/**
 * Create a user message with tool result
 */
export const toolResultMessage = (
  toolCallId: string,
  toolName: string,
  result: unknown,
  isError = false,
  id?: string
): UserMessage =>
  new UserMessage({
    id: id ?? generateMessageId(),
    role: 'user',
    parts: [new ToolResultPart({ toolCallId, toolName, result, isError })],
    createdAt: Date.now(),
  })

/**
 * Create an assistant message with text content
 */
export const assistantMessage = (text: string, id?: string): AssistantMessage =>
  new AssistantMessage({
    id: id ?? generateMessageId(),
    role: 'assistant',
    parts: [new TextPart({ text })],
    createdAt: Date.now(),
  })

/**
 * Create an assistant message with tool call
 */
export const toolCallMessage = (
  toolCallId: string,
  toolName: string,
  args: unknown,
  id?: string
): AssistantMessage =>
  new AssistantMessage({
    id: id ?? generateMessageId(),
    role: 'assistant',
    parts: [new ToolCallPart({ toolCallId, toolName, args })],
    createdAt: Date.now(),
  })

/**
 * Create a system message
 */
export const systemMessage = (text: string, id?: string): SystemMessage =>
  new SystemMessage({
    id: id ?? generateMessageId(),
    role: 'system',
    parts: [new TextPart({ text })],
    createdAt: Date.now(),
  })

// =============================================================================
// Message Utilities
// =============================================================================

/**
 * Extract all text content from a message
 */
export const getMessageText = (message: Message): string =>
  message.parts
    .filter((p): p is TextPart => p._tag === 'text')
    .map((p) => p.text)
    .join('')

/**
 * Check if message contains tool calls
 */
export const hasToolCalls = (message: Message): boolean =>
  message._tag === 'AssistantMessage' && message.parts.some((p) => p._tag === 'tool-call')

/**
 * Extract tool calls from an assistant message
 */
export const getToolCalls = (message: Message): readonly ToolCallPart[] =>
  message._tag === 'AssistantMessage'
    ? message.parts.filter((p): p is ToolCallPart => p._tag === 'tool-call')
    : []

/**
 * Check if message contains tool results
 */
export const hasToolResults = (message: Message): boolean =>
  message._tag === 'UserMessage' && message.parts.some((p) => p._tag === 'tool-result')

/**
 * Extract tool results from a user message
 */
export const getToolResults = (message: Message): readonly ToolResultPart[] =>
  message._tag === 'UserMessage'
    ? message.parts.filter((p): p is ToolResultPart => p._tag === 'tool-result')
    : []

// =============================================================================
// Conversion to AI SDK Format
// =============================================================================

/**
 * Convert Message to AI SDK format (for sending to providers)
 */
export const toAISDKMessage = (
  message: Message
): {
  role: 'user' | 'assistant' | 'system'
  parts: Array<{ type: string; [key: string]: unknown }>
} => ({
  role: message.role,
  parts: message.parts.map((part) => {
    switch (part._tag) {
      case 'text':
        return { type: 'text', text: part.text }
      case 'image':
        return { type: 'image', image: part.image }
      case 'file':
        return { type: 'file', data: part.data, mimeType: part.mimeType }
      case 'tool-call':
        return { type: 'tool-call', toolCallId: part.toolCallId, toolName: part.toolName, args: part.args }
      case 'tool-result':
        return {
          type: 'tool-result',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          result: part.result,
          isError: part.isError,
        }
    }
  }),
})

/**
 * Convert conversation to AI SDK format
 */
export const toAISDKConversation = (
  conversation: Conversation
): Array<{ role: 'user' | 'assistant' | 'system'; parts: Array<{ type: string; [key: string]: unknown }> }> =>
  conversation.map(toAISDKMessage)
