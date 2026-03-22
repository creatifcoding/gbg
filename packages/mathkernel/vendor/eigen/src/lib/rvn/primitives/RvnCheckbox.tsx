/**
 * RvnCheckbox - Brutalist Checkbox (Base UI)
 *
 * Wraps Base UI Checkbox with RVN styling.
 *
 * Features:
 * - 3px border, square (no radius)
 * - Solid black fill when checked
 * - Uppercase label
 * - Touch-friendly (minimum 44px tap target via padding)
 */

import * as React from 'react'
import { useState, useCallback } from 'react'
import type { CSSProperties, ReactNode, InputHTMLAttributes } from 'react'
import { Checkbox as BaseCheckbox } from '@base-ui-components/react/checkbox'
import { clsx } from 'clsx'
import {
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_BORDERS,
  RVN_COLORS,
  RVN_SPACING,
} from '../tokens'

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
  /** onChange handler for form compatibility */
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
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
  /** ID attribute */
  id?: string
  /** Additional class name */
  className?: string
  /** Additional style overrides for container */
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

const indicatorStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '20px',
  height: '20px',
  minWidth: '20px',
  border: RVN_BORDERS.primary,
  borderRadius: RVN_BORDERS.radius,
  background: RVN_COLORS.surface,
  transition: 'background 100ms ease-out',
}

const indicatorCheckedStyles: CSSProperties = {
  background: RVN_COLORS.black,
}

const checkmarkStyles: CSSProperties = {
  width: '8px',
  height: '8px',
  background: RVN_COLORS.white,
}

const labelStyles: CSSProperties = {
  fontFamily: RVN_FONTS.sans,
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
  onChange,
  label,
  labelPosition = 'right',
  disabled = false,
  name,
  value,
  id,
  className,
  style,
}: RvnCheckboxProps) {
  const [internalChecked, setInternalChecked] = useState(defaultChecked ?? false)
  const isControlled = checked !== undefined
  const isChecked = isControlled ? checked : internalChecked

  const handleChange = useCallback(
    (newChecked: boolean) => {
      if (!isControlled) {
        setInternalChecked(newChecked)
      }
      onCheckedChange?.(newChecked)
      // Emit synthetic event for onChange compatibility
      if (onChange) {
        const syntheticEvent = {
          target: {
            type: 'checkbox',
            checked: newChecked,
            name,
            value,
          },
        } as React.ChangeEvent<HTMLInputElement>
        onChange(syntheticEvent)
      }
    },
    [isControlled, onCheckedChange, onChange, name, value]
  )

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
      id={id}
      style={containerStyle}
    >
      {/* Custom indicator box that always renders */}
      <span
        className="rvn-checkbox-indicator"
        style={{
          ...indicatorStyles,
          ...(isChecked && indicatorCheckedStyles),
        }}
        data-indicator="true"
      >
        {isChecked && <span style={checkmarkStyles} />}
      </span>
      {label && (
        <span style={labelStyles}>
          {typeof label === 'string' ? label.toUpperCase() : label}
        </span>
      )}
    </BaseCheckbox.Root>
  )
}
