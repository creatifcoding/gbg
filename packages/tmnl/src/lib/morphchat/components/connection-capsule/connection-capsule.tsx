/**
 * ConnectionCapsule — Thin orchestrator.
 *
 * Composes segments: SmartDot, TuftianSegment, TextSegment, ActionSegment.
 * All state lives in atoms (capsule/atoms.ts), synced via useCapsuleSync.
 * This component just wires atom values to sub-components.
 *
 * @module connection-capsule/connection-capsule
 */

import { useCallback } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { useMorphChatContext } from '../surface-context'
import { sendSurfaceEvent } from '../../machines/surface-stx'

import { REVEAL_MS, REVEAL_EASE } from './constants'
import { PHASE_STYLES, PHASE_LABEL, segmentCount } from './phase-styles'

import { useCapsuleSync } from './hooks/use-capsule-sync'
import { useViewMode } from './hooks/use-view-mode'

import {
  latencyHistoryFamily,
  smartDotFamily,
  endpointFamily,
  errorMessageFamily,
  uptimeFamily,
} from './atoms'

import { SmartDot } from './smart-dot'
import { TuftianSegment } from './tuftian-segment'
import { TextSegment } from './text-segment'
import { ActionSegment } from './action-segment'

export function ConnectionCapsule() {
  const { adapter, surfaceId } = useMorphChatContext()
  const connection = useAtomValue(adapter.connection$)

  const phase = connection.phase
  const style = PHASE_STYLES[phase] ?? PHASE_STYLES.disconnected
  const isConnected = phase === 'connected'

  // ── Sync all derived atoms from connection$ ─────────────
  useCapsuleSync(adapter.connection$, surfaceId)

  // ── Read derived atoms ──────────────────────────────────
  const latencyHistory = useAtomValue(latencyHistoryFamily(surfaceId))
  const smartDot = useAtomValue(smartDotFamily(surfaceId))
  const endpoint = useAtomValue(endpointFamily(surfaceId))
  const errorMessage = useAtomValue(errorMessageFamily(surfaceId))
  const uptime = useAtomValue(uptimeFamily(surfaceId))

  // ── View mode (per-surface atom) ────────────────────────
  const { viewMode, blurring, cycleMode } = useViewMode(surfaceId, isConnected)

  // ── Segment visibility ──────────────────────────────────
  const segments = segmentCount(phase, !!errorMessage)
  const showTextSegment = segments >= 2
  const showActionSegment = segments >= 3
  const showTuftian = isConnected && viewMode !== 'dot'

  // ── Label text ──────────────────────────────────────────
  const labelText = (() => {
    if (phase === 'error' && errorMessage) return errorMessage
    if (phase === 'reconnecting' && connection.reconnectAttempt) {
      return `reconnecting (${connection.reconnectAttempt})…`
    }
    return PHASE_LABEL[phase]
  })()

  const handleRetry = useCallback(() => {
    sendSurfaceEvent(surfaceId, { type: 'RECONNECT' })
  }, [surfaceId])

  return (
    <div
      data-slot="connection-capsule"
      data-phase={phase}
      data-view={isConnected ? viewMode : undefined}
      className="inline-flex items-center rounded-[3px] overflow-hidden"
      style={{
        border: `1px solid ${style.borderColor}`,
        background: style.bgColor,
        transition: [
          `border-color ${REVEAL_MS}ms ${REVEAL_EASE}`,
          `background ${REVEAL_MS}ms ${REVEAL_EASE}`,
        ].join(', '),
      }}
      title={`${PHASE_LABEL[phase]}${connection.latencyMs != null ? ` · ${connection.latencyMs}ms` : ''}`}
      onClick={isConnected ? cycleMode : undefined}
    >
      {/* ── Segment 1: Dot (always visible) ─────────────── */}
      <div className="flex items-center justify-center px-2 py-0.5">
        <SmartDot
          phase={phase}
          style={style}
          smartColor={smartDot?.color}
          smartGlow={smartDot?.glow}
        />
        {/* Latency inline — connected dot-mode only */}
        {phase === 'connected' && viewMode === 'dot' && connection.latencyMs != null && (
          <span
            className="ml-1.5 text-neutral-600 font-mono"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {connection.latencyMs}ms
          </span>
        )}
      </div>

      {/* ── Tuftian data (connected sparkline/full modes) ── */}
      <TuftianSegment
        show={showTuftian}
        blurring={blurring}
        viewMode={viewMode}
        latencyHistory={latencyHistory}
        latencyMs={connection.latencyMs}
        smartColor={smartDot?.color ?? '#34d399'}
        endpoint={endpoint}
        uptime={uptime}
      />

      {/* ── Segment 2: Text label (reveals rightward) ───── */}
      <TextSegment
        show={showTextSegment}
        dividerColor={style.dividerColor}
        textColor={style.textColor}
        labelText={labelText}
      />

      {/* ── Segment 3: Action (error only) ──────────────── */}
      <ActionSegment
        show={showActionSegment}
        dividerColor={style.dividerColor}
        onRetry={handleRetry}
      />
    </div>
  )
}

ConnectionCapsule.displayName = 'MorphChat.ConnectionCapsule'
