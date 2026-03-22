/**
 * RVN Token Hooks
 *
 * Hooks for accessing design tokens in components.
 */

import { useMemo } from 'react'
import {
  RVN_COLORS,
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_TEXT_PRESETS,
  RVN_SPACING,
  RVN_BORDERS,
  RVN_SHADOWS,
  RVN_PATTERNS,
  RVN_PRESS_TRANSFORM,
} from '../tokens'

/**
 * Access all RVN design tokens
 *
 * @example
 * ```tsx
 * const tokens = useRvnTokens()
 * <div style={{ border: tokens.borders.primary }}>...</div>
 * ```
 */
export function useRvnTokens() {
  return useMemo(
    () => ({
      colors: RVN_COLORS,
      fonts: RVN_FONTS,
      fontSizes: RVN_FONT_SIZES,
      fontWeights: RVN_FONT_WEIGHTS,
      textPresets: RVN_TEXT_PRESETS,
      spacing: RVN_SPACING,
      borders: RVN_BORDERS,
      shadows: RVN_SHADOWS,
      patterns: RVN_PATTERNS,
      pressTransform: RVN_PRESS_TRANSFORM,
    }),
    []
  )
}

/**
 * Get press state styles for interactive elements
 *
 * @example
 * ```tsx
 * const { pressStyle, defaultStyle } = useRvnPressStyle()
 * <button style={isPressed ? pressStyle : defaultStyle}>Click</button>
 * ```
 */
export function useRvnPressStyle() {
  return useMemo(
    () => ({
      pressStyle: {
        boxShadow: RVN_SHADOWS.pressed,
        transform: RVN_PRESS_TRANSFORM.transform,
      },
      defaultStyle: {
        boxShadow: RVN_SHADOWS.default,
        transform: 'translate(0, 0)',
        transition: 'box-shadow 100ms ease-out, transform 100ms ease-out',
      },
    }),
    []
  )
}

/**
 * Get critical state pattern (diagonal stripes)
 *
 * @example
 * ```tsx
 * const criticalBg = useRvnCriticalPattern()
 * <div style={{ background: isCritical ? criticalBg : 'black' }}>...</div>
 * ```
 */
export function useRvnCriticalPattern() {
  return RVN_PATTERNS.criticalStripe
}

/**
 * Build typography style object from preset
 *
 * @example
 * ```tsx
 * const labelStyle = useRvnTypography('label')
 * <span style={labelStyle}>STATUS</span>
 * ```
 */
export function useRvnTypography(preset: keyof typeof RVN_TEXT_PRESETS) {
  return useMemo(() => RVN_TEXT_PRESETS[preset], [preset])
}
