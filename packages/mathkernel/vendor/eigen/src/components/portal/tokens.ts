/**
 * TMNL Vantablack Design System — Tokens
 *
 * Canonical design tokens for the vantablack card system.
 * Splash defines the aesthetic; these tokens extract it for reuse.
 *
 * DESIGN PRINCIPLES:
 * 1. Near-black surfaces with micro-gradients for depth
 * 2. Mono headers for terminal authority, sans body for readability
 * 3. Subtle border glows, never harsh
 * 4. Typography hierarchy via family contrast, not just size
 * 5. Restrained animation — functional, not decorative
 */

// ─────────────────────────────────────────────────────────────────────────────
// Color Palette
// ─────────────────────────────────────────────────────────────────────────────

export const VANTA_COLORS = {
  // Surface hierarchy (darkest to lightest)
  surface: {
    void: '#000000',
    base: '#030303',
    elevated: '#0a0a0a',
    raised: '#111111',
    border: '#1a1a1a',
    hover: '#1f1f1f',
    default: '#0a0a0a',
  },

  // Text hierarchy
  text: {
    /** Primary text — high contrast */
    primary: '#e5e5e5',
    /** Secondary text — muted */
    secondary: '#a3a3a3',
    /** Tertiary text — subtle */
    tertiary: '#737373',
    /** Disabled/placeholder */
    muted: '#525252',
    /** Inverted (on light surfaces) */
    inverse: '#000000',
  },

  // Accent palette (use sparingly)
  accent: {
    /** Primary accent — cyan terminal glow */
    cyan: '#22d3ee',
    cyanMuted: '#0891b2',
    cyanGlow: 'rgba(34, 211, 238, 0.15)',

    /** Status: active/success */
    emerald: '#34d399',
    emeraldMuted: '#059669',
    emeraldGlow: 'rgba(52, 211, 153, 0.15)',

    /** Status: warning/pending */
    amber: '#fbbf24',
    amberMuted: '#d97706',
    amberGlow: 'rgba(251, 191, 36, 0.15)',

    /** Status: error/danger */
    rose: '#fb7185',
    roseMuted: '#e11d48',
    roseGlow: 'rgba(251, 113, 133, 0.15)',

    /** Accent: violet (for 3D/canvas blocks) */
    violet: '#a78bfa',
    violetMuted: '#7c3aed',
    violetGlow: 'rgba(167, 139, 250, 0.15)',

    /** Neutral accent */
    neutral: '#a3a3a3',
    neutralMuted: '#737373',
  },

  // Gradient definitions
  gradient: {
    /** Card surface gradient (top to bottom) */
    surface: 'linear-gradient(180deg, #050505 0%, #000000 100%)',
    /** Subtle depth gradient */
    depth:
      'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)',
    /** Border glow gradient */
    borderGlow:
      'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
    /** Scanline overlay */
    scanlines:
      'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Typography
// ─────────────────────────────────────────────────────────────────────────────

export const VANTA_TYPOGRAPHY = {
  // Font families (Geo-primary brutalist system v2)
  family: {
    /** Labels, technical text — monospace precision */
    mono: 'var(--font-label), "Share Tech Mono", monospace',
    /** Headings — neo-grotesque brutalist */
    grotesk: 'var(--font-heading), "Space Grotesk", sans-serif',
    /** Body text — Geo primary workhorse */
    sans: 'var(--font-body), "Geo", sans-serif',
    /** Data/stats — tabular clarity */
    data: 'var(--font-stats), "Geo", sans-serif',
  },

  // Font sizes (rem-based for accessibility)
  size: {
    /** Micro text — metadata, timestamps */
    '2xs': '0.625rem', // 10px
    /** Extra small — labels, hints */
    xs: '0.6875rem', // 11px
    /** Small — secondary text */
    sm: '0.75rem', // 12px
    /** Base — body text */
    base: '0.8125rem', // 13px
    /** Medium — emphasized body */
    md: '0.875rem', // 14px
    /** Large — subheadings */
    lg: '1rem', // 16px
    /** Extra large — headings */
    xl: '1.125rem', // 18px
    /** 2XL — display headings */
    '2xl': '1.25rem', // 20px
    /** 3XL — hero text */
    '3xl': '1.5rem', // 24px
  },

  // Font weights
  weight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  // Letter spacing
  tracking: {
    /** Tight — display text */
    tight: '-0.025em',
    /** Normal — body text */
    normal: '0',
    /** Wide — labels */
    wide: '0.025em',
    /** Wider — uppercase labels */
    wider: '0.05em',
    /** Widest — micro labels */
    widest: '0.1em',
  },

  // Line heights
  leading: {
    /** Tight — headings */
    none: '1',
    tight: '1.25',
    /** Snug — compact body */
    snug: '1.375',
    /** Normal — body text */
    normal: '1.5',
    /** Relaxed — readable body */
    relaxed: '1.625',
  },

  // Preset text styles — uses CSS variables for ScaleProvider integration
  // Updated for Geo-primary brutalist system v2
  preset: {
    /** Card title — grotesk, uppercase, tracked */
    cardTitle: {
      fontFamily: 'var(--font-heading), "Space Grotesk", sans-serif',
      fontSize: 'var(--tmnl-text-xs, 12px)', // 12px — FLOOR
      fontWeight: '500',
      letterSpacing: '0.1em',
      lineHeight: '1.25',
      textTransform: 'uppercase' as const,
    },
    /** Card subtitle — Geo body */
    cardSubtitle: {
      fontFamily: 'var(--font-body), "Geo", sans-serif',
      fontSize: 'var(--tmnl-text-xs, 12px)', // 12px
      fontWeight: '400',
      letterSpacing: '0.02em',
      lineHeight: '1.5',
    },
    /** Card body — Geo readable */
    cardBody: {
      fontFamily: 'var(--font-body), "Geo", sans-serif',
      fontSize: 'var(--tmnl-text-sm, 14px)', // 14px
      fontWeight: '400',
      letterSpacing: '0.02em',
      lineHeight: '1.625',
    },
    /** Label — mono, small, uppercase */
    label: {
      fontFamily: 'var(--font-label), "Share Tech Mono", monospace',
      fontSize: 'var(--tmnl-text-xs, 12px)', // 12px — FLOOR
      fontWeight: '500',
      letterSpacing: '0.15em',
      lineHeight: '1',
      textTransform: 'uppercase' as const,
    },
    /** Value — stats/data font, emphasized */
    value: {
      fontFamily: 'var(--font-stats), "Geo", sans-serif',
      fontSize: 'var(--tmnl-text-sm, 14px)', // 14px
      fontWeight: '600',
      letterSpacing: '0.025em',
      lineHeight: '1.25',
    },
    /** Micro — timestamps, IDs (mono for alignment) */
    micro: {
      fontFamily: 'var(--font-label), "Share Tech Mono", monospace',
      fontSize: 'var(--tmnl-text-xs, 12px)', // 12px — FLOOR
      fontWeight: '400',
      letterSpacing: '0.05em',
      lineHeight: '1',
    },
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Spacing
// ─────────────────────────────────────────────────────────────────────────────

export const VANTA_SPACING = {
  /** Base unit — 4px */
  unit: 4,

  // Scale
  '0': '0',
  px: '1px',
  '0.5': '2px',
  '1': '4px',
  '1.5': '6px',
  '2': '8px',
  '2.5': '10px',
  '3': '12px',
  '4': '16px',
  '5': '20px',
  '6': '24px',
  '8': '32px',
  '10': '40px',
  '12': '48px',
  '16': '64px',

  // Semantic
  card: {
    /** Card internal padding */
    padding: '16px',
    /** Padding for compact cards */
    paddingCompact: '12px',
    /** Gap between card sections */
    gap: '12px',
    /** Gap for compact layout */
    gapCompact: '8px',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Borders & Shadows
// ─────────────────────────────────────────────────────────────────────────────

export const VANTA_BORDERS = {
  // Border widths
  width: {
    none: '0',
    thin: '1px',
    medium: '2px',
  },

  // Border radii (minimal — brutalist aesthetic)
  radius: {
    none: '0',
    sm: '2px',
    md: '4px',
    lg: '6px',
  },

  // Border styles
  style: {
    /** Default card border — visible hairline */
    default: `1px solid ${VANTA_COLORS.surface.border}`,
    /** Subtle border — barely visible */
    subtle: `1px solid rgba(255, 255, 255, 0.05)`,
    /** Hairline border — visible but refined (use for panels) */
    hairline: `1px solid rgba(255, 255, 255, 0.12)`,
    /** Crisp border — high contrast hairline */
    crisp: `1px solid rgba(255, 255, 255, 0.18)`,
    /** Accent border */
    accent: `1px solid ${VANTA_COLORS.accent.cyan}`,
    /** Dashed separator */
    dashed: `1px dashed ${VANTA_COLORS.surface.border}`,
  },

  // Box shadows (glows)
  shadow: {
    /** No shadow */
    none: 'none',
    /** Subtle ambient glow */
    ambient: '0 0 20px rgba(0, 0, 0, 0.5)',
    /** Card elevation */
    card: '0 4px 24px rgba(0, 0, 0, 0.4)',
    /** Elevated card (hover) */
    elevated: '0 8px 32px rgba(0, 0, 0, 0.6)',
    /** Accent glow (cyan) */
    glowCyan: `0 0 14px ${VANTA_COLORS.accent.cyanGlow}`,
    /** Accent glow (emerald) */
    glowEmerald: `0 0 20px ${VANTA_COLORS.accent.emeraldGlow}`,
    /** Accent glow (amber) */
    glowAmber: `0 0 20px ${VANTA_COLORS.accent.amberGlow}`,
    /** Accent glow (rose) */
    glowRose: `0 0 20px ${VANTA_COLORS.accent.roseGlow}`,
    /** Inner glow (focus state) */
    inner: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Animation
// ─────────────────────────────────────────────────────────────────────────────

export const VANTA_ANIMATION = {
  // Durations
  duration: {
    instant: '0ms',
    fast: '100ms',
    normal: '200ms',
    slow: '300ms',
    slower: '500ms',
    slowest: '800ms',
  },

  // Easings
  easing: {
    /** Linear — uniform */
    linear: 'linear',
    /** Default — subtle ease */
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    /** In — accelerate */
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    /** Out — decelerate */
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    /** In-out — symmetric */
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    /** Bounce — playful overshoot */
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },

  // Preset transitions
  transition: {
    /** Color transitions */
    colors:
      'color 200ms cubic-bezier(0.4, 0, 0.2, 1), background-color 200ms cubic-bezier(0.4, 0, 0.2, 1), border-color 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    /** Opacity transitions */
    opacity: 'opacity 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    /** Transform transitions */
    transform: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    /** All common properties */
    all: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    /** Shadow/glow transitions */
    shadow: 'box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Compound Token Sets
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pre-composed card variants
 */
export const VANTA_CARD_VARIANTS = {
  /** Default card styling */
  default: {
    background: VANTA_COLORS.gradient.surface,
    border: VANTA_BORDERS.style.subtle,
    borderRadius: VANTA_BORDERS.radius.sm,
    boxShadow: VANTA_BORDERS.shadow.card,
    padding: VANTA_SPACING.card.padding,
  },

  /** Elevated card (modal, overlay) */
  elevated: {
    background: VANTA_COLORS.gradient.surface,
    border: VANTA_BORDERS.style.default,
    borderRadius: VANTA_BORDERS.radius.md,
    boxShadow: VANTA_BORDERS.shadow.elevated,
    padding: VANTA_SPACING.card.padding,
  },

  /** Compact card (inline, list items) */
  compact: {
    background: VANTA_COLORS.surface.base,
    border: VANTA_BORDERS.style.subtle,
    borderRadius: VANTA_BORDERS.radius.none,
    boxShadow: VANTA_BORDERS.shadow.none,
    padding: VANTA_SPACING.card.paddingCompact,
  },

  /** Ghost card (no background) */
  ghost: {
    background: 'transparent',
    border: 'none',
    borderRadius: VANTA_BORDERS.radius.none,
    boxShadow: VANTA_BORDERS.shadow.none,
    padding: VANTA_SPACING.card.padding,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Export Types
// ─────────────────────────────────────────────────────────────────────────────

export type VantaColorKey = keyof typeof VANTA_COLORS.surface;
export type VantaTextColorKey = keyof typeof VANTA_COLORS.text;
export type VantaAccentKey = keyof typeof VANTA_COLORS.accent;
export type VantaSizeKey = keyof typeof VANTA_TYPOGRAPHY.size;
export type VantaSpacingKey = keyof typeof VANTA_SPACING;
export type VantaCardVariant = keyof typeof VANTA_CARD_VARIANTS;
