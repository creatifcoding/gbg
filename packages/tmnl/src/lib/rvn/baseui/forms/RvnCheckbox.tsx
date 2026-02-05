/**
 * RvnCheckbox - Brutalist Checkbox (Base UI)
 *
 * Wraps Base UI Checkbox with RVN styling.
 *
 * Features:
 * - 16x16px black border checkbox
 * - Black checkmark on check
 * - Monospace label
 * - 3px solid border
 */

import * as React from 'react'
import { Checkbox as BaseCheckbox } from '@base-ui-components/react/checkbox'
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

export interface RvnCheckboxProps {
  /** Controlled checked state */
  checked?: boolean
  /** Default checked state (uncontrolled) */
  defaultChecked?: boolean
  /** Change handler */
  onCheckedChange?: (checked: boolean) => void
  /** Checkbox label */
  label?: ReactNode
  /** Label position */
  labelPosition?: 'left' | 'right'
  /** Disabled state */
  disabled?: boolean
  /** Name for form submission */
  name?: string
  /** Value for form submission */
  value?: string
  /** Additional class name */
  className?: string
  /** Additional style overrides */
  style?: CSSProperties
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const containerStyles: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: RVN_SPACING.s,
  cursor: 'pointer',
  userSelect: 'none',
}

const boxStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '16px',
  height: '16px',
  minWidth: '16px',
  border: RVN_BORDERS.primary,
  borderRadius: RVN_BORDERS.radius,
  background: RVN_COLORS.surface,
  transition: 'background 100ms ease-out',
}

const boxCheckedStyles: CSSProperties = {
  background: RVN_COLORS.black,
}

const indicatorStyles: CSSProperties = {
  width: '8px',
  height: '8px',
  background: RVN_COLORS.white,
}

const labelStyles: CSSProperties = {
  fontFamily: RVN_FONTS.mono,
  fontSize: RVN_FONT_SIZES.label,
  fontWeight: RVN_FONT_WEIGHTS.semibold,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: RVN_COLORS.textMain,
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function RvnCheckbox({
  checked,
  defaultChecked,
  onCheckedChange,
  label,
  labelPosition = 'right',
  disabled = false,
  name,
  value,
  className,
  style,
}: RvnCheckboxProps) {
  const [internalChecked, setInternalChecked] = React.useState(defaultChecked ?? false)
  const isControlled = checked !== undefined
  const isChecked = isControlled ? checked : internalChecked

  const handleChange = (newChecked: boolean) => {
    if (!isControlled) {
      setInternalChecked(newChecked)
    }
    onCheckedChange?.(newChecked)
  }

  const containerStyle: CSSProperties = {
    ...containerStyles,
    flexDirection: labelPosition === 'left' ? 'row-reverse' : 'row',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? RVN_COLORS.disabledOpacity : 1,
    ...style,
  }

  return (
    <BaseCheckbox.Root
      className={clsx('rvn-checkbox', className)}
      checked={isChecked}
      onCheckedChange={handleChange}
      disabled={disabled}
      name={name}
      value={value}
      style={containerStyle}
    >
      <BaseCheckbox.Indicator
        style={{
          ...boxStyles,
          ...(isChecked && boxCheckedStyles),
        }}
      >
        {isChecked && <span style={indicatorStyles} />}
      </BaseCheckbox.Indicator>
      {label && <span style={labelStyles}>{label}</span>}
    </BaseCheckbox.Root>
  )
}
