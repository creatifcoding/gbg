/**
 * AI Core Atoms
 *
 * Atom-as-State doctrine for AI Core module.
 * Atoms ARE the state, operations mutate atoms directly via registry.set().
 *
 * Architecture:
 * - aiCoreRegistry: Global registry for synchronous atom mutations
 * - aiCoreRuntimeAtom: Effect runtime with service layer
 * - State atoms: streamStateAtom, toolsAtom (simple primitives)
 *
 * NOTE: Layer composition deferred - consumers should provide their own
 * runtime with proper layer composition for their use case.
 */

import { Atom, Registry } from '@effect-atom/atom-react'
import { Layer } from 'effect'
import { SSEAdapter, type StreamHandle } from '../services'
import {
  type AIStreamEvent,
  type AggregatedTool,
  type ToolCallComplete,
  type ToolResult as ToolResultEvent,
  type ToolCallStart,
  type StreamStatus,
  type TokenUsage,
} from '../schemas'

// =============================================================================
// Global Registry
// =============================================================================

/**
 * Global registry singleton for AI Core state mutations.
 * This is shared across all AI Core operations AND React components.
 *
 * IMPORTANT: Use aiCoreRegistry.set() instead of Atom.set()
 * Atom.set() returns an Effect, aiCoreRegistry.set() mutates directly.
 */
export const aiCoreRegistry = Registry.make()

// =============================================================================
// Simple State Types (for atoms)
// =============================================================================

/**
 * Simplified stream state for atoms (no Schema.Class complexity)
 */
export interface AIStreamState {
  status: StreamStatus
  text: string
  thinking: string
  pendingToolCalls: ToolCallStart[]
  completedToolCalls: Array<{
    call: ToolCallComplete
    result: ToolResultEvent | null
  }>
  error: string | null
  usage: TokenUsage | null
  metadata: {
    requestId: string
    modelId: string
    provider: string
    startedAt: number
    completedAt: number | null
  } | null
}

export const INITIAL_STREAM_STATE: AIStreamState = {
  status: 'idle',
  text: '',
  thinking: '',
  pendingToolCalls: [],
  completedToolCalls: [],
  error: null,
  usage: null,
  metadata: null,
}

// =============================================================================
// State Atoms (Writable Primitives)
// =============================================================================

/**
 * Current stream state
 */
export const streamStateAtom = Atom.make<AIStreamState>(INITIAL_STREAM_STATE)

/**
 * Active stream handle (for abort) - stored as nullable
 */
export const activeHandleAtom = Atom.make<StreamHandle | null>(null)

/**
 * Available tools from MCP servers
 */
export const toolsAtom = Atom.make<readonly AggregatedTool[]>([])

/**
 * Whether tools are loading
 */
export const toolsLoadingAtom = Atom.make<boolean>(false)

// =============================================================================
// Derived Atoms
// =============================================================================

/**
 * Whether a stream is currently active
 */
export const isStreamingAtom = Atom.make((get) => {
  const state = get(streamStateAtom)
  return state.status === 'connecting' || state.status === 'streaming'
})

/**
 * Tool count
 */
export const toolCountAtom = Atom.make((get) => {
  const tools = get(toolsAtom)
  return tools.length
})

/**
 * Current stream text
 */
export const streamTextAtom = Atom.make((get) => {
  const state = get(streamStateAtom)
  return state.text
})

/**
 * Whether stream has errors
 */
export const hasStreamErrorAtom = Atom.make((get) => {
  const state = get(streamStateAtom)
  return state.status === 'error'
})

// =============================================================================
// Stream State Reducer
// =============================================================================

/**
 * Reduce AIStreamEvent into AIStreamState
 */
export const reduceStreamEvent = (state: AIStreamState, event: AIStreamEvent): AIStreamState => {
  switch (event._tag) {
    case 'StreamStart':
      return {
        ...state,
        status: 'streaming',
        metadata: {
          requestId: event.requestId,
          modelId: event.modelId,
          provider: event.provider,
          startedAt: event.startedAt,
          completedAt: null,
        },
      }

    case 'TextDelta':
      return {
        ...state,
        text: state.text + event.text,
      }

    case 'ThinkingDelta':
      return {
        ...state,
        thinking: state.thinking + event.thinking,
      }

    case 'ToolCallStart':
      return {
        ...state,
        pendingToolCalls: [...state.pendingToolCalls, event],
      }

    case 'ToolCallComplete': {
      const pendingToolCalls = state.pendingToolCalls.filter(
        (tc) => tc.toolCallId !== event.toolCallId
      )
      return {
        ...state,
        pendingToolCalls,
        completedToolCalls: [
          ...state.completedToolCalls,
          { call: event, result: null },
        ],
      }
    }

    case 'ToolResult': {
      const completedToolCalls = state.completedToolCalls.map((tc) =>
        tc.call.toolCallId === event.toolCallId ? { ...tc, result: event } : tc
      )
      return {
        ...state,
        completedToolCalls,
      }
    }

    case 'StreamComplete':
      return {
        ...state,
        status: 'complete',
        metadata: state.metadata
          ? { ...state.metadata, completedAt: Date.now() }
          : null,
      }

    case 'StreamError':
      return {
        ...state,
        status: 'error',
        error: event.error,
      }

    default:
      return state
  }
}

// =============================================================================
// Runtime Atom (Minimal - just SSEAdapter for basic streaming)
// Full layer composition should be done by consumers
// =============================================================================

/**
 * Basic runtime with SSEAdapter only
 * Consumers needing full AICoreService should compose their own layer
 */
export const aiCoreRuntimeAtom = Atom.runtime(SSEAdapter.Live)

// =============================================================================
// Direct State Manipulation Functions
// These use aiCoreRegistry for synchronous state mutations
// =============================================================================

/**
 * Update stream state with an event
 */
export const applyStreamEvent = (event: AIStreamEvent): void => {
  aiCoreRegistry.update(streamStateAtom, (current) => reduceStreamEvent(current, event))
}

/**
 * Set stream to connecting state
 */
export const setConnecting = (): void => {
  aiCoreRegistry.set(streamStateAtom, {
    ...INITIAL_STREAM_STATE,
    status: 'connecting',
  })
}

/**
 * Set stream error
 */
export const setStreamError = (error: string): void => {
  aiCoreRegistry.update(streamStateAtom, (current) => ({
    ...current,
    status: 'error' as const,
    error,
  }))
}

/**
 * Clear stream state
 */
export const clearStream = (): void => {
  aiCoreRegistry.set(streamStateAtom, INITIAL_STREAM_STATE)
  aiCoreRegistry.set(activeHandleAtom, null)
}

/**
 * Set active handle
 */
export const setActiveHandle = (handle: StreamHandle | null): void => {
  aiCoreRegistry.set(activeHandleAtom, handle)
}

/**
 * Set tools
 */
export const setTools = (tools: readonly AggregatedTool[]): void => {
  aiCoreRegistry.set(toolsAtom, tools)
}

/**
 * Set tools loading state
 */
export const setToolsLoading = (loading: boolean): void => {
  aiCoreRegistry.set(toolsLoadingAtom, loading)
}
