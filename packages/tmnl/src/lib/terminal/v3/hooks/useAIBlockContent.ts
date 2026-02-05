/**
 * useAIBlockContent Hook
 *
 * Derives AI block content from ai-core state.
 * This is the key pattern that eliminates dual-write:
 *
 * Block stores:     streamRef.requestId (reference)
 * Hook derives:     content from streamStateByIdAtom(requestId)
 *
 * NO content is stored in the block itself.
 */

import { useMemo } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import {
  streamStateByIdAtom,
  type AIStreamState,
  type ToolCallComplete,
  type ToolResult,
  type StreamContentPart,
} from '@/lib/ai-core'
import type { AIResponseBlockV3 } from '../schemas'

// =============================================================================
// Types
// =============================================================================

export interface AIBlockContent {
  /** Accumulated response text */
  text: string
  /** Accumulated thinking/reasoning text */
  thinking: string
  /** Current stream status */
  status: 'idle' | 'connecting' | 'streaming' | 'complete' | 'error'
  /** Whether currently streaming */
  isStreaming: boolean
  /** Whether stream is complete */
  isComplete: boolean
  /** Whether stream has error */
  hasError: boolean
  /** Error message (if any) */
  error: string | null
  /** Completed tool calls with results */
  completedToolCalls: Array<{
    call: ToolCallComplete
    result: ToolResult | null
  }>
  /** Tool calls in progress */
  pendingToolCalls: ReadonlyArray<unknown>
  /** Ordered content parts for inline tool call rendering */
  contentParts: StreamContentPart[]
  /** Token usage (if available) */
  usage: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  } | null
  /** Stream metadata */
  metadata: {
    requestId: string
    modelId: string
    provider: string
    startedAt: number
    completedAt: number | null
  } | null
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Get AI block content by deriving from ai-core stream state.
 *
 * @example
 * function AIResponseBlockComponent({ block }: { block: AIResponseBlockV3 }) {
 *   const content = useAIBlockContent(block)
 *
 *   return (
 *     <div>
 *       <div>{content.text}</div>
 *       {content.isStreaming && <LoadingIndicator />}
 *       {content.thinking && <ThinkingSection>{content.thinking}</ThinkingSection>}
 *     </div>
 *   )
 * }
 */
export function useAIBlockContent(block: AIResponseBlockV3): AIBlockContent {
  // CRITICAL: Stabilize atom reference to avoid creating new atom each render
  const atom = useMemo(
    () => streamStateByIdAtom(block.streamRef.requestId),
    [block.streamRef.requestId]
  )
  // Derive content from ai-core state using block's stream reference
  const streamState = useAtomValue(atom)

  // Handle case where stream state doesn't exist (yet or cleaned up)
  if (!streamState) {
    return {
      text: '',
      thinking: '',
      status: 'idle',
      isStreaming: false,
      isComplete: false,
      hasError: false,
      error: null,
      completedToolCalls: [],
      pendingToolCalls: [],
      contentParts: [],
      usage: null,
      metadata: null,
    }
  }

  return {
    text: streamState.text,
    thinking: streamState.thinking,
    status: streamState.status,
    isStreaming: streamState.status === 'connecting' || streamState.status === 'streaming',
    isComplete: streamState.status === 'complete',
    hasError: streamState.status === 'error',
    error: streamState.error,
    completedToolCalls: streamState.completedToolCalls,
    pendingToolCalls: streamState.pendingToolCalls,
    contentParts: streamState.contentParts,
    usage: streamState.usage,
    metadata: streamState.metadata,
  }
}

// =============================================================================
// Specialized Hooks
// =============================================================================

/**
 * Get just the text content of an AI block
 */
export function useAIBlockText(block: AIResponseBlockV3): string {
  const atom = useMemo(
    () => streamStateByIdAtom(block.streamRef.requestId),
    [block.streamRef.requestId]
  )
  const streamState = useAtomValue(atom)
  return streamState?.text ?? ''
}

/**
 * Get just the streaming status of an AI block
 */
export function useAIBlockIsStreaming(block: AIResponseBlockV3): boolean {
  const atom = useMemo(
    () => streamStateByIdAtom(block.streamRef.requestId),
    [block.streamRef.requestId]
  )
  const streamState = useAtomValue(atom)
  return streamState?.status === 'connecting' || streamState?.status === 'streaming'
}

/**
 * Get the thinking/reasoning content of an AI block
 */
export function useAIBlockThinking(block: AIResponseBlockV3): string {
  const atom = useMemo(
    () => streamStateByIdAtom(block.streamRef.requestId),
    [block.streamRef.requestId]
  )
  const streamState = useAtomValue(atom)
  return streamState?.thinking ?? ''
}

/**
 * Get tool calls for an AI block
 */
export function useAIBlockToolCalls(
  block: AIResponseBlockV3
): Array<{ call: ToolCallComplete; result: ToolResult | null }> {
  const atom = useMemo(
    () => streamStateByIdAtom(block.streamRef.requestId),
    [block.streamRef.requestId]
  )
  const streamState = useAtomValue(atom)
  return streamState?.completedToolCalls ?? []
}
