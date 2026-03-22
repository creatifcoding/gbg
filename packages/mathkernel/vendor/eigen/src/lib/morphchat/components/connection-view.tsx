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
import { useBlockDensity } from '@/lib/chat/msg/density-context'

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

  // Badge mode — density-aware
  const density = useBlockDensity()

  // ── Pill: invisible when OK, border glow on error ──
  if (density === 'pill') {
    const glowClass =
      connection.phase === 'error' ? 'shadow-[0_0_6px_rgba(239,68,68,0.4)]' :
      connection.phase === 'reconnecting' ? 'shadow-[0_0_6px_rgba(245,158,11,0.4)]' :
      ''
    if (!glowClass) return null
    return <div className={cn('w-2 h-2 rounded-full', PHASE_DOT[connection.phase], glowClass)} title={PHASE_LABEL[connection.phase]} />
  }

  // ── Compact: dot + tooltip, reconnect on hover ──
  if (density === 'compact') {
    return (
      <div className="group/conn flex items-center gap-1" title={PHASE_LABEL[connection.phase]}>
        <div className={cn('w-1.5 h-1.5 rounded-full', PHASE_DOT[connection.phase])} />
        {showReconnect && (
          <button
            onClick={handleReconnect}
            className="opacity-0 group-hover/conn:opacity-100 text-cyan-500 font-mono hover:text-cyan-400 transition-all"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Retry
          </button>
        )}
      </div>
    )
  }

  // ── Full: dot + label + latency + reconnect ──
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
