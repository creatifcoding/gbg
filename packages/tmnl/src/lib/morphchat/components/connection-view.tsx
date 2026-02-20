/**
 * Connection Display Renderer
 *
 * Maps spec.connectionStatus axis → visual representation.
 *
 * - badge: Persistent dot + label + latency
 * - toast-only: (toast on state change — placeholder for now)
 * - hidden: (not rendered — handled by topology resolver)
 *
 * Composes from src/lib/chat/status/ when available.
 *
 * @module morphchat/components/connection-view
 */

import * as React from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { cn } from '@/lib/utils'
import { useMorphChatContext } from './surface-context'
import { connectionStateFamily } from '../machines/surface-stx'
import { sendSurfaceEvent } from '../machines/surface-stx'
import type { ConnectionPhase } from '../schemas/message-types'

// =============================================================================
// Phase → Visual
// =============================================================================

const PHASE_DOT: Record<ConnectionPhase, string> = {
  connected: 'bg-emerald-500',
  connecting: 'bg-amber-500 animate-pulse',
  reconnecting: 'bg-amber-500 animate-pulse',
  disconnected: 'bg-neutral-600',
  error: 'bg-red-500',
}

const PHASE_LABEL: Record<ConnectionPhase, string> = {
  connected: 'Connected',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  disconnected: 'Disconnected',
  error: 'Error',
}

// =============================================================================
// Connection View
// =============================================================================

export function ConnectionView() {
  const { spec, adapter, surfaceId } = useMorphChatContext()
  const connection = useAtomValue(adapter.connection$)
  const machineConnectionState = useAtomValue(connectionStateFamily(surfaceId))

  // All hooks ABOVE early returns (Rules of Hooks)
  const handleReconnect = React.useCallback(() => {
    sendSurfaceEvent(surfaceId, { type: 'RECONNECT' })
  }, [surfaceId])

  // Use machine state for reconnect/error display when available
  const showReconnect = machineConnectionState === 'error' || machineConnectionState === 'reconnecting'

  if (spec.connectionStatus === 'hidden') return null

  // Toast-only mode: render nothing persistently (toast system TBD)
  if (spec.connectionStatus === 'toast-only') return null

  // Badge mode
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn('w-1.5 h-1.5 rounded-full', PHASE_DOT[connection.phase])} />
      <span
        className="text-neutral-500 font-mono"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {PHASE_LABEL[connection.phase]}
      </span>
      {connection.latencyMs != null && connection.phase === 'connected' && (
        <span
          className="text-neutral-600 font-mono"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {connection.latencyMs}ms
        </span>
      )}
      {showReconnect && (
        <button
          onClick={handleReconnect}
          className="text-cyan-500 font-mono hover:text-cyan-400 transition-colors"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Reconnect
        </button>
      )}
    </div>
  )
}

ConnectionView.displayName = 'MorphChat.ConnectionView'
