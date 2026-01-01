/**
 * AI Core Module
 *
 * Unified AI library for streaming + MCP tools.
 * Consumers specialize for their domain (Terminal, Cursor, EditorAI).
 *
 * @example
 * ```tsx
 * import { useAICore, userMessage } from '@/lib/ai-core'
 *
 * function Chat() {
 *   const { streamState, streamChat, abort, isStreaming } = useAICore()
 *
 *   const handleSend = async (text: string) => {
 *     await streamChat({
 *       messages: [userMessage(text)],
 *     })
 *   }
 *
 *   return (
 *     <div>
 *       <div>{streamState.text}</div>
 *       {isStreaming && <button onClick={abort}>Stop</button>}
 *     </div>
 *   )
 * }
 * ```
 */

// =============================================================================
// Services
// =============================================================================

export {
  // Main service
  AICoreService,
  type AICoreServiceShape,
  type AIProvider,
  type StreamChatRequest,
  type StreamHandle,
  // SSE parsing
  SSEAdapter,
  type SSEAdapterShape,
  // Tool bridge
  ToolBridge,
  type ToolBridgeShape,
} from './services'

// =============================================================================
// Schemas
// =============================================================================

export {
  // Errors
  AICoreConnectionError,
  AICoreStreamError,
  AICoreProviderNotFoundError,
  AICoreProviderExistsError,
  AICoreProviderConfigError,
  AICoreToolExecutionError,
  AICoreToolNotFoundError,
  AICoreError,
  StreamPhase,
  isRetryable,
  getErrorMessage,
  // Stream events
  TextDelta,
  ThinkingDelta,
  ToolCallStart,
  ToolCallDelta,
  ToolCallComplete,
  ToolResult,
  StreamStart,
  StreamComplete,
  StreamError,
  AIStreamEvent,
  StreamStatus,
  StreamState,
  TokenUsage,
  FinishReason,
  isContentEvent,
  isToolEvent,
  isLifecycleEvent,
  isTerminalEvent,
  // Messages
  MessageRole,
  TextPart,
  ImagePart,
  FilePart,
  ToolCallPart,
  ToolResultPart,
  ContentPart,
  UserMessage,
  AssistantMessage,
  SystemMessage,
  Message,
  Conversation,
  userMessage,
  assistantMessage,
  systemMessage,
  toolResultMessage,
  toolCallMessage,
  getMessageText,
  hasToolCalls,
  getToolCalls,
  hasToolResults,
  getToolResults,
  toAISDKMessage,
  toAISDKConversation,
  // Tools
  JSONSchemaType,
  JSONSchemaProperty,
  JSONSchema,
  ToolDefinition,
  ToolCallStatus,
  ToolCallRequest,
  ToolCallResult,
  ActiveToolCall,
  AggregatedTool,
  ToolRegistryState,
  toAISDKTool,
  toAISDKTools,
  fromMCPTool,
  fromMCPTools,
} from './schemas'

// =============================================================================
// Atoms
// =============================================================================

export {
  // Registry
  aiCoreRegistry,
  // Runtime
  aiCoreRuntimeAtom,
  // State atoms
  streamStateAtom,
  activeHandleAtom,
  toolsAtom,
  toolsLoadingAtom,
  // Derived atoms
  isStreamingAtom,
  toolCountAtom,
  streamTextAtom,
  hasStreamErrorAtom,
  // Direct state manipulation
  applyStreamEvent,
  setConnecting,
  setStreamError,
  clearStream,
  setActiveHandle,
  setTools,
  setToolsLoading,
  // Types
  type AIStreamState,
  INITIAL_STREAM_STATE,
  reduceStreamEvent,
} from './atoms'

// =============================================================================
// Hooks
// =============================================================================

export {
  useAICore,
  useAIStreamState,
  useAIStreamText,
  useIsAIStreaming,
  useAITools,
  type UseAICoreResult,
} from './hooks'
