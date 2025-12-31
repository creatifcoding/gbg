/**
 * AI Module
 *
 * Effect-TS integration for AI streaming and chat.
 * Integrates with Vercel AI SDK and Claude Agent SDK.
 *
 * Features:
 * - Multi-provider support (Anthropic, OpenAI, Claude Code)
 * - Effect.Stream-based streaming
 * - Extended thinking support
 * - MCP tool integration
 *
 * @example
 * ```tsx
 * import { useAtomValue } from '@effect-atom/atom-react'
 * import {
 *   streamedTextAtom,
 *   isStreamingAtom,
 *   streamChatOp,
 *   setProvider,
 *   setThinkingLevel,
 * } from '@/lib/ai'
 *
 * function Chat() {
 *   const text = useAtomValue(streamedTextAtom)
 *   const isStreaming = useAtomValue(isStreamingAtom)
 *
 *   const handleSend = async (message: string) => {
 *     setProvider('anthropic')
 *     setThinkingLevel('medium')
 *
 *     await streamChatOp({
 *       messages: [{ role: 'user', content: message }],
 *     })
 *   }
 *
 *   return (
 *     <div>
 *       <div>{text}</div>
 *       <button disabled={isStreaming}>Send</button>
 *     </div>
 *   )
 * }
 * ```
 */

// Services
export {
  AIService,
  type AIServiceShape,
  type StreamHandle,
  fromVercelAIStream,
  fromClaudeAgentStream,
  fromAsyncCallback,
  accumulateStreamState,
} from './services'

// Atoms
export {
  // Runtime
  aiRuntimeAtom,
  // State atoms
  currentProviderAtom,
  currentModelIdAtom,
  thinkingLevelAtom,
  streamStateAtom,
  activeStreamHandleAtom,
  messagesAtom,
  availableModelsAtom,
  // Derived atoms
  streamStatusAtom,
  streamedTextAtom,
  thinkingTextAtom,
  pendingToolCallsAtom,
  toolResultsAtom,
  isStreamingAtom,
  thinkingBudgetAtom,
  currentModelAtom,
  // Operations (synchronous)
  setProvider,
  setModel,
  setThinkingLevel,
  addMessage,
  clearMessages,
  resetStreamState,
  // Operations (Effect-based)
  streamChatOp,
  abortStreamOp,
  loadModelsOp,
  isProviderConfiguredOp,
} from './atoms'

// Schemas
export {
  // Provider
  AIProvider,
  ThinkingLevel,
  ThinkingConfig,
  AIMessageRole,
  AITextContent,
  AIToolCallContent,
  AIToolResultContent,
  AIMessageContent,
  AIMessage,
  StreamChatRequest,
  AIModelConfig,
  THINKING_BUDGETS,
  getThinkingLevelLabel,
  DEFAULT_MODELS,
  // Stream
  StreamStatus,
  TextDeltaEvent,
  ReasoningDeltaEvent,
  ReasoningStartEvent,
  ReasoningEndEvent,
  ToolCallEvent,
  ToolResultEvent,
  StreamErrorEvent,
  StreamCompleteEvent,
  AIStreamEvent,
  StreamMetadata,
  StreamState,
  INITIAL_STREAM_STATE,
} from './schemas'

export type {
  // Provider
  AIProvider,
  ThinkingLevel,
  ThinkingConfig,
  AIMessageRole,
  AITextContent,
  AIToolCallContent,
  AIToolResultContent,
  AIMessageContent,
  AIMessage,
  StreamChatRequest,
  AIModelConfig,
  // Stream
  StreamStatus,
  TextDeltaEvent,
  ReasoningDeltaEvent,
  ReasoningStartEvent,
  ReasoningEndEvent,
  ToolCallEvent,
  ToolResultEvent,
  StreamErrorEvent,
  StreamCompleteEvent,
  AIStreamEvent,
  StreamMetadata,
  StreamState,
} from './schemas'

// Hooks
export { useAIStream, type UseAIStreamResult } from './hooks'
