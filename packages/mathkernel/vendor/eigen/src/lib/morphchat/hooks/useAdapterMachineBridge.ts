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

import { useEffect, useRef } from 'react'
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

  // Detect stream start: was idle/error-recovery, now active
  const prevActive = prev.phase !== 'idle' && prev.phase !== 'error-recovery'
  const currActive = current.phase !== 'idle' && current.phase !== 'error-recovery'
  if (!prevActive && currActive && current.messageId) {
    events.push({ type: 'STREAM_START', messageId: current.messageId })
  }

  // STREAM_DELTA removed — it only incremented a counter nobody reads in React.
  // Each delta was: streaming$ change → bridge detect → sendSurfaceEvent →
  // machine context bump → snapshot → syncSnapshot → 10 atom equality checks.
  // At ~20 tokens/sec that's 200 atom-set calls/sec of pure dead work.

  // Detect stream end: was active, now idle/error-recovery
  if (prevActive && !currActive && prev.messageId) {
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
  const prevConnectionPhase = useRef<ConnectionState['phase'] | null>(null)
  const prevStreaming = useRef<StreamingState>({
    phase: 'idle',
    buffer: '',
    messageId: undefined,
    tokensReceived: 0,
  })

  useEffect(() => {
    // Callback that dispatches connection phase changes to the machine.
    // Deferred on first call to avoid setState-during-render.
    let connectionReady = false
    const handleConnection = (connectionState: ConnectionState) => {
      const event = connectionPhaseToMachineEvent(
        connectionState.phase,
        prevConnectionPhase.current,
        connectionState.error,
      )
      if (event) {
        if (connectionReady) {
          sendSurfaceEvent(surfaceId, event)
        } else {
          // Defer first dispatch to next microtask to avoid setState-during-render
          queueMicrotask(() => sendSurfaceEvent(surfaceId, event))
        }
      }
      prevConnectionPhase.current = connectionState.phase
      connectionReady = true
    }

    const unsubConnection = morphChatRegistry.subscribe(
      adapter.connection$,
      handleConnection,
      { immediate: true },
    )

    // Callback that dispatches streaming state changes to the machine.
    let streamingReady = false
    const handleStreaming = (streamingState: StreamingState) => {
      const events = streamingStateToMachineEvents(
        streamingState,
        prevStreaming.current,
      )
      for (const event of events) {
        if (streamingReady) {
          sendSurfaceEvent(surfaceId, event)
        } else {
          queueMicrotask(() => sendSurfaceEvent(surfaceId, event))
        }
      }
      prevStreaming.current = { ...streamingState }
      streamingReady = true
    }

    const unsubStreaming = morphChatRegistry.subscribe(
      adapter.streaming$,
      handleStreaming,
      { immediate: true },
    )

    return () => {
      unsubConnection()
      unsubStreaming()
    }
  }, [surfaceId, adapter])
}
