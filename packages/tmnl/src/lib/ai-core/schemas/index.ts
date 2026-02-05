/**
 * AI Core Schemas
 *
 * Re-exports all schema types for the AI Core module.
 */

// Errors
export {
  // Error types
  AICoreConnectionError,
  AICoreStreamError,
  AICoreProviderNotFoundError,
  AICoreProviderExistsError,
  AICoreProviderConfigError,
  AICoreToolExecutionError,
  AICoreToolNotFoundError,
  // Union
  AICoreError,
  // Phase literal
  StreamPhase,
  // Utilities
  isRetryable,
  getErrorMessage,
} from './errors'

// Stream events
export {
  // Content events
  TextDelta,
  ThinkingDelta,
  // Tool events
  ToolCallStart,
  ToolCallDelta,
  ToolCallComplete,
  ToolResult,
  // Lifecycle events
  StreamStart,
  StreamComplete,
  StreamError,
  // Union
  AIStreamEvent,
  // State
  StreamStatus,
  StreamState,
  TokenUsage,
  FinishReason,
  // Utilities
  isContentEvent,
  isToolEvent,
  isLifecycleEvent,
  isTerminalEvent,
} from './stream'

// Messages
export {
  // Roles
  MessageRole,
  // Parts
  TextPart,
  ImagePart,
  FilePart,
  ToolCallPart,
  ToolResultPart,
  ContentPart,
  // Messages
  UserMessage,
  AssistantMessage,
  SystemMessage,
  Message,
  Conversation,
  // Factories
  userMessage,
  assistantMessage,
  systemMessage,
  toolResultMessage,
  toolCallMessage,
  // Utilities
  getMessageText,
  hasToolCalls,
  getToolCalls,
  hasToolResults,
  getToolResults,
  toAISDKMessage,
  toAISDKConversation,
} from './message'

// Tools
export {
  // JSON Schema
  JSONSchemaType,
  // Tool definition
  ToolDefinition,
  // Tool call lifecycle
  ToolCallStatus,
  ToolCallRequest,
  ToolCallResult,
  ActiveToolCall,
  // Registry
  AggregatedTool,
  ToolRegistryState,
  // Conversion
  toAISDKTool,
  toAISDKTools,
  fromMCPTool,
  fromMCPTools,
} from './tool'

// Type-only exports for interfaces
export type { JSONSchemaProperty, JSONSchema } from './tool'

// Sessions
export {
  // Branded types
  SessionId,
  // Classes
  SessionMetadata,
  SessionConfig,
  Session,
  // JSON serialization
  SessionMetadataFromJson,
  SessionFromJson,
  // Factories
  createSession,
  toMetadata,
  generateTitleFromMessages,
} from './session'

// Type-only exports for sessions
export type {
  SessionMetadataType,
  SessionConfigType,
  SessionType,
} from './session'
