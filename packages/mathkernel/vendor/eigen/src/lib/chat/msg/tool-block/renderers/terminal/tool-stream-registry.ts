/**
 * Tool Stream Registry — sidecar atom registry for streaming tool output.
 *
 * Isolated from morphChatRegistry to keep high-frequency streaming updates
 * from causing churn in the broader UI state.
 *
 * - toolStreamsAtom: HashMap<ToolCallId, ToolStreamState> — master lookup
 * - toolStreamFamily: Atom.family keyed by toolCallId — lazy creation, auto-GC
 *
 * @module chat/msg/tool-block/renderers/terminal/tool-stream-registry
 */

import { Atom, Registry } from '@effect-atom/atom'
import { HashMap, Option } from 'effect'
import type { ToolStreamState } from './schemas'
import { EMPTY_TOOL_STREAM_STATE } from './schemas'

// =============================================================================
// Sidecar Registry — isolated from morphChatRegistry
// =============================================================================

export const toolStreamRegistry = Registry.make()

// =============================================================================
// Master HashMap: toolCallId → ToolStreamState
// =============================================================================

export const toolStreamsAtom = Atom.make(
  HashMap.empty<string, ToolStreamState>(),
)

// Mount immediately so subscribe/get work from any consumer
toolStreamRegistry.mount(toolStreamsAtom)

// =============================================================================
// Family: lazy per-toolCallId derived atom
//
// - First access for a toolCallId creates the atom
// - Subsequent access returns the same instance
// - WeakRef + FinalizationRegistry auto-GC on unmount
// =============================================================================

export const toolStreamFamily = Atom.family((toolCallId: string) =>
  Atom.make((get): ToolStreamState => {
    const streams = get(toolStreamsAtom)
    return HashMap.get(streams, toolCallId).pipe(
      Option.getOrElse(() => EMPTY_TOOL_STREAM_STATE(toolCallId)),
    )
  }),
)
