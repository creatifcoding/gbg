/**
 * Streaming Metrics — Derived atoms from canonical streaming$ state.
 *
 * Zero new primary state. All fields are pure derivations from
 * `streaming$(id)` which already carries startedAt, tokensReceived,
 * lastEventAt, and phase — updated on rAF flush during active streaming.
 *
 * @module morphchat/atoms/streaming-metrics
 */

import { Atom } from '@effect-atom/atom'
import { streaming$ } from '../hooks/useHarnessAdapter'
import type { StreamPhase } from '../schemas/message-types'

// =============================================================================
// Types
// =============================================================================

/**
 * Cursor velocity bucket — drives adaptive cursor behavior.
 *
 * - fast: ≥20 tok/s — brisk step-end blink (300ms)
 * - normal: 5–19 tok/s — breathing pulse (900ms)
 * - slow: <5 tok/s or waiting phase — orbital dots (1.4s staggered)
 */
export type CursorVelocity = 'fast' | 'normal' | 'slow'

/**
 * Per-message-family streaming metrics.
 *
 * Every field is derived from `streaming$(instanceId)`:
 * - tokensPerSecond = tokensReceived / elapsedSec
 * - velocity = bucketize(tokensPerSecond, phase)
 * - elapsedSec = (Date.now() - startedAt) / 1000
 */
export interface StreamingMetrics {
  /** Whether streaming is active (any non-idle, non-error-recovery phase) */
  readonly active: boolean
  /** Current phase from canonical streaming$ */
  readonly phase: StreamPhase
  /** Tokens received so far */
  readonly tokensReceived: number
  /** Tokens per second (rate stabilizes after 0.5s) */
  readonly tokensPerSecond: number
  /** Elapsed seconds since stream start (floored integer) */
  readonly elapsedSec: number
  /** Cursor velocity bucket for adaptive cursor */
  readonly velocity: CursorVelocity
  /** Message ID being streamed */
  readonly messageId: string | null
}

/** Sentinel idle metrics — stable reference, never changes */
export const IDLE_METRICS: StreamingMetrics = Object.freeze({
  active: false,
  phase: 'idle' as StreamPhase,
  tokensReceived: 0,
  tokensPerSecond: 0,
  elapsedSec: 0,
  velocity: 'normal' as CursorVelocity,
  messageId: null,
})

// =============================================================================
// Pure Derivation
// =============================================================================

/**
 * Bucketize token rate + phase into cursor velocity.
 *
 * - waiting phase → always 'slow' (no tokens yet, show orbital dots)
 * - ≥20 tok/s → 'fast' (brisk blink signals bandwidth)
 * - <5 tok/s and >0 → 'slow' (orbital dots signal thinking)
 * - 5–19 tok/s → 'normal' (breathing pulse)
 */
export function deriveVelocity(rate: number, phase: StreamPhase): CursorVelocity {
  if (phase === 'waiting') return 'slow'
  if (rate >= 20) return 'fast'
  if (rate > 0 && rate < 5) return 'slow'
  return 'normal'
}

// =============================================================================
// Derived Atom Family
// =============================================================================

/**
 * Stable idle atom for non-harness adapters.
 * Returns IDLE_METRICS — never triggers re-renders.
 */
export const idleMetricsAtom = Atom.make(IDLE_METRICS)

/**
 * Per-instance streaming metrics derived from `streaming$(id)`.
 *
 * Recomputes on every `streaming$` change (rAF-throttled during active
 * streaming, ~16ms intervals). Rate calculation requires >0.5s elapsed
 * to avoid division-by-tiny-number spikes.
 *
 * This atom is the ONLY data source for all EPOCH-0005 UI components:
 * adaptive cursor, progress badge, phased entry, graceful landing, etc.
 */
export const streamingMetrics$ = Atom.family((id: string) =>
  Atom.make<StreamingMetrics>((get) => {
    const s = get(streaming$(id))
    const active = s.phase !== 'idle' && s.phase !== 'error-recovery'
    if (!active) return IDLE_METRICS

    const tokens = s.tokensReceived ?? 0
    const now = Date.now()
    const elapsed = s.startedAt ? (now - s.startedAt) / 1000 : 0
    // Rate stabilization: wait 0.5s before computing to avoid spike on first token
    const rate = elapsed > 0.5 ? Math.round(tokens / elapsed) : 0

    return {
      active: true,
      phase: s.phase,
      tokensReceived: tokens,
      tokensPerSecond: rate,
      elapsedSec: Math.floor(elapsed),
      velocity: deriveVelocity(rate, s.phase),
      messageId: s.messageId ?? null,
    }
  }),
)
