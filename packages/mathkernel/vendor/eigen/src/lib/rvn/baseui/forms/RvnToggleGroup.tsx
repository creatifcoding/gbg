/**
 * RvnToggleGroup - Brutalist Toggle Button Group (Base UI)
 *
 * Wraps Base UI ToggleGroup with RVN styling.
 *
 * Features:
 * - Connected toggle buttons
 * - Single or multiple selection
 * - Consistent RVN styling
 */

import * as React from 'react'
import { ToggleGroup as BaseToggleGroup } from '@base-ui-components/react/toggle-group'
import { Toggle as BaseToggle } from '@base-ui-components/react/toggle'
import { clsx } from 'clsx'
import type { CSSProperties, ReactNode } from 'react'
import {
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_BORDERS,
  RVN_COLORS,
  RVN_SHADOWS,
  RVN_SPACING,
} from '../../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RvnToggleGroupProps {
  /** Controlled value (array of pressed values) */
  value?: readonly string[]
  /** Default value (uncontrolled) */
  defaultValue?: readonly string[]
  /** Change handler */
  onValueChange?: (value: string[]) => void
  /** Disabled state for entire group */
  disabled?: boolean
  /** Toggle items */
  children: ReactNode
  /** Additional class name */
  className?: string
  /** Additional style overrides */
  style?: CSSProperties
}

export interface RvnToggleGroupItemProps {
  /** Item value */
  value: string
  /** Item content */
  children: ReactNode
  /** Disabled state */
  disabled?: boolean
  /** Additional class name */
  className?: string
  /** Additional style overrides */
  style?: CSSProperties
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const groupStyles: CSSProperties = {
  display: 'inline-flex',
  gap: '0',
}

const itemStyles: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: RVN_SPACING.buttonPadding,
  fontFamily: RVN_FONTS.sans,
  fontSize: RVN_FONT_SIZES.label,
  fontWeight: RVN_FONT_WEIGHTS.bold,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  border: RVN_BORDERS.primary,
  borderRadius: RVN_BORDERS.radius,
  background: RVN_COLORS.surface,
  color: RVN_COLORS.textMain,
  boxShadow: RVN_SHADOWS.default,
  cursor: 'pointer',
  outline: 'none',
  transition: 'all 100ms ease-out',
  marginLeft: '-3px', // Overlap borders
}

// Note: State-specific styles (first, pressed, disabled) are handled via
// data attributes and CSS. These could be applied via render props if needed.
// const itemFirstStyles: CSSProperties = { marginLeft: '0' }
// const itemPressedStyles: CSSProperties = { ... }
// const itemDisabledStyles: CSSProperties = { ... }

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

export function RvnToggleGroup({
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  children,
  className,
  style,
}: RvnToggleGroupProps) {
  return (
    <BaseToggleGroup
      className={clsx('rvn-toggle-group', className)}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
      style={{ ...groupStyles, ...style }}
    >
      {children}
    </BaseToggleGroup>
  )
}

export function RvnToggleGroupItem({
  value,
  children,
  disabled = false,
  className,
  style,
}: RvnToggleGroupItemProps) {
  return (
    <BaseToggle
      value={value}
      disabled={disabled}
      className={clsx('rvn-toggle-group-item', className)}
      style={{ ...itemStyles, ...style }}
    >
      {children}
    </BaseToggle>
  )
}
