/**
 * BlockNameBadge Styles
 *
 * CSS-in-JS style definitions for all badge states.
 * Based on STORYBOARD.md typography and color specifications.
 *
 * @module editor/v3/extensions/blocks/BlockNameBadge/styles
 */

import type { CSSProperties } from 'react';
import { COLORS, TYPOGRAPHY, GEOMETRY } from './constants';

// =============================================================================
// Container Styles
// =============================================================================

export const badgeContainerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  position: 'relative',
  minWidth: '80px',
};

export const nameRowStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  position: 'relative',
  height: '20px', // Consistent height for all states
};

// =============================================================================
// Text Styles
// =============================================================================

export const prefixStyle: CSSProperties = {
  fontFamily: TYPOGRAPHY.name.fontFamily,
  fontSize: `${TYPOGRAPHY.name.fontSize}px`,
  fontWeight: TYPOGRAPHY.name.fontWeight,
  letterSpacing: TYPOGRAPHY.name.letterSpacing,
  color: COLORS.textPrimary,
  opacity: COLORS.prefixOpacity,
  userSelect: 'none',
};

export const nameStyle: CSSProperties = {
  fontFamily: TYPOGRAPHY.name.fontFamily,
  fontSize: `${TYPOGRAPHY.name.fontSize}px`,
  fontWeight: TYPOGRAPHY.name.fontWeight,
  letterSpacing: TYPOGRAPHY.name.letterSpacing,
  color: COLORS.textPrimary,
  cursor: 'text',
  userSelect: 'none',
};

export const nameUntitledStyle: CSSProperties = {
  ...nameStyle,
  fontStyle: TYPOGRAPHY.untitled.fontStyle,
  opacity: TYPOGRAPHY.untitled.opacity,
};

export const nameSubmittingStyle: CSSProperties = {
  ...nameStyle,
  opacity: 0.8, // Dimmed during submission
  pointerEvents: 'none',
};

export const blockIdStyle: CSSProperties = {
  fontFamily: TYPOGRAPHY.blockId.fontFamily,
  fontSize: `${TYPOGRAPHY.blockId.fontSize}px`,
  fontWeight: TYPOGRAPHY.blockId.fontWeight,
  letterSpacing: TYPOGRAPHY.blockId.letterSpacing,
  textTransform: TYPOGRAPHY.blockId.textTransform,
  color: COLORS.textMuted,
  opacity: 0.5,
  userSelect: 'none',
};

// =============================================================================
// Underline Styles
// =============================================================================

export const underlineBaseStyle: CSSProperties = {
  height: `${GEOMETRY.underlineHeight}px`,
  transformOrigin: 'left',
  marginTop: '2px',
};

export const underlineMutedStyle: CSSProperties = {
  ...underlineBaseStyle,
  backgroundColor: COLORS.underlineMuted,
  opacity: 0.3,
};

export const underlineCyanStyle: CSSProperties = {
  ...underlineBaseStyle,
  backgroundColor: COLORS.underlineCyan,
  opacity: 1,
};

export const underlineEmeraldStyle: CSSProperties = {
  ...underlineBaseStyle,
  backgroundColor: COLORS.underlineEmerald,
  opacity: 1,
};

export const underlineRoseStyle: CSSProperties = {
  ...underlineBaseStyle,
  backgroundColor: COLORS.underlineRose,
  opacity: 1,
};

// =============================================================================
// Input Styles (Editing State)
// =============================================================================

export const inputStyle: CSSProperties = {
  fontFamily: TYPOGRAPHY.name.fontFamily,
  fontSize: `${TYPOGRAPHY.name.fontSize}px`,
  fontWeight: TYPOGRAPHY.name.fontWeight,
  letterSpacing: TYPOGRAPHY.name.letterSpacing,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  caretColor: COLORS.underlineCyan,
  color: COLORS.textPrimary,
  padding: 0,
  margin: 0,
  minWidth: '100px',
  width: 'auto',
};

export const inputPlaceholderOpacity = TYPOGRAPHY.placeholder.opacity;

// =============================================================================
// Caret Style (Visible during editing)
// =============================================================================

export const caretStyle: CSSProperties = {
  width: `${GEOMETRY.caretWidth}px`,
  height: `${GEOMETRY.caretHeight}px`,
  backgroundColor: COLORS.underlineCyan,
  marginRight: '2px',
  flexShrink: 0,
};

// =============================================================================
// Checkmark Styles (Success State)
// =============================================================================

export const checkmarkStyle: CSSProperties = {
  color: COLORS.underlineEmerald,
  width: `${GEOMETRY.checkmarkSize}px`,
  height: `${GEOMETRY.checkmarkSize}px`,
  filter: `drop-shadow(0 0 4px ${COLORS.emeraldGlow})`,
  flexShrink: 0,
};

// =============================================================================
// Error Styles
// =============================================================================

export const errorMessageStyle: CSSProperties = {
  fontFamily: TYPOGRAPHY.blockId.fontFamily,
  fontSize: `${TYPOGRAPHY.blockId.fontSize}px`,
  fontWeight: TYPOGRAPHY.blockId.fontWeight,
  letterSpacing: TYPOGRAPHY.blockId.letterSpacing,
  color: COLORS.underlineRose,
  marginLeft: '8px',
  whiteSpace: 'nowrap',
};

// =============================================================================
// Shimmer Animation (CSS Keyframes)
// =============================================================================

/**
 * Shimmer keyframes for submitting state.
 * Inject this into a <style> tag in the component.
 */
export const shimmerKeyframes = `
@keyframes badge-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.badge-shimmer-active {
  background: linear-gradient(
    90deg,
    transparent 0%,
    ${COLORS.underlineCyan} 50%,
    transparent 100%
  ) !important;
  background-size: 200% 100% !important;
  animation: badge-shimmer 1.2s ease-in-out infinite !important;
}
`;

/**
 * Caret pulse animation for editing state.
 */
export const caretPulseKeyframes = `
@keyframes badge-caret-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.badge-caret-pulse {
  animation: badge-caret-pulse 800ms ease-in-out infinite;
}
`;

/**
 * Combined keyframes for injection
 */
export const allKeyframes = `
${shimmerKeyframes}
${caretPulseKeyframes}
`;

// =============================================================================
// State-Based Style Getters
// =============================================================================

export const getUnderlineStyle = (
  state: string
): CSSProperties => {
  switch (state) {
    case 'editing':
    case 'submitting':
      return underlineCyanStyle;
    case 'success':
      return underlineEmeraldStyle;
    case 'error':
      return underlineRoseStyle;
    default:
      return underlineMutedStyle;
  }
};

export const getNameStyle = (
  hasName: boolean,
  state: string
): CSSProperties => {
  if (state === 'submitting') {
    return nameSubmittingStyle;
  }
  return hasName ? nameStyle : nameUntitledStyle;
};
