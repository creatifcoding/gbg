/**
 * RvnField - Brutalist Form Field (Base UI)
 *
 * Wraps Base UI Field with RVN styling.
 *
 * Features:
 * - 3px border
 * - Monospace label
 * - Error state with diagonal stripes
 * - Description and error message support
 */

import * as React from 'react'
import { Field as BaseField } from '@base-ui-components/react/field'
import { clsx } from 'clsx'
import type { CSSProperties, ReactNode } from 'react'
import {
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_BORDERS,
  RVN_COLORS,
  RVN_SPACING,
  RVN_PATTERNS,
} from '../../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RvnFieldProps {
  /** Field label */
  label?: ReactNode
  /** Field description */
  description?: ReactNode
  /** Error message */
  error?: ReactNode
  /** Required indicator */
  required?: boolean
  /** Disabled state */
  disabled?: boolean
  /** Field content (input, select, etc.) */
  children: ReactNode
  /** Additional class name */
  className?: string
  /** Additional style overrides */
  style?: CSSProperties
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const containerStyles: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: RVN_SPACING.xs,
}

const labelStyles: CSSProperties = {
  fontFamily: RVN_FONTS.mono,
  fontSize: RVN_FONT_SIZES.label,
  fontWeight: RVN_FONT_WEIGHTS.bold,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: RVN_COLORS.textMain,
}

const requiredStyles: CSSProperties = {
  color: RVN_COLORS.textMain,
  marginLeft: '4px',
}

const descriptionStyles: CSSProperties = {
  fontFamily: RVN_FONTS.sans,
  fontSize: RVN_FONT_SIZES.label,
  color: RVN_COLORS.textMuted,
}

const errorStyles: CSSProperties = {
  fontFamily: RVN_FONTS.mono,
  fontSize: RVN_FONT_SIZES.label,
  fontWeight: RVN_FONT_WEIGHTS.bold,
  textTransform: 'uppercase',
  color: RVN_COLORS.textMain,
  padding: '4px 8px',
  background: RVN_PATTERNS.criticalStripe,
}

const controlStyles: CSSProperties = {
  marginTop: RVN_SPACING.xs,
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function RvnField({
  label,
  description,
  error,
  required = false,
  disabled = false,
  children,
  className,
  style,
}: RvnFieldProps) {
  const containerStyle: CSSProperties = {
    ...containerStyles,
    opacity: disabled ? RVN_COLORS.disabledOpacity : 1,
    ...style,
  }

  return (
    <BaseField.Root
      className={clsx('rvn-field', className)}
      disabled={disabled}
      invalid={!!error}
      style={containerStyle}
    >
      {label && (
        <BaseField.Label style={labelStyles}>
          {label}
          {required && <span style={requiredStyles}>*</span>}
        </BaseField.Label>
      )}
      {description && (
        <BaseField.Description style={descriptionStyles}>
          {description}
        </BaseField.Description>
      )}
      <BaseField.Control style={controlStyles}>{children}</BaseField.Control>
      {error && (
        <BaseField.Error style={errorStyles}>{error}</BaseField.Error>
      )}
    </BaseField.Root>
  )
}
