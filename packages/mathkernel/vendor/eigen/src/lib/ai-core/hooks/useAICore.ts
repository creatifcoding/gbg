/**
 * useAICore Hook
 *
 * React hook for consuming AI Core functionality.
 * Provides typed access to streaming, tools, and state.
 *
 * @example
 * ```tsx
 * function ChatComponent() {
 *   const { streamState, tools, isStreaming, abort } = useAICore()
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

import { useAtomValue } from '@effect-atom/atom-react'
import { useCallback } from 'react'
import {
  streamStateAtom,
  activeHandleAtom,
  toolsAtom,
  toolsLoadingAtom,
  isStreamingAtom,
  toolCountAtom,
  streamTextAtom,
  hasStreamErrorAtom,
  clearStream,
  setConnecting,
  setStreamError,
  applyStreamEvent,
  setActiveHandle,
  setTools,
  setToolsLoading,
  type AIStreamState,
  INITIAL_STREAM_STATE,
} from '../atoms'
import type { AggregatedTool } from '../schemas'

// =============================================================================
// Types
// =============================================================================

export interface UseAICoreResult {
  // State
  /** Current stream state */
  streamState: AIStreamState
  /** Accumulated text from stream */
  text: string
  /** Whether currently streaming */
  isStreaming: boolean
  /** Whether stream has error */
  hasError: boolean
  /** Available tools */
  tools: readonly AggregatedTool[]
  /** Number of available tools */
  toolCount: number
  /** Whether tools are loading */
  toolsLoading: boolean

  // Operations
  /** Clear stream state */
  clear: () => void
  /** Set connecting state */
  setConnecting: () => void
  /** Set error state */
  setError: (error: string) => void
}

// =============================================================================
// Hook
// =============================================================================

/**
 * React hook for AI Core functionality
 */
export function useAICore(): UseAICoreResult {
  // State subscriptions
  const streamState = useAtomValue(streamStateAtom)
  const text = useAtomValue(streamTextAtom)
  const isStreaming = useAtomValue(isStreamingAtom)
  const hasError = useAtomValue(hasStreamErrorAtom)
  const tools = useAtomValue(toolsAtom)
  const toolCount = useAtomValue(toolCountAtom)
  const toolsLoading = useAtomValue(toolsLoadingAtom)

  // Operations
  const clear = useCallback(() => {
    clearStream()
  }, [])

  const setConnectingState = useCallback(() => {
    setConnecting()
  }, [])

  const setError = useCallback((error: string) => {
    setStreamError(error)
  }, [])

  return {
    // State
    streamState,
    text,
    isStreaming,
    hasError,
    tools,
    toolCount,
    toolsLoading,
    // Operations
    clear,
    setConnecting: setConnectingState,
    setError,
  }
}

// =============================================================================
// Specialized Hooks
// =============================================================================

/**
 * Hook for just stream state (minimal subscription)
 */
export function useAIStreamState(): AIStreamState {
  return useAtomValue(streamStateAtom)
}

/**
 * Hook for just stream text
 */
export function useAIStreamText(): string {
  return useAtomValue(streamTextAtom)
}

/**
 * Hook for streaming status
 */
export function useIsAIStreaming(): boolean {
  return useAtomValue(isStreamingAtom)
}

/**
 * Hook for tools only
 */
export function useAITools(): {
  tools: readonly AggregatedTool[]
  loading: boolean
  count: number
} {
  const tools = useAtomValue(toolsAtom)
  const loading = useAtomValue(toolsLoadingAtom)
  const count = useAtomValue(toolCountAtom)

  return { tools, loading, count }
}
