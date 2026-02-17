import {
  VANTA_BORDERS,
  VANTA_COLORS,
  VANTA_TYPOGRAPHY,
} from '@/components/portal/tokens'

/**
 * NuCmdk visual tokens.
 *
 * Layered on top of the Vanta black design system so shell styling stays
 * consistent and explicit instead of ad-hoc inline values.
 */
export const NU_CMDK_TOKENS = {
  surface: {
    panel: `linear-gradient(180deg, ${VANTA_COLORS.surface.base} 0%, ${VANTA_COLORS.surface.void} 100%)`,
    band: 'rgba(0, 0, 0, 0.94)',
    row: 'rgba(0, 0, 0, 0.84)',
    rowSelected: 'linear-gradient(90deg, rgba(2, 58, 77, 0.58), rgba(0, 0, 0, 0.5))',
    rowHover: 'rgba(255, 255, 255, 0.02)',
    pill: 'rgba(5, 5, 5, 0.94)',
    badgeWarn: 'rgba(76, 51, 13, 0.46)',
  },
  border: {
    subtle: 'rgba(255, 255, 255, 0.1)',
    medium: 'rgba(255, 255, 255, 0.16)',
    accent: 'rgba(34, 211, 238, 0.24)',
    hard: 'rgba(255, 255, 255, 0.24)',
    radius: {
      shell: VANTA_BORDERS.radius.md,
      row: VANTA_BORDERS.radius.sm,
      pill: VANTA_BORDERS.radius.sm,
      badge: VANTA_BORDERS.radius.sm,
    },
  },
  text: {
    primary: VANTA_COLORS.text.primary,
    secondary: VANTA_COLORS.text.secondary,
    tertiary: VANTA_COLORS.text.tertiary,
    muted: VANTA_COLORS.text.muted,
  },
  accent: {
    cyan: VANTA_COLORS.accent.cyan,
    cyanGlow: VANTA_COLORS.accent.cyanGlow,
    success: VANTA_COLORS.accent.emerald,
    warn: VANTA_COLORS.accent.amber,
    offline: VANTA_COLORS.accent.neutralMuted,
  },
  typography: {
    family: {
      heading: 'var(--font-cmdk-heading), var(--font-label), "Share Tech Mono", monospace',
      ui: 'var(--font-cmdk-ui), var(--font-label), "Share Tech Mono", monospace',
      data: 'var(--font-cmdk-mono), var(--font-label), "Share Tech Mono", monospace',
    },
    size: {
      xs: 'var(--tmnl-text-xs, 12px)',
      sm: 'var(--tmnl-text-sm, 14px)',
      base: 'var(--tmnl-text-base, 16px)',
    },
  },
  shadow: {
    shell:
      '0 42px 140px rgba(0, 0, 0, 0.78), 0 0 0 1px rgba(0, 0, 0, 0.9), 0 0 72px rgba(34, 211, 238, 0.08)',
    selectedInset: 'inset 0 0 0 1px rgba(34, 211, 238, 0.1)',
    onlineDot: '0 0 7px rgba(0, 212, 143, 0.62)',
  },
  misc: {
    chipRadius: VANTA_BORDERS.radius.sm,
    dotRadius: '999px',
    placeholder: 'rgba(163, 163, 163, 0.52)',
  },
} as const
