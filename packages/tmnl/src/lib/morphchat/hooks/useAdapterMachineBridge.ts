/**
 * Adapter → Machine Bridge Hook
 *
 * Subscribes to adapter atoms (connection$, streaming$) and dispatches
 * corresponding events to the XState surface machine. This bridges the
 * Atom-as-State pattern (adapters) with the machine-as-orchestrator pattern.
 *
 * The adapter mutates atoms directly (morphChatRegistry.set).
 * This hook watches those atoms and tells the machine what happened.
 *
 * MUST run inside MorphChatRegistryProvider and after the actor is created.
 *
 * @module morphchat/hooks/useAdapterMachineBridge
 */

import * as React from 'react'
import { morphChatRegistry } from '../atoms/registry'
import { sendSurfaceEvent } from '../machines/surface-stx'
import type { MorphChatAdapter } from '../schemas/adapter-types'
import type { ConnectionState, StreamingState } from '../schemas/message-types'
import type { SurfaceId } from '../atoms/surface-atoms'
import type { SurfaceMachineEvent } from '../machines/surface-machine'

// =============================================================================
// Phase → Machine Event Mapping
// =============================================================================

function connectionPhaseToMachineEvent(
  phase: ConnectionState['phase'],
  prev: ConnectionState['phase'] | null,
  error?: string,
): SurfaceMachineEvent | null {
  // Only dispatch on phase CHANGE
  if (phase === prev) return null

  switch (phase) {
    case 'connected':
      return { type: 'ADAPTER_CONNECTED' }
    case 'disconnected':
      return { type: 'ADAPTER_DISCONNECTED', reason: error }
    case 'error':
      return { type: 'ADAPTER_ERROR', error: error ?? 'Unknown error' }
    case 'reconnecting':
      // Machine handles reconnecting internally — but if adapter drives it,
      // treat as disconnect + reconnect
      return { type: 'ADAPTER_DISCONNECTED', reason: 'reconnecting' }
    default:
      return null
  }
}

function streamingStateToMachineEvents(
  current: StreamingState,
  prev: StreamingState,
): SurfaceMachineEvent[] {
  const events: SurfaceMachineEvent[] = []

  // Detect stream start: was not streaming, now is
  if (!prev.isStreaming && current.isStreaming && current.messageId) {
    events.push({ type: 'STREAM_START', messageId: current.messageId })
  }

  // Detect stream delta: both streaming, buffer grew
  if (
    prev.isStreaming &&
    current.isStreaming &&
    current.buffer !== prev.buffer &&
    current.messageId
  ) {
    events.push({ type: 'STREAM_DELTA', messageId: current.messageId })
  }

  // Detect stream end: was streaming, now not
  if (prev.isStreaming && !current.isStreaming && prev.messageId) {
    events.push({ type: 'STREAM_END', messageId: prev.messageId })
  }

  return events
}

// =============================================================================
// Hook
// =============================================================================

export function useAdapterMachineBridge(
  surfaceId: SurfaceId,
  adapter: MorphChatAdapter,
): void {
  // Track previous values to detect changes
  const prevConnectionPhase = React.useRef<ConnectionState['phase'] | null>(null)
  const prevStreaming = React.useRef<StreamingState>({
    isStreaming: false,
    buffer: '',
    messageId: null,
    tokensReceived: 0,
  })

  React.useEffect(() => {
    // ── Subscribe to connection$ (immediate: catch current state) ────
    const unsubConnection = morphChatRegistry.subscribe(
      adapter.connection$,
      (connectionState: ConnectionState) => {
        const event = connectionPhaseToMachineEvent(
          connectionState.phase,
          prevConnectionPhase.current,
          'error' in connectionState ? (connectionState as any).error : undefined,
        )
        if (event) {
          sendSurfaceEvent(surfaceId, event)
        }
        prevConnectionPhase.current = connectionState.phase
      },
      { immediate: true },
    )

    // ── Subscribe to streaming$ (immediate: catch current state) ──
    const unsubStreaming = morphChatRegistry.subscribe(
      adapter.streaming$,
      (streamingState: StreamingState) => {
        const events = streamingStateToMachineEvents(
          streamingState,
          prevStreaming.current,
        )
        for (const event of events) {
          sendSurfaceEvent(surfaceId, event)
        }
        prevStreaming.current = { ...streamingState }
      },
      { immediate: true },
    )

    return () => {
      unsubConnection()
      unsubStreaming()
    }
  }, [surfaceId, adapter])
}
