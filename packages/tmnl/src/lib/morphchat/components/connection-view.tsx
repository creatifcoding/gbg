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
  const { spec, adapter } = useMorphChatContext()
  const connection = useAtomValue(adapter.connection$)

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
    </div>
  )
}

ConnectionView.displayName = 'MorphChat.ConnectionView'
