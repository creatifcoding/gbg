/**
 * Floating Panel Design Tokens
 *
 * Derived from the TMNL MorphChat/MorphCard design language:
 *   - oklch-based backgrounds
 *   - Hairline borders with alpha
 *   - Inset glow + outer shadow elevation
 *   - Font-mono, tracking-wider, uppercase headers
 *   - Cyan accent for focus/active states
 *
 * @module
 */

// =============================================================================
// Border Glow (from morph-card tmnl-default.tsx)
// =============================================================================

export const borderGlow = (intensity: number = 0.06) => `
  inset 0 0 0 1px rgba(255,255,255,${intensity}),
  inset 0 1px 0 rgba(255,255,255,${intensity * 0.8}),
  0 0 0 1px rgba(255,255,255,${intensity * 0.3}),
  0 2px 8px rgba(0,0,0,0.4),
  0 0 20px rgba(0,0,0,0.2)
`.trim()

// =============================================================================
// Panel Tokens
// =============================================================================

export const PANEL = {
  // ── Backgrounds ───────────────────────────────────────────
  /** Panel body background — oklch neutral black */
  bg: 'oklch(0.08 0.005 280)',
  /** Title bar / header background */
  headerBg: 'oklch(0.10 0.005 280)',
  /** Tab background within title bar */
  tabBg: 'oklch(0.12 0.005 280)',
  /** Subtle raised surface (buttons, hover zones) */
  surfaceRaised: 'rgba(255, 255, 255, 0.03)',
  /** Surface hover */
  surfaceHover: 'rgba(255, 255, 255, 0.06)',

  // ── Borders ───────────────────────────────────────────────
  /** Border — hairline with alpha (matches border-neutral-800/50) */
  border: 'rgba(38, 38, 38, 0.5)',
  /** Border — stronger (inner separators, active) */
  borderStrong: 'rgba(255, 255, 255, 0.05)',
  /** Border — active state (dragging/resizing) */
  borderActive: 'rgba(8, 145, 178, 0.3)',
  /** Focus ring — cyan accent (matches ring-cyan-900/30) */
  focusRing: 'rgba(8, 145, 178, 0.3)',

  // ── Text ──────────────────────────────────────────────────
  /** Primary text — bright neutral */
  textStrong: '#e5e5e5',
  /** Secondary text — muted */
  text: '#737373',
  /** Tertiary text — barely visible */
  textMuted: '#525252',

  // ── Chrome buttons ────────────────────────────────────────
  /** Chrome button idle */
  btnIdle: '#525252',
  /** Chrome button hover */
  btnHover: '#d4d4d4',
  /** Chrome button hover bg */
  btnHoverBg: 'rgba(38, 38, 38, 0.5)',

  // ── Accents ───────────────────────────────────────────────
  /** Cyan accent for active/focus states */
  accentCyan: 'rgba(8, 145, 178, 0.5)',
  /** Emerald for online/success */
  accentEmerald: '#34d399',
  /** Amber for warning/attention */
  accentAmber: '#fbbf24',

  // ── Dimensions ────────────────────────────────────────────
  /** Title bar height in px */
  headerHeight: 32,
  /** Border radius for floating panels (SM §3.4.2: 8px) */
  radius: 8,

  // ── Elevation ─────────────────────────────────────────────
  /** Floating panel shadow — deep elevation */
  shadow: '0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
  /** Floating border glow — inset white hairline + outer shadow */
  floatGlow: borderGlow(0.06),
  /** Floating panel border — subtle white */
  floatBorder: '1px solid rgba(255, 255, 255, 0.05)',

  // ── Focus Reticle Glow ─────────────────────────────────────
  /** Reticle glow — subtle cyan edge emanation for focused panel */
  reticleGlow: `
    inset 0 0 0 1px rgba(8, 145, 178, 0.35),
    inset 0 0 16px rgba(8, 145, 178, 0.08),
    0 0 12px rgba(8, 145, 178, 0.12)
  `.trim(),
  /** Reticle top accent — thin beam at panel top edge */
  reticleAccent: 'linear-gradient(90deg, transparent 2%, rgba(8, 145, 178, 0.7) 15%, rgba(8, 145, 178, 1) 50%, rgba(8, 145, 178, 0.7) 85%, transparent 98%)',
  /** Reticle glow unfocused — invisible */
  reticleNone: `
    inset 0 0 0 1px transparent,
    inset 0 0 12px transparent,
    0 0 8px transparent
  `.trim(),

  // ── Transitions ───────────────────────────────────────────
  /** Drag/resize settle transition (SM §5.3) */
  settleTransition: 'box-shadow 0.2s ease-out, border-radius 0.15s ease-out',
  /** Chrome button transition */
  chromeTransition: 'all 200ms ease-out',
  /** Reticle glow transition — smooth 200ms fade */
  reticleTransition: 'box-shadow 200ms ease-out',
} as const

/** Type for the PANEL token object */
export type PanelTokens = typeof PANEL
