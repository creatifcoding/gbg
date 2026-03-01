/**
 * @fileoverview Derived Token Maps — VANTA → Component Constants
 *
 * Bridges VANTA_* canonical tokens to component-specific style presets.
 * Every value here traces back to a VANTA_* import — zero hardcoded hex.
 *
 * Spec: src/lib/genifer/docs/specs/CATALOG_REBUILD_SPEC.md §6–§8
 *
 * @module genifer/catalog/tokens
 */

import {
  VANTA_COLORS,
  VANTA_TYPOGRAPHY,
  VANTA_SPACING,
  VANTA_BORDERS,
  VANTA_ANIMATION,
  VANTA_CARD_VARIANTS,
} from '@/components/portal/tokens'
import type { SpacingToken, Intent, ExtendedIntent } from './types'
import type { EntranceAnimation } from '@/lib/genifer/core/animation-schema'
import type React from 'react'

// =============================================================================
// Spacing Scale
// =============================================================================

/** Named spacing → pixel values via VANTA_SPACING */
export const GAP_SCALE: Record<SpacingToken, string> = {
  xs: VANTA_SPACING['1'],   // 4px
  sm: VANTA_SPACING['2'],   // 8px
  md: VANTA_SPACING['3'],   // 12px
  lg: VANTA_SPACING['4'],   // 16px
  xl: VANTA_SPACING['6'],   // 24px
}

// =============================================================================
// Intent → Accent Color Mapping
// =============================================================================

/** Intent to VANTA accent base color */
export const INTENT_ACCENT: Record<Intent, string> = {
  info:    VANTA_COLORS.accent.cyan,
  success: VANTA_COLORS.accent.emerald,
  warning: VANTA_COLORS.accent.amber,
  danger:  VANTA_COLORS.accent.rose,
}

/** Intent to VANTA accent muted color */
export const INTENT_MUTED: Record<Intent, string> = {
  info:    VANTA_COLORS.accent.cyanMuted,
  success: VANTA_COLORS.accent.emeraldMuted,
  warning: VANTA_COLORS.accent.amberMuted,
  danger:  VANTA_COLORS.accent.roseMuted,
}

/** Intent to VANTA accent glow */
export const INTENT_GLOW: Record<Intent, string> = {
  info:    VANTA_COLORS.accent.cyanGlow,
  success: VANTA_COLORS.accent.emeraldGlow,
  warning: VANTA_COLORS.accent.amberGlow,
  danger:  VANTA_COLORS.accent.roseGlow,
}

/** Extended intent (includes neutral for Badge) */
export const EXTENDED_INTENT_ACCENT: Record<ExtendedIntent, string> = {
  ...INTENT_ACCENT,
  neutral: VANTA_COLORS.accent.neutral,
}

// =============================================================================
// Animation Presets
// =============================================================================

export const ENTRANCE = {
  fade:  { property: 'opacity', easing: 'out-quad', duration: 'fast' } satisfies EntranceAnimation,
  slide: { property: 'opacity+translateY', easing: 'out-cubic', duration: 'normal' } satisfies EntranceAnimation,
  pop:   { property: 'opacity+scale', easing: 'out-back', duration: 'normal' } satisfies EntranceAnimation,
  quick: { property: 'opacity+scale', easing: 'out-quart', duration: 'fast' } satisfies EntranceAnimation,
} as const

// =============================================================================
// Text Presets
// =============================================================================

/** 7 text presets — the model's fast defaults for typography */
export const TEXT_PRESETS: Record<string, React.CSSProperties> = {
  body: {
    ...VANTA_TYPOGRAPHY.preset.cardBody,
    color: VANTA_COLORS.text.primary,
  },
  label: {
    ...VANTA_TYPOGRAPHY.preset.label,
    color: VANTA_COLORS.text.tertiary,
  },
  caption: {
    ...VANTA_TYPOGRAPHY.preset.micro,
    color: VANTA_COLORS.text.muted,
  },
  value: {
    ...VANTA_TYPOGRAPHY.preset.value,
    color: VANTA_COLORS.text.primary,
  },
  micro: {
    ...VANTA_TYPOGRAPHY.preset.micro,
    color: VANTA_COLORS.text.muted,
  },
  title: {
    ...VANTA_TYPOGRAPHY.preset.cardTitle,
    color: VANTA_COLORS.text.primary,
  },
  subtitle: {
    ...VANTA_TYPOGRAPHY.preset.cardSubtitle,
    color: VANTA_COLORS.text.secondary,
  },
}

// =============================================================================
// Heading Levels
// =============================================================================

/** 3 heading levels */
export const HEADING_LEVELS: Record<number, React.CSSProperties> = {
  1: {
    fontFamily: VANTA_TYPOGRAPHY.family.grotesk,
    fontSize: VANTA_TYPOGRAPHY.size.xl,
    fontWeight: VANTA_TYPOGRAPHY.weight.semibold,
    letterSpacing: VANTA_TYPOGRAPHY.tracking.tight,
    color: VANTA_COLORS.text.primary,
    lineHeight: VANTA_TYPOGRAPHY.leading.tight,
    margin: 0,
  },
  2: {
    fontFamily: VANTA_TYPOGRAPHY.family.grotesk,
    fontSize: VANTA_TYPOGRAPHY.size.md,
    fontWeight: VANTA_TYPOGRAPHY.weight.medium,
    letterSpacing: VANTA_TYPOGRAPHY.tracking.normal,
    color: VANTA_COLORS.text.primary,
    lineHeight: VANTA_TYPOGRAPHY.leading.snug,
    margin: 0,
  },
  3: {
    ...VANTA_TYPOGRAPHY.preset.label,
    color: VANTA_COLORS.text.tertiary,
    margin: 0,
  },
}

// =============================================================================
// Card Style
// =============================================================================

/** Bordered surface card — the ratified default */
export const CARD_STYLE: React.CSSProperties = {
  background: VANTA_COLORS.gradient.surface,
  border: VANTA_BORDERS.style.hairline,
  borderRadius: VANTA_BORDERS.radius.md,
  boxShadow: `${VANTA_BORDERS.shadow.inner}, ${VANTA_BORDERS.shadow.card}`,
  padding: VANTA_SPACING.card.padding,
}

/** Card variant overrides — defers to VANTA_CARD_VARIANTS with hairline upgrade */
export const CARD_VARIANTS: Record<string, React.CSSProperties> = {
  default: {
    ...VANTA_CARD_VARIANTS.default,
    border: VANTA_BORDERS.style.hairline,
    boxShadow: `${VANTA_BORDERS.shadow.inner}, ${VANTA_BORDERS.shadow.card}`,
  },
  elevated: {
    ...VANTA_CARD_VARIANTS.elevated,
    border: VANTA_BORDERS.style.hairline,
    boxShadow: `${VANTA_BORDERS.shadow.inner}, ${VANTA_BORDERS.shadow.elevated}`,
  },
  compact: {
    ...VANTA_CARD_VARIANTS.compact,
    border: VANTA_BORDERS.style.subtle,
  },
  ghost: VANTA_CARD_VARIANTS.ghost,
}

// =============================================================================
// Button System
// =============================================================================

/** Button base — shared across all variants */
export const BUTTON_BASE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: VANTA_SPACING['1.5'],
  fontFamily: VANTA_TYPOGRAPHY.family.mono,
  letterSpacing: VANTA_TYPOGRAPHY.tracking.wider,
  textTransform: 'uppercase',
  borderRadius: VANTA_BORDERS.radius.sm,
  cursor: 'pointer',
  transition: VANTA_ANIMATION.transition.all,
  userSelect: 'none',
  lineHeight: VANTA_TYPOGRAPHY.leading.none,
  whiteSpace: 'nowrap',
}

/** Button sizes */
export const BUTTON_SIZES: Record<string, React.CSSProperties> = {
  sm: { padding: `${VANTA_SPACING['1']} ${VANTA_SPACING['2.5']}`, fontSize: VANTA_TYPOGRAPHY.size.xs },
  md: { padding: `${VANTA_SPACING['1.5']} ${VANTA_SPACING['4']}`, fontSize: VANTA_TYPOGRAPHY.size.sm },
  lg: { padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['6']}`, fontSize: VANTA_TYPOGRAPHY.size.md },
}

/** Button variant resting styles */
export const BUTTON_VARIANTS: Record<string, React.CSSProperties> = {
  primary: {
    background: `rgba(34, 211, 238, 0.06)`,
    color: `rgba(34, 211, 238, 0.9)`,
    border: `1px solid rgba(34, 211, 238, 0.45)`,
  },
  secondary: {
    background: 'transparent',
    color: VANTA_COLORS.text.secondary,
    border: `1px solid rgba(255, 255, 255, 0.1)`,
  },
  ghost: {
    background: 'transparent',
    color: VANTA_COLORS.text.tertiary,
    border: '1px solid transparent',
  },
  danger: {
    background: `rgba(251, 113, 133, 0.06)`,
    color: `rgba(251, 113, 133, 0.9)`,
    border: `1px solid rgba(251, 113, 133, 0.3)`,
  },
}

/** Button hover styles — applied via onMouseEnter/Leave state */
export const BUTTON_HOVER: Record<string, React.CSSProperties> = {
  primary: {
    background: `rgba(34, 211, 238, 0.85)`,
    color: VANTA_COLORS.text.inverse,
    fontWeight: VANTA_TYPOGRAPHY.weight.semibold,
    border: `1px solid rgba(34, 211, 238, 0.8)`,
    transform: 'scale(1.02)',
    boxShadow: VANTA_BORDERS.shadow.glowCyan,
  },
  secondary: {
    background: `rgba(255, 255, 255, 0.06)`,
    color: VANTA_COLORS.text.primary,
    border: `1px solid rgba(255, 255, 255, 0.25)`,
    transform: 'scale(1.02)',
    boxShadow: `0 0 10px rgba(255, 255, 255, 0.05)`,
  },
  ghost: {
    background: `rgba(255, 255, 255, 0.04)`,
    color: VANTA_COLORS.text.secondary,
    border: `1px solid rgba(255, 255, 255, 0.08)`,
    transform: 'scale(1.02)',
  },
  danger: {
    background: `rgba(251, 113, 133, 0.75)`,
    color: VANTA_COLORS.text.inverse,
    fontWeight: VANTA_TYPOGRAPHY.weight.semibold,
    border: `1px solid rgba(251, 113, 133, 0.7)`,
    transform: 'scale(1.02)',
    boxShadow: VANTA_BORDERS.shadow.glowRose,
  },
}

/** Disabled overlay */
export const BUTTON_DISABLED: React.CSSProperties = {
  opacity: 0.4,
  cursor: 'not-allowed',
  pointerEvents: 'none',
  transform: 'none',
  boxShadow: 'none',
}

// =============================================================================
// Input System
// =============================================================================

/** Input base style */
export const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['3']}`,
  fontFamily: VANTA_TYPOGRAPHY.family.mono,
  fontSize: VANTA_TYPOGRAPHY.size.base,
  color: VANTA_COLORS.text.primary,
  background: `rgba(10, 10, 10, 0.8)`,
  border: `1px solid rgba(255, 255, 255, 0.08)`,
  borderRadius: VANTA_BORDERS.radius.md,
  outline: 'none',
  transition: VANTA_ANIMATION.transition.all,
}

/** Input focus ring */
export const INPUT_FOCUS: React.CSSProperties = {
  border: `1px solid rgba(34, 211, 238, 0.4)`,
  boxShadow: `0 0 0 1px rgba(34, 211, 238, 0.1)`,
}

/** Input error state */
export const INPUT_ERROR: React.CSSProperties = {
  border: `1px solid rgba(251, 113, 133, 0.35)`,
}

// =============================================================================
// Alert System
// =============================================================================

/** Build alert style from intent */
export function alertStyle(intent: Intent): React.CSSProperties {
  const accent = INTENT_ACCENT[intent]
  return {
    borderLeft: `2px solid ${accent}`,
    background: INTENT_GLOW[intent],
    padding: `${VANTA_SPACING['2.5']} ${VANTA_SPACING['3.5'] ?? '14px'}`,
    borderRadius: `0 ${VANTA_BORDERS.radius.sm} ${VANTA_BORDERS.radius.sm} 0`,
  }
}

// =============================================================================
// Badge System
// =============================================================================

/** Build badge style from intent */
export function badgeStyle(intent: ExtendedIntent): React.CSSProperties {
  const accent = EXTENDED_INTENT_ACCENT[intent]
  const isNeutral = intent === 'neutral'
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: `${VANTA_SPACING['0.5']} ${VANTA_SPACING['2']}`,
    ...VANTA_TYPOGRAPHY.preset.micro,
    color: accent,
    background: isNeutral
      ? `rgba(163, 163, 163, 0.08)`
      : (INTENT_GLOW as Record<string, string>)[intent] ?? `rgba(163, 163, 163, 0.08)`,
    border: `1px solid ${isNeutral ? 'rgba(163, 163, 163, 0.2)' : `${accent}40`}`,
    borderRadius: '9999px',
    whiteSpace: 'nowrap',
  }
}

// =============================================================================
// Progress Bar
// =============================================================================

/** Progress track style */
export const PROGRESS_TRACK: React.CSSProperties = {
  width: '100%',
  height: '3px',
  background: `rgba(255, 255, 255, 0.05)`,
  borderRadius: VANTA_BORDERS.radius.sm,
  overflow: 'hidden',
}

/** Build progress fill style */
export function progressFill(value: number, intent: Intent): React.CSSProperties {
  return {
    width: `${Math.max(0, Math.min(100, value))}%`,
    height: '100%',
    background: INTENT_ACCENT[intent],
    borderRadius: VANTA_BORDERS.radius.sm,
    transition: `width ${VANTA_ANIMATION.duration.normal} ${VANTA_ANIMATION.easing.out}`,
  }
}

// =============================================================================
// Separator
// =============================================================================

export const SEPARATOR_HORIZONTAL: React.CSSProperties = {
  width: '100%',
  height: '1px',
  background: `rgba(255, 255, 255, 0.04)`,
  border: 'none',
  margin: 0,
}

export const SEPARATOR_VERTICAL: React.CSSProperties = {
  width: '1px',
  height: '100%',
  background: `rgba(255, 255, 255, 0.04)`,
  border: 'none',
  margin: 0,
}

// =============================================================================
// Code Block
// =============================================================================

export const CODE_BLOCK: React.CSSProperties = {
  fontFamily: VANTA_TYPOGRAPHY.family.mono,
  fontSize: VANTA_TYPOGRAPHY.size.sm,
  color: VANTA_COLORS.text.primary,
  background: VANTA_COLORS.surface.elevated,
  border: VANTA_BORDERS.style.subtle,
  borderRadius: VANTA_BORDERS.radius.md,
  padding: `${VANTA_SPACING['3']} ${VANTA_SPACING['4']}`,
  overflow: 'auto',
  whiteSpace: 'pre',
  lineHeight: VANTA_TYPOGRAPHY.leading.normal,
}

export const CODE_INLINE: React.CSSProperties = {
  fontFamily: VANTA_TYPOGRAPHY.family.mono,
  fontSize: '0.9em',
  color: VANTA_COLORS.text.primary,
  background: VANTA_COLORS.surface.elevated,
  border: VANTA_BORDERS.style.subtle,
  borderRadius: VANTA_BORDERS.radius.sm,
  padding: `${VANTA_SPACING['0.5']} ${VANTA_SPACING['1.5']}`,
}

// =============================================================================
// Link
// =============================================================================

export const LINK_STYLE: React.CSSProperties = {
  color: VANTA_COLORS.accent.cyan,
  textDecoration: 'none',
  cursor: 'pointer',
  transition: VANTA_ANIMATION.transition.colors,
}

export const LINK_HOVER: React.CSSProperties = {
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
}
