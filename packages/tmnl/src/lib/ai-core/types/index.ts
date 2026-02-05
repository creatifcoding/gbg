/**
 * AI Core Types
 *
 * Unified type definitions for the AI core module.
 */

export {
  // Branded types
  ChatMessageId,
  ToolCallId,
  // Schemas
  ToolCallStatus,
  ToolCallInfo,
  ChatMessageRole,
  ChatMessage,
  // Conversion functions
  uiMessageToChatMessage,
  uiMessagesToChatMessages,
  createUserMessage,
  createSystemMessage,
} from './chat-message'

// Type-only exports
export type {
  ChatMessageId as ChatMessageIdType,
  ToolCallId as ToolCallIdType,
  ToolCallStatus as ToolCallStatusType,
  ChatMessageRole as ChatMessageRoleType,
} from './chat-message'
