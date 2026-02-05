/**
 * AI Core Hooks
 *
 * React hooks for AI Core integration.
 */

export {
  useAICore,
  useAIStreamState,
  useAIStreamText,
  useIsAIStreaming,
  useAITools,
  type UseAICoreResult,
} from './useAICore'

export {
  useChatWithTools,
  type UseChatWithToolsOptions,
  type UseChatWithToolsReturn,
  // Effect error types
  ChatConnectionError,
  ChatServerError,
  ChatToolError,
} from './useChatWithTools'

// Session hooks
export {
  useAiCoreChatSession,
  type UseAiCoreChatSessionResult,
} from './useAiCoreChatSession'

export {
  useAiCoreChatSessions,
  type UseAiCoreChatSessionsResult,
} from './useAiCoreChatSessions'
