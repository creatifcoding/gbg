/**
 * useToolStream — React hook to subscribe to streaming tool output.
 *
 * Reads from the sidecar toolStreamRegistry via Atom.family(toolCallId).
 * Returns pendingChunk (for term.write), streaming state, and ledger for replay.
 *
 * @module chat/msg/tool-block/renderers/terminal/use-tool-stream
 */

import { useMemo, useRef, useSyncExternalStore, useCallback } from 'react'
import { HashMap, SortedMap, Option } from 'effect'
import { toolStreamRegistry, toolStreamsAtom } from './tool-stream-registry'
import type { ToolStreamState, ToolStreamLine } from './schemas'
import { EMPTY_TOOL_STREAM_STATE } from './schemas'

// =============================================================================
// Hook
// =============================================================================

export interface UseToolStreamResult {
  /** Latest chunk that needs to be written to restty. Null when consumed. */
  pendingChunk: string | null
  /** Whether the tool is actively streaming */
  isStreaming: boolean
  /** Cumulative bytes received */
  totalBytes: number
  /** Time elapsed since first chunk (ms) */
  elapsedMs: number
  /** Number of chunks in the ledger */
  chunkCount: number
  /** Lifecycle phase */
  phase: ToolStreamState['phase']
  /** Full ledger for replay on mount */
  ledger: SortedMap.SortedMap<number, ToolStreamLine>
  /** Whether any streaming data has been received */
  hasData: boolean
}

/** Module-level empty state — stable reference to avoid re-render loops */
const IDLE_STATE = EMPTY_TOOL_STREAM_STATE('')

/**
 * Subscribe directly to toolStreamRegistry for a specific toolCallId.
 * Uses useSyncExternalStore with referential-equality caching to avoid
 * infinite re-render loops from high-frequency streaming updates.
 */
export function useToolStream(toolCallId: string): UseToolStreamResult {
  // Cache previous snapshot by reference — only update when state actually changes
  const cacheRef = useRef<{ state: ToolStreamState; key: string }>({ state: IDLE_STATE, key: '' })

  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      toolStreamRegistry.subscribe(toolStreamsAtom, () => onStoreChange(), { immediate: false }),
    [],
  )

  const getSnapshot = useCallback((): ToolStreamState => {
    const streams = toolStreamRegistry.get(toolStreamsAtom)
    const state = HashMap.get(streams, toolCallId).pipe(
      Option.getOrElse(() => IDLE_STATE),
    )
    // Referential equality check: same phase + same totalBytes + same pendingChunk = same ref
    const prev = cacheRef.current
    if (
      prev.key === toolCallId &&
      prev.state.phase === state.phase &&
      prev.state.totalBytes === state.totalBytes &&
      prev.state.pendingChunk === state.pendingChunk
    ) {
      return prev.state
    }
    cacheRef.current = { state, key: toolCallId }
    return state
  }, [toolCallId])

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return useMemo((): UseToolStreamResult => ({
    pendingChunk: state.pendingChunk,
    isStreaming: state.phase === 'streaming',
    totalBytes: state.totalBytes,
    elapsedMs: state.lastChunkAt > 0 ? state.lastChunkAt - state.startedAt : 0,
    chunkCount: SortedMap.size(state.ledger),
    phase: state.phase,
    ledger: state.ledger,
    hasData: state.phase !== 'idle',
  }), [state])
}
