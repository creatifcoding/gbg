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
  // Conversation compaction
  ConversationCompactor,
  Summarizer,
  CompactionConfig,
  CompactionResult,
  SummarizationRequest,
  SummarizationError,
  ConversationCompactorLive,
  ConversationCompactorTest,
  NoopSummarizer,
  ConversationCompactorService,
  type ConversationCompactorShape,
  type SummarizerFn,
  // Session services
  SessionStorage,
  type SessionStorageShape,
  type SessionStorageType,
  SessionStorageLocalLive,
  SessionService,
  SessionServiceLive,
  SessionServiceModule,
  type SessionServiceShape,
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
  // Sessions
  SessionId,
  SessionMetadata,
  SessionConfig,
  Session,
  SessionMetadataFromJson,
  SessionFromJson,
  createSession,
  toMetadata,
  generateTitleFromMessages,
} from './schemas'

// Session type-only exports
export type {
  SessionMetadataType,
  SessionConfigType,
  SessionType,
} from './schemas'

// Type-only re-exports
export type { JSONSchemaProperty, JSONSchema } from './schemas'

// =============================================================================
// Atoms
// =============================================================================

export {
  // Registry
  aiCoreRegistry,
  AICoreRegistryProvider,
  // Runtime
  aiCoreRuntimeAtom,
  // State atoms (single stream - legacy)
  streamStateAtom,
  activeHandleAtom,
  toolsAtom,
  toolsLoadingAtom,
  // Multi-stream atoms (v3)
  streamStatesByIdAtom,
  streamStateByIdAtom,
  activeHandlesByIdAtom,
  // Derived atoms
  isStreamingAtom,
  toolCountAtom,
  streamTextAtom,
  hasStreamErrorAtom,
  // Direct state manipulation (single stream - legacy)
  applyStreamEvent,
  setConnecting,
  setStreamError,
  clearStream,
  setActiveHandle,
  setTools,
  setToolsLoading,
  // Multi-stream manipulation (v3)
  initStreamStateById,
  applyStreamEventById,
  getStreamStateById,
  isStreamActiveById,
  cleanupStreamStateById,
  setActiveHandleById,
  getActiveHandleById,
  clearActiveHandleById,
  // Types
  type AIStreamState,
  type StreamContentPart,
  INITIAL_STREAM_STATE,
  reduceStreamEvent,
  // Session atoms
  sessionsIndexAtom,
  activeSessionAtom,
  sessionSidebarExpandedAtom,
  sessionSearchQueryAtom,
  filteredSessionsAtom,
  hasActiveSessionAtom,
  activeSessionIdAtom,
  sessionCountAtom,
  setSessionsIndex,
  setActiveSession,
  updateActiveSession,
  addSessionToIndex,
  updateSessionInIndex,
  removeSessionFromIndex,
  toggleSidebar,
  setSidebarExpanded,
  setSearchQuery,
  clearSearchQuery,
  clearSessionState,
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
  // Phase 1: useChat bridge with tool execution
  useChatWithTools,
  type UseChatWithToolsOptions,
  type UseChatWithToolsReturn,
  // Chat error types (Effect TaggedError)
  ChatConnectionError,
  ChatServerError,
  ChatToolError,
  // Session hooks
  useAiCoreChatSession,
  type UseAiCoreChatSessionResult,
  useAiCoreChatSessions,
  type UseAiCoreChatSessionsResult,
} from './hooks'

// =============================================================================
// Components (Phase 2)
// =============================================================================

export {
  // Main renderer
  MessagePartRenderer,
  type MessagePartRendererProps,
  type UIMessagePart,
  // Part renderers
  TextRenderer,
  type TextRendererProps,
  ReasoningRenderer,
  type ReasoningRendererProps,
  ToolCallRenderer,
  type ToolCallRendererProps,
  ToolResultRenderer,
  type ToolResultRendererProps,
  StepStartIndicator,
  type StepStartIndicatorProps,
  // RVN Components (Dark Theme Contrast Islands)
  RVN_DARK,
  darkContainerStyle,
  darkHeaderStyle,
  darkLabelStyle,
  darkCodeBlockStyle,
  darkChevronStyle,
  darkButtonStyle,
  darkApplyButtonStyle,
  darkStatusStyles,
  CopyButton,
  type CopyButtonProps,
  ThinkingSection,
  type ThinkingSectionProps,
  SideBySideDiff,
  type SideBySideDiffProps,
  ToolArgsFormatted,
  type ToolArgsFormattedProps,
  ToolResultFormatted,
  type ToolResultFormattedProps,
  ToolCallBlock,
  type ToolCallBlockProps,
  // Session Components
  SessionProvider,
  useSessionContext,
  type SessionProviderProps,
  type SessionContextValue,
  SessionSidebar,
  type SessionSidebarProps,
  SessionHeader,
  type SessionHeaderProps,
  SessionSwitcher,
  type SessionSwitcherProps,
  type SessionSwitcherRootProps,
  type SessionSwitcherContentProps,
  type SessionSwitcherMainProps,
  // Session-Aware Chat Bridge
  SessionAwareChat,
  type SessionAwareChatProps,
  type SessionChatRenderProps,
} from './components'

// =============================================================================
// Providers (Phase 3 - Dependency Injection)
// =============================================================================

export {
  // Core Service
  ChatDataProvider,
  type ChatDataProviderShape,
  type ChatDataProviderType,
  // Schemas
  ProviderStatus,
  SendMessageOptions,
  ProviderState,
  ExtensionUIRequest,
  ExtensionUIResponse,
  ExtensionUIResponseKind,
  // Errors
  ChatSendError,
  ProviderNotConfiguredError,
  // Providers
  NoopProvider,
  AISDKProvider,
  AISDKProviderConfig,
  type AISDKProviderConfigShape,
  // Bridge (for React adapter)
  AISDKBridgeService,
  type AISDKBridge,
  // Pi Provider
  PiProvider,
  PiProviderConfig,
  PiProviderConfigDefault,
  type PiProviderConfigShape,
  // React Hook Adapter
  useAISDKProviderBridge,
  type UseAISDKProviderBridgeOptions,
  type UseAISDKProviderBridgeReturn,
  // Registry
  BUILT_IN_PROVIDERS,
} from './providers'
