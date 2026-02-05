/**
 * RvnFieldset - Brutalist Fieldset (Base UI)
 *
 * Wraps Base UI Fieldset with RVN styling.
 *
 * Features:
 * - 3px border
 * - Black header with white text (legend)
 * - Consistent padding
 */

import * as React from 'react'
import { Fieldset as BaseFieldset } from '@base-ui-components/react/fieldset'
import { clsx } from 'clsx'
import type { CSSProperties, ReactNode } from 'react'
import {
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_BORDERS,
  RVN_COLORS,
  RVN_SPACING,
} from '../../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RvnFieldsetProps {
  /** Fieldset legend */
  legend?: ReactNode
  /** Disabled state for all fields */
  disabled?: boolean
  /** Fieldset content */
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
  border: RVN_BORDERS.primary,
  borderRadius: RVN_BORDERS.radius,
  padding: RVN_SPACING.panelPadding,
  margin: 0,
  background: RVN_COLORS.surface,
}

const legendStyles: CSSProperties = {
  fontFamily: RVN_FONTS.sans,
  fontSize: RVN_FONT_SIZES.heading,
  fontWeight: RVN_FONT_WEIGHTS.bold,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: RVN_COLORS.white,
  background: RVN_COLORS.black,
  padding: '8px 16px',
  marginLeft: '-20px',
  marginTop: '-20px',
  marginBottom: RVN_SPACING.m,
  display: 'inline-block',
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function RvnFieldset({
  legend,
  disabled = false,
  children,
  className,
  style,
}: RvnFieldsetProps) {
  const containerStyle: CSSProperties = {
    ...containerStyles,
    opacity: disabled ? RVN_COLORS.disabledOpacity : 1,
    ...style,
  }

  return (
    <BaseFieldset.Root
      className={clsx('rvn-fieldset', className)}
      disabled={disabled}
      style={containerStyle}
    >
      {legend && (
        <BaseFieldset.Legend style={legendStyles}>{legend}</BaseFieldset.Legend>
      )}
      {children}
    </BaseFieldset.Root>
  )
}
