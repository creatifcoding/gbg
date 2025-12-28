/**
 * TaskCheckbox Styles
 *
 * VANTA-matching design tokens for task list checkboxes.
 * Uses inline style objects for build compatibility.
 *
 * @module editor/v3/extensions/blocks/TaskItem/styles
 */

import type { CSSProperties } from 'react';
import {
  VANTA_COLORS,
  VANTA_BORDERS,
  VANTA_SPACING,
  VANTA_ANIMATION,
} from '@/components/portal/tokens';

// =============================================================================
// Sheen Gradient (Iridescent)
// =============================================================================

/**
 * Iridescent sheen gradient for sweep animation.
 * Subtle rainbow with dominant cyan to match accent.
 */
export const SHEEN_GRADIENT = `
  linear-gradient(
    105deg,
    transparent 0%,
    transparent 35%,
    rgba(34, 211, 238, 0.08) 40%,
    rgba(147, 51, 234, 0.06) 45%,
    rgba(236, 72, 153, 0.05) 50%,
    rgba(251, 191, 36, 0.04) 55%,
    rgba(34, 211, 238, 0.08) 60%,
    transparent 65%,
    transparent 100%
  )
`;

/**
 * Checked state glow gradient.
 */
export const CHECKED_GLOW = `
  radial-gradient(
    circle at center,
    ${VANTA_COLORS.accent.cyanGlow} 0%,
    transparent 70%
  )
`;

// =============================================================================
// Animation Timing
// =============================================================================

export const CHECKBOX_TIMING = {
  /** Sheen sweep duration (ms) */
  sheenDuration: 600,
  /** Sheen sweep easing */
  sheenEase: 'easeOutQuad',
  /** Sparkle burst duration (ms) */
  sparkleDuration: 400,
  /** Check scale pop */
  checkScale: 1.15,
  /** Glow pulse period (ms) */
  glowPulsePeriod: 2000,
} as const;

// =============================================================================
// Style Objects
// =============================================================================

export const taskItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: VANTA_SPACING['2'],
  padding: `${VANTA_SPACING['1']} 0`,
  margin: 0,
  listStyle: 'none',
  position: 'relative',
};

export const taskItemCheckedContentStyle: CSSProperties = {
  textDecoration: 'line-through',
  color: VANTA_COLORS.text.tertiary,
};

export const checkboxWrapperStyle: CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: 20,
  height: 20,
  marginTop: 2,
  cursor: 'pointer',
};

export const sheenOverlayStyle: CSSProperties = {
  content: '""',
  position: 'absolute',
  inset: -4,
  background: SHEEN_GRADIENT,
  backgroundSize: '300% 100%',
  backgroundPosition: '-100% 0',
  opacity: 0,
  pointerEvents: 'none',
  borderRadius: VANTA_BORDERS.radius.sm,
  transition: 'opacity 150ms ease-out',
};

export const glowOverlayStyle: CSSProperties = {
  content: '""',
  position: 'absolute',
  inset: -8,
  background: CHECKED_GLOW,
  opacity: 0,
  pointerEvents: 'none',
  transition: 'opacity 300ms ease-out',
};

export const checkboxInputStyle: CSSProperties = {
  position: 'absolute',
  opacity: 0,
  width: '100%',
  height: '100%',
  cursor: 'pointer',
  zIndex: 2,
};

export const checkboxVisualStyle: CSSProperties = {
  position: 'relative',
  width: 16,
  height: 16,
  border: `1px solid ${VANTA_COLORS.surface.border}`,
  borderRadius: VANTA_BORDERS.radius.sm,
  background: VANTA_COLORS.surface.elevated,
  transition: `all ${VANTA_ANIMATION.duration.fast} ${VANTA_ANIMATION.easing.default}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
};

export const checkboxVisualHoverStyle: CSSProperties = {
  borderColor: VANTA_COLORS.accent.cyanMuted,
  background: VANTA_COLORS.surface.raised,
};

export const checkboxVisualCheckedStyle: CSSProperties = {
  background: VANTA_COLORS.accent.cyan,
  borderColor: VANTA_COLORS.accent.cyan,
};

export const checkmarkStyle: CSSProperties = {
  width: 10,
  height: 10,
  stroke: VANTA_COLORS.surface.void,
  strokeWidth: 2.5,
  fill: 'none',
  opacity: 0,
  transform: 'scale(0.5)',
  transition: 'all 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
};

export const checkmarkVisibleStyle: CSSProperties = {
  opacity: 1,
  transform: 'scale(1)',
};

export const sparkleContainerStyle: CSSProperties = {
  position: 'absolute',
  inset: -12,
  pointerEvents: 'none',
  overflow: 'visible',
};

export const sparkleStyle: CSSProperties = {
  position: 'absolute',
  width: 4,
  height: 4,
  background: VANTA_COLORS.accent.cyan,
  borderRadius: '50%',
  opacity: 0,
  boxShadow: `0 0 4px ${VANTA_COLORS.accent.cyan}`,
};

export const contentStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  paddingTop: 1,
};

// Legacy class name exports for backwards compat (empty strings)
export const taskItemStyles = '';
export const checkboxWrapperStyles = '';
export const checkboxStyles = '';
export const checkboxVisualStyles = '';
export const sparkleContainerStyles = '';
export const contentStyles = '';
