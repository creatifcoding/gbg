export const VANTA_COLORS = {
  surface: {
    void: '#000000',
    base: '#030303',
    elevated: '#0a0a0a',
    raised: '#111111',
    border: '#1a1a1a',
    hover: '#1f1f1f',
    default: '#0a0a0a',
  },
  text: {
    primary: '#e5e5e5',
    secondary: '#a3a3a3',
    tertiary: '#737373',
    muted: '#525252',
    inverse: '#000000',
  },
  accent: {
    cyan: '#22d3ee',
    cyanMuted: '#0891b2',
    cyanGlow: 'rgba(34, 211, 238, 0.15)',
    emerald: '#34d399',
    emeraldMuted: '#059669',
    emeraldGlow: 'rgba(52, 211, 153, 0.15)',
    amber: '#fbbf24',
    amberMuted: '#d97706',
    amberGlow: 'rgba(251, 191, 36, 0.15)',
    rose: '#fb7185',
    roseMuted: '#e11d48',
    roseGlow: 'rgba(251, 113, 133, 0.15)',
    violet: '#a78bfa',
    violetMuted: '#7c3aed',
    violetGlow: 'rgba(167, 139, 250, 0.15)',
    neutral: '#a3a3a3',
    neutralMuted: '#737373',
  },
  gradient: {
    surface: 'linear-gradient(180deg, #050505 0%, #000000 100%)',
    depth:
      'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)',
    borderGlow:
      'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
    scanlines:
      'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
  },
} as const;

export const VANTA_TYPOGRAPHY = {
  family: {
    mono: 'var(--font-label), "Share Tech Mono", monospace',
    grotesk: 'var(--font-heading), "Space Grotesk", sans-serif',
    sans: 'var(--font-body), "Geo", sans-serif',
    data: 'var(--font-stats), "Geo", sans-serif',
  },
  size: {
    '2xs': '0.625rem',
    xs: '0.6875rem',
    sm: '0.75rem',
    base: '0.8125rem',
    md: '0.875rem',
    lg: '1rem',
    xl: '1.125rem',
    '2xl': '1.25rem',
    '3xl': '1.5rem',
  },
  weight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  tracking: {
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
  leading: {
    none: '1',
    tight: '1.25',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
  },
  preset: {
    cardTitle: {
      fontFamily: 'var(--font-heading), "Space Grotesk", sans-serif',
      fontSize: 'var(--tmnl-text-xs, 12px)',
      fontWeight: '500',
      letterSpacing: '0.1em',
      lineHeight: '1.25',
      textTransform: 'uppercase' as const,
    },
    cardSubtitle: {
      fontFamily: 'var(--font-body), "Geo", sans-serif',
      fontSize: 'var(--tmnl-text-xs, 12px)',
      fontWeight: '400',
      letterSpacing: '0.02em',
      lineHeight: '1.5',
    },
    cardBody: {
      fontFamily: 'var(--font-body), "Geo", sans-serif',
      fontSize: 'var(--tmnl-text-sm, 14px)',
      fontWeight: '400',
      letterSpacing: '0.02em',
      lineHeight: '1.625',
    },
    label: {
      fontFamily: 'var(--font-label), "Share Tech Mono", monospace',
      fontSize: 'var(--tmnl-text-xs, 12px)',
      fontWeight: '500',
      letterSpacing: '0.15em',
      lineHeight: '1',
      textTransform: 'uppercase' as const,
    },
    value: {
      fontFamily: 'var(--font-stats), "Geo", sans-serif',
      fontSize: 'var(--tmnl-text-sm, 14px)',
      fontWeight: '600',
      letterSpacing: '0.025em',
      lineHeight: '1.25',
    },
    micro: {
      fontFamily: 'var(--font-label), "Share Tech Mono", monospace',
      fontSize: 'var(--tmnl-text-xs, 12px)',
      fontWeight: '400',
      letterSpacing: '0.05em',
      lineHeight: '1',
    },
  },
} as const;

export const VANTA_SPACING = {
  unit: 4,
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
  card: {
    padding: '16px',
    paddingCompact: '12px',
    gap: '12px',
    gapCompact: '8px',
  },
} as const;

export const VANTA_BORDERS = {
  width: {
    none: '0',
    thin: '1px',
    medium: '2px',
  },
  radius: {
    none: '0',
    sm: '2px',
    md: '4px',
    lg: '6px',
  },
  style: {
    default: `1px solid ${VANTA_COLORS.surface.border}`,
    subtle: `1px solid rgba(255, 255, 255, 0.05)`,
    hairline: `1px solid rgba(255, 255, 255, 0.12)`,
    crisp: `1px solid rgba(255, 255, 255, 0.18)`,
    accent: `1px solid ${VANTA_COLORS.accent.cyan}`,
    dashed: `1px dashed ${VANTA_COLORS.surface.border}`,
  },
  shadow: {
    none: 'none',
    ambient: '0 0 20px rgba(0, 0, 0, 0.5)',
    card: '0 4px 24px rgba(0, 0, 0, 0.4)',
    elevated: '0 8px 32px rgba(0, 0, 0, 0.6)',
    glowCyan: `0 0 14px ${VANTA_COLORS.accent.cyanGlow}`,
    glowEmerald: `0 0 20px ${VANTA_COLORS.accent.emeraldGlow}`,
    glowAmber: `0 0 20px ${VANTA_COLORS.accent.amberGlow}`,
    glowRose: `0 0 20px ${VANTA_COLORS.accent.roseGlow}`,
    inner: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  },
} as const;

export const VANTA_ANIMATION = {
  duration: {
    instant: '0ms',
    fast: '100ms',
    normal: '200ms',
    slow: '300ms',
    slower: '500ms',
    slowest: '800ms',
  },
  easing: {
    linear: 'linear',
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
  transition: {
    colors:
      'color 200ms cubic-bezier(0.4, 0, 0.2, 1), background-color 200ms cubic-bezier(0.4, 0, 0.2, 1), border-color 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    opacity: 'opacity 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    transform: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    all: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    shadow: 'box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

export const VANTA_CARD_VARIANTS = {
  default: {
    background: VANTA_COLORS.gradient.surface,
    border: VANTA_BORDERS.style.subtle,
    borderRadius: VANTA_BORDERS.radius.sm,
    boxShadow: VANTA_BORDERS.shadow.card,
    padding: VANTA_SPACING.card.padding,
  },
  elevated: {
    background: VANTA_COLORS.gradient.surface,
    border: VANTA_BORDERS.style.default,
    borderRadius: VANTA_BORDERS.radius.md,
    boxShadow: VANTA_BORDERS.shadow.elevated,
    padding: VANTA_SPACING.card.padding,
  },
  compact: {
    background: VANTA_COLORS.surface.base,
    border: VANTA_BORDERS.style.subtle,
    borderRadius: VANTA_BORDERS.radius.none,
    boxShadow: VANTA_BORDERS.shadow.none,
    padding: VANTA_SPACING.card.paddingCompact,
  },
  ghost: {
    background: 'transparent',
    border: 'none',
    borderRadius: VANTA_BORDERS.radius.none,
    boxShadow: VANTA_BORDERS.shadow.none,
    padding: VANTA_SPACING.card.padding,
  },
} as const;

export type VantaColorKey = keyof typeof VANTA_COLORS.surface;
export type VantaTextColorKey = keyof typeof VANTA_COLORS.text;
export type VantaAccentKey = keyof typeof VANTA_COLORS.accent;
export type VantaSizeKey = keyof typeof VANTA_TYPOGRAPHY.size;
export type VantaSpacingKey = keyof typeof VANTA_SPACING;
export type VantaCardVariant = keyof typeof VANTA_CARD_VARIANTS;
