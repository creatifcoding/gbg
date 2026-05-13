/**
 * Connection Capsule — Segmented Reveal + Tuftian Sparkline
 *
 * A morphing connection indicator with segmented reveal pattern.
 * Segments reveal rightward via max-width as state escalates:
 *
 *   Connected:    [●]  ← click to cycle: [●] → [● sparkline 42ms] → [● sparkline 42ms · ws://local · 14m]
 *   Connecting:   [● | connecting…]
 *   Reconnecting: [● | reconnecting (2)…]
 *   Error:        [● | [error-code] msg | Retry]
 *
 * Smart dot (connected only): color interpolates by latency quality
 *   green → amber → dark orange (NOT red — red is error-only).
 *
 * @module morphchat/components/connection-capsule
 */

import * as React from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { cn } from '@/lib/utils'
import { useMorphChatContext } from './surface-context'
import { sendSurfaceEvent } from '../machines/surface-stx'
import { connectionStateFamily } from '../machines/surface-stx'
import type { ConnectionPhase } from '../schemas/message-types'
import { LatencySparkline, latencyColor, latencyGlow } from './latency-sparkline'

// ─── Constants ───────────────────────────────────────────────────────────────

/** Reveal animation duration */
const REVEAL_MS = 200
/** Reveal easing — custom curve, not built-in */
const REVEAL_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
const BLUR_MS = 100
const RING_SIZE = 20

// ─── View Modes (connected only) ────────────────────────────────────────────

type ViewMode = 'dot' | 'sparkline' | 'full'
const MODE_CYCLE: ViewMode[] = ['dot', 'sparkline', 'full']

// ─── Phase → Visual Mapping ─────────────────────────────────────────────────

interface PhaseStyle {
  dotColor: string
  dotGlow: string
  borderColor: string
  bgColor: string
  dividerColor: string
  textColor: string
  spinning: boolean
}

const PHASE_STYLES: Record<ConnectionPhase, PhaseStyle> = {
  connected: {
    dotColor: 'bg-emerald-400',
    dotGlow: '',
    borderColor: 'rgba(52,211,153,0.15)',
    bgColor: 'rgba(52,211,153,0.03)',
    dividerColor: 'rgba(52,211,153,0.1)',
    textColor: 'text-neutral-500',
    spinning: false,
  },
  connecting: {
    dotColor: 'border-amber-400',
    dotGlow: '',
    borderColor: 'rgba(245,158,11,0.15)',
    bgColor: 'rgba(245,158,11,0.04)',
    dividerColor: 'rgba(245,158,11,0.1)',
    textColor: 'text-amber-300',
    spinning: true,
  },
  reconnecting: {
    dotColor: 'border-amber-400',
    dotGlow: '',
    borderColor: 'rgba(245,158,11,0.2)',
    bgColor: 'rgba(245,158,11,0.04)',
    dividerColor: 'rgba(245,158,11,0.1)',
    textColor: 'text-amber-300',
    spinning: true,
  },
  disconnected: {
    dotColor: 'bg-neutral-600',
    dotGlow: '',
    borderColor: 'rgba(115,115,115,0.15)',
    bgColor: 'rgba(115,115,115,0.03)',
    dividerColor: 'rgba(115,115,115,0.1)',
    textColor: 'text-neutral-500',
    spinning: false,
  },
  error: {
    dotColor: 'bg-red-400',
    dotGlow: '0 0 8px rgba(239,68,68,0.3)',
    borderColor: 'rgba(239,68,68,0.2)',
    bgColor: 'rgba(239,68,68,0.04)',
    dividerColor: 'rgba(239,68,68,0.1)',
    textColor: 'text-red-300',
    spinning: false,
  },
}

const PHASE_LABEL: Record<ConnectionPhase, string> = {
  connected: 'Connected',
  connecting: 'connecting…',
  reconnecting: 'reconnecting',
  disconnected: 'disconnected',
  error: 'error',
}

// ─── Segment count per phase ─────────────────────────────────────────────────

/** How many segments are visible per phase */
function segmentCount(phase: ConnectionPhase, hasError: boolean): number {
  if (phase === 'error' || hasError) return 3 // dot | message | retry
  if (phase === 'connecting' || phase === 'reconnecting') return 2 // dot | label
  return 1 // dot only
}

// ─── Uptime formatting ───────────────────────────────────────────────────────

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/** Ring buffer of latency readings */
function useLatencyHistory(latencyMs: number | undefined): readonly number[] {
  const historyRef = React.useRef<number[]>([])

  React.useEffect(() => {
    if (latencyMs != null && latencyMs > 0) {
      const h = historyRef.current
      h.push(latencyMs)
      if (h.length > RING_SIZE) h.shift()
    }
  }, [latencyMs])

  return historyRef.current
}

/** Uptime since last 'connected' phase, updates every 30s */
function useUptime(phase: ConnectionPhase): string | null {
  const connectedAtRef = React.useRef<number | null>(null)
  const [uptime, setUptime] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (phase === 'connected') {
      if (connectedAtRef.current == null) connectedAtRef.current = Date.now()
      const tick = () => setUptime(formatUptime(Date.now() - connectedAtRef.current!))
      tick()
      const id = setInterval(tick, 30_000)
      return () => clearInterval(id)
    } else {
      connectedAtRef.current = null
      setUptime(null)
    }
  }, [phase])

  return uptime
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ConnectionCapsule() {
  const { adapter, surfaceId } = useMorphChatContext()
  const connection = useAtomValue(adapter.connection$)
  const machineConnectionState = useAtomValue(connectionStateFamily(surfaceId))

  const phase = connection.phase
  const style = PHASE_STYLES[phase] ?? PHASE_STYLES.disconnected
  const isConnected = phase === 'connected'

  // ── Tuftian data (connected only) ───────────────────────
  const latencyHistory = useLatencyHistory(connection.latencyMs)
  const uptime = useUptime(phase)
  const smartColor = isConnected ? latencyColor(connection.latencyMs) : undefined
  const smartGlow = isConnected ? latencyGlow(connection.latencyMs) : undefined

  // ── View mode cycling (connected only) ──────────────────
  const [viewMode, setViewMode] = React.useState<ViewMode>('dot')
  const [blurring, setBlurring] = React.useState(false)

  const cycleMode = React.useCallback(() => {
    if (!isConnected) return
    setBlurring(true)
    setTimeout(() => {
      setViewMode(prev => {
        const i = MODE_CYCLE.indexOf(prev)
        return MODE_CYCLE[(i + 1) % MODE_CYCLE.length]
      })
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setBlurring(false))
      })
    }, BLUR_MS)
  }, [isConnected])

  const showReconnect =
    machineConnectionState === 'error' ||
    machineConnectionState === 'reconnecting' ||
    phase === 'error'

  const handleRetry = React.useCallback(() => {
    sendSurfaceEvent(surfaceId, { type: 'RECONNECT' })
  }, [surfaceId])

  // Error details for the message segment
  const errorMessage = React.useMemo(() => {
    if (phase !== 'error') return null
    const err = (connection as any).error
    if (typeof err === 'string') {
      const bracket = err.match(/^\s*\[([^\]]+)\]\s*(.*)$/)
      if (bracket) return `[${bracket[1]}]`
      return err.slice(0, 30)
    }
    if (err && typeof err === 'object' && typeof (err as any).code === 'string') {
      return `[${(err as any).code}]`
    }
    return '[error]'
  }, [phase, (connection as any).error])

  // Determine visible segments
  const segments = segmentCount(phase, !!errorMessage)
  const showTextSegment = segments >= 2
  const showActionSegment = segments >= 3

  // Build label text for the text segment
  const labelText = React.useMemo(() => {
    if (phase === 'error' && errorMessage) return errorMessage
    if (phase === 'reconnecting' && connection.reconnectAttempt) {
      return `reconnecting (${connection.reconnectAttempt})…`
    }
    return PHASE_LABEL[phase]
  }, [phase, errorMessage, connection.reconnectAttempt])

  // ── Endpoint shortname ──────────────────────────────────
  const endpoint = React.useMemo(() => {
    const ep = connection.endpoint
    if (!ep) return null
    if (ep.startsWith('harness:')) return 'harness'
    try { return new URL(ep).hostname.replace('localhost', 'local') } catch { return ep.slice(0, 12) }
  }, [connection.endpoint])

  // ── Tuftian content for connected sparkline/full modes ──
  const showTuftian = isConnected && viewMode !== 'dot'

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
        {style.spinning ? (
          <span
            className="block rounded-full animate-spin"
            style={{
              width: 5, height: 5,
              border: '1.5px solid',
              borderColor: phase === 'connecting' || phase === 'reconnecting'
                ? '#fbbf24' : '#a3a3a3',
              borderTopColor: 'transparent',
            }}
          />
        ) : isConnected && smartColor ? (
          /* Smart dot: latency-interpolated color */
          <span
            className="block w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: smartColor,
              boxShadow: smartGlow || undefined,
              transition: 'background-color 200ms ease-out, box-shadow 200ms ease-out',
            }}
          />
        ) : (
          /* Phase dot: Tailwind class from PHASE_STYLES */
          <span
            className={cn('block w-1.5 h-1.5 rounded-full', style.dotColor)}
            style={{ boxShadow: style.dotGlow || undefined }}
          />
        )}
        {/* Latency on hover — connected dot-mode only */}
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
      <div
        className="flex items-center overflow-hidden"
        style={{
          maxWidth: showTuftian ? 300 : 0,
          opacity: showTuftian ? 1 : 0,
          filter: blurring ? 'blur(3px)' : 'blur(0)',
          transition: [
            `max-width ${REVEAL_MS}ms ${REVEAL_EASE}`,
            `opacity ${blurring ? BLUR_MS : REVEAL_MS}ms ease-out`,
            `filter ${BLUR_MS}ms ease-out`,
          ].join(', '),
        }}
      >
        {/* Sparkline (modes sparkline + full) */}
        {latencyHistory.length >= 2 && (
          <LatencySparkline
            readings={latencyHistory}
            color={smartColor ?? '#34d399'}
          />
        )}
        {/* Current latency */}
        {connection.latencyMs != null && (
          <span
            className="font-mono ml-1.5 whitespace-nowrap"
            style={{ fontSize: '10px', color: '#525252' }}
          >
            {connection.latencyMs}ms
          </span>
        )}
        {/* Full stats (mode full only) */}
        {viewMode === 'full' && (
          <>
            {endpoint && (
              <>
                <span style={{ fontSize: '10px', color: '#262626', margin: '0 3px' }}>·</span>
                <span className="font-mono whitespace-nowrap" style={{ fontSize: '10px', color: '#525252' }}>{endpoint}</span>
              </>
            )}
            {uptime && (
              <>
                <span style={{ fontSize: '10px', color: '#262626', margin: '0 3px' }}>·</span>
                <span className="font-mono whitespace-nowrap" style={{ fontSize: '10px', color: '#525252' }}>{uptime}</span>
              </>
            )}
          </>
        )}
        {/* Right padding */}
        <div className="w-2" />
      </div>

      {/* ── Segment 2: Text label (reveals rightward) ───── */}
      <div
        className="flex items-center overflow-hidden"
        style={{
          maxWidth: showTextSegment ? 200 : 0,
          opacity: showTextSegment ? 1 : 0,
          transition: [
            `max-width ${REVEAL_MS}ms ${REVEAL_EASE}`,
            `opacity ${REVEAL_MS}ms ${REVEAL_EASE}`,
          ].join(', '),
        }}
      >
        {/* Divider */}
        <div
          className="w-px self-stretch my-1 shrink-0"
          style={{
            background: style.dividerColor,
            opacity: showTextSegment ? 1 : 0,
            transition: `opacity ${REVEAL_MS}ms ${REVEAL_EASE}`,
          }}
        />
        <span
          className={cn('px-2 py-0.5 font-mono whitespace-nowrap', style.textColor)}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {labelText}
        </span>
      </div>

      {/* ── Segment 3: Action (reveals rightward — error only) ── */}
      <div
        className="flex items-center overflow-hidden"
        style={{
          maxWidth: showActionSegment ? 80 : 0,
          opacity: showActionSegment ? 1 : 0,
          transition: [
            `max-width ${REVEAL_MS}ms ${REVEAL_EASE}`,
            `opacity ${REVEAL_MS}ms ${REVEAL_EASE}`,
          ].join(', '),
        }}
      >
        {/* Divider */}
        <div
          className="w-px self-stretch my-1 shrink-0"
          style={{
            background: style.dividerColor,
            opacity: showActionSegment ? 1 : 0,
            transition: `opacity ${REVEAL_MS}ms ${REVEAL_EASE}`,
          }}
        />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleRetry() }}
          className="px-2 py-0.5 font-mono text-cyan-400 hover:text-cyan-300 transition-colors duration-150 active:scale-[0.97] whitespace-nowrap"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Retry
        </button>
      </div>
    </div>
  )
}

ConnectionCapsule.displayName = 'MorphChat.ConnectionCapsule'
