/**
 * ChatTokenUsage Context — shared state for compound sub-components.
 *
 * @module chat/msg/token-usage
 */

import { createContext, useContext } from 'react'

export interface TokenUsageData {
  /** Input tokens consumed */
  readonly inputTokens?: number
  /** Output tokens generated */
  readonly outputTokens?: number
  /** Reasoning/thinking tokens */
  readonly reasoningTokens?: number
  /** Cached input tokens */
  readonly cachedTokens?: number
  /** Total tokens (auto-computed if not provided) */
  readonly totalTokens?: number
  /** Context window max */
  readonly maxTokens?: number
  /** Model ID for cost calculation */
  readonly modelId?: string
  /** Estimated cost in USD */
  readonly costUsd?: number
}

export interface ChatTokenUsageContextValue extends TokenUsageData {
  /** Whether usage data is still being computed */
  readonly isLoading: boolean
  /** Percent of context window used (0-1) */
  readonly usedPercent: number
}

export const ChatTokenUsageContext = createContext<ChatTokenUsageContextValue | null>(null)

export function useChatTokenUsage(): ChatTokenUsageContextValue {
  const ctx = useContext(ChatTokenUsageContext)
  if (!ctx) {
    throw new Error('ChatTokenUsage sub-components must be used within ChatTokenUsage.Root')
  }
  return ctx
}
