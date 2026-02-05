/**
 * RvnTextarea - Brutalist Multi-line Text Input
 *
 * For technician notes, mission briefings, log entries.
 * Note: Base UI does not have a textarea component, so this remains
 * a native implementation but follows Base UI patterns.
 *
 * Features:
 * - 3px solid black border
 * - Monospace font
 * - Resizable (vertical only by default)
 * - Focus ring
 */

import * as React from 'react'
import { useState, useCallback, forwardRef } from 'react'
import type { CSSProperties, TextareaHTMLAttributes } from 'react'
import { clsx } from 'clsx'
import {
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_BORDERS,
  RVN_COLORS,
  RVN_SPACING,
  RVN_LINE_HEIGHTS,
} from '../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RvnTextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'style'> {
  /** Number of visible rows */
  rows?: number
  /** Resize behavior */
  resize?: 'none' | 'vertical' | 'horizontal' | 'both'
  /** Full width */
  fullWidth?: boolean
  /** Additional style overrides */
  style?: CSSProperties
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const baseTextareaStyles: CSSProperties = {
  display: 'block',
  minWidth: '200px',
  padding: RVN_SPACING.panelPadding,
  fontFamily: RVN_FONTS.mono,
  fontSize: RVN_FONT_SIZES.body,
  lineHeight: RVN_LINE_HEIGHTS.normal,
  border: RVN_BORDERS.primary,
  borderRadius: RVN_BORDERS.radius,
  background: RVN_COLORS.surface,
  color: RVN_COLORS.textMain,
  outline: 'none',
  transition: 'box-shadow 100ms ease-out',
}

const focusStyles: CSSProperties = {
  boxShadow: `inset 0 0 0 2px ${RVN_COLORS.black}`,
}

const disabledStyles: CSSProperties = {
  opacity: RVN_COLORS.disabledOpacity,
  cursor: 'not-allowed',
  background: RVN_COLORS.surfaceMuted,
  resize: 'none',
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const RvnTextarea = forwardRef<HTMLTextAreaElement, RvnTextareaProps>(
  function RvnTextarea(
    {
      className,
      rows = 4,
      resize = 'vertical',
      fullWidth = false,
      disabled = false,
      style,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) {
    const [isFocused, setIsFocused] = useState(false)

    const handleFocus = useCallback(
      (e: React.FocusEvent<HTMLTextAreaElement>) => {
        setIsFocused(true)
        onFocus?.(e)
      },
      [onFocus]
    )

    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLTextAreaElement>) => {
        setIsFocused(false)
        onBlur?.(e)
      },
      [onBlur]
    )

    const computedStyle: CSSProperties = {
      ...baseTextareaStyles,
      resize: disabled ? 'none' : resize,
      boxShadow: isFocused ? focusStyles.boxShadow : 'none',
      ...(disabled && disabledStyles),
      width: fullWidth ? '100%' : 'auto',
      ...style,
    }

    return (
      <textarea
        ref={ref}
        className={clsx('rvn-textarea', className)}
        rows={rows}
        disabled={disabled}
        style={computedStyle}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
    )
  }
)
