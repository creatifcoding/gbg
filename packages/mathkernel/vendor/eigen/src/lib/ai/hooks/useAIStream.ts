/**
 * useAIStream Hook
 *
 * React hook for AI streaming with Effect operations.
 * Follows Atom-as-State doctrine from CLAUDE.md.
 */

import { useCallback, useEffect } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { Effect } from 'effect'
import type { AIProvider, ThinkingLevel, AIModelConfig, ToolCall, ToolResult } from '../schemas'
import {
  // State atoms
  currentProviderAtom,
  currentModelIdAtom,
  thinkingLevelAtom,
  streamStateAtom,
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
  // Sync operations
  setProvider,
  setModel,
  setThinkingLevel,
  addMessage,
  clearMessages,
  resetStreamState,
  // Effect operations
  streamChatOp,
  abortStreamOp,
  loadModelsOp,
  isProviderConfiguredOp,
} from '../atoms'

// =============================================================================
// Hook Return Type
// =============================================================================

export interface UseAIStreamResult {
  // Configuration
  provider: AIProvider
  modelId: string
  thinkingLevel: ThinkingLevel
  thinkingBudget: number
  currentModel: AIModelConfig | undefined
  availableModels: readonly AIModelConfig[]

  // Stream state
  status: 'idle' | 'streaming' | 'complete' | 'error' | 'aborted'
  text: string
  thinkingText: string
  toolCalls: readonly ToolCall[]
  toolResults: readonly ToolResult[]
  isStreaming: boolean
  error: string | null

  // Messages
  messages: readonly { role: string; content: string }[]

  // Configuration setters
  setProvider: (provider: AIProvider) => void
  setModel: (modelId: string) => void
  setThinkingLevel: (level: ThinkingLevel) => void

  // Message operations
  addMessage: (role: string, content: string) => void
  clearMessages: () => void

  // Stream operations
  streamChat: (options?: { systemPrompt?: string }) => Promise<void>
  abort: () => Promise<void>
  reset: () => void

  // Utility
  loadModels: () => Promise<void>
  isProviderConfigured: (provider: AIProvider) => Promise<boolean>
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useAIStream(): UseAIStreamResult {
  // Subscribe to atoms
  const provider = useAtomValue(currentProviderAtom)
  const modelId = useAtomValue(currentModelIdAtom)
  const thinkingLevel = useAtomValue(thinkingLevelAtom)
  const thinkingBudget = useAtomValue(thinkingBudgetAtom)
  const currentModel = useAtomValue(currentModelAtom)
  const availableModels = useAtomValue(availableModelsAtom)

  const streamState = useAtomValue(streamStateAtom)
  const status = useAtomValue(streamStatusAtom)
  const text = useAtomValue(streamedTextAtom)
  const thinkingText = useAtomValue(thinkingTextAtom)
  const toolCalls = useAtomValue(pendingToolCallsAtom)
  const toolResults = useAtomValue(toolResultsAtom)
  const isStreaming = useAtomValue(isStreamingAtom)

  const messages = useAtomValue(messagesAtom)

  // Load models on mount
  useEffect(() => {
    Effect.runPromise(loadModelsOp(undefined)).catch(console.error)
  }, [])

  // Stream chat
  const streamChat = useCallback(
    async (options?: { systemPrompt?: string }) => {
      await Effect.runPromise(
        streamChatOp({
          messages,
          systemPrompt: options?.systemPrompt,
        })
      )
    },
    [messages]
  )

  // Abort stream
  const abort = useCallback(async () => {
    await Effect.runPromise(abortStreamOp(undefined))
  }, [])

  // Reset stream state
  const reset = useCallback(() => {
    resetStreamState()
  }, [])

  // Load models
  const loadModels = useCallback(async () => {
    await Effect.runPromise(loadModelsOp(undefined))
  }, [])

  // Check provider configuration
  const checkProviderConfigured = useCallback(async (p: AIProvider) => {
    return Effect.runPromise(isProviderConfiguredOp({ provider: p }))
  }, [])

  return {
    // Configuration
    provider,
    modelId,
    thinkingLevel,
    thinkingBudget,
    currentModel,
    availableModels,

    // Stream state
    status,
    text,
    thinkingText,
    toolCalls,
    toolResults,
    isStreaming,
    error: streamState.error ?? null,

    // Messages
    messages,

    // Configuration setters
    setProvider,
    setModel,
    setThinkingLevel,

    // Message operations
    addMessage,
    clearMessages,

    // Stream operations
    streamChat,
    abort,
    reset,

    // Utility
    loadModels,
    isProviderConfigured: checkProviderConfigured,
  }
}
