/**
 * RvnCheckboxGroup - Brutalist Checkbox Group (Base UI)
 *
 * Wraps Base UI CheckboxGroup with RVN styling.
 *
 * Features:
 * - Vertical or horizontal layout
 * - Consistent spacing
 * - Group-level disabled state
 */

import * as React from 'react'
import { CheckboxGroup as BaseCheckboxGroup } from '@base-ui-components/react/checkbox-group'
import { clsx } from 'clsx'
import type { CSSProperties, ReactNode } from 'react'
import {
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_COLORS,
  RVN_SPACING,
} from '../../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RvnCheckboxGroupProps {
  /** Controlled selected values */
  value?: string[]
  /** Default selected values (uncontrolled) */
  defaultValue?: string[]
  /** Change handler - receives string array and event details */
  onValueChange?: (value: string[], eventDetails: { event: Event }) => void
  /** Layout direction */
  direction?: 'horizontal' | 'vertical'
  /** Group label */
  label?: ReactNode
  /** Disabled state for entire group */
  disabled?: boolean
  /** Children (RvnCheckbox components) */
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
  gap: RVN_SPACING.s,
}

const labelStyles: CSSProperties = {
  fontFamily: RVN_FONTS.sans,
  fontSize: RVN_FONT_SIZES.label,
  fontWeight: RVN_FONT_WEIGHTS.bold,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: RVN_COLORS.textMain,
  marginBottom: RVN_SPACING.xs,
}

const groupStyles = (direction: 'horizontal' | 'vertical'): CSSProperties => ({
  display: 'flex',
  flexDirection: direction === 'horizontal' ? 'row' : 'column',
  gap: direction === 'horizontal' ? RVN_SPACING.m : RVN_SPACING.s,
  flexWrap: direction === 'horizontal' ? 'wrap' : undefined,
})

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function RvnCheckboxGroup({
  value,
  defaultValue,
  onValueChange,
  direction = 'vertical',
  label,
  disabled = false,
  children,
  className,
  style,
}: RvnCheckboxGroupProps) {
  return (
    <div
      className={clsx('rvn-checkbox-group', className)}
      style={{ ...containerStyles, ...style }}
    >
      {label && <div style={labelStyles}>{label}</div>}
      <BaseCheckboxGroup
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        disabled={disabled}
        style={groupStyles(direction)}
      >
        {children}
      </BaseCheckboxGroup>
    </div>
  )
}
