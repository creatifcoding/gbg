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
  display: 'grid',
  gridTemplateColumns: 'auto auto',
  gridTemplateRows: 'auto auto auto',
  gap: '0 8px', // row-gap: 0, column-gap: 8px
  alignItems: 'center',
  position: 'relative',
  minWidth: '80px',
};

/**
 * Name column - spans all rows, triggers hover
 */
export const nameColumnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  gridColumn: '1',
  gridRow: '1 / -1',
};

/**
 * Actions column - only visible on hover
 * Contains the action tray with copy buttons
 */
export const actionsColumnStyle: CSSProperties = {
  gridColumn: '2',
  gridRow: '1 / -1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
};

/**
 * Actions column when hidden (idle state)
 */
export const actionsColumnHiddenStyle: CSSProperties = {
  ...actionsColumnStyle,
  visibility: 'hidden',
  pointerEvents: 'none',
};

/**
 * Actions column when visible (hovered state)
 */
export const actionsColumnVisibleStyle: CSSProperties = {
  ...actionsColumnStyle,
  visibility: 'visible',
  pointerEvents: 'auto',
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
// Error Styles — "Soft" Variant Popover
// =============================================================================

/**
 * Error popover container — positioned below the badge.
 * Uses the "soft" variant pattern:
 * - Background: low-opacity accent fill (~12%)
 * - Border: medium-opacity accent (~30%)
 * - Text: full accent color
 */
export const errorPopoverStyle: CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: '8px',
  padding: '8px 12px',
  borderRadius: '6px',
  backgroundColor: COLORS.roseSoftBg,
  border: `1px solid ${COLORS.roseSoftBorder}`,
  boxShadow: `0 4px 12px rgba(0, 0, 0, 0.25), 0 0 0 1px ${COLORS.roseSoftBorder}`,
  zIndex: 10,
  minWidth: '160px',
  maxWidth: '280px',
};

/**
 * Error popover header row (icon + title)
 */
export const errorPopoverHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  marginBottom: '4px',
};

/**
 * Error icon (✕ or warning symbol)
 */
export const errorPopoverIconStyle: CSSProperties = {
  color: COLORS.underlineRose,
  fontSize: '12px',
  flexShrink: 0,
};

/**
 * Error title text
 */
export const errorPopoverTitleStyle: CSSProperties = {
  fontFamily: TYPOGRAPHY.name.fontFamily,
  fontSize: '12px',
  fontWeight: 500,
  color: COLORS.underlineRose,
  letterSpacing: '-0.01em',
};

/**
 * Error message body
 */
export const errorPopoverMessageStyle: CSSProperties = {
  fontFamily: TYPOGRAPHY.blockId.fontFamily,
  fontSize: '11px',
  fontWeight: 400,
  color: 'rgba(255, 255, 255, 0.7)',
  lineHeight: 1.4,
  wordBreak: 'break-word',
};

/**
 * Retry hint at bottom
 */
export const errorPopoverHintStyle: CSSProperties = {
  fontFamily: TYPOGRAPHY.blockId.fontFamily,
  fontSize: '10px',
  fontWeight: 400,
  color: 'rgba(255, 255, 255, 0.4)',
  marginTop: '6px',
  cursor: 'pointer',
  userSelect: 'none',
};

/**
 * Legacy inline error style (kept for reference)
 * @deprecated Use errorPopoverStyle instead
 */
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
