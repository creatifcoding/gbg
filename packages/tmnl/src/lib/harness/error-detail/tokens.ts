/**
 * Error-detail design tokens.
 *
 * Single source for all color values consumed by category configs,
 * detail parts, and action buttons. Nothing in this system
 * hardcodes a hex value — it references a token.
 *
 * Derived tints (bgTint, borderTint) are computed from accent + alpha.
 *
 * @module harness/error-detail/tokens
 */

// ─── Accent palette (category identity colors) ──────────────────────────────

export const ACCENT = {
  /** Stream errors — red */
  stream: '#f87171',
  /** Network — orange */
  network: '#fb923c',
  /** Session — amber */
  session: '#f59e0b',
  /** Session CRUD ops — warm neutral */
  sessionCrud: '#a3a3a3',
  /** Tool — indigo */
  tool: '#818cf8',
  /** Model — purple */
  model: '#c084fc',
  /** Timeout — red (shares stream) */
  timeout: '#f87171',
  /** Compaction — cool neutral */
  compaction: '#737373',
  /** Critical defect — hard red */
  defect: '#ef4444',
  /** Adapter diagnostic — dark neutral */
  adapterDefect: '#404040',
  /** Store diagnostic — dark neutral */
  storeDefect: '#404040',
  /** Interruption — slate */
  interruption: '#64748b',
} as const satisfies Record<string, string>

// ─── Semantic colors ─────────────────────────────────────────────────────────

export const SEMANTIC = {
  /** New session action — green */
  positive: '#22c55e',
  /** Dismiss / muted action text */
  muted: '#404040',
  /** Metadata label text */
  label: '#737373',
  /** Raw cause / secondary text */
  secondary: '#737373',
  /** Metadata value text (non-accented) */
  value: '#737373',
} as const

// ─── Alpha levels for derived tints ──────────────────────────────────────────

export const ALPHA = {
  /** Card border — accent at this alpha */
  border: 0.2,
  /** Defect border — slightly heavier */
  borderHeavy: 0.3,
  /** Separator — very faint */
  separator: 0.06,
  /** Card background — near-opaque dark */
  bgOpacity: 0.97,
  /** Badge background — tinted */
  badgeBg: 0.12,
  /** Badge border */
  badgeBorder: 0.2,
  /** Action button border */
  actionBorder: 0.2,
} as const

// ─── Background bases (warm-shifted per accent hue) ─────────────────────────

const BG_BASE = {
  red: 'rgba(10,3,3',
  orange: 'rgba(10,7,3',
  amber: 'rgba(10,7,3',
  neutral: 'rgba(8,8,8',
  indigo: 'rgba(5,3,10',
  purple: 'rgba(8,3,10',
  dark: 'rgba(6,6,6',
  slate: 'rgba(8,8,10',
} as const

export type BgHue = keyof typeof BG_BASE

// ─── Derivation functions ────────────────────────────────────────────────────

/**
 * Derive border tint from hex accent + alpha.
 * Converts hex to rgba.
 */
export function borderTint(hex: string, alpha = ALPHA.border): string {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r},${g},${b},${alpha})`
}

/** Derive background tint from a base hue. */
export function bgTint(hue: BgHue): string {
  return `${BG_BASE[hue]},${ALPHA.bgOpacity})`
}

/** Derive a separator line color from an accent. */
export function separatorColor(hex: string): string {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r},${g},${b},${ALPHA.separator})`
}

/** Derive action button border from accent. */
export function actionBorderColor(hex: string): string {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r},${g},${b},${ALPHA.actionBorder})`
}

/** Badge background: accent at ALPHA.badgeBg */
export function badgeBgColor(hex: string): string {
  return `${hex}${Math.round(ALPHA.badgeBg * 255).toString(16).padStart(2, '0')}`
}

/** Badge border: accent at ALPHA.badgeBorder */
export function badgeBorderColor(hex: string): string {
  return `${hex}${Math.round(ALPHA.badgeBorder * 255).toString(16).padStart(2, '0')}`
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}
