/**
 * Tone styling — visual treatment per severity level.
 *
 * Consumes severity from the canonical harness error-codes registry.
 * No duplicate severity mapping here.
 *
 * @module morphchat/components/status-banner/tone-styles
 */

import { Info, AlertTriangle, XCircle } from 'lucide-react'
import type { BannerTone } from './types'
import { severityOf } from '@/lib/harness/error-codes'

// ─── Per-tone visual config ──────────────────────────────────────────────────

export const TONE_STYLES: Record<BannerTone, {
  card: string
  glow: string
  icon: string
  IconComponent: typeof Info
}> = {
  info: {
    card: 'border-neutral-700/40 text-neutral-300',
    glow: 'inset 0 1px 6px rgba(255,255,255,0.02), 0 2px 8px rgba(0,0,0,0.4)',
    icon: 'text-neutral-500',
    IconComponent: Info,
  },
  warn: {
    card: 'border-amber-600/30 text-amber-200',
    glow: 'inset 0 1px 6px rgba(245,158,11,0.04), 0 2px 8px rgba(0,0,0,0.4)',
    icon: 'text-amber-400',
    IconComponent: AlertTriangle,
  },
  error: {
    card: 'border-red-600/30 text-red-200',
    glow: 'inset 0 1px 6px rgba(239,68,68,0.04), 0 2px 8px rgba(0,0,0,0.4)',
    icon: 'text-red-400',
    IconComponent: XCircle,
  },
}

/** Per-tone solid background — vantablack, opaque. No blur. */
export const TONE_BG: Record<BannerTone, string> = {
  info: 'rgba(4, 4, 8, 0.95)',
  warn: 'rgba(8, 5, 2, 0.95)',
  error: 'rgba(10, 3, 3, 0.95)',
}

// ─── Error code → tone (delegates to harness/error-codes) ────────────────────

/**
 * Map an error code to a banner tone.
 * Delegates to the canonical severity registry in harness/error-codes.
 * 'silent' severity maps to 'info' (caller should filter with isBannerVisible).
 */
export function toneForCode(code: string): BannerTone {
  const severity = severityOf(code)
  if (severity === 'silent') return 'info'
  return severity
}
