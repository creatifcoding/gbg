/**
 * RvnInput - Brutalist Input Field (Base UI)
 *
 * Wraps Base UI Input with RVN styling.
 *
 * Features:
 * - 3px black border
 * - 4px 4px shadow
 * - Focus: inverted (black bg, white text)
 * - Monospace font for data entry
 */

import * as React from 'react'
import { Input as BaseInput } from '@base-ui-components/react/input'
import { clsx } from 'clsx'
import type { CSSProperties } from 'react'
import {
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_BORDERS,
  RVN_COLORS,
  RVN_SHADOWS,
  RVN_SPACING,
} from '../../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RvnInputProps
  extends Omit<React.ComponentPropsWithoutRef<typeof BaseInput>, 'style'> {
  /** Visual variant */
  variant?: 'default' | 'inline'
  /** Full width */
  fullWidth?: boolean
  /** Additional style overrides */
  style?: CSSProperties
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const baseInputStyles: CSSProperties = {
  display: 'block',
  minWidth: '120px',
  padding: RVN_SPACING.inputPadding,
  fontFamily: RVN_FONTS.mono,
  fontSize: RVN_FONT_SIZES.body,
  lineHeight: 1.4,
  border: RVN_BORDERS.primary,
  borderRadius: RVN_BORDERS.radius,
  background: RVN_COLORS.surface,
  color: RVN_COLORS.textMain,
  boxShadow: RVN_SHADOWS.default,
  outline: 'none',
  transition: 'all 100ms ease-out',
}

const focusStyles: CSSProperties = {
  background: RVN_COLORS.black,
  color: RVN_COLORS.white,
  boxShadow: 'none',
}

const disabledStyles: CSSProperties = {
  opacity: RVN_COLORS.disabledOpacity,
  cursor: 'not-allowed',
  background: RVN_COLORS.surfaceMuted,
  boxShadow: 'none',
}

const inlineVariantStyles: CSSProperties = {
  border: 'none',
  borderBottom: `2px solid ${RVN_COLORS.border}`,
  boxShadow: 'none',
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const RvnInput = React.forwardRef<HTMLInputElement, RvnInputProps>(
  function RvnInput(
    {
      className,
      variant = 'default',
      fullWidth = false,
      disabled = false,
      style,
      ...props
    },
    ref
  ) {
    const [isFocused, setIsFocused] = React.useState(false)

    const computedStyle: CSSProperties = {
      ...baseInputStyles,
      ...(variant === 'inline' && inlineVariantStyles),
      ...(isFocused && variant !== 'inline' && focusStyles),
      ...(disabled && disabledStyles),
      width: fullWidth ? '100%' : 'auto',
      ...style,
    }

    return (
      <BaseInput
        ref={ref}
        className={clsx('rvn-input', className)}
        disabled={disabled}
        style={computedStyle}
        onFocus={(e) => {
          setIsFocused(true)
          props.onFocus?.(e)
        }}
        onBlur={(e) => {
          setIsFocused(false)
          props.onBlur?.(e)
        }}
        {...props}
      />
    )
  }
)
