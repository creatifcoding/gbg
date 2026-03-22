/**
 * Phase → Visual Mapping
 *
 * The state machine for visual presentation: each ConnectionPhase
 * maps to a deterministic set of visual properties (dot color, glow,
 * border, background, divider, text class, spinner flag).
 *
 * @module connection-capsule/phase-styles
 */

import type { ConnectionPhase } from '../../schemas/message-types'

// ─── PhaseStyle type ─────────────────────────────────────────────────────────

export interface PhaseStyle {
  /** Tailwind background/border class for the dot */
  dotColor: string
  /** box-shadow string for the dot glow (empty = none) */
  dotGlow: string
  /** CSS border-color for the capsule shell */
  borderColor: string
  /** CSS background for the capsule shell */
  bgColor: string
  /** CSS background for divider lines between segments */
  dividerColor: string
  /** Tailwind text class for segment labels */
  textColor: string
  /** Whether the dot renders as a spinner */
  spinning: boolean
}

// ─── Phase styles lookup ─────────────────────────────────────────────────────

export const PHASE_STYLES: Record<ConnectionPhase, PhaseStyle> = {
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

// ─── Phase labels ────────────────────────────────────────────────────────────

export const PHASE_LABEL: Record<ConnectionPhase, string> = {
  connected: 'Connected',
  connecting: 'connecting…',
  reconnecting: 'reconnecting',
  disconnected: 'disconnected',
  error: 'error',
}

// ─── Segment visibility state machine ────────────────────────────────────────

/** How many segments are visible per phase */
export function segmentCount(phase: ConnectionPhase, hasError: boolean): number {
  if (phase === 'error' || hasError) return 3 // dot | message | retry
  if (phase === 'connecting' || phase === 'reconnecting') return 2 // dot | label
  return 1 // dot only
}
