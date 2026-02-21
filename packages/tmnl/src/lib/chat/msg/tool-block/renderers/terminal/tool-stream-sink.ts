/**
 * Tool Stream Sink — side-effect for Stream.tap that writes chunks
 * into the sidecar toolStreamRegistry.
 *
 * Uses HashMap.modifyAt for atomic insert-or-update.
 * SortedMap.set(seq, line) into the ledger.
 * Sets pendingChunk to the latest chunk for term.write().
 *
 * @module chat/msg/tool-block/renderers/terminal/tool-stream-sink
 */

import { Effect, HashMap, Option, SortedMap, Order } from 'effect'
import { toolStreamRegistry, toolStreamsAtom } from './tool-stream-registry'
import type { ToolStreamLine, ToolStreamState } from './schemas'

// =============================================================================
// Sink: process a single stream chunk event
// =============================================================================

export interface ToolStreamEvent {
  readonly toolCallId: string
  readonly toolName: string
  readonly payload: {
    readonly seq: number
    readonly chunk: string
    readonly kind: 'stdout' | 'stderr'
  }
}

/**
 * Process a phase:'stream' tool event. Writes into sidecar registry.
 * Pure Effect — safe for Stream.tap.
 */
export const toolStreamSink = (event: ToolStreamEvent): Effect.Effect<void> =>
  Effect.sync(() => {
    const { toolCallId, toolName, payload } = event
    const { seq, chunk, kind } = payload

    const line: ToolStreamLine = {
      _tag: 'ToolStreamLine',
      seq,
      chunk,
      kind,
      receivedAt: Date.now(),
    }

    toolStreamRegistry.update(toolStreamsAtom, (streams) =>
      HashMap.modifyAt(streams, toolCallId, (existing: Option.Option<ToolStreamState>) =>
        Option.some(
          Option.match(existing, {
            onNone: (): ToolStreamState => ({
              toolCallId,
              toolName,
              ledger: SortedMap.make(Order.number)([seq, line] as const),
              pendingChunk: chunk,
              totalBytes: chunk.length,
              startedAt: Date.now(),
              lastChunkAt: Date.now(),
              phase: 'streaming',
            }),
            onSome: (prev): ToolStreamState => ({
              ...prev,
              ledger: SortedMap.set(prev.ledger, seq, line),
              pendingChunk: chunk,
              totalBytes: prev.totalBytes + chunk.length,
              lastChunkAt: Date.now(),
              phase: 'streaming',
            }),
          }),
        ),
      ),
    )
  })

// =============================================================================
// Finalize: mark stream as complete for a toolCallId
// =============================================================================

export const toolStreamFinalize = (toolCallId: string): Effect.Effect<void> =>
  Effect.sync(() => {
    toolStreamRegistry.update(toolStreamsAtom, (streams) =>
      HashMap.modifyAt(streams, toolCallId, (existing: Option.Option<ToolStreamState>) =>
        Option.map(existing, (state): ToolStreamState => ({
          ...state,
          pendingChunk: null,
          phase: 'complete',
        })),
      ),
    )
  })

// =============================================================================
// Error: mark stream as errored for a toolCallId
// =============================================================================

export const toolStreamError = (toolCallId: string): Effect.Effect<void> =>
  Effect.sync(() => {
    toolStreamRegistry.update(toolStreamsAtom, (streams) =>
      HashMap.modifyAt(streams, toolCallId, (existing: Option.Option<ToolStreamState>) =>
        Option.map(existing, (state): ToolStreamState => ({
          ...state,
          pendingChunk: null,
          phase: 'error',
        })),
      ),
    )
  })
